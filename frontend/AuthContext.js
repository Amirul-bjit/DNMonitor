import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import axios from 'axios';

// Storage abstraction for web/mobile compatibility
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      // For mobile, you'd import AsyncStorage here
      // import AsyncStorage from '@react-native-async-storage/async-storage';
      // return await AsyncStorage.getItem(key);
      return null; // Fallback for now
    }
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      // For mobile, you'd import AsyncStorage here
      // import AsyncStorage from '@react-native-async-storage/async-storage';
      // await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key) {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      // For mobile, you'd import AsyncStorage here
      // import AsyncStorage from '@react-native-async-storage/async-storage';
      // await AsyncStorage.removeItem(key);
    }
  }
};

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const storedToken = await storage.getItem('authToken');
      if (storedToken) {
        // Verify token with backend
        const response = await axios.post(`${API_URL}/auth/verify`, {}, {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        
        if (response.data.success) {
          setToken(storedToken);
          setUser(response.data.user);
          setIsAuthenticated(true);
          
          // Set default authorization header for all future requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        } else {
          // Invalid token, clear storage
          await storage.removeItem('authToken');
        }
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      await storage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password
      });

      if (response.data.success) {
        const { token: authToken, user: userData } = response.data;
        
        // Store token in storage
        await storage.setItem('authToken', authToken);
        
        // Set state
        setToken(authToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        // Set default authorization header for all future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        
        return { success: true };
      }
      
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.log('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint (optional since JWT is stateless)
      await axios.post(`${API_URL}/auth/logout`);
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      // Clear local state and storage
      await storage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    isAuthenticated,
    user,
    token,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};