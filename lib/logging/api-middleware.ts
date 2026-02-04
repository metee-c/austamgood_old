// lib/logging/api-middleware.ts
// Shadow Command Center - API Route Middleware
//
// 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
// ❌ ไม่เปลี่ยน return value
// ❌ ไม่เปลี่ยน throw behavior
// ✅ wrap API route handlers "ครอบจากข้างนอก"

import { NextRequest, NextResponse } from 'next/server';
import { shadowLogger } from './shadow-logger';

// ============================================================================
// Types
// ============================================================================

export interface ApiLogOptions {
  operationType: string;
  activityType: string;
  entityType?: string;
  extractEntityId?: (body: any, result: any) => string | undefined;
  extractEntityNo?: (body: any, result: any) => string | undefined;
  extractUserId?: (request: NextRequest) => number | undefined;
}

// ============================================================================
// API Route Wrapper
// ============================================================================

/**
 * Wrap an API route handler with shadow logging
 * 
 * 🔒 GOLDEN RULE:
 * - ถ้า logging fail → API ยังทำงานปกติ
 * - response เหมือนเดิม 100%
 * - error behavior เหมือนเดิม 100%
 * 
 * Usage:
 * ```typescript
 * export const POST = withApiLog(
 *   async (request: NextRequest) => {
 *     // Original handler logic - unchanged
 *     return NextResponse.json({ data: result });
 *   },
 *   {
 *     operationType: 'ADJUSTMENT',
 *     activityType: 'STOCK_ADJUST_CREATE',
 *     entityType: 'ADJUSTMENT',
 *   }
 * );
 * ```
 */
export function withApiLog(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: ApiLogOptions
): (request: NextRequest, context?: any) => Promise<NextResponse> {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    let transactionId: string = '';
    let requestBody: any = null;

    // ========================================================================
    // PRE-EXECUTION: Start transaction + Parse body (fire-and-forget)
    // ========================================================================
    try {
      // Try to parse request body for logging (clone to avoid consuming)
      try {
        const clonedRequest = request.clone();
        requestBody = await clonedRequest.json().catch(() => null);
      } catch {
        // Body parsing failed - continue without it
      }

      transactionId = await shadowLogger.startTransaction({
        operationType: options.operationType,
        operationSubtype: request.method,
        userId: options.extractUserId?.(request),
        requestPath: request.nextUrl.pathname,
        requestMethod: request.method,
        requestBody: requestBody ? { summary: summarizePayload(requestBody) } : undefined,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch {
      // ❌ Never fail API due to logging
    }

    // ========================================================================
    // EXECUTION: Run original handler (UNCHANGED)
    // ========================================================================
    let response: NextResponse;
    let error: Error | null = null;
    let responseData: any = null;

    try {
      response = await handler(request, context);

      // Try to parse response for logging
      try {
        const clonedResponse = response.clone();
        responseData = await clonedResponse.json().catch(() => null);
      } catch {
        // Response parsing failed - continue without it
      }
    } catch (err: any) {
      error = err;

      // Log error (fire-and-forget)
      shadowLogger.logErrorAsync({
        transactionId,
        errorCode: err.code || 'API_ERROR',
        errorMessage: err.message || String(err),
        errorStack: err.stack,
        operationType: options.operationType,
        entityType: options.entityType,
        userId: options.extractUserId?.(request),
        requestPath: request.nextUrl.pathname,
        requestBody: requestBody ? { summary: summarizePayload(requestBody) } : undefined,
      });

      // Re-throw to preserve original behavior
      throw err;
    }

    // ========================================================================
    // POST-EXECUTION: Log activity (fire-and-forget)
    // ========================================================================
    try {
      const durationMs = Date.now() - startTime;
      const statusCode = response.status;
      const isSuccess = statusCode >= 200 && statusCode < 400;
      const activityStatus = isSuccess ? 'success' : 'failed';

      shadowLogger.logActivityAsync({
        transactionId,
        activityType: options.activityType,
        activityStatus,
        entityType: options.entityType,
        entityId: options.extractEntityId?.(requestBody, responseData),
        entityNo: options.extractEntityNo?.(requestBody, responseData),
        durationMs,
        metadata: {
          statusCode,
          method: request.method,
          path: request.nextUrl.pathname,
        },
      });

      // Complete transaction
      shadowLogger
        .completeTransaction(transactionId, isSuccess ? 'completed' : 'failed')
        .catch(() => {});
    } catch {
      // ❌ Never fail API due to logging
    }

    return response;
  };
}

// ============================================================================
// Quick API Logger (for manual use in existing routes)
// ============================================================================

/**
 * Quick API logger for manual use in existing routes
 * Use when you can't wrap the entire handler
 * 
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const txId = await apiLog.start('PICK', request);
 *   
 *   try {
 *     // ... business logic ...
 *     apiLog.success(txId, 'PICK_CONFIRM', { entityId: picklistId });
 *     return NextResponse.json({ data: result });
 *   } catch (err) {
 *     apiLog.failure(txId, 'PICK_CONFIRM', err);
 *     throw err;
 *   }
 * }
 * ```
 */
export const apiLog = {
  /**
   * Start a transaction for an API request
   */
  async start(operationType: string, request: NextRequest): Promise<string> {
    try {
      return await shadowLogger.startTransaction({
        operationType,
        operationSubtype: request.method,
        requestPath: request.nextUrl.pathname,
        requestMethod: request.method,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch {
      return crypto.randomUUID(); // Return a UUID even if logging fails
    }
  },

  /**
   * Log success (fire-and-forget)
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
   * Log failure (fire-and-forget)
   */
  failure(
    transactionId: string,
    activityType: string,
    error?: Error | any,
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
        errorCode: error.code || 'API_ERROR',
        errorMessage: error.message || String(error),
        errorStack: error.stack,
      });
    }
    shadowLogger.completeTransaction(transactionId, 'failed').catch(() => {});
  },

  /**
   * Log error only (fire-and-forget)
   */
  error(transactionId: string, error: Error | any, operationType?: string): void {
    shadowLogger.logErrorAsync({
      transactionId,
      errorCode: error.code || 'API_ERROR',
      errorMessage: error.message || String(error),
      errorStack: error.stack,
      operationType,
    });
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Summarize payload for logging (avoid logging sensitive/large data)
 */
function summarizePayload(payload: any): any {
  if (!payload) return null;
  if (typeof payload !== 'object') return payload;

  const summary: any = {};
  const keys = Object.keys(payload);

  for (const key of keys.slice(0, 20)) { // Limit to 20 keys
    const value = payload[key];
    
    // Skip sensitive fields
    if (['password', 'token', 'secret', 'apiKey', 'api_key'].includes(key.toLowerCase())) {
      summary[key] = '[REDACTED]';
      continue;
    }

    // Summarize arrays
    if (Array.isArray(value)) {
      summary[key] = `[Array(${value.length})]`;
      continue;
    }

    // Summarize nested objects
    if (typeof value === 'object' && value !== null) {
      summary[key] = `[Object]`;
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 100) {
      summary[key] = value.substring(0, 100) + '...';
      continue;
    }

    summary[key] = value;
  }

  if (keys.length > 20) {
    summary['...'] = `+${keys.length - 20} more keys`;
  }

  return summary;
}
