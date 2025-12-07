// API route for role management
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/roles
 * Get all roles
 */
export async function GET(request: NextRequest) {
  try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check if user has permission to view roles
    if (sessionResult.session.role_name !== 'Admin' && sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const includePermissions = searchParams.get('include_permissions') === 'true';
    const includeUserCount = searchParams.get('include_user_count') === 'true';

    // Build query
    let query = supabase
      .from('master_role')
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
export async function POST(request: NextRequest) {
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
    const { role_name, role_key, description, permissions } = body;

    // Validate required fields
    if (!role_name || !role_key) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อ role และ role key' },
        { status: 400 }
      );
    }

    // Validate permissions array
    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกสิทธิ์อย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if role_key already exists
    const { data: existingRole } = await supabase
      .from('master_role')
      .select('role_id')
      .eq('role_key', role_key)
      .single();

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role key นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Create role
    const { data: newRole, error: createError } = await supabase
      .from('master_role')
      .insert({
        role_name,
        role_key,
        description,
        is_system: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError || !newRole) {
      console.error('Error creating role:', createError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้าง role ได้' },
        { status: 500 }
      );
    }

    // Create permissions
    const permissionRecords = permissions.map((perm: any) => ({
      role_id: newRole.role_id,
      module_id: perm.module_id,
      can_view: perm.can_view || false,
      can_create: perm.can_create || false,
      can_edit: perm.can_edit || false,
      can_delete: perm.can_delete || false,
      can_approve: perm.can_approve || false,
      can_import: perm.can_import || false,
      can_export: perm.can_export || false,
      can_print: perm.can_print || false,
      can_scan: perm.can_scan || false,
      can_assign: perm.can_assign || false,
      can_complete: perm.can_complete || false,
      can_cancel: perm.can_cancel || false,
      can_rollback: perm.can_rollback || false,
      can_publish: perm.can_publish || false,
      can_optimize: perm.can_optimize || false,
      can_change_status: perm.can_change_status || false,
      can_manage_coordinates: perm.can_manage_coordinates || false,
      can_reset_reservations: perm.can_reset_reservations || false,
      created_at: new Date().toISOString()
    }));

    const { error: permError } = await supabase
      .from('master_role_permission')
      .insert(permissionRecords);

    if (permError) {
      console.error('Error creating permissions:', permError);
      // Rollback: delete the role
      await supabase
        .from('master_role')
        .delete()
        .eq('role_id', newRole.role_id);
      
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างสิทธิ์ได้' },
        { status: 500 }
      );
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
