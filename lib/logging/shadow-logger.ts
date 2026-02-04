// lib/logging/shadow-logger.ts
// Shadow Command Center - Non-invasive logging utilities
//
// 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
// ❌ ไม่ block business logic
// ❌ ไม่ raise exception
// ❌ ไม่ rethrow error
// ✅ แค่ "ฟังทุกอย่าง" + fail silently

import { createServiceRoleClient } from '@/lib/supabase/server';

// ============================================================================
// Constants
// ============================================================================

const LOGGER_TIMEOUT_MS = 2000; // 2 seconds - fail fast, don't block business
const LOG_PREFIX = '[ShadowLog]';

// ============================================================================
// Types
// ============================================================================

export interface TransactionContext {
  transactionId: string;
  operationType: string;
  operationSubtype?: string;
  userId?: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  requestBody?: any;
  referenceDocType?: string;
  referenceDocId?: number;
  referenceDocNo?: string;
  metadata?: any;
}

export interface ActivityLogEntry {
  transactionId?: string;
  activityType: string;
  activityStatus: 'success' | 'failed' | 'partial';
  entityType?: string;
  entityId?: string;
  entityNo?: string;
  warehouseId?: string;
  locationId?: string;
  skuId?: string;
  palletId?: string;
  qtyBefore?: number;
  qtyAfter?: number;
  qtyDelta?: number;
  reservedBefore?: number;
  reservedAfter?: number;
  durationMs?: number;
  remarks?: string;
  metadata?: any;
  items?: ActivityLogItem[];
}

export interface ActivityLogItem {
  lineNo?: number;
  skuId?: string;
  locationId?: string;
  palletId?: string;
  qtyRequested?: number;
  qtyActual?: number;
  qtyBefore?: number;
  qtyAfter?: number;
  itemStatus?: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
  metadata?: any;
}

export interface UserIntent {
  transactionId?: string;
  intentType: string;
  intentDescription?: string;
  userId?: number;
  itemsRequested: number;
  qtyRequested: number;
  referenceDocType?: string;
  referenceDocId?: number;
  referenceDocNo?: string;
}

export interface IntentResult {
  status: 'completed' | 'partial' | 'failed';
  itemsSucceeded: number;
  itemsFailed: number;
  qtySucceeded: number;
  qtyFailed: number;
  failureReasons?: any;
}

export interface ErrorLogEntry {
  transactionId?: string;
  errorCode?: string;
  errorMessage: string;
  errorStack?: string;
  operationType?: string;
  entityType?: string;
  entityId?: string;
  userId?: number;
  requestPath?: string;
  requestBody?: any;
  metadata?: any;
}

export interface StockSnapshotParams {
  transactionId?: string;
  logId?: number;
  warehouseId: string;
  locationId: string;
  skuId: string;
  palletId?: string;
  snapshotType: 'before' | 'after';
}

// ============================================================================
// Helper: Timeout wrapper
// ============================================================================

async function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T> | { then: (onfulfilled: (value: T) => any) => any },
  timeoutMs: number = LOGGER_TIMEOUT_MS
): Promise<T | null> {
  try {
    const promise = Promise.resolve(promiseOrThenable);
    return await Promise.race([
      promise,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Shadow logger timeout')), timeoutMs)
      ),
    ]);
  } catch (err) {
    console.error(`${LOG_PREFIX} Timeout or error:`, err);
    return null;
  }
}

// ============================================================================
// Shadow Logger Class
// ============================================================================

class ShadowLogger {
  private getSupabase() {
    // Create fresh client each time to avoid stale connections
    return createServiceRoleClient();
  }

  // ============================================================================
  // Transaction Management
  // ============================================================================

  /**
   * Start a new transaction (correlation ID)
   * ❌ Never throws - always returns a transaction ID (even if logging fails)
   */
  async startTransaction(ctx: Omit<TransactionContext, 'transactionId'>): Promise<string> {
    const transactionId = crypto.randomUUID();

    // Fire-and-forget: don't await in caller
    this.insertTransaction(transactionId, ctx).catch(() => {});

    return transactionId;
  }

  private async insertTransaction(
    transactionId: string,
    ctx: Omit<TransactionContext, 'transactionId'>
  ): Promise<void> {
    try {
      await withTimeout(
        this.getSupabase().from('wms_transactions').insert({
          transaction_id: transactionId,
          operation_type: ctx.operationType,
          operation_subtype: ctx.operationSubtype,
          user_id: ctx.userId,
          session_id: ctx.sessionId,
          ip_address: ctx.ipAddress,
          user_agent: ctx.userAgent,
          request_path: ctx.requestPath,
          request_method: ctx.requestMethod,
          request_body: ctx.requestBody,
          reference_doc_type: ctx.referenceDocType,
          reference_doc_id: ctx.referenceDocId,
          reference_doc_no: ctx.referenceDocNo,
          status: 'started',
          metadata: ctx.metadata,
        })
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to start transaction:`, err);
      // ❌ Never throw
    }
  }

  /**
   * Complete a transaction
   * ❌ Never throws
   */
  async completeTransaction(
    transactionId: string,
    status: 'completed' | 'failed' | 'partial',
    metadata?: any
  ): Promise<void> {
    try {
      const startedAt = await this.getTransactionStartTime(transactionId);
      const durationMs = startedAt ? Date.now() - startedAt.getTime() : null;

      await withTimeout(
        this.getSupabase()
          .from('wms_transactions')
          .update({
            status,
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            metadata: metadata ? { ...metadata } : undefined,
          })
          .eq('transaction_id', transactionId)
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to complete transaction:`, err);
      // ❌ Never throw
    }
  }

  private async getTransactionStartTime(transactionId: string): Promise<Date | null> {
    try {
      const result = await withTimeout(
        this.getSupabase()
          .from('wms_transactions')
          .select('started_at')
          .eq('transaction_id', transactionId)
          .single()
      );
      return (result as any)?.data ? new Date((result as any).data.started_at) : null;
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Activity Logging
  // ============================================================================

  /**
   * Log an activity
   * ❌ Never throws - always tries to log, fails silently
   */
  async logActivity(entry: ActivityLogEntry): Promise<number | null> {
    try {
      const result = await withTimeout(
        this.getSupabase()
          .from('wms_activity_logs')
          .insert({
            transaction_id: entry.transactionId,
            activity_type: entry.activityType,
            activity_status: entry.activityStatus,
            entity_type: entry.entityType,
            entity_id: entry.entityId,
            entity_no: entry.entityNo,
            warehouse_id: entry.warehouseId,
            location_id: entry.locationId,
            sku_id: entry.skuId,
            pallet_id: entry.palletId,
            qty_before: entry.qtyBefore,
            qty_after: entry.qtyAfter,
            qty_delta: entry.qtyDelta,
            reserved_before: entry.reservedBefore,
            reserved_after: entry.reservedAfter,
            duration_ms: entry.durationMs,
            remarks: entry.remarks,
            metadata: entry.metadata,
          })
          .select('log_id')
          .single()
      );

      const logId = (result as any)?.data?.log_id;
      if (!logId) {
        console.error(`${LOG_PREFIX} Failed to log activity - no log_id returned`);
        return null;
      }

      // Log items if provided (fire-and-forget)
      if (entry.items && entry.items.length > 0) {
        this.logActivityItems(logId, entry.items).catch(() => {});
      }

      return logId;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to log activity:`, err);
      return null;
    }
  }

  private async logActivityItems(logId: number, items: ActivityLogItem[]): Promise<void> {
    try {
      const itemsToInsert = items.map((item) => ({
        log_id: logId,
        line_no: item.lineNo,
        sku_id: item.skuId,
        location_id: item.locationId,
        pallet_id: item.palletId,
        qty_requested: item.qtyRequested,
        qty_actual: item.qtyActual,
        qty_before: item.qtyBefore,
        qty_after: item.qtyAfter,
        item_status: item.itemStatus,
        error_message: item.errorMessage,
        metadata: item.metadata,
      }));

      await withTimeout(this.getSupabase().from('wms_activity_log_items').insert(itemsToInsert));
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to log activity items:`, err);
      // ❌ Never throw
    }
  }

  // ============================================================================
  // User Intent Logging
  // ============================================================================

  /**
   * Log user intent
   * ❌ Never throws
   */
  async logIntent(intent: UserIntent): Promise<number | null> {
    try {
      const result = await withTimeout(
        this.getSupabase()
          .from('wms_user_intents')
          .insert({
            transaction_id: intent.transactionId,
            intent_type: intent.intentType,
            intent_description: intent.intentDescription,
            user_id: intent.userId,
            items_requested: intent.itemsRequested,
            qty_requested: intent.qtyRequested,
            reference_doc_type: intent.referenceDocType,
            reference_doc_id: intent.referenceDocId,
            reference_doc_no: intent.referenceDocNo,
            status: 'pending',
          })
          .select('intent_id')
          .single()
      );

      const intentId = (result as any)?.data?.intent_id;
      if (!intentId) {
        console.error(`${LOG_PREFIX} Failed to log intent - no intent_id returned`);
        return null;
      }

      return intentId;
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to log intent:`, err);
      return null;
    }
  }

  /**
   * Update intent with results
   * ❌ Never throws
   */
  async updateIntent(intentId: number, result: IntentResult): Promise<void> {
    try {
      await withTimeout(
        this.getSupabase()
          .from('wms_user_intents')
          .update({
            status: result.status,
            items_succeeded: result.itemsSucceeded,
            items_failed: result.itemsFailed,
            qty_succeeded: result.qtySucceeded,
            qty_failed: result.qtyFailed,
            failure_reasons: result.failureReasons,
            completed_at: new Date().toISOString(),
          })
          .eq('intent_id', intentId)
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to update intent:`, err);
      // ❌ Never throw
    }
  }

  // ============================================================================
  // Error Logging
  // ============================================================================

  /**
   * Log an error
   * ❌ Never throws - this is critical for error capture
   */
  async logError(entry: ErrorLogEntry): Promise<void> {
    try {
      await withTimeout(
        this.getSupabase().from('wms_errors').insert({
          transaction_id: entry.transactionId,
          error_code: entry.errorCode,
          error_message: entry.errorMessage,
          error_stack: entry.errorStack,
          operation_type: entry.operationType,
          entity_type: entry.entityType,
          entity_id: entry.entityId,
          user_id: entry.userId,
          request_path: entry.requestPath,
          request_body: entry.requestBody,
          metadata: entry.metadata,
        })
      );
    } catch (err) {
      // Last resort - log to console
      console.error(`${LOG_PREFIX} CRITICAL: Failed to log error:`, err);
      console.error(`${LOG_PREFIX} Original error:`, entry);
      // ❌ Never throw
    }
  }

  // ============================================================================
  // Stock Snapshot
  // ============================================================================

  /**
   * Take a snapshot of stock state
   * ❌ Never throws
   */
  async takeStockSnapshot(params: StockSnapshotParams): Promise<void> {
    try {
      // Get current balance
      let query = this.getSupabase()
        .from('wms_inventory_balances')
        .select('total_piece_qty, total_pack_qty, reserved_piece_qty, reserved_pack_qty')
        .eq('warehouse_id', params.warehouseId)
        .eq('location_id', params.locationId)
        .eq('sku_id', params.skuId);

      if (params.palletId) {
        query = query.eq('pallet_id', params.palletId);
      }

      const balanceResult = await withTimeout(query.maybeSingle());
      const balance = (balanceResult as any)?.data;

      const totalPieceQty = Number(balance?.total_piece_qty) || 0;
      const reservedPieceQty = Number(balance?.reserved_piece_qty) || 0;

      await withTimeout(
        this.getSupabase().from('wms_stock_snapshots').insert({
          transaction_id: params.transactionId,
          log_id: params.logId,
          warehouse_id: params.warehouseId,
          location_id: params.locationId,
          sku_id: params.skuId,
          pallet_id: params.palletId,
          total_piece_qty: balance?.total_piece_qty,
          total_pack_qty: balance?.total_pack_qty,
          reserved_piece_qty: balance?.reserved_piece_qty,
          reserved_pack_qty: balance?.reserved_pack_qty,
          available_piece_qty: totalPieceQty - reservedPieceQty,
          snapshot_type: params.snapshotType,
        })
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to take stock snapshot:`, err);
      // ❌ Never throw
    }
  }

  // ============================================================================
  // Convenience: Fire-and-forget logging (for hot paths)
  // ============================================================================

  /**
   * Log activity without waiting - use in hot paths
   * Returns immediately, logging happens in background
   */
  logActivityAsync(entry: ActivityLogEntry): void {
    this.logActivity(entry).catch(() => {});
  }

  /**
   * Log error without waiting - use in hot paths
   * Returns immediately, logging happens in background
   */
  logErrorAsync(entry: ErrorLogEntry): void {
    this.logError(entry).catch(() => {});
  }

  /**
   * Take snapshot without waiting - use in hot paths
   * Returns immediately, snapshot happens in background
   */
  takeStockSnapshotAsync(params: StockSnapshotParams): void {
    this.takeStockSnapshot(params).catch(() => {});
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const shadowLogger = new ShadowLogger();

// ============================================================================
// Export class for testing
// ============================================================================

export { ShadowLogger };
