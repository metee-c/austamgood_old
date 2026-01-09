// API: เปรียบเทียบผลนับบ้านหยิบกับสต็อกจริง
// GET /api/stock-count/sessions/[id]/compare

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface ComparisonItem {
  sku_id: string;
  sku_name: string | null;
  counted_qty: number;
  system_qty: number;
  variance: number;
  variance_percent: number;
  status: 'matched' | 'over' | 'short' | 'missing' | 'extra';
  prep_area_code: string;
}

export async function GET(
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

    // 3. รวมผลนับตาม SKU
    const countedBySku = new Map<string, { 
      sku_id: string; 
      sku_name: string | null; 
      quantity: number; 
      prep_area_code: string;
    }>();

    for (const item of (countItems || [])) {
      const existing = countedBySku.get(item.sku_code);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        countedBySku.set(item.sku_code, {
          sku_id: item.sku_code,
          sku_name: item.sku_name,
          quantity: item.quantity,
          prep_area_code: item.prep_area_code || 'UNKNOWN'
        });
      }
    }

    // 4. ดึง unique prep_area_codes
    const prepAreaCodes = [...new Set((countItems || []).map(i => i.prep_area_code).filter(Boolean))];

    // ถ้าไม่มี prep_area_code ให้ใช้ default (PK001, PK002)
    const locationIds = prepAreaCodes.length > 0 ? prepAreaCodes : ['PK001', 'PK002'];

    // 5. ดึงสต็อกจริงจาก wms_inventory_balances
    let inventoryData: any[] = [];
    const { data, error: inventoryError } = await supabase
      .from('wms_inventory_balances')
      .select(`
        sku_id,
        location_id,
        total_piece_qty
      `)
      .in('location_id', locationIds)
      .gt('total_piece_qty', 0);

    if (inventoryError) {
      console.error('Error fetching inventory:', inventoryError);
    } else {
      inventoryData = data || [];
    }

    // 6. รวมสต็อกจริงตาม SKU
    const systemStockBySku = new Map<string, number>();
    for (const inv of inventoryData) {
      const existing = systemStockBySku.get(inv.sku_id) || 0;
      systemStockBySku.set(inv.sku_id, existing + Number(inv.total_piece_qty));
    }

    // 7. สร้างรายการเปรียบเทียบ
    const comparisonItems: ComparisonItem[] = [];
    const processedSkus = new Set<string>();

    // เปรียบเทียบ SKU ที่นับ
    for (const [skuId, counted] of countedBySku) {
      const systemQty = systemStockBySku.get(skuId) || 0;
      const variance = counted.quantity - systemQty;
      const variancePercent = systemQty > 0 ? (variance / systemQty) * 100 : (counted.quantity > 0 ? 100 : 0);

      let status: ComparisonItem['status'] = 'matched';
      if (variance > 0) status = systemQty === 0 ? 'extra' : 'over';
      else if (variance < 0) status = 'short';

      comparisonItems.push({
        sku_id: skuId,
        sku_name: counted.sku_name,
        counted_qty: counted.quantity,
        system_qty: systemQty,
        variance,
        variance_percent: Math.round(variancePercent * 100) / 100,
        status,
        prep_area_code: counted.prep_area_code
      });

      processedSkus.add(skuId);
    }

    // เพิ่ม SKU ที่มีในระบบแต่ไม่ได้นับ
    for (const [skuId, systemQty] of systemStockBySku) {
      if (!processedSkus.has(skuId)) {
        // ดึงชื่อ SKU
        const { data: skuData } = await supabase
          .from('master_sku')
          .select('sku_name')
          .eq('sku_id', skuId)
          .single();

        comparisonItems.push({
          sku_id: skuId,
          sku_name: skuData?.sku_name || null,
          counted_qty: 0,
          system_qty: systemQty,
          variance: -systemQty,
          variance_percent: -100,
          status: 'missing',
          prep_area_code: prepAreaCodes[0] || 'UNKNOWN'
        });
      }
    }

    // 8. สรุปผล
    const summary = {
      total_items: comparisonItems.length,
      matched_count: comparisonItems.filter(i => i.status === 'matched').length,
      over_count: comparisonItems.filter(i => i.status === 'over').length,
      short_count: comparisonItems.filter(i => i.status === 'short').length,
      missing_count: comparisonItems.filter(i => i.status === 'missing').length,
      extra_count: comparisonItems.filter(i => i.status === 'extra').length,
      total_counted_qty: comparisonItems.reduce((sum, i) => sum + i.counted_qty, 0),
      total_system_qty: comparisonItems.reduce((sum, i) => sum + i.system_qty, 0),
      total_variance: comparisonItems.reduce((sum, i) => sum + i.variance, 0),
      needs_adjustment: comparisonItems.some(i => i.variance !== 0)
    };

    // Sort by status priority: missing, short, over, extra, matched
    const statusOrder = { missing: 0, short: 1, over: 2, extra: 3, matched: 4 };
    comparisonItems.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: countSession.id,
          session_code: countSession.session_code,
          status: countSession.status,
          warehouse_id: countSession.warehouse_id,
          prep_area_codes: prepAreaCodes
        },
        summary,
        items: comparisonItems
      }
    });

  } catch (error) {
    console.error('Error comparing count:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการเปรียบเทียบผลนับ' },
      { status: 500 }
    );
  }
}
