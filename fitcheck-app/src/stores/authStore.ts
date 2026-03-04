import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from '../lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  tier: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const TOKEN_KEY = 'orthis_auth_token';
const USER_KEY = 'orthis_user';
const ONBOARDING_KEY = 'orthis_onboarding_completed';

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  hasCompletedOnboarding: false,

  setAuth: async (token: string, user: User) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      setAuthToken(token);
      set({ token, user, isAuthenticated: true });
    } catch (error) {
      console.error('[AuthStore] Failed to save auth:', error);
      throw error;
    }
  },

  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(ONBOARDING_KEY);
      setAuthToken(null);
      set({ token: null, user: null, isAuthenticated: false, hasCompletedOnboarding: false });
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  },

  loadAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      const onboardingCompleted = await SecureStore.getItemAsync(ONBOARDING_KEY);

      if (token && userJson) {
        let user: User;
        try {
          user = JSON.parse(userJson);
        } catch {
          // Corrupt SecureStore data — clear it and start fresh
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
          set({ isLoading: false, hasCompletedOnboarding: onboardingCompleted === 'true' });
          return;
        }
        setAuthToken(token);
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          hasCompletedOnboarding: onboardingCompleted === 'true',
        });
      } else {
        set({
          isLoading: false,
          hasCompletedOnboarding: onboardingCompleted === 'true',
        });
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
      set({ isLoading: false });
    }
  },

  completeOnboarding: async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      set({ hasCompletedOnboarding: true });
    } catch (error) {
      console.error('Failed to save onboarding status:', error);
    }
  },
}));
