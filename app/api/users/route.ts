// API route for user management
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth/simple-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logAuditEntry } from '@/lib/auth/audit';
import { getClientIP } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
/**
 * GET /api/users
 * Get all users with optional filters
 */
async function _GET(request: NextRequest) {
  try {
    // Get current user from JWT token
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const authResult = await getUserFromToken(token);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const roleId = searchParams.get('role_id');
    const isActive = searchParams.get('is_active');

    const supabase = createServiceRoleClient();

    // Build query
    let query = supabase
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
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
    }

    if (roleId) {
      query = query.eq('role_id', parseInt(roleId));
    }

    if (isActive !== null && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้' },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const users = data.map((user: any) => {
      // Combine first_name and last_name for employee_name
      const employee = user.master_employee;
      const employee_name = employee
        ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
        : null;

      // Get role from the relationship
      const role = user.master_system_role;

      return {
        ...user,
        employee_name,
        employee_code: employee?.employee_code,
        role_name: role?.role_name,
        roles: role ? [role] : []
      };
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users API error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user
 */
async function _POST(request: NextRequest) {
try {
    // Get current user from JWT token
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const authResult = await getUserFromToken(token);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      username,
      email,
      full_name,
      phone_number,
      employee_id,
      password,
      role_ids,
      is_active,
      force_password_change,
      email_verified,
      remarks
    } = body;

    // Validation
    if (!username || !email || !full_name || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (!role_ids || role_ids.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('master_system_user')
      .select('user_id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('master_system_user')
      .select('user_id')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'อีเมลนี้มีอยู่ในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Use the first role_id as the primary role
    const primaryRoleId = role_ids[0];

    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('master_system_user')
      .insert({
        username,
        email,
        full_name,
        phone_number,
        employee_id: employee_id || null,
        password_hash: hashedPassword,
        role_id: primaryRoleId,
        is_active: is_active !== undefined ? is_active : true,
        force_password_change: force_password_change !== undefined ? force_password_change : false,
        email_verified: email_verified !== undefined ? email_verified : true,
        remarks,
        created_by: authResult.user.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างผู้ใช้งานได้' },
        { status: 500 }
      );
    }

    // Log the action
    await logAuditEntry({
      user_id: authResult.user.user_id,
      action: 'USER_CREATE',
      entity_type: 'USER',
      entity_id: newUser.user_id.toString(),
      new_values: {
        username,
        email,
        full_name,
        role_id: primaryRoleId
      },
      ip_address: getClientIP(request)
    });

    return NextResponse.json({
      success: true,
      user: newUser,
      message: 'สร้างผู้ใช้งานสำเร็จ'
    }, { status: 201 });
  } catch (error) {
    console.error('Create user API error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
