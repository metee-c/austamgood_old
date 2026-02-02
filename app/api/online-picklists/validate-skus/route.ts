import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { picklist_id } = await request.json();

    if (!picklist_id) {
      return NextResponse.json(
        { success: false, error: 'Missing picklist_id' },
        { status: 400 }
      );
    }

    // Get all items from the picklist
    const { data: items, error: itemsError } = await supabase
      .from('online_picklist_items')
      .select('id, sku_id, sku_name, quantity_to_pick')
      .eq('picklist_id', picklist_id);

    if (itemsError) {
      return NextResponse.json(
        { success: false, error: itemsError.message },
        { status: 500 }
      );
    }

    const validSkus: any[] = [];
    const invalidSkus: any[] = [];

    for (const item of items || []) {
      // Try to find SKU by sku_id first
      const { data: skuById } = await supabase
        .from('master_sku')
        .select('sku_id, sku_name, barcode')
        .eq('sku_id', item.sku_id)
        .single();

      if (skuById) {
        validSkus.push({
          item_id: item.id,
          original_sku_id: item.sku_id,
          original_sku_name: item.sku_name,
          master_sku_id: skuById.sku_id,
          master_sku_name: skuById.sku_name,
          quantity: item.quantity_to_pick,
          match_type: 'sku_id'
        });
        continue;
      }

      // Try to find SKU by barcode
      const { data: skuByBarcode } = await supabase
        .from('master_sku')
        .select('sku_id, sku_name, barcode')
        .eq('barcode', item.sku_id)
        .single();

      if (skuByBarcode) {
        validSkus.push({
          item_id: item.id,
          original_sku_id: item.sku_id,
          original_sku_name: item.sku_name,
          master_sku_id: skuByBarcode.sku_id,
          master_sku_name: skuByBarcode.sku_name,
          quantity: item.quantity_to_pick,
          match_type: 'barcode'
        });
        continue;
      }

      // SKU not found in master_sku
      invalidSkus.push({
        item_id: item.id,
        original_sku_id: item.sku_id,
        original_sku_name: item.sku_name,
        quantity: item.quantity_to_pick,
        error: 'ไม่พบ SKU ในระบบ Master SKU'
      });
    }

    const isValid = invalidSkus.length === 0;

    return NextResponse.json({
      success: true,
      is_valid: isValid,
      total_items: items?.length || 0,
      valid_count: validSkus.length,
      invalid_count: invalidSkus.length,
      valid_skus: validSkus,
      invalid_skus: invalidSkus
    });

  } catch (error: any) {
    console.error('Error validating SKUs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
