// System settings management for authentication configuration
import { createClient } from '@/lib/supabase/server';

export interface SystemSetting {
  setting_id: string;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  created_at: string;
  updated_at: string;
  updated_by?: number;
}

export interface AuthSettings {
  session_duration: number; // hours
  max_sessions: number;
  idle_timeout: number; // minutes
  max_attempts: number;
  lock_duration: number; // minutes
  password_min: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  password_expiry: number; // days
  reset_duration: number; // hours
  reset_limit: number;
  rate_window: number; // minutes
  rate_attempts: number;
  two_factor: boolean;
  cleanup_sessions: number; // days
  cleanup_tokens: number; // days
  cleanup_attempts: number; // days
  cleanup_audit: number; // days
  remember_me: boolean;
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<{
  success: boolean;
  setting?: SystemSetting;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('setting_key', key)
      .single();

    if (error) {
      console.error('Error getting system setting:', error);
      return {
        success: false,
        error: 'Failed to retrieve system setting'
      };
    }

    return {
      success: true,
      setting: data
    };
  } catch (error) {
    console.error('System setting retrieval error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get all authentication settings
 */
export async function getAuthSettings(): Promise<{
  success: boolean;
  settings?: AuthSettings;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Get all auth-related settings
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .like('setting_key', 'auth.%');

    if (error) {
      console.error('Error getting auth settings:', error);
      return {
        success: false,
        error: 'Failed to retrieve authentication settings'
      };
    }

    // Convert array to object with default values
    const settingsMap = new Map(data?.map(s => [s.setting_key, s.setting_value]) || []);
    
    const settings: AuthSettings = {
      session_duration: parseInt(settingsMap.get('auth.session_duration_hours') || '24'),
      max_sessions: parseInt(settingsMap.get('auth.max_sessions_per_user') || '5'),
      idle_timeout: parseInt(settingsMap.get('auth.session_idle_timeout_minutes') || '30'),
      max_attempts: parseInt(settingsMap.get('auth.max_login_attempts') || '5'),
      lock_duration: parseInt(settingsMap.get('auth.account_lock_duration_minutes') || '30'),
      password_min: parseInt(settingsMap.get('auth.password_min_length') || '8'),
      require_uppercase: settingsMap.get('auth.password_require_uppercase') === 'true',
      require_lowercase: settingsMap.get('auth.password_require_lowercase') === 'true',
      require_number: settingsMap.get('auth.password_require_number') === 'true',
      require_special: settingsMap.get('auth.password_require_special') === 'false',
      password_expiry: parseInt(settingsMap.get('auth.password_expiry_days') || '90'),
      reset_duration: parseInt(settingsMap.get('auth.password_reset_token_duration_hours') || '1'),
      reset_limit: parseInt(settingsMap.get('auth.password_reset_rate_limit_per_hour') || '3'),
      rate_window: parseInt(settingsMap.get('auth.login_rate_limit_window_minutes') || '15'),
      rate_attempts: parseInt(settingsMap.get('auth.login_rate_limit_max_attempts') || '10'),
      two_factor: settingsMap.get('auth.two_factor_enabled') === 'true',
      cleanup_sessions: parseInt(settingsMap.get('auth.session_cleanup_days') || '30'),
      cleanup_tokens: parseInt(settingsMap.get('auth.token_cleanup_days') || '7'),
      cleanup_attempts: parseInt(settingsMap.get('auth.login_attempt_cleanup_days') || '30'),
      cleanup_audit: parseInt(settingsMap.get('auth.audit_log_retention_days') || '90'),
      remember_me: settingsMap.get('auth.remember_me_enabled') === 'true'
    };

    return {
      success: true,
      settings
    };
  } catch (error) {
    console.error('Auth settings retrieval error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Update a system setting
 */
export async function updateSystemSetting(
  key: string,
  value: string,
  updatedBy: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('system_settings')
      .update({
        setting_value: value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', key);

    if (error) {
      console.error('Error updating system setting:', error);
      return {
        success: false,
        error: 'Failed to update system setting'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('System setting update error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Update multiple authentication settings
 */
export async function updateAuthSettings(
  settings: Partial<AuthSettings>,
  updatedBy: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Map settings to database keys
    const updates: Array<{ key: string; value: string }> = [];
    
    if (settings.session_duration !== undefined) {
      updates.push({ key: 'auth.session_duration_hours', value: settings.session_duration.toString() });
    }
    if (settings.max_sessions !== undefined) {
      updates.push({ key: 'auth.max_sessions_per_user', value: settings.max_sessions.toString() });
    }
    if (settings.idle_timeout !== undefined) {
      updates.push({ key: 'auth.session_idle_timeout_minutes', value: settings.idle_timeout.toString() });
    }
    if (settings.max_attempts !== undefined) {
      updates.push({ key: 'auth.max_login_attempts', value: settings.max_attempts.toString() });
    }
    if (settings.lock_duration !== undefined) {
      updates.push({ key: 'auth.account_lock_duration_minutes', value: settings.lock_duration.toString() });
    }
    if (settings.password_min !== undefined) {
      updates.push({ key: 'auth.password_min_length', value: settings.password_min.toString() });
    }
    if (settings.require_uppercase !== undefined) {
      updates.push({ key: 'auth.password_require_uppercase', value: settings.require_uppercase.toString() });
    }
    if (settings.require_lowercase !== undefined) {
      updates.push({ key: 'auth.password_require_lowercase', value: settings.require_lowercase.toString() });
    }
    if (settings.require_number !== undefined) {
      updates.push({ key: 'auth.password_require_number', value: settings.require_number.toString() });
    }
    if (settings.require_special !== undefined) {
      updates.push({ key: 'auth.password_require_special', value: settings.require_special.toString() });
    }
    if (settings.password_expiry !== undefined) {
      updates.push({ key: 'auth.password_expiry_days', value: settings.password_expiry.toString() });
    }
    if (settings.reset_duration !== undefined) {
      updates.push({ key: 'auth.password_reset_token_duration_hours', value: settings.reset_duration.toString() });
    }
    if (settings.reset_limit !== undefined) {
      updates.push({ key: 'auth.password_reset_rate_limit_per_hour', value: settings.reset_limit.toString() });
    }
    if (settings.rate_window !== undefined) {
      updates.push({ key: 'auth.login_rate_limit_window_minutes', value: settings.rate_window.toString() });
    }
    if (settings.rate_attempts !== undefined) {
      updates.push({ key: 'auth.login_rate_limit_max_attempts', value: settings.rate_attempts.toString() });
    }
    if (settings.two_factor !== undefined) {
      updates.push({ key: 'auth.two_factor_enabled', value: settings.two_factor.toString() });
    }
    if (settings.remember_me !== undefined) {
      updates.push({ key: 'auth.remember_me_enabled', value: settings.remember_me.toString() });
    }

    // Update all settings
    for (const update of updates) {
      const result = await updateSystemSetting(update.key, update.value, updatedBy);
      if (!result.success) {
        return result;
      }
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Auth settings update error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get all system settings
 */
export async function getAllSystemSettings(): Promise<{
  success: boolean;
  settings?: SystemSetting[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .order('setting_key');

    if (error) {
      console.error('Error getting all settings:', error);
      return {
        success: false,
        error: 'Failed to retrieve system settings'
      };
    }

    return {
      success: true,
      settings: data || []
    };
  } catch (error) {
    console.error('System settings retrieval error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Reset settings to default values
 */
export async function resetToDefaultSettings(updatedBy: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to reset settings
    const { error } = await supabase.rpc('reset_system_settings_to_default', {
      p_updated_by: updatedBy
    });

    if (error) {
      console.error('Error resetting settings:', error);
      return {
        success: false,
        error: 'Failed to reset settings to default'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Settings reset error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
