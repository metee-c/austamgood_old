// API route for role permission management
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuditEntry } from '@/lib/auth/audit';
import { getClientIP } from '@/lib/auth/middleware';

/**
 * GET /api/admin/roles/[id]/permissions
 * Get all permissions for a specific role
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Role ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get role permissions
    const { data: permissions, error } = await supabase
      .from('master_role_permission')
      .select(`
        permission_id,
        role_id,
        module_id,
        created_at,
        created_by,
        master_permission_module!inner(
          module_id,
          module_key,
          module_name,
          module_description,
          category,
          parent_module_id
        )
      `)
      .eq('role_id', roleId);

    if (error) {
      console.error('Error getting role permissions:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล permissions ได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      permissions: permissions || []
    });
  } catch (error) {
    console.error('Get role permissions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/roles/[id]/permissions
 * Update role permissions (replace all)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: 'ไม่มีสิทธิ์แก้ไข permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Role ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { module_ids } = body;

    if (!Array.isArray(module_ids)) {
      return NextResponse.json(
        { error: 'module_ids ต้องเป็น array' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current permissions for audit
    const { data: currentPermissions } = await supabase
      .from('master_role_permission')
      .select('module_id')
      .eq('role_id', roleId);

    const currentModuleIds = currentPermissions?.map(p => p.module_id) || [];

    // Delete all current permissions
    const { error: deleteError } = await supabase
      .from('master_role_permission')
      .delete()
      .eq('role_id', roleId);

    if (deleteError) {
      console.error('Error deleting permissions:', deleteError);
      return NextResponse.json(
        { error: 'ไม่สามารถลบ permissions เดิมได้' },
        { status: 500 }
      );
    }

    // Insert new permissions
    if (module_ids.length > 0) {
      const permissionInserts = module_ids.map((moduleId: number) => ({
        role_id: roleId,
        module_id: moduleId,
        created_by: sessionResult.session.user_id,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('master_role_permission')
        .insert(permissionInserts);

      if (insertError) {
        console.error('Error inserting permissions:', insertError);
        return NextResponse.json(
          { error: 'ไม่สามารถเพิ่ม permissions ใหม่ได้' },
          { status: 500 }
        );
      }
    }

    // Log the change
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'ROLE_PERMISSIONS_UPDATE',
      entity_type: 'ROLE',
      entity_id: roleId.toString(),
      old_values: {
        module_ids: currentModuleIds
      },
      new_values: {
        module_ids: module_ids
      },
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      message: 'อัพเดท permissions สำเร็จ'
    });
  } catch (error) {
    console.error('Update role permissions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/roles/[id]/permissions/bulk
 * Bulk update permissions (add/remove specific permissions)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { error: 'ไม่มีสิทธิ์แก้ไข permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const roleId = parseInt(id);
    if (isNaN(roleId)) {
      return NextResponse.json(
        { error: 'Role ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { add_module_ids = [], remove_module_ids = [] } = body;

    if (!Array.isArray(add_module_ids) || !Array.isArray(remove_module_ids)) {
      return NextResponse.json(
        { error: 'add_module_ids และ remove_module_ids ต้องเป็น array' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Remove permissions
    if (remove_module_ids.length > 0) {
      const { error: removeError } = await supabase
        .from('master_role_permission')
        .delete()
        .eq('role_id', roleId)
        .in('module_id', remove_module_ids);

      if (removeError) {
        console.error('Error removing permissions:', removeError);
        return NextResponse.json(
          { error: 'ไม่สามารถลบ permissions ได้' },
          { status: 500 }
        );
      }
    }

    // Add permissions
    if (add_module_ids.length > 0) {
      const permissionInserts = add_module_ids.map((moduleId: number) => ({
        role_id: roleId,
        module_id: moduleId,
        created_by: sessionResult.session.user_id,
        created_at: new Date().toISOString()
      }));

      const { error: addError } = await supabase
        .from('master_role_permission')
        .insert(permissionInserts);

      if (addError) {
        console.error('Error adding permissions:', addError);
        return NextResponse.json(
          { error: 'ไม่สามารถเพิ่ม permissions ได้' },
          { status: 500 }
        );
      }
    }

    // Log the change
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'ROLE_PERMISSIONS_BULK_UPDATE',
      entity_type: 'ROLE',
      entity_id: roleId.toString(),
      new_values: {
        added: add_module_ids,
        removed: remove_module_ids
      },
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      message: 'อัพเดท permissions สำเร็จ',
      added_count: add_module_ids.length,
      removed_count: remove_module_ids.length
    });
  } catch (error) {
    console.error('Bulk update permissions API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
