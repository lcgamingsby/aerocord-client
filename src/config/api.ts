/**
 * Central API URL configuration for AeroCord.
 * 
 * In development:      http://localhost:4000
 * In production:       value from VITE_API_URL environment variable
 * 
 * Set VITE_API_URL in your .env for local dev override,
 * or in Vercel project settings for production.
 */
const rawUrl: string = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:4000';

// Strip any trailing slashes to prevent double slashes in API endpoints
export const API_URL: string = rawUrl.replace(/\/+$/, '');

/**
 * Helper: build a full API endpoint URL safely.
 * Usage: apiUrl('/api/auth/login')
 */
export const apiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
};

/**
 * Socket.IO server URL — same server as the REST API.
 */
export const SOCKET_URL: string = API_URL;
