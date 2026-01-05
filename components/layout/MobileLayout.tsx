'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Maximize, Minimize } from 'lucide-react';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  showFullscreenButton?: boolean;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title,
  showBackButton = false,
  onBackClick,
  showFullscreenButton = true,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check fullscreen status
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  const showHeader = title || showBackButton;

  return (
    <div className="min-h-screen bg-gray-50">
      {showHeader && (
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="w-full max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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
            {showFullscreenButton && (
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title={isFullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ'}
              >
                {isFullscreen ? (
                  <Minimize size={20} className="text-purple-600" />
                ) : (
                  <Maximize size={20} className="text-purple-600" />
                )}
              </button>
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
