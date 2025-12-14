/**
 * Next.js middleware for authentication and route protection
 * 
 * TODO: Migrate to proxy.ts when Next.js 17 is released
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 * 
 * Note: middleware.ts convention is deprecated in Next.js 15+
 * and will not be supported in Next.js 17+
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/change-password', // Allow change-password for forced password changes
];

// Define routes that should redirect to dashboard if already authenticated
const authRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

// Session timeout in minutes (30 นาที)
const SESSION_TIMEOUT_MINUTES = 30;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`🔍 [MIDDLEWARE] Request: ${pathname}`);

  // Skip authentication for all /api/auth/* routes
  if (pathname.startsWith('/api/auth/')) {
    console.log(`✅ [MIDDLEWARE] Skipping auth for API route: ${pathname}`);
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    if (authRoutes.some(route => pathname.startsWith(route))) {
      const sessionToken = request.cookies.get('session_token')?.value;

      if (sessionToken) {
        // Validate session before redirecting
        const isValid = await validateSessionToken(sessionToken);
        if (isValid) {
          // User is authenticated, redirect to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        // Session invalid, clear cookie and allow login
        const response = NextResponse.next();
        response.cookies.delete('session_token');
        return response;
      }
    }

    return NextResponse.next();
  }

  // Check for session token
  const sessionToken = request.cookies.get('session_token')?.value;

  console.log(`🍪 [MIDDLEWARE] Session token exists: ${!!sessionToken}`);

  if (!sessionToken) {
    // No session token, redirect to login
    console.log(`❌ [MIDDLEWARE] No session token, redirecting to login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session and check timeout
  console.log(`🔐 [MIDDLEWARE] Validating session token...`);
  const isValid = await validateSessionToken(sessionToken);

  if (!isValid) {
    // Session expired or invalid, clear cookie and redirect to login
    console.log(`❌ [MIDDLEWARE] Session invalid/expired, redirecting to login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('timeout', '1'); // Flag for showing "session expired" message

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('session_token');
    return response;
  }

  // Session valid, allow the request to proceed
  console.log(`✅ [MIDDLEWARE] Session valid, allowing request`);
  return NextResponse.next();
}

/**
 * Validate session token and check timeout
 */
async function validateSessionToken(token: string): Promise<boolean> {
  try {
    // Create Supabase client for middleware
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {}
        }
      }
    );

    // Call validate_session_token RPC
    const { data, error } = await supabase.rpc('validate_session_token', {
      p_token: token
    });

    if (error || !data || data.length === 0) {
      return false;
    }

    const session = data[0];

    // Check if session is valid and not expired
    if (!session.is_valid) {
      return false;
    }

    // Check session timeout (30 นาที)
    if (session.last_activity_minutes_ago > SESSION_TIMEOUT_MINUTES) {
      console.log(`⏰ Session timeout: ${session.last_activity_minutes_ago} minutes ago`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Session validation error:', error);
    return false;
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (image files)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|images|public/).*)',
  ],
};
