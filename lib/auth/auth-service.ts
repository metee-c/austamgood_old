// Main authentication service that combines all auth utilities
import { createClient } from '@/lib/supabase/server';
import { hashPassword, verifyPassword, validatePassword } from './password';
import { createSession, invalidateSession, setSessionCookie, clearSessionCookie } from './session';
import { createPasswordResetToken, validatePasswordResetToken, usePasswordResetToken } from './tokens';
import { logLoginAttempt, checkLoginRateLimit } from './login-attempts';
import { logAuthEvent } from './audit';
import { getAuthSettings } from './settings';

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface LoginResult {
  success: boolean;
  user?: {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    role_id: number;
    role_name: string;
  };
  session_token?: string;
  force_password_change?: boolean;
  error?: string;
  error_code?: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'RATE_LIMIT' | 'INACTIVE_ACCOUNT' | 'INTERNAL_ERROR';
}

export interface RegisterUserData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role_id: number;
  created_by: number;
}

export interface RegisterResult {
  success: boolean;
  user_id?: number;
  error?: string;
}

export interface PasswordResetRequest {
  email: string;
  ip_address?: string;
}

export interface PasswordResetResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface PasswordChangeData {
  token: string;
  new_password: string;
}

export interface PasswordChangeResult {
  success: boolean;
  error?: string;
}

/**
 * Authenticate user with email and password
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const { email, password, remember_me = false, ip_address, user_agent } = credentials;

  console.log('🔐 [AUTH-SERVICE] Login attempt:', { email, ip_address });

  try {
    const supabase = await createClient();

    // Check rate limiting (TEMPORARILY DISABLED FOR TESTING)
    // const rateLimitCheck = await checkLoginRateLimit(email, ip_address || '127.0.0.1');
    // console.log('⏱️  [AUTH-SERVICE] Rate limit check:', rateLimitCheck);

    // if (!rateLimitCheck.allowed) {
    //   await logLoginAttempt({
    //     email,
    //     ip_address,
    //     user_agent,
    //     success: false,
    //     failure_reason: 'Rate limit exceeded'
    //   });

    //   return {
    //     success: false,
    //     error: 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
    //     error_code: 'RATE_LIMIT'
    //   };
    // }

    console.log('⚠️  [AUTH-SERVICE] Rate limiting is DISABLED for testing');

    // Get user by email
    console.log('🔍 [AUTH-SERVICE] Querying user:', email);
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        username,
        email,
        password_hash,
        full_name,
        role_id,
        is_active,
        is_locked,
        locked_until,
        failed_login_attempts,
        force_password_change
      `)
      .eq('email', email)
      .single();

    console.log('👤 [AUTH-SERVICE] User query result:', {
      found: !!userData,
      error: userError?.message,
      user_id: userData?.user_id,
      is_active: userData?.is_active,
      has_password_hash: !!userData?.password_hash
    });

    if (userError || !userData) {
      console.log('❌ [AUTH-SERVICE] User not found:', userError?.message);
      await logLoginAttempt({
        email,
        ip_address,
        user_agent,
        success: false,
        failure_reason: 'User not found'
      });

      return {
        success: false,
        error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        error_code: 'INVALID_CREDENTIALS'
      };
    }

    // Check if account is active
    if (!userData.is_active) {
      await logLoginAttempt({
        email,
        user_id: userData.user_id,
        ip_address,
        user_agent,
        success: false,
        failure_reason: 'Account inactive'
      });

      return {
        success: false,
        error: 'บัญชีของคุณถูกระงับการใช้งาน',
        error_code: 'INACTIVE_ACCOUNT'
      };
    }

    // Check if account is locked
    if (userData.is_locked) {
      const lockedUntil = userData.locked_until ? new Date(userData.locked_until) : null;
      const now = new Date();

      if (lockedUntil && lockedUntil > now) {
        await logLoginAttempt({
          email,
          user_id: userData.user_id,
          ip_address,
          user_agent,
          success: false,
          failure_reason: 'Account locked'
        });

        const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
        return {
          success: false,
          error: `บัญชีของคุณถูกล็อก กรุณารออีก ${minutesRemaining} นาที`,
          error_code: 'ACCOUNT_LOCKED'
        };
      } else if (lockedUntil && lockedUntil <= now) {
        // Auto-unlock if lock period has expired
        await supabase
          .from('master_system_user')
          .update({
            is_locked: false,
            locked_until: null,
            failed_login_attempts: 0
          })
          .eq('user_id', userData.user_id);
      }
    }

    // Verify password
    console.log('🔑 [AUTH-SERVICE] Verifying password...');
    const passwordValid = await verifyPassword(password, userData.password_hash);
    console.log('🔑 [AUTH-SERVICE] Password valid:', passwordValid);

    if (!passwordValid) {
      // Increment failed login attempts
      const failedAttempts = (userData as any).failed_login_attempts || 0;
      const newFailedAttempts = failedAttempts + 1;

      // Get auth settings for max attempts
      const { settings } = await getAuthSettings();
      const maxAttempts = settings?.max_attempts || 5;
      const lockDuration = settings?.lock_duration || 30;

      if (newFailedAttempts >= maxAttempts) {
        // Lock the account
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDuration);

        await supabase
          .from('master_system_user')
          .update({
            is_locked: true,
            locked_until: lockedUntil.toISOString(),
            failed_login_attempts: newFailedAttempts
          })
          .eq('user_id', userData.user_id);

        await logAuthEvent('ACCOUNT_LOCKED', userData.user_id, {
          email,
          ip_address,
          user_agent,
          reason: 'Too many failed login attempts',
          locked_until: lockedUntil.toISOString()
        });

        await logLoginAttempt({
          email,
          user_id: userData.user_id,
          ip_address,
          user_agent,
          success: false,
          failure_reason: 'Invalid password - account locked'
        });

        return {
          success: false,
          error: `รหัสผ่านไม่ถูกต้อง บัญชีของคุณถูกล็อกเป็นเวลา ${lockDuration} นาที`,
          error_code: 'ACCOUNT_LOCKED'
        };
      } else {
        // Update failed attempts count
        await supabase
          .from('master_system_user')
          .update({
            failed_login_attempts: newFailedAttempts
          })
          .eq('user_id', userData.user_id);

        await logLoginAttempt({
          email,
          user_id: userData.user_id,
          ip_address,
          user_agent,
          success: false,
          failure_reason: 'Invalid password'
        });

        const attemptsRemaining = maxAttempts - newFailedAttempts;
        return {
          success: false,
          error: `รหัสผ่านไม่ถูกต้อง คุณพยายามผิดไปแล้ว ${newFailedAttempts} ครั้ง เหลืออีก ${attemptsRemaining} ครั้ง (หากครบ ${maxAttempts} ครั้ง บัญชีจะถูกล็อก ${lockDuration} นาที)`,
          error_code: 'INVALID_CREDENTIALS'
        };
      }
    }

    // Password is correct - reset failed attempts
    await supabase
      .from('master_system_user')
      .update({
        failed_login_attempts: 0,
        last_login: new Date().toISOString()
      })
      .eq('user_id', userData.user_id);

    // Get session duration from settings
    const { settings } = await getAuthSettings();
    const sessionDuration = remember_me 
      ? (settings?.session_duration || 24) * 7 // 7 days if remember me
      : (settings?.session_duration || 24); // Default duration

    // Create session
    const sessionResult = await createSession({
      user_id: userData.user_id,
      duration_hours: sessionDuration,
      ip_address,
      user_agent
    });

    if (!sessionResult.success || !sessionResult.token) {
      return {
        success: false,
        error: 'ไม่สามารถสร้าง session ได้',
        error_code: 'INTERNAL_ERROR'
      };
    }

    // Set session cookie
    setSessionCookie(sessionResult.token, sessionDuration * 60 * 60);

    // Log successful login
    await logLoginAttempt({
      email,
      user_id: userData.user_id,
      ip_address,
      user_agent,
      success: true,
      session_id: sessionResult.session_id
    });

    await logAuthEvent('LOGIN_SUCCESS', userData.user_id, {
      email,
      ip_address,
      user_agent,
      session_id: sessionResult.session_id
    });

    // Get role name separately
    const { data: roleData } = await supabase
      .from('master_system_role')
      .select('role_name')
      .eq('role_id', userData.role_id)
      .single();

    return {
      success: true,
      user: {
        user_id: userData.user_id,
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name,
        role_id: userData.role_id,
        role_name: roleData?.role_name || 'Unknown'
      },
      session_token: sessionResult.token,
      force_password_change: userData.force_password_change || false
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ',
      error_code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Logout user and invalidate session
 */
export async function logout(sessionToken: string, userId?: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Invalidate session
    const invalidated = await invalidateSession(sessionToken, userId);

    if (!invalidated) {
      return {
        success: false,
        error: 'Failed to invalidate session'
      };
    }

    // Clear session cookie
    clearSessionCookie();

    // Log logout event
    if (userId) {
      await logAuthEvent('LOGOUT', userId, {
        session_token: sessionToken
      });
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Register a new user
 */
export async function registerUser(userData: RegisterUserData): Promise<RegisterResult> {
  try {
    const supabase = await createClient();

    // Validate password
    const passwordValidation = validatePassword(userData.password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join(', ')
      };
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('master_system_user')
      .select('user_id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      return {
        success: false,
        error: 'อีเมลนี้ถูกใช้งานแล้ว'
      };
    }

    // Check if username already exists
    const { data: existingUsername } = await supabase
      .from('master_system_user')
      .select('user_id')
      .eq('username', userData.username)
      .single();

    if (existingUsername) {
      return {
        success: false,
        error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว'
      };
    }

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('master_system_user')
      .insert({
        username: userData.username,
        email: userData.email,
        password_hash: passwordHash,
        full_name: userData.full_name,
        role_id: userData.role_id,
        is_active: true,
        created_by: userData.created_by,
        created_at: new Date().toISOString()
      })
      .select('user_id')
      .single();

    if (createError || !newUser) {
      console.error('Error creating user:', createError);
      return {
        success: false,
        error: 'ไม่สามารถสร้างผู้ใช้ได้'
      };
    }

    return {
      success: true,
      user_id: newUser.user_id
    };
  } catch (error) {
    console.error('Register error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(request: PasswordResetRequest): Promise<PasswordResetResult> {
  try {
    const supabase = await createClient();

    // Get user by email
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select('user_id, email, is_active')
      .eq('email', request.email)
      .single();

    // Always return success to prevent email enumeration
    if (userError || !userData || !userData.is_active) {
      return {
        success: true,
        error: undefined
      };
    }

    // Create reset token
    const tokenResult = await createPasswordResetToken({
      user_id: userData.user_id,
      ip_address: request.ip_address
    });

    if (!tokenResult.success || !tokenResult.token) {
      // Still return success to user, but log the error
      console.error('Failed to create reset token:', tokenResult.error);
      return {
        success: true,
        error: undefined
      };
    }

    // Log password reset request
    await logAuthEvent('PASSWORD_RESET', userData.user_id, {
      email: request.email,
      ip_address: request.ip_address,
      token_id: tokenResult.token_id
    });

    // In a real application, you would send an email here
    // For now, we'll return the token (in production, never do this!)
    return {
      success: true,
      token: tokenResult.token
    };
  } catch (error) {
    console.error('Password reset request error:', error);
    // Still return success to prevent information leakage
    return {
      success: true,
      error: undefined
    };
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(data: PasswordChangeData): Promise<PasswordChangeResult> {
  try {
    // Validate new password
    const passwordValidation = validatePassword(data.new_password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join(', ')
      };
    }

    // Validate token
    const tokenValidation = await validatePasswordResetToken(data.token);
    if (!tokenValidation.success || !tokenValidation.tokenData) {
      return {
        success: false,
        error: tokenValidation.error || 'Token ไม่ถูกต้อง'
      };
    }

    // Hash new password
    const newPasswordHash = await hashPassword(data.new_password);

    // Use token to reset password
    const resetResult = await usePasswordResetToken(data.token, newPasswordHash);

    if (!resetResult.success) {
      return {
        success: false,
        error: resetResult.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * Change password for authenticated user
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get user's current password hash
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

    // Verify current password
    const passwordValid = await verifyPassword(currentPassword, userData.password_hash);
    if (!passwordValid) {
      return {
        success: false,
        error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
      };
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join(', ')
      };
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password and clear force_password_change flag
    const { error: updateError } = await supabase
      .from('master_system_user')
      .update({
        password_hash: newPasswordHash,
        password_changed_at: new Date().toISOString(),
        force_password_change: false
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return {
        success: false,
        error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้'
      };
    }

    // Log password change
    await logAuthEvent('PASSWORD_RESET', userId, {
      reason: 'User-initiated password change'
    });

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
