'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { 
  isTokenAuthenticated, 
  isSessionAuthenticated, 
  getAccessToken, 
  refreshAccessToken, 
  refreshCsrfToken 
} from '@/services/AuthServices';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState(null); // 'session' or 'oauth'

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check for OAuth tokens first
        if (isTokenAuthenticated()) {
          setAuthMethod('oauth');
          // Fetch user info using the token
          const userInfo = await getUserInfoWithToken();
          setUser(userInfo);
        } 
        // Check for session cookie
        else if (isSessionAuthenticated()) {
          setAuthMethod('session');
          // Fetch user info using the session
          const userInfo = await getUserInfoWithSession();
          setUser(userInfo);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear any invalid auth state
        setUser(null);
        setAuthMethod(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Get user info with OAuth token
  const getUserInfoWithToken = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DRUPAL_BASE_URL}/oauth/userinfo`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to get user info');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user with token:', error);
      throw error;
    }
  };

  // Get user info with session cookie
  const getUserInfoWithSession = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DRUPAL_BASE_URL}/user/me?_format=json`, {
        credentials: 'include' // Important for session cookies
      });
      
      if (!response.ok) throw new Error('Failed to get user info');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user with session:', error);
      throw error;
    }
  };

  // Smart authentication checker
  const isAuthenticated = async () => {
    // First check if already authenticated
    if (user) return true;
    
    // Try OAuth authentication
    if (isTokenAuthenticated()) {
      try {
        const userInfo = await getUserInfoWithToken();
        setUser(userInfo);
        setAuthMethod('oauth');
        return true;
      } catch (error) {
        // Token might be invalid, try to refresh
        try {
          await refreshAccessToken();
          const userInfo = await getUserInfoWithToken();
          setUser(userInfo);
          setAuthMethod('oauth');
          return true;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Continue to check session auth
        }
      }
    }
    
    // Try session authentication
    if (isSessionAuthenticated()) {
      try {
        const userInfo = await getUserInfoWithSession();
        setUser(userInfo);
        setAuthMethod('session');
        return true;
      } catch (error) {
        console.error('Session validation failed:', error);
        return false;
      }
    }
    
    return false;
  };

  // Universal logout that handles both auth methods
  const logout = async () => {
    try {
      if (authMethod === 'oauth') {
        // OAuth logout
        await fetch(`${process.env.NEXT_PUBLIC_DRUPAL_BASE_URL}/user/logout`, {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`
          }
        });
        
        // Clear OAuth cookies/tokens
        Object.keys(Cookies.get())
          .filter(name => name.startsWith('drupal_auth_'))
          .forEach(name => Cookies.remove(name));
      } 
      else if (authMethod === 'session') {
        // Session logout using the logout token
        const logoutToken = Cookies.get('drupal_logout_token');
        if (logoutToken) {
          await fetch(`${process.env.NEXT_PUBLIC_DRUPAL_BASE_URL}/user/logout`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'X-CSRF-Token': logoutToken
            }
          });
        }
        
        // Clear session cookies
        Cookies.remove('drupal_session');
        Cookies.remove('drupal_csrf_token');
        Cookies.remove('drupal_logout_token');
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Always clear local auth state
      setUser(null);
      setAuthMethod(null);
    }
  };

  const value = {
    user,
    loading,
    authMethod,
    isAuthenticated,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);