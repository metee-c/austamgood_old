/**
 * Centralized Inventory Transaction Service
 *
 * ALL inventory stock movements MUST go through this service.
 * This replaces the trigger-based approach where:
 *   INSERT ledger → trigger syncs balance
 *
 * New approach:
 *   API calls executeStockMovements() → RPC does ledger + balance atomically
 *
 * Principles:
 *   - Backend = Business Logic + State Machine
 *   - Database = Source of Truth (store data only)
 *   - Triggers = NEVER for inventory qty changes
 */

import { createServiceRoleClient } from '@/lib/supabase/server'

// ============================================================
// Types
// ============================================================

export interface StockMovement {
  direction: 'in' | 'out'
  warehouse_id: string
  location_id: string
  sku_id: string
  pallet_id?: string | null
  pallet_id_external?: string | null
  production_date?: string | null
  expiry_date?: string | null
  lot_no?: string | null
  pack_qty: number
  piece_qty: number
  transaction_type: string
  reference_no?: string | null
  reference_doc_type?: string | null
  reference_doc_id?: number | string | null
  receive_item_id?: number | string | null
  move_item_id?: number | string | null
  order_id?: number | string | null
  order_item_id?: number | string | null
  remarks?: string | null
  created_by?: number | string | null
  movement_at?: string | null
}

export interface MovementResult {
  success: boolean
  entries: Array<{ ledger_id: number; balance_id: number }>
  error?: string
}

export interface Unreservation {
  balance_id: number
  piece_qty: number
  pack_qty: number
}

// ============================================================
// Core Function: executeStockMovements
// ============================================================

/**
 * Execute inventory movements atomically via RPC.
 * Creates ledger entries (skip_balance_sync=true) AND updates balances
 * in a single database transaction.
 *
 * @param movements - Array of stock movements (IN/OUT)
 * @param unreservations - Optional array of balance unreservations (atomic with movements)
 * @returns MovementResult with ledger_ids and balance_ids
 */
export async function executeStockMovements(
  movements: StockMovement[],
  unreservations?: Unreservation[]
): Promise<MovementResult> {
  if (movements.length === 0 && (!unreservations || unreservations.length === 0)) {
    return { success: true, entries: [] }
  }

  const supabase = createServiceRoleClient()

  // Clean up movements: convert numbers to strings for jsonb, remove undefined
  const cleanMovements = movements.map(m => ({
    direction: m.direction,
    warehouse_id: m.warehouse_id,
    location_id: m.location_id,
    sku_id: m.sku_id,
    pallet_id: m.pallet_id || null,
    pallet_id_external: m.pallet_id_external || null,
    production_date: m.production_date || null,
    expiry_date: m.expiry_date || null,
    lot_no: m.lot_no || null,
    pack_qty: Number(m.pack_qty) || 0,
    piece_qty: Number(m.piece_qty) || 0,
    transaction_type: m.transaction_type,
    reference_no: m.reference_no || null,
    reference_doc_type: m.reference_doc_type || null,
    reference_doc_id: m.reference_doc_id ? String(m.reference_doc_id) : null,
    receive_item_id: m.receive_item_id ? String(m.receive_item_id) : null,
    move_item_id: m.move_item_id ? String(m.move_item_id) : null,
    order_id: m.order_id ? String(m.order_id) : null,
    order_item_id: m.order_item_id ? String(m.order_item_id) : null,
    remarks: m.remarks || null,
    created_by: m.created_by ? String(m.created_by) : null,
    movement_at: m.movement_at || null,
  }))

  const rpcParams: { p_movements: any; p_unreservations?: any } = {
    p_movements: cleanMovements
  }

  if (unreservations && unreservations.length > 0) {
    rpcParams.p_unreservations = unreservations.map(u => ({
      balance_id: Number(u.balance_id),
      piece_qty: Number(u.piece_qty) || 0,
      pack_qty: Number(u.pack_qty) || 0,
    }))
  }

  const { data, error } = await supabase.rpc('execute_inventory_movements', rpcParams)

  if (error) {
    console.error('[InventoryTransaction] RPC error:', error)
    return { success: false, entries: [], error: error.message }
  }

  return {
    success: data?.success ?? false,
    entries: data?.entries ?? [],
    error: data?.success ? undefined : 'RPC returned unsuccessful'
  }
}

// ============================================================
// Convenience: Goods Receipt (IN)
// ============================================================

/**
 * Record goods receipt - adds stock to a location.
 * Used by: Receiving operations
 */
export async function goodsReceiptIn(params: {
  warehouse_id: string
  location_id: string
  sku_id: string
  pallet_id?: string | null
  pallet_id_external?: string | null
  production_date?: string | null
  expiry_date?: string | null
  lot_no?: string | null
  pack_qty: number
  piece_qty: number
  reference_no: string
  reference_doc_type?: string
  reference_doc_id?: number | null
  receive_item_id?: number | null
  created_by?: number | null
  remarks?: string | null
}): Promise<MovementResult> {
  return executeStockMovements([{
    direction: 'in',
    transaction_type: 'receive',
    reference_doc_type: params.reference_doc_type || 'receive',
    ...params,
  }])
}

// ============================================================
// Convenience: Dual-Entry Stock Transfer (OUT + IN)
// ============================================================

/**
 * Transfer stock between locations using dual-entry pattern.
 * Creates OUT from source + IN to destination atomically.
 * Used by: Move/Transfer operations
 */
export async function stockTransfer(params: {
  warehouse_id: string
  from_location_id: string
  to_location_id: string
  sku_id: string
  pallet_id?: string | null
  out_pallet_id?: string | null  // For partial pallet moves (parent_pallet_id)
  in_pallet_id?: string | null   // For partial pallet moves (new pallet_id)
  pallet_id_external?: string | null
  production_date?: string | null
  expiry_date?: string | null
  lot_no?: string | null
  pack_qty: number
  piece_qty: number
  reference_no: string
  transaction_type?: string
  reference_doc_type?: string
  reference_doc_id?: number | null
  move_item_id?: number | null
  receive_item_id?: number | null
  created_by?: number | null
  remarks?: string | null
}): Promise<MovementResult> {
  const txType = params.transaction_type || 'transfer'
  const docType = params.reference_doc_type || 'move'
  const outPalletId = params.out_pallet_id || params.pallet_id
  const inPalletId = params.in_pallet_id || params.pallet_id

  const movements: StockMovement[] = []

  // OUT from source location
  if (params.from_location_id) {
    movements.push({
      direction: 'out',
      warehouse_id: params.warehouse_id,
      location_id: params.from_location_id,
      sku_id: params.sku_id,
      pallet_id: outPalletId,
      pallet_id_external: params.pallet_id_external,
      production_date: params.production_date,
      expiry_date: params.expiry_date,
      lot_no: params.lot_no,
      pack_qty: params.pack_qty,
      piece_qty: params.piece_qty,
      transaction_type: txType,
      reference_no: params.reference_no,
      reference_doc_type: docType,
      reference_doc_id: params.reference_doc_id,
      move_item_id: params.move_item_id,
      receive_item_id: params.receive_item_id,
      created_by: params.created_by,
      remarks: params.remarks,
    })
  }

  // IN to destination location
  if (params.to_location_id) {
    movements.push({
      direction: 'in',
      warehouse_id: params.warehouse_id,
      location_id: params.to_location_id,
      sku_id: params.sku_id,
      pallet_id: inPalletId,
      pallet_id_external: params.pallet_id_external,
      production_date: params.production_date,
      expiry_date: params.expiry_date,
      lot_no: params.lot_no,
      pack_qty: params.pack_qty,
      piece_qty: params.piece_qty,
      transaction_type: txType,
      reference_no: params.reference_no,
      reference_doc_type: docType,
      reference_doc_id: params.reference_doc_id,
      move_item_id: params.move_item_id,
      receive_item_id: params.receive_item_id,
      created_by: params.created_by,
      remarks: params.remarks,
    })
  }

  return executeStockMovements(movements)
}

// ============================================================
// Convenience: Stock Adjustment
// ============================================================

/**
 * Record stock adjustment (increase or decrease).
 * For decrease: creates OUT from location + IN to ADJ-LOSS virtual location
 * For increase: creates IN to location
 * Used by: Stock Adjustment operations
 */
export async function stockAdjustment(params: {
  adjustment_type: 'increase' | 'decrease'
  warehouse_id: string
  location_id: string
  sku_id: string
  pallet_id?: string | null
  pallet_id_external?: string | null
  production_date?: string | null
  expiry_date?: string | null
  lot_no?: string | null
  pack_qty: number
  piece_qty: number
  reference_no: string
  reference_doc_id?: number | null
  created_by?: number | null
  remarks?: string | null
  adj_loss_location?: string
}): Promise<MovementResult> {
  const movements: StockMovement[] = []

  if (params.adjustment_type === 'decrease') {
    // OUT from source location
    movements.push({
      direction: 'out',
      warehouse_id: params.warehouse_id,
      location_id: params.location_id,
      sku_id: params.sku_id,
      pallet_id: params.pallet_id,
      pallet_id_external: params.pallet_id_external,
      production_date: params.production_date,
      expiry_date: params.expiry_date,
      lot_no: params.lot_no,
      pack_qty: params.pack_qty,
      piece_qty: params.piece_qty,
      transaction_type: 'adjustment',
      reference_no: params.reference_no,
      reference_doc_type: 'adjustment',
      reference_doc_id: params.reference_doc_id,
      created_by: params.created_by,
      remarks: params.remarks,
    })
    // IN to ADJ-LOSS virtual location
    movements.push({
      direction: 'in',
      warehouse_id: params.warehouse_id,
      location_id: params.adj_loss_location || 'ADJ-LOSS-001',
      sku_id: params.sku_id,
      production_date: params.production_date,
      expiry_date: params.expiry_date,
      pack_qty: params.pack_qty,
      piece_qty: params.piece_qty,
      transaction_type: 'adjustment',
      reference_no: params.reference_no,
      reference_doc_type: 'adjustment',
      reference_doc_id: params.reference_doc_id,
      created_by: params.created_by,
      remarks: `รับจาก ${params.location_id}: ${params.remarks || ''}`.trim(),
    })
  } else {
    // Increase: IN to location
    movements.push({
      direction: 'in',
      warehouse_id: params.warehouse_id,
      location_id: params.location_id,
      sku_id: params.sku_id,
      pallet_id: params.pallet_id,
      pallet_id_external: params.pallet_id_external,
      production_date: params.production_date,
      expiry_date: params.expiry_date,
      lot_no: params.lot_no,
      pack_qty: params.pack_qty,
      piece_qty: params.piece_qty,
      transaction_type: 'adjustment',
      reference_no: params.reference_no,
      reference_doc_type: 'adjustment',
      reference_doc_id: params.reference_doc_id,
      created_by: params.created_by,
      remarks: params.remarks,
    })
  }

  return executeStockMovements(movements)
}

// ============================================================
// Convenience: Cleanup Receive Inventory (for delete)
// ============================================================

/**
 * Reverse all inventory entries for a receive document.
 * Creates reversal OUT entries for each IN entry.
 * Used by: Receive DELETE operations
 */
export async function cleanupReceiveInventory(params: {
  receive_id: number
  supabase?: any // Optional: pass existing client
}): Promise<MovementResult> {
  const supabase = params.supabase || createServiceRoleClient()

  // Find all IN ledger entries for this receive
  const { data: ledgerEntries, error: queryError } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .eq('reference_doc_type', 'receive')
    .eq('reference_doc_id', params.receive_id)
    .eq('direction', 'in')

  if (queryError) {
    console.error('[InventoryTransaction] Query ledger entries error:', queryError)
    return { success: false, entries: [], error: queryError.message }
  }

  if (!ledgerEntries || ledgerEntries.length === 0) {
    return { success: true, entries: [] }
  }

  // Create reversal movements (OUT for each IN)
  const reversalMovements: StockMovement[] = ledgerEntries.map((entry: any) => ({
    direction: 'out' as const,
    warehouse_id: entry.warehouse_id,
    location_id: entry.location_id,
    sku_id: entry.sku_id,
    pallet_id: entry.pallet_id,
    pallet_id_external: entry.pallet_id_external,
    production_date: entry.production_date,
    expiry_date: entry.expiry_date,
    pack_qty: entry.pack_qty,
    piece_qty: entry.piece_qty,
    transaction_type: 'receive_reversal',
    reference_no: entry.reference_no,
    reference_doc_type: 'receive',
    reference_doc_id: entry.reference_doc_id,
    receive_item_id: entry.receive_item_id,
    remarks: `Reversal of receive #${params.receive_id}`,
    created_by: entry.created_by,
  }))

  const result = await executeStockMovements(reversalMovements)

  if (result.success) {
    // Delete ALL ledger entries for this receive (original + reversals)
    // Balances are already corrected by the reversal movements above
    const { error: deleteError } = await supabase
      .from('wms_inventory_ledger')
      .delete()
      .eq('reference_doc_type', 'receive')
      .eq('reference_doc_id', params.receive_id)

    if (deleteError) {
      console.error('[InventoryTransaction] Delete ledger entries error:', deleteError)
    }
  }

  return result
}

// ============================================================
// Convenience: Stock Import (single entry)
// ============================================================

/**
 * Record stock import - adds stock from legacy system.
 * Replaces the old pattern of upsertBalance + insertLedger (double-count bug)
 * Used by: Stock Import operations
 */
export async function stockImportIn(params: {
  warehouse_id: string
  location_id: string
  sku_id: string
  pallet_id?: string | null
  pallet_id_external?: string | null
  production_date?: string | null
  expiry_date?: string | null
  lot_no?: string | null
  pack_qty: number
  piece_qty: number
  reference_no: string
  created_by?: number | null
  remarks?: string | null
}): Promise<MovementResult> {
  return executeStockMovements([{
    direction: 'in',
    transaction_type: 'import',
    reference_doc_type: 'stock_import',
    ...params,
  }])
}

// ============================================================
// Convenience: Production Material Consumption
// ============================================================

/**
 * Consume materials when production receive is created.
 * Replaces trigger: trg_consume_materials_on_production_receive
 *
 * Creates OUT ledger entries from 'Repack' for each material used in production.
 * Also updates production_receipt_materials with traceability data.
 */
export async function consumeProductionMaterials(params: {
  receive_id: number
  warehouse_id: string
  production_order_id: string
  created_by?: number | null
}): Promise<MovementResult> {
  const supabase = createServiceRoleClient()

  // Dedup check: if production_receipt_materials already has pallet_id set,
  // it means materials were already consumed (pallet_id is set during consumption)
  const { data: receiptForDedup } = await supabase
    .from('production_receipts')
    .select('id')
    .eq('production_order_id', params.production_order_id)
    .order('received_at', { ascending: false })
    .limit(1)
    .single()

  if (receiptForDedup) {
    const { data: alreadyConsumed } = await supabase
      .from('production_receipt_materials')
      .select('id')
      .eq('receipt_id', receiptForDedup.id)
      .not('pallet_id', 'is', null)
      .limit(1)

    if (alreadyConsumed && alreadyConsumed.length > 0) {
      console.log('[InventoryTransaction] Materials already consumed for receipt:', receiptForDedup.id)
      return { success: true, entries: [] }
    }
  }

  // Get production_no
  const { data: prodOrder, error: prodError } = await supabase
    .from('production_orders')
    .select('production_no')
    .eq('id', params.production_order_id)
    .single()

  if (prodError || !prodOrder) {
    console.error('[InventoryTransaction] Production order not found:', prodError)
    return { success: true, entries: [] } // Skip silently like trigger
  }

  // Get latest production receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('production_receipts')
    .select('id')
    .eq('production_order_id', params.production_order_id)
    .order('received_at', { ascending: false })
    .limit(1)
    .single()

  if (receiptError || !receipt) {
    console.error('[InventoryTransaction] No production receipt found:', receiptError)
    return { success: true, entries: [] }
  }

  // Get materials from production_receipt_materials
  const { data: materials, error: matError } = await supabase
    .from('production_receipt_materials')
    .select('id, material_sku_id, issued_qty, actual_qty, uom')
    .eq('receipt_id', receipt.id)

  if (matError || !materials || materials.length === 0) {
    return { success: true, entries: [] }
  }

  // Get qty_per_pack from master_sku
  const skuIds = materials.map(m => m.material_sku_id)
  const { data: skuData } = await supabase
    .from('master_sku')
    .select('sku_id, qty_per_pack')
    .in('sku_id', skuIds)

  const skuMap = new Map((skuData || []).map(s => [s.sku_id, s.qty_per_pack || 0]))
  const repackLocation = 'Repack'
  const movements: StockMovement[] = []

  for (const material of materials) {
    const isFood = material.material_sku_id.startsWith('00-')
    const qtyToConsume = isFood
      ? (material.actual_qty || 0)
      : (material.issued_qty || 0)

    if (qtyToConsume <= 0) continue

    // Look up pallet and traceability from replenishment_queue
    const { data: repQueue } = await supabase
      .from('replenishment_queue')
      .select('pallet_id, expiry_date')
      .eq('trigger_source', 'production_order')
      .eq('trigger_reference', prodOrder.production_no)
      .eq('sku_id', material.material_sku_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    let palletId = repQueue?.[0]?.pallet_id || null
    let expiryDate = repQueue?.[0]?.expiry_date || null
    let productionDate: string | null = null
    let palletIdExternal: string | null = null

    // Look up production_date and pallet_id_external from balance
    if (palletId) {
      const { data: balance } = await supabase
        .from('wms_inventory_balances')
        .select('production_date, pallet_id_external')
        .eq('location_id', repackLocation)
        .eq('sku_id', material.material_sku_id)
        .eq('pallet_id', palletId)
        .limit(1)

      productionDate = balance?.[0]?.production_date || null
      palletIdExternal = balance?.[0]?.pallet_id_external || null
    } else {
      const { data: balance } = await supabase
        .from('wms_inventory_balances')
        .select('production_date, pallet_id_external')
        .eq('location_id', repackLocation)
        .eq('sku_id', material.material_sku_id)
        .is('pallet_id', null)
        .limit(1)

      productionDate = balance?.[0]?.production_date || null
      palletIdExternal = balance?.[0]?.pallet_id_external || null
    }

    // Update traceability data on production_receipt_materials
    await supabase
      .from('production_receipt_materials')
      .update({
        pallet_id: palletId,
        material_production_date: productionDate,
        material_expiry_date: expiryDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', material.id)

    const qtyPerPack = skuMap.get(material.material_sku_id) || 0

    movements.push({
      direction: 'out',
      warehouse_id: params.warehouse_id,
      location_id: repackLocation,
      sku_id: material.material_sku_id,
      pallet_id: palletId,
      pallet_id_external: palletIdExternal,
      production_date: productionDate,
      expiry_date: expiryDate,
      pack_qty: qtyPerPack > 0 ? Math.floor(qtyToConsume / qtyPerPack) : 0,
      piece_qty: qtyToConsume,
      transaction_type: 'production_consume',
      reference_no: `PROD-${prodOrder.production_no}`,
      reference_doc_type: 'production_order',
      created_by: params.created_by,
      remarks: isFood
        ? `ตัดวัตถุดิบอาหาร (ใช้จริง) สำหรับการผลิต ${prodOrder.production_no}`
        : `ตัดวัสดุบรรจุภัณฑ์ (ตาม BOM) สำหรับการผลิต ${prodOrder.production_no}`,
    })
  }

  if (movements.length === 0) {
    return { success: true, entries: [] }
  }

  return executeStockMovements(movements)
}
