import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to prevent caching of authenticated routes
 * This is CRITICAL to prevent session mixing on Vercel
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // ✅ CRITICAL: Prevent Vercel edge caching for all API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Vary', 'Cookie'); // Tell CDN to vary by cookie
  }
  
  return response;
}

// Apply middleware to all API routes
export const config = {
  matcher: '/api/:path*',
};
