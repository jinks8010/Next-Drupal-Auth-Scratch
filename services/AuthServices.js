/**
 * Drupal Authentication Utility
 *
 * This module handles two authentication methods with Drupal:
 * 1. OAuth2 with token-based authentication
 * 2. Session-based authentication with CSRF token
 */

import axios from "axios";
import Cookies from "js-cookie";

// Configuration
const config = {
  drupalBaseUrl: process.env.NEXT_PUBLIC_DRUPAL_BASE_URL,
  clientId: process.env.NEXT_PUBLIC_DRUPAL_CLIENT_ID,
  clientSecret: process.env.NEXT_PUBLIC_DRUPAL_CLIENT_SECRET,
  tokenEndpoint: "/oauth/token",
  authorizeEndpoint: "/oauth/authorize",
  userInfoEndpoint: "/oauth/userinfo",
  logoutEndpoint: "/user/logout",
  sessionLoginEndpoint: "/user/login",
  sessionTokenEndpoint: "/session/token",
  cookiePrefix: "drupal_auth_",
  tokenExpiryBuffer: 300, // 5 minutes in seconds
};

// ========== OAuth2 Authentication Functions ==========

/**
 * Initialize the OAuth2 authorization flow
 * @param {string} redirectUri - URI to redirect after authorization
 * @param {string} scope - OAuth scopes to request
 * @param {string} state - Random state for CSRF protection
 * @returns {string} - Authorization URL
 */
export function initiateAuthFlow(
  redirectUri,
  scope = "access_token",
  state = generateRandomState()
) {
  // Store state in cookie for verification
  Cookies.set(`${config.cookiePrefix}state`, state, { sameSite: "strict" });

  // Construct the authorization URL
  const authUrl = new URL(`${config.drupalBaseUrl}${config.authorizeEndpoint}`);
  authUrl.searchParams.append("client_id", config.clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_url", redirectUri);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("state", state);

  return authUrl.toString();
}

/**
 * Generate a random state string for CSRF protection
 * @returns {string} - Random state string
 */
function generateRandomState() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from Drupal
 * @param {string} redirectUri - Redirect URI used in authorization request
 * @returns {Promise<Object>} - Token response
 */
export async function exchangeCodeForTokens(
  code,
  redirectUri = "https://localhost:3000"
) {
  try {
    const response = await axios.post(
      `${config.drupalBaseUrl}${config.tokenEndpoint}`,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        redirect_url: redirectUri,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data && response.data.access_token) {
      saveTokens(response.data);
      return response.data;
    }

    throw new Error("Invalid token response");
  } catch (error) {
    console.error("Token exchange failed:", error);
    throw error;
  }
}

/**
 * Verify the state parameter to prevent CSRF attacks
 * @param {string} receivedState - State received from authorization response
 * @returns {boolean} - Whether state is valid
 */
export function verifyState(receivedState) {
  const storedState = Cookies.get(`${config.cookiePrefix}state`);
  if (!storedState || storedState !== receivedState) {
    return false;
  }

  // Clean up the state cookie
  Cookies.remove(`${config.cookiePrefix}state`);
  return true;
}

/**
 * Save authentication tokens to cookies or local storage
 * @param {Object} tokenData - Token response from Drupal
 */
function saveTokens(tokenData) {
  const { access_token, refresh_token, expires_in } = tokenData;

  // Calculate expiry time
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  // Store tokens securely in cookies
  Cookies.set(`${config.cookiePrefix}access_token`, access_token, {
    expires: expiresAt,
    sameSite: "strict",
    secure: window.location.protocol === "https:",
  });

  if (refresh_token) {
    // Refresh tokens typically have longer expiry - use 30 days as fallback
    const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    Cookies.set(`${config.cookiePrefix}refresh_token`, refresh_token, {
      expires: refreshExpiry,
      sameSite: "strict",
      secure: window.location.protocol === "https:",
    });
  }

  // Store token expiry time for easy reference
  Cookies.set(`${config.cookiePrefix}expires_at`, expiresAt.getTime(), {
    expires: expiresAt,
    sameSite: "strict",
    secure: window.location.protocol === "https:",
  });
}

/**
 * Get the current access token
 * @returns {string|null} - Access token or null if not available
 */
export function getAccessToken() {
  return Cookies.get(`${config.cookiePrefix}access_token`) || null;
}

/**
 * Check if token-based authentication is valid
 * @returns {boolean} - Whether token is valid
 */
export function isTokenAuthenticated() {
  const token = getAccessToken();
  if (!token) return false;

  const expiresAt = parseInt(
    Cookies.get(`${config.cookiePrefix}expires_at`) || "0",
    10
  );

  // Add buffer to prevent edge cases where token expires during request
  return Date.now() < expiresAt - config.tokenExpiryBuffer * 1000;
}

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<Object>} - New token data
 */
export async function refreshAccessToken() {
  const refreshToken = Cookies.get(`${config.cookiePrefix}refresh_token`);
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  try {
    const response = await axios.post(
      `${config.drupalBaseUrl}${config.tokenEndpoint}`,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (response.data && response.data.access_token) {
      saveTokens(response.data);
      return response.data;
    }

    throw new Error("Invalid token response");
  } catch (error) {
    console.error("Token refresh failed:", error);
    logoutOAuth(); // Clear tokens on refresh failure
    throw error;
  }
}

/**
 * Log out user from OAuth authentication
 * @returns {Promise<void>}
 */
export async function logoutOAuth() {
  const token = getAccessToken();

  // Clear all OAuth authentication cookies
  Object.keys(Cookies.get())
    .forEach((name) => Cookies.remove(name));

  // Perform server-side logout if we have a token
  if (token) {
    try {
      await axios.get(`${config.drupalBaseUrl}${config.logoutEndpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error("Server logout failed:", error);
      // Continue with client-side logout even if server logout fails
    }
  }
}

// ========== Session-Based Authentication Functions ==========

/**
 * Check if session-based authentication is valid
 * @returns {boolean} - Whether session is valid
 */
export function isSessionAuthenticated() {
  return !!Cookies.get('drupal_session');
}

/**
 * Login using session-based authentication
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} - Login response
 */
export async function loginWithSession(username, password) {
  try {
    const response = await axios.post(
      `${config.drupalBaseUrl}${config.sessionLoginEndpoint}`, 
      { name: username, pass: password },
      { 
        withCredentials: true
      }
    );

    if (response.data && response.data.csrf_token) {
      // Store CSRF token for future requests
      Cookies.set('drupal_csrf_token', response.data.csrf_token, {
        sameSite: 'strict',
        secure: window.location.protocol === 'https:'
      });
      
      // Store logout token for logout functionality
      if (response.data.logout_token) {
        Cookies.set('drupal_logout_token', response.data.logout_token, {
          sameSite: 'strict',
          secure: window.location.protocol === 'https:'
        });
      }
      
      return response.data;
    }
    
    throw new Error('Invalid login response');
  } catch (error) {
    console.error('Session login failed:', error);
    throw error;
  }
}

/**
 * Refresh the CSRF token
 * @returns {Promise<string>} - New CSRF token
 */
export async function refreshCsrfToken() {
  try {
    const response = await axios.get(
      `${config.drupalBaseUrl}${config.sessionTokenEndpoint}`,
      { withCredentials: true }
    );
    
    if (response.data) {
      // Store new CSRF token
      Cookies.set('drupal_csrf_token', response.data, {
        sameSite: 'strict',
        secure: window.location.protocol === 'https:'
      });
      
      return response.data;
    }
    
    throw new Error('Failed to get CSRF token');
  } catch (error) {
    console.error('CSRF token refresh failed:', error);
    throw error;
  }
}

/**
 * Log out user from session-based authentication
 * @returns {Promise<void>}
 */
export async function logoutSession() {
  const logoutToken = Cookies.get('drupal_logout_token');
  
  try {
    // Server-side logout using logout token
    if (logoutToken) {
      await axios.get(`${config.drupalBaseUrl}${config.logoutEndpoint}`, {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': logoutToken
        }
      });
    }
  } catch (error) {
    console.error('Server logout failed:', error);
  } finally {
    // Clear session cookies regardless of server response
    Cookies.remove('drupal_session');
    Cookies.remove('drupal_csrf_token');
    Cookies.remove('drupal_logout_token');
  }
}

// ========== Smart Authentication Functions ==========

/**
 * Smart authentication detection - checks both auth methods
 * @returns {boolean} - Whether user is authenticated by any method
 */
export function isAuthenticated() {
  return isTokenAuthenticated() || isSessionAuthenticated();
}

/**
 * Universal logout that handles both authentication methods
 * @returns {Promise<void>}
 */
export async function logout() {
  // Check which auth method is active and log out accordingly
  if (isTokenAuthenticated()) {
    await logoutOAuth();
  }
  
  if (isSessionAuthenticated()) {
    await logoutSession();
  }
}

/**
 * Create an axios instance with smart authentication
 * @returns {Object} - Axios instance
 */
export function createAuthenticatedClient() {
  const client = axios.create({
    baseURL: config.drupalBaseUrl,
  });

  // Add request interceptor to add authentication headers
  client.interceptors.request.use(
    async (config) => {
      // Check if we're using OAuth token auth
      if (isTokenAuthenticated()) {
        try {
          const token = getAccessToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("Failed to add token:", error);
        }
      } 
      // Check if we're using session auth
      else if (isSessionAuthenticated()) {
        // For session auth, we need to send cookies and add CSRF tokens
        config.withCredentials = true;
        
        const csrfToken = Cookies.get('drupal_csrf_token');
        if (csrfToken && (config.method === 'post' || config.method === 'put' || 
            config.method === 'patch' || config.method === 'delete')) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor to handle authentication issues
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // If using OAuth and token is expired
      if (error.response?.status === 401 && isTokenAuthenticated() && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await refreshAccessToken();
          // Retry the original request with new token
          const token = getAccessToken();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axios(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      // If using session auth and CSRF token is invalid
      if (error.response?.status === 403 && isSessionAuthenticated() && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // Refresh CSRF token
          await refreshCsrfToken();
          // Retry the original request with new CSRF token
          originalRequest.headers['X-CSRF-Token'] = Cookies.get('drupal_csrf_token');
          return axios(originalRequest);
        } catch (csrfError) {
          return Promise.reject(csrfError);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}