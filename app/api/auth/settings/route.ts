// API route for authentication system settings
import { 
NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentSession, 
  getAuthSettings, 
  updateAuthSettings,
  getAllSystemSettings,
  updateSystemSetting
} from '@/lib/auth';

/**
 * GET /api/auth/settings
 * Get authentication settings
 */
export async function GET(request: NextRequest) {
  try {
    // Get current session (require admin role)
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (sessionResult.session.role_name !== 'Admin' && sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      );
    }

    // Get query parameter
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'auth';

    if (type === 'all') {
      // Get all system settings
      const result = await getAllSystemSettings();

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถดึงข้อมูลการตั้งค่าได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        settings: result.settings
      });
    } else {
      // Get auth settings only
      const result = await getAuthSettings();

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถดึงข้อมูลการตั้งค่าได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        settings: result.settings
      });
    }
  } catch (error) {
    console.error('Get settings API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/settings
 * Update authentication settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Get current session (require admin role)
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (sessionResult.session.role_name !== 'Admin' && sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์แก้ไขการตั้งค่า' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settings, setting_key, setting_value } = body;

    // Update single setting
    if (setting_key && setting_value !== undefined) {
      const result = await updateSystemSetting(
        setting_key,
        setting_value.toString(),
        sessionResult.session.user_id
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถอัพเดทการตั้งค่าได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'อัพเดทการตั้งค่าสำเร็จ'
      });
    }

    // Update multiple auth settings
    if (settings) {
      const result = await updateAuthSettings(
        settings,
        sessionResult.session.user_id
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'ไม่สามารถอัพเดทการตั้งค่าได้' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'อัพเดทการตั้งค่าสำเร็จ'
      });
    }

    return NextResponse.json(
      { error: 'ข้อมูลไม่ถูกต้อง' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update settings API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
