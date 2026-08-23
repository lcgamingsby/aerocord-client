import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, FriendRelationItem, UserStatus } from '../types';
import { apiUrl } from '../config/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  friends: FriendRelationItem[];
  login: (identifier: string, pass: string) => Promise<{ success: boolean; twoFactorRequired?: boolean; twoFactorType?: 'google' | 'file' | 'email'; challengeId?: string; maskedEmail?: string; message?: string; error?: string }>;
  verify2FA: (challengeId: string, code?: string, keyFileContent?: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  guestLogin: (guestId?: string, customName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  refreshFriends: () => Promise<void>;
  sendFriendRequest: (target: { username?: string; discriminator?: string; userId?: string }) => Promise<{ success: boolean; error?: string }>;
  respondFriendRequest: (relationId: string, action: 'accept' | 'decline' | 'block') => Promise<void>;
  updateStatus: (status: UserStatus, customStatus?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('aerocord_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [friends, setFriends] = useState<FriendRelationItem[]>([]);

  const fetchCurrentUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('aerocord_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching me:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/auth/friends'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
      refreshFriends();
    } else {
      setIsLoading(false);
    }
  }, [token, fetchCurrentUser, refreshFriends]);

  const login = async (identifier: string, pass: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: identifier, password: pass })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal' };
      }

      if (data.twoFactorRequired) {
        return {
          success: false,
          twoFactorRequired: true,
          twoFactorType: data.twoFactorType,
          challengeId: data.challengeId,
          maskedEmail: data.maskedEmail,
          message: data.message
        };
      }

      localStorage.setItem('aerocord_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Kesalahan jaringan' };
    }
  };

  const verify2FA = async (challengeId: string, code?: string, keyFileContent?: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code, keyFileContent })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Verifikasi 2FA gagal' };
      }
      localStorage.setItem('aerocord_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Kesalahan jaringan' };
    }
  };

  const register = async (username: string, email: string, pass: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password: pass })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }
      localStorage.setItem('aerocord_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const guestLogin = async (guestId?: string, customName?: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/guest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, customName })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Guest login failed' };
      }
      localStorage.setItem('aerocord_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const logout = async () => {
    // Call backend logout endpoint (triggers guest account auto-deletion)
    if (token) {
      try {
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Logout API error:', err);
      }
    }
    localStorage.removeItem('aerocord_token');
    setToken(null);
    setUser(null);
    setFriends([]);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!token) return false;
    try {
      const res = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const sendFriendRequest = async (target: { username?: string; discriminator?: string; userId?: string }) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(apiUrl('/api/auth/friends/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(target)
      });
      const data = await res.json();
      if (res.ok) {
        refreshFriends();
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to send friend request' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const respondFriendRequest = async (relationId: string, action: 'accept' | 'decline' | 'block') => {
    if (!token) return;
    try {
      await fetch(apiUrl('/api/auth/friends/respond'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relationId, action })
      });
      refreshFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = (status: UserStatus, customStatus?: string) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, status, customStatus: customStatus ?? prev.customStatus } : null);
    updateProfile({ status, customStatus });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        friends,
        login,
        verify2FA,
        register,
        guestLogin,
        logout,
        updateProfile,
        refreshFriends,
        sendFriendRequest,
        respondFriendRequest,
        updateStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

