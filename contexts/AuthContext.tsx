'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuth, User, Session } from '@/hooks/useAuth';
import { SessionExpiredModal } from '@/components/auth/SessionExpiredModal';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (token: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
      <SessionExpiredModal />
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
