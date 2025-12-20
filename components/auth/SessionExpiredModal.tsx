'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SESSION_EXPIRED_EVENT, isSessionExpiredMessage } from '@/lib/api/fetch-with-auth';

/**
 * Modal แสดงเมื่อ session หมดอายุ
 * จะแสดงข้อความภาษาไทยที่เข้าใจง่าย และมีปุ่มกดไปหน้า login
 */
export function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't show on login/public pages
    const publicPaths = ['/login', '/forgot-password', '/reset-password'];
    if (publicPaths.some(p => pathname?.startsWith(p))) {
      return;
    }

    // Listen for session expired event
    const handleSessionExpired = () => {
      setIsOpen(true);
    };

    // Listen for unhandled errors that might be session expired
    const handleError = (event: ErrorEvent) => {
      if (isSessionExpiredMessage(event.message)) {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    // Listen for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || String(event.reason);
      if (isSessionExpiredMessage(message)) {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [pathname]);

  const handleConfirm = () => {
    setIsOpen(false);
    // Clear any cached data
    if (typeof window !== 'undefined') {
      // Clear session storage
      sessionStorage.clear();
    }
    // Redirect to login
    router.push('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
          Session หมดอายุ
        </h2>

        {/* Message */}
        <p className="text-center text-gray-600 mb-6">
          เซสชันของคุณหมดอายุแล้ว เนื่องจากไม่มีการใช้งานเป็นเวลานาน
          <br />
          กรุณาเข้าสู่ระบบใหม่อีกครั้ง
        </p>

        {/* Button */}
        <button
          onClick={handleConfirm}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          เข้าใจแล้ว
        </button>
      </div>
    </div>
  );
}
