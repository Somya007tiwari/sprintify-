'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from './types';
import { apiFetch, setUnauthorizedCallback } from './api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  signup: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('sprintify_token');
    localStorage.removeItem('sprintify_user');
    setUser(null);
    setToken(null);
    if (pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  };

  useEffect(() => {
    setUnauthorizedCallback(handleLogout);

    const storedToken = localStorage.getItem('sprintify_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    // Verify token with backend GET /api/auth/me
    apiFetch<{ user: User }>('/auth/me')
      .then((res) => {
        setUser(res.user);
        localStorage.setItem('sprintify_user', JSON.stringify(res.user));
      })
      .catch(() => {
        handleLogout();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Route protection
  useEffect(() => {
    if (isLoading) return;

    const publicPaths = ['/login', '/signup'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      router.push('/login');
    } else if (user && isPublicPath) {
      router.push('/dashboard');
    }
  }, [user, isLoading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('sprintify_token', newToken);
    localStorage.setItem('sprintify_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    router.push('/dashboard');
  };

  const signup = (newToken: string, newUser: User) => {
    login(newToken, newUser);
  };

  const logout = () => {
    handleLogout();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
