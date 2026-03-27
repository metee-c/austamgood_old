/**
 * Production Orders Database Service
 * บริการฐานข้อมูลสำหรับระบบใบสั่งผลิต
 */

import { createClient } from '@/lib/supabase/server';
import {
  ProductionOrder,
  ProductionOrderWithDetails,
  ProductionOrderFilters,
  ProductionOrderListResponse,
  CreateProductionOrderInput,
  UpdateProductionOrderInput,
  PlanDataForOrder,
} from '@/types/production-order-schema';

/**
 * Generate production order number: PO-YYYYMMDD-XXX
 * ใช้ start_date (วันที่ผลิตจริงที่ผู้ใช้เลือกในหน้าบันทึกผลิตจริง)
 * ไม่ใช่ production_date (วันผลิตของ FG) หรือ created_at (วันที่สร้างบันทึก)
 */
async function generateProductionNo(startDate?: string, attempt = 0): Promise<string> {
  const supabase = await createClient();

  // ใช้ start_date ถ้ามี ไม่งั้นใช้วันที่ปัจจุบัน
  const dateToUse = startDate ? new Date(startDate) : new Date();
  const dateStr = dateToUse.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `PO-${dateStr}`;

  // Use MAX-based lookup instead of COUNT to avoid race conditions
  const { data: maxRow } = await supabase
    .from('production_orders')
    .select('production_no')
    .like('production_no', `${prefix}-%`)
    .order('production_no', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (maxRow?.production_no) {
    const parts = maxRow.production_no.split('-');
    const lastSeq = parseInt(parts[parts.length - 1] || '0', 10);
    nextSeq = lastSeq + 1 + attempt;
  } else {
    nextSeq = 1 + attempt;
  }

  return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Get production orders with filters
 */
export async function getProductionOrders(
  filters: ProductionOrderFilters = {}
): Promise<ProductionOrderListResponse> {
  const supabase = await createClient();
  const { search, status, plan_id, start_date, end_date, page = 1, pageSize = 50 } = filters;

  let query = supabase
    .from('production_orders')
    .select(`
      *,
      sku:master_sku!production_orders_sku_id_fkey(sku_id, sku_name, uom_base, category, sub_category),
      plan:production_plan!production_orders_plan_id_fkey(plan_id, plan_no, plan_name),
      creator:master_employee!production_orders_created_by_fkey(employee_id, first_name, last_name, nickname),
      items:production_order_items(
        *,
        material_sku:master_sku!production_order_items_material_sku_id_fkey(sku_id, sku_name, uom_base)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (search) {
    query = query.or(`production_no.ilike.%${search}%,sku_id.ilike.%${search}%`);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (plan_id) {
    query = query.eq('plan_id', plan_id);
  }

  if (start_date) {
    query = query.gte('start_date', start_date);
  }

  if (end_date) {
    query = query.lte('due_date', end_date);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching production orders:', error);
    throw new Error('Failed to fetch production orders');
  }

  // Get summary counts
  const { data: summaryData } = await supabase
    .from('production_orders')
    .select('status');

  const summary = {
    total: summaryData?.length || 0,
    planned: summaryData?.filter(o => o.status === 'planned').length || 0,
    released: summaryData?.filter(o => o.status === 'released').length || 0,
    in_progress: summaryData?.filter(o => o.status === 'in_progress').length || 0,
    completed: summaryData?.filter(o => o.status === 'completed').length || 0,
    on_hold: summaryData?.filter(o => o.status === 'on_hold').length || 0,
    cancelled: summaryData?.filter(o => o.status === 'cancelled').length || 0,
  };

  return {
    data: (data || []) as ProductionOrderWithDetails[],
    totalCount: count || 0,
    summary,
  };
}

/**
 * Get single production order by ID
 */
export async function getProductionOrderById(
  orderId: string
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('production_orders')
    .select(`
      *,
      sku:master_sku!production_orders_sku_id_fkey(sku_id, sku_name, uom_base, category, sub_category),
      plan:production_plan!production_orders_plan_id_fkey(plan_id, plan_no, plan_name),
      creator:master_employee!production_orders_created_by_fkey(employee_id, first_name, last_name, nickname),
      items:production_order_items(
        *,
        material_sku:master_sku!production_order_items_material_sku_id_fkey(sku_id, sku_name, uom_base, category, sub_category)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Error fetching production order:', error);
    return null;
  }

  return data as ProductionOrderWithDetails;
}

/**
 * Get plan data for creating production order
 */
export async function getPlanDataForOrder(planId: string): Promise<PlanDataForOrder | null> {
  const supabase = await createClient();

  // Get plan with items and materials
  const { data: plan, error: planError } = await supabase
    .from('production_plan')
    .select(`
      plan_id,
      plan_no,
      plan_name,
      plan_start_date,
      plan_end_date,
      items:production_plan_items(
        sku_id,
        required_qty,
        sku:master_sku(sku_id, sku_name)
      ),
      material_requirements(
        material_sku_id,
        finished_sku_id,
        gross_requirement,
        material_uom,
        material_sku:master_sku!material_requirements_material_sku_id_fkey(sku_id, sku_name)
      )
    `)
    .eq('plan_id', planId)
    .single();

  if (planError || !plan) {
    console.error('Error fetching plan data:', planError);
    return null;
  }

  return {
    plan_id: plan.plan_id,
    plan_no: plan.plan_no,
    plan_name: plan.plan_name,
    plan_start_date: plan.plan_start_date,
    plan_end_date: plan.plan_end_date,
    items: (plan.items || []).map((item: any) => ({
      sku_id: item.sku_id,
      sku_name: item.sku?.sku_name || item.sku_id,
      required_qty: Number(item.required_qty),
    })),
    materials: (plan.material_requirements || []).map((mat: any) => ({
      material_sku_id: mat.material_sku_id,
      finished_sku_id: mat.finished_sku_id,
      material_name: mat.material_sku?.sku_name || mat.material_sku_id,
      gross_requirement: Number(mat.gross_requirement),
      material_uom: mat.material_uom,
    })),
  };
}

/**
 * Create a new production order
 */
export async function createProductionOrder(
  input: CreateProductionOrderInput,
  userId?: number
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  console.log('🏭 [createProductionOrder] Starting with input:', JSON.stringify(input, null, 2));

  try {
    // 2. Get SKU info for UOM
    const { data: skuData } = await supabase
      .from('master_sku')
      .select('uom_base')
      .eq('sku_id', input.sku_id)
      .maybeSingle();
    console.log('🏭 [createProductionOrder] SKU data:', skuData);

    // 3. Create production order header (retry on duplicate production_no)
    let order: any = null;
    let productionNo = '';
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      productionNo = await generateProductionNo(input.start_date, attempt);
      console.log('🏭 [createProductionOrder] Attempting production_no:', productionNo, '(attempt', attempt + 1, ')');

      const { data: insertData, error: orderError } = await supabase
        .from('production_orders')
        .insert({
          production_no: productionNo,
          plan_id: input.plan_id,
          sku_id: input.sku_id,
          quantity: input.quantity,
          produced_qty: 0,
          uom: input.uom || skuData?.uom_base,
          start_date: input.start_date,
          due_date: input.due_date,
          production_date: input.production_date,
          expiry_date: input.expiry_date,
          fg_remarks: input.fg_remarks,
          priority: input.priority || 5,
          status: 'planned',
          remarks: input.remarks,
          created_by: userId,
        })
        .select()
        .single();

      if (!orderError) {
        order = insertData;
        break;
      } else if (orderError.code === '23505') {
        // Duplicate production_no - retry with next sequence
        console.warn('🏭 [createProductionOrder] Duplicate production_no, retrying...');
        continue;
      } else {
        console.error('🏭 [createProductionOrder] Error creating production order:', orderError);
        throw new Error(orderError.message || 'Failed to create production order');
      }
    }

    if (!order) {
      throw new Error('ไม่สามารถสร้างเลขใบสั่งผลิตได้ กรุณาลองใหม่');
    }
    console.log('🏭 [createProductionOrder] Order header created:', order.id);

    // 4. Create order items (materials) if provided
    if (input.items && input.items.length > 0) {
      console.log('🏭 [createProductionOrder] Creating order items:', input.items.length);
      console.log('🏭 [createProductionOrder] Items detail:', JSON.stringify(input.items, null, 2));
      
      const orderItems = input.items.map(item => ({
        production_order_id: order.id,
        material_sku_id: item.material_sku_id,
        required_qty: item.required_qty,
        issued_qty: 0,
        uom: item.uom,
        status: 'pending',
        remarks: item.remarks,
      }));

      console.log('🏭 [createProductionOrder] Order items to insert:', JSON.stringify(orderItems, null, 2));

      const { error: itemsError } = await supabase
        .from('production_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('🏭 [createProductionOrder] Error creating order items:', itemsError);
        // Rollback - delete the order
        await supabase.from('production_orders').delete().eq('id', order.id);
        throw new Error(itemsError.message || 'Failed to create order items');
      }
      console.log('🏭 [createProductionOrder] Order items created successfully');
    } else {
      console.log('🏭 [createProductionOrder] No items provided');
    }

    // 5. Create replenishment_queue entries for selected food material pallets
    if (input.selected_pallets && input.selected_pallets.length > 0) {
      console.log('🏭 [createProductionOrder] Creating replenishment entries for pallets:', input.selected_pallets.length);
      console.log('🏭 [createProductionOrder] Selected pallets detail:', JSON.stringify(input.selected_pallets, null, 2));
      
      // Fetch expiry_date from inventory balances for each pallet
      const palletIds = input.selected_pallets.map(p => p.pallet_id).filter(Boolean);
      let expiryDateMap: Record<string, string | null> = {};
      
      if (palletIds.length > 0) {
        const { data: balanceData } = await supabase
          .from('wms_inventory_balances')
          .select('pallet_id, expiry_date')
          .in('pallet_id', palletIds);
        
        (balanceData || []).forEach((b: any) => {
          if (b.pallet_id) {
            expiryDateMap[b.pallet_id] = b.expiry_date;
          }
        });
      }

      const replenishmentEntries = input.selected_pallets.map(pallet => ({
        warehouse_id: 'WH001', // Default warehouse
        sku_id: pallet.sku_id,
        from_location_id: pallet.location_id,
        to_location_id: 'Repack', // ปลายทางคือ Repack เสมอสำหรับงานเบิกวัตถุดิบจากใบสั่งผลิต
        pallet_id: pallet.pallet_id,
        expiry_date: pallet.pallet_id ? expiryDateMap[pallet.pallet_id] || null : null,
        requested_qty: pallet.qty,
        confirmed_qty: 0,
        priority: 3, // High priority for production
        status: 'pending',
        trigger_source: 'production_order',
        trigger_reference: productionNo,
        notes: `เบิกวัตถุดิบอาหารสำหรับใบสั่งผลิต ${productionNo}`,
        assigned_to: null,
      }));

      console.log('🏭 [createProductionOrder] Replenishment entries to insert:', JSON.stringify(replenishmentEntries, null, 2));

      const { error: replenishmentError } = await supabase
        .from('replenishment_queue')
        .insert(replenishmentEntries);

      if (replenishmentError) {
        console.error('🏭 [createProductionOrder] Error creating replenishment queue entries:', replenishmentError);
        // Don't rollback - order is created, just log the error
        // The user can manually create replenishment tasks later
      } else {
        console.log('🏭 [createProductionOrder] Replenishment entries created successfully');
      }
    } else {
      console.log('🏭 [createProductionOrder] No selected pallets provided');
    }

    // 6. Return complete order
    console.log('🏭 [createProductionOrder] Fetching complete order details');
    return await getProductionOrderById(order.id);
  } catch (error) {
    console.error('🏭 [createProductionOrder] Error:', error);
    throw error;
  }
}


/**
 * Update production order
 */
export async function updateProductionOrder(
  input: UpdateProductionOrderInput
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const { id, ...updateData } = input;

  const { error } = await supabase
    .from('production_orders')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating production order:', error);
    throw new Error('Failed to update production order');
  }

  return await getProductionOrderById(id);
}

/**
 * Delete production order
 */
export async function deleteProductionOrder(orderId: string): Promise<boolean> {
  const supabase = await createClient();

  // Delete order items first
  await supabase
    .from('production_order_items')
    .delete()
    .eq('production_order_id', orderId);

  // Delete order
  const { error } = await supabase
    .from('production_orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error deleting production order:', error);
    return false;
  }

  return true;
}

/**
 * Release production order (change status from planned to released)
 */
export async function releaseProductionOrder(
  orderId: string
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_orders')
    .update({
      status: 'released',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'planned');

  if (error) {
    console.error('Error releasing production order:', error);
    throw new Error('Failed to release production order');
  }

  return await getProductionOrderById(orderId);
}

/**
 * Start production (change status to in_progress)
 */
export async function startProductionOrder(
  orderId: string
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_orders')
    .update({
      status: 'in_progress',
      actual_start_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .in('status', ['planned', 'released']);

  if (error) {
    console.error('Error starting production order:', error);
    throw new Error('Failed to start production order');
  }

  return await getProductionOrderById(orderId);
}

/**
 * Complete production order
 */
export async function completeProductionOrder(
  orderId: string,
  producedQty?: number
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const updateData: any = {
    status: 'completed',
    actual_completion_date: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  };

  if (producedQty !== undefined) {
    updateData.produced_qty = producedQty;
  }

  const { error } = await supabase
    .from('production_orders')
    .update(updateData)
    .eq('id', orderId);

  if (error) {
    console.error('Error completing production order:', error);
    throw new Error('Failed to complete production order');
  }

  return await getProductionOrderById(orderId);
}

/**
 * Put production order on hold
 */
export async function holdProductionOrder(
  orderId: string
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_orders')
    .update({
      status: 'on_hold',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error('Error holding production order:', error);
    throw new Error('Failed to hold production order');
  }

  return await getProductionOrderById(orderId);
}

/**
 * Cancel production order
 */
export async function cancelProductionOrder(
  orderId: string
): Promise<ProductionOrderWithDetails | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.error('Error cancelling production order:', error);
    throw new Error('Failed to cancel production order');
  }

  return await getProductionOrderById(orderId);
}

/**
 * Create multiple production orders from a plan (one per SKU)
 */
export async function createOrdersFromPlan(
  planId: string,
  userId?: number
): Promise<ProductionOrderWithDetails[]> {
  const supabase = await createClient();

  // Get plan data
  const planData = await getPlanDataForOrder(planId);
  if (!planData) {
    throw new Error('Plan not found');
  }

  const createdOrders: ProductionOrderWithDetails[] = [];

  // Create one order per SKU in the plan
  for (const item of planData.items) {
    // Get materials for this SKU from the plan
    const materialsForSku = planData.materials.filter(mat => {
      // In a real scenario, you'd need to match materials to SKUs via BOM
      // For now, we'll include all materials
      return true;
    });

    const orderInput: CreateProductionOrderInput = {
      plan_id: planId,
      sku_id: item.sku_id,
      quantity: item.required_qty,
      start_date: planData.plan_start_date,
      due_date: planData.plan_end_date,
      items: materialsForSku.map(mat => ({
        material_sku_id: mat.material_sku_id,
        required_qty: mat.gross_requirement,
        uom: mat.material_uom,
      })),
    };

    const order = await createProductionOrder(orderInput, userId);
    if (order) {
      createdOrders.push(order);
    }
  }

  // Update plan status to in_production
  await supabase
    .from('production_plan')
    .update({
      status: 'in_production',
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId);

  return createdOrders;
}
