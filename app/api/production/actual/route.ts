/**
 * Production Actual (Receipts) API Route
 * API สำหรับบันทึกการผลิตจริง (production_receipts)
 * รวมถึงการสร้าง Stock Adjustment อัตโนมัติเมื่อมี variance
 * และการสร้าง Replenishment Task สำหรับ packaging ที่ใช้มากกว่าเบิก
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stockAdjustmentService } from '@/lib/database/stock-adjustment';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
// Constants
// ADJ_LOSS_LOCATION ไม่ใช้แล้ว - ใช้ location จาก replenishment_queue แทน
const PRODUCTION_VARIANCE_REASON_ID = 40; // reason_code = 'PRODUCTION_VARIANCE'
const DEFAULT_WAREHOUSE_ID = 'WH001';
const REPACK_LOCATION = 'Repack';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว
    
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    let query = supabase
      .from('production_receipts')
      .select(`
        *,
        production_order:production_orders!production_receipts_production_order_id_fkey(
          production_no,
          quantity,
          produced_qty,
          status,
          sku_id,
          start_date,
          production_date,
          expiry_date,
          sku:master_sku!production_orders_sku_id_fkey(sku_id, sku_name)
        ),
        product_sku:master_sku!production_receipts_product_sku_id_fkey(sku_id, sku_name),
        producer:master_employee!production_receipts_produced_by_fkey(employee_id, first_name, last_name, nickname),
        materials:production_receipt_materials(
          material_sku_id,
          issued_qty,
          actual_qty,
          variance_qty,
          variance_type,
          uom,
          material_production_date,
          material_expiry_date,
          pallet_id,
          material_sku:master_sku!production_receipt_materials_material_sku_id_fkey(
            sku_id,
            sku_name,
            category,
            sub_category
          )
        )
      `, { count: 'exact' })
      .order('received_at', { ascending: false });

    // Apply search filter
    if (search) {
      query = query.or(`lot_no.ilike.%${search}%,batch_no.ilike.%${search}%,product_sku_id.ilike.%${search}%`);
    }

    // Apply date filters
    if (dateFrom) {
      query = query.gte('received_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('received_at', dateTo + 'T23:59:59');
    }

    // Pagination
    query = query;

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching production receipts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch production receipts' },
        { status: 500 }
      );
    }

    // ดึง BOM waste data สำหรับ SKU ที่เกี่ยวข้อง
    const skuIds = [...new Set((data || []).map((r: any) => r.product_sku_id))];
    let bomWasteMap: Record<string, number> = {};
    
    if (skuIds.length > 0) {
      const { data: bomData } = await supabase
        .from('bom_sku')
        .select('finished_sku_id, material_sku_id, waste_qty')
        .in('finished_sku_id', skuIds)
        .eq('status', 'active');
      
      // สร้าง map ของ waste_qty รวมต่อ finished_sku_id
      if (bomData) {
        bomData.forEach((bom: any) => {
          const wasteQty = parseFloat(bom.waste_qty) || 0;
          if (!bomWasteMap[bom.finished_sku_id]) {
            bomWasteMap[bom.finished_sku_id] = 0;
          }
          bomWasteMap[bom.finished_sku_id] += wasteQty;
        });
      }
    }

    // ดึง production_no ทั้งหมดเพื่อ query replenishment_queue
    const productionNos = [...new Set((data || []).map((r: any) => r.production_order?.production_no).filter(Boolean))];
    
    // ดึง production_order_id ทั้งหมดเพื่อ query wms_receive_items (FG ที่รับเข้าจากการผลิต)
    const productionOrderIds = [...new Set((data || []).map((r: any) => r.production_order_id).filter(Boolean))];
    
    // ดึงข้อมูล FG ที่รับเข้าจาก wms_receive_items (รวม piece_quantity ตาม production_order_id)
    let fgReceivedMap: Record<string, number> = {};
    
    if (productionOrderIds.length > 0) {
      const { data: receiveItemsData } = await supabase
        .from('wms_receive_items')
        .select('production_order_id, piece_quantity')
        .in('production_order_id', productionOrderIds);
      
      if (receiveItemsData && receiveItemsData.length > 0) {
        // รวม piece_quantity ตาม production_order_id
        receiveItemsData.forEach((item: any) => {
          const orderId = item.production_order_id;
          const qty = parseFloat(item.piece_quantity) || 0;
          if (!fgReceivedMap[orderId]) {
            fgReceivedMap[orderId] = 0;
          }
          fgReceivedMap[orderId] += qty;
        });
      }
    }
    
    // ดึงข้อมูล replenishment_queue สำหรับวัตถุดิบอาหาร (รายพาเลท)
    let replenishmentMap: Record<string, Array<{
      sku_id: string;
      pallet_id: string | null;
      expiry_date: string | null;
      production_date: string | null;
      confirmed_qty: number;
      from_location_id: string | null;
    }>> = {};
    
    if (productionNos.length > 0) {
      const { data: replData } = await supabase
        .from('replenishment_queue')
        .select('trigger_reference, sku_id, pallet_id, expiry_date, confirmed_qty, from_location_id')
        .in('trigger_reference', productionNos)
        .eq('trigger_source', 'production_order')
        .eq('status', 'completed');
      
      if (replData && replData.length > 0) {
        // ดึง pallet_ids เพื่อ query production_date จาก inventory_balances
        const palletIds = [...new Set(replData.map(r => r.pallet_id).filter(Boolean))];
        let palletDateMap: Record<string, string | null> = {};
        
        if (palletIds.length > 0) {
          const { data: balanceData } = await supabase
            .from('wms_inventory_balances')
            .select('pallet_id, production_date')
            .in('pallet_id', palletIds);
          
          if (balanceData) {
            balanceData.forEach((b: any) => {
              if (b.pallet_id && b.production_date) {
                palletDateMap[b.pallet_id] = b.production_date;
              }
            });
          }
        }
        
        // สร้าง map ของ replenishment data ตาม production_no
        replData.forEach((r: any) => {
          const key = r.trigger_reference;
          if (!replenishmentMap[key]) {
            replenishmentMap[key] = [];
          }
          replenishmentMap[key].push({
            sku_id: r.sku_id,
            pallet_id: r.pallet_id,
            expiry_date: r.expiry_date,
            production_date: r.pallet_id ? palletDateMap[r.pallet_id] || null : null,
            confirmed_qty: r.confirmed_qty || 0,
            from_location_id: r.from_location_id
          });
        });
      }
    }

    // คำนวณข้อมูลเพิ่มเติมสำหรับแต่ละ receipt
    const enrichedData = (data || []).map((receipt: any) => {
      const materials = receipt.materials || [];
      const productionNo = receipt.production_order?.production_no;
      const productionOrderId = receipt.production_order_id;
      const replenishmentItems = productionNo ? replenishmentMap[productionNo] || [] : [];
      
      // ดึงจำนวน FG ที่รับเข้าจาก wms_receive_items
      const fgReceivedQty = productionOrderId ? fgReceivedMap[productionOrderId] || 0 : 0;
      
      // แยกวัตถุดิบอาหาร vs packaging
      // วัตถุดิบอาหาร: SKU ขึ้นต้นด้วย 00- หรือ category = 'วัตถุดิบ'
      // Packaging: SKU ขึ้นต้นด้วย 01- หรือ 02- หรือ OTHERS หรือ category = 'ถุงบรรจุภัณฑ์' หรือ 'สติ๊กเกอร์ติดบรรจุภัณฑ์'
      const foodMaterials = materials.filter((m: any) => 
        m.material_sku_id?.startsWith('00-') || 
        m.material_sku?.category === 'วัตถุดิบ'
      );
      const packagingMaterials = materials.filter((m: any) => 
        m.material_sku_id?.startsWith('01-') || 
        m.material_sku_id?.startsWith('02-') ||
        m.material_sku_id?.startsWith('OTHERS') ||
        m.material_sku?.category === 'ถุงบรรจุภัณฑ์' ||
        m.material_sku?.category === 'สติ๊กเกอร์ติดบรรจุภัณฑ์'
      );

      // คำนวณอาหารที่ใช้จริง (กก.)
      // สมมติว่าวัตถุดิบอาหาร 1 ถุง = 20 กก. (ตาม BOM ratio)
      const foodActualQty = foodMaterials.reduce((sum: number, m: any) => 
        sum + (Math.round(parseFloat(m.actual_qty)) || 0), 0
      );
      const foodActualKg = foodActualQty * 20; // 20 กก./ถุง

      // คำนวณถุง/สติ๊กเกอร์ที่ใช้จริง
      const packagingActualQty = packagingMaterials.reduce((sum: number, m: any) => 
        sum + (Math.round(parseFloat(m.actual_qty)) || 0), 0
      );

      // FG ที่ผลิตได้จริง
      const fgActualQty = parseFloat(receipt.received_qty) || 0;

      // น้ำหนักเฉลี่ย/ถุง (กก./ถุง)
      const avgWeightPerBag = fgActualQty > 0 ? foodActualKg / fgActualQty : 0;

      // Waste ต่อชิ้น (จาก BOM)
      const wastePerPiece = bomWasteMap[receipt.product_sku_id] || 0;

      // Waste รวม
      const totalWaste = wastePerPiece * fgActualQty;
      
      // สร้างรายละเอียดวัตถุดิบอาหารพร้อมข้อมูลรายพาเลท
      const foodMaterialsWithPallets = foodMaterials.map((m: any) => {
        // หา replenishment items ที่ตรงกับ SKU นี้
        const rawPalletItems = replenishmentItems.filter(r => r.sku_id === m.material_sku_id);
        
        // รวมพาเลทที่ซ้ำกัน (aggregate by pallet_id)
        const palletMap = new Map<string, {
          pallet_id: string | null;
          production_date: string | null;
          expiry_date: string | null;
          qty: number;
          from_location_id: string | null;
        }>();
        
        rawPalletItems.forEach(r => {
          const key = r.pallet_id || 'no-pallet';
          if (palletMap.has(key)) {
            // รวม qty สำหรับพาเลทที่ซ้ำกัน
            const existing = palletMap.get(key)!;
            existing.qty += r.confirmed_qty;
          } else {
            palletMap.set(key, {
              pallet_id: r.pallet_id,
              production_date: r.production_date,
              expiry_date: r.expiry_date,
              qty: r.confirmed_qty,
              from_location_id: r.from_location_id
            });
          }
        });
        
        const palletDetails = Array.from(palletMap.values());
        
        return {
          sku_id: m.material_sku_id,
          sku_name: m.material_sku?.sku_name,
          issued_qty: parseFloat(m.issued_qty) || 0,
          actual_qty: Math.round(parseFloat(m.actual_qty)) || 0,
          variance_qty: parseFloat(m.variance_qty) || 0,
          variance_type: m.variance_type,
          uom: m.uom,
          // ข้อมูลวันผลิต/วันหมดอายุของวัตถุดิบ (จาก production_receipt_materials)
          material_production_date: m.material_production_date || null,
          material_expiry_date: m.material_expiry_date || null,
          pallet_id: m.pallet_id || null,
          // ข้อมูลรายพาเลท (รวมพาเลทที่ซ้ำกันแล้ว)
          pallet_details: palletDetails.length > 0 ? palletDetails : null
        };
      });

      return {
        ...receipt,
        // ข้อมูลเพิ่มเติมที่คำนวณ
        calculated: {
          fg_planned_qty: receipt.production_order?.quantity || 0,
          fg_actual_qty: fgActualQty,
          fg_received_qty: fgReceivedQty, // จำนวน FG ที่รับเข้าจาก wms_receive_items
          fg_variance: fgActualQty - fgReceivedQty, // ส่วนต่าง: บันทึกจริง - รับเข้า
          food_actual_qty: foodActualQty, // จำนวนถุงวัตถุดิบอาหาร
          food_actual_kg: foodActualKg, // น้ำหนักอาหารที่ใช้จริง (กก.)
          packaging_actual_qty: packagingActualQty, // จำนวนถุง/สติ๊กเกอร์ที่ใช้จริง
          avg_weight_per_bag: avgWeightPerBag, // น้ำหนักเฉลี่ย/ถุง (กก.)
          waste_per_piece: wastePerPiece, // เวสต่อชิ้น
          total_waste: totalWaste, // เวสรวม
          // รายละเอียดวัตถุดิบ (พร้อมข้อมูลรายพาเลทสำหรับอาหาร)
          food_materials: foodMaterialsWithPallets,
          packaging_materials: packagingMaterials.map((m: any) => ({
            sku_id: m.material_sku_id,
            sku_name: m.material_sku?.sku_name,
            issued_qty: parseFloat(m.issued_qty) || 0,
            actual_qty: Math.round(parseFloat(m.actual_qty)) || 0,
            variance_qty: parseFloat(m.variance_qty) || 0,
            variance_type: m.variance_type,
            uom: m.uom
          }))
        }
      };
    });

    // Pagination removed for performance - return all data
    return NextResponse.json({
      data: enrichedData
    });
  } catch (error: any) {
    console.error('Error in GET /api/production/actual:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Interface for BOM material with actual usage
interface BomMaterialInput {
  material_sku_id: string;
  issued_qty: number;
  actual_qty: number;
  uom?: string;
  variance_reason?: string;
  remarks?: string;
  is_food?: boolean; // true = วัตถุดิบอาหาร, false = packaging
  production_order_item_id?: string; // ID ของ production_order_items (สำหรับ packaging)
}

async function _POST(request: NextRequest) {
try {
    const sessionResult = await getCurrentSession();
    if (!sessionResult.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    
    // Debug: Log session data
    console.log('=== Session Data ===', {
      user_id: sessionResult.session.user_id,
      employee_id: sessionResult.session.employee_id,
      username: sessionResult.session.username
    });
    
    // ใช้ user_id สำหรับ stock adjustment (ไม่ใช่ employee_id)
    // user_id คือ ID ใน master_system_user, employee_id คือ ID ใน master_employee
    const systemUserId = sessionResult.session.user_id;
    const employeeId = sessionResult.session.employee_id;
    
    // Validate systemUserId
    if (!systemUserId || typeof systemUserId !== 'number') {
      console.error('Invalid systemUserId from session:', systemUserId);
      return NextResponse.json(
        { error: 'Invalid user session - missing user_id' },
        { status: 401 }
      );
    }

    const {
      production_order_id,
      product_sku_id,
      received_qty,
      lot_no,
      batch_no,
      remarks,
      bom_materials // Array of BomMaterialInput for variance tracking
    } = body;

    // Validate required fields
    if (!production_order_id || !product_sku_id || !received_qty) {
      return NextResponse.json(
        { error: 'Missing required fields: production_order_id, product_sku_id, received_qty' },
        { status: 400 }
      );
    }

    if (received_qty <= 0) {
      return NextResponse.json(
        { error: 'received_qty must be greater than 0' },
        { status: 400 }
      );
    }

    // Get current production order to validate and update
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select('id, production_no, quantity, produced_qty, status')
      .eq('id', production_order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Production order not found' },
        { status: 404 }
      );
    }

    // Check if order is in valid status
    if (!['in_progress', 'released'].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot add receipt to order with status: ${order.status}` },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าใบงานเติมวัตถุดิบ (replenishment) ทั้งหมดเสร็จสิ้นแล้วหรือยัง
    const { data: pendingReplenishments, error: replError } = await supabase
      .from('replenishment_queue')
      .select('queue_id, sku_id, status')
      .eq('trigger_source', 'production_order')
      .eq('trigger_reference', order.production_no)
      .in('status', ['pending', 'assigned', 'in_progress']);

    if (replError) {
      console.error('Error checking replenishment status:', replError);
      return NextResponse.json(
        { error: 'ไม่สามารถตรวจสอบสถานะใบงานเติมวัตถุดิบได้' },
        { status: 500 }
      );
    }

    if (pendingReplenishments && pendingReplenishments.length > 0) {
      const pendingCount = pendingReplenishments.length;
      const pendingSkus = pendingReplenishments.map(r => r.sku_id).join(', ');
      return NextResponse.json(
        { 
          error: `ไม่สามารถบันทึกผลิตจริงได้ เนื่องจากยังมีใบงานเติมวัตถุดิบที่ยังไม่เสร็จสิ้น ${pendingCount} รายการ`,
          pending_replenishments: pendingReplenishments,
          message: `กรุณาดำเนินการเติมวัตถุดิบให้เสร็จสิ้นก่อน: ${pendingSkus}`
        },
        { status: 400 }
      );
    }

    // Create production receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('production_receipts')
      .insert({
        production_order_id,
        product_sku_id,
        received_qty,
        lot_no: lot_no || null,
        batch_no: batch_no || null,
        produced_by: employeeId,
        received_at: new Date().toISOString(),
        remarks: remarks || null
      })
      .select()
      .single();

    if (receiptError) {
      console.error('Error creating production receipt:', receiptError);
      return NextResponse.json(
        { error: 'Failed to create production receipt' },
        { status: 500 }
      );
    }

    // Insert BOM materials with variance tracking
    let materialsInserted = 0;
    let varianceCount = { exact: 0, shortage: 0, excess: 0 };
    let adjustmentCreated: any = null;
    let replenishmentCreated: any[] = [];
    
    if (bom_materials && Array.isArray(bom_materials) && bom_materials.length > 0) {
      // Debug: Log bom_materials to see is_food values
      console.log('=== BOM Materials received ===');
      bom_materials.forEach((m: BomMaterialInput, i: number) => {
        console.log(`[${i}] ${m.material_sku_id}: is_food=${m.is_food}, issued=${m.issued_qty}, actual=${m.actual_qty}`);
      });
      
      // สร้าง map ของ is_food จาก bom_materials ที่ส่งมา
      const isFoodMap = new Map<string, boolean>();
      bom_materials.forEach((m: BomMaterialInput) => {
        isFoodMap.set(m.material_sku_id, m.is_food ?? false);
      });
      console.log('=== is_food Map ===', Object.fromEntries(isFoodMap));
      
      const materialsToInsert = bom_materials
        .filter((m: BomMaterialInput) => m.material_sku_id && m.actual_qty !== undefined)
        .map((m: BomMaterialInput) => ({
          receipt_id: receipt.id,
          material_sku_id: m.material_sku_id,
          issued_qty: m.issued_qty || 0,
          actual_qty: m.actual_qty,
          uom: m.uom || null,
          variance_reason: m.variance_reason || null,
          remarks: m.remarks || null
        }));

      if (materialsToInsert.length > 0) {
        const { data: insertedMaterials, error: materialsError } = await supabase
          .from('production_receipt_materials')
          .insert(materialsToInsert)
          .select();

        if (materialsError) {
          console.error('Error inserting production receipt materials:', materialsError);
          // Don't fail - receipt was created, just log the error
        } else {
          materialsInserted = insertedMaterials?.length || 0;
          
          // Count variance types and collect items with variance
          const varianceItems: Array<{
            sku_id: string;
            variance_qty: number;
            variance_type: string;
            uom: string;
            is_food: boolean;
          }> = [];
          
          insertedMaterials?.forEach((m: any) => {
            // หา original input โดยใช้ material_sku_id แทน index เพื่อความถูกต้อง
            const originalInput = bom_materials.find(
              (b: BomMaterialInput) => b.material_sku_id === m.material_sku_id
            ) as BomMaterialInput | undefined;
            const isFood = originalInput?.is_food ?? false;
            
            if (m.variance_type === 'exact') varianceCount.exact++;
            else if (m.variance_type === 'shortage') {
              varianceCount.shortage++;
              // ใช้น้อยกว่าเบิก = มี stock เหลือ → เพิ่ม stock กลับ (increase)
              // สร้าง stock adjustment สำหรับทั้งวัตถุดิบอาหารและวัสดุบรรจุภัณฑ์
              varianceItems.push({
                sku_id: m.material_sku_id,
                variance_qty: Math.abs(m.variance_qty), // positive for increase
                variance_type: 'shortage',
                uom: m.uom || 'ชิ้น',
                is_food: isFood
              });
            } else if (m.variance_type === 'excess') {
              varianceCount.excess++;
              
              // ใช้มากกว่าเบิก → สร้าง stock adjustment (decrease)
              // สำหรับทั้งวัตถุดิบอาหารและวัสดุบรรจุภัณฑ์
              // (วัสดุบรรจุภัณฑ์ที่ใช้เกิน = ถุง/สติ๊กเกอร์เสีย/ชำรุด)
              varianceItems.push({
                sku_id: m.material_sku_id,
                variance_qty: Math.abs(m.variance_qty), // positive for decrease
                variance_type: 'excess',
                uom: m.uom || 'ชิ้น',
                is_food: isFood
              });
            }
          });

          // Create stock adjustment if there are variance items
          if (varianceItems.length > 0) {
            try {
              // ดึง replenishment data สำหรับทั้งวัตถุดิบอาหารและวัสดุบรรจุภัณฑ์
              const allSkuIds = varianceItems.map(v => v.sku_id);
              console.log('=== Querying replenishment data ===', { 
                trigger_reference: order.production_no, 
                allSkuIds 
              });
              
              const { data: replData, error: replQueryError } = await supabase
                .from('replenishment_queue')
                .select('sku_id, pallet_id, from_location_id')
                .eq('trigger_source', 'production_order')
                .eq('trigger_reference', order.production_no)
                .in('sku_id', allSkuIds)
                .eq('status', 'completed');
              
              console.log('=== Replenishment query result ===', { 
                replData, 
                replQueryError,
                count: replData?.length || 0 
              });
              
              adjustmentCreated = await createVarianceAdjustment(
                order.production_no,
                receipt.id,
                varianceItems,
                systemUserId,
                replData || []
              );
            } catch (adjError) {
              console.error('Error creating variance adjustment:', adjError);
              // Don't fail - receipt was created, adjustment is optional
            }
          }
          
          // Create replenishment tasks for packaging excess items
          // ใช้ข้อมูลจาก adjustmentCreated.replenishment ที่ส่งกลับมาจาก createVarianceAdjustment
          if (adjustmentCreated?.replenishment?.items?.length > 0) {
            try {
              const packagingExcessForRepl = adjustmentCreated.replenishment.items.map((item: any) => ({
                sku_id: item.sku_id,
                excess_qty: item.excess_qty,
                uom: item.uom,
                production_order_item_id: bom_materials.find(
                  (b: BomMaterialInput) => b.material_sku_id === item.sku_id
                )?.production_order_item_id
              }));
              
              replenishmentCreated = await createPackagingReplenishment(
                supabase,
                order.production_no,
                packagingExcessForRepl
              );
            } catch (replError) {
              console.error('Error creating packaging replenishment:', replError);
              // Don't fail - receipt was created, replenishment is optional
            }
          }
        }
      }
    }

    // Update produced_qty in production_orders
    const newProducedQty = (order.produced_qty || 0) + received_qty;
    
    // เปลี่ยนสถานะเป็น completed ทุกครั้งที่บันทึกผลิตจริง (ไม่ว่าจะผลิตครบหรือไม่)
    const newStatus = 'completed';

    const { error: updateError } = await supabase
      .from('production_orders')
      .update({
        produced_qty: newProducedQty,
        // remaining_qty เป็น generated column ไม่ต้อง update
        status: newStatus,
        actual_completion_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', production_order_id);

    if (updateError) {
      console.error('Error updating production order:', updateError);
      // Don't fail the request, receipt was created successfully
    }

    return NextResponse.json({
      data: receipt,
      message: 'บันทึกการผลิตจริงสำเร็จ',
      order_updated: !updateError,
      new_produced_qty: newProducedQty,
      new_status: newStatus,
      materials_tracked: materialsInserted,
      variance_summary: varianceCount,
      adjustment_created: adjustmentCreated,
      replenishment_created: replenishmentCreated.length > 0 ? replenishmentCreated : null
    });
  } catch (error: any) {
    console.error('Error in POST /api/production/actual:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * สร้าง Stock Adjustment อัตโนมัติสำหรับ variance จากการผลิต
 * 
 * **Logic สำหรับวัตถุดิบอาหาร (is_food = true):**
 * - shortage (ใช้น้อยกว่าเบิก): เหลือ stock → increase ที่ Repack (คืน stock)
 * - excess (ใช้มากกว่าเบิก): ไม่ควรเกิด (ใช้เกินกว่าที่เบิกมา) → decrease ที่ Repack
 * 
 * **Logic สำหรับวัสดุบรรจุภัณฑ์ (is_food = false):**
 * - shortage (ใช้น้อยกว่าเบิก): เหลือ stock → increase ที่ Repack (คืน stock)
 * - excess (ใช้มากกว่าเบิก): ต้องเบิกเพิ่ม → สร้าง replenishment task (ไม่สร้าง stock adjustment)
 *   - replenishment task จะเบิกจาก Packaging → Repack
 *   - หลังเบิกเสร็จ stock ที่ Repack จะเพิ่มขึ้น
 *   - ถ้าถุงเสีย/ชำรุด ให้สร้าง stock adjustment แยกต่างหาก
 * 
 * **สำคัญ:** ใช้ `to_location_id` (Repack) ไม่ใช่ `from_location_id` เพราะวัตถุดิบถูกย้ายไปที่ Repack แล้ว
 * 
 * @param productionNo - เลขที่ใบสั่งผลิต
 * @param receiptId - ID ของ production_receipt
 * @param varianceItems - รายการ variance
 * @param userId - user_id จาก master_system_user (ไม่ใช่ employee_id)
 * @param replenishmentData - ข้อมูล replenishment_queue สำหรับดึง pallet_id
 */
async function createVarianceAdjustment(
  productionNo: string,
  receiptId: string,
  varianceItems: Array<{
    sku_id: string;
    variance_qty: number;
    variance_type: string;
    uom: string;
    is_food: boolean;
  }>,
  userId: number,
  replenishmentData?: Array<{
    sku_id: string;
    pallet_id: string | null;
    from_location_id: string | null;
  }>
): Promise<{ increase?: any; decrease?: any; replenishment?: any }> {
  const result: { increase?: any; decrease?: any; replenishment?: any } = {};
  
  // Debug: Log userId and replenishmentData
  console.log('=== createVarianceAdjustment ===', { userId, productionNo, receiptId });
  console.log('=== varianceItems ===', JSON.stringify(varianceItems, null, 2));
  console.log('=== replenishmentData ===', JSON.stringify(replenishmentData, null, 2));
  
  // สร้าง map ของ replenishment data สำหรับดึง pallet_id
  // **สำคัญ:** ใช้ Repack เป็น location เสมอ เพราะวัตถุดิบถูกย้ายไปที่ Repack แล้ว
  const replenishmentMap = new Map<string, { pallet_id: string | null }>();
  if (replenishmentData) {
    replenishmentData.forEach(r => {
      replenishmentMap.set(r.sku_id, { pallet_id: r.pallet_id });
    });
  }
  console.log('=== replenishmentMap ===', Object.fromEntries(replenishmentMap));
  
  // แยก items ตาม variance type และ is_food
  // **สำคัญ:** สำหรับวัตถุดิบอาหาร:
  // - shortage (actual < issued) = ของหาย → ต้อง DECREASE (ลด stock)
  // - excess (actual > issued) = ใช้เกิน → ต้อง DECREASE (ลด stock เพิ่ม)
  // สำหรับ packaging:
  // - shortage = ใช้น้อยกว่าเบิก → INCREASE (คืน stock)
  // - excess = ใช้มากกว่าเบิก → สร้าง replenishment task
  
  const shortageFoodItems = varianceItems.filter(v => v.variance_type === 'shortage' && v.is_food);
  const shortagePackagingItems = varianceItems.filter(v => v.variance_type === 'shortage' && !v.is_food);
  const excessFoodItems = varianceItems.filter(v => v.variance_type === 'excess' && v.is_food);
  const excessPackagingItems = varianceItems.filter(v => v.variance_type === 'excess' && !v.is_food);

  // สร้าง decrease adjustment สำหรับ shortage วัตถุดิบอาหาร (ของหาย)
  // **Logic:** ระบบบอก 36, นับได้ 35 → ของหาย 1 → ต้องลด stock
  // **Location: Repack** เพราะวัตถุดิบอยู่ที่ Repack หลังเบิก
  if (shortageFoodItems.length > 0) {
    const decreasePayload = {
      adjustment_type: 'decrease' as const,
      warehouse_id: DEFAULT_WAREHOUSE_ID,
      reason_id: PRODUCTION_VARIANCE_REASON_ID,
      reference_no: `PROD-${productionNo}`,
      remarks: `ตัด stock จากการผลิต ${productionNo} - ของหาย/ขาดหาย (Receipt: ${receiptId})`,
      created_by: userId,
      items: shortageFoodItems.map(item => {
        const replData = replenishmentMap.get(item.sku_id);
        // variance_qty เป็นค่าลบ (เช่น -1) ต้องใช้ค่าบวกสำหรับ decrease
        const absQty = Math.abs(item.variance_qty);
        return {
          sku_id: item.sku_id,
          location_id: REPACK_LOCATION,
          pallet_id: replData?.pallet_id || null,
          adjustment_piece_qty: -absQty, // negative for decrease
          remarks: `ตัดจากการผลิต (วัตถุดิบอาหาร) - ของหาย ${absQty} ${item.uom}`
        };
      })
    };

    console.log('=== Decrease Adjustment Payload (Food Shortage/Missing) ===', JSON.stringify(decreasePayload, null, 2));

    const { data: decreaseAdj, error: decreaseError } = await stockAdjustmentService.createAdjustment(decreasePayload);
    if (decreaseError) {
      console.error('Error creating decrease adjustment for food shortage:', decreaseError);
    } else if (decreaseAdj) {
      await stockAdjustmentService.submitForApproval(decreaseAdj.adjustment_id, userId);
      result.decrease = {
        adjustment_id: decreaseAdj.adjustment_id,
        adjustment_no: decreaseAdj.adjustment_no,
        items_count: shortageFoodItems.length
      };
    }
  }

  // สร้าง increase adjustment สำหรับ shortage packaging (ใช้น้อยกว่าเบิก → คืน stock)
  if (shortagePackagingItems.length > 0) {
    const increasePayload = {
      adjustment_type: 'increase' as const,
      warehouse_id: DEFAULT_WAREHOUSE_ID,
      reason_id: PRODUCTION_VARIANCE_REASON_ID,
      reference_no: `PROD-${productionNo}`,
      remarks: `คืน stock จากการผลิต ${productionNo} - ใช้น้อยกว่าที่เบิก (Receipt: ${receiptId})`,
      created_by: userId,
      items: shortagePackagingItems.map(item => {
        const absQty = Math.abs(item.variance_qty);
        return {
          sku_id: item.sku_id,
          location_id: REPACK_LOCATION,
          pallet_id: null,
          adjustment_piece_qty: absQty, // positive for increase
          remarks: `คืนจากการผลิต (วัสดุบรรจุภัณฑ์) - ใช้น้อยกว่าเบิก ${absQty} ${item.uom}`
        };
      })
    };

    console.log('=== Increase Adjustment Payload (Packaging Shortage) ===', JSON.stringify(increasePayload, null, 2));

    const { data: increaseAdj, error: increaseError } = await stockAdjustmentService.createAdjustment(increasePayload);
    if (increaseError) {
      console.error('Error creating increase adjustment for packaging shortage:', increaseError);
    } else if (increaseAdj) {
      await stockAdjustmentService.submitForApproval(increaseAdj.adjustment_id, userId);
      result.increase = {
        adjustment_id: increaseAdj.adjustment_id,
        adjustment_no: increaseAdj.adjustment_no,
        items_count: shortagePackagingItems.length
      };
    }
  }

  // สร้าง decrease adjustment สำหรับ excess วัตถุดิบอาหาร (ใช้มากกว่าเบิก)
  // **Location: Repack** เพราะวัตถุดิบอยู่ที่ Repack หลังเบิก
  if (excessFoodItems.length > 0) {
    // ถ้ามี decrease จาก shortage แล้ว ให้รวมเข้าด้วยกัน
    // แต่ถ้าไม่มี ให้สร้างใหม่
    const decreasePayload = {
      adjustment_type: 'decrease' as const,
      warehouse_id: DEFAULT_WAREHOUSE_ID,
      reason_id: PRODUCTION_VARIANCE_REASON_ID,
      reference_no: `PROD-${productionNo}`,
      remarks: `ตัด stock จากการผลิต ${productionNo} - ใช้มากกว่าเบิก (Receipt: ${receiptId})`,
      created_by: userId,
      items: excessFoodItems.map(item => {
        const replData = replenishmentMap.get(item.sku_id);
        return {
          sku_id: item.sku_id,
          location_id: REPACK_LOCATION,
          pallet_id: replData?.pallet_id || null,
          adjustment_piece_qty: -item.variance_qty, // negative for decrease
          remarks: `ตัดจากการผลิต (วัตถุดิบอาหาร) - ใช้มากกว่าเบิก ${item.variance_qty} ${item.uom}`
        };
      })
    };

    console.log('=== Decrease Adjustment Payload (Food Excess) ===', JSON.stringify(decreasePayload, null, 2));

    const { data: decreaseAdj, error: decreaseError } = await stockAdjustmentService.createAdjustment(decreasePayload);
    if (decreaseError) {
      console.error('Error creating decrease adjustment for food excess:', decreaseError);
    } else if (decreaseAdj) {
      await stockAdjustmentService.submitForApproval(decreaseAdj.adjustment_id, userId);
      // ถ้ายังไม่มี result.decrease ให้ set ใหม่
      if (!result.decrease) {
        result.decrease = {
          adjustment_id: decreaseAdj.adjustment_id,
          adjustment_no: decreaseAdj.adjustment_no,
          items_count: excessFoodItems.length
        };
      }
    }
  }

  // สำหรับ packaging excess: สร้าง replenishment task แทน stock adjustment
  // เพราะต้องเบิกเพิ่มจาก Packaging → Repack ก่อน
  if (excessPackagingItems.length > 0) {
    console.log('=== Creating Replenishment Tasks for Packaging Excess ===');
    console.log('Items:', JSON.stringify(excessPackagingItems, null, 2));
    
    // จะสร้าง replenishment task ใน function createPackagingReplenishment
    // ส่งกลับข้อมูลเพื่อให้ caller สร้าง replenishment task
    result.replenishment = {
      items: excessPackagingItems.map(item => ({
        sku_id: item.sku_id,
        excess_qty: item.variance_qty,
        uom: item.uom
      })),
      message: `ต้องเบิกเพิ่ม ${excessPackagingItems.length} รายการ`
    };
  }

  return result;
}

/**
 * สร้าง Replenishment Task สำหรับ packaging materials ที่ใช้มากกว่าเบิก
 * จะสร้างรายการเบิกเพิ่มเติมไปที่หน้า Material Requisition
 * 
 * @param supabase - Supabase client
 * @param productionNo - เลขที่ใบสั่งผลิต
 * @param excessItems - รายการ packaging ที่ใช้มากกว่าเบิก
 * @returns Array of created replenishment tasks
 */
async function createPackagingReplenishment(
  supabase: any,
  productionNo: string,
  excessItems: Array<{
    sku_id: string;
    excess_qty: number;
    uom: string;
    production_order_item_id?: string;
  }>
): Promise<Array<{ queue_id: string; sku_id: string; requested_qty: number }>> {
  const createdTasks: Array<{ queue_id: string; sku_id: string; requested_qty: number }> = [];

  for (const item of excessItems) {
    try {
      // หา location ที่มี stock ของ SKU นี้
      const { data: stockLocations } = await supabase
        .from('wms_inventory_balances')
        .select('location_id, total_piece_qty, reserved_piece_qty')
        .eq('sku_id', item.sku_id)
        .gt('total_piece_qty', 0)
        .not('location_id', 'in', '(Repack,Dispatch,Delivery-In-Progress,RCV,SHIP)')
        .order('total_piece_qty', { ascending: false })
        .limit(1);

      const fromLocation = stockLocations?.[0]?.location_id || null;

      // ถ้าไม่มีสต็อก ไม่ต้องสร้าง replenishment task
      // แค่บันทึก remarks ใน production_order_items
      if (!fromLocation) {
        console.log(`[Packaging] No stock found for ${item.sku_id}, skipping replenishment task`);
        
        // อัปเดต production_order_items ถ้ามี ID (บันทึกว่าใช้เกิน)
        if (item.production_order_item_id) {
          const { data: currentItem } = await supabase
            .from('production_order_items')
            .select('required_qty, issued_qty, remarks')
            .eq('id', item.production_order_item_id)
            .single();

          if (currentItem) {
            const existingRemarks = currentItem.remarks || '';
            const newRemarks = existingRemarks 
              ? `${existingRemarks} | ใช้จริงเกิน ${item.excess_qty} ${item.uom}`
              : `ใช้จริงเกิน ${item.excess_qty} ${item.uom}`;

            await supabase
              .from('production_order_items')
              .update({
                remarks: newRemarks,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.production_order_item_id);
          }
        }
        continue; // ข้ามไปรายการถัดไป
      }

      // สร้าง replenishment task (เฉพาะกรณีที่มีสต็อก)
      const { data: task, error: taskError } = await supabase
        .from('replenishment_queue')
        .insert({
          warehouse_id: DEFAULT_WAREHOUSE_ID,
          sku_id: item.sku_id,
          from_location_id: fromLocation,
          to_location_id: REPACK_LOCATION,
          requested_qty: Math.ceil(item.excess_qty), // ปัดขึ้นเป็นจำนวนเต็ม
          confirmed_qty: 0,
          priority: 2, // priority สูง (เร่งด่วน)
          status: 'pending',
          trigger_source: 'production_order',
          trigger_reference: productionNo,
          notes: `เบิกเพิ่มเติม - ใช้จริงมากกว่าที่เบิก ${item.excess_qty} ${item.uom}`
        })
        .select('queue_id, sku_id, requested_qty')
        .single();

      if (taskError) {
        console.error(`Error creating replenishment task for ${item.sku_id}:`, taskError);
      } else if (task) {
        createdTasks.push(task);

        // อัปเดต production_order_items ถ้ามี ID
        if (item.production_order_item_id) {
          // เพิ่ม required_qty (remaining_qty เป็น generated column)
          const { data: currentItem } = await supabase
            .from('production_order_items')
            .select('required_qty, issued_qty')
            .eq('id', item.production_order_item_id)
            .single();

          if (currentItem) {
            const newRequiredQty = Number(currentItem.required_qty) + item.excess_qty;

            await supabase
              .from('production_order_items')
              .update({
                required_qty: newRequiredQty,
                // remaining_qty เป็น generated column ไม่ต้อง update
                status: 'pending', // กลับเป็น pending เพราะต้องเบิกเพิ่ม
                remarks: `เพิ่มจำนวนเบิก ${item.excess_qty} ${item.uom} (ใช้จริงมากกว่าเบิก)`,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.production_order_item_id);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing replenishment for ${item.sku_id}:`, err);
    }
  }

  return createdTasks;
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
