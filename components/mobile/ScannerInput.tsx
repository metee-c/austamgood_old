'use client';

import React from 'react';
import { QrCode } from 'lucide-react';

interface ScannerInputProps {
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

const ScannerInput: React.FC<ScannerInputProps> = ({
  value,
  onChange,
  onScan,
  placeholder = 'Scan barcode',
  disabled = false,
  label
}) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onScan();
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
        />
        <button
          onClick={onScan}
          disabled={disabled}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          <QrCode size={24} />
        </button>
      </div>
    </div>
  );
};

export default ScannerInput;
