// API route for user role assignment
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuditEntry } from '@/lib/auth/audit';
import { getClientIP } from '@/lib/auth/middleware';

/**
 * GET /api/admin/users/[id]/roles
 * Get all roles assigned to a user
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
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'User ID ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get user's role (from master_system_user table)
    const { data: user, error: userError } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        role_id,
        master_role!inner(
          role_id,
          role_name,
          role_description,
          is_active
        )
      `)
      .eq('user_id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'ไม่พบผู้ใช้นี้' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      role: user.master_role
    });
  } catch (error) {
    console.error('Get user roles API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users/[id]/roles
 * Assign a role to a user
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
        { error: 'ไม่มีสิทธิ์กำหนด role' },
        { status: 403 }
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
    const { role_id } = body;

    if (!role_id) {
      return NextResponse.json(
        { error: 'กรุณาระบุ role_id' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if role exists and is active
    const { data: role, error: roleError } = await supabase
      .from('master_role')
      .select('role_id, role_name, is_active')
      .eq('role_id', role_id)
      .single();

    if (roleError || !role) {
      return NextResponse.json(
        { error: 'ไม่พบ role นี้' },
        { status: 404 }
      );
    }

    if (!role.is_active) {
      return NextResponse.json(
        { error: 'Role นี้ไม่ได้เปิดใช้งาน' },
        { status: 400 }
      );
    }

    // Get current user data for audit
    const { data: currentUser } = await supabase
      .from('master_system_user')
      .select('role_id')
      .eq('user_id', userId)
      .single();

    // Update user's role
    const { error: updateError } = await supabase
      .from('master_system_user')
      .update({
        role_id: role_id,
        updated_by: sessionResult.session.user_id,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error assigning role:', updateError);
      return NextResponse.json(
        { error: 'ไม่สามารถกำหนด role ได้' },
        { status: 500 }
      );
    }

    // Log the change
    await logAuditEntry({
      user_id: sessionResult.session.user_id,
      action: 'USER_ROLE_ASSIGN',
      entity_type: 'USER',
      entity_id: userId.toString(),
      old_values: {
        role_id: currentUser?.role_id
      },
      new_values: {
        role_id: role_id,
        role_name: role.role_name
      },
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      message: 'กำหนด role สำเร็จ'
    });
  } catch (error) {
    console.error('Assign role API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
