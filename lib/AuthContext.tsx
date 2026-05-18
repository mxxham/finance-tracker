'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User { id: number; name: string; email: string; }
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

// Safe fallback so useAuth() never throws when called outside a provider
// (e.g. during Next.js SSR of /_not-found which includes dashboard layout chunks)
const DEFAULT_CONTEXT: AuthContextType = {
  user: null,
  token: null,
  loading: true,
  login: async () => { throw new Error('AuthProvider not mounted'); },
  register: async () => { throw new Error('AuthProvider not mounted'); },
  logout: () => {},
};

const AuthContext = createContext<AuthContextType>(DEFAULT_CONTEXT);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ft_token');
      const storedUser = localStorage.getItem('ft_user');
      if (stored && storedUser) {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      }
    } catch { /* localStorage unavailable */ }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem('ft_token');
      localStorage.removeItem('ft_user');
    } catch { /* ignore */ }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('ft_token', data.token);
    localStorage.setItem('ft_user', JSON.stringify(data.user));
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('ft_token', data.token);
    localStorage.setItem('ft_user', JSON.stringify(data.user));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Never throws — returns the default context if called outside AuthProvider
// This is intentional: Next.js SSR bundles layout chunks together and may
// call this during prerendering of pages like /_not-found
export function useAuth() {
  return useContext(AuthContext);
}