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

// Constants
// ADJ_LOSS_LOCATION ไม่ใช้แล้ว - ใช้ location จาก replenishment_queue แทน
const PRODUCTION_VARIANCE_REASON_ID = 40; // reason_code = 'PRODUCTION_VARIANCE'
const DEFAULT_WAREHOUSE_ID = 'WH001';
const REPACK_LOCATION = 'Repack';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');

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
          sku:master_sku!production_orders_sku_id_fkey(sku_id, sku_name)
        ),
        product_sku:master_sku!production_receipts_product_sku_id_fkey(sku_id, sku_name),
        producer:master_employee!production_receipts_produced_by_fkey(employee_id, first_name, last_name, nickname)
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
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching production receipts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch production receipts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      totalCount: count || 0,
      page,
      pageSize
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

export async function POST(request: NextRequest) {
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
          }> = [];
          
          // Collect packaging materials with excess (ใช้มากกว่าเบิก) for replenishment
          const packagingExcessItems: Array<{
            sku_id: string;
            excess_qty: number;
            uom: string;
            production_order_item_id?: string;
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
              // สร้าง stock adjustment เฉพาะวัตถุดิบอาหารเท่านั้น
              if (isFood) {
                varianceItems.push({
                  sku_id: m.material_sku_id,
                  variance_qty: Math.abs(m.variance_qty), // positive for increase
                  variance_type: 'shortage',
                  uom: m.uom || 'ชิ้น'
                });
              }
            } else if (m.variance_type === 'excess') {
              varianceCount.excess++;
              
              if (isFood) {
                // วัตถุดิบอาหาร: ใช้มากกว่าเบิก → สร้าง stock adjustment (decrease)
                varianceItems.push({
                  sku_id: m.material_sku_id,
                  variance_qty: Math.abs(m.variance_qty), // positive for decrease
                  variance_type: 'excess',
                  uom: m.uom || 'ชิ้น'
                });
              } else {
                // วัสดุ (packaging): ใช้มากกว่าเบิก → สร้าง replenishment task
                if (Math.abs(m.variance_qty) > 0) {
                  packagingExcessItems.push({
                    sku_id: m.material_sku_id,
                    excess_qty: Math.abs(m.variance_qty),
                    uom: m.uom || 'ชิ้น',
                    production_order_item_id: originalInput?.production_order_item_id
                  });
                }
              }
            }
          });

          // Create stock adjustment if there are variance items
          if (varianceItems.length > 0) {
            try {
              // ดึง replenishment data สำหรับวัตถุดิบอาหาร (เพื่อใช้ pallet_id และ location)
              const foodSkuIds = varianceItems.map(v => v.sku_id);
              const { data: replData } = await supabase
                .from('replenishment_queue')
                .select('sku_id, pallet_id, from_location_id')
                .eq('trigger_source', 'production_order')
                .eq('trigger_reference', order.production_no)
                .in('sku_id', foodSkuIds)
                .eq('status', 'completed');
              
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
          if (packagingExcessItems.length > 0) {
            try {
              replenishmentCreated = await createPackagingReplenishment(
                supabase,
                order.production_no,
                packagingExcessItems
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
    const newRemainingQty = order.quantity - newProducedQty;
    
    // Determine new status
    let newStatus = order.status;
    if (newRemainingQty <= 0) {
      newStatus = 'completed';
    }

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
 * **เฉพาะวัตถุดิบอาหารเท่านั้น** - วัสดุ (packaging) จะใช้ replenishment task แทน
 * 
 * - shortage (ใช้น้อยกว่าเบิก): สร้าง increase adjustment เพื่อคืน stock
 * - excess (ใช้มากกว่าเบิก): สร้าง decrease adjustment เพื่อตัด stock เพิ่ม
 * 
 * ทั้งสองกรณีจะสร้างเป็น pending_approval เพื่อรออนุมัติ
 * 
 * @param productionNo - เลขที่ใบสั่งผลิต
 * @param receiptId - ID ของ production_receipt
 * @param varianceItems - รายการ variance
 * @param userId - user_id จาก master_system_user (ไม่ใช่ employee_id)
 * @param replenishmentData - ข้อมูล replenishment_queue สำหรับดึง pallet_id และ location
 */
async function createVarianceAdjustment(
  productionNo: string,
  receiptId: string,
  varianceItems: Array<{
    sku_id: string;
    variance_qty: number;
    variance_type: string;
    uom: string;
  }>,
  userId: number,
  replenishmentData?: Array<{
    sku_id: string;
    pallet_id: string | null;
    from_location_id: string | null;
  }>
): Promise<{ increase?: any; decrease?: any }> {
  const result: { increase?: any; decrease?: any } = {};
  
  // Debug: Log userId
  console.log('=== createVarianceAdjustment ===', { userId, productionNo, receiptId });
  
  // สร้าง map ของ replenishment data สำหรับดึง pallet_id และ location
  const replenishmentMap = new Map<string, { pallet_id: string | null; from_location_id: string | null }>();
  if (replenishmentData) {
    replenishmentData.forEach(r => {
      replenishmentMap.set(r.sku_id, { pallet_id: r.pallet_id, from_location_id: r.from_location_id });
    });
  }
  
  // แยก items ตาม variance type
  const shortageItems = varianceItems.filter(v => v.variance_type === 'shortage');
  const excessItems = varianceItems.filter(v => v.variance_type === 'excess');

  // สร้าง increase adjustment สำหรับ shortage (คืน stock)
  // ใช้ location ต้นทางจาก replenishment_queue (ที่เบิกวัตถุดิบไป)
  if (shortageItems.length > 0) {
    const increasePayload = {
      adjustment_type: 'increase' as const,
      warehouse_id: DEFAULT_WAREHOUSE_ID,
      reason_id: PRODUCTION_VARIANCE_REASON_ID,
      reference_no: `PROD-${productionNo}`,
      remarks: `คืน stock จากการผลิต ${productionNo} - ใช้น้อยกว่าที่เบิก (Receipt: ${receiptId})`,
      created_by: userId,
      items: shortageItems.map(item => {
        const replData = replenishmentMap.get(item.sku_id);
        return {
          sku_id: item.sku_id,
          // ใช้ location ต้นทางจาก replenishment (ที่เบิกไป) หรือ fallback เป็น Repack
          location_id: replData?.from_location_id || REPACK_LOCATION,
          pallet_id: replData?.pallet_id || null,
          adjustment_piece_qty: item.variance_qty, // positive for increase
          remarks: `คืนจากการผลิต - ใช้น้อยกว่าเบิก ${item.variance_qty} ${item.uom}`
        };
      })
    };

    console.log('=== Increase Adjustment Payload ===', JSON.stringify(increasePayload, null, 2));

    const { data: increaseAdj, error: increaseError } = await stockAdjustmentService.createAdjustment(increasePayload);
    if (increaseError) {
      console.error('Error creating increase adjustment:', increaseError);
    } else if (increaseAdj) {
      // Submit for approval
      await stockAdjustmentService.submitForApproval(increaseAdj.adjustment_id, userId);
      result.increase = {
        adjustment_id: increaseAdj.adjustment_id,
        adjustment_no: increaseAdj.adjustment_no,
        items_count: shortageItems.length
      };
    }
  }

  // สร้าง decrease adjustment สำหรับ excess (ตัด stock เพิ่ม)
  // ใช้ location ต้นทางจาก replenishment_queue (ที่เบิกวัตถุดิบไป)
  if (excessItems.length > 0) {
    const decreasePayload = {
      adjustment_type: 'decrease' as const,
      warehouse_id: DEFAULT_WAREHOUSE_ID,
      reason_id: PRODUCTION_VARIANCE_REASON_ID,
      reference_no: `PROD-${productionNo}`,
      remarks: `ตัด stock เพิ่มจากการผลิต ${productionNo} - ใช้มากกว่าที่เบิก (Receipt: ${receiptId})`,
      created_by: userId,
      items: excessItems.map(item => {
        const replData = replenishmentMap.get(item.sku_id);
        return {
          sku_id: item.sku_id,
          // ใช้ location ต้นทางจาก replenishment (ที่เบิกไป) หรือ fallback เป็น Repack
          location_id: replData?.from_location_id || REPACK_LOCATION,
          pallet_id: replData?.pallet_id || null,
          adjustment_piece_qty: -item.variance_qty, // negative for decrease
          remarks: `ตัดเพิ่มจากการผลิต - ใช้มากกว่าเบิก ${item.variance_qty} ${item.uom}`
        };
      })
    };

    console.log('=== Decrease Adjustment Payload ===', JSON.stringify(decreasePayload, null, 2));

    const { data: decreaseAdj, error: decreaseError } = await stockAdjustmentService.createAdjustment(decreasePayload);
    if (decreaseError) {
      console.error('Error creating decrease adjustment:', decreaseError);
    } else if (decreaseAdj) {
      // Submit for approval
      await stockAdjustmentService.submitForApproval(decreaseAdj.adjustment_id, userId);
      result.decrease = {
        adjustment_id: decreaseAdj.adjustment_id,
        adjustment_no: decreaseAdj.adjustment_no,
        items_count: excessItems.length
      };
    }
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
