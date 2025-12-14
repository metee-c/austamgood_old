'use client';

import { ReactNode } from 'react';
import { usePermission, useHasAnyPermission, useHasAllPermissions, useHasRole, useHasAnyRole } from '@/hooks/usePermission';
import { useAuthContext } from '@/contexts/AuthContext';

interface PermissionGuardProps {
  children: ReactNode;
  permission: string;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

/**
 * Component that shows children only if user has the required permission
 */
export function PermissionGuard({ 
  children, 
  permission, 
  fallback = null,
  loadingFallback 
}: PermissionGuardProps) {
  const { user, loading } = useAuthContext();
  const hasPermission = usePermission(permission);

  // Default loading fallback
  const defaultLoadingFallback = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-4"></div>
        <p className="text-gray-600 font-thai">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    </div>
  );

  // Show loading state while checking authentication
  if (loading || user === undefined || hasPermission === null) {
    return <>{loadingFallback || defaultLoadingFallback}</>;
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface AnyPermissionGuardProps {
  children: ReactNode;
  permissions: string[];
  fallback?: ReactNode;
}

/**
 * Component that shows children if user has any of the required permissions
 */
export function AnyPermissionGuard({ children, permissions, fallback = null }: AnyPermissionGuardProps) {
  const hasAnyPermission = useHasAnyPermission(permissions);
  
  if (!hasAnyPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface AllPermissionsGuardProps {
  children: ReactNode;
  permissions: string[];
  fallback?: ReactNode;
}

/**
 * Component that shows children only if user has all of the required permissions
 */
export function AllPermissionsGuard({ children, permissions, fallback = null }: AllPermissionsGuardProps) {
  const hasAllPermissions = useHasAllPermissions(permissions);
  
  if (!hasAllPermissions) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface RoleGuardProps {
  children: ReactNode;
  role: string;
  fallback?: ReactNode;
}

/**
 * Component that shows children only if user has the required role
 */
export function RoleGuard({ children, role, fallback = null }: RoleGuardProps) {
  const hasRole = useHasRole(role);
  
  if (!hasRole) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface AnyRoleGuardProps {
  children: ReactNode;
  roles: string[];
  fallback?: ReactNode;
}

/**
 * Component that shows children if user has any of the required roles
 */
export function AnyRoleGuard({ children, roles, fallback = null }: AnyRoleGuardProps) {
  const hasAnyRole = useHasAnyRole(roles);
  
  if (!hasAnyRole) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that shows children only if user is admin
 */
export function AdminGuard({ children, fallback = null }: AdminGuardProps) {
  const hasAdminRole = useHasAnyRole(['Admin', 'Super Admin']);
  
  if (!hasAdminRole) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
