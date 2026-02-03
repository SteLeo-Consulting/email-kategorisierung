// =============================================================================
// Hook to get user email from localStorage for API calls
// =============================================================================

import { useState, useEffect } from 'react';

// API URL - use environment variable or default to production API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://emailcat-api.vercel.app';

export function useUserEmail() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUserEmail(userData.email);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  return userEmail;
}

/**
 * Helper function to build API URL with email parameter
 */
export function buildApiUrl(path: string, email: string | null, additionalParams?: Record<string, string>) {
  const params = new URLSearchParams();

  if (email) {
    params.set('email', email);
  }

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
  }

  const queryString = params.toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;

  // Prepend API_URL to make it an absolute URL to the backend
  return `${API_URL}${fullPath}`;
}

/**
 * Helper function to make authenticated fetch calls
 */
export async function authenticatedFetch(
  path: string,
  email: string | null,
  options?: RequestInit & { additionalParams?: Record<string, string> }
) {
  const { additionalParams, ...fetchOptions } = options || {};
  const url = buildApiUrl(path, email, additionalParams);
  return fetch(url, fetchOptions);
}
