'use client';

// ===== ErrorAlert Component =====
// Phase 2: เพิ่ม Error Handling ตาม edit21.md

import React from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import type { ApiError } from '../utils/errorHandler';
import { getErrorMessage } from '../utils/errorHandler';

interface ErrorAlertProps {
  error: ApiError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorAlert({ error, onRetry, onDismiss, className = '' }: ErrorAlertProps) {
  if (!error) return null;
  
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            เกิดข้อผิดพลาด
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {getErrorMessage(error)}
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 transition-colors"
              title="ลองใหม่"
            >
              <RefreshCw className="h-4 w-4" />
              <span>ลองใหม่</span>
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-500 transition-colors"
              title="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorAlert;
