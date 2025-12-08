// API route for individual role operations
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/roles/[id]
 * Get role details with permissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();
    const { id } = await params;
    const roleId = parseInt(id);

    // Get role details
    const { data: role, error: roleError } = await supabase
      .from('master_system_role')
      .select('*')
      .eq('role_id', roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'ไม่พบ role นี้' },
        { status: 404 }
      );
    }

    // Get permissions with module details
    const { data: permissions, error: permError } = await supabase
      .from('role_permission')
      .select(`
        *,
        master_permission_module(*)
      `)
      .eq('role_id', roleId);

    if (permError) {
      console.error('Error fetching permissions:', permError);
    }

    // Get user count
    const { count: userCount } = await supabase
      .from('master_system_user')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId)
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      role: {
        ...role,
        permissions: permissions || [],
        user_count: userCount || 0
      }
    });
  } catch (error) {
    console.error('Get role API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roles/[id]
 * Update role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    // Check permission
    if (sessionResult.session.role_name !== 'Admin' && sessionResult.session.role_name !== 'Super Admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์แก้ไข role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role_name, description, permissions } = body;
    const { id } = await params;
    const roleId = parseInt(id);

    // Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();

    // Check if role exists
    const { data: existingRole, error: checkError } = await supabase
      .from('master_system_role')
      .select('role_id')
      .eq('role_id', roleId)
      .single();

    if (checkError || !existingRole) {
      return NextResponse.json(
        { error: 'ไม่พบ role นี้' },
        { status: 404 }
      );
    }

    // Update role
    const { error: updateError } = await supabase
      .from('master_system_role')
      .update({
        role_name,
        description,
        updated_at: new Date().toISOString()
      })
      .eq('role_id', roleId);

    if (updateError) {
      console.error('Error updating role:', updateError);
      return NextResponse.json(
        { error: 'ไม่สามารถอัพเดท role ได้' },
        { status: 500 }
      );
    }

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Delete existing permissions
      await supabase
        .from('role_permission')
        .delete()
        .eq('role_id', roleId);

      // Insert new permissions
      const permissionRecords = permissions.map((perm: any) => ({
        role_id: roleId,
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
        .from('role_permission')
        .insert(permissionRecords);

      if (permError) {
        console.error('Error updating permissions:', permError);
        return NextResponse.json(
          { error: 'ไม่สามารถอัพเดทสิทธิ์ได้' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'อัพเดท role สำเร็จ'
    });
  } catch (error) {
    console.error('Update role API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id]
 * Delete role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const roleId = parseInt(id);
    
    console.log('🗑️ [API DELETE ROLE] Starting delete for role_id:', roleId);
    
    // Get current session
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      console.log('❌ [API DELETE ROLE] Not authenticated');
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    console.log('👤 [API DELETE ROLE] User:', sessionResult.session.username, 'Role:', sessionResult.session.role_name);

    // Check permission
    if (sessionResult.session.role_name !== 'Super Admin') {
      console.log('❌ [API DELETE ROLE] Insufficient permissions');
      return NextResponse.json(
        { error: 'เฉพาะ Super Admin เท่านั้นที่สามารถลบ role ได้' },
        { status: 403 }
      );
    }

    // Use service role client to bypass RLS for admin operations
    const supabase = createServiceRoleClient();

    // Check if role exists
    const { data: role, error: checkError} = await supabase
      .from('master_system_role')
      .select('role_id, role_name')
      .eq('role_id', roleId)
      .single();

    console.log('🔍 [API DELETE ROLE] Role check:', { role, checkError });

    if (checkError || !role) {
      console.log('❌ [API DELETE ROLE] Role not found');
      return NextResponse.json(
        { error: 'ไม่พบ role นี้' },
        { status: 404 }
      );
    }

    // Check if any users are assigned to this role
    const { count: userCount } = await supabase
      .from('master_system_user')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId);

    console.log('👥 [API DELETE ROLE] User count:', userCount);

    if (userCount && userCount > 0) {
      console.log('❌ [API DELETE ROLE] Cannot delete - has users');
      return NextResponse.json(
        { error: `ไม่สามารถลบ role ได้ เนื่องจากมีผู้ใช้ ${userCount} คนที่ใช้ role นี้อยู่` },
        { status: 400 }
      );
    }

    // Delete permissions first
    console.log('🗑️ [API DELETE ROLE] Deleting permissions...');
    const { error: permDeleteError } = await supabase
      .from('role_permission')
      .delete()
      .eq('role_id', roleId);

    if (permDeleteError) {
      console.error('❌ [API DELETE ROLE] Error deleting permissions:', permDeleteError);
    } else {
      console.log('✅ [API DELETE ROLE] Permissions deleted');
    }

    // Delete role
    console.log('🗑️ [API DELETE ROLE] Deleting role...');
    const { error: deleteError } = await supabase
      .from('master_system_role')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {
      console.error('❌ [API DELETE ROLE] Error deleting role:', deleteError);
      return NextResponse.json(
        { error: 'ไม่สามารถลบ role ได้', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log('✅ [API DELETE ROLE] Role deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'ลบ role สำเร็จ',
      deleted_role_id: roleId
    });
  } catch (error) {
    console.error('❌ [API DELETE ROLE] Exception:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
