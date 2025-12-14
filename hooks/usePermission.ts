// Permission checking hooks
import { useMemo } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

export interface Permission {
  permission_id: string;
  permission_key: string;
  permission_name: string;
  permission_type: string;
  module_id: string;
  module_name: string;
}

/**
 * Hook to check if user has a specific permission (by module_key)
 * Returns null while loading, false if no permission, true if has permission
 */
export function usePermission(moduleKey: string): boolean | null {
  const { user, loading } = useAuthContext();

  return useMemo(() => {
    // Return null while loading (not false)
    if (loading) {
      return null;
    }

    if (!user) {
      // Only warn in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔒 [usePermission] No user for permission: ${moduleKey}`);
      }
      return false;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [usePermission] Checking "${moduleKey}" for user:`, {
        email: user.email,
        role: user.role_name,
        permissions_count: user.permissions?.length || 0,
        has_permissions_array: !!user.permissions
      });
    }

    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [usePermission] ${user.role_name} has full access to: ${moduleKey}`);
      }
      return true;
    }

    // Check if user has the specific permission
    const hasPermission = user.permissions?.includes(moduleKey) || false;
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔑 [usePermission] Check "${moduleKey}":`, hasPermission);
      if (!hasPermission && user.permissions) {
        console.log(`🔑 [usePermission] Available permissions (first 10):`, user.permissions.slice(0, 10));
      }
    }
    return hasPermission;
  }, [user, loading, moduleKey]);
}

/**
 * Hook to check if user has any of the specified permissions (OR logic)
 */
export function useHasAnyPermission(moduleKeys: string[]): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // Check if user has any of the permissions
    return moduleKeys.some(key => user.permissions?.includes(key)) || false;
  }, [user, moduleKeys]);
}

/**
 * Hook to check if user has all of the specified permissions (AND logic)
 */
export function useHasAllPermissions(moduleKeys: string[]): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // Check if user has all of the permissions
    return moduleKeys.every(key => user.permissions?.includes(key)) || false;
  }, [user, moduleKeys]);
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(roleName: string): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    return user.role_name === roleName;
  }, [user, roleName]);
}

/**
 * Hook to check if user has any of the specified roles
 */
export function useHasAnyRole(roleNames: string[]): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    return roleNames.includes(user.role_name);
  }, [user, roleNames]);
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin(): boolean {
  return useHasAnyRole(['Admin', 'Super Admin']);
}

/**
 * Hook to get all user permissions
 */
export function useUserPermissions(): {
  permissions: Permission[];
  loading: boolean;
  error: string | null;
} {
  const { user } = useAuthContext();
  
  // TODO: Implement fetching user permissions from API
  // For now, return empty array
  return useMemo(() => ({
    permissions: [],
    loading: false,
    error: null
  }), [user]);
}

/**
 * Hook to check module permission
 */
export function useModulePermission(moduleKey: string, permissionType: string): boolean {
  const permissionKey = `${moduleKey}.${permissionType}`;
  return usePermission(permissionKey);
}
