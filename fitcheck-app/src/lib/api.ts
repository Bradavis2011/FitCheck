import axios from 'axios';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set auth token for non-Clerk (custom JWT) mode
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Global token getter function for Clerk mode
let clerkTokenGetter: (() => Promise<string | null>) | null = null;

export const setClerkTokenGetter = (getter: () => Promise<string | null>) => {
  clerkTokenGetter = getter;
};

// Axios interceptor to inject Clerk token when in Clerk mode
api.interceptors.request.use(
  async (config) => {
    // Skip token injection for webhook endpoint
    if (config.url?.includes('/clerk-webhook')) {
      return config;
    }

    // If Clerk token getter is available, use it
    if (clerkTokenGetter) {
      try {
        const token = await clerkTokenGetter();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          // getToken() returned null — don't fall through to stale default headers
          delete config.headers.Authorization;
        }
      } catch (error) {
        console.error('[API] Failed to get Clerk token:', error);
        delete config.headers.Authorization;
      }
    }

    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Log all API errors
    console.error('[API] Request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
    });

    // Handle specific error cases
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      switch (status) {
        case 401:
          console.warn('[API] Unauthorized - token may be expired');
          // Could trigger re-authentication here
          break;
        case 403:
          console.warn('[API] Forbidden - insufficient permissions');
          break;
        case 404:
          console.warn('[API] Not found:', error.config?.url);
          break;
        case 429:
          console.warn('[API] Rate limited');
          break;
        case 500:
        case 502:
        case 503:
          console.error('[API] Server error:', status);
          break;
      }

      // Add user-friendly error message
      error.userMessage = data?.message || getErrorMessage(status);
    } else if (error.request) {
      // Request made but no response received
      console.error('[API] No response received - network issue');
      error.userMessage = 'Network error. Please check your connection.';
    } else {
      // Error in request setup
      console.error('[API] Request setup error:', error.message);
      error.userMessage = 'An unexpected error occurred.';
    }

    return Promise.reject(error);
  }
);

// Helper to get user-friendly error messages
function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please try again.';
    case 401:
      return 'Please sign in to continue.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
    case 502:
    case 503:
      return 'Server error. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
}
