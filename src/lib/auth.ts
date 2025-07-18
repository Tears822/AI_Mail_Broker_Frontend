import { jwtDecode } from 'jwt-decode';

export interface JWTPayload {
  exp: number;
  iat: number;
  sub: string;
  username: string;
  [key: string]: unknown;
}

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    if (!decoded.exp) return true;
    // exp is in seconds, add 5 minute buffer
    return Date.now() >= (decoded.exp - 300) * 1000;
  } catch {
    return true;
  }
}

export function getTokenPayload(token: string): JWTPayload | null {
  try {
    return jwtDecode<JWTPayload>(token);
  } catch {
    return null;
  }
}

export function clearAuthData() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export function handleAuthError() {
  clearAuthData();
  // Redirect to login page
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

export function getValidToken(): string | null {
  console.log('[AUTH DEBUG] getValidToken() called');
  const token = localStorage.getItem('access_token');
  console.log('[AUTH DEBUG] Token from localStorage:', token ? 'Token found' : 'No token');
  
  if (!token) {
    console.log('[AUTH DEBUG] No token in localStorage');
    return null;
  }
  
  const isExpired = isTokenExpired(token);
  console.log('[AUTH DEBUG] Token expiry check:', isExpired ? 'EXPIRED' : 'VALID');
  
  if (isExpired) {
    console.log('[AUTH DEBUG] Token expired, clearing auth data');
    clearAuthData();
    return null;
  }
  
  console.log('[AUTH DEBUG] Returning valid token:', token.slice(0, 20) + '...');
  return token;
} 