// lib/logging/service-wrappers.ts
// Shadow Command Center - Service Wrappers
//
// 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
// ❌ ไม่เปลี่ยน return value
// ❌ ไม่เปลี่ยน throw behavior
// ❌ ไม่เพิ่ม validation
// ❌ ไม่เพิ่ม side effects
// ✅ wrap code เดิม "ครอบจากข้างนอก"
// ✅ logic ภายในต้องเหมือนเดิม 100%

import { shadowLogger } from './shadow-logger';

// ============================================================================
// Types
// ============================================================================

export interface ServiceMethodOptions {
  operationType: string;
  activityType: string;
  entityType?: string;
  extractEntityId?: (result: any) => string | undefined;
  extractEntityNo?: (result: any) => string | undefined;
  extractUserId?: (args: any[]) => number | undefined;
  extractItemCount?: (args: any[]) => number;
  extractQty?: (args: any[]) => number;
  isMutation?: boolean; // true = เปลี่ยน state, false = read-only
}

// ============================================================================
// Generic Service Method Wrapper
// ============================================================================

/**
 * Wrap a service method with shadow logging
 * 
 * 🔒 GOLDEN RULE:
 * - ถ้า logging fail → business ยังทำงานปกติ
 * - return value เหมือนเดิม 100%
 * - throw behavior เหมือนเดิม 100%
 */
export function wrapServiceMethod<TArgs extends any[], TResult>(
  methodName: string,
  originalMethod: (...args: TArgs) => Promise<TResult>,
  options: ServiceMethodOptions
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    // Skip logging for read-only operations to reduce noise
    if (options.isMutation === false) {
      return originalMethod(...args);
    }

    const startTime = Date.now();
    let transactionId: string = '';

    // ========================================================================
    // PRE-EXECUTION: Start transaction (fire-and-forget)
    // ========================================================================
    try {
      transactionId = await shadowLogger.startTransaction({
        operationType: options.operationType,
        operationSubtype: methodName,
        userId: options.extractUserId?.(args),
      });
    } catch {
      // ❌ Never fail business logic
    }

    // ========================================================================
    // EXECUTION: Run original method (UNCHANGED)
    // ========================================================================
    let result: TResult;
    let error: Error | null = null;

    try {
      result = await originalMethod(...args);
    } catch (err: any) {
      error = err;

      // Log error (fire-and-forget)
      shadowLogger.logErrorAsync({
        transactionId,
        errorCode: err.code || 'UNKNOWN',
        errorMessage: err.message || String(err),
        errorStack: err.stack,
        operationType: options.operationType,
        entityType: options.entityType,
        userId: options.extractUserId?.(args),
      });

      // Re-throw to preserve original behavior
      throw err;
    }

    // ========================================================================
    // POST-EXECUTION: Log activity (fire-and-forget)
    // ========================================================================
    try {
      const durationMs = Date.now() - startTime;
      
      // Determine success based on result pattern { data, error }
      const isSuccess = result !== null && 
        (result as any)?.error === undefined && 
        (result as any)?.error === null;
      
      const activityStatus = isSuccess ? 'success' : 'failed';

      shadowLogger.logActivityAsync({
        transactionId,
        activityType: options.activityType,
        activityStatus,
        entityType: options.entityType,
        entityId: options.extractEntityId?.(result),
        entityNo: options.extractEntityNo?.(result),
        durationMs,
        metadata: {
          methodName,
          argsCount: args.length,
        },
      });

      // Complete transaction
      shadowLogger
        .completeTransaction(transactionId, isSuccess ? 'completed' : 'failed')
        .catch(() => {});
    } catch {
      // ❌ Never fail business logic
    }

    return result;
  };
}

// ============================================================================
// Stock Adjustment Service Wrapper
// ============================================================================

import { stockAdjustmentService } from '@/lib/database/stock-adjustment';

export const wrappedStockAdjustmentService = {
  // Read-only methods - no logging needed
  getAdjustments: stockAdjustmentService.getAdjustments.bind(stockAdjustmentService),
  getAdjustmentById: stockAdjustmentService.getAdjustmentById.bind(stockAdjustmentService),
  getAdjustmentReasons: stockAdjustmentService.getAdjustmentReasons.bind(stockAdjustmentService),
  generateAdjustmentNo: stockAdjustmentService.generateAdjustmentNo.bind(stockAdjustmentService),
  validateReservedStock: stockAdjustmentService.validateReservedStock.bind(stockAdjustmentService),

  // Mutation methods - wrapped with logging
  createAdjustment: wrapServiceMethod(
    'createAdjustment',
    stockAdjustmentService.createAdjustment.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_CREATE',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      extractUserId: (args) => args[0]?.created_by,
      isMutation: true,
    }
  ),

  updateAdjustment: wrapServiceMethod(
    'updateAdjustment',
    stockAdjustmentService.updateAdjustment.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_UPDATE',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      isMutation: true,
    }
  ),

  submitForApproval: wrapServiceMethod(
    'submitForApproval',
    stockAdjustmentService.submitForApproval.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_SUBMIT',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      isMutation: true,
    }
  ),

  approveAdjustment: wrapServiceMethod(
    'approveAdjustment',
    stockAdjustmentService.approveAdjustment.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_APPROVE',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      extractUserId: (args) => args[1], // userId is second arg
      isMutation: true,
    }
  ),

  rejectAdjustment: wrapServiceMethod(
    'rejectAdjustment',
    stockAdjustmentService.rejectAdjustment.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_REJECT',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      extractUserId: (args) => args[1], // userId is second arg
      isMutation: true,
    }
  ),

  completeAdjustment: wrapServiceMethod(
    'completeAdjustment',
    stockAdjustmentService.completeAdjustment.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_COMPLETE',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      extractUserId: (args) => args[1], // userId is second arg
      isMutation: true,
    }
  ),

  cancelAdjustment: wrapServiceMethod(
    'cancelAdjustment',
    stockAdjustmentService.cancelAdjustment.bind(stockAdjustmentService),
    {
      operationType: 'ADJUSTMENT',
      activityType: 'STOCK_ADJUST_CANCEL',
      entityType: 'ADJUSTMENT',
      extractEntityId: (result) => result?.data?.adjustment_id?.toString(),
      extractEntityNo: (result) => result?.data?.adjustment_no,
      extractUserId: (args) => args[1], // userId is second arg
      isMutation: true,
    }
  ),
};

// ============================================================================
// Move Service Wrapper
// ============================================================================

import { moveService } from '@/lib/database/move';

export const wrappedMoveService = {
  // Read-only methods - no logging needed
  getMoves: moveService.getMoves.bind(moveService),
  getMoveById: moveService.getMoveById.bind(moveService),
  generateMoveNo: moveService.generateMoveNo.bind(moveService),
  validateDestinationLocation: moveService.validateDestinationLocation.bind(moveService),
  recalculateMoveHeaderStatus: moveService.recalculateMoveHeaderStatus.bind(moveService),
  checkAndUpdateReceiveStatus: moveService.checkAndUpdateReceiveStatus.bind(moveService),

  // Mutation methods - wrapped with logging
  createMove: wrapServiceMethod(
    'createMove',
    moveService.createMove.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_CREATE',
      entityType: 'MOVE',
      extractEntityId: (result) => result?.data?.move_id?.toString(),
      extractEntityNo: (result) => result?.data?.move_no,
      extractUserId: (args) => args[0]?.created_by,
      isMutation: true,
    }
  ),

  updateMove: wrapServiceMethod(
    'updateMove',
    moveService.updateMove.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_UPDATE',
      entityType: 'MOVE',
      extractEntityId: (result) => result?.data?.move_id?.toString(),
      extractEntityNo: (result) => result?.data?.move_no,
      isMutation: true,
    }
  ),

  updateMoveStatus: wrapServiceMethod(
    'updateMoveStatus',
    moveService.updateMoveStatus.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_STATUS_UPDATE',
      entityType: 'MOVE',
      extractEntityId: (result) => result?.data?.move_id?.toString(),
      extractEntityNo: (result) => result?.data?.move_no,
      isMutation: true,
    }
  ),

  updateMoveItemStatus: wrapServiceMethod(
    'updateMoveItemStatus',
    moveService.updateMoveItemStatus.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_ITEM_STATUS_UPDATE',
      entityType: 'MOVE_ITEM',
      isMutation: true,
    }
  ),

  recordInventoryMovement: wrapServiceMethod(
    'recordInventoryMovement',
    moveService.recordInventoryMovement.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_RECORD_INVENTORY',
      entityType: 'MOVE_ITEM',
      isMutation: true,
    }
  ),

  updateInventoryBalance: wrapServiceMethod(
    'updateInventoryBalance',
    moveService.updateInventoryBalance.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_UPDATE_BALANCE',
      entityType: 'INVENTORY_BALANCE',
      isMutation: true,
    }
  ),

  updateLocationCurrentData: wrapServiceMethod(
    'updateLocationCurrentData',
    moveService.updateLocationCurrentData.bind(moveService),
    {
      operationType: 'MOVE',
      activityType: 'STOCK_MOVE_UPDATE_LOCATION',
      entityType: 'LOCATION',
      isMutation: true,
    }
  ),
};

// ============================================================================
// Receive Service Wrapper
// ============================================================================

import { receiveService } from '@/lib/database/receive';

export const wrappedReceiveService = {
  // Read-only methods - no logging needed
  getAllReceives: receiveService.getAllReceives.bind(receiveService),
  getReceiveById: receiveService.getReceiveById.bind(receiveService),
  generateReceiveNo: receiveService.generateReceiveNo.bind(receiveService),
  generatePalletId: receiveService.generatePalletId.bind(receiveService),
  generateMultiplePalletIds: receiveService.generateMultiplePalletIds.bind(receiveService),
  generateSplitPalletId: receiveService.generateSplitPalletId.bind(receiveService),
  getLatestPalletId: receiveService.getLatestPalletId.bind(receiveService),
  getDashboardStats: receiveService.getDashboardStats.bind(receiveService),

  // Mutation methods - wrapped with logging
  createReceive: wrapServiceMethod(
    'createReceive',
    receiveService.createReceive.bind(receiveService),
    {
      operationType: 'RECEIVE',
      activityType: 'STOCK_RECEIVE_CREATE',
      entityType: 'RECEIVE',
      extractEntityId: (result) => result?.data?.receive_id?.toString(),
      extractEntityNo: (result) => result?.data?.receive_no,
      extractUserId: (args) => args[0]?.created_by,
      isMutation: true,
    }
  ),

  updateReceive: wrapServiceMethod(
    'updateReceive',
    receiveService.updateReceive.bind(receiveService),
    {
      operationType: 'RECEIVE',
      activityType: 'STOCK_RECEIVE_UPDATE',
      entityType: 'RECEIVE',
      extractEntityId: (result) => result?.data?.receive_id?.toString(),
      extractEntityNo: (result) => result?.data?.receive_no,
      isMutation: true,
    }
  ),

  updateReceiveItems: wrapServiceMethod(
    'updateReceiveItems',
    receiveService.updateReceiveItems.bind(receiveService),
    {
      operationType: 'RECEIVE',
      activityType: 'STOCK_RECEIVE_ITEMS_UPDATE',
      entityType: 'RECEIVE',
      isMutation: true,
    }
  ),

  validatePalletScan: wrapServiceMethod(
    'validatePalletScan',
    receiveService.validatePalletScan.bind(receiveService),
    {
      operationType: 'RECEIVE',
      activityType: 'STOCK_RECEIVE_PALLET_SCAN',
      entityType: 'RECEIVE_ITEM',
      isMutation: true,
    }
  ),
};

// ============================================================================
// Order Rollback Service Wrapper
// ============================================================================

import { orderRollbackService } from '@/lib/database/order-rollback';

export const wrappedOrderRollbackService = {
  // Read-only methods - no logging needed
  getRollbackPreview: orderRollbackService.getRollbackPreview.bind(orderRollbackService),
  getRollbackHistory: orderRollbackService.getRollbackHistory.bind(orderRollbackService),
  canRollback: orderRollbackService.canRollback.bind(orderRollbackService),

  // Mutation methods - wrapped with logging
  executeRollback: wrapServiceMethod(
    'executeRollback',
    orderRollbackService.executeRollback.bind(orderRollbackService),
    {
      operationType: 'ROLLBACK',
      activityType: 'ORDER_ROLLBACK_EXECUTE',
      entityType: 'ORDER',
      extractEntityId: (result) => result?.data?.orderId?.toString(),
      extractEntityNo: (result) => result?.data?.orderNo,
      extractUserId: (args) => args[0]?.userId,
      isMutation: true,
    }
  ),
};
