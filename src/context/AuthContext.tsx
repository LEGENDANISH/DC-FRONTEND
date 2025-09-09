// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import apiService from '../services/api'; // Adjust path if needed
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatar?: string | null;
  status?: 'ONLINE' | 'OFFLINE' | 'IDLE' | 'DND';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Fetch user data on app load if token exists
      apiService.get<{ user: User; token: string }>('/users/me')
        .then(response => {
          setUser(response.data.user);
        })
        .catch(err => {
          console.error("Failed to fetch user ", err);
          localStorage.removeItem('token'); // Clear invalid token
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.post<{ user: User; token: string }>('/auth/login', { email, password });
      const { user: userData, token } = response.data;
      localStorage.setItem('token', token);
      setUser(userData);
      navigate('/app'); // Redirect to main app
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Re-throw to handle in component
    }
  };

  const register = async (username: string, email: string, password: string, displayName?: string) => {
    try {
      const response = await apiService.post<{ user: User; token: string }>('/auth/register', { username, email, password, displayName });
      const { user: userData, token } = response.data;
      localStorage.setItem('token', token);
      setUser(userData);
      navigate('/app');
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiService.post('/auth/logout'); // Notify backend
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      navigate('/signin');
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};