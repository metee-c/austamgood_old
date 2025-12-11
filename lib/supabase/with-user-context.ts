// ============================================================================
// Supabase User Context Middleware
// Automatically set user_id in database session for all operations
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Get user_id from session cookie
 */
async function getUserIdFromSession(): Promise<number | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('wms_session');
    
    if (!sessionCookie?.value) {
      return null;
    }

    // Parse session data
    const sessionData = JSON.parse(sessionCookie.value);
    return sessionData.user_id || null;
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

/**
 * Wrapper function that sets user context before executing database operations
 * Usage: await withUserContext(supabase, async (sb) => { ... })
 */
export async function withUserContext<T>(
  supabase: SupabaseClient,
  operation: (supabase: SupabaseClient) => Promise<T>
): Promise<T> {
  const userId = await getUserIdFromSession();

  if (userId) {
    // Set user_id in database session
    await supabase.rpc('wms_set_config', {
      setting_name: 'app.current_user_id',
      setting_value: userId.toString(),
      is_local: true,
    });
  }

  try {
    // Execute the operation
    return await operation(supabase);
  } finally {
    // Clean up (optional, as is_local=true means it's transaction-scoped)
    if (userId) {
      try {
        await supabase.rpc('wms_set_config', {
          setting_name: 'app.current_user_id',
          setting_value: '',
          is_local: true,
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Set user context for the current supabase client
 * Use this at the beginning of API routes
 */
export async function setUserContext(supabase: SupabaseClient): Promise<void> {
  const userId = await getUserIdFromSession();

  if (userId) {
    await supabase.rpc('wms_set_config', {
      setting_name: 'app.current_user_id',
      setting_value: userId.toString(),
      is_local: true,
    });
  }
}
