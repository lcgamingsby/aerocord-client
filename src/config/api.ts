/**
 * Central API URL configuration for AeroCord.
 * 
 * In development:      http://localhost:4000
 * In production:       value from VITE_API_URL environment variable
 * 
 * Set VITE_API_URL in your .env for local dev override,
 * or in Vercel project settings for production.
 */
export const API_URL: string = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:4000';

/**
 * Helper: build a full API endpoint URL.
 * Usage: apiUrl('/api/auth/login')
 */
export const apiUrl = (path: string): string => `${API_URL}${path}`;

/**
 * Socket.IO server URL — same server as the REST API.
 */
export const SOCKET_URL: string = API_URL;
