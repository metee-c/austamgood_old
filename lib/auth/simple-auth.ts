// Simple Authentication Service - ไม่ใช้ session management
import { createClient } from '@/lib/supabase/server';
import { hashPassword, verifyPassword } from './password';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '24h'; // Token หมดอายุใน 24 ชั่วโมง

export interface SimpleLoginCredentials {
  email: string;
  password: string;
}

export interface SimpleLoginResult {
  success: boolean;
  user?: {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    role_id: number;
    role_name: string;
    employee_id: number | null;
  };
  token?: string;
  error?: string;
}

export interface TokenPayload {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  employee_id: number | null;
  // ✅ Add unique identifiers to prevent token reuse
  jti?: string; // JWT ID - unique identifier for this token
  iat?: number;
  exp?: number;
}

export interface UserFromTokenResult {
  success: boolean;
  user?: {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    role_id: number;
    role_name: string;
    employee_id: number | null;
  };
  error?: string;
}

/**
 * เข้าสู่ระบบแบบง่าย - เช็คจาก master_system_user เท่านั้น
 */
export async function simpleLogin(credentials: SimpleLoginCredentials): Promise<SimpleLoginResult> {
  const { email, password } = credentials;

  try {
    const supabase = await createClient();

    // ดึงข้อมูลผู้ใช้จากฐานข้อมูล
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        username,
        email,
        password_hash,
        full_name,
        role_id,
        employee_id,
        is_active,
        master_system_role!fk_master_system_user_role (
          role_name
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      };
    }

    // ตรวจสอบว่าบัญชีเปิดใช้งานอยู่หรือไม่
    if (!userData.is_active) {
      return {
        success: false,
        error: 'บัญชีของคุณถูกระงับการใช้งาน'
      };
    }

    // ตรวจสอบรหัสผ่าน
    const passwordValid = await verifyPassword(password, userData.password_hash);
    if (!passwordValid) {
      return {
        success: false,
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      };
    }

    // อัพเดท last_login
    await supabase
      .from('master_system_user')
      .update({ last_login: new Date().toISOString() })
      .eq('user_id', userData.user_id);

    // Extract role name
    const masterRole = userData.master_system_role as any;
    const roleName = Array.isArray(masterRole)
      ? masterRole[0]?.role_name
      : masterRole?.role_name || 'Unknown';

    // สร้าง JWT token with unique identifier
    const crypto = require('crypto');
    const jti = crypto.randomBytes(16).toString('hex'); // ✅ Unique token ID
    
    const tokenPayload: TokenPayload = {
      user_id: userData.user_id,
      username: userData.username,
      email: userData.email,
      full_name: userData.full_name,
      role_id: userData.role_id,
      employee_id: userData.employee_id,
      jti // ✅ Add unique identifier to prevent token reuse
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return {
      success: true,
      user: {
        user_id: userData.user_id,
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name,
        role_id: userData.role_id,
        role_name: roleName,
        employee_id: userData.employee_id
      },
      token
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * ตรวจสอบ JWT token
 */
export function verifyToken(token: string): { valid: boolean; payload?: TokenPayload; error?: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return {
      valid: true,
      payload
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * ดึงข้อมูลผู้ใช้จาก token
 */
export async function getUserFromToken(token: string): Promise<UserFromTokenResult> {
  const verification = verifyToken(token);
  
  if (!verification.valid || !verification.payload) {
    return {
      success: false,
      error: 'Token ไม่ถูกต้องหรือหมดอายุ'
    };
  }

  try {
    const supabase = await createClient();

    // ตรวจสอบว่าผู้ใช้ยังคงมีอยู่และเปิดใช้งาน
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        username,
        email,
        full_name,
        role_id,
        employee_id,
        is_active,
        master_system_role!fk_master_system_user_role (
          role_name
        )
      `)
      .eq('user_id', verification.payload.user_id)
      .single();

    if (userError || !userData || !userData.is_active) {
      return {
        success: false,
        error: 'ผู้ใช้ไม่พบหรือถูกระงับการใช้งาน'
      };
    }

    // Extract role name
    const masterRole = userData.master_system_role as any;
    const roleName = Array.isArray(masterRole)
      ? masterRole[0]?.role_name
      : masterRole?.role_name || 'Unknown';

    return {
      success: true,
      user: {
        user_id: userData.user_id,
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name,
        role_id: userData.role_id,
        role_name: roleName,
        employee_id: userData.employee_id
      }
    };
  } catch (error) {
    console.error('Get user from token error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * Helper function: ดึงข้อมูลผู้ใช้จาก cookie (สำหรับใช้ใน API routes)
 */
export async function getCurrentUserFromCookie(): Promise<UserFromTokenResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) {
    return {
      success: false,
      error: 'No token found'
    };
  }

  return getUserFromToken(token);
}

/**
 * เปลี่ยนรหัสผ่าน
 */
export async function simpleChangePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // ดึง password_hash ปัจจุบัน
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select('password_hash')
      .eq('user_id', userId)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        error: 'ไม่พบผู้ใช้'
      };
    }

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const passwordValid = await verifyPassword(currentPassword, userData.password_hash);
    if (!passwordValid) {
      return {
        success: false,
        error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
      };
    }

    // Hash รหัสผ่านใหม่
    const newPasswordHash = await hashPassword(newPassword);

    // อัพเดทรหัสผ่าน
    const { error: updateError } = await supabase
      .from('master_system_user')
      .update({
        password_hash: newPasswordHash,
        password_changed_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      return {
        success: false,
        error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}
