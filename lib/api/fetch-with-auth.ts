/**
 * Fetch wrapper ที่จัดการ session expired อัตโนมัติ
 * แสดง popup แจ้งผู้ใช้เมื่อ session หมดอายุ แทนที่จะแสดง error แปลกๆ
 */

// Event สำหรับแจ้ง session expired
export const SESSION_EXPIRED_EVENT = 'session-expired';

/**
 * ตรวจสอบว่า response เป็น HTML (redirect ไป login) หรือไม่
 */
function isHtmlResponse(text: string): boolean {
  return text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
}

/**
 * ตรวจสอบว่า response เป็น redirect ไป login หรือไม่
 */
function isLoginRedirect(response: Response): boolean {
  // Check if redirected to login page
  if (response.redirected && response.url.includes('/login')) {
    return true;
  }
  return false;
}

/**
 * Dispatch event เมื่อ session หมดอายุ
 */
function dispatchSessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

/**
 * Fetch wrapper ที่จัดการ session expired
 * ใช้แทน fetch() ปกติสำหรับ API calls
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // ส่ง cookies ไปด้วย
  });

  // ถ้า redirect ไป login = session expired
  if (isLoginRedirect(response)) {
    dispatchSessionExpired();
    throw new SessionExpiredError('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  return response;
}

/**
 * Fetch JSON wrapper ที่จัดการ session expired
 * ใช้แทน fetch().then(r => r.json()) ปกติ
 */
export async function fetchJsonWithAuth<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  // ถ้า redirect ไป login = session expired
  if (isLoginRedirect(response)) {
    dispatchSessionExpired();
    throw new SessionExpiredError('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  // อ่าน response เป็น text ก่อน
  const text = await response.text();

  // ถ้าเป็น HTML = redirect ไป login (session expired)
  if (isHtmlResponse(text)) {
    dispatchSessionExpired();
    throw new SessionExpiredError('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  // Parse JSON
  try {
    return JSON.parse(text);
  } catch {
    // ถ้า parse ไม่ได้ อาจเป็น HTML error page
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      dispatchSessionExpired();
      throw new SessionExpiredError('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
  }
}

/**
 * Custom error class สำหรับ session expired
 */
export class SessionExpiredError extends Error {
  constructor(message: string = 'Session หมดอายุ') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * ตรวจสอบว่า error เป็น SessionExpiredError หรือไม่
 */
export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

/**
 * ตรวจสอบว่า error message บ่งบอกว่า session expired หรือไม่
 */
export function isSessionExpiredMessage(message: string): boolean {
  const patterns = [
    'Unexpected token',
    '<!DOCTYPE',
    'is not valid JSON',
    'session expired',
    'session หมดอายุ',
  ];
  return patterns.some(p => message.toLowerCase().includes(p.toLowerCase()));
}
