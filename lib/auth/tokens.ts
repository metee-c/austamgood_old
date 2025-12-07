// Token management utilities for password reset and email verification
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface CreateResetTokenOptions {
  user_id: number;
  duration_hours?: number;
  ip_address?: string;
}

export interface ResetTokenData {
  token_id: string;
  user_id: number;
  username: string;
  email: string;
  is_valid: boolean;
  expires_in_minutes: number;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(options: CreateResetTokenOptions): Promise<{
  success: boolean;
  token_id?: string;
  token?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const token = generateSecureToken(32); // 64 character hex string
    
    // Call the database function to create reset token
    const { data, error } = await supabase.rpc('create_reset_token', {
      p_user_id: options.user_id,
      p_token: token,
      p_duration_hours: options.duration_hours || 1
    });

    if (error) {
      console.error('Error creating reset token:', error);
      
      // Check if it's a rate limit error
      if (error.message?.includes('rate limit')) {
        return {
          success: false,
          error: 'คุณได้ขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'
        };
      }
      
      return {
        success: false,
        error: 'ไม่สามารถสร้าง token สำหรับรีเซ็ตรหัสผ่านได้'
      };
    }

    return {
      success: true,
      token_id: data,
      token
    };
  } catch (error) {
    console.error('Reset token creation error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * Validate a password reset token
 */
export async function validatePasswordResetToken(token: string): Promise<{
  success: boolean;
  tokenData?: ResetTokenData;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to validate reset token
    const { data, error } = await supabase.rpc('validate_reset_token', {
      p_token: token
    });

    if (error) {
      console.error('Error validating reset token:', error);
      return {
        success: false,
        error: 'ไม่สามารถตรวจสอบ token ได้'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'ไม่พบ token นี้ในระบบ'
      };
    }

    const tokenData = data[0];
    
    if (!tokenData.is_valid) {
      return {
        success: false,
        error: 'Token นี้ไม่ถูกต้องหรือหมดอายุแล้ว'
      };
    }

    return {
      success: true,
      tokenData: {
        token_id: tokenData.token_id,
        user_id: tokenData.user_id,
        username: tokenData.username,
        email: tokenData.email,
        is_valid: tokenData.is_valid,
        expires_in_minutes: tokenData.expires_in_minutes
      }
    };
  } catch (error) {
    console.error('Reset token validation error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * Use a password reset token to change password
 */
export async function usePasswordResetToken(
  token: string,
  newPasswordHash: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to use reset token
    const { data, error } = await supabase.rpc('use_reset_token', {
      p_token: token,
      p_new_password_hash: newPasswordHash
    });

    if (error) {
      console.error('Error using reset token:', error);
      return {
        success: false,
        error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้'
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Reset token usage error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาดภายในระบบ'
    };
  }
}

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(): string {
  return generateSecureToken(32);
}

/**
 * Generate TOTP secret for 2FA
 */
export function generateTOTPSecret(): string {
  // Generate a 32-character base32 secret for TOTP
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

/**
 * Validate TOTP code (placeholder for future 2FA implementation)
 */
export function validateTOTPCode(
  secret: string,
  code: string,
  window: number = 1
): boolean {
  // This is a placeholder implementation
  // In a real implementation, you would use a library like 'otplib'
  // to generate and validate TOTP codes
  
  // For now, return false as 2FA is not fully implemented
  return false;
}

/**
 * Clean up expired tokens (utility function)
 */
export async function cleanupExpiredTokens(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to cleanup old tokens
    const { data, error } = await supabase.rpc('cleanup_old_password_reset_tokens');

    if (error) {
      console.error('Error cleaning up tokens:', error);
      return {
        success: false,
        error: 'Failed to cleanup expired tokens'
      };
    }

    return {
      success: true,
      deletedCount: data || 0
    };
  } catch (error) {
    console.error('Token cleanup error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get user's password reset tokens
 */
export async function getUserResetTokens(userId: number): Promise<{
  success: boolean;
  tokens?: Array<{
    token_id: string;
    created_at: string;
    expires_at: string;
    used_at?: string;
    is_valid: boolean;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('token_id, created_at, expires_at, used_at, is_valid')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error getting user reset tokens:', error);
      return {
        success: false,
        error: 'Failed to retrieve reset tokens'
      };
    }

    return {
      success: true,
      tokens: data || []
    };
  } catch (error) {
    console.error('User reset tokens retrieval error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Invalidate all reset tokens for a user
 */
export async function invalidateUserResetTokens(userId: number): Promise<{
  success: boolean;
  invalidatedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // First count how many tokens will be invalidated
    const { count } = await supabase
      .from('password_reset_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_valid', true);

    // Then invalidate them
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({
        is_valid: false,
        used_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_valid', true);

    if (error) {
      console.error('Error invalidating reset tokens:', error);
      return {
        success: false,
        error: 'Failed to invalidate reset tokens'
      };
    }

    return {
      success: true,
      invalidatedCount: count || 0
    };
  } catch (error) {
    console.error('Reset tokens invalidation error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
