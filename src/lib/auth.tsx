import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  authenticated: boolean;
  requiresAuth: boolean;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(data.authenticated);
        setRequiresAuth(data.requiresAuth);
      } else {
        setAuthenticated(false);
        setRequiresAuth(true);
      }
    } catch (e) {
      setAuthenticated(false);
      setRequiresAuth(false);
    } finally {
      setLoading(false);
    }
  }

  async function login(password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    setAuthenticated(true);
    await checkAuth();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    await checkAuth();
  }

  return (
    <AuthContext.Provider value={{ authenticated, requiresAuth, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
