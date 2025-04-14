import axios from 'axios';
import { log } from 'console';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false,
});
const TokenService = {
    getAccessToken: () => localStorage.getItem('accessToken'),
    getRefreshToken: () => localStorage.getItem('refreshToken'),
    getCsrfToken: () => localStorage.getItem('csrfToken'),
    getLogoutToken: () => {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return userData.logout_token;
        } catch (e) {
            console.error('Error parsing user data for logout token:', e);
            return null;
        }
    },
    setTokens: (accessToken: string, refreshToken: string | null | undefined) => {
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
    },
    setCsrfToken: (token: string) => {
        localStorage.setItem('csrfToken', token);
    },
    clearTokens: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('csrfToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('oauth_state');
    }
};
api.interceptors.request.use(
    async (config) => {
        const accessToken = TokenService.getAccessToken();
        if (accessToken && config.headers) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '') &&
            !config.headers['X-CSRF-Token']) {
            const csrfToken = TokenService.getCsrfToken();
            if (csrfToken && config.headers) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = TokenService.getRefreshToken();
                if (!refreshToken) {
                    console.log('No refresh token available, trying to get a new access token');
                    try {
                        const tokenData = await getOAuthTokensFallback();
                        if (tokenData.access_token) {
                            originalRequest.headers['Authorization'] = `Bearer ${tokenData.access_token}`;
                            return api(originalRequest);
                        }
                    } catch (newTokenError) {
                        console.error('Failed to get new access token:', newTokenError);
                        logoutUser();
                        return Promise.reject(error);
                    }
                }
                const response = await axios.post(
                    `${API_BASE_URL}/oauth/token`,
                    encodeFormData({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken || '',
                        client_id: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || '05nYsynYKs4YLx2ALZs3tk3nPd_lv0T8N2I7ykypY3A',
                        client_secret: process.env.NEXT_PUBLIC_OAUTH_CLIENT_SECRET || '12345'
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        withCredentials: false
                    }
                );
                if (response.status === 200) {
                    TokenService.setTokens(response.data.access_token, response.data.refresh_token || '');
                    originalRequest.headers['Authorization'] = `Bearer ${response.data.access_token}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                try {
                    const tokenData = await getOAuthTokensFallback();
                    if (tokenData.access_token) {
                        originalRequest.headers['Authorization'] = `Bearer ${tokenData.access_token}`;
                        return api(originalRequest);
                    }
                } catch (newTokenError) {
                    console.error('Failed to get new access token after refresh failure:', newTokenError);
                }
                logoutUser();
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);
function encodeFormData(data: Record<string, string>) {
    return Object.keys(data)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
        .join('&');
}
export async function loginUser(username: string, password: string) {
    try {
        const loginResponse = await axios.post(
            `${API_BASE_URL}/user/login?_format=json`,
            { name: username, pass: password },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                withCredentials: false
            }
        );
        const userData = loginResponse.data;
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        if (userData.csrf_token) {
            TokenService.setCsrfToken(userData.csrf_token);
        }
        try {
            const oauthResponse = await getOAuthTokens(username, password);
            if (oauthResponse.requiresRedirect) {
                return {
                    ...userData,
                    requiresRedirect: true,
                    redirectUrl: oauthResponse.redirectUrl
                };
            }
            console.log('OAuth tokens acquired successfully:',
                oauthResponse.access_token ? 'Access token present' : 'No access token',
                oauthResponse.refresh_token ? 'Refresh token present' : 'No refresh token');
            return { ...userData, oauthTokens: oauthResponse };
        } catch (oauthError) {
            console.error('OAuth token acquisition failed, but login succeeded:', oauthError);
            return userData;
        }
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}
async function getOAuthTokens(username: string, password: string) {
    try {
        console.log('Starting OAuth flow with authorization_code grant type');
        const state = Math.random().toString(36).substring(2);
        localStorage.setItem('oauth_state', state);
        const clientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || '05nYsynYKs4YLx2ALZs3tk3nPd_lv0T8N2I7ykypY3A';
        const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
        const authUrl = `${API_BASE_URL}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=access_token`;
        return {
            requiresRedirect: true,
            redirectUrl: authUrl
        };
    } catch (error) {
        console.error('Failed to start OAuth flow:', error);
        try {
            return await getOAuthTokensFallback();
        } catch (fallbackError) {
            console.error('Fallback OAuth method also failed:', fallbackError);
            throw fallbackError;
        }
    }
}
async function getOAuthTokensFallback() {
    console.log('Trying OAuth fallback with client_credentials grant');
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || '05nYsynYKs4YLx2ALZs3tk3nPd_lv0T8N2I7ykypY3A');
    formData.append('client_secret', process.env.NEXT_PUBLIC_OAUTH_CLIENT_SECRET || '12345');
    const response = await axios.post(
        `${API_BASE_URL}/oauth/token`,
        formData.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            withCredentials: false
        }
    );
    if (response.data && response.data.access_token) {
        TokenService.setTokens(response.data.access_token, '');
        return response.data;
    } else {
        throw new Error('OAuth fallback response did not contain access token');
    }
}
export function getOAuthLoginUrl() {
    const clientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID;
    const redirectUri = encodeURIComponent(
        `${window.location.origin}/auth/callback`
    );
    const state = Math.random().toString(36).substring(2);
    localStorage.setItem('oauth_state', state);
    return `${API_BASE_URL}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
}
export async function exchangeCodeForTokens(code: string) {
    try {
        const clientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID;
        const clientSecret = process.env.NEXT_PUBLIC_OAUTH_CLIENT_SECRET;
        const redirectUri = `${window.location.origin}/auth/callback`;
        const formData = {
            grant_type: 'authorization_code',
            code,
            client_id: clientId || '05nYsynYKs4YLx2ALZs3tk3nPd_lv0T8N2I7ykypY3A',
            client_secret: clientSecret || '12345',
            redirect_uri: redirectUri,
        };
        const response = await axios.post(
            `${API_BASE_URL}/oauth/token`,
            encodeFormData(formData),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                withCredentials: false
            }
        );
        TokenService.setTokens(response.data.access_token, response.data.refresh_token);
        return response.data;
    } catch (error) {
        console.error('Failed to exchange code for tokens:', error);
        throw error;
    }
}
export async function fetchOAuthUser(accessToken: string) {
    try {
        const response = await axios.get(`${API_BASE_URL}/oauth/me?_format=json`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            withCredentials: false
        });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch user data:', error);
        throw error;
    }
}
export async function logoutUser() {
    try {
        const logoutToken = TokenService.getLogoutToken();
        const csrfToken = TokenService.getCsrfToken();

        if (logoutToken && csrfToken) {
            console.log("Logging out with tokens:", logoutToken, csrfToken);

            await axios.get(
                `${API_BASE_URL}/user/logout?_format=json&token=${logoutToken}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    withCredentials: true
                }
            );

            console.log('Server-side logout completed successfully');
        } else {
            console.warn("Missing logout or CSRF token");
        }

        TokenService.clearTokens();
        localStorage.removeItem('oauth_code');
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        TokenService.clearTokens();
        localStorage.removeItem('oauth_code');
        return true;
    }
}

export async function createArticle(title: string, body: string) {
    try {
        const accessToken = TokenService.getAccessToken();
        if (!accessToken) {
            console.warn('No access token available, attempting to get one');
            try {
                const tokenData = await getOAuthTokensFallback();
                TokenService.setTokens(tokenData.access_token, tokenData.refresh_token || '');
            } catch (tokenError) {
                console.error('Failed to acquire token for article creation:', tokenError);
                throw new Error('Authentication token required to create articles');
            }
        }
        const articleData = {
            data: {
                type: "node--article",
                attributes: {
                    title: title,
                    body: {
                        value: body,
                        format: "basic_html"
                    }
                }
            }
        };
        console.log('Sending article data:', JSON.stringify(articleData));
        const response = await axios.post(
            `${API_BASE_URL}/jsonapi/node/article`,
            articleData,
            {
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'Accept': 'application/vnd.api+json',
                    'Authorization': `Bearer ${TokenService.getAccessToken()}`
                },
                withCredentials: false
            }
        );
        console.log('Article creation response:', response.status);
        return response.data;
    } catch (error) {
        console.error('Failed to create article with JSON:API:', error);
        if (axios.isAxiosError(error) && error.response) {
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
            if (error.response.status === 422) {
                throw new Error('Invalid article data format. Please check your input.');
            } else if (error.response.status === 403) {
                throw new Error('You do not have permission to create articles.');
            } else if (error.response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            }
        }
        throw error;
    }
}
export function getAuthStatus() {
    return {
        isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
        hasAccessToken: !!TokenService.getAccessToken(),
        hasRefreshToken: !!TokenService.getRefreshToken(),
        hasCsrfToken: !!TokenService.getCsrfToken(),
        hasLogoutToken: !!TokenService.getLogoutToken()
    };
}
export function getCookieInfo() {
    const cookieInfo: {
        all: string;
        parsed: { [key: string]: string };
    } = {
        all: document.cookie,
        parsed: {}
    };
    if (document.cookie) {
        document.cookie.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                cookieInfo.parsed[name] = parts.slice(1).join('=');
            }
        });
    }
    return cookieInfo;
}
export default api;