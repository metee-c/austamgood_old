'use client';

// ===== LoadingOverlay Component =====
// Phase 3: เพิ่ม Loading States ตาม edit21.md

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({ message = 'กำลังโหลด...', className = '' }: LoadingOverlayProps) {
  return (
    <div className={`absolute inset-0 bg-white/80 flex items-center justify-center z-50 ${className}`}>
      <div className="flex flex-col items-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
