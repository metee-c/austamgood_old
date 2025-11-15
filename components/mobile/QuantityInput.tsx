'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  unit?: string;
}

const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 999999,
  label,
  disabled = false,
  unit
}) => {
  const increment = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const decrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    if (newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={decrement}
          disabled={disabled || value <= min}
          className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg font-bold text-xl"
        >
          <Minus size={20} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            className="w-24 text-center text-2xl font-bold py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={min}
            max={max}
          />
          {unit && (
            <span className="text-lg font-medium text-gray-600">{unit}</span>
          )}
        </div>
        <button
          onClick={increment}
          disabled={disabled || value >= max}
          className="w-12 h-12 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg font-bold text-xl"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};

export default QuantityInput;
