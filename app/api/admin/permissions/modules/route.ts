// API route for permission modules management
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/permissions/modules
 * Get all permission modules in hierarchical structure
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

    const supabase = await createClient();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const parentModuleId = searchParams.get('parent_module_id');
    const isActive = searchParams.get('is_active');
    const asTree = searchParams.get('as_tree') === 'true';

    let query = supabase
      .from('master_permission_module')
      .select('*')
      .order('category')
      .order('module_name');

    // Apply filters
    if (parentModuleId) {
      query = query.eq('parent_module_id', parseInt(parentModuleId));
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data: modules, error } = await query;

    if (error) {
      console.error('Error getting permission modules:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล permission modules ได้' },
        { status: 500 }
      );
    }

    // If as_tree, build hierarchical structure
    if (asTree) {
      const buildTree = (parentId: number | null = null): any[] => {
        return (modules || [])
          .filter(m => m.parent_module_id === parentId)
          .map(module => ({
            ...module,
            children: buildTree(module.module_id)
          }));
      };

      const tree = buildTree(null);

      return NextResponse.json({
        success: true,
        modules: tree
      });
    }

    return NextResponse.json({
      success: true,
      modules: modules || []
    });
  } catch (error) {
    console.error('Get permission modules API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
}
