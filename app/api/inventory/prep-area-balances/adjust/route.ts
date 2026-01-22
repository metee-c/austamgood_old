import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/inventory/prep-area-balances/adjust
 * 
 * Quick adjust preparation area inventory to match actual count
 * This directly updates wms_inventory_balances for all pallets of the SKU in the location
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { 
      warehouse_id, 
      location_id, 
      sku_id, 
      actual_piece_qty,
      reason 
    } = body;

    // Validate required fields
    if (!warehouse_id || !location_id || !sku_id || actual_piece_qty === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔧 Quick adjust prep area inventory:', {
      warehouse_id,
      location_id,
      sku_id,
      actual_piece_qty,
      reason
    });

    // Get current total from all pallets
    const { data: currentBalances, error: fetchError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, pallet_id, total_piece_qty, reserved_piece_qty, total_pack_qty, reserved_pack_qty')
      .eq('warehouse_id', warehouse_id)
      .eq('location_id', location_id)
      .eq('sku_id', sku_id);

    if (fetchError) {
      console.error('❌ Error fetching current balances:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch current balances', details: fetchError.message },
        { status: 500 }
      );
    }

    // Calculate current total (0 if no balances exist)
    const currentTotal = currentBalances?.reduce((sum, b) => sum + (b.total_piece_qty || 0), 0) || 0;
    const totalReserved = currentBalances?.reduce((sum, b) => sum + (b.reserved_piece_qty || 0), 0) || 0;
    const difference = actual_piece_qty - currentTotal;

    console.log('📊 Current state:', {
      currentTotal,
      totalReserved,
      actual_piece_qty,
      difference,
      palletCount: currentBalances?.length || 0,
      hasExistingInventory: currentBalances && currentBalances.length > 0
    });

    // If no difference, nothing to do
    if (difference === 0) {
      return NextResponse.json({
        success: true,
        message: 'No adjustment needed - quantity matches',
        data: {
          current_qty: currentTotal,
          actual_qty: actual_piece_qty,
          difference: 0
        }
      });
    }

    // Check if adjustment would make available qty negative
    const newAvailable = actual_piece_qty - totalReserved;
    if (newAvailable < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot adjust: would result in negative available quantity (${newAvailable}). Reserved: ${totalReserved}` 
        },
        { status: 400 }
      );
    }

    let adjustedPalletId: string;

    // Case 1: No existing inventory - create new balance record
    if (!currentBalances || currentBalances.length === 0) {
      console.log('📦 Creating new inventory balance (no existing stock)');
      
      // Generate a new pallet ID for this adjustment
      const newPalletId = `ADJ-${Date.now()}`;
      
      // Get SKU info for qty_per_pack
      const { data: skuData } = await supabase
        .from('master_sku')
        .select('qty_per_pack')
        .eq('sku_id', sku_id)
        .single();
      
      const qtyPerPack = skuData?.qty_per_pack || 1;
      const packQty = Math.floor(actual_piece_qty / qtyPerPack);

      const { error: insertError } = await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id,
          location_id,
          sku_id,
          pallet_id: newPalletId,
          pallet_id_external: newPalletId,
          total_piece_qty: actual_piece_qty,
          total_pack_qty: packQty,
          reserved_piece_qty: 0,
          reserved_pack_qty: 0,
          lot_no: null,
          production_date: null,
          expiry_date: null,
          last_movement_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Error creating balance:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to create inventory', details: insertError.message },
          { status: 500 }
        );
      }

      adjustedPalletId = newPalletId;
    } 
    // Case 2: Existing inventory - adjust the first pallet
    else {
      console.log('📦 Adjusting existing inventory balance');
      
      const firstPallet = currentBalances[0];
      const newPieceQty = firstPallet.total_piece_qty + difference;

      if (newPieceQty < firstPallet.reserved_piece_qty) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Cannot adjust: pallet ${firstPallet.pallet_id} would have negative available quantity` 
          },
          { status: 400 }
        );
      }

      // Update the first pallet
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({
          total_piece_qty: newPieceQty,
          last_movement_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('balance_id', firstPallet.balance_id);

      if (updateError) {
        console.error('❌ Error updating balance:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update inventory', details: updateError.message },
          { status: 500 }
        );
      }

      adjustedPalletId = firstPallet.pallet_id;
    }

    // Log the adjustment in inventory ledger
    const { error: ledgerError } = await supabase
      .from('wms_inventory_ledger')
      .insert({
        warehouse_id,
        location_id,
        sku_id,
        pallet_id: adjustedPalletId,
        transaction_type: difference > 0 ? 'adjustment_increase' : 'adjustment_decrease',
        piece_qty: Math.abs(difference),
        pack_qty: 0,
        reference_no: `QUICK-ADJ-${Date.now()}`,
        remarks: reason || 'Quick adjustment from prep area inventory page',
        created_at: new Date().toISOString()
      });

    if (ledgerError) {
      console.warn('⚠️ Failed to log adjustment in ledger:', ledgerError);
      // Don't fail the request, just warn
    }

    console.log('✅ Successfully adjusted inventory');

    return NextResponse.json({
      success: true,
      message: `Successfully adjusted inventory by ${difference > 0 ? '+' : ''}${difference} pieces`,
      data: {
        previous_qty: currentTotal,
        actual_qty: actual_piece_qty,
        difference,
        adjusted_pallet: adjustedPalletId
      }
    });

  } catch (error: any) {
    console.error('❌ Unexpected error in prep-area-balances adjust API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
