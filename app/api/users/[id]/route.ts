// API route for individual user operations
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createServiceRoleClient, createClient } from '@/lib/supabase/server';
import { logAuditEntry } from '@/lib/auth/audit';
import { getClientIP } from '@/lib/auth/middleware';

/**
 * GET /api/users/[id]
 * Get a single user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'User ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        username,
        email,
        full_name,
        phone_number,
        employee_id,
        role_id,
        is_active,
        last_login_at,
        created_by,
        created_at,
        updated_at,
        remarks,
        master_employee(
          employee_code,
          first_name,
          last_name
        ),
        master_system_role!fk_master_system_user_role(
          role_id,
          role_name
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้นี้' },
        { status: 404 }
      );
    }

    // Transform data to match expected format
    const employee = data.master_employee as any;
    const employee_name = employee
      ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
      : null;

    const role = data.master_system_role as any;

    const transformedData = {
      ...data,
      employee_name,
      employee_code: employee?.employee_code,
      role_name: role?.role_name,
      roles: role ? [role] : []
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Get user API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/[id]
 * Update a user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResult = await getCurrentSession();
    
    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'User ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = await createClient();

    // Get current user data for audit
    const { data: currentUser } = await supabase
      .from('master_system_user')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้นี้' },
        { status: 404 }
      );
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('master_system_user')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json(
        { error: 'ไม่สามารถอัพเดทผู้ใช้งานได้' },
        { status: 500 }
      );
    }

    // Log the action
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'USER_UPDATE',
      entity_type: 'USER',
      entity_id: userId.toString(),
      old_values: currentUser,
      new_values: body,
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'อัพเดทผู้ใช้งานสำเร็จ'
    });
  } catch (error) {
    console.error('Update user API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user (hard delete - permanently remove from database)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResult = await getCurrentSession();

    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'User ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === sessionResult.session.user_id) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบผู้ใช้งานของตัวเองได้' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Hard delete - permanently remove from database
    const { error: deleteError } = await supabase
      .from('master_system_user')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json(
        { error: 'ไม่สามารถลบผู้ใช้งานได้' },
        { status: 500 }
      );
    }

    // Log the action
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'USER_DELETE',
      entity_type: 'USER',
      entity_id: userId.toString(),
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      message: 'ลบผู้ใช้งานสำเร็จ'
    });
  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
