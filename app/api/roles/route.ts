// API route for role management
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * GET /api/roles
 * Get all roles
 */
async function _GET(request: NextRequest) {
  try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Note: All authenticated users can view role list (needed for user forms)
    // Role creation/modification still requires Admin/Super Admin

    const supabase = createServiceRoleClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includePermissions = searchParams.get('include_permissions') === 'true';
    const includeUserCount = searchParams.get('include_user_count') === 'true';

    // Build query
    let query = supabase
      .from('master_system_role')
      .select('*')
      .order('role_name');

    const { data: roles, error } = await query;

    if (error) {
      console.error('Error fetching roles:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล roles ได้' },
        { status: 500 }
      );
    }

    // Enhance roles with additional data if requested
    const enhancedRoles = await Promise.all(roles.map(async (role) => {
      const enhanced: any = { ...role };

      // Get user count
      if (includeUserCount) {
        const { count } = await supabase
          .from('master_system_user')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.role_id)
          .eq('is_active', true);
        
        enhanced.user_count = count || 0;
      }

      // Get permissions
      if (includePermissions) {
        const { data: permissions } = await supabase
          .from('master_role_permission')
          .select(`
            permission_id,
            can_view,
            can_create,
            can_edit,
            can_delete,
            can_approve,
            can_import,
            can_export,
            can_print,
            can_scan,
            can_assign,
            can_complete,
            can_cancel,
            can_rollback,
            can_publish,
            can_optimize,
            can_change_status,
            can_manage_coordinates,
            can_reset_reservations,
            master_permission_module!inner(
              module_id,
              module_key,
              module_name,
              parent_module_id
            )
          `)
          .eq('role_id', role.role_id);
        
        enhanced.permissions = permissions || [];
      }

      return enhanced;
    }));

    return NextResponse.json({
      success: true,
      roles: enhancedRoles
    });
  } catch (error) {
    console.error('Get roles API error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles
 * Create a new role
 */
async function _POST(request: NextRequest) {
try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has permission
    if (sessionResult.session.role_name !== 'Admin' && sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์สร้าง role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role_name, description, is_active, permissions } = body;

    // Validate required fields
    if (!role_name) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อบทบาท' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if role_name already exists
    const { data: existingRole } = await supabase
      .from('master_system_role')
      .select('role_id')
      .eq('role_name', role_name)
      .single();

    if (existingRole) {
      return NextResponse.json(
        { error: 'ชื่อบทบาทนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Create role
    const { data: newRole, error: createError } = await supabase
      .from('master_system_role')
      .insert({
        role_name,
        description: description || null,
        is_active: is_active !== undefined ? is_active : true,
        created_by: sessionResult.session.user_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError || !newRole) {
      console.error('Error creating role:', createError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างบทบาทได้' },
        { status: 500 }
      );
    }

    // Create permissions if provided (module_ids array)
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const permissionRecords = permissions.map((module_id: number) => ({
        role_id: newRole.role_id,
        module_id: module_id,
        created_at: new Date().toISOString()
      }));

      const { error: permError } = await supabase
        .from('role_permission')
        .insert(permissionRecords);

      if (permError) {
        console.error('Error creating permissions:', permError);
        // Don't rollback, just log the error
        // User can add permissions later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'สร้าง role สำเร็จ',
      role: newRole
    });
  } catch (error) {
    console.error('Create role API error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
