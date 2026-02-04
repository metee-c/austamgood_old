// lib/logging/with-activity-log.ts
// Non-invasive activity logging wrapper
//
// 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
// ❌ ถ้า log fail → ไม่ทำให้ business fail
// ✅ แค่ mark log = incomplete

import {
  shadowLogger,
  ActivityLogEntry,
  UserIntent,
  StockSnapshotParams,
} from './shadow-logger';

// ============================================================================
// Types
// ============================================================================

export interface ActivityContext {
  transactionId: string;
  userId?: number;
  sessionId?: string;
  operationType: string;
  operationSubtype?: string;
  referenceDocType?: string;
  referenceDocId?: number;
  referenceDocNo?: string;
}

export interface WithActivityLogOptions {
  operationType: string;
  operationSubtype?: string;
  activityType: string;
  entityType?: string;

  /**
   * Extract entity info from function arguments and result
   */
  extractEntity?: (args: any[], result: any) => { entityId?: string; entityNo?: string };

  /**
   * Extract user intent from function arguments
   */
  extractIntent?: (args: any[]) => {
    description: string;
    itemsRequested: number;
    qtyRequested: number;
  };

  /**
   * Extract stock locations to snapshot (for critical operations)
   */
  captureStockSnapshot?: (args: any[]) => Array<{
    warehouseId: string;
    locationId: string;
    skuId: string;
    palletId?: string;
  }>;

  /**
   * Extract user ID from function arguments
   */
  extractUserId?: (args: any[]) => number | undefined;
}

// ============================================================================
// Main Wrapper Function
// ============================================================================

/**
 * Non-invasive activity logging wrapper
 *
 * 🔒 GOLDEN RULE: ถ้า logging fail → business ยังทำงานปกติ
 *
 * Usage:
 * ```typescript
 * // Wrap existing function
 * const createAdjustmentWithLog = withActivityLog(
 *   async (ctx, payload) => {
 *     // Original business logic - 100% unchanged
 *     return await stockAdjustmentService.createAdjustment(payload);
 *   },
 *   {
 *     operationType: 'ADJUSTMENT',
 *     activityType: 'STOCK_ADJUST_CREATE',
 *     entityType: 'ADJUSTMENT',
 *     extractEntity: (args, result) => ({
 *       entityId: result?.data?.adjustment_id?.toString(),
 *       entityNo: result?.data?.adjustment_no,
 *     }),
 *   }
 * );
 * ```
 */
export function withActivityLog<TArgs extends any[], TResult>(
  fn: (ctx: ActivityContext, ...args: TArgs) => Promise<TResult>,
  options: WithActivityLogOptions
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const startTime = Date.now();
    let transactionId: string = '';
    let intentId: number | null = null;

    // ========================================================================
    // PRE-EXECUTION: Start transaction + Log intent + Take before snapshot
    // All logging is fire-and-forget - never blocks business logic
    // ========================================================================
    try {
      // Start transaction (returns immediately with UUID)
      transactionId = await shadowLogger.startTransaction({
        operationType: options.operationType,
        operationSubtype: options.operationSubtype,
        userId: options.extractUserId?.(args),
      });

      // Log intent if extractor provided (fire-and-forget)
      if (options.extractIntent) {
        const intent = options.extractIntent(args);
        shadowLogger
          .logIntent({
            transactionId,
            intentType: options.operationType,
            intentDescription: intent.description,
            itemsRequested: intent.itemsRequested,
            qtyRequested: intent.qtyRequested,
            userId: options.extractUserId?.(args),
          })
          .then((id) => {
            intentId = id;
          })
          .catch(() => {});
      }

      // Take before snapshots if extractor provided (fire-and-forget)
      if (options.captureStockSnapshot) {
        const snapshots = options.captureStockSnapshot(args);
        for (const snap of snapshots) {
          shadowLogger.takeStockSnapshotAsync({
            transactionId,
            ...snap,
            snapshotType: 'before',
          });
        }
      }
    } catch (err) {
      // ❌ Never fail business logic due to logging
      console.error('[withActivityLog] Pre-execution logging failed:', err);
    }

    // ========================================================================
    // EXECUTION: Run original business logic
    // This is the ONLY part that can throw - preserves original behavior
    // ========================================================================
    const ctx: ActivityContext = {
      transactionId: transactionId || crypto.randomUUID(),
      operationType: options.operationType,
      operationSubtype: options.operationSubtype,
    };

    let result: TResult;
    let error: Error | null = null;

    try {
      // Execute original business logic
      result = await fn(ctx, ...args);
    } catch (err: any) {
      error = err;

      // Log error (fire-and-forget - never blocks)
      shadowLogger.logErrorAsync({
        transactionId,
        errorCode: err.code || 'UNKNOWN',
        errorMessage: err.message || String(err),
        errorStack: err.stack,
        operationType: options.operationType,
        userId: options.extractUserId?.(args),
      });

      // Re-throw to preserve original behavior
      throw err;
    }

    // ========================================================================
    // POST-EXECUTION: Log activity + Update intent + Take after snapshot
    // All logging is fire-and-forget - never blocks business logic
    // ========================================================================
    try {
      const durationMs = Date.now() - startTime;
      const entity = options.extractEntity ? options.extractEntity(args, result) : {};

      // Determine status based on result
      const isSuccess =
        !error && result !== null && (result as any)?.error === undefined;
      const activityStatus = isSuccess ? 'success' : 'failed';

      // Log activity (fire-and-forget)
      shadowLogger.logActivityAsync({
        transactionId,
        activityType: options.activityType,
        activityStatus,
        entityType: options.entityType,
        entityId: entity.entityId,
        entityNo: entity.entityNo,
        durationMs,
      });

      // Update intent if we have one (fire-and-forget)
      if (intentId) {
        const intent = options.extractIntent?.(args);
        shadowLogger
          .updateIntent(intentId, {
            status: isSuccess ? 'completed' : 'failed',
            itemsSucceeded: isSuccess ? intent?.itemsRequested || 0 : 0,
            itemsFailed: isSuccess ? 0 : intent?.itemsRequested || 0,
            qtySucceeded: isSuccess ? intent?.qtyRequested || 0 : 0,
            qtyFailed: isSuccess ? 0 : intent?.qtyRequested || 0,
          })
          .catch(() => {});
      }

      // Take after snapshots (fire-and-forget)
      if (options.captureStockSnapshot) {
        const snapshots = options.captureStockSnapshot(args);
        for (const snap of snapshots) {
          shadowLogger.takeStockSnapshotAsync({
            transactionId,
            ...snap,
            snapshotType: 'after',
          });
        }
      }

      // Complete transaction (fire-and-forget)
      shadowLogger
        .completeTransaction(transactionId, isSuccess ? 'completed' : 'failed')
        .catch(() => {});
    } catch (err) {
      // ❌ Never fail business logic due to logging
      console.error('[withActivityLog] Post-execution logging failed:', err);
    }

    return result!;
  };
}

// ============================================================================
// Simple Error Capture Wrapper
// ============================================================================

/**
 * Simple error capture wrapper
 * Use when you just want to capture errors without full activity logging
 *
 * Usage:
 * ```typescript
 * const result = await withErrorCapture(
 *   () => doSomething(),
 *   { operationType: 'SOME_OP' }
 * );
 * ```
 */
export async function withErrorCapture<T>(
  fn: () => Promise<T>,
  context: {
    transactionId?: string;
    operationType: string;
    entityType?: string;
    entityId?: string;
    userId?: number;
  }
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    // Log error (fire-and-forget)
    shadowLogger.logErrorAsync({
      transactionId: context.transactionId,
      errorCode: err.code || 'UNKNOWN',
      errorMessage: err.message || String(err),
      errorStack: err.stack,
      operationType: context.operationType,
      entityType: context.entityType,
      entityId: context.entityId,
      userId: context.userId,
    });

    // Re-throw to preserve original behavior
    throw err;
  }
}

// ============================================================================
// Quick Activity Logger (for manual use)
// ============================================================================

/**
 * Quick activity logger for manual use in existing code
 * Use when you can't wrap the entire function
 *
 * Usage:
 * ```typescript
 * // At start of function
 * const txId = await quickLog.start('MOVE', 'quick_move');
 *
 * // ... business logic ...
 *
 * // At end (success)
 * quickLog.success(txId, 'STOCK_MOVE', { entityId: moveId });
 *
 * // Or on error
 * quickLog.error(txId, error);
 * ```
 */
export const quickLog = {
  /**
   * Start a transaction - returns transaction ID immediately
   */
  async start(operationType: string, operationSubtype?: string): Promise<string> {
    return shadowLogger.startTransaction({ operationType, operationSubtype });
  },

  /**
   * Log success activity (fire-and-forget)
   */
  success(
    transactionId: string,
    activityType: string,
    options?: {
      entityType?: string;
      entityId?: string;
      entityNo?: string;
      metadata?: any;
    }
  ): void {
    shadowLogger.logActivityAsync({
      transactionId,
      activityType,
      activityStatus: 'success',
      ...options,
    });
    shadowLogger.completeTransaction(transactionId, 'completed').catch(() => {});
  },

  /**
   * Log failure activity (fire-and-forget)
   */
  failure(
    transactionId: string,
    activityType: string,
    error?: Error,
    options?: {
      entityType?: string;
      entityId?: string;
      metadata?: any;
    }
  ): void {
    shadowLogger.logActivityAsync({
      transactionId,
      activityType,
      activityStatus: 'failed',
      ...options,
    });
    if (error) {
      shadowLogger.logErrorAsync({
        transactionId,
        errorCode: (error as any).code || 'UNKNOWN',
        errorMessage: error.message,
        errorStack: error.stack,
      });
    }
    shadowLogger.completeTransaction(transactionId, 'failed').catch(() => {});
  },

  /**
   * Log error only (fire-and-forget)
   */
  error(transactionId: string, error: Error, operationType?: string): void {
    shadowLogger.logErrorAsync({
      transactionId,
      errorCode: (error as any).code || 'UNKNOWN',
      errorMessage: error.message,
      errorStack: error.stack,
      operationType,
    });
  },
};
