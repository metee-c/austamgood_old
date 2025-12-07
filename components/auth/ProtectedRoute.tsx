'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  allowedRoles?: string[];
  requiredPermission?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
  requiredPermission,
  fallback,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, loading, isAuthenticated, hasRole, hasPermission } = useAuthContext();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading state
  if (loading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">กำลังโหลด...</p>
          </div>
        </div>
      )
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Check required role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ไม่มีสิทธิ์เข้าถึง
          </h1>
          <p className="text-gray-600 mb-6">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ ต้องการ role: {requiredRole}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ย้อนกลับ
          </button>
        </div>
      </div>
    );
  }

  // Check allowed roles
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.some(role => hasRole(role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ไม่มีสิทธิ์เข้าถึง
          </h1>
          <p className="text-gray-600 mb-6">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ ต้องการ role: {allowedRoles.join(', ')}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ย้อนกลับ
          </button>
        </div>
      </div>
    );
  }

  // Check required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="text-red-500 text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ไม่มีสิทธิ์เข้าถึง
          </h1>
          <p className="text-gray-600 mb-6">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ ต้องการ permission: {requiredPermission}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ย้อนกลับ
          </button>
        </div>
      </div>
    );
  }

  // All checks passed, render children
  return <>{children}</>;
}
