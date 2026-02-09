import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ sku_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { sku_id } = await params;

    // ดึง location_id ที่อยู่ใน Zone Selective Rack และ Zone Block Stack
    // ไม่รวมบ้านหยิบ (preparation_area)
    
    // ดึงรายการ preparation areas (บ้านหยิบ) ที่ต้อง exclude
    const { data: prepAreas } = await supabase
      .from('preparation_area')
      .select('area_code')
      .eq('status', 'active');
    const excludeLocationIds = new Set((prepAreas || []).map(p => p.area_code));
    
    const allowedLocationIds = new Set<string>();
    
    // ดึง Zone Selective Rack ทีละ 1000
    for (let page = 0; page < 3; page++) {
      const { data: locs } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('zone', 'Zone Selective Rack')
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!locs || locs.length === 0) break;
      // กรองไม่รวมบ้านหยิบ
      locs.forEach(l => {
        if (!excludeLocationIds.has(l.location_id)) {
          allowedLocationIds.add(l.location_id);
        }
      });
    }
    
    // ดึง Zone Block Stack (มี ~61 locations)
    const { data: blockStackLocs } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('zone', 'Zone Block Stack')
      .limit(1000);
    (blockStackLocs || []).forEach(l => {
      if (!excludeLocationIds.has(l.location_id)) {
        allowedLocationIds.add(l.location_id);
      }
    });
    
    // ดึง Zone Selective Rack variants (like Zone Selective Rack A09-01-001)
    const { data: selectiveRackVariantLocs } = await supabase
      .from('master_location')
      .select('location_id')
      .like('zone', 'Zone Selective Rack %')
      .limit(1000);
    (selectiveRackVariantLocs || []).forEach(l => {
      if (!excludeLocationIds.has(l.location_id)) {
        allowedLocationIds.add(l.location_id);
      }
    });

    // ดึงข้อมูล balance details ของ SKU นี้
    const { data: rawBalances, error } = await supabase
      .from('wms_inventory_balances')
      .select(`
        balance_id,
        sku_id,
        location_id,
        pallet_id,
        production_date,
        expiry_date,
        lot_no,
        total_piece_qty,
        reserved_piece_qty,
        last_movement_at,
        updated_at,
        master_location!inner(
          location_code,
          location_name
        ),
        master_sku!inner(
          sku_name
        )
      `)
      .eq('sku_id', sku_id)
      .gt('total_piece_qty', 0)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .order('production_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching balance details:', error);
      return NextResponse.json(
        { error: 'Failed to fetch balance details' },
        { status: 500 }
      );
    }

    // กรองเฉพาะ location ที่อยู่ใน Zone Selective Rack และ Zone Block Stack
    const filteredBalances = (rawBalances || []).filter((balance: any) => 
      allowedLocationIds.has(balance.location_id)
    );

    // กรองให้เหลือเฉพาะแถวล่าสุดของแต่ละพาเลท (ตาม last_movement_at หรือ updated_at)
    const latestBalancesByPallet = new Map<string, any>();
    filteredBalances.forEach((balance: any) => {
      const palletKey = balance.pallet_id || `no_pallet_${balance.balance_id}`;
      const existing = latestBalancesByPallet.get(palletKey);
      
      if (!existing) {
        latestBalancesByPallet.set(palletKey, balance);
      } else {
        // เปรียบเทียบเวลา - เลือกแถวที่ใหม่กว่า
        const existingTime = new Date(existing.last_movement_at || existing.updated_at).getTime();
        const currentTime = new Date(balance.last_movement_at || balance.updated_at).getTime();
        
        if (currentTime > existingTime) {
          latestBalancesByPallet.set(palletKey, balance);
        }
      }
    });

    const balances = Array.from(latestBalancesByPallet.values());

    // แปลงข้อมูลให้อยู่ในรูปแบบที่เหมาะสำหรับแสดงผล
    const formattedBalances = balances.map((balance: any) => ({
      id: balance.balance_id,
      sku_name: balance.master_sku?.sku_name || '-',
      location_code: balance.master_location?.location_code || '-',
      location_name: balance.master_location?.location_name || '-',
      pallet_id: balance.pallet_id || '-',
      production_date: balance.production_date,
      expiry_date: balance.expiry_date,
      lot_no: balance.lot_no,
      piece_qty: balance.total_piece_qty,
      reserved_piece_qty: balance.reserved_piece_qty,
      available_qty: balance.total_piece_qty - (balance.reserved_piece_qty || 0),
    }));

    // ดึงข้อมูลสต็อกบ้านหยิบ (preparation area inventory)
    const { data: prepAreaInventory } = await supabase
      .from('vw_preparation_area_inventory')
      .select(`
        preparation_area_code,
        preparation_area_name,
        sku_id,
        sku_name,
        total_piece_qty,
        reserved_piece_qty,
        available_piece_qty,
        total_pack_qty,
        reserved_pack_qty,
        available_pack_qty,
        latest_production_date,
        latest_expiry_date,
        latest_lot_no,
        days_until_expiry,
        is_expired,
        last_movement_at
      `)
      .eq('sku_id', sku_id)
      .gt('total_piece_qty', 0)
      .order('latest_expiry_date', { ascending: true, nullsFirst: false });

    const formattedPrepArea = (prepAreaInventory || []).map((item: any) => ({
      preparation_area_code: item.preparation_area_code,
      preparation_area_name: item.preparation_area_name,
      sku_name: item.sku_name || '-',
      total_piece_qty: Number(item.total_piece_qty || 0),
      reserved_piece_qty: Number(item.reserved_piece_qty || 0),
      available_piece_qty: Number(item.available_piece_qty || 0),
      total_pack_qty: Number(item.total_pack_qty || 0),
      reserved_pack_qty: Number(item.reserved_pack_qty || 0),
      available_pack_qty: Number(item.available_pack_qty || 0),
      latest_production_date: item.latest_production_date,
      latest_expiry_date: item.latest_expiry_date,
      latest_lot_no: item.latest_lot_no,
      days_until_expiry: item.days_until_expiry,
      is_expired: item.is_expired,
      last_movement_at: item.last_movement_at,
    }));

    return NextResponse.json({
      sku_id,
      sku_name: formattedBalances[0]?.sku_name || '',
      balances: formattedBalances,
      total_balances: formattedBalances.length,
      prep_area_inventory: formattedPrepArea,
      total_prep_area: formattedPrepArea.length,
    });
  } catch (error: any) {
    console.error('Error in forecast balance details:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
