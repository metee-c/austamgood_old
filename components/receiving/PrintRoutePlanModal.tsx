'use client';

import React from 'react';
import { X } from 'lucide-react';

interface PrintRoutePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId?: string | number;
}

const PrintRoutePlanModal: React.FC<PrintRoutePlanModalProps> = ({ isOpen, onClose, planId }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Print Route Plan</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="text-gray-500">
          <p>Print route plan for: {planId}</p>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintRoutePlanModal;
