// ===== Error Handler Utility =====
// Phase 2: เพิ่ม Error Handling ตาม edit21.md

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Handle API errors and extract meaningful error information
 */
export function handleApiError(error: any): ApiError {
  console.error('[Routes API Error]', error);
  
  if (error?.response?.data?.error) {
    return {
      message: error.response.data.error,
      code: error.response.data.error_code,
      details: error.response.data.details
    };
  }
  
  if (error?.message) {
    return { message: error.message };
  }
  
  return { message: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง' };
}

/**
 * Get user-friendly error message based on error code
 */
export function getErrorMessage(error: ApiError): string {
  const errorMessages: Record<string, string> = {
    'UNAUTHORIZED': 'กรุณาเข้าสู่ระบบใหม่',
    'FORBIDDEN': 'คุณไม่มีสิทธิ์ดำเนินการนี้',
    'NOT_FOUND': 'ไม่พบข้อมูลที่ต้องการ',
    'VALIDATION_ERROR': 'ข้อมูลไม่ถูกต้อง',
    'DUPLICATE': 'ข้อมูลซ้ำในระบบ',
    'CONFLICT': 'ข้อมูลถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่',
    'NETWORK_ERROR': 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
    'TIMEOUT': 'การเชื่อมต่อหมดเวลา กรุณาลองใหม่',
  };
  
  return errorMessages[error.code || ''] || error.message;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
  return (
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('Failed to fetch') ||
    error?.code === 'NETWORK_ERROR'
  );
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: any): boolean {
  return (
    error?.code === 'UNAUTHORIZED' ||
    error?.code === 'FORBIDDEN' ||
    error?.status === 401 ||
    error?.status === 403
  );
}
