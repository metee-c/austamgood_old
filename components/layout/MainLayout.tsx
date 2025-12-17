'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        isHovered={sidebarHovered}
        onHoverChange={setSidebarHovered}
      />

      {/* Mobile Overlay */}
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Header */}
      <div
        className={`
          fixed top-0 right-0 h-10 bg-white border-b border-thai-gray-200 shadow-sm z-40
          transition-all duration-700
          ${sidebarCollapsed && !sidebarHovered ? 'left-16' : 'left-64'}
          ${isMobile ? 'left-0' : ''}
        `}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <Header
          onMenuClick={toggleSidebar}
          showMenuButton={isMobile}
        />
      </div>

      {/* Main Content */}
      <div
        className={`
          transition-all duration-700 pt-10 h-screen overflow-hidden
          ${sidebarCollapsed && !sidebarHovered ? 'ml-16' : 'ml-64'}
          ${isMobile ? 'ml-0' : ''}
        `}
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        {/* Page Content */}
        <main className="p-2 lg:p-3 h-full overflow-hidden">
          <div className="w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;