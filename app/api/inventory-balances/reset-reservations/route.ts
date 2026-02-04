import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAdminAuth } from '@/lib/api/with-auth';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * POST /api/inventory-balances/reset-reservations
 * ล้างยอดจองทั้งหมดในระบบ (ใช้เมื่อมีการจองค้างที่ไม่ถูกต้อง)
 *
 * WARNING: ควรใช้เฉพาะตอนแก้ไขข้อมูลที่ผิดพลาดเท่านั้น
 * SECURITY: Admin only - requires authentication
 */
async function handlePost(request: NextRequest, context: any) {
try {
    const supabase = await createClient();

    console.log('🔄 Starting reservation reset...');

    // ดึงข้อมูล balances ที่มีการจอง
    const { data: balances, error: fetchError } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, warehouse_id, location_id, sku_id, reserved_pack_qty, reserved_piece_qty')
      .or('reserved_pack_qty.gt.0,reserved_piece_qty.gt.0');

    if (fetchError) {
      console.error('Error fetching balances:', fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!balances || balances.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reservations found to reset',
        resetCount: 0
      });
    }

    console.log(`Found ${balances.length} balance(s) with reservations`);

    // รีเซ็ตยอดจองทั้งหมด
    let resetCount = 0;
    for (const balance of balances) {
      const { error: updateError } = await supabase
        .from('wms_inventory_balances')
        .update({
          reserved_pack_qty: 0,
          reserved_piece_qty: 0,
          updated_at: new Date().toISOString()
        })
        .eq('balance_id', balance.balance_id);

      if (updateError) {
        console.error(`Error resetting balance ${balance.balance_id}:`, updateError);
      } else {
        console.log(`✅ Reset reservations for balance ${balance.balance_id} (SKU: ${balance.sku_id}, Location: ${balance.location_id})`);
        resetCount++;
      }
    }

    console.log(`✅ Reservation reset completed: ${resetCount}/${balances.length} balances updated`);

    return NextResponse.json({
      success: true,
      message: `Successfully reset reservations for ${resetCount} balance(s)`,
      resetCount,
      totalFound: balances.length
    });

  } catch (error) {
    console.error('API Error in POST /api/inventory-balances/reset-reservations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Export with admin auth wrapper
export const POST = withShadowLog(withAdminAuth(handlePost));
