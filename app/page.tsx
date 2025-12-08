import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  // Check if user has session
  const session = await getCurrentSession();

  if (!session.success || !session.session) {
    // Not authenticated → redirect to login (middleware will handle this)
    redirect('/dashboard');
  }

  // Get user permissions to determine redirect
  try {
    const supabase = await createClient();
    const userId = session.session.user_id;

    const { data: userRole } = await supabase
      .from('master_system_user')
      .select('role_id')
      .eq('user_id', userId)
      .single();

    if (userRole) {
      const { data: permissions } = await supabase
        .from('master_system_role_permission')
        .select(`
          master_permission_module!fk_master_system_role_permission_module(
            module_key
          )
        `)
        .eq('role_id', userRole.role_id)
        .eq('can_view', true);

      if (permissions && permissions.length > 0) {
        const permKeys = permissions.map((p: any) =>
          p.master_permission_module?.module_key
        ).filter(Boolean);

        const hasMobileAccess = permKeys.some((key: string) => key.startsWith('mobile.'));
        const hasDashboardAccess = permKeys.some((key: string) => key.startsWith('dashboard.'));

        // Redirect based on permissions
        if (hasMobileAccess && !hasDashboardAccess) {
          redirect('/mobile');
        }
      }
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
  }

  // Default redirect to dashboard
  redirect('/dashboard');
}