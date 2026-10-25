import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiRequest, setStoredToken, getStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, role: 'ORGANIZER' | 'ATTENDEE') => Promise<void>;
  logout: () => Promise<void>;
  quickLoginAs: (role: 'ADMIN' | 'ORGANIZER_APEX' | 'ORGANIZER_SOUNDWAVE' | 'ATTENDEE') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    async function loadUser() {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiRequest<{ user: User }>('/auth/me');
        setUser(res.user);
      } catch (err) {
        setStoredToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    setStoredToken(res.token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, pass: string, role: 'ORGANIZER' | 'ATTENDEE') => {
    const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pass, role }),
    });
    setStoredToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {}
    setStoredToken(null);
    setUser(null);
  };

  const quickLoginAs = async (target: 'ADMIN' | 'ORGANIZER_APEX' | 'ORGANIZER_SOUNDWAVE' | 'ATTENDEE') => {
    if (target === 'ADMIN') {
      await login('admin@eventsphere.com', 'AdminPass123!');
    } else if (target === 'ORGANIZER_APEX') {
      await login('apex.events@eventsphere.com', 'OrganizerPass123!');
    } else if (target === 'ORGANIZER_SOUNDWAVE') {
      await login('soundwave.live@eventsphere.com', 'OrganizerPass123!');
    } else {
      await login('attendee@eventsphere.com', 'AttendeePass123!');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, quickLoginAs }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
