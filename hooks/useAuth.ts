// React hook for authentication
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role_id: number;
  role_name: string;
}

export interface Session {
  session_id: string;
  expires_in_seconds: number;
  last_activity_minutes_ago: number;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  // Fetch current user
  const fetchUser = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (!response.ok) {
        setState({
          user: null,
          session: null,
          loading: false,
          error: data.error || 'Failed to fetch user',
        });
        return;
      }

      setState({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      setState({
        user: null,
        session: null,
        loading: false,
        error: 'Failed to fetch user',
      });
    }
  }, []);

  // Login
  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          remember_me: rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
        };
      }

      // Fetch user data after successful login
      await fetchUser();

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Failed to connect to server',
      };
    }
  }, [fetchUser]);

  // Logout
  const logout = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Logout failed',
        };
      }

      setState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });

      router.push('/login');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: 'Failed to connect to server',
      };
    }
  }, [router]);

  // Change password
  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to change password',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: 'Failed to connect to server',
      };
    }
  }, []);

  // Request password reset
  const requestPasswordReset = useCallback(async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to request password reset',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Request password reset error:', error);
      return {
        success: false,
        error: 'Failed to connect to server',
      };
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/password-reset/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to reset password',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: 'Failed to connect to server',
      };
    }
  }, []);

  // Check if user has permission
  const hasPermission = useCallback((permission: string): boolean => {
    // This would need to be implemented based on your permission system
    // For now, return true for admin users
    return state.user?.role_name === 'Admin' || state.user?.role_name === 'Super Admin';
  }, [state.user]);

  // Check if user has role
  const hasRole = useCallback((role: string): boolean => {
    return state.user?.role_name === role;
  }, [state.user]);

  // Fetch user on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    login,
    logout,
    changePassword,
    requestPasswordReset,
    resetPassword,
    hasPermission,
    hasRole,
    refetch: fetchUser,
  };
}
