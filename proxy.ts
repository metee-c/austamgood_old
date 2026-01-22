/**
 * Next.js proxy for authentication and route protection
 * 
 * Migrated from middleware.ts to proxy.ts for Next.js 16+
 * Uses simple JWT-based authentication
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`🔍 [PROXY] Request: ${pathname}`);

  // ✅ CRITICAL: Prevent Vercel edge caching for all API routes (Session Mixing Fix)
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie'); // Tell CDN to vary by cookie
    
    // Skip authentication for /api/auth/* routes
    if (pathname.startsWith('/api/auth/')) {
      console.log(`✅ [PROXY] Skipping auth for API route: ${pathname}`);
      return response;
    }
    
    return response;
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    if (authRoutes.some(route => pathname.startsWith(route))) {
      const authToken = request.cookies.get('auth_token')?.value;

      if (authToken) {
        // Validate token before redirecting
        const isValid = validateToken(authToken);
        if (isValid) {
          // User is authenticated, redirect to dashboard
          console.log(`✅ [PROXY] User already authenticated, redirecting to dashboard`);
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        // Token invalid, clear cookie and allow login
        const response = NextResponse.next();
        response.cookies.delete('auth_token');
        return response;
      }
    }

    return NextResponse.next();
  }

  // Check for auth token
  const authToken = request.cookies.get('auth_token')?.value;

  console.log(`🍪 [PROXY] Auth token exists: ${!!authToken}`);

  if (!authToken) {
    // No auth token, redirect to login
    console.log(`❌ [PROXY] No auth token, redirecting to login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate JWT token
  console.log(`🔐 [PROXY] Validating JWT token...`);
  const isValid = validateToken(authToken);

  if (!isValid) {
    // Token expired or invalid, clear cookie and redirect to login
    console.log(`❌ [PROXY] Token invalid/expired, redirecting to login`);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    loginUrl.searchParams.set('timeout', '1'); // Flag for showing "session expired" message

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    return response;
  }

  // Token valid, allow the request to proceed
  console.log(`✅ [PROXY] Token valid, allowing request`);
  return NextResponse.next();
}

/**
 * Validate JWT token
 */
function validateToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (error) {
    console.error('❌ Token validation error:', error);
    return false;
  }
}

// Configure which routes to run proxy on
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
