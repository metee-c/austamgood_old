import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/auth/auth-service';
import { getSessionTokenFromCookies, clearSessionCookie } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = await getSessionTokenFromCookies();

    if (sessionToken) {
      // Invalidate session in database
      await logout(sessionToken);
    }

    // Clear session cookie
    await clearSessionCookie();

    return NextResponse.json(
      { success: true, message: 'ออกจากระบบสำเร็จ' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการออกจากระบบ' },
      { status: 500 }
    );
  }
}

// Support GET method for simple logout links
export async function GET(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = await getSessionTokenFromCookies();

    if (sessionToken) {
      // Invalidate session in database
      await logout(sessionToken);
    }

    // Clear session cookie
    await clearSessionCookie();

    // Redirect to login page
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect to login even if there's an error
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
