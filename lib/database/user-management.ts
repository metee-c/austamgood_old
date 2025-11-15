import { SupabaseClient } from '@supabase/supabase-js';
import { 
  SystemUser, 
  SystemRole, 
  SystemUserWithRoles, 
  SystemRoleWithPermissions,
  PermissionModule,
  RolePermission,
  UserFilters,
  RoleFilters,
  CreateUserData,
  UpdateUserData,
  CreateRoleData,
  UpdateRoleData
} from '@/types/user-management-schema';
import bcrypt from 'bcryptjs';

export class UserManagementService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ========== User Management Methods ==========
  
  async getAllUsers(filters: UserFilters = {}, limit = 100, offset = 0): Promise<{ data: SystemUserWithRoles[] | null; error: any }> {
    let query = this.supabase
      .from('master_system_user')
      .select(`
        *,
        roles:user_role(
          role_id,
          role:master_system_role(*)
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters.search) {
      query = query.or(`username.ilike.%${filters.search}%,email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.employee_id) {
      query = query.eq('employee_id', filters.employee_id);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    // Transform data to include roles properly
    const transformedData = data?.map(user => ({
      ...user,
      roles: user.roles?.map((ur: any) => ur.role) || [],
      employee_name: null // Remove employee reference for now
    })) || [];

    return { data: transformedData, error: null };
  }

  async getUserById(userId: number): Promise<{ data: SystemUserWithRoles | null; error: any }> {
    const { data, error } = await this.supabase
      .from('master_system_user')
      .select(`
        *,
        roles:user_role(
          role_id,
          role:master_system_role(*)
        ),
        employee:master_employee(
          employee_name
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Transform data
    const transformedData = {
      ...data,
      roles: data.roles?.map((ur: any) => ur.role) || [],
      employee_name: data.employee?.employee_name || null
    };

    return { data: transformedData, error: null };
  }

  async createUser(userData: CreateUserData): Promise<{ data: SystemUser | null; error: any }> {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const { data: user, error: userError } = await this.supabase
        .from('master_system_user')
        .insert({
          username: userData.username,
          email: userData.email,
          full_name: userData.full_name,
          phone_number: userData.phone_number || null,
          employee_id: userData.employee_id || null,
          password_hash: hashedPassword,
          is_active: userData.is_active,
          remarks: userData.remarks || null,
        })
        .select()
        .single();

      if (userError) {
        return { data: null, error: userError.message };
      }

      // Assign roles
      if (userData.role_ids && userData.role_ids.length > 0) {
        const roleAssignments = userData.role_ids.map(roleId => ({
          user_id: user.user_id,
          role_id: roleId,
        }));

        const { error: roleError } = await this.supabase
          .from('user_role')
          .insert(roleAssignments);

        if (roleError) {
          // Rollback user creation if role assignment fails
          await this.supabase
            .from('master_system_user')
            .delete()
            .eq('user_id', user.user_id);
          
          return { data: null, error: roleError.message };
        }
      }

      return { data: user, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async updateUser(userData: UpdateUserData): Promise<{ data: SystemUser | null; error: any }> {
    try {
      const updateData: any = {
        username: userData.username,
        email: userData.email,
        full_name: userData.full_name,
        phone_number: userData.phone_number || null,
        employee_id: userData.employee_id || null,
        is_active: userData.is_active,
        remarks: userData.remarks || null,
      };

      // Hash new password if provided
      if (userData.password) {
        updateData.password_hash = await bcrypt.hash(userData.password, 10);
      }

      // Update user
      const { data: user, error: userError } = await this.supabase
        .from('master_system_user')
        .update(updateData)
        .eq('user_id', userData.user_id)
        .select()
        .single();

      if (userError) {
        return { data: null, error: userError.message };
      }

      // Update roles if provided
      if (userData.role_ids) {
        // Delete existing roles
        await this.supabase
          .from('user_role')
          .delete()
          .eq('user_id', userData.user_id);

        // Insert new roles
        if (userData.role_ids.length > 0) {
          const roleAssignments = userData.role_ids.map(roleId => ({
            user_id: userData.user_id,
            role_id: roleId,
          }));

          const { error: roleError } = await this.supabase
            .from('user_role')
            .insert(roleAssignments);

          if (roleError) {
            return { data: null, error: roleError.message };
          }
        }
      }

      return { data: user, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async deleteUser(userId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('master_system_user')
      .delete()
      .eq('user_id', userId);

    return { error: error?.message || null };
  }

  // ========== Role Management Methods ==========

  async getAllRoles(filters: RoleFilters = {}, limit = 100, offset = 0): Promise<{ data: SystemRoleWithPermissions[] | null; error: any }> {
    let query = this.supabase
      .from('master_system_role')
      .select(`
        *,
        permissions:role_permission(*),
        user_count:user_role(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters.search) {
      query = query.ilike('role_name', `%${filters.search}%`);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    // Transform data to include user count
    const transformedData = data?.map(role => ({
      ...role,
      user_count: Array.isArray(role.user_count) ? role.user_count.length : 0
    })) || [];

    return { data: transformedData, error: null };
  }

  async getRoleById(roleId: number): Promise<{ data: SystemRoleWithPermissions | null; error: any }> {
    const { data, error } = await this.supabase
      .from('master_system_role')
      .select(`
        *,
        permissions:role_permission(*),
        user_count:user_role(count)
      `)
      .eq('role_id', roleId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Transform data
    const transformedData = {
      ...data,
      user_count: Array.isArray(data.user_count) ? data.user_count.length : 0
    };

    return { data: transformedData, error: null };
  }

  async createRole(roleData: CreateRoleData): Promise<{ data: SystemRole | null; error: any }> {
    try {
      // Create role
      const { data: role, error: roleError } = await this.supabase
        .from('master_system_role')
        .insert({
          role_name: roleData.role_name,
          description: roleData.description || null,
          is_active: roleData.is_active,
        })
        .select()
        .single();

      if (roleError) {
        return { data: null, error: roleError.message };
      }

      // Assign permissions
      if (roleData.permissions && roleData.permissions.length > 0) {
        const permissionAssignments = roleData.permissions.map(permission => ({
          role_id: role.role_id,
          module_id: permission.module_id,
          can_view: permission.can_view,
          can_create: permission.can_create,
          can_edit: permission.can_edit,
          can_delete: permission.can_delete,
          can_approve: permission.can_approve,
        }));

        const { error: permissionError } = await this.supabase
          .from('role_permission')
          .insert(permissionAssignments);

        if (permissionError) {
          // Rollback role creation if permission assignment fails
          await this.supabase
            .from('master_system_role')
            .delete()
            .eq('role_id', role.role_id);
          
          return { data: null, error: permissionError.message };
        }
      }

      return { data: role, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async updateRole(roleData: UpdateRoleData): Promise<{ data: SystemRole | null; error: any }> {
    try {
      // Update role
      const { data: role, error: roleError } = await this.supabase
        .from('master_system_role')
        .update({
          role_name: roleData.role_name,
          description: roleData.description || null,
          is_active: roleData.is_active,
        })
        .eq('role_id', roleData.role_id)
        .select()
        .single();

      if (roleError) {
        return { data: null, error: roleError.message };
      }

      // Update permissions if provided
      if (roleData.permissions) {
        // Delete existing permissions
        await this.supabase
          .from('role_permission')
          .delete()
          .eq('role_id', roleData.role_id);

        // Insert new permissions
        if (roleData.permissions.length > 0) {
          const permissionAssignments = roleData.permissions.map(permission => ({
            role_id: roleData.role_id,
            module_id: permission.module_id,
            can_view: permission.can_view,
            can_create: permission.can_create,
            can_edit: permission.can_edit,
            can_delete: permission.can_delete,
            can_approve: permission.can_approve,
          }));

          const { error: permissionError } = await this.supabase
            .from('role_permission')
            .insert(permissionAssignments);

          if (permissionError) {
            return { data: null, error: permissionError.message };
          }
        }
      }

      return { data: role, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async deleteRole(roleId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('master_system_role')
      .delete()
      .eq('role_id', roleId);

    return { error: error?.message || null };
  }

  // ========== Permission Module Methods ==========

  async getAllPermissionModules(): Promise<{ data: PermissionModule[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('master_permission_module')
      .select('*')
      .order('module_name', { ascending: true });

    return { data, error: error?.message || null };
  }

  // ========== Utility Methods ==========

  async getUserPermissions(userId: number): Promise<{ data: RolePermission[] | null; error: any }> {
    // First get user roles
    const { data: userRoles, error: userRoleError } = await this.supabase
      .from('user_role')
      .select('role_id')
      .eq('user_id', userId);

    if (userRoleError) {
      return { data: null, error: userRoleError.message };
    }

    if (!userRoles || userRoles.length === 0) {
      return { data: [], error: null };
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    // Get permissions for those roles
    const { data, error } = await this.supabase
      .from('role_permission')
      .select(`
        *,
        module:master_permission_module(*)
      `)
      .in('role_id', roleIds);

    return { data, error: error?.message || null };
  }

  async checkUserPermission(userId: number, moduleName: string, permission: 'view' | 'create' | 'edit' | 'delete' | 'approve'): Promise<{ hasPermission: boolean; error: any }> {
    // First get user roles
    const { data: userRoles, error: userRoleError } = await this.supabase
      .from('user_role')
      .select('role_id')
      .eq('user_id', userId);

    if (userRoleError) {
      return { hasPermission: false, error: userRoleError.message };
    }

    if (!userRoles || userRoles.length === 0) {
      return { hasPermission: false, error: null };
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    // Get module ID
    const { data: modules, error: moduleError } = await this.supabase
      .from('master_permission_module')
      .select('module_id')
      .eq('module_name', moduleName);

    if (moduleError || !modules || modules.length === 0) {
      return { hasPermission: false, error: moduleError?.message || 'Module not found' };
    }

    const moduleIds = modules.map(m => m.module_id);

    // Check permissions
    const { data, error } = await this.supabase
      .from('role_permission')
      .select(`can_${permission}`)
      .in('role_id', roleIds)
      .in('module_id', moduleIds);

    if (error) {
      return { hasPermission: false, error: error.message };
    }

    const hasPermission = data?.some((p: any) => p[`can_${permission}`]) || false;
    return { hasPermission, error: null };
  }
}
