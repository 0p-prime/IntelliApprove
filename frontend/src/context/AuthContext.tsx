import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiRequest } from '../api/client';

export interface DemoUser {
  email: string;
  name?: string;
  full_name: string;
  role: UserRole;
  designation?: string;
  region_name?: string;
  institution_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchRole: (email: string) => Promise<void>;
  demoUsers: DemoUser[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('intelliapprove_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const userData = await apiRequest<User>('/auth/me');
      setUser(userData);
    } catch (err) {
      console.warn('Failed to fetch user with current token:', err);
      localStorage.removeItem('intelliapprove_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemoUsers = async () => {
    try {
      const users = await apiRequest<DemoUser[]>('/auth/demo-users');
      setDemoUsers(users);
    } catch (err) {
      console.error('Failed to load demo users list:', err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchDemoUsers();
  }, []);

  const login = async (email: string, password: string = 'aicte123') => {
    setLoading(true);
    try {
      const tokenRes = await apiRequest<{ access_token: string; user?: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('intelliapprove_token', tokenRes.access_token);
      if (tokenRes.user) {
        setUser(tokenRes.user);
      } else {
        await fetchCurrentUser();
      }
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (email: string) => {
    await login(email, 'aicte123');
  };

  const logout = () => {
    localStorage.removeItem('intelliapprove_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
        demoUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
