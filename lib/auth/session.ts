// Session management utilities
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export interface SessionData {
  session_id: string;
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  role_name: string;
  is_valid: boolean;
  expires_in_seconds: number;
  last_activity_minutes_ago: number;
}

export interface CreateSessionOptions {
  user_id: number;
  duration_hours?: number;
  ip_address?: string;
  user_agent?: string;
  device_info?: Record<string, any>;
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(options: CreateSessionOptions): Promise<{
  success: boolean;
  session_id?: string;
  token?: string;
  error?: string;
}> {
  try {
    console.log('🔧 [SESSION] Creating session for user:', options.user_id);
    const supabase = await createClient();
    const token = generateSessionToken();
    
    console.log('🔧 [SESSION] Generated token:', token.substring(0, 20) + '...');
    console.log('🔧 [SESSION] Calling create_session RPC with params:', {
      p_user_id: options.user_id,
      p_duration_hours: options.duration_hours || 24,
      p_ip_address: options.ip_address || null,
      p_user_agent: options.user_agent?.substring(0, 50) || null
    });
    
    // Call the database function to create session
    const { data, error } = await supabase.rpc('create_session', {
      p_user_id: options.user_id,
      p_token: token,
      p_duration_hours: options.duration_hours || 24,
      p_ip_address: options.ip_address || null,
      p_user_agent: options.user_agent || null
    });

    if (error) {
      console.error('❌ [SESSION] Error creating session:', error);
      return {
        success: false,
        error: 'Failed to create session'
      };
    }

    console.log('✅ [SESSION] Session created successfully:', data);
    return {
      success: true,
      session_id: data,
      token
    };
  } catch (error) {
    console.error('❌ [SESSION] Session creation error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Validate a session token and return session data
 */
export async function validateSession(token: string): Promise<{
  success: boolean;
  session?: SessionData;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to validate session
    const { data, error } = await supabase.rpc('validate_session_token', {
      p_token: token
    });

    if (error) {
      console.error('Error validating session:', error);
      return {
        success: false,
        error: 'Failed to validate session'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Session not found'
      };
    }

    const sessionData = data[0];
    
    if (!sessionData.is_valid) {
      return {
        success: false,
        error: 'Session is invalid or expired'
      };
    }

    // Get user role information
    const { data: userRole, error: roleError } = await supabase
      .from('master_system_user')
      .select(`
        role_id,
        master_system_role(
          role_name
        )
      `)
      .eq('user_id', sessionData.user_id)
      .single();

    if (roleError) {
      console.error('Error getting user role:', roleError);
    }

    // Extract role name from master_system_role relation
    const masterRole = userRole?.master_system_role as any;
    const roleName = Array.isArray(masterRole)
      ? masterRole[0]?.role_name
      : masterRole?.role_name || 'Unknown';

    return {
      success: true,
      session: {
        session_id: sessionData.session_id,
        user_id: sessionData.user_id,
        username: sessionData.username,
        email: sessionData.email,
        full_name: sessionData.full_name,
        role_id: userRole?.role_id || 0,
        role_name: roleName,
        is_valid: sessionData.is_valid,
        expires_in_seconds: sessionData.expires_in_seconds,
        last_activity_minutes_ago: sessionData.last_activity_minutes_ago
      }
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(token: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase.rpc('update_session_activity_by_token', {
      p_token: token
    });

    if (error) {
      console.error('Error updating session activity:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Session activity update error:', error);
    return false;
  }
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(token: string, invalidated_by?: number): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase.rpc('invalidate_session', {
      p_token: token,
      p_invalidated_by: invalidated_by || null
    });

    if (error) {
      console.error('Error invalidating session:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Session invalidation error:', error);
    return false;
  }
}

/**
 * Get session token from cookies
 */
export async function getSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('session_token')?.value || null;
}

/**
 * Get session token from request headers or cookies
 */
export function getSessionTokenFromRequest(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  return request.cookies.get('session_token')?.value || null;
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string, maxAge: number = 24 * 60 * 60): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/'
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session_token');
}

/**
 * Get current session from cookies
 */
export async function getCurrentSession(): Promise<{
  success: boolean;
  session?: SessionData;
  error?: string;
}> {
  const token = await getSessionTokenFromCookies();

  if (!token) {
    return {
      success: false,
      error: 'No session token found'
    };
  }

  const result = await validateSession(token);

  if (result.success && result.session) {
    // Update activity timestamp
    await updateSessionActivity(token);
  }

  return result;
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: number): Promise<{
  success: boolean;
  sessions?: Array<{
    session_id: string;
    created_at: string;
    last_activity: string;
    ip_address?: string;
    user_agent?: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('session_id, created_at, last_activity_at, ip_address, user_agent')
      .eq('user_id', userId)
      .eq('invalidated', false)
      .order('last_activity_at', { ascending: false });

    if (error) {
      console.error('Error getting user sessions:', error);
      return {
        success: false,
        error: 'Failed to retrieve user sessions'
      };
    }

    // Map last_activity_at to last_activity for type compatibility
    const sessions = (data || []).map(session => ({
      session_id: session.session_id,
      created_at: session.created_at,
      last_activity: session.last_activity_at,
      ip_address: session.ip_address,
      user_agent: session.user_agent
    }));

    return {
      success: true,
      sessions
    };
  } catch (error) {
    console.error('User sessions retrieval error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Invalidate all sessions for a user except current
 */
export async function invalidateOtherSessions(
  userId: number,
  currentSessionId: string
): Promise<{
  success: boolean;
  invalidatedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // First count how many sessions will be invalidated
    const { count } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('invalidated', false)
      .neq('session_id', currentSessionId);

    // Then invalidate them
    const { error } = await supabase
      .from('user_sessions')
      .update({
        invalidated: true,
        invalidated_at: new Date().toISOString(),
        invalidated_by: userId
      })
      .eq('user_id', userId)
      .eq('invalidated', false)
      .neq('session_id', currentSessionId);

    if (error) {
      console.error('Error invalidating other sessions:', error);
      return {
        success: false,
        error: 'Failed to invalidate other sessions'
      };
    }

    return {
      success: true,
      invalidatedCount: count || 0
    };
  } catch (error) {
    console.error('Other sessions invalidation error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
