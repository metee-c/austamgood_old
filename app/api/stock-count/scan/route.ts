import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/stock-count/scan
 * สแกนโลเคชั่นหรือพาเลท (Realtime mode)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { session_id, scan_type, scanned_code, counted_by } = body;

    // scan_type: 'location' หรือ 'pallet' หรือ 'extra_pallet'
    
    if (scan_type === 'location') {
      // สแกนโลเคชั่น - ดึงข้อมูลสินค้าจาก inventory balance แบบ realtime
      
      // ตรวจสอบว่าโลเคชั่นนี้มีในระบบหรือไม่
      const { data: location } = await supabase
        .from('master_location')
        .select('location_id, location_code')
        .eq('location_code', scanned_code)
        .single();

      if (!location) {
        return NextResponse.json({
          success: false,
          error: 'ไม่พบโลเคชั่นในระบบ'
        }, { status: 400 });
      }

      // ดึงข้อมูลสินค้าจาก inventory balance แบบ realtime
      const { data: inventory, error: invError } = await supabase
        .from('wms_inventory_balances')
        .select(`
          pallet_id,
          sku_id,
          total_pack_qty,
          master_sku!inner(sku_id, sku_name)
        `)
        .eq('location_id', scanned_code)
        .gt('total_pack_qty', 0);

      if (invError) throw invError;

      if (inventory && inventory.length > 0) {
        // มีสินค้าในโลเคชั่น - สร้าง expected items แบบ realtime
        const expectedItems = inventory.map((inv, index) => {
          const sku = inv.master_sku as unknown as { sku_id: string; sku_name: string };
          return {
            id: index + 1,
            location_code: scanned_code,
            expected_pallet_id: inv.pallet_id,
            expected_sku_code: sku?.sku_id,
            expected_sku_name: sku?.sku_name,
            expected_quantity: inv.total_pack_qty,
            scanned_pallet_id: null,
            status: 'pending'
          };
        });

        return NextResponse.json({
          success: true,
          location_code: scanned_code,
          has_expected_items: true,
          expected_items: expectedItems,
          message: `พบสินค้า ${expectedItems.length} รายการในโลเคชั่นนี้`
        });
      } else {
        // ไม่มีสินค้าในระบบ (โลเคชั่นว่าง)
        return NextResponse.json({
          success: true,
          location_code: scanned_code,
          has_expected_items: false,
          expected_items: [],
          message: 'โลเคชั่นว่าง (ไม่มีสินค้าในระบบ)'
        });
      }
    }

    if (scan_type === 'pallet') {
      // สแกนพาเลท - ตรวจสอบว่าตรงกับที่คาดหวังหรือไม่ (realtime mode)
      const { expected_item, location_code, allow_mismatch } = body;
      
      if (!location_code) {
        return NextResponse.json({
          success: false,
          error: 'กรุณาระบุ location_code'
        }, { status: 400 });
      }

      let status: string;
      let resultItem: Record<string, unknown>;

      if (scanned_code === 'INVALID_PALLET') {
        // ของจริงไม่มี แต่ในระบบมี
        status = 'empty';
        resultItem = {
          ...expected_item,
          scanned_pallet_id: 'INVALID_PALLET',
          status: 'empty',
          notes: 'ของจริงไม่มี'
        };

        // บันทึกลง wms_stock_count_items
        await supabase
          .from('wms_stock_count_items')
          .insert({
            session_id,
            location_code,
            expected_pallet_id: expected_item?.expected_pallet_id || null,
            expected_sku_code: expected_item?.expected_sku_code || null,
            expected_sku_name: expected_item?.expected_sku_name || null,
            expected_quantity: expected_item?.expected_quantity || null,
            scanned_pallet_id: 'INVALID_PALLET',
            status: 'empty',
            counted_at: new Date().toISOString(),
            counted_by,
            notes: 'ของจริงไม่มี'
          });

        // อัปเดต session counts
        await updateSessionCounts(supabase, session_id);

      } else if (expected_item && scanned_code === expected_item.expected_pallet_id) {
        // สแกนถูกต้อง
        status = 'matched';
        resultItem = {
          ...expected_item,
          scanned_pallet_id: scanned_code,
          actual_sku_code: expected_item.expected_sku_code,
          actual_sku_name: expected_item.expected_sku_name,
          actual_quantity: expected_item.expected_quantity,
          status: 'matched'
        };

        // บันทึกลง wms_stock_count_items
        await supabase
          .from('wms_stock_count_items')
          .insert({
            session_id,
            location_code,
            expected_pallet_id: expected_item.expected_pallet_id,
            expected_sku_code: expected_item.expected_sku_code,
            expected_sku_name: expected_item.expected_sku_name,
            expected_quantity: expected_item.expected_quantity,
            scanned_pallet_id: scanned_code,
            actual_sku_code: expected_item.expected_sku_code,
            actual_sku_name: expected_item.expected_sku_name,
            actual_quantity: expected_item.expected_quantity,
            status: 'matched',
            counted_at: new Date().toISOString(),
            counted_by
          });

        // อัปเดต session counts
        await updateSessionCounts(supabase, session_id);

      } else {
        // สแกนไม่ตรง หรือไม่มี expected_item (โลเคชั่นว่าง)
        status = expected_item ? 'mismatched' : 'extra';
        
        // ตรวจสอบว่าพาเลทที่สแกนมีในระบบหรือไม่
        const { data: palletInfo } = await supabase
          .from('wms_inventory_balances')
          .select('sku_id, total_pack_qty, master_sku(sku_code, sku_name)')
          .eq('pallet_id', scanned_code)
          .maybeSingle();

        const sku = palletInfo?.master_sku as unknown as { sku_code: string; sku_name: string } | null;

        resultItem = {
          ...expected_item,
          scanned_pallet_id: scanned_code,
          actual_sku_code: sku?.sku_code || null,
          actual_sku_name: sku?.sku_name || null,
          actual_quantity: palletInfo?.total_pack_qty || null,
          status,
          notes: expected_item 
            ? (palletInfo ? 'พาเลทไม่ตรงกับที่คาดหวัง' : 'พาเลทไม่มีในระบบ')
            : (palletInfo ? 'พาเลทเพิ่มเติม' : 'พาเลทไม่มีในระบบ')
        };

        // บันทึกลง wms_stock_count_items - รองรับทั้งกรณีมี expected และไม่มี
        await supabase
          .from('wms_stock_count_items')
          .insert({
            session_id,
            location_code,
            expected_pallet_id: expected_item?.expected_pallet_id || null,
            expected_sku_code: expected_item?.expected_sku_code || null,
            expected_sku_name: expected_item?.expected_sku_name || null,
            expected_quantity: expected_item?.expected_quantity || null,
            scanned_pallet_id: scanned_code,
            actual_sku_code: sku?.sku_code || null,
            actual_sku_name: sku?.sku_name || null,
            actual_quantity: palletInfo?.total_pack_qty || null,
            status,
            counted_at: new Date().toISOString(),
            counted_by,
            notes: expected_item 
              ? (palletInfo ? 'พาเลทไม่ตรงกับที่คาดหวัง' : 'พาเลทไม่มีในระบบ')
              : (palletInfo ? 'พาเลทเพิ่มเติม' : 'พาเลทไม่มีในระบบ')
          });

        // อัปเดต session counts
        await updateSessionCounts(supabase, session_id);
      }

      return NextResponse.json({
        success: true,
        status,
        item: resultItem,
        message: status === 'matched' ? 'สแกนถูกต้อง' : 
                 status === 'empty' ? 'บันทึกว่าของจริงไม่มี' : 
                 status === 'extra' ? 'บันทึกพาเลทเพิ่มเติม' :
                 'พาเลทไม่ตรงกับที่คาดหวัง - บันทึกแล้ว'
      });
    }

    // สแกนพาเลทที่ไม่มีในระบบ (extra)
    if (scan_type === 'extra_pallet') {
      const { location_code } = body;
      
      // ตรวจสอบว่าพาเลทนี้มีในระบบหรือไม่
      const { data: palletInfo } = await supabase
        .from('wms_inventory_balances')
        .select('sku_id, total_pack_qty, location_id, master_sku(sku_code, sku_name), master_location(location_code)')
        .eq('pallet_id', scanned_code)
        .maybeSingle();

      const sku = palletInfo?.master_sku as unknown as { sku_code: string; sku_name: string } | null;
      const loc = palletInfo?.master_location as unknown as { location_code: string } | null;

      // สร้าง item ใหม่สำหรับ extra
      const { data: newItem, error: insertError } = await supabase
        .from('wms_stock_count_items')
        .insert({
          session_id,
          location_code,
          scanned_pallet_id: scanned_code,
          actual_sku_code: sku?.sku_code || null,
          actual_sku_name: sku?.sku_name || null,
          actual_quantity: palletInfo?.total_pack_qty || null,
          status: 'extra',
          counted_at: new Date().toISOString(),
          counted_by,
          notes: palletInfo 
            ? `พาเลทอยู่ในระบบที่โลเคชั่น ${loc?.location_code}` 
            : 'พาเลทไม่มีในระบบ'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // อัปเดต session counts
      await updateSessionCounts(supabase, session_id);

      return NextResponse.json({
        success: true,
        status: 'extra',
        item: newItem,
        message: 'บันทึกพาเลทเพิ่มเติม'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid scan_type'
    }, { status: 400 });

  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { error: 'Failed to process scan' },
      { status: 500 }
    );
  }
}

// Helper function to update session counts
async function updateSessionCounts(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, sessionId: number) {
  // นับจำนวนแต่ละ status
  const { data: items } = await supabase
    .from('wms_stock_count_items')
    .select('status, location_code')
    .eq('session_id', sessionId);

  if (!items) return;

  const matched = items.filter(i => i.status === 'matched').length;
  const mismatched = items.filter(i => i.status === 'mismatched').length;
  const empty = items.filter(i => i.status === 'empty').length;
  const extra = items.filter(i => i.status === 'extra').length;
  const uniqueLocations = new Set(items.map(i => i.location_code)).size;

  await supabase
    .from('wms_stock_count_sessions')
    .update({
      matched_count: matched,
      mismatched_count: mismatched,
      empty_count: empty,
      extra_count: extra,
      total_locations: uniqueLocations
    })
    .eq('id', sessionId);
}
