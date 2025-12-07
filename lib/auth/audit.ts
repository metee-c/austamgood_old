// Audit logging utilities
import { createClient } from '@/lib/supabase/server';

export interface AuditLogEntry {
  user_id: number;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
}

export interface AuditLogQuery {
  user_id?: number;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  log_id: string;
  user_id: number;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  session_id?: string;
  username?: string;
  full_name?: string;
}

/**
 * Log an audit entry
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<{
  success: boolean;
  log_id?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to log audit entry
    const { data, error } = await supabase.rpc('log_audit', {
      p_user_id: entry.user_id,
      p_action: entry.action,
      p_entity_type: entry.entity_type || null,
      p_entity_id: entry.entity_id || null,
      p_old_values: entry.old_values ? JSON.stringify(entry.old_values) : null,
      p_new_values: entry.new_values ? JSON.stringify(entry.new_values) : null,
      p_ip_address: entry.ip_address || null,
      p_session_id: entry.session_id || null
    });

    if (error) {
      console.error('Error logging audit entry:', error);
      return {
        success: false,
        error: 'Failed to log audit entry'
      };
    }

    return {
      success: true,
      log_id: data
    };
  } catch (error) {
    console.error('Audit logging error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(query: AuditLogQuery = {}): Promise<{
  success: boolean;
  logs?: AuditLogResult[];
  total?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      user_id,
      action,
      entity_type,
      entity_id,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = query;

    let queryBuilder = supabase
      .from('audit_logs')
      .select(`
        log_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at,
        session_id,
        master_system_user!inner(
          username,
          full_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (user_id) {
      queryBuilder = queryBuilder.eq('user_id', user_id);
    }

    if (action) {
      queryBuilder = queryBuilder.eq('action', action);
    }

    if (entity_type) {
      queryBuilder = queryBuilder.eq('entity_type', entity_type);
    }

    if (entity_id) {
      queryBuilder = queryBuilder.eq('entity_id', entity_id);
    }

    if (start_date) {
      queryBuilder = queryBuilder.gte('created_at', start_date.toISOString());
    }

    if (end_date) {
      queryBuilder = queryBuilder.lte('created_at', end_date.toISOString());
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) {
      console.error('Error getting audit logs:', error);
      return {
        success: false,
        error: 'Failed to retrieve audit logs'
      };
    }

    // Transform the data
    const logs: AuditLogResult[] = (data || []).map((log: any) => ({
      log_id: log.log_id,
      user_id: log.user_id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      old_values: log.old_values,
      new_values: log.new_values,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      created_at: log.created_at,
      session_id: log.session_id,
      username: log.master_system_user?.username,
      full_name: log.master_system_user?.full_name
    }));

    return {
      success: true,
      logs,
      total: count || 0
    };
  } catch (error) {
    console.error('Audit log retrieval error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get user's audit trail
 */
export async function getUserAuditTrail(
  userId: number,
  limit: number = 100
): Promise<{
  success: boolean;
  logs?: AuditLogResult[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Call the database function to get user audit trail
    const { data, error } = await supabase.rpc('get_user_audit_trail', {
      p_user_id: userId,
      p_limit: limit
    });

    if (error) {
      console.error('Error getting user audit trail:', error);
      return {
        success: false,
        error: 'Failed to retrieve user audit trail'
      };
    }

    // Get additional user info for each log
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select('username, full_name')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Error getting user info:', userError);
    }

    const logs: AuditLogResult[] = (data || []).map((log: any) => ({
      log_id: log.log_id,
      user_id: userId,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      old_values: null,
      new_values: null,
      ip_address: null,
      user_agent: null,
      created_at: log.created_at,
      session_id: null,
      username: userData?.username,
      full_name: userData?.full_name
    }));

    return {
      success: true,
      logs
    };
  } catch (error) {
    console.error('User audit trail error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_RESET' | 'ACCOUNT_LOCKED' | 'ACCOUNT_UNLOCKED',
  userId: number | null,
  details: {
    email?: string;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    failure_reason?: string;
    [key: string]: any;
  }
): Promise<void> {
  try {
    if (userId) {
      await logAuditEntry({
        user_id: userId,
        action,
        entity_type: 'AUTHENTICATION',
        new_values: details,
        ip_address: details.ip_address,
        user_agent: details.user_agent,
        session_id: details.session_id
      });
    } else {
      // For failed logins where we don't have a user_id
      // We'll need to log this differently or create a separate table
      console.log('Auth event (no user):', { action, details });
    }
  } catch (error) {
    console.error('Error logging auth event:', error);
    // Don't throw error as this is logging - shouldn't break the main flow
  }
}

/**
 * Log data changes
 */
export async function logDataChange(
  userId: number,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  sessionId?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await logAuditEntry({
      user_id: userId,
      action: `${entityType}_${action}`,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      session_id: sessionId,
      ip_address: ipAddress
    });
  } catch (error) {
    console.error('Error logging data change:', error);
    // Don't throw error as this is logging - shouldn't break the main flow
  }
}

/**
 * Log permission changes
 */
export async function logPermissionChange(
  userId: number,
  action: 'GRANT' | 'REVOKE',
  targetUserId: number,
  permissions: string[],
  sessionId?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await logAuditEntry({
      user_id: userId,
      action: `PERMISSION_${action}`,
      entity_type: 'USER_PERMISSION',
      entity_id: targetUserId.toString(),
      new_values: {
        permissions,
        target_user_id: targetUserId
      },
      session_id: sessionId,
      ip_address: ipAddress
    });
  } catch (error) {
    console.error('Error logging permission change:', error);
  }
}

/**
 * Get audit statistics
 */
export async function getAuditStatistics(days: number = 30): Promise<{
  success: boolean;
  stats?: {
    total_events: number;
    unique_users: number;
    top_actions: Array<{ action: string; count: number }>;
    events_by_day: Array<{ date: string; count: number }>;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get total events and unique users
    const { data: totalData, error: totalError } = await supabase
      .from('audit_logs')
      .select('user_id', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    if (totalError) {
      throw totalError;
    }

    const uniqueUsers = new Set(totalData?.map(log => log.user_id) || []).size;

    // Get top actions
    const { data: actionData, error: actionError } = await supabase
      .from('audit_logs')
      .select('action')
      .gte('created_at', startDate.toISOString());

    if (actionError) {
      throw actionError;
    }

    const actionCounts = (actionData || []).reduce((acc: Record<string, number>, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get events by day
    const eventsByDay: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const { count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${dateStr}T00:00:00.000Z`)
        .lt('created_at', `${dateStr}T23:59:59.999Z`);

      eventsByDay.push({ date: dateStr, count: count || 0 });
    }

    return {
      success: true,
      stats: {
        total_events: totalData?.length || 0,
        unique_users: uniqueUsers,
        top_actions: topActions,
        events_by_day: eventsByDay.reverse()
      }
    };
  } catch (error) {
    console.error('Error getting audit statistics:', error);
    return {
      success: false,
      error: 'Failed to retrieve audit statistics'
    };
  }
}
