// Google OAuth utilities for client-side authentication

const GOOGLE_CLIENT_ID_KEY = 'google_client_id';
const GOOGLE_TOKEN_KEY = 'google_access_token';
const GOOGLE_USER_KEY = 'google_user_info';

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string;
}

// Save Google Client ID
export const saveGoogleClientId = (clientId: string): void => {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
};

// Get Google Client ID
export const getGoogleClientId = (): string | null => {
  return localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
};

// Save access token
export const saveAccessToken = (token: string): void => {
  localStorage.setItem(GOOGLE_TOKEN_KEY, token);
};

// Get access token
export const getAccessToken = (): string | null => {
  return localStorage.getItem(GOOGLE_TOKEN_KEY);
};

// Save user info
export const saveUserInfo = (userInfo: GoogleUserInfo): void => {
  localStorage.setItem(GOOGLE_USER_KEY, JSON.stringify(userInfo));
};

// Get user info
export const getUserInfo = (): GoogleUserInfo | null => {
  const data = localStorage.getItem(GOOGLE_USER_KEY);
  return data ? JSON.parse(data) : null;
};

// Clear all Google auth data
export const clearGoogleAuth = (): void => {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_USER_KEY);
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getAccessToken() && !!getUserInfo();
};

// Initialize Google Sign-In
export const initGoogleSignIn = (clientId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.body.appendChild(script);
  });
};

// Handle Google OAuth callback
export const handleGoogleCallback = (response: any): GoogleUserInfo => {
  // Decode JWT token to get user info
  const token = response.credential;
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );

  const payload = JSON.parse(jsonPayload);
  
  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
};

// Request OAuth token with Sheets API scope
export const requestSheetsAccess = (clientId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google API not loaded'));
      return;
    }
    
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          saveAccessToken(response.access_token);
          resolve(response.access_token);
        }
      },
    });
    client.requestAccessToken();
  });
};
