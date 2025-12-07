// Authentication middleware for protecting routes
import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getSessionTokenFromRequest } from './session';
import { logAuditEntry } from './audit';

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requiredPermissions?: string[];
  requiredRole?: string;
  allowedRoles?: string[];
  redirectTo?: string;
}

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    user_id: number;
    username: string;
    email: string;
    full_name: string;
    role_id: number;
    role_name: string;
  };
  session?: {
    session_id: string;
    expires_in_seconds: number;
    last_activity_minutes_ago: number;
  };
}

/**
 * Middleware to authenticate requests
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{
  success: boolean;
  response?: NextResponse;
  user?: AuthenticatedRequest['user'];
  session?: AuthenticatedRequest['session'];
  error?: string;
}> {
  const {
    requireAuth = true,
    requiredPermissions = [],
    requiredRole,
    allowedRoles = [],
    redirectTo = '/login'
  } = options;

  // If authentication is not required, allow the request
  if (!requireAuth) {
    return { success: true };
  }

  // Get session token from request
  const token = getSessionTokenFromRequest(request);
  
  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      error: 'No session token provided'
    };
  }

  // Validate session
  const sessionResult = await validateSession(token);
  
  if (!sessionResult.success || !sessionResult.session) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      ),
      error: sessionResult.error || 'Session validation failed'
    };
  }

  const { session } = sessionResult;

  // Check role requirements
  if (requiredRole && session.role_name !== requiredRole) {
    await logAuditEntry({
      user_id: session.user_id,
      action: 'ACCESS_DENIED',
      entity_type: 'ROUTE',
      entity_id: request.nextUrl.pathname,
      new_values: {
        required_role: requiredRole,
        user_role: session.role_name,
        reason: 'Insufficient role privileges'
      },
      ip_address: getClientIP(request)
    });

    return {
      success: false,
      response: NextResponse.json(
        { error: 'Insufficient privileges' },
        { status: 403 }
      ),
      error: `Required role: ${requiredRole}, user role: ${session.role_name}`
    };
  }

  // Check allowed roles
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role_name)) {
    await logAuditEntry({
      user_id: session.user_id,
      action: 'ACCESS_DENIED',
      entity_type: 'ROUTE',
      entity_id: request.nextUrl.pathname,
      new_values: {
        allowed_roles: allowedRoles,
        user_role: session.role_name,
        reason: 'Role not in allowed list'
      },
      ip_address: getClientIP(request)
    });

    return {
      success: false,
      response: NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      ),
      error: `User role ${session.role_name} not in allowed roles: ${allowedRoles.join(', ')}`
    };
  }

  // Check permissions (if required)
  if (requiredPermissions.length > 0) {
    const hasPermissions = await checkUserPermissions(
      session.user_id,
      requiredPermissions
    );

    if (!hasPermissions) {
      await logAuditEntry({
        user_id: session.user_id,
        action: 'ACCESS_DENIED',
        entity_type: 'ROUTE',
        entity_id: request.nextUrl.pathname,
        new_values: {
          required_permissions: requiredPermissions,
          reason: 'Insufficient permissions'
        },
        ip_address: getClientIP(request)
      });

      return {
        success: false,
        response: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        ),
        error: `Missing required permissions: ${requiredPermissions.join(', ')}`
      };
    }
  }

  // Log successful access
  await logAuditEntry({
    user_id: session.user_id,
    action: 'ROUTE_ACCESS',
    entity_type: 'ROUTE',
    entity_id: request.nextUrl.pathname,
    new_values: {
      method: request.method,
      user_agent: request.headers.get('user-agent')
    },
    ip_address: getClientIP(request)
  });

  return {
    success: true,
    user: {
      user_id: session.user_id,
      username: session.username,
      email: session.email,
      full_name: session.full_name,
      role_id: session.role_id,
      role_name: session.role_name
    },
    session: {
      session_id: session.session_id,
      expires_in_seconds: session.expires_in_seconds,
      last_activity_minutes_ago: session.last_activity_minutes_ago
    }
  };
}

/**
 * Check if user has required permissions
 */
export async function checkUserPermissions(
  userId: number,
  requiredPermissions: string[]
): Promise<boolean> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Get user's permissions through their role
    const { data, error } = await supabase
      .from('master_system_user')
      .select(`
        role_id,
        master_role!inner(
          master_role_permission!inner(
            master_permission_module!inner(
              module_key
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !data || data.length === 0) {
      console.error('Error checking user permissions:', error);
      return false;
    }

    // Extract user's permissions
    const userPermissions = new Set<string>();
    const roleData = data[0].master_role as any;

    if (roleData && Array.isArray(roleData)) {
      // master_role is returned as array when using !inner
      roleData.forEach((role: any) => {
        if (role.master_role_permission && Array.isArray(role.master_role_permission)) {
          role.master_role_permission.forEach((rp: any) => {
            if (rp.master_permission_module && Array.isArray(rp.master_permission_module)) {
              rp.master_permission_module.forEach((module: any) => {
                if (module.module_key) {
                  userPermissions.add(module.module_key);
                }
              });
            }
          });
        }
      });
    }

    // Check if user has all required permissions
    return requiredPermissions.every(permission => 
      userPermissions.has(permission)
    );
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Try various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a default IP if none found
  return '127.0.0.1';
}

/**
 * Create a protected API route handler
 */
export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request, options);
    
    if (!authResult.success) {
      return authResult.response || NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Attach user and session data to request
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = authResult.user;
    authenticatedRequest.session = authResult.session;

    return handler(authenticatedRequest);
  };
}

/**
 * Rate limiting middleware
 */
interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator } = options;

  return (request: NextRequest): NextResponse | null => {
    const key = keyGenerator ? keyGenerator(request) : getClientIP(request);
    const now = Date.now();
    
    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }

    const current = rateLimitStore.get(key);
    
    if (!current) {
      // First request from this key
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return null; // Allow request
    }

    if (now > current.resetTime) {
      // Window has expired, reset
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return null; // Allow request
    }

    if (current.count >= maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString()
          }
        }
      );
    }

    // Increment count
    current.count++;
    return null; // Allow request
  };
}
