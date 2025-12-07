// Permission checking utilities
import { createClient } from '@/lib/supabase/server';

export interface UserPermission {
  permission_id: string;
  permission_key: string;
  permission_name: string;
  module_id: string;
  module_name: string;
  permission_type: string;
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  permissions?: UserPermission[];
  error?: string;
}

/**
 * Load all permissions for a user
 */
export async function loadUserPermissions(userId: number): Promise<{
  success: boolean;
  permissions?: UserPermission[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // Get user's roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_role')
      .select('role_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (rolesError) {
      console.error('Error getting user roles:', rolesError);
      return {
        success: false,
        error: 'Failed to load user roles'
      };
    }

    if (!userRoles || userRoles.length === 0) {
      return {
        success: true,
        permissions: []
      };
    }

    const roleIds = userRoles.map(r => r.role_id);

    // Get permissions for all user's roles
    const { data: rolePermissions, error: permissionsError } = await supabase
      .from('role_permission')
      .select(`
        permission_id,
        master_permission!inner(
          permission_key,
          permission_name,
          permission_type,
          module_id,
          master_permission_module!inner(
            module_name
          )
        )
      `)
      .in('role_id', roleIds);

    if (permissionsError) {
      console.error('Error getting role permissions:', permissionsError);
      return {
        success: false,
        error: 'Failed to load permissions'
      };
    }

    // Transform the data
    const permissions: UserPermission[] = (rolePermissions || []).map((rp: any) => ({
      permission_id: rp.permission_id,
      permission_key: rp.master_permission.permission_key,
      permission_name: rp.master_permission.permission_name,
      module_id: rp.master_permission.module_id,
      module_name: rp.master_permission.master_permission_module.module_name,
      permission_type: rp.master_permission.permission_type
    }));

    // Remove duplicates
    const uniquePermissions = Array.from(
      new Map(permissions.map(p => [p.permission_key, p])).values()
    );

    return {
      success: true,
      permissions: uniquePermissions
    };
  } catch (error) {
    console.error('Permission loading error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: number,
  permissionKey: string
): Promise<PermissionCheckResult> {
  try {
    const result = await loadUserPermissions(userId);
    
    if (!result.success || !result.permissions) {
      return {
        hasPermission: false,
        error: result.error
      };
    }

    const hasIt = result.permissions.some(p => p.permission_key === permissionKey);

    return {
      hasPermission: hasIt,
      permissions: result.permissions
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasPermission: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Check if user has any of the specified permissions (OR logic)
 */
export async function hasAnyPermission(
  userId: number,
  permissionKeys: string[]
): Promise<PermissionCheckResult> {
  try {
    const result = await loadUserPermissions(userId);
    
    if (!result.success || !result.permissions) {
      return {
        hasPermission: false,
        error: result.error
      };
    }

    const hasAny = result.permissions.some(p => 
      permissionKeys.includes(p.permission_key)
    );

    return {
      hasPermission: hasAny,
      permissions: result.permissions
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasPermission: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Check if user has all of the specified permissions (AND logic)
 */
export async function hasAllPermissions(
  userId: number,
  permissionKeys: string[]
): Promise<PermissionCheckResult> {
  try {
    const result = await loadUserPermissions(userId);
    
    if (!result.success || !result.permissions) {
      return {
        hasPermission: false,
        error: result.error
      };
    }

    const userPermissionKeys = result.permissions.map(p => p.permission_key);
    const hasAll = permissionKeys.every(key => userPermissionKeys.includes(key));

    return {
      hasPermission: hasAll,
      permissions: result.permissions
    };
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasPermission: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Filter items by permissions
 */
export function filterByPermissions<T>(
  items: T[],
  permissions: UserPermission[],
  getRequiredPermission: (item: T) => string
): T[] {
  const permissionKeys = permissions.map(p => p.permission_key);
  
  return items.filter(item => {
    const required = getRequiredPermission(item);
    return permissionKeys.includes(required);
  });
}

/**
 * Check if user has permission for a specific module and action
 */
export async function hasModulePermission(
  userId: number,
  moduleKey: string,
  permissionType: string
): Promise<PermissionCheckResult> {
  try {
    const permissionKey = `${moduleKey}.${permissionType}`;
    return await hasPermission(userId, permissionKey);
  } catch (error) {
    console.error('Module permission check error:', error);
    return {
      hasPermission: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Get user's permissions grouped by module
 */
export async function getUserPermissionsByModule(userId: number): Promise<{
  success: boolean;
  permissionsByModule?: Record<string, UserPermission[]>;
  error?: string;
}> {
  try {
    const result = await loadUserPermissions(userId);
    
    if (!result.success || !result.permissions) {
      return {
        success: false,
        error: result.error
      };
    }

    const permissionsByModule: Record<string, UserPermission[]> = {};
    
    for (const permission of result.permissions) {
      const moduleKey = permission.permission_key.split('.')[0];
      
      if (!permissionsByModule[moduleKey]) {
        permissionsByModule[moduleKey] = [];
      }
      
      permissionsByModule[moduleKey].push(permission);
    }

    return {
      success: true,
      permissionsByModule
    };
  } catch (error) {
    console.error('Permissions by module error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Check if user is admin (has master.* permissions)
 */
export async function isAdmin(userId: number): Promise<boolean> {
  try {
    const result = await loadUserPermissions(userId);
    
    if (!result.success || !result.permissions) {
      return false;
    }

    // Check if user has any master.* permissions
    return result.permissions.some(p => p.permission_key.startsWith('master.'));
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

/**
 * Get permission details by key
 */
export async function getPermissionDetails(permissionKey: string): Promise<{
  success: boolean;
  permission?: {
    permission_id: string;
    permission_key: string;
    permission_name: string;
    permission_type: string;
    module_id: string;
    module_name: string;
    description?: string;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('master_permission')
      .select(`
        permission_id,
        permission_key,
        permission_name,
        permission_type,
        module_id,
        description,
        master_permission_module!inner(
          module_name
        )
      `)
      .eq('permission_key', permissionKey)
      .single();

    if (error) {
      console.error('Error getting permission details:', error);
      return {
        success: false,
        error: 'Failed to retrieve permission details'
      };
    }

    const moduleData = data.master_permission_module as any;
    const moduleName = Array.isArray(moduleData)
      ? moduleData[0]?.module_name
      : moduleData?.module_name || 'Unknown';

    return {
      success: true,
      permission: {
        permission_id: data.permission_id,
        permission_key: data.permission_key,
        permission_name: data.permission_name,
        permission_type: data.permission_type,
        module_id: data.module_id,
        module_name: moduleName,
        description: data.description
      }
    };
  } catch (error) {
    console.error('Permission details error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}
