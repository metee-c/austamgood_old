// ============================================================================
// Database User Context Helper
// Set user_id in database session for audit trail
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Set user context in database session
 * Call this before any database operations that should track the user
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to set in session (from master_system_user table)
 */
export async function setDatabaseUserContext(
  supabase: SupabaseClient,
  userId: number | null
): Promise<void> {
  if (!userId) return;

  try {
    await supabase.rpc('wms_set_config', {
      setting_name: 'app.current_user_id',
      setting_value: userId.toString(),
      is_local: true,
    });
  } catch (error) {
    console.error('Failed to set database user context:', error);
    // Don't throw - this is for audit trail, shouldn't break the operation
  }
}

/**
 * Get user ID from session cookie
 * This reads from the session_token cookie and validates it
 */
export async function getUserIdFromCookie(cookieHeader: string | null): Promise<number | null> {
  if (!cookieHeader) return null;

  try {
    // Parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const sessionToken = cookies['session_token'];
    if (!sessionToken) return null;

    // Validate session token with database
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    
    const { data, error } = await supabase.rpc('validate_session_token', {
      p_token: sessionToken
    });

    if (error || !data || data.length === 0) {
      console.error('Failed to validate session token:', error);
      return null;
    }

    const sessionData = data[0];
    return sessionData.is_valid ? sessionData.user_id : null;
  } catch (error) {
    console.error('Failed to parse user from cookie:', error);
    return null;
  }
}
