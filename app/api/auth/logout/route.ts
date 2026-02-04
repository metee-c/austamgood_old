// API route for user logout - Simple version
import { NextRequest, NextResponse } from 'next/server';
import { apiLog } from '@/lib/logging';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _POST(request: NextRequest) {
  const txId = await apiLog.start('AUTH', request);
  
  try {
    const response = NextResponse.json({
      success: true,
      message: 'ออกจากระบบสำเร็จ'
    });

    // Clear auth cookie
    response.cookies.delete('auth_token');

    apiLog.success(txId, 'AUTH_LOGOUT');
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    apiLog.failure(txId, 'AUTH_LOGOUT', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
