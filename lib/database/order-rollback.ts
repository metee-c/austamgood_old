/**
 * Order Rollback Service
 * 
 * Service สำหรับ Partial Rollback Order กลับไปสถานะ Draft
 * รองรับ BRCGS Audit Trail และ Reverse Ledger Pattern
 */

import { createServiceRoleClient } from '@/lib/supabase/server';

// Use service role client for admin operations (bypasses RLS)
// This is intentional for rollback operations that need full access
const supabase = createServiceRoleClient();

// ============================================================================
// Debug Logger
// ============================================================================
const DEBUG_ROLLBACK = true; // เปิด/ปิด debug logs

function debugLog(context: string, message: string, data?: any) {
  if (!DEBUG_ROLLBACK) return;
  const timestamp = new Date().toISOString();
  console.log(`[ROLLBACK-DEBUG][${timestamp}][${context}] ${message}`);
  if (data !== undefined) {
    console.log(`[ROLLBACK-DEBUG][${timestamp}][${context}] Data:`, JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// Types
// ============================================================================

export interface RollbackPreview {
  orderId: number;
  orderNo: string;
  currentStatus: string;
  canRollback: boolean;
  blockingReason?: string;
  affectedDocuments: {
    picklists: { id: number; code: string; itemCount: number }[];
    faceSheets: { id: number; code: string; itemCount: number }[];
    bonusFaceSheets: { id: number; code: string; itemCount: number }[];
    loadlists: { id: number; code: string; itemCount: number }[];
    routeStops: { stopId: number; tripId: number }[];
  };
  stockToRestore: {
    skuId: string;
    skuName: string;
    quantity: number;
    fromLocation: string;
    toLocation: string;
  }[];
  reservationsToRelease: number;
  warnings: string[];
}

export interface RollbackResult {
  success: boolean;
  orderId: number;
  orderNo: string;
  previousStatus: string;
  newStatus: string;
  summary: {
    picklistItemsVoided: number;
    faceSheetItemsVoided: number;
    bonusFaceSheetItemsVoided: number;
    loadlistItemsRemoved: number;
    routeStopsRemoved: number;
    reservationsReleased: number;
    ledgerEntriesCreated: number;
    stockMovements: {
      skuId: string;
      fromLocation: string;
      toLocation: string;
      quantity: number;
    }[];
    documentsVoided: {
      picklists: number;
      faceSheets: number;
      bonusFaceSheets: number;
      loadlists: number;
    };
  };
  auditLogId: number;
  durationMs: number;
  error?: string;
}

export interface RollbackOptions {
  orderId: number;
  userId: number;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RollbackHistoryItem {
  log_id: number;
  action: string;
  user_id: number;
  reason: string;
  previous_status: string;
  new_status: string;
  affected_documents: any;
  rollback_summary: any;
  created_at: string;
  user_name?: string;
}

// ============================================================================
// Order Rollback Service Class
// ============================================================================

class OrderRollbackService {
  private supabase = supabase;

  // ==========================================================================
  // Preview Rollback Impact
  // ==========================================================================

  /**
   * ดึงข้อมูล Preview ก่อนทำ Rollback
   * แสดงผลกระทบที่จะเกิดขึ้นโดยไม่ execute จริง
   */
  async getRollbackPreview(orderId: number): Promise<{ data: RollbackPreview | null; error: string | null }> {
    debugLog('getRollbackPreview', `=== START getRollbackPreview for orderId: ${orderId} ===`);
    
    try {
      // 1. ดึงข้อมูล Order
      debugLog('getRollbackPreview', 'Step 1: Fetching order data...');
      const { data: order, error: orderError } = await this.supabase
        .from('wms_orders')
        .select('order_id, order_no, status, rollback_lock_at, rollback_lock_expires_at, rollback_lock_by')
        .eq('order_id', orderId)
        .single();

      debugLog('getRollbackPreview', 'Order query result:', { order, orderError });

      if (orderError || !order) {
        debugLog('getRollbackPreview', 'ERROR: Order not found', { orderError });
        return { data: null, error: 'ไม่พบ Order' };
      }

      const preview: RollbackPreview = {
        orderId: order.order_id,
        orderNo: order.order_no,
        currentStatus: order.status,
        canRollback: true,
        affectedDocuments: {
          picklists: [],
          faceSheets: [],
          bonusFaceSheets: [],
          loadlists: [],
          routeStops: []
        },
        stockToRestore: [],
        reservationsToRelease: 0,
        warnings: []
      };

      debugLog('getRollbackPreview', 'Initial preview object created:', preview);

      // 2. ตรวจสอบว่าสามารถ Rollback ได้หรือไม่
      debugLog('getRollbackPreview', 'Step 2: Checking if can rollback...', { status: order.status });
      
      if (order.status === 'draft') {
        debugLog('getRollbackPreview', 'BLOCKED: Order already in draft status');
        preview.canRollback = false;
        preview.blockingReason = 'Order อยู่ในสถานะ Draft อยู่แล้ว';
        return { data: preview, error: null };
      }

      if (['in_transit', 'delivered'].includes(order.status)) {
        debugLog('getRollbackPreview', 'BLOCKED: Order in transit or delivered', { status: order.status });
        preview.canRollback = false;
        preview.blockingReason = 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้';
        return { data: preview, error: null };
      }

      // ตรวจสอบ Lock
      if (order.rollback_lock_at && order.rollback_lock_expires_at) {
        const lockExpires = new Date(order.rollback_lock_expires_at);
        debugLog('getRollbackPreview', 'Checking rollback lock...', { 
          lockExpires: lockExpires.toISOString(), 
          now: new Date().toISOString(),
          isLocked: lockExpires > new Date()
        });
        if (lockExpires > new Date()) {
          debugLog('getRollbackPreview', 'BLOCKED: Order is locked by another user');
          preview.canRollback = false;
          preview.blockingReason = 'Order กำลังถูก Rollback โดยผู้ใช้อื่น';
          return { data: preview, error: null };
        }
      }

      // 3. ดึงข้อมูล Picklist Items
      debugLog('getRollbackPreview', 'Step 3: Fetching picklist items...');
      const { data: picklistItems, error: picklistError } = await this.supabase
        .from('picklist_items')
        .select(`
          id, picklist_id, sku_id, quantity_picked, quantity_to_pick, status, source_location_id,
          picklists!inner(id, picklist_code),
          master_sku(sku_name)
        `)
        .eq('order_id', orderId)
        .is('voided_at', null);

      debugLog('getRollbackPreview', 'Picklist items query result:', { 
        count: picklistItems?.length || 0, 
        error: picklistError,
        items: picklistItems 
      });

      if (picklistItems && picklistItems.length > 0) {
        debugLog('getRollbackPreview', `Processing ${picklistItems.length} picklist items...`);
        const picklistMap = new Map<number, { id: number; code: string; itemCount: number }>();
        for (const item of picklistItems) {
          const pl = item.picklists as any;
          if (!picklistMap.has(pl.id)) {
            picklistMap.set(pl.id, { id: pl.id, code: pl.picklist_code, itemCount: 0 });
          }
          picklistMap.get(pl.id)!.itemCount++;

          if (item.status === 'picked' && item.quantity_picked > 0) {
            debugLog('getRollbackPreview', `Adding stock to restore for SKU ${item.sku_id}:`, {
              quantity: item.quantity_picked,
              status: item.status,
              sourceLocation: item.source_location_id
            });
            preview.stockToRestore.push({
              skuId: item.sku_id,
              skuName: (item.master_sku as any)?.sku_name || item.sku_id,
              quantity: item.quantity_picked,
              fromLocation: 'Dispatch',
              toLocation: item.source_location_id || 'Preparation Area'
            });
          }
        }
        preview.affectedDocuments.picklists = Array.from(picklistMap.values());
        debugLog('getRollbackPreview', 'Affected picklists:', preview.affectedDocuments.picklists);
      }

      // 4. ดึงข้อมูล Face Sheet Items
      debugLog('getRollbackPreview', 'Step 4: Fetching face sheet items...');
      const { data: faceSheetItems, error: faceSheetError } = await this.supabase
        .from('face_sheet_items')
        .select(`
          id, face_sheet_id, sku_id, quantity_picked, quantity_to_pick, status, source_location_id,
          face_sheets!inner(id, face_sheet_no),
          master_sku(sku_name)
        `)
        .eq('order_id', orderId)
        .is('voided_at', null);

      debugLog('getRollbackPreview', 'Face sheet items query result:', { 
        count: faceSheetItems?.length || 0, 
        error: faceSheetError,
        items: faceSheetItems 
      });

      if (faceSheetItems && faceSheetItems.length > 0) {
        debugLog('getRollbackPreview', `Processing ${faceSheetItems.length} face sheet items...`);
        const fsMap = new Map<number, { id: number; code: string; itemCount: number }>();
        for (const item of faceSheetItems) {
          const fs = item.face_sheets as any;
          if (!fsMap.has(fs.id)) {
            fsMap.set(fs.id, { id: fs.id, code: fs.face_sheet_no, itemCount: 0 });
          }
          fsMap.get(fs.id)!.itemCount++;

          if (item.status === 'picked' && item.quantity_picked > 0) {
            debugLog('getRollbackPreview', `Adding face sheet stock to restore for SKU ${item.sku_id}:`, {
              quantity: item.quantity_picked,
              status: item.status,
              sourceLocation: item.source_location_id
            });
            preview.stockToRestore.push({
              skuId: item.sku_id,
              skuName: (item.master_sku as any)?.sku_name || item.sku_id,
              quantity: item.quantity_picked,
              fromLocation: 'Dispatch',
              toLocation: item.source_location_id || 'Preparation Area'
            });
          }
        }
        preview.affectedDocuments.faceSheets = Array.from(fsMap.values());
        debugLog('getRollbackPreview', 'Affected face sheets:', preview.affectedDocuments.faceSheets);
      }

      // 5. ดึงข้อมูล Bonus Face Sheet Items
      debugLog('getRollbackPreview', 'Step 5: Fetching bonus face sheet items...');
      const { data: orderItems, error: orderItemsError } = await this.supabase
        .from('wms_order_items')
        .select('order_item_id')
        .eq('order_id', orderId);

      debugLog('getRollbackPreview', 'Order items query result:', { 
        count: orderItems?.length || 0, 
        error: orderItemsError,
        orderItemIds: orderItems?.map(oi => oi.order_item_id)
      });

      if (orderItems && orderItems.length > 0) {
        const orderItemIds = orderItems.map(oi => oi.order_item_id);
        debugLog('getRollbackPreview', 'Fetching bonus face sheet items for order_item_ids:', orderItemIds);
        
        const { data: bonusItems, error: bonusError } = await this.supabase
          .from('bonus_face_sheet_items')
          .select(`
            id, face_sheet_id, sku_id, quantity_picked, quantity_to_pick, status, source_location_id,
            bonus_face_sheets!inner(id, face_sheet_no),
            master_sku(sku_name)
          `)
          .in('order_item_id', orderItemIds)
          .is('voided_at', null);

        debugLog('getRollbackPreview', 'Bonus face sheet items query result:', { 
          count: bonusItems?.length || 0, 
          error: bonusError,
          items: bonusItems 
        });

        if (bonusItems && bonusItems.length > 0) {
          debugLog('getRollbackPreview', `Processing ${bonusItems.length} bonus face sheet items...`);
          const bfsMap = new Map<number, { id: number; code: string; itemCount: number }>();
          for (const item of bonusItems) {
            const bfs = item.bonus_face_sheets as any;
            if (!bfsMap.has(bfs.id)) {
              bfsMap.set(bfs.id, { id: bfs.id, code: bfs.face_sheet_no, itemCount: 0 });
            }
            bfsMap.get(bfs.id)!.itemCount++;

            if (item.status === 'picked' && item.quantity_picked > 0) {
              debugLog('getRollbackPreview', `Adding bonus stock to restore for SKU ${item.sku_id}:`, {
                quantity: item.quantity_picked,
                status: item.status,
                sourceLocation: item.source_location_id
              });
              preview.stockToRestore.push({
                skuId: item.sku_id,
                skuName: (item.master_sku as any)?.sku_name || item.sku_id,
                quantity: item.quantity_picked,
                fromLocation: 'Dispatch',
                toLocation: item.source_location_id || 'Preparation Area'
              });
            }
          }
          preview.affectedDocuments.bonusFaceSheets = Array.from(bfsMap.values());
          debugLog('getRollbackPreview', 'Affected bonus face sheets:', preview.affectedDocuments.bonusFaceSheets);
        }
      }

      // 6. ดึงข้อมูล Loadlist Items
      debugLog('getRollbackPreview', 'Step 6: Fetching loadlist items...');
      const { data: loadlistItems, error: loadlistError } = await this.supabase
        .from('loadlist_items')
        .select(`
          id, loadlist_id,
          loadlists!inner(id, loadlist_code)
        `)
        .eq('order_id', orderId);

      debugLog('getRollbackPreview', 'Loadlist items query result:', { 
        count: loadlistItems?.length || 0, 
        error: loadlistError,
        items: loadlistItems 
      });

      if (loadlistItems && loadlistItems.length > 0) {
        debugLog('getRollbackPreview', `Processing ${loadlistItems.length} loadlist items...`);
        const llMap = new Map<number, { id: number; code: string; itemCount: number }>();
        for (const item of loadlistItems) {
          const ll = item.loadlists as any;
          if (!llMap.has(ll.id)) {
            llMap.set(ll.id, { id: ll.id, code: ll.loadlist_code, itemCount: 0 });
          }
          llMap.get(ll.id)!.itemCount++;
        }
        preview.affectedDocuments.loadlists = Array.from(llMap.values());
        debugLog('getRollbackPreview', 'Affected loadlists:', preview.affectedDocuments.loadlists);
      }

      // 7. ดึงข้อมูล Route Stops
      debugLog('getRollbackPreview', 'Step 7: Fetching route stops...');
      const { data: routeStops, error: routeStopsError } = await this.supabase
        .from('receiving_route_stops')
        .select('stop_id, trip_id')
        .eq('order_id', orderId);

      debugLog('getRollbackPreview', 'Route stops query result:', { 
        count: routeStops?.length || 0, 
        error: routeStopsError,
        stops: routeStops 
      });

      if (routeStops && routeStops.length > 0) {
        preview.affectedDocuments.routeStops = routeStops.map(s => ({
          stopId: s.stop_id,
          tripId: s.trip_id
        }));
        debugLog('getRollbackPreview', 'Affected route stops:', preview.affectedDocuments.routeStops);
      }

      // 8. นับ Reservations ที่ต้อง Release
      debugLog('getRollbackPreview', 'Step 8: Counting reservations to release...');
      
      if (picklistItems) {
        const picklistItemIds = picklistItems.map(pi => pi.id);
        debugLog('getRollbackPreview', 'Checking picklist item reservations for IDs:', picklistItemIds);
        if (picklistItemIds.length > 0) {
          const { count: plResCount, error: plResError } = await this.supabase
            .from('picklist_item_reservations')
            .select('*', { count: 'exact', head: true })
            .in('picklist_item_id', picklistItemIds)
            .eq('status', 'reserved');
          debugLog('getRollbackPreview', 'Picklist reservations count:', { count: plResCount, error: plResError });
          preview.reservationsToRelease += plResCount || 0;
        }
      }

      if (faceSheetItems) {
        const fsItemIds = faceSheetItems.map(fsi => fsi.id);
        debugLog('getRollbackPreview', 'Checking face sheet item reservations for IDs:', fsItemIds);
        if (fsItemIds.length > 0) {
          const { count: fsResCount, error: fsResError } = await this.supabase
            .from('face_sheet_item_reservations')
            .select('*', { count: 'exact', head: true })
            .in('face_sheet_item_id', fsItemIds)
            .eq('status', 'reserved');
          debugLog('getRollbackPreview', 'Face sheet reservations count:', { count: fsResCount, error: fsResError });
          preview.reservationsToRelease += fsResCount || 0;
        }
      }

      debugLog('getRollbackPreview', 'Total reservations to release:', preview.reservationsToRelease);

      // 9. สร้าง Warnings
      debugLog('getRollbackPreview', 'Step 9: Generating warnings...');
      if (preview.stockToRestore.length > 0) {
        preview.warnings.push(`จะมีการคืนสต็อก ${preview.stockToRestore.length} รายการกลับไปยัง Preparation Area`);
      }

      if (preview.affectedDocuments.routeStops.length > 0) {
        preview.warnings.push(`Order จะถูกนำออกจาก Route และอาจต้องคำนวณค่าขนส่งใหม่`);
      }

      if (order.status === 'loaded') {
        preview.warnings.push(`Order ถูกโหลดแล้ว จะต้อง Reverse การโหลดก่อน`);
      }

      debugLog('getRollbackPreview', '=== FINAL PREVIEW RESULT ===', preview);
      debugLog('getRollbackPreview', `=== END getRollbackPreview for orderId: ${orderId} ===`);

      return { data: preview, error: null };
    } catch (err: any) {
      debugLog('getRollbackPreview', 'EXCEPTION:', { message: err.message, stack: err.stack });
      console.error('[OrderRollbackService] getRollbackPreview error:', err);
      return { data: null, error: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล Preview' };
    }
  }


  // ==========================================================================
  // Execute Partial Rollback
  // ==========================================================================

  /**
   * Execute Partial Rollback Order กลับไปสถานะ Draft
   * ✅ UPDATED: ใช้ execute_order_rollback_atomic() RPC สำหรับ TRUE Atomic Transaction
   * - Row-level locking (FOR UPDATE)
   * - Single DB transaction (BEGIN/COMMIT/ROLLBACK)
   * - original_ledger_id linking สำหรับ BRCGS Audit Trail
   * - rollback_reason ใน reverse ledger entries
   */
  async executeRollback(options: RollbackOptions): Promise<{ data: RollbackResult | null; error: string | null }> {
    const { orderId, userId, reason } = options;
    const startTime = Date.now();

    debugLog('executeRollback', `=== START executeRollback ===`, { orderId, userId, reason });

    try {
      // ========================================
      // PRE-VALIDATION (ก่อนเรียก atomic function)
      // ========================================
      debugLog('executeRollback', 'Step 1: Pre-validation - Fetching order...');
      const { data: order, error: orderError } = await this.supabase
        .from('wms_orders')
        .select('order_id, order_no, status, warehouse_id')
        .eq('order_id', orderId)
        .single();

      debugLog('executeRollback', 'Order query result:', { order, orderError });

      if (orderError || !order) {
        debugLog('executeRollback', 'ERROR: Order not found');
        return { data: null, error: 'ไม่พบ Order' };
      }

      if (order.status === 'draft') {
        debugLog('executeRollback', 'ERROR: Order already in draft status');
        return { data: null, error: 'Order อยู่ในสถานะ Draft อยู่แล้ว' };
      }

      if (['in_transit', 'delivered'].includes(order.status)) {
        debugLog('executeRollback', 'ERROR: Order in transit or delivered', { status: order.status });
        return { data: null, error: 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้' };
      }

      const warehouseId = order.warehouse_id || 'WH001';
      debugLog('executeRollback', 'Pre-validation passed', { 
        orderNo: order.order_no, 
        status: order.status, 
        warehouseId 
      });

      // ========================================
      // EXECUTE ATOMIC ROLLBACK (Single DB Transaction)
      // ========================================
      debugLog('executeRollback', 'Step 2: Executing atomic rollback RPC...', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: reason,
        p_warehouse_id: warehouseId
      });
      
      const { data: atomicResult, error: atomicError } = await this.supabase.rpc('execute_order_rollback_atomic', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: reason,
        p_warehouse_id: warehouseId
      });

      debugLog('executeRollback', 'Atomic RPC result:', { atomicResult, atomicError });

      if (atomicError) {
        debugLog('executeRollback', 'ERROR: Atomic rollback failed', { 
          message: atomicError.message,
          details: atomicError.details,
          hint: atomicError.hint,
          code: atomicError.code
        });
        console.error('[OrderRollbackService] Atomic rollback failed:', atomicError);
        return { 
          data: null, 
          error: atomicError.message || 'เกิดข้อผิดพลาดในการ Rollback' 
        };
      }

      if (!atomicResult || !atomicResult.success) {
        debugLog('executeRollback', 'ERROR: Atomic rollback returned unsuccessful', { atomicResult });
        return { 
          data: null, 
          error: 'Atomic rollback returned unsuccessful result' 
        };
      }

      // ========================================
      // MAP RESULT TO RollbackResult TYPE
      // ========================================
      debugLog('executeRollback', 'Step 3: Mapping result to RollbackResult type...');
      const summary = atomicResult.summary || {};
      
      const result: RollbackResult = {
        success: true,
        orderId: atomicResult.order_id,
        orderNo: atomicResult.order_no,
        previousStatus: atomicResult.previous_status,
        newStatus: atomicResult.new_status || 'draft',
        summary: {
          picklistItemsVoided: summary.picklist_items_voided || 0,
          faceSheetItemsVoided: summary.face_sheet_items_voided || 0,
          bonusFaceSheetItemsVoided: summary.bonus_items_voided || 0,
          loadlistItemsRemoved: summary.loadlist_items_removed || 0,
          routeStopsRemoved: summary.route_stops_removed || 0,
          reservationsReleased: summary.reservations_released || 0,
          ledgerEntriesCreated: summary.ledger_entries_created || 0,
          stockMovements: (summary.stock_movements || []).map((m: any) => ({
            skuId: m.sku_id,
            fromLocation: m.from_location,
            toLocation: m.to_location,
            quantity: m.quantity
          })),
          documentsVoided: {
            picklists: 0,
            faceSheets: 0,
            bonusFaceSheets: 0,
            loadlists: 0
          }
        },
        auditLogId: atomicResult.audit_log_id || 0,
        durationMs: atomicResult.duration_ms || (Date.now() - startTime)
      };

      // ========================================
      // STEP 4: RESET SHIPPING COST FOR AFFECTED TRIP
      // ========================================
      debugLog('executeRollback', 'Step 4: Resetting shipping cost for affected trip...');
      const shippingCostResetResult = await this.resetTripShippingCost(orderId, order.order_no, reason);
      debugLog('executeRollback', 'Shipping cost reset result:', shippingCostResetResult);

      // Add shipping cost reset info to result summary
      (result.summary as any).shippingCostReset = shippingCostResetResult;

      debugLog('executeRollback', '=== ROLLBACK SUCCESS ===', {
        orderId: result.orderId,
        orderNo: result.orderNo,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        summary: result.summary,
        auditLogId: result.auditLogId,
        durationMs: result.durationMs
      });

      console.log(`[OrderRollbackService] Atomic rollback completed successfully:`, {
        orderId: result.orderId,
        orderNo: result.orderNo,
        previousStatus: result.previousStatus,
        ledgerEntriesCreated: result.summary.ledgerEntriesCreated,
        shippingCostReset: shippingCostResetResult,
        durationMs: result.durationMs
      });

      return { data: result, error: null };

    } catch (err: any) {
      debugLog('executeRollback', 'EXCEPTION:', { message: err.message, stack: err.stack });
      console.error('[OrderRollbackService] executeRollback error:', err);
      
      const result: RollbackResult = {
        success: false,
        orderId,
        orderNo: '',
        previousStatus: '',
        newStatus: 'draft',
        summary: {
          picklistItemsVoided: 0,
          faceSheetItemsVoided: 0,
          bonusFaceSheetItemsVoided: 0,
          loadlistItemsRemoved: 0,
          routeStopsRemoved: 0,
          reservationsReleased: 0,
          ledgerEntriesCreated: 0,
          stockMovements: [],
          documentsVoided: {
            picklists: 0,
            faceSheets: 0,
            bonusFaceSheets: 0,
            loadlists: 0
          }
        },
        auditLogId: 0,
        durationMs: Date.now() - startTime,
        error: err.message || 'เกิดข้อผิดพลาดในการ Rollback'
      };
      
      return { data: result, error: err.message || 'เกิดข้อผิดพลาดในการ Rollback' };
    }
  }

  /**
   * @deprecated ใช้ execute_order_rollback_atomic() แทน
   * เก็บไว้สำหรับ backward compatibility และ fallback
   */
  async executeRollbackLegacy(options: RollbackOptions): Promise<{ data: RollbackResult | null; error: string | null }> {
    const { orderId, userId, reason, ipAddress, userAgent } = options;
    const startTime = Date.now();
    let auditLogId: number | null = null;
    
    const result: RollbackResult = {
      success: false,
      orderId,
      orderNo: '',
      previousStatus: '',
      newStatus: 'draft',
      summary: {
        picklistItemsVoided: 0,
        faceSheetItemsVoided: 0,
        bonusFaceSheetItemsVoided: 0,
        loadlistItemsRemoved: 0,
        routeStopsRemoved: 0,
        reservationsReleased: 0,
        ledgerEntriesCreated: 0,
        stockMovements: [],
        documentsVoided: {
          picklists: 0,
          faceSheets: 0,
          bonusFaceSheets: 0,
          loadlists: 0
        }
      },
      auditLogId: 0,
      durationMs: 0
    };

    try {
      // ========================================
      // STEP 0: VALIDATION & LOCK
      // ========================================
      
      const { data: order, error: orderError } = await this.supabase
        .from('wms_orders')
        .select('order_id, order_no, status, warehouse_id, rollback_count')
        .eq('order_id', orderId)
        .single();

      if (orderError || !order) {
        return { data: null, error: 'ไม่พบ Order' };
      }

      result.orderNo = order.order_no;
      result.previousStatus = order.status;

      if (order.status === 'draft') {
        return { data: null, error: 'Order อยู่ในสถานะ Draft อยู่แล้ว' };
      }

      if (['in_transit', 'delivered'].includes(order.status)) {
        return { data: null, error: 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้' };
      }

      // Lock Order
      const { data: locked } = await this.supabase.rpc('lock_order_for_rollback', {
        p_order_id: orderId,
        p_user_id: userId,
        p_lock_duration_minutes: 30
      });

      if (!locked) {
        return { data: null, error: 'Order กำลังถูก Rollback โดยผู้ใช้อื่น กรุณารอสักครู่' };
      }

      // สร้าง Audit Log
      const { data: logId } = await this.supabase.rpc('create_rollback_audit_log', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: reason,
        p_previous_status: order.status,
        p_ip_address: ipAddress || null,
        p_user_agent: userAgent || null
      });
      auditLogId = logId;
      result.auditLogId = logId;

      const warehouseId = order.warehouse_id || 'WH001';
      const affectedDocuments: any = {
        picklists: [],
        faceSheets: [],
        bonusFaceSheets: [],
        loadlists: [],
        routeStops: []
      };
      const affectedLedgerIds: number[] = [];

      // ========================================
      // STEP 1: REVERSE LOADING (ถ้า status = loaded)
      // ========================================
      if (['loaded'].includes(order.status)) {
        const loadingResult = await this.reverseLoading(orderId, userId, warehouseId);
        if (loadingResult.ledgerIds) {
          affectedLedgerIds.push(...loadingResult.ledgerIds);
        }
        result.summary.stockMovements.push(...(loadingResult.stockMovements || []));
        result.summary.ledgerEntriesCreated += loadingResult.ledgerEntriesCreated || 0;
      }

      // ========================================
      // STEP 2: REVERSE PICKING (ถ้า picked แล้ว)
      // ========================================
      if (['loaded', 'picked', 'in_picking'].includes(order.status)) {
        const pickingResult = await this.reversePicking(orderId, userId, warehouseId);
        if (pickingResult.ledgerIds) {
          affectedLedgerIds.push(...pickingResult.ledgerIds);
        }
        result.summary.stockMovements.push(...(pickingResult.stockMovements || []));
        result.summary.ledgerEntriesCreated += pickingResult.ledgerEntriesCreated || 0;
      }

      // ========================================
      // STEP 3: RELEASE RESERVATIONS
      // ========================================
      const { data: reservationResult } = await this.supabase.rpc('release_all_order_reservations', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: `Rollback: ${reason}`
      });
      
      if (reservationResult) {
        result.summary.reservationsReleased = reservationResult.total_released || 0;
      }

      // ========================================
      // STEP 4: VOID DOCUMENT LINES
      // ========================================
      
      const { data: plResult } = await this.supabase.rpc('void_order_picklist_items', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: `Rollback: ${reason}`
      });
      if (plResult) {
        result.summary.picklistItemsVoided = plResult.items_voided || 0;
        if (plResult.affected_picklist_ids) {
          affectedDocuments.picklists = plResult.affected_picklist_ids.map((id: number) => ({ id }));
        }
      }

      const { data: fsResult } = await this.supabase.rpc('void_order_face_sheet_items', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: `Rollback: ${reason}`
      });
      if (fsResult) {
        result.summary.faceSheetItemsVoided = fsResult.items_voided || 0;
        if (fsResult.affected_face_sheet_ids) {
          affectedDocuments.faceSheets = fsResult.affected_face_sheet_ids.map((id: number) => ({ id }));
        }
      }

      const { data: bfsResult } = await this.supabase.rpc('void_order_bonus_face_sheet_items', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: `Rollback: ${reason}`
      });
      if (bfsResult) {
        result.summary.bonusFaceSheetItemsVoided = bfsResult.items_voided || 0;
        if (bfsResult.affected_bonus_face_sheet_ids) {
          affectedDocuments.bonusFaceSheets = bfsResult.affected_bonus_face_sheet_ids.map((id: number) => ({ id }));
        }
      }

      const { data: llResult } = await this.supabase.rpc('remove_order_loadlist_items', {
        p_order_id: orderId
      });
      if (llResult) {
        result.summary.loadlistItemsRemoved = llResult.items_removed || 0;
        if (llResult.affected_loadlist_ids) {
          affectedDocuments.loadlists = llResult.affected_loadlist_ids.map((id: number) => ({ id }));
        }
      }

      // ========================================
      // STEP 5: REMOVE FROM ROUTE
      // ========================================
      const { data: routeResult } = await this.supabase.rpc('remove_order_from_route', {
        p_order_id: orderId
      });
      if (routeResult) {
        result.summary.routeStopsRemoved = routeResult.stops_removed || 0;
        if (routeResult.affected_trip_ids) {
          affectedDocuments.routeStops = routeResult.affected_trip_ids.map((tripId: number) => ({ tripId }));
        }
      }

      // ========================================
      // STEP 6: VOID EMPTY PARENT DOCUMENTS
      // ========================================
      const { data: voidResult } = await this.supabase.rpc('void_empty_parent_documents');
      if (voidResult) {
        result.summary.documentsVoided = {
          picklists: voidResult.picklists_voided || 0,
          faceSheets: voidResult.face_sheets_voided || 0,
          bonusFaceSheets: voidResult.bonus_face_sheets_voided || 0,
          loadlists: voidResult.loadlists_voided || 0
        };
      }

      // ========================================
      // STEP 7: RESET ORDER STATUS
      // ========================================
      const { error: updateError } = await this.supabase
        .from('wms_orders')
        .update({
          status: 'draft',
          confirmed_at: null,
          rollback_reason: reason,
          rollback_at: new Date().toISOString(),
          rollback_by: userId,
          rollback_count: (order.rollback_count || 0) + 1,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('order_id', orderId);

      if (updateError) {
        throw new Error(`Failed to update order status: ${updateError.message}`);
      }

      // ========================================
      // STEP 8: COMPLETE AUDIT LOG
      // ========================================
      result.durationMs = Date.now() - startTime;
      result.success = true;

      await this.supabase.rpc('complete_rollback_audit_log', {
        p_log_id: auditLogId,
        p_affected_documents: affectedDocuments,
        p_affected_ledger_ids: affectedLedgerIds,
        p_rollback_summary: result.summary
      });

      // ========================================
      // STEP 9: UNLOCK ORDER
      // ========================================
      await this.supabase.rpc('unlock_order_rollback', {
        p_order_id: orderId
      });

      return { data: result, error: null };

    } catch (err: any) {
      console.error('[OrderRollbackService] executeRollbackLegacy error:', err);
      
      if (auditLogId) {
        await this.supabase.rpc('fail_rollback_audit_log', {
          p_log_id: auditLogId,
          p_error_message: err.message || 'Unknown error'
        });
      }

      await this.supabase.rpc('unlock_order_rollback', {
        p_order_id: orderId
      });

      result.durationMs = Date.now() - startTime;
      result.error = err.message || 'เกิดข้อผิดพลาดในการ Rollback';
      
      return { data: result, error: err.message || 'เกิดข้อผิดพลาดในการ Rollback' };
    }
  }


  // ==========================================================================
  // Private Helper: Reverse Loading
  // ==========================================================================

  /**
   * Reverse Loading: ย้ายสต็อกจาก Delivery-In-Progress กลับไป Dispatch
   * สร้าง Reverse Ledger Entries สำหรับ BRCGS Audit Trail
   */
  private async reverseLoading(
    orderId: number,
    userId: number,
    warehouseId: string
  ): Promise<{
    ledgerIds: number[];
    stockMovements: { skuId: string; fromLocation: string; toLocation: string; quantity: number }[];
    ledgerEntriesCreated: number;
  }> {
    const result = {
      ledgerIds: [] as number[],
      stockMovements: [] as { skuId: string; fromLocation: string; toLocation: string; quantity: number }[],
      ledgerEntriesCreated: 0
    };

    const now = new Date().toISOString();

    // 1. ดึง Dispatch และ Delivery-In-Progress locations
    const { data: dispatchLoc } = await this.supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Dispatch')
      .eq('warehouse_id', warehouseId)
      .single();

    const { data: deliveryLoc } = await this.supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Delivery-In-Progress')
      .eq('warehouse_id', warehouseId)
      .single();

    if (!dispatchLoc || !deliveryLoc) {
      console.warn('[reverseLoading] Dispatch or Delivery-In-Progress location not found');
      return result;
    }

    // 2. ดึง picklist_items และ face_sheet_items ที่ picked แล้ว
    const { data: picklistItems } = await this.supabase
      .from('picklist_items')
      .select('sku_id, quantity_picked, master_sku(qty_per_pack)')
      .eq('order_id', orderId)
      .eq('status', 'picked');

    const { data: faceSheetItems } = await this.supabase
      .from('face_sheet_items')
      .select('sku_id, quantity_picked, master_sku(qty_per_pack)')
      .eq('order_id', orderId)
      .eq('status', 'picked');

    // 3. รวม items ทั้งหมด
    const allItems = [
      ...(picklistItems || []),
      ...(faceSheetItems || [])
    ];

    if (allItems.length === 0) {
      return result;
    }

    // 4. Group by SKU
    const skuMap = new Map<string, { qty: number; qtyPerPack: number }>();
    for (const item of allItems) {
      const qtyPerPack = (item.master_sku as any)?.qty_per_pack || 1;
      const existing = skuMap.get(item.sku_id);
      if (existing) {
        existing.qty += item.quantity_picked || 0;
      } else {
        skuMap.set(item.sku_id, { qty: item.quantity_picked || 0, qtyPerPack });
      }
    }

    // 5. สร้าง Reverse Ledger Entries
    const ledgerEntries: any[] = [];

    for (const [skuId, { qty, qtyPerPack }] of skuMap) {
      if (qty <= 0) continue;

      const packQty = qty / qtyPerPack;

      // 5.1 ดึง balance จาก Delivery-In-Progress
      const { data: deliveryBalance } = await this.supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', deliveryLoc.location_id)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!deliveryBalance) {
        console.warn(`[reverseLoading] No balance found at Delivery-In-Progress for SKU ${skuId}`);
        continue;
      }

      // 5.2 ลดสต็อกจาก Delivery-In-Progress
      await this.supabase
        .from('wms_inventory_balances')
        .update({
          total_piece_qty: Math.max(0, deliveryBalance.total_piece_qty - qty),
          total_pack_qty: Math.max(0, deliveryBalance.total_pack_qty - packQty),
          updated_at: now
        })
        .eq('balance_id', deliveryBalance.balance_id);

      // 5.3 เพิ่มสต็อกที่ Dispatch
      const { data: dispatchBalance } = await this.supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', dispatchLoc.location_id)
        .eq('sku_id', skuId)
        .maybeSingle();

      if (dispatchBalance) {
        await this.supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: dispatchBalance.total_piece_qty + qty,
            total_pack_qty: dispatchBalance.total_pack_qty + packQty,
            updated_at: now
          })
          .eq('balance_id', dispatchBalance.balance_id);
      } else {
        await this.supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: warehouseId,
            location_id: dispatchLoc.location_id,
            sku_id: skuId,
            total_piece_qty: qty,
            total_pack_qty: packQty,
            reserved_piece_qty: 0,
            reserved_pack_qty: 0,
            production_date: deliveryBalance.production_date,
            expiry_date: deliveryBalance.expiry_date,
            lot_no: deliveryBalance.lot_no,
            last_movement_at: now
          });
      }

      // 5.4 สร้าง Ledger: OUT from Delivery-In-Progress
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'rollback',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: deliveryLoc.location_id,
        sku_id: skuId,
        pack_qty: packQty,
        piece_qty: qty,
        reference_no: `ROLLBACK-ORD-${orderId}`,
        reference_doc_type: 'rollback',
        reference_doc_id: orderId,
        order_id: orderId,
        remarks: `Rollback loading: ออกจาก Delivery-In-Progress`,
        created_by: userId,
        skip_balance_sync: true
      });

      // 5.5 สร้าง Ledger: IN to Dispatch
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'rollback',
        direction: 'in',
        warehouse_id: warehouseId,
        location_id: dispatchLoc.location_id,
        sku_id: skuId,
        pack_qty: packQty,
        piece_qty: qty,
        reference_no: `ROLLBACK-ORD-${orderId}`,
        reference_doc_type: 'rollback',
        reference_doc_id: orderId,
        order_id: orderId,
        remarks: `Rollback loading: เข้า Dispatch`,
        created_by: userId,
        skip_balance_sync: true
      });

      result.stockMovements.push({
        skuId,
        fromLocation: 'Delivery-In-Progress',
        toLocation: 'Dispatch',
        quantity: qty
      });
    }

    // 6. Insert Ledger Entries
    if (ledgerEntries.length > 0) {
      const { data: insertedLedgers, error: ledgerError } = await this.supabase
        .from('wms_inventory_ledger')
        .insert(ledgerEntries)
        .select('ledger_id');

      if (ledgerError) {
        console.error('[reverseLoading] Ledger insert error:', ledgerError);
      } else if (insertedLedgers) {
        result.ledgerIds = insertedLedgers.map(l => l.ledger_id);
        result.ledgerEntriesCreated = insertedLedgers.length;
      }
    }

    return result;
  }


  // ==========================================================================
  // Private Helper: Reverse Picking
  // ==========================================================================

  /**
   * Reverse Picking: ย้ายสต็อกจาก Dispatch กลับไป Preparation Area
   * สร้าง Reverse Ledger Entries สำหรับ BRCGS Audit Trail
   */
  private async reversePicking(
    orderId: number,
    userId: number,
    warehouseId: string
  ): Promise<{
    ledgerIds: number[];
    stockMovements: { skuId: string; fromLocation: string; toLocation: string; quantity: number }[];
    ledgerEntriesCreated: number;
  }> {
    const result = {
      ledgerIds: [] as number[],
      stockMovements: [] as { skuId: string; fromLocation: string; toLocation: string; quantity: number }[],
      ledgerEntriesCreated: 0
    };

    const now = new Date().toISOString();

    // 1. ดึง Dispatch location
    const { data: dispatchLoc } = await this.supabase
      .from('master_location')
      .select('location_id')
      .eq('location_code', 'Dispatch')
      .eq('warehouse_id', warehouseId)
      .single();

    if (!dispatchLoc) {
      console.warn('[reversePicking] Dispatch location not found');
      return result;
    }

    // 2. ดึง picklist_items ที่ picked แล้ว (รวม source_location_id)
    const { data: picklistItems } = await this.supabase
      .from('picklist_items')
      .select('id, sku_id, quantity_picked, source_location_id, master_sku(qty_per_pack)')
      .eq('order_id', orderId)
      .eq('status', 'picked');

    // 3. ดึง face_sheet_items ที่ picked แล้ว
    const { data: faceSheetItems } = await this.supabase
      .from('face_sheet_items')
      .select('id, sku_id, quantity_picked, source_location_id, master_sku(qty_per_pack)')
      .eq('order_id', orderId)
      .eq('status', 'picked');

    // 4. รวม items ทั้งหมด
    const allItems = [
      ...(picklistItems || []).map(i => ({ ...i, type: 'picklist' })),
      ...(faceSheetItems || []).map(i => ({ ...i, type: 'face_sheet' }))
    ];

    if (allItems.length === 0) {
      return result;
    }

    // 5. Group by SKU + source_location
    const groupMap = new Map<string, { 
      skuId: string; 
      sourceLocationId: string; 
      qty: number; 
      qtyPerPack: number 
    }>();

    for (const item of allItems) {
      const qtyPerPack = (item.master_sku as any)?.qty_per_pack || 1;
      const key = `${item.sku_id}|${item.source_location_id}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.qty += item.quantity_picked || 0;
      } else {
        groupMap.set(key, {
          skuId: item.sku_id,
          sourceLocationId: item.source_location_id,
          qty: item.quantity_picked || 0,
          qtyPerPack
        });
      }
    }

    // 6. สร้าง Reverse Ledger Entries
    const ledgerEntries: any[] = [];

    for (const [, { skuId, sourceLocationId, qty, qtyPerPack }] of groupMap) {
      if (qty <= 0) continue;

      const packQty = qty / qtyPerPack;

      // 6.1 Map source_location_id (area_code) → actual location_ids
      let targetLocationIds: string[] = [sourceLocationId];
      
      // ถ้า source_location_id เป็น area_code (เช่น PK001) ต้อง map ไป zone
      const { data: prepArea } = await this.supabase
        .from('preparation_area')
        .select('zone')
        .eq('area_code', sourceLocationId)
        .maybeSingle();

      if (prepArea?.zone) {
        const { data: locs } = await this.supabase
          .from('master_location')
          .select('location_id')
          .eq('zone', prepArea.zone)
          .eq('warehouse_id', warehouseId);
        
        if (locs && locs.length > 0) {
          targetLocationIds = locs.map(l => l.location_id);
        }
      }

      // 6.2 ดึง balance จาก Dispatch
      const { data: dispatchBalance } = await this.supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, production_date, expiry_date, lot_no')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', dispatchLoc.location_id)
        .eq('sku_id', skuId)
        .gt('total_piece_qty', 0)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!dispatchBalance) {
        console.warn(`[reversePicking] No balance found at Dispatch for SKU ${skuId}`);
        continue;
      }

      // 6.3 ลดสต็อกจาก Dispatch
      await this.supabase
        .from('wms_inventory_balances')
        .update({
          total_piece_qty: Math.max(0, dispatchBalance.total_piece_qty - qty),
          total_pack_qty: Math.max(0, dispatchBalance.total_pack_qty - packQty),
          updated_at: now
        })
        .eq('balance_id', dispatchBalance.balance_id);

      // 6.4 เพิ่มสต็อกที่ Preparation Area (ใช้ location แรกใน zone)
      const targetLocationId = targetLocationIds[0];
      
      const { data: prepBalance } = await this.supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', targetLocationId)
        .eq('sku_id', skuId)
        .maybeSingle();

      if (prepBalance) {
        await this.supabase
          .from('wms_inventory_balances')
          .update({
            total_piece_qty: prepBalance.total_piece_qty + qty,
            total_pack_qty: prepBalance.total_pack_qty + packQty,
            updated_at: now
          })
          .eq('balance_id', prepBalance.balance_id);
      } else {
        await this.supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: warehouseId,
            location_id: targetLocationId,
            sku_id: skuId,
            total_piece_qty: qty,
            total_pack_qty: packQty,
            reserved_piece_qty: 0,
            reserved_pack_qty: 0,
            production_date: dispatchBalance.production_date,
            expiry_date: dispatchBalance.expiry_date,
            lot_no: dispatchBalance.lot_no,
            last_movement_at: now
          });
      }

      // 6.5 สร้าง Ledger: OUT from Dispatch
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'rollback',
        direction: 'out',
        warehouse_id: warehouseId,
        location_id: dispatchLoc.location_id,
        sku_id: skuId,
        pack_qty: packQty,
        piece_qty: qty,
        reference_no: `ROLLBACK-ORD-${orderId}`,
        reference_doc_type: 'rollback',
        reference_doc_id: orderId,
        order_id: orderId,
        remarks: `Rollback picking: ออกจาก Dispatch`,
        created_by: userId,
        skip_balance_sync: true
      });

      // 6.6 สร้าง Ledger: IN to Preparation Area
      ledgerEntries.push({
        movement_at: now,
        transaction_type: 'rollback',
        direction: 'in',
        warehouse_id: warehouseId,
        location_id: targetLocationId,
        sku_id: skuId,
        pack_qty: packQty,
        piece_qty: qty,
        reference_no: `ROLLBACK-ORD-${orderId}`,
        reference_doc_type: 'rollback',
        reference_doc_id: orderId,
        order_id: orderId,
        remarks: `Rollback picking: เข้า ${sourceLocationId}`,
        created_by: userId,
        skip_balance_sync: true
      });

      result.stockMovements.push({
        skuId,
        fromLocation: 'Dispatch',
        toLocation: sourceLocationId,
        quantity: qty
      });
    }

    // 7. Insert Ledger Entries
    if (ledgerEntries.length > 0) {
      const { data: insertedLedgers, error: ledgerError } = await this.supabase
        .from('wms_inventory_ledger')
        .insert(ledgerEntries)
        .select('ledger_id');

      if (ledgerError) {
        console.error('[reversePicking] Ledger insert error:', ledgerError);
      } else if (insertedLedgers) {
        result.ledgerIds = insertedLedgers.map(l => l.ledger_id);
        result.ledgerEntriesCreated = insertedLedgers.length;
      }
    }

    return result;
  }


  // ==========================================================================
  // Reset Trip Shipping Cost After Rollback
  // ==========================================================================

  /**
   * Reset shipping cost to 0 for the trip that contains the rolled-back order
   * เมื่อ Rollback Order ให้ reset ค่าขนส่งของคันที่มี order นั้นเป็น 0
   * และ flag ว่าต้องกรอกค่าขนส่งใหม่
   */
  private async resetTripShippingCost(
    orderId: number,
    orderNo: string,
    reason: string
  ): Promise<{
    tripId: number | null;
    tripSequence: number | null;
    previousShippingCost: number | null;
    success: boolean;
    message: string;
  }> {
    const result = {
      tripId: null as number | null,
      tripSequence: null as number | null,
      previousShippingCost: null as number | null,
      success: false,
      message: ''
    };

    try {
      debugLog('resetTripShippingCost', `Finding trip for order ${orderId}...`);

      // 1. หา trip_id จาก receiving_route_stops ที่มี order_id นี้
      const { data: routeStop, error: stopError } = await this.supabase
        .from('receiving_route_stops')
        .select('trip_id')
        .eq('order_id', orderId)
        .maybeSingle();

      debugLog('resetTripShippingCost', 'Route stop query result:', { routeStop, stopError });

      if (stopError) {
        debugLog('resetTripShippingCost', 'ERROR finding route stop:', stopError);
        result.message = `ไม่สามารถค้นหา route stop: ${stopError.message}`;
        return result;
      }

      if (!routeStop) {
        debugLog('resetTripShippingCost', 'No route stop found for this order - skipping shipping cost reset');
        result.success = true;
        result.message = 'Order ไม่ได้อยู่ใน route plan - ไม่ต้อง reset ค่าขนส่ง';
        return result;
      }

      const tripId = routeStop.trip_id;
      result.tripId = tripId;

      // 2. ดึงข้อมูล trip ปัจจุบัน
      const { data: trip, error: tripError } = await this.supabase
        .from('receiving_route_trips')
        .select('trip_id, trip_sequence, shipping_cost, base_price, helper_fee, extra_stop_fee, porterage_fee, other_fees')
        .eq('trip_id', tripId)
        .single();

      debugLog('resetTripShippingCost', 'Trip query result:', { trip, tripError });

      if (tripError || !trip) {
        debugLog('resetTripShippingCost', 'ERROR finding trip:', tripError);
        result.message = `ไม่พบข้อมูล trip: ${tripError?.message || 'Unknown error'}`;
        return result;
      }

      result.tripSequence = trip.trip_sequence;
      result.previousShippingCost = trip.shipping_cost;

      // 3. Reset shipping cost และ flag ว่าต้องกรอกใหม่
      const now = new Date().toISOString();
      const resetReason = `Rollback Order ${orderNo}: ${reason}`;

      const { error: updateError } = await this.supabase
        .from('receiving_route_trips')
        .update({
          shipping_cost: 0,
          base_price: 0,
          helper_fee: 0,
          porterage_fee: 0,
          other_fees: null,
          needs_shipping_cost_update: true,
          shipping_cost_reset_reason: resetReason,
          shipping_cost_reset_at: now,
          updated_at: now
        })
        .eq('trip_id', tripId);

      debugLog('resetTripShippingCost', 'Update result:', { updateError });

      if (updateError) {
        debugLog('resetTripShippingCost', 'ERROR updating trip:', updateError);
        result.message = `ไม่สามารถ reset ค่าขนส่ง: ${updateError.message}`;
        return result;
      }

      result.success = true;
      result.message = `Reset ค่าขนส่งเที่ยวที่ ${trip.trip_sequence} สำเร็จ (เดิม: ${trip.shipping_cost?.toLocaleString() || 0} บาท)`;

      debugLog('resetTripShippingCost', 'SUCCESS:', result);
      console.log(`[OrderRollbackService] Shipping cost reset for trip ${tripId}:`, {
        tripSequence: trip.trip_sequence,
        previousCost: trip.shipping_cost,
        reason: resetReason
      });

      return result;

    } catch (err: any) {
      debugLog('resetTripShippingCost', 'EXCEPTION:', err);
      result.message = `เกิดข้อผิดพลาด: ${err.message}`;
      return result;
    }
  }


  // ==========================================================================
  // Get Rollback History
  // ==========================================================================

  /**
   * ดึงประวัติการ Rollback ของ Order
   */
  async getRollbackHistory(orderId: number): Promise<{
    data: RollbackHistoryItem[] | null;
    error: string | null;
  }> {
    debugLog('getRollbackHistory', `Fetching rollback history for order ${orderId}...`);
    
    try {
      const { data, error } = await this.supabase
        .from('wms_rollback_audit_logs')
        .select(`
          log_id,
          action,
          user_id,
          reason,
          previous_status,
          new_status,
          affected_documents,
          rollback_summary,
          created_at,
          master_system_user(full_name, username)
        `)
        .eq('entity_type', 'order')
        .eq('entity_id', orderId)
        .order('created_at', { ascending: false });

      debugLog('getRollbackHistory', 'Query result:', { count: data?.length || 0, error });

      if (error) {
        debugLog('getRollbackHistory', 'ERROR:', error);
        return { data: null, error: error.message };
      }

      // Map user info
      const mappedData = (data || []).map(item => ({
        ...item,
        user_name: (item.master_system_user as any)?.full_name || 
                   (item.master_system_user as any)?.username || 
                   `User ${item.user_id}`
      }));

      debugLog('getRollbackHistory', 'Returning history items:', mappedData.length);
      return { data: mappedData, error: null };
    } catch (err: any) {
      debugLog('getRollbackHistory', 'EXCEPTION:', err);
      return { data: null, error: err.message || 'เกิดข้อผิดพลาด' };
    }
  }

  // ==========================================================================
  // Check if Order Can Be Rolled Back
  // ==========================================================================

  /**
   * ตรวจสอบว่า Order สามารถ Rollback ได้หรือไม่
   */
  async canRollback(orderId: number): Promise<{
    canRollback: boolean;
    reason?: string;
  }> {
    debugLog('canRollback', `Checking if order ${orderId} can be rolled back...`);
    
    const { data: order, error } = await this.supabase
      .from('wms_orders')
      .select('status, rollback_lock_at, rollback_lock_expires_at')
      .eq('order_id', orderId)
      .single();

    debugLog('canRollback', 'Order query result:', { order, error });

    if (!order) {
      debugLog('canRollback', 'Order not found');
      return { canRollback: false, reason: 'ไม่พบ Order' };
    }

    if (order.status === 'draft') {
      debugLog('canRollback', 'Order already in draft status');
      return { canRollback: false, reason: 'Order อยู่ในสถานะ Draft อยู่แล้ว' };
    }

    if (['in_transit', 'delivered'].includes(order.status)) {
      debugLog('canRollback', 'Order in transit or delivered', { status: order.status });
      return { canRollback: false, reason: 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้' };
    }

    if (order.rollback_lock_at && order.rollback_lock_expires_at) {
      const lockExpires = new Date(order.rollback_lock_expires_at);
      debugLog('canRollback', 'Checking lock status:', { 
        lockExpires: lockExpires.toISOString(), 
        now: new Date().toISOString() 
      });
      if (lockExpires > new Date()) {
        debugLog('canRollback', 'Order is locked by another user');
        return { canRollback: false, reason: 'Order กำลังถูก Rollback โดยผู้ใช้อื่น' };
      }
    }

    debugLog('canRollback', 'Order CAN be rolled back');
    return { canRollback: true };
  }
}

// ==========================================================================
// Export Singleton Instance
// ==========================================================================

export const orderRollbackService = new OrderRollbackService();
