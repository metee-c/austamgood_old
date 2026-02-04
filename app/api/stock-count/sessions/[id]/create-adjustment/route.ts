// API: สร้างใบปรับสต็อกจากผลนับบ้านหยิบ
// POST /api/stock-count/sessions/[id]/create-adjustment

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { setUserContext } from '@/lib/supabase/with-user-context';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

interface VarianceItem {
  sku_id: string;
  sku_name: string | null;
  counted_qty: number;
  system_qty: number;
  variance: number; // positive = เพิ่ม, negative = ลด
  prep_area_code: string;
}

interface InventoryRecord {
  sku_id: string;
  location_id: string;
  total_piece_qty: number;
  pallet_id: string | null;
  lot_no: string | null;
  production_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    // Check authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token');
    
    if (!sessionToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sessionData, error: sessionError } = await supabase.rpc('validate_session_token', {
      p_token: sessionToken.value
    });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = sessionData[0].user_id;
    await setUserContext(supabase);

    // 1. ดึงข้อมูล session
    const { data: countSession, error: countSessionError } = await supabase
      .from('wms_stock_count_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (countSessionError || !countSession) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบรอบนับสต็อก' 
      }, { status: 404 });
    }

    if (countSession.count_type !== 'prep_area') {
      return NextResponse.json({ 
        success: false, 
        error: 'ฟังก์ชันนี้ใช้ได้เฉพาะการนับบ้านหยิบเท่านั้น' 
      }, { status: 400 });
    }

    if (countSession.status !== 'completed') {
      return NextResponse.json({ 
        success: false, 
        error: 'รอบนับต้องเสร็จสิ้นก่อนจึงจะสร้างใบปรับสต็อกได้' 
      }, { status: 400 });
    }

    // 2. ดึงผลนับจาก wms_prep_area_count_items
    const { data: countItems, error: countItemsError } = await supabase
      .from('wms_prep_area_count_items')
      .select('sku_code, sku_name, quantity, prep_area_code')
      .eq('session_id', sessionId);

    if (countItemsError) {
      console.error('Error fetching count items:', countItemsError);
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่สามารถดึงข้อมูลผลนับได้' 
      }, { status: 500 });
    }

    if (!countItems || countItems.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่พบรายการที่นับ' 
      }, { status: 400 });
    }

    // 3. ดึง unique prep_area_codes ก่อน
    const prepAreaCodes = [...new Set(countItems.map(i => i.prep_area_code).filter(Boolean))];
    
    // ถ้าไม่มี prep_area_code ให้ใช้ default (PK001, PK002)
    const locationIds = prepAreaCodes.length > 0 ? prepAreaCodes : ['PK001', 'PK002'];

    // 4. รวมผลนับตาม SKU และ prep_area_code
    const countedBySkuAndArea = new Map<string, { 
      sku_id: string; 
      sku_name: string | null; 
      quantity: number; 
      prep_area_code: string;
    }>();

    for (const item of countItems) {
      const key = `${item.sku_code}|${item.prep_area_code || locationIds[0]}`;
      const existing = countedBySkuAndArea.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        countedBySkuAndArea.set(key, {
          sku_id: item.sku_code, // sku_code = sku_id
          sku_name: item.sku_name,
          quantity: item.quantity,
          prep_area_code: item.prep_area_code || locationIds[0]
        });
      }
    }

    // 5. ดึงสต็อกจริงจาก wms_inventory_balances
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        location_id,
        total_piece_qty,
        pallet_id,
        lot_no,
        production_date,
        expiry_date,
        created_at
      `)
      .in('location_id', locationIds)
      .gt('total_piece_qty', 0);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
      return NextResponse.json({ 
        success: false, 
        error: 'ไม่สามารถดึงข้อมูลสต็อกได้' 
      }, { status: 500 });
    }

    // 6. รวมสต็อกจริงตาม SKU (รวมทุก lot/pallet)
    // และเก็บ record ล่าสุดไว้สำหรับกรณีต้องลด
    const systemStockBySku = new Map<string, {
      total_qty: number;
      records: InventoryRecord[];
    }>();

    for (const inv of (inventoryData || [])) {
      const existing = systemStockBySku.get(inv.sku_id);
      const record: InventoryRecord = {
        sku_id: inv.sku_id,
        location_id: inv.location_id,
        total_piece_qty: Number(inv.total_piece_qty) || 0,
        pallet_id: inv.pallet_id,
        lot_no: inv.lot_no,
        production_date: inv.production_date,
        expiry_date: inv.expiry_date,
        created_at: inv.created_at
      };

      if (existing) {
        existing.total_qty += record.total_piece_qty;
        existing.records.push(record);
      } else {
        systemStockBySku.set(inv.sku_id, {
          total_qty: record.total_piece_qty,
          records: [record]
        });
      }
    }

    // Sort records by created_at DESC (ล่าสุดก่อน) สำหรับกรณีต้องลด
    systemStockBySku.forEach(value => {
      value.records.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // 7. คำนวณ variance
    const varianceItems: VarianceItem[] = [];
    const allSkuIds = new Set([
      ...countedBySkuAndArea.keys(),
      ...Array.from(systemStockBySku.keys()).map(sku => 
        prepAreaCodes.map(area => `${sku}|${area}`)
      ).flat()
    ]);

    // เปรียบเทียบผลนับกับระบบ
    for (const [key, counted] of countedBySkuAndArea) {
      const systemStock = systemStockBySku.get(counted.sku_id);
      const systemQty = systemStock?.total_qty || 0;
      const variance = counted.quantity - systemQty;

      if (variance !== 0) {
        varianceItems.push({
          sku_id: counted.sku_id,
          sku_name: counted.sku_name,
          counted_qty: counted.quantity,
          system_qty: systemQty,
          variance,
          prep_area_code: counted.prep_area_code
        });
      }
    }

    // ตรวจสอบ SKU ที่มีในระบบแต่ไม่ได้นับ (ถือว่านับได้ 0)
    for (const [skuId, systemStock] of systemStockBySku) {
      // ตรวจสอบว่า SKU นี้ถูกนับหรือยัง
      const wasCounted = Array.from(countedBySkuAndArea.values()).some(c => c.sku_id === skuId);
      if (!wasCounted && systemStock.total_qty > 0) {
        // ดึงชื่อ SKU
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('sku_name')
          .eq('sku_id', skuId)
          .single();

        // ใช้ location จาก record แรก
        const firstRecord = systemStock.records[0];

        varianceItems.push({
          sku_id: skuId,
          sku_name: skuData?.sku_name || null,
          counted_qty: 0,
          system_qty: systemStock.total_qty,
          variance: -systemStock.total_qty, // ลดทั้งหมด
          prep_area_code: firstRecord?.location_id || locationIds[0]
        });
      }
    }

    // 8. ถ้าไม่มี variance ไม่ต้องสร้าง adjustment
    if (varianceItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'ผลนับตรงกับระบบ ไม่จำเป็นต้องปรับสต็อก',
        data: {
          variance_count: 0,
          adjustment_id: null
        }
      });
    }

    // 9. แยก increase และ decrease items
    const increaseItems = varianceItems.filter(v => v.variance > 0);
    const decreaseItems = varianceItems.filter(v => v.variance < 0);

    const createdAdjustments: number[] = [];

    // 10. สร้างใบปรับสต็อก (เพิ่ม) ถ้ามี
    if (increaseItems.length > 0) {
      const adjustmentNo = await generateAdjustmentNo(supabase, 'increase');
      
      const { data: adjustment, error: adjError } = await supabase
        .from('wms_stock_adjustments')
        .insert({
          adjustment_no: adjustmentNo,
          adjustment_type: 'increase',
          status: 'draft',
          warehouse_id: countSession.warehouse_id,
          reason_id: 30, // FOUND (พบสินค้าเพิ่ม)
          adjustment_date: new Date().toISOString(),
          reference_no: countSession.session_code,
          remarks: `สร้างจากผลนับบ้านหยิบ รอบ ${countSession.session_code}`,
          created_by: userId
        })
        .select('adjustment_id')
        .single();

      if (adjError) {
        console.error('Error creating increase adjustment:', adjError);
        return NextResponse.json({ 
          success: false, 
          error: 'ไม่สามารถสร้างใบปรับสต็อก (เพิ่ม) ได้' 
        }, { status: 500 });
      }

      // สร้าง items
      const items = increaseItems.map((item, idx) => ({
        adjustment_id: adjustment.adjustment_id,
        line_no: idx + 1,
        sku_id: item.sku_id,
        location_id: item.prep_area_code,
        pallet_id: null,
        before_piece_qty: item.system_qty,
        adjustment_piece_qty: item.variance,
        after_piece_qty: item.counted_qty,
        remarks: `นับได้ ${item.counted_qty} ระบบมี ${item.system_qty}`
      }));

      const { error: itemsError } = await supabase
        .from('wms_stock_adjustment_items')
        .insert(items);

      if (itemsError) {
        console.error('Error creating increase items:', itemsError);
      }

      createdAdjustments.push(adjustment.adjustment_id);
    }

    // 11. สร้างใบปรับสต็อก (ลด) ถ้ามี
    if (decreaseItems.length > 0) {
      const adjustmentNo = await generateAdjustmentNo(supabase, 'decrease');
      
      const { data: adjustment, error: adjError } = await supabase
        .from('wms_stock_adjustments')
        .insert({
          adjustment_no: adjustmentNo,
          adjustment_type: 'decrease',
          status: 'draft',
          warehouse_id: countSession.warehouse_id,
          reason_id: 31, // COUNT_ERROR (ข้อผิดพลาดในการนับ)
          adjustment_date: new Date().toISOString(),
          reference_no: countSession.session_code,
          remarks: `สร้างจากผลนับบ้านหยิบ รอบ ${countSession.session_code}`,
          created_by: userId
        })
        .select('adjustment_id')
        .single();

      if (adjError) {
        console.error('Error creating decrease adjustment:', adjError);
        return NextResponse.json({ 
          success: false, 
          error: 'ไม่สามารถสร้างใบปรับสต็อก (ลด) ได้' 
        }, { status: 500 });
      }

      // สร้าง items - ใช้ lot ล่าสุดสำหรับการลด
      const items = decreaseItems.map((item, idx) => {
        const systemStock = systemStockBySku.get(item.sku_id);
        const latestRecord = systemStock?.records[0]; // record ล่าสุด

        return {
          adjustment_id: adjustment.adjustment_id,
          line_no: idx + 1,
          sku_id: item.sku_id,
          location_id: item.prep_area_code,
          pallet_id: latestRecord?.pallet_id || null,
          lot_no: latestRecord?.lot_no || null,
          production_date: latestRecord?.production_date || null,
          expiry_date: latestRecord?.expiry_date || null,
          before_piece_qty: item.system_qty,
          adjustment_piece_qty: item.variance, // negative
          after_piece_qty: item.counted_qty,
          remarks: `นับได้ ${item.counted_qty} ระบบมี ${item.system_qty}`
        };
      });

      const { error: itemsError } = await supabase
        .from('wms_stock_adjustment_items')
        .insert(items);

      if (itemsError) {
        console.error('Error creating decrease items:', itemsError);
      }

      createdAdjustments.push(adjustment.adjustment_id);
    }

    return NextResponse.json({
      success: true,
      message: `สร้างใบปรับสต็อกสำเร็จ ${createdAdjustments.length} ใบ`,
      data: {
        variance_count: varianceItems.length,
        increase_count: increaseItems.length,
        decrease_count: decreaseItems.length,
        adjustment_ids: createdAdjustments,
        variance_items: varianceItems
      }
    });

  } catch (error) {
    console.error('Error creating adjustment from count:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการสร้างใบปรับสต็อก' },
      { status: 500 }
    );
  }
}

// Helper: Generate adjustment number
async function generateAdjustmentNo(supabase: any, type: 'increase' | 'decrease'): Promise<string> {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `ADJ-${year}${month}-`;
  const pattern = `${prefix}%`;

  const { data } = await supabase
    .from('wms_stock_adjustments')
    .select('adjustment_no')
    .like('adjustment_no', pattern)
    .order('adjustment_no', { ascending: false })
    .limit(1);

  let running = 1;
  if (data && data.length > 0) {
    const last = data[0].adjustment_no;
    const lastDash = last.lastIndexOf('-');
    const suffix = lastDash >= 0 ? last.slice(lastDash + 1) : '';
    const parsed = parseInt(suffix, 10);
    running = Number.isNaN(parsed) ? 1 : parsed + 1;
  }

  return prefix + String(running).padStart(4, '0');
}

export const POST = withShadowLog(_POST);
