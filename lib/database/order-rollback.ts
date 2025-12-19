/**
 * Order Rollback Service
 * 
 * Service สำหรับ Partial Rollback Order กลับไปสถานะ Draft
 * รองรับ BRCGS Audit Trail และ Reverse Ledger Pattern
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    try {
      // 1. ดึงข้อมูล Order
      const { data: order, error: orderError } = await this.supabase
        .from('wms_orders')
        .select('order_id, order_no, status, rollback_lock_at, rollback_lock_expires_at, rollback_lock_by')
        .eq('order_id', orderId)
        .single();

      if (orderError || !order) {
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

      // 2. ตรวจสอบว่าสามารถ Rollback ได้หรือไม่
      if (order.status === 'draft') {
        preview.canRollback = false;
        preview.blockingReason = 'Order อยู่ในสถานะ Draft อยู่แล้ว';
        return { data: preview, error: null };
      }

      if (['in_transit', 'delivered'].includes(order.status)) {
        preview.canRollback = false;
        preview.blockingReason = 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้';
        return { data: preview, error: null };
      }

      // ตรวจสอบ Lock
      if (order.rollback_lock_at && order.rollback_lock_expires_at) {
        const lockExpires = new Date(order.rollback_lock_expires_at);
        if (lockExpires > new Date()) {
          preview.canRollback = false;
          preview.blockingReason = 'Order กำลังถูก Rollback โดยผู้ใช้อื่น';
          return { data: preview, error: null };
        }
      }

      // 3. ดึงข้อมูล Picklist Items
      const { data: picklistItems } = await this.supabase
        .from('picklist_items')
        .select(`
          id, picklist_id, sku_id, quantity_picked, quantity_to_pick, status, source_location_id,
          picklists!inner(id, picklist_code),
          master_sku(sku_name)
        `)
        .eq('order_id', orderId)
        .is('voided_at', null);

      if (picklistItems && picklistItems.length > 0) {
        const picklistMap = new Map<number, { id: number; code: string; itemCount: number }>();
        for (const item of picklistItems) {
          const pl = item.picklists as any;
          if (!picklistMap.has(pl.id)) {
            picklistMap.set(pl.id, { id: pl.id, code: pl.picklist_code, itemCount: 0 });
          }
          picklistMap.get(pl.id)!.itemCount++;

          if (item.status === 'picked' && item.quantity_picked > 0) {
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
      }

      // 4. ดึงข้อมูล Face Sheet Items
      const { data: faceSheetItems } = await this.supabase
        .from('face_sheet_items')
        .select(`
          id, face_sheet_id, sku_id, quantity_picked, quantity_to_pick, status, source_location_id,
          face_sheets!inner(id, face_sheet_no),
          master_sku(sku_name)
        `)
        .eq('order_id', orderId)
        .is('voided_at', null);

      if (faceSheetItems && faceSheetItems.length > 0) {
        const fsMap = new Map<number, { id: number; code: string; itemCount: number }>();
        for (const item of faceSheetItems) {
          const fs = item.face_sheets as any;
          if (!fsMap.has(fs.id)) {
            fsMap.set(fs.id, { id: fs.id, code: fs.face_sheet_no, itemCount: 0 });
          }
          fsMap.get(fs.id)!.itemCount++;

          if (item.status === 'picked' && item.quantity_picked > 0) {
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
      }

      // 5. ดึงข้อมูล Bonus Face Sheet Items
      const { data: orderItems } = await this.supabase
        .from('wms_order_items')
        .select('order_item_id')
        .eq('order_id', orderId);

      if (orderItems && orderItems.length > 0) {
        const orderItemIds = orderItems.map(oi => oi.order_item_id);
        
        const { data: bonusItems } = await this.supabase
          .from('bonus_face_sheet_items')
          .select(`
            id, face_sheet_id, sku_id, quantity_picked, quantity_to_pick, status, source_location_id,
            bonus_face_sheets!inner(id, face_sheet_no),
            master_sku(sku_name)
          `)
          .in('order_item_id', orderItemIds)
          .is('voided_at', null);

        if (bonusItems && bonusItems.length > 0) {
          const bfsMap = new Map<number, { id: number; code: string; itemCount: number }>();
          for (const item of bonusItems) {
            const bfs = item.bonus_face_sheets as any;
            if (!bfsMap.has(bfs.id)) {
              bfsMap.set(bfs.id, { id: bfs.id, code: bfs.face_sheet_no, itemCount: 0 });
            }
            bfsMap.get(bfs.id)!.itemCount++;

            if (item.status === 'picked' && item.quantity_picked > 0) {
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
        }
      }

      // 6. ดึงข้อมูล Loadlist Items
      const { data: loadlistItems } = await this.supabase
        .from('loadlist_items')
        .select(`
          id, loadlist_id,
          loadlists!inner(id, loadlist_code)
        `)
        .eq('order_id', orderId);

      if (loadlistItems && loadlistItems.length > 0) {
        const llMap = new Map<number, { id: number; code: string; itemCount: number }>();
        for (const item of loadlistItems) {
          const ll = item.loadlists as any;
          if (!llMap.has(ll.id)) {
            llMap.set(ll.id, { id: ll.id, code: ll.loadlist_code, itemCount: 0 });
          }
          llMap.get(ll.id)!.itemCount++;
        }
        preview.affectedDocuments.loadlists = Array.from(llMap.values());
      }

      // 7. ดึงข้อมูล Route Stops
      const { data: routeStops } = await this.supabase
        .from('receiving_route_stops')
        .select('stop_id, trip_id')
        .eq('order_id', orderId);

      if (routeStops && routeStops.length > 0) {
        preview.affectedDocuments.routeStops = routeStops.map(s => ({
          stopId: s.stop_id,
          tripId: s.trip_id
        }));
      }

      // 8. นับ Reservations ที่ต้อง Release
      if (picklistItems) {
        const picklistItemIds = picklistItems.map(pi => pi.id);
        if (picklistItemIds.length > 0) {
          const { count: plResCount } = await this.supabase
            .from('picklist_item_reservations')
            .select('*', { count: 'exact', head: true })
            .in('picklist_item_id', picklistItemIds)
            .eq('status', 'reserved');
          preview.reservationsToRelease += plResCount || 0;
        }
      }

      if (faceSheetItems) {
        const fsItemIds = faceSheetItems.map(fsi => fsi.id);
        if (fsItemIds.length > 0) {
          const { count: fsResCount } = await this.supabase
            .from('face_sheet_item_reservations')
            .select('*', { count: 'exact', head: true })
            .in('face_sheet_item_id', fsItemIds)
            .eq('status', 'reserved');
          preview.reservationsToRelease += fsResCount || 0;
        }
      }

      // 9. สร้าง Warnings
      if (preview.stockToRestore.length > 0) {
        preview.warnings.push(`จะมีการคืนสต็อก ${preview.stockToRestore.length} รายการกลับไปยัง Preparation Area`);
      }

      if (preview.affectedDocuments.routeStops.length > 0) {
        preview.warnings.push(`Order จะถูกนำออกจาก Route และอาจต้องคำนวณค่าขนส่งใหม่`);
      }

      if (order.status === 'loaded') {
        preview.warnings.push(`Order ถูกโหลดแล้ว จะต้อง Reverse การโหลดก่อน`);
      }

      return { data: preview, error: null };
    } catch (err: any) {
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

    try {
      // ========================================
      // PRE-VALIDATION (ก่อนเรียก atomic function)
      // ========================================
      const { data: order, error: orderError } = await this.supabase
        .from('wms_orders')
        .select('order_id, order_no, status, warehouse_id')
        .eq('order_id', orderId)
        .single();

      if (orderError || !order) {
        return { data: null, error: 'ไม่พบ Order' };
      }

      if (order.status === 'draft') {
        return { data: null, error: 'Order อยู่ในสถานะ Draft อยู่แล้ว' };
      }

      if (['in_transit', 'delivered'].includes(order.status)) {
        return { data: null, error: 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้' };
      }

      const warehouseId = order.warehouse_id || 'WH001';

      // ========================================
      // EXECUTE ATOMIC ROLLBACK (Single DB Transaction)
      // ========================================
      console.log(`[OrderRollbackService] Executing atomic rollback for order ${orderId}...`);
      
      const { data: atomicResult, error: atomicError } = await this.supabase.rpc('execute_order_rollback_atomic', {
        p_order_id: orderId,
        p_user_id: userId,
        p_reason: reason,
        p_warehouse_id: warehouseId
      });

      if (atomicError) {
        console.error('[OrderRollbackService] Atomic rollback failed:', atomicError);
        return { 
          data: null, 
          error: atomicError.message || 'เกิดข้อผิดพลาดในการ Rollback' 
        };
      }

      if (!atomicResult || !atomicResult.success) {
        return { 
          data: null, 
          error: 'Atomic rollback returned unsuccessful result' 
        };
      }

      // ========================================
      // MAP RESULT TO RollbackResult TYPE
      // ========================================
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

      console.log(`[OrderRollbackService] Atomic rollback completed successfully:`, {
        orderId: result.orderId,
        orderNo: result.orderNo,
        previousStatus: result.previousStatus,
        ledgerEntriesCreated: result.summary.ledgerEntriesCreated,
        durationMs: result.durationMs
      });

      return { data: result, error: null };

    } catch (err: any) {
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
  // Get Rollback History
  // ==========================================================================

  /**
   * ดึงประวัติการ Rollback ของ Order
   */
  async getRollbackHistory(orderId: number): Promise<{
    data: RollbackHistoryItem[] | null;
    error: string | null;
  }> {
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

      if (error) {
        return { data: null, error: error.message };
      }

      // Map user info
      const mappedData = (data || []).map(item => ({
        ...item,
        user_name: (item.master_system_user as any)?.full_name || 
                   (item.master_system_user as any)?.username || 
                   `User ${item.user_id}`
      }));

      return { data: mappedData, error: null };
    } catch (err: any) {
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
    const { data: order } = await this.supabase
      .from('wms_orders')
      .select('status, rollback_lock_at, rollback_lock_expires_at')
      .eq('order_id', orderId)
      .single();

    if (!order) {
      return { canRollback: false, reason: 'ไม่พบ Order' };
    }

    if (order.status === 'draft') {
      return { canRollback: false, reason: 'Order อยู่ในสถานะ Draft อยู่แล้ว' };
    }

    if (['in_transit', 'delivered'].includes(order.status)) {
      return { canRollback: false, reason: 'ไม่สามารถ Rollback Order ที่อยู่ระหว่างจัดส่งหรือส่งแล้วได้' };
    }

    if (order.rollback_lock_at && order.rollback_lock_expires_at) {
      const lockExpires = new Date(order.rollback_lock_expires_at);
      if (lockExpires > new Date()) {
        return { canRollback: false, reason: 'Order กำลังถูก Rollback โดยผู้ใช้อื่น' };
      }
    }

    return { canRollback: true };
  }
}

// ==========================================================================
// Export Singleton Instance
// ==========================================================================

export const orderRollbackService = new OrderRollbackService();
