import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/check-loadlist-stock?code=LD-20260219-0015
 * 
 * ตรวจสอบสต็อกปัจจุบันของ loadlist และแสดงว่า SKU ไหนยังขาด
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loadlistCode = searchParams.get('code') || 'LD-20260219-0015';

    // ดึงข้อมูล loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('loadlists')
      .select(`
        id,
        loadlist_code,
        status,
        loadlist_face_sheets (
          face_sheet_id,
          face_sheet:face_sheets (
            face_sheet_no,
            face_sheet_items (
              sku_id,
              quantity_picked,
              quantity_to_pick
            )
          )
        )
      `)
      .eq('loadlist_code', loadlistCode)
      .single();

    if (loadlistError || !loadlist) {
      return NextResponse.json({ error: 'Loadlist not found', details: loadlistError?.message }, { status: 404 });
    }

    // หา E-Commerce location
    const { data: ecomLocation } = await supabase
      .from('master_location')
      .select('location_id, location_code')
      .eq('location_code', 'E-Commerce')
      .single();

    // รวม items ทั้งหมดจาก face sheets
    const allItems: any[] = [];
    for (const fs of loadlist.loadlist_face_sheets || []) {
      const faceSheet = fs.face_sheet as any;
      for (const item of faceSheet?.face_sheet_items || []) {
        const qty = Number(item.quantity_picked) || Number(item.quantity_to_pick) || 0;
        if (qty > 0) {
          allItems.push({
            sku_id: item.sku_id,
            qty: qty,
            face_sheet_no: faceSheet?.face_sheet_no
          });
        }
      }
    }

    // รวมจำนวนตาม SKU
    const skuQtyMap = new Map<string, number>();
    for (const item of allItems) {
      const current = skuQtyMap.get(item.sku_id) || 0;
      skuQtyMap.set(item.sku_id, current + item.qty);
    }

    // ตรวจสอบสต็อกแต่ละ SKU
    const stockResults: any[] = [];
    for (const [skuId, neededQty] of skuQtyMap) {
      // ค้นหาสต็อกจากทุกตำแหน่ง
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('location_id, location:master_location!inner(location_code), total_piece_qty, pallet_id')
        .eq('warehouse_id', 'WH001')
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0);

      const totalAvailable = (balances || []).reduce((sum, b) => sum + Number(b.total_piece_qty), 0);
      
      stockResults.push({
        sku_id: skuId,
        needed: neededQty,
        available: totalAvailable,
        is_sufficient: totalAvailable >= neededQty,
        shortage: Math.max(0, neededQty - totalAvailable),
        locations: (balances || []).map((b: any) => ({
          location: b.location?.location_code,
          qty: b.total_piece_qty,
          pallet: b.pallet_id
        }))
      });
    }

    const insufficient = stockResults.filter(s => !s.is_sufficient);
    const sufficient = stockResults.filter(s => s.is_sufficient);

    return NextResponse.json({
      loadlist_code: loadlistCode,
      total_skus: skuQtyMap.size,
      sufficient_count: sufficient.length,
      insufficient_count: insufficient.length,
      insufficient_skus: insufficient,
      sufficient_skus: sufficient,
      ecom_location_id: ecomLocation?.location_id
    });

  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/debug/check-loadlist-stock?code=LD-20260219-0015
 * 
 * เติมสต็อกที่ขาดให้ครบ (dummy stock)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loadlistCode = searchParams.get('code') || 'LD-20260219-0015';

    // หา E-Commerce location
    const { data: ecomLocation } = await supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'E-Commerce')
      .single();

    if (!ecomLocation) {
      return NextResponse.json({ error: 'E-Commerce location not found' }, { status: 500 });
    }

    // ดึงข้อมูล loadlist เพื่อหา SKU ที่ต้องการ
    const { data: checkData } = await fetch(
      `http://localhost:3000/api/debug/check-loadlist-stock?code=${loadlistCode}`,
      { method: 'GET' }
    ).then(r => r.json());

    const insufficientSkus = checkData.insufficient_skus || [];
    
    if (insufficientSkus.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All SKUs have sufficient stock',
        added: []
      });
    }

    const results = [];
    const errors = [];

    for (const sku of insufficientSkus) {
      const shortage = sku.shortage;
      
      // ตรวจสอบว่ามีสต็อกอยู่แล้วหรือไม่
      const { data: existing } = await supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty')
        .eq('warehouse_id', 'WH001')
        .eq('location_id', ecomLocation.location_id)
        .eq('sku_id', sku.sku_id)
        .limit(1);

      if (existing && existing.length > 0) {
        // เพิ่มสต็อกที่มีอยู่
        const { data, error } = await supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: existing[0].total_piece_qty + shortage,
            total_pack_qty: existing[0].total_piece_qty + shortage,
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', existing[0].balance_id)
          .select();

        if (error) {
          errors.push({ sku_id: sku.sku_id, error: error.message });
        } else {
          results.push({ sku_id: sku.sku_id, action: 'updated', added: shortage });
        }
      } else {
        // สร้างสต็อกใหม่
        const { data, error } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: 'WH001',
            location_id: ecomLocation.location_id,
            sku_id: sku.sku_id,
            pallet_id: `DUMMY-${sku.sku_id}`,
            total_piece_qty: shortage,
            total_pack_qty: shortage,
            reserved_piece_qty: 0,
            reserved_pack_qty: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();

        if (error) {
          errors.push({ sku_id: sku.sku_id, error: error.message });
        } else {
          results.push({ sku_id: sku.sku_id, action: 'inserted', added: shortage });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added stock for ${results.length} SKUs`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err: any) {
    console.error('Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
