// lib/logging/index.ts
// Shadow Command Center - Exports
//
// 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail

// Core logger
export {
  shadowLogger,
  ShadowLogger,
  type TransactionContext,
  type ActivityLogEntry,
  type ActivityLogItem,
  type UserIntent,
  type IntentResult,
  type ErrorLogEntry,
  type StockSnapshotParams,
} from './shadow-logger';

// Activity log wrapper
export {
  withActivityLog,
  withErrorCapture,
  quickLog,
  type ActivityContext,
  type WithActivityLogOptions,
} from './with-activity-log';

// Service wrappers (use these instead of original services for automatic logging)
export {
  wrapServiceMethod,
  wrappedStockAdjustmentService,
  wrappedMoveService,
  wrappedReceiveService,
  wrappedOrderRollbackService,
  type ServiceMethodOptions,
} from './service-wrappers';

// API middleware
export {
  withApiLog,
  apiLog,
  type ApiLogOptions,
} from './api-middleware';

// Universal lightweight wrapper (100% API coverage)
export {
  withShadowLog,
  deriveOperationType,
} from './with-shadow-log';
