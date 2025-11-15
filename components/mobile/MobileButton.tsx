'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MobileButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  icon: Icon,
  loading = false,
  type = 'button'
}) => {
  const baseClasses = 'py-3 px-6 rounded-lg font-medium text-lg flex items-center justify-center gap-2 transition-colors';

  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 disabled:bg-gray-100',
    success: 'bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300',
    danger: 'bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-300',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} disabled:cursor-not-allowed`}
    >
      {loading ? (
        <span className="animate-spin">⏳</span>
      ) : Icon ? (
        <Icon size={20} />
      ) : null}
      {children}
    </button>
  );
};

export default MobileButton;
