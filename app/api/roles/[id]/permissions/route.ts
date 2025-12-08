// API route for updating role permissions
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * PUT /api/roles/[id]/permissions
 * Update role permissions (Super Admin only)
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

    // Check if user is Super Admin (role_id = 1)
    if (sessionResult.session.role_id !== 1) {
      return NextResponse.json(
        { error: 'เฉพาะ Super Admin เท่านั้นที่สามารถแก้ไขสิทธิ์ได้' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { permissions } = body;
    const { id } = await params;
    const roleId = parseInt(id);

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'ข้อมูลสิทธิ์ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    // Check if role exists
    const { data: existingRole, error: checkError } = await supabase
      .from('master_system_role')
      .select('role_id, role_name')
      .eq('role_id', roleId)
      .single();

    if (checkError || !existingRole) {
      return NextResponse.json(
        { error: 'ไม่พบ role นี้' },
        { status: 404 }
      );
    }

    // Delete existing permissions
    const { error: deleteError } = await supabase
      .from('role_permission')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {
      console.error('Error deleting permissions:', deleteError);
      return NextResponse.json(
        { error: 'ไม่สามารถลบสิทธิ์เดิมได้' },
        { status: 500 }
      );
    }

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

    const { error: insertError } = await supabase
      .from('role_permission')
      .insert(permissionRecords);

    if (insertError) {
      console.error('Error inserting permissions:', insertError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกสิทธิ์ใหม่ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'อัพเดทสิทธิ์สำเร็จ',
      role_name: existingRole.role_name
    });
  } catch (error) {
    console.error('Update permissions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
