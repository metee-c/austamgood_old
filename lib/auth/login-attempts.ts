// Login attempts management for security monitoring
import { createClient } from '@/lib/supabase/server';

export interface LoginAttemptData {
  attempt_id: string;
  email: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  attempted_at: string;
  success: boolean;
  failure_reason?: string;
  session_id?: string;
}

export interface LoginAttemptOptions {
  email: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  session_id?: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining_attempts?: number;
  reset_time?: Date;
  error?: string;
}

/**
 * Log a login attempt
 */
export async function logLoginAttempt(options: LoginAttemptOptions): Promise<{
  success: boolean;
  attempt_id?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to log login attempt
    const { data, error } = await supabase.rpc('log_login_attempt', {
      p_email: options.email,
      p_user_id: options.user_id || null,
      p_ip_address: options.ip_address || null,
      p_success: options.success,
      p_failure_reason: options.failure_reason || null,
      p_session_id: options.session_id || null
    });

    if (error) {
      console.error('Error logging login attempt:', error);
      return {
        success: false,
        error: 'Failed to log login attempt'
      };
    }

    return {
      success: true,
      attempt_id: data
    };
  } catch (error) {
    console.error('Login attempt logging error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Check rate limiting for login attempts
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress: string,
  windowMinutes?: number,
  maxAttempts?: number
): Promise<RateLimitCheck> {
  try {
    const supabase = await createClient();
    
    // Call the database function to check rate limit
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_email: email,
      p_ip_address: ipAddress,
      p_window_minutes: windowMinutes || null,
      p_max_attempts: maxAttempts || null
    });

    if (error) {
      console.error('Error checking rate limit:', error);
      return {
        allowed: false,
        error: 'Failed to check rate limit'
      };
    }

    if (!data) {
      // Rate limit exceeded
      const resetTime = new Date();
      resetTime.setMinutes(resetTime.getMinutes() + (windowMinutes || 60));
      
      return {
        allowed: false,
        remaining_attempts: 0,
        reset_time: resetTime
      };
    }

    return {
      allowed: true
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return {
      allowed: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get login attempt statistics
 */
export async function getLoginAttemptStats(hoursBack: number = 24): Promise<{
  success: boolean;
  stats?: {
    total_attempts: number;
    successful_attempts: number;
    failed_attempts: number;
    unique_users: number;
    unique_ips: number;
    success_rate: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Get login attempt statistics from the last N hours
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hoursBack);

    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .gte('attempted_at', startTime.toISOString());

    if (error) {
      console.error('Error getting login stats:', error);
      return {
        success: false,
        error: 'Failed to retrieve login statistics'
      };
    }

    const attempts = data || [];
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter(a => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const uniqueUsers = new Set(attempts.filter(a => a.user_id).map(a => a.user_id)).size;
    const uniqueIps = new Set(attempts.filter(a => a.ip_address).map(a => a.ip_address)).size;
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    return {
      success: true,
      stats: {
        total_attempts: totalAttempts,
        successful_attempts: successfulAttempts,
        failed_attempts: failedAttempts,
        unique_users: uniqueUsers,
        unique_ips: uniqueIps,
        success_rate: Math.round(successRate * 100) / 100
      }
    };
  } catch (error) {
    console.error('Login stats error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get failed login attempts for a specific user
 */
export async function getUserFailedAttempts(
  userId: number,
  hoursBack: number = 24
): Promise<{
  success: boolean;
  attempts?: LoginAttemptData[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to get user failed attempts
    const { data, error } = await supabase.rpc('get_user_failed_attempts', {
      p_user_id: userId,
      p_hours_back: hoursBack
    });

    if (error) {
      console.error('Error getting user failed attempts:', error);
      return {
        success: false,
        error: 'Failed to retrieve failed attempts'
      };
    }

    const attempts: LoginAttemptData[] = (data || []).map((attempt: any) => ({
      attempt_id: attempt.attempt_id,
      email: attempt.email,
      user_id: userId,
      ip_address: attempt.ip_address,
      user_agent: attempt.user_agent,
      attempted_at: attempt.attempted_at,
      success: false,
      failure_reason: attempt.failure_reason
    }));

    return {
      success: true,
      attempts
    };
  } catch (error) {
    console.error('User failed attempts error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get suspicious login patterns
 */
export async function getSuspiciousLoginPatterns(
  hoursBack: number = 24,
  minFailedAttempts: number = 5
): Promise<{
  success: boolean;
  patterns?: Array<{
    email: string;
    ip_address?: string;
    failed_attempts: number;
    first_attempt: string;
    last_attempt: string;
    user_agents: string[];
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to get suspicious patterns
    const { data, error } = await supabase.rpc('get_suspicious_login_patterns', {
      p_hours_back: hoursBack,
      p_min_failed_attempts: minFailedAttempts
    });

    if (error) {
      console.error('Error getting suspicious patterns:', error);
      return {
        success: false,
        error: 'Failed to retrieve suspicious patterns'
      };
    }

    const patterns = (data || []).map((pattern: any) => ({
      email: pattern.email,
      ip_address: pattern.ip_address,
      failed_attempts: pattern.failed_attempts,
      first_attempt: pattern.first_attempt,
      last_attempt: pattern.last_attempt,
      user_agents: pattern.user_agents || []
    }));

    return {
      success: true,
      patterns
    };
  } catch (error) {
    console.error('Suspicious patterns error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get recent login attempts with pagination
 */
export async function getRecentLoginAttempts(
  limit: number = 100,
  offset: number = 0,
  filters?: {
    email?: string;
    success?: boolean;
    ip_address?: string;
    start_date?: Date;
    end_date?: Date;
  }
): Promise<{
  success: boolean;
  attempts?: LoginAttemptData[];
  total?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    let queryBuilder = supabase
      .from('login_attempts')
      .select(`
        attempt_id,
        email,
        user_id,
        ip_address,
        user_agent,
        attempted_at,
        success,
        failure_reason,
        session_id
      `, { count: 'exact' })
      .order('attempted_at', { ascending: false });

    // Apply filters
    if (filters?.email) {
      queryBuilder = queryBuilder.eq('email', filters.email);
    }

    if (filters?.success !== undefined) {
      queryBuilder = queryBuilder.eq('success', filters.success);
    }

    if (filters?.ip_address) {
      queryBuilder = queryBuilder.eq('ip_address', filters.ip_address);
    }

    if (filters?.start_date) {
      queryBuilder = queryBuilder.gte('attempted_at', filters.start_date.toISOString());
    }

    if (filters?.end_date) {
      queryBuilder = queryBuilder.lte('attempted_at', filters.end_date.toISOString());
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('Error getting recent attempts:', error);
      return {
        success: false,
        error: 'Failed to retrieve login attempts'
      };
    }

    const attempts: LoginAttemptData[] = (data || []).map((attempt: any) => ({
      attempt_id: attempt.attempt_id,
      email: attempt.email,
      user_id: attempt.user_id,
      ip_address: attempt.ip_address,
      user_agent: attempt.user_agent,
      attempted_at: attempt.attempted_at,
      success: attempt.success,
      failure_reason: attempt.failure_reason,
      session_id: attempt.session_id
    }));

    return {
      success: true,
      attempts,
      total: count || 0
    };
  } catch (error) {
    console.error('Recent attempts error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Clean up old login attempts
 */
export async function cleanupOldLoginAttempts(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Get cleanup setting from system settings
    const { data: settingData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'auth.login_attempt_cleanup_days')
      .single();

    const cleanupDays = settingData?.setting_value ? parseInt(settingData.setting_value) : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

    // First count how many records will be deleted
    const { count } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .lt('attempted_at', cutoffDate.toISOString());

    // Then delete them
    const { error } = await supabase
      .from('login_attempts')
      .delete()
      .lt('attempted_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning up login attempts:', error);
      return {
        success: false,
        error: 'Failed to cleanup old login attempts'
      };
    }

    return {
      success: true,
      deletedCount: count || 0
    };
  } catch (error) {
    console.error('Login attempts cleanup error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
