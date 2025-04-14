'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeCodeForTokens } from '../../utils/auth';

export default function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>('Processing authorization code...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code and state from URL parameters
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const storedState = localStorage.getItem('oauth_state');

        // Validate state to prevent CSRF attacks
        if (!state || state !== storedState) {
          throw new Error('Invalid state parameter. Authorization request may have been tampered with.');
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Store the code temporarily if needed
        localStorage.setItem('oauth_code', code);

        setStatus('Exchanging code for tokens...');
        // Exchange the code for access/refresh tokens
        const tokenData = await exchangeCodeForTokens(code);

        setStatus('Authentication successful! Redirecting...');

        // Clear the state as it's no longer needed
        localStorage.removeItem('oauth_state');

        // Redirect back to home or dashboard
        setTimeout(() => {
          router.push('/');
        }, 1000);

      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('Error occurred during authentication');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">Authentication</h1>

        {!error ? (
          <div className="text-center">
            <div className="my-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            </div>
            <p className="mt-4 text-gray-600">{status}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}