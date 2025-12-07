// Next.js middleware for authentication and route protection
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

// Define routes that should redirect to dashboard if already authenticated
const authRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip authentication for all /api/auth/* routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    if (authRoutes.some(route => pathname.startsWith(route))) {
      const sessionToken = request.cookies.get('session_token')?.value;

      if (sessionToken) {
        // User is authenticated, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return NextResponse.next();
  }

  // Check for session token
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    // No session token, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session token exists, allow the request to proceed
  // The actual session validation will be done in the API routes or server components
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
