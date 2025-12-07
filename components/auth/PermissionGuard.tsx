'use client';

import { ReactNode } from 'react';
import { usePermission, useHasAnyPermission, useHasAllPermissions, useHasRole, useHasAnyRole } from '@/hooks/usePermission';

interface PermissionGuardProps {
  children: ReactNode;
  permission: string;
  fallback?: ReactNode;
}

/**
 * Component that shows children only if user has the required permission
 */
export function PermissionGuard({ children, permission, fallback = null }: PermissionGuardProps) {
  const hasPermission = usePermission(permission);
  
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
