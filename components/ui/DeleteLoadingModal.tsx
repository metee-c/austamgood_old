'use client';

import { Loader2, Trash2 } from 'lucide-react';

interface DeleteLoadingModalProps {
  isOpen: boolean;
  documentType: string;
  documentNo: string;
}

export default function DeleteLoadingModal({
  isOpen,
  documentType,
  documentNo
}: DeleteLoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-500 to-red-600 rounded-t-xl">
          <div className="flex items-center justify-center gap-3">
            <Trash2 className="w-6 h-6 text-white" />
            <h2 className="text-white font-bold font-thai text-lg">
              กำลังลบ {documentType}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Spinning Loader */}
            <Loader2 className="w-16 h-16 animate-spin text-red-500" />
            
            {/* Document Info */}
            <div className="text-center">
              <p className="text-gray-700 font-thai text-base font-medium">
                {documentNo}
              </p>
              <p className="text-gray-500 font-thai text-sm mt-2">
                กำลังลบข้อมูลและปลดล็อคยอดจอง...
              </p>
              <p className="text-gray-400 font-thai text-xs mt-3">
                กรุณารอสักครู่ อย่าปิดหน้านี้
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
