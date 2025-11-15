'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title,
  showBackButton = false,
  onBackClick
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {(title || showBackButton) && (
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="w-full max-w-md mx-auto px-4 py-3 flex items-center gap-3">
            {showBackButton && onBackClick && (
              <button
                onClick={onBackClick}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            {title && (
              <h1 className="text-lg font-semibold">{title}</h1>
            )}
          </div>
        </header>
      )}
      <main className="w-full max-w-md mx-auto">
        {children}
      </main>
    </div>
  );
};

export default MobileLayout;
