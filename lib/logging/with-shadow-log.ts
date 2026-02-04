// lib/logging/with-shadow-log.ts
// Universal lightweight API route wrapper for 100% coverage
//
// 🔒 GOLDEN RULE: Shadow system ห้ามทำให้ business operation fail
// ❌ ไม่เปลี่ยน return value
// ❌ ไม่เปลี่ยน throw behavior
// ✅ wrap API route handlers "ครอบจากข้างนอก" แบบ auto-derive ทุกอย่าง
//
// Usage:
//   import { withShadowLog } from '@/lib/logging/with-shadow-log';
//
//   // Wrap standalone handler
//   export const GET = withShadowLog(handleGet);
//
//   // Compose with withAuth
//   export const POST = withShadowLog(withAuth(handlePost));

import { NextRequest, NextResponse } from 'next/server';
import { shadowLogger } from './shadow-logger';

// ============================================================================
// Path → Operation Type mapping
// ============================================================================

/**
 * Auto-derive operation type from URL path
 * e.g. /api/moves/123/status → MOVES
 * e.g. /api/mobile/pick/scan → MOBILE_PICK
 * e.g. /api/master-sku → MASTER_SKU
 * e.g. /api/stock-adjustments/123/approve → STOCK_ADJUSTMENTS
 */
function deriveOperationType(path: string): string {
  try {
    // Remove /api/ prefix
    const stripped = path.replace(/^\/api\//, '');
    // Split segments
    const segments = stripped.split('/');

    // Take first 1-2 meaningful segments (skip dynamic [id] segments)
    const meaningful: string[] = [];
    for (const seg of segments) {
      if (meaningful.length >= 2) break;
      // Skip dynamic segments (UUIDs, numbers, [param])
      if (/^\[/.test(seg)) continue;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(seg)) continue;
      if (/^\d+$/.test(seg)) continue;
      meaningful.push(seg);
    }

    if (meaningful.length === 0) return 'API';

    return meaningful
      .join('_')
      .toUpperCase()
      .replace(/-/g, '_');
  } catch {
    return 'API';
  }
}

/**
 * Summarize request body for logging (avoid large/sensitive data)
 */
function summarizeBody(body: any): any {
  if (!body) return null;
  if (typeof body !== 'object') return body;

  const summary: any = {};
  const keys = Object.keys(body);
  const SENSITIVE = ['password', 'token', 'secret', 'apikey', 'api_key', 'authorization'];

  for (const key of keys.slice(0, 15)) {
    const lower = key.toLowerCase();
    if (SENSITIVE.includes(lower)) {
      summary[key] = '[REDACTED]';
    } else if (Array.isArray(body[key])) {
      summary[key] = `[Array(${body[key].length})]`;
    } else if (typeof body[key] === 'object' && body[key] !== null) {
      summary[key] = '[Object]';
    } else if (typeof body[key] === 'string' && body[key].length > 80) {
      summary[key] = body[key].substring(0, 80) + '...';
    } else {
      summary[key] = body[key];
    }
  }

  if (keys.length > 15) {
    summary['...'] = `+${keys.length - 15} more`;
  }

  return summary;
}

// ============================================================================
// withShadowLog - Universal wrapper
// ============================================================================

type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse;

/**
 * Universal lightweight API route wrapper
 *
 * Auto-derives operation type from URL path.
 * Captures: path, method, status, duration, IP, user-agent, body summary.
 * Fire-and-forget: never blocks or fails the business operation.
 *
 * @example
 * // Standalone
 * export const GET = withShadowLog(handleGet);
 *
 * // With auth
 * export const POST = withShadowLog(withAuth(handlePost));
 */
export function withShadowLog(
  handler: RouteHandler
): (request: NextRequest, context?: any) => Promise<NextResponse> {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    let transactionId = '';
    let requestBody: any = null;
    const path = request.nextUrl?.pathname || '';
    const method = request.method || 'UNKNOWN';
    const operationType = deriveOperationType(path);

    // ========================================================================
    // PRE: Start transaction (fire-and-forget)
    // ========================================================================
    try {
      // Try to clone and parse body for mutation methods
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        try {
          const cloned = request.clone();
          requestBody = await cloned.json().catch(() => null);
        } catch {
          // Body parse failed - continue
        }
      }

      transactionId = await shadowLogger.startTransaction({
        operationType,
        operationSubtype: method,
        requestPath: path,
        requestMethod: method,
        requestBody: requestBody ? { summary: summarizeBody(requestBody) } : undefined,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch {
      // ❌ Never fail
      if (!transactionId) transactionId = crypto.randomUUID();
    }

    // ========================================================================
    // EXECUTE: Run original handler (UNCHANGED behavior)
    // ========================================================================
    let response: NextResponse;
    try {
      response = await handler(request, context);
    } catch (err: any) {
      // Log unhandled error (fire-and-forget)
      try {
        shadowLogger.logErrorAsync({
          transactionId,
          errorCode: err?.code || 'UNHANDLED_ERROR',
          errorMessage: err?.message || String(err),
          errorStack: err?.stack,
          operationType,
          requestPath: path,
          requestBody: requestBody ? { summary: summarizeBody(requestBody) } : undefined,
        });
        shadowLogger.logActivityAsync({
          transactionId,
          activityType: `${method}_${operationType}`,
          activityStatus: 'failed',
          durationMs: Date.now() - startTime,
          metadata: { path, method, error: err?.message },
        });
        shadowLogger.completeTransaction(transactionId, 'failed').catch(() => {});
      } catch {
        // ❌ Never fail
      }
      // Re-throw original error to preserve behavior
      throw err;
    }

    // ========================================================================
    // POST: Log activity (fire-and-forget)
    // ========================================================================
    try {
      const durationMs = Date.now() - startTime;
      const statusCode = response.status;
      const isSuccess = statusCode >= 200 && statusCode < 400;

      // Try to extract entity info from response body
      let entityType: string | undefined;
      let entityId: string | undefined;
      let entityNo: string | undefined;
      try {
        if (!isSuccess || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const clonedResp = response.clone();
          const respData = await clonedResp.json().catch(() => null);
          if (respData) {
            // Extract error message for failed responses
            if (!isSuccess && respData.error) {
              entityType = operationType;
              // Log the error
              shadowLogger.logErrorAsync({
                transactionId,
                errorCode: `HTTP_${statusCode}`,
                errorMessage: typeof respData.error === 'string' ? respData.error : JSON.stringify(respData.error),
                operationType,
                requestPath: path,
                requestBody: requestBody ? { summary: summarizeBody(requestBody) } : undefined,
              });
            }
            // Try to extract entity info from successful response
            const data = respData.data || respData;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
              entityId = data.id?.toString() || data.move_id?.toString() || data.receive_id?.toString() ||
                data.order_id?.toString() || data.adjustment_id?.toString() || data.balance_id?.toString() ||
                data.picklist_id?.toString() || data.loadlist_id?.toString() || data.face_sheet_id?.toString() ||
                data.batch_id?.toString() || data.session_id?.toString() || data.plan_id?.toString();
              entityNo = data.move_no || data.receive_no || data.order_no || data.adjustment_no ||
                data.picklist_no || data.loadlist_no || data.face_sheet_no || data.batch_no ||
                data.plan_code || data.plan_name;
            }
          }
        }
      } catch {
        // Response parsing failed - continue without entity info
      }

      shadowLogger.logActivityAsync({
        transactionId,
        activityType: `${method}_${operationType}`,
        activityStatus: isSuccess ? 'success' : 'failed',
        entityType: entityType || operationType,
        entityId,
        entityNo,
        durationMs,
        metadata: { statusCode, path, method },
      });

      shadowLogger.completeTransaction(
        transactionId,
        isSuccess ? 'completed' : 'failed'
      ).catch(() => {});
    } catch {
      // ❌ Never fail
    }

    return response;
  };
}

// Export for convenience
export { deriveOperationType };
