import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Idempotency และ Distributed Lock utilities สำหรับ API
 * 
 * Features:
 * 1. Idempotency - ป้องกัน process request ซ้ำ
 * 2. Distributed Lock - ป้องกัน concurrent access
 * 3. Request Hash - ตรวจสอบว่า request body เหมือนกัน
 */

// ============================================================================
// Types
// ============================================================================

export interface IdempotencyResult {
  isDuplicate: boolean;
  previousResponse?: any;
  previousStatus?: number;
}

export interface LockResult {
  acquired: boolean;
  lockKey: string;
  lockedBy: string;
}

// ============================================================================
// Idempotency Functions
// ============================================================================

/**
 * Generate idempotency key จาก request
 * ใช้ header 'X-Idempotency-Key' หรือ generate จาก request body
 */
export function getIdempotencyKey(request: NextRequest, fallbackPrefix?: string): string | null {
  // 1. ใช้ header ถ้ามี
  const headerKey = request.headers.get('X-Idempotency-Key');
  if (headerKey) {
    return headerKey;
  }
  
  // 2. ถ้าไม่มี header และไม่มี fallback → return null
  if (!fallbackPrefix) {
    return null;
  }
  
  // 3. Generate จาก timestamp (rounded to minute) + prefix
  return `${fallbackPrefix}_${Math.floor(Date.now() / 60000)}`;
}

/**
 * Generate hash จาก request body
 */
export function hashRequestBody(body: any): string {
  const bodyString = JSON.stringify(body);
  return crypto.createHash('sha256').update(bodyString).digest('hex');
}

/**
 * ตรวจสอบ idempotency จาก database
 */
export async function checkIdempotency(
  idempotencyKey: string,
  apiEndpoint: string
): Promise<IdempotencyResult> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('check_idempotency', {
    p_idempotency_key: idempotencyKey,
    p_api_endpoint: apiEndpoint
  });
  
  if (error) {
    console.error('Error checking idempotency:', error);
    return { isDuplicate: false };
  }
  
  const result = data?.[0];
  if (result?.is_duplicate) {
    return {
      isDuplicate: true,
      previousResponse: result.previous_response,
      previousStatus: result.previous_status
    };
  }
  
  return { isDuplicate: false };
}

/**
 * บันทึกผลลัพธ์ของ request สำหรับ idempotency
 */
export async function saveIdempotencyResult(
  idempotencyKey: string,
  apiEndpoint: string,
  requestHash: string | null,
  responseStatus: number,
  responseBody: any
): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase.rpc('save_idempotency_result', {
    p_idempotency_key: idempotencyKey,
    p_api_endpoint: apiEndpoint,
    p_request_hash: requestHash,
    p_response_status: responseStatus,
    p_response_body: responseBody
  });
  
  if (error) {
    console.error('Error saving idempotency result:', error);
  }
}

// ============================================================================
// Distributed Lock Functions
// ============================================================================

/**
 * Generate unique lock ID
 */
export function generateLockId(): string {
  return `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Acquire distributed lock
 */
export async function acquireLock(
  lockKey: string,
  lockedBy: string,
  timeoutSeconds: number = 30
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('acquire_lock', {
    p_lock_key: lockKey,
    p_locked_by: lockedBy,
    p_timeout_seconds: timeoutSeconds
  });
  
  if (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
  
  return data === true;
}

/**
 * Release distributed lock
 */
export async function releaseLock(
  lockKey: string,
  lockedBy: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('release_lock', {
    p_lock_key: lockKey,
    p_locked_by: lockedBy
  });
  
  if (error) {
    console.error('Error releasing lock:', error);
    return false;
  }
  
  return data === true;
}

// ============================================================================
// Middleware / Wrapper Functions
// ============================================================================

/**
 * Wrapper สำหรับ API ที่ต้องการ idempotency
 * 
 * Usage:
 * ```
 * export const POST = withIdempotency('my_api', async (request, context) => {
 *   // API logic here
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withIdempotency(
  apiEndpoint: string,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const idempotencyKey = getIdempotencyKey(request);
    
    // ถ้าไม่มี idempotency key → ทำงานปกติ
    if (!idempotencyKey) {
      return handler(request, context);
    }
    
    // ตรวจสอบ idempotency
    const idempotencyResult = await checkIdempotency(idempotencyKey, apiEndpoint);
    
    if (idempotencyResult.isDuplicate) {
      console.log(`⚠️ Duplicate request detected for ${apiEndpoint}: ${idempotencyKey}`);
      return NextResponse.json(
        {
          ...idempotencyResult.previousResponse,
          is_duplicate: true
        },
        { status: idempotencyResult.previousStatus || 200 }
      );
    }
    
    // Execute handler
    const response = await handler(request, context);
    
    // บันทึกผลลัพธ์
    const responseBody = await response.clone().json().catch(() => ({}));
    await saveIdempotencyResult(
      idempotencyKey,
      apiEndpoint,
      null,
      response.status,
      responseBody
    );
    
    return response;
  };
}

/**
 * Wrapper สำหรับ API ที่ต้องการ distributed lock
 * 
 * Usage:
 * ```
 * export const POST = withLock(
 *   (request) => `loadlist_${request.body.loadlist_id}`,
 *   async (request, context) => {
 *     // API logic here
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function withLock(
  getLockKey: (request: NextRequest, body: any) => string,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  timeoutSeconds: number = 30
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const body = await request.clone().json().catch(() => ({}));
    const lockKey = getLockKey(request, body);
    const lockedBy = generateLockId();
    
    // Acquire lock
    const acquired = await acquireLock(lockKey, lockedBy, timeoutSeconds);
    
    if (!acquired) {
      return NextResponse.json(
        {
          error: 'ไม่สามารถดำเนินการได้ - มีการ process อยู่',
          error_code: 'LOCK_NOT_ACQUIRED',
          lock_key: lockKey
        },
        { status: 409 }
      );
    }
    
    try {
      // Execute handler
      return await handler(request, context);
    } finally {
      // Always release lock
      await releaseLock(lockKey, lockedBy);
    }
  };
}

/**
 * Wrapper รวม idempotency + lock
 */
export function withIdempotencyAndLock(
  apiEndpoint: string,
  getLockKey: (request: NextRequest, body: any) => string,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  timeoutSeconds: number = 30
) {
  return withIdempotency(
    apiEndpoint,
    withLock(getLockKey, handler, timeoutSeconds)
  );
}
