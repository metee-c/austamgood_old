/**
 * Production Planning Database Service
 * บริการฐานข้อมูลสำหรับระบบวางแผนการผลิต
 */

import { createClient } from '@/lib/supabase/server';
import {
  ProductionPlan,
  ProductionPlanWithItems,
  ProductionPlanItem,
  ProductionPlanItemWithDetails,
  MaterialRequirement,
  ProductionPlanFilters,
  ProductionPlanListResponse,
  CreateProductionPlanInput,
  UpdateProductionPlanInput,
  BomCalculationRequest,
  BomCalculationResult,
  CalculatedMaterial,
} from '@/types/production-planning-schema';

/**
 * Generate plan number: PP-YYYYMMDD-XXX
 */
async function generatePlanNo(): Promise<string> {
  const supabase = await createClient();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `PP-${dateStr}`;

  // Get count of plans created today
  const { count } = await supabase
    .from('production_plan')
    .select('*', { count: 'exact', head: true })
    .like('plan_no', `${prefix}%`);

  const sequence = String((count || 0) + 1).padStart(3, '0');
  return `${prefix}-${sequence}`;
}

/**
 * Get production plans with filters
 */
export async function getProductionPlans(
  filters: ProductionPlanFilters = {}
): Promise<ProductionPlanListResponse> {
  const supabase = await createClient();
  const { search, status, start_date, end_date, warehouse_id, page = 1, pageSize = 50 } = filters;

  let query = supabase
    .from('production_plan')
    .select(`
      *,
      creator:master_employee!production_plan_created_by_fkey(employee_id, first_name, last_name, nickname),
      approver:master_employee!production_plan_approved_by_fkey(employee_id, first_name, last_name, nickname),
      items:production_plan_items(
        *,
        sku:master_sku(sku_id, sku_name, uom_base, category, sub_category, qty_per_pack)
      ),
      material_requirements(
        *,
        material_sku:master_sku!material_requirements_material_sku_id_fkey(sku_id, sku_name, uom_base, weight_per_piece_kg),
        finished_sku:master_sku!material_requirements_finished_sku_id_fkey(sku_id, sku_name)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (search) {
    query = query.or(`plan_no.ilike.%${search}%,plan_name.ilike.%${search}%`);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (start_date) {
    query = query.gte('plan_start_date', start_date);
  }

  if (end_date) {
    query = query.lte('plan_end_date', end_date);
  }

  if (warehouse_id) {
    query = query.eq('warehouse_id', warehouse_id);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching production plans:', error);
    throw new Error('Failed to fetch production plans');
  }

  // Get summary counts
  const { data: summaryData } = await supabase
    .from('production_plan')
    .select('status');

  const summary = {
    total: summaryData?.length || 0,
    draft: summaryData?.filter(p => p.status === 'draft').length || 0,
    approved: summaryData?.filter(p => p.status === 'approved').length || 0,
    in_production: summaryData?.filter(p => p.status === 'in_production').length || 0,
    completed: summaryData?.filter(p => p.status === 'completed').length || 0,
    cancelled: summaryData?.filter(p => p.status === 'cancelled').length || 0,
  };

  return {
    data: (data || []) as ProductionPlanWithItems[],
    totalCount: count || 0,
    summary,
  };
}

/**
 * Get single production plan by ID
 */
export async function getProductionPlanById(
  planId: string
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('production_plan')
    .select(`
      *,
      creator:master_employee!production_plan_created_by_fkey(employee_id, first_name, last_name, nickname),
      approver:master_employee!production_plan_approved_by_fkey(employee_id, first_name, last_name, nickname),
      items:production_plan_items(
        *,
        sku:master_sku(sku_id, sku_name, uom_base, category, sub_category, qty_per_pack)
      ),
      material_requirements(
        *,
        material_sku:master_sku!material_requirements_material_sku_id_fkey(sku_id, sku_name, uom_base, weight_per_piece_kg),
        finished_sku:master_sku!material_requirements_finished_sku_id_fkey(sku_id, sku_name)
      )
    `)
    .eq('plan_id', planId)
    .single();

  if (error) {
    console.error('Error fetching production plan:', error);
    return null;
  }

  return data as ProductionPlanWithItems;
}


/**
 * Calculate BOM requirements for a SKU
 * คำนวณความต้องการวัตถุดิบจาก BOM
 */
export async function calculateBomRequirements(
  request: BomCalculationRequest
): Promise<BomCalculationResult | null> {
  const supabase = await createClient();
  const { sku_id, quantity } = request;

  // 1. Get SKU info including weight_per_piece_kg for unit conversion
  const { data: sku, error: skuError } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name, uom_base, weight_per_piece_kg')
    .eq('sku_id', sku_id)
    .single();

  if (skuError || !sku) {
    console.error('SKU not found:', sku_id);
    return null;
  }

  // 2. Get BOM records for this SKU
  const { data: bomRecords, error: bomError } = await supabase
    .from('bom_sku')
    .select(`
      *,
      material_sku:master_sku!fk_material_sku(sku_id, sku_name, uom_base, weight_per_piece_kg)
    `)
    .eq('finished_sku_id', sku_id)
    .eq('status', 'active')
    .order('step_order', { ascending: true });

  if (bomError) {
    console.error('Error fetching BOM:', bomError);
    return null;
  }

  if (!bomRecords || bomRecords.length === 0) {
    // No BOM found - return empty result
    return {
      sku_id,
      sku_name: sku.sku_name,
      production_qty: quantity,
      bom_id: undefined,
      materials: [],
      total_materials_count: 0,
      has_shortage: false,
      shortage_count: 0,
    };
  }

  // 3. Get material SKU IDs for stock lookup
  const materialSkuIds = bomRecords.map(b => b.material_sku_id);

  // 4. Get current stock for materials
  const { data: stockData } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, total_piece_qty')
    .in('sku_id', materialSkuIds);

  // Aggregate stock by SKU
  const stockBySkuId: Record<string, number> = {};
  (stockData || []).forEach(s => {
    stockBySkuId[s.sku_id] = (stockBySkuId[s.sku_id] || 0) + Number(s.total_piece_qty || 0);
  });

  // 5. Get allocated stock (from existing material_requirements with status 'allocated')
  const { data: allocatedData } = await supabase
    .from('material_requirements')
    .select('material_sku_id, allocated_stock')
    .in('material_sku_id', materialSkuIds)
    .eq('status', 'allocated');

  const allocatedBySkuId: Record<string, number> = {};
  (allocatedData || []).forEach(a => {
    allocatedBySkuId[a.material_sku_id] = (allocatedBySkuId[a.material_sku_id] || 0) + Number(a.allocated_stock || 0);
  });

  // 6. Calculate requirements for each material
  // Get FG weight per piece for food material calculation
  const fgWeightPerPiece = Number(sku.weight_per_piece_kg || 0);
  
  const materials: CalculatedMaterial[] = bomRecords.map(bom => {
    const qtyPerUnit = Number(bom.material_qty || 0);
    const wastePerUnit = Number(bom.waste_qty || 0);
    
    // Check if this is a food material (00-*)
    const isFoodMaterial = bom.material_sku_id.startsWith('00-');
    let materialUom = bom.material_uom;
    let grossRequirement: number;

    if (isFoodMaterial) {
      // For food materials: requirement = FG qty × FG weight per piece (in kg)
      // Example: 6,000 bags FG × 4 kg/bag = 24,000 kg food needed
      grossRequirement = Math.ceil(quantity * fgWeightPerPiece);
      materialUom = 'กก.'; // kg
    } else {
      // For other materials: use BOM material_qty
      grossRequirement = Math.ceil(quantity * (qtyPerUnit + wastePerUnit));
    }

    const currentStock = stockBySkuId[bom.material_sku_id] || 0;
    const allocatedStock = allocatedBySkuId[bom.material_sku_id] || 0;
    
    // For food materials, convert stock from bags to kg for comparison
    let availableStockDisplay = Math.max(0, currentStock - allocatedStock);
    let currentStockDisplay = currentStock;
    
    if (isFoodMaterial) {
      // Food stock is stored in bags, convert to kg for display
      const materialWeightPerBag = Number(bom.material_sku?.weight_per_piece_kg || 0);
      if (materialWeightPerBag > 0) {
        availableStockDisplay = Math.max(0, (currentStock - allocatedStock) * materialWeightPerBag);
        currentStockDisplay = currentStock * materialWeightPerBag;
      }
    }
    
    const netRequirement = Math.max(0, grossRequirement - availableStockDisplay);
    const shortageQty = netRequirement;

    return {
      bom_id: bom.bom_id,
      material_sku_id: bom.material_sku_id,
      material_name: bom.material_sku?.sku_name || bom.material_sku_id,
      material_uom: materialUom,
      qty_per_unit: qtyPerUnit,
      waste_per_unit: wastePerUnit,
      step_order: bom.step_order,
      step_name: bom.step_name,
      gross_requirement: grossRequirement,
      current_stock: currentStockDisplay,
      allocated_stock: allocatedStock,
      available_stock: availableStockDisplay,
      net_requirement: netRequirement,
      shortage_qty: shortageQty,
      has_shortage: shortageQty > 0,
    };
  });

  const shortageCount = materials.filter(m => m.has_shortage).length;

  return {
    sku_id,
    sku_name: sku.sku_name,
    production_qty: quantity,
    bom_id: bomRecords[0]?.bom_id,
    materials,
    total_materials_count: materials.length,
    has_shortage: shortageCount > 0,
    shortage_count: shortageCount,
  };
}

/**
 * Create a new production plan
 */
export async function createProductionPlan(
  input: CreateProductionPlanInput,
  userId?: number
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  try {
    // 1. Generate plan number
    const planNo = await generatePlanNo();

    // 2. Create plan header
    const { data: plan, error: planError } = await supabase
      .from('production_plan')
      .insert({
        plan_no: planNo,
        plan_name: input.plan_name,
        plan_description: input.plan_description,
        plan_start_date: input.plan_start_date,
        plan_end_date: input.plan_end_date,
        warehouse_id: input.warehouse_id,
        production_area_id: input.production_area_id,
        priority: input.priority || 5,
        status: 'draft',
        total_products_planned: input.items.length,
        created_by: userId,
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error('Error creating production plan:', planError);
      throw new Error('Failed to create production plan');
    }

    // 3. Create plan items
    const planItems = input.items.map(item => ({
      plan_id: plan.plan_id,
      sku_id: item.sku_id,
      required_qty: item.required_qty,
      scheduled_start_date: item.scheduled_start_date || input.plan_start_date,
      scheduled_end_date: item.scheduled_end_date || input.plan_end_date,
      notes: item.notes,
      status: 'planned',
    }));

    const { data: items, error: itemsError } = await supabase
      .from('production_plan_items')
      .insert(planItems)
      .select();

    if (itemsError) {
      console.error('Error creating plan items:', itemsError);
      // Rollback - delete the plan
      await supabase.from('production_plan').delete().eq('plan_id', plan.plan_id);
      throw new Error('Failed to create plan items');
    }

    // 4. Calculate and create material requirements for each item
    let totalMaterialsRequired = 0;
    let totalShortageItems = 0;

    for (let i = 0; i < (items || []).length; i++) {
      const item = items![i];
      const inputItem = input.items[i];
      
      const bomResult = await calculateBomRequirements({
        sku_id: item.sku_id,
        quantity: item.required_qty,
      });

      if (bomResult && bomResult.materials.length > 0) {
        // Filter materials based on user selection (if provided)
        let filteredMaterials = bomResult.materials;
        
        if (inputItem.selected_materials && inputItem.selected_materials.length > 0) {
          // User selected specific materials - only include those
          const selectedSkuIds = new Set(
            inputItem.selected_materials
              .filter(m => m.include)
              .map(m => m.material_sku_id)
          );
          filteredMaterials = bomResult.materials.filter(mat => 
            selectedSkuIds.has(mat.material_sku_id)
          );
        }
        
        if (filteredMaterials.length > 0) {
          // Note: available_stock, net_requirement, shortage_qty are generated columns
          // so we don't include them in the insert
          const materialReqs = filteredMaterials.map(mat => ({
            plan_id: plan.plan_id,
            plan_item_id: item.plan_item_id,
            material_sku_id: mat.material_sku_id,
            finished_sku_id: item.sku_id,
            bom_id: mat.bom_id,
            material_qty_per_unit: mat.qty_per_unit,
            waste_qty_per_unit: mat.waste_per_unit,
            production_qty: item.required_qty,
            gross_requirement: mat.gross_requirement,
            current_stock: mat.current_stock,
            allocated_stock: mat.allocated_stock,
            material_uom: mat.material_uom,
            status: 'needed',
          }));

          await supabase.from('material_requirements').insert(materialReqs);

          totalMaterialsRequired += filteredMaterials.length;
          totalShortageItems += filteredMaterials.filter(m => m.has_shortage).length;
        }
      }
    }

    // 5. Update plan totals
    await supabase
      .from('production_plan')
      .update({
        total_materials_required: totalMaterialsRequired,
        total_shortage_items: totalShortageItems,
      })
      .eq('plan_id', plan.plan_id);

    // 6. Return complete plan
    return await getProductionPlanById(plan.plan_id);
  } catch (error) {
    console.error('Error in createProductionPlan:', error);
    throw error;
  }
}


/**
 * Update production plan
 */
export async function updateProductionPlan(
  input: UpdateProductionPlanInput,
  userId?: number
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  const { plan_id, ...updateData } = input;

  const { error } = await supabase
    .from('production_plan')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', plan_id);

  if (error) {
    console.error('Error updating production plan:', error);
    throw new Error('Failed to update production plan');
  }

  return await getProductionPlanById(plan_id);
}

/**
 * Delete production plan
 */
export async function deleteProductionPlan(planId: string): Promise<boolean> {
  const supabase = await createClient();

  // Delete material requirements first
  await supabase
    .from('material_requirements')
    .delete()
    .eq('plan_id', planId);

  // Delete plan items
  await supabase
    .from('production_plan_items')
    .delete()
    .eq('plan_id', planId);

  // Delete plan
  const { error } = await supabase
    .from('production_plan')
    .delete()
    .eq('plan_id', planId);

  if (error) {
    console.error('Error deleting production plan:', error);
    return false;
  }

  return true;
}

/**
 * Approve production plan
 */
export async function approveProductionPlan(
  planId: string,
  userId: number
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_plan')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId)
    .eq('status', 'draft');

  if (error) {
    console.error('Error approving production plan:', error);
    throw new Error('Failed to approve production plan');
  }

  return await getProductionPlanById(planId);
}

/**
 * Start production (change status to in_production)
 */
export async function startProduction(
  planId: string
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  // Update plan status
  const { error: planError } = await supabase
    .from('production_plan')
    .update({
      status: 'in_production',
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId)
    .eq('status', 'approved');

  if (planError) {
    console.error('Error starting production:', planError);
    throw new Error('Failed to start production');
  }

  // Update all items to in_progress
  await supabase
    .from('production_plan_items')
    .update({
      status: 'in_progress',
      actual_start_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId)
    .eq('status', 'planned');

  return await getProductionPlanById(planId);
}

/**
 * Complete production plan
 */
export async function completeProductionPlan(
  planId: string
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_plan')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId);

  if (error) {
    console.error('Error completing production plan:', error);
    throw new Error('Failed to complete production plan');
  }

  // Update all items to completed
  await supabase
    .from('production_plan_items')
    .update({
      status: 'completed',
      actual_end_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId);

  return await getProductionPlanById(planId);
}

/**
 * Cancel production plan
 */
export async function cancelProductionPlan(
  planId: string
): Promise<ProductionPlanWithItems | null> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('production_plan')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId);

  if (error) {
    console.error('Error cancelling production plan:', error);
    throw new Error('Failed to cancel production plan');
  }

  // Update all items to cancelled
  await supabase
    .from('production_plan_items')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId);

  // Update material requirements to cancelled
  await supabase
    .from('material_requirements')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('plan_id', planId);

  return await getProductionPlanById(planId);
}

/**
 * Get SKUs with BOM for production planning
 */
export async function getSkusWithBom(): Promise<{ sku_id: string; sku_name: string; has_bom: boolean }[]> {
  const supabase = await createClient();

  // Get all SKUs that have BOM records
  const { data: bomSkus } = await supabase
    .from('bom_sku')
    .select('finished_sku_id')
    .eq('status', 'active');

  const skuIdsWithBom = [...new Set((bomSkus || []).map(b => b.finished_sku_id))];

  if (skuIdsWithBom.length === 0) {
    return [];
  }

  // Get SKU details
  const { data: skus } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name')
    .in('sku_id', skuIdsWithBom)
    .order('sku_name');

  return (skus || []).map(s => ({
    sku_id: s.sku_id,
    sku_name: s.sku_name,
    has_bom: true,
  }));
}


/**
 * Recalculate and populate material requirements for an existing plan
 * คำนวณและเติมข้อมูลวัตถุดิบที่ต้องใช้สำหรับแผนที่มีอยู่แล้ว
 */
export async function recalculateMaterialRequirements(
  planId: string
): Promise<{ success: boolean; materialsCount: number; shortageCount: number }> {
  const supabase = await createClient();

  try {
    // 1. Get plan items
    const { data: items, error: itemsError } = await supabase
      .from('production_plan_items')
      .select('plan_item_id, sku_id, required_qty')
      .eq('plan_id', planId);

    if (itemsError || !items || items.length === 0) {
      console.error('No items found for plan:', planId);
      return { success: false, materialsCount: 0, shortageCount: 0 };
    }

    // 2. Delete existing material requirements for this plan
    await supabase
      .from('material_requirements')
      .delete()
      .eq('plan_id', planId);

    // 3. Calculate and create material requirements for each item
    let totalMaterialsRequired = 0;
    let totalShortageItems = 0;

    for (const item of items) {
      const bomResult = await calculateBomRequirements({
        sku_id: item.sku_id,
        quantity: Number(item.required_qty),
      });

      if (bomResult && bomResult.materials.length > 0) {
        // Note: available_stock, net_requirement, shortage_qty are generated columns
        // so we don't include them in the insert
        const materialReqs = bomResult.materials.map(mat => ({
          plan_id: planId,
          plan_item_id: item.plan_item_id,
          material_sku_id: mat.material_sku_id,
          finished_sku_id: item.sku_id,
          bom_id: mat.bom_id,
          material_qty_per_unit: mat.qty_per_unit,
          waste_qty_per_unit: mat.waste_per_unit,
          production_qty: Number(item.required_qty),
          gross_requirement: mat.gross_requirement,
          current_stock: mat.current_stock,
          allocated_stock: mat.allocated_stock,
          material_uom: mat.material_uom,
          status: 'needed',
        }));

        const { error: insertError } = await supabase
          .from('material_requirements')
          .insert(materialReqs);

        if (insertError) {
          console.error('Error inserting material requirements:', insertError);
        } else {
          totalMaterialsRequired += bomResult.materials.length;
          totalShortageItems += bomResult.shortage_count;
        }
      }
    }

    // 4. Update plan totals
    await supabase
      .from('production_plan')
      .update({
        total_materials_required: totalMaterialsRequired,
        total_shortage_items: totalShortageItems,
        updated_at: new Date().toISOString(),
      })
      .eq('plan_id', planId);

    return {
      success: true,
      materialsCount: totalMaterialsRequired,
      shortageCount: totalShortageItems,
    };
  } catch (error) {
    console.error('Error in recalculateMaterialRequirements:', error);
    return { success: false, materialsCount: 0, shortageCount: 0 };
  }
}
