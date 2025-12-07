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
 * Hook to check if user has a specific permission
 */
export function usePermission(permissionKey: string): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // TODO: Implement actual permission checking from user's role permissions
    // This would require fetching user permissions from the API
    // For now, return false for non-admin users
    return false;
  }, [user, permissionKey]);
}

/**
 * Hook to check if user has any of the specified permissions (OR logic)
 */
export function useHasAnyPermission(permissionKeys: string[]): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // TODO: Implement actual permission checking
    return false;
  }, [user, permissionKeys]);
}

/**
 * Hook to check if user has all of the specified permissions (AND logic)
 */
export function useHasAllPermissions(permissionKeys: string[]): boolean {
  const { user } = useAuthContext();
  
  return useMemo(() => {
    if (!user) return false;
    
    // Admin and Super Admin have all permissions
    if (user.role_name === 'Admin' || user.role_name === 'Super Admin') {
      return true;
    }
    
    // TODO: Implement actual permission checking
    return false;
  }, [user, permissionKeys]);
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
