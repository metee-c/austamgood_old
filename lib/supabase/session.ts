// ============================================================================
// Supabase Session Management
// Helper functions for managing user session in database
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Set current user ID in database session
 * This allows triggers to access the user_id via current_setting('app.current_user_id')
 */
export async function setDatabaseUser(
  supabase: SupabaseClient,
  userId: number | null
): Promise<void> {
  if (userId) {
    await supabase.rpc('wms_set_config', {
      setting_name: 'app.current_user_id',
      setting_value: userId.toString(),
      is_local: true,
    });
  }
}

/**
 * Clear current user ID from database session
 */
export async function clearDatabaseUser(
  supabase: SupabaseClient
): Promise<void> {
  await supabase.rpc('wms_set_config', {
    setting_name: 'app.current_user_id',
    setting_value: '',
    is_local: true,
  });
}

/**
 * Get current user ID from database session
 */
export async function getDatabaseUser(
  supabase: SupabaseClient
): Promise<number | null> {
  const { data, error } = await supabase.rpc('current_setting', {
    setting_name: 'app.current_user_id',
    missing_ok: true,
  });

  if (error || !data) return null;
  
  const userId = parseInt(data);
  return isNaN(userId) ? null : userId;
}
