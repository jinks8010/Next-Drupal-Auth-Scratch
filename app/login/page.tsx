"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginUser } from '../utils/auth';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loginStatus, setLoginStatus] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        setLoginStatus('Authenticating...');

        try {
            if (!username || !password) {
                throw new Error('Username and password are required');
            }

            setLoginStatus('Getting CSRF token...');
            // Login with CSRF and get user data
            const userData = await loginUser(username, password);

            // Check if we need to redirect for OAuth flow
            if (userData.requiresRedirect) {
                setLoginStatus('Redirecting to authorize...');
                window.location.href = userData.redirectUrl;
                return; // Important: stop execution here
            }

            setLoginStatus('Login successful! Redirecting...');
            setTimeout(() => {
                router.push('/');
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
            setLoginStatus(null);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md">
                <h1 className="text-2xl font-bold text-center">Login to Your Account</h1>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or</span>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
}