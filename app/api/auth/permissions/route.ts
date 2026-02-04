// API route to get current user's permissions
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/simple-auth';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

/**
 * GET /api/auth/permissions
 * Get permissions for the current authenticated user
 */
async function _GET(request: NextRequest) {
  try {
    console.log('🔑 [API /auth/permissions] Checking authentication...');
    
    // Get all cookies for debugging
    const allCookies = request.cookies.getAll();
    console.log('🍪 [API /auth/permissions] All cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })));
    
    // Get token from cookie
    const token = request.cookies.get('auth_token')?.value;
    console.log('🍪 [API /auth/permissions] auth_token exists:', !!token);
    
    if (!token) {
      console.log('❌ [API /auth/permissions] No token found in cookies');
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    console.log('🔐 [API /auth/permissions] Verifying token...');
    // Verify token and get user
    const result = await getUserFromToken(token);
    console.log('🔐 [API /auth/permissions] Token verification result:', { success: result.success, hasUser: !!result.user });
    
    if (!result.success || !result.user) {
      console.log('❌ [API /auth/permissions] Token verification failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const user = result.user;
    console.log('✅ [API /auth/permissions] User authenticated:', user.email);

    const supabase = await createClient();

    // Get user's role_id
    const { data: userData, error: userError } = await supabase
      .from('master_system_user')
      .select('role_id, master_system_role!fk_master_system_user_role(role_name)')
      .eq('user_id', user.user_id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ใช้' },
        { status: 404 }
      );
    }

    // Admin and Super Admin have all permissions
    const roleName = (userData.master_system_role as any)?.role_name;
    console.log('🔑 [API /auth/permissions] User role:', roleName);
    
    if (roleName === 'Admin' || roleName === 'Super Admin') {
      // Return all permissions
      const { data: allPermissions } = await supabase
        .from('master_permission_module')
        .select('module_id, module_key, module_name')
        .eq('is_active', true)
        .not('module_key', 'is', null) // ✅ กรอง module_key ที่เป็น null ออก
        .order('module_id');

      console.log('🔑 [API /auth/permissions] Admin/Super Admin - Total permissions:', allPermissions?.length);

      return NextResponse.json({
        success: true,
        permissions: allPermissions || [],
        role_name: roleName
      });
    }

    // Get permissions for the user's role (only where can_view = true)
    const { data: permissions, error: permError } = await supabase
      .from('role_permission')
      .select(`
        module_id,
        can_view,
        can_create,
        can_edit,
        can_delete,
        master_permission_module!inner(
          module_id,
          module_key,
          module_name,
          is_active
        )
      `)
      .eq('role_id', userData.role_id)
      .eq('can_view', true); // ✅ เพิ่มเงื่อนไข: เฉพาะ permission ที่ can_view = true

    if (permError) {
      console.error('Error fetching permissions:', permError);
      return NextResponse.json(
        { error: 'ไม่สามารถโหลดสิทธิ์ได้' },
        { status: 500 }
      );
    }

    // Transform permissions to flat array with action flags
    const userPermissions = permissions?.map((p: any) => ({
      module_id: p.master_permission_module.module_id,
      module_key: p.master_permission_module.module_key,
      module_name: p.master_permission_module.module_name,
      can_view: p.can_view,
      can_create: p.can_create,
      can_edit: p.can_edit,
      can_delete: p.can_delete
    })) || [];

    console.log('🔑 [API /auth/permissions] User:', user.user_id, 'Role:', roleName);
    console.log('🔑 [API /auth/permissions] Permissions count:', userPermissions.length);
    console.log('🔑 [API /auth/permissions] Has mobile.transfer?', userPermissions.some((p: any) => p.module_key === 'mobile.transfer'));

    return NextResponse.json({
      success: true,
      permissions: userPermissions,
      role_name: roleName
    });
  } catch (error) {
    console.error('Get permissions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
