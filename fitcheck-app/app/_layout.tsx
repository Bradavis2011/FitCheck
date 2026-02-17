import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { tokenCache } from '../src/lib/clerk';
import { setClerkTokenGetter } from '../src/lib/api';
import { Colors } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

// Initialize Sentry for error tracking
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.2,
    environment: process.env.NODE_ENV || 'development',
  });
}
// import OfflineIndicator from '../src/components/OfflineIndicator'; // Temporarily disabled

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AuthGate() {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const { hasCompletedOnboarding, loadAuth } = useAuthStore();
  const { initialize: initSubscription } = useSubscriptionStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize push notifications
  usePushNotifications();

  // Set up Clerk token getter for API requests
  useEffect(() => {
    setClerkTokenGetter(getToken);
  }, [getToken]);

  useEffect(() => {
    loadAuth();
  }, []);

  // Initialize RevenueCat when user is signed in
  useEffect(() => {
    if (isSignedIn && userId) {
      initSubscription(userId).catch((error) => {
        console.error('[AuthGate] Subscription init failed:', error);
        // Non-fatal - user can still use app with free tier
      });
    }
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === 'login';
    const inOnboardingScreen = segments[0] === 'onboarding';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/login');
    } else if (isSignedIn && !hasCompletedOnboarding && !inOnboardingScreen) {
      router.replace('/onboarding' as any);
    } else if (isSignedIn && hasCompletedOnboarding && (inAuthGroup || inOnboardingScreen)) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoaded, hasCompletedOnboarding, segments]);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env');
  }

  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        tokenCache={tokenCache}
      >
        <ClerkLoaded>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            {/* <OfflineIndicator /> Temporarily disabled */}
            <AuthGate />
          </QueryClientProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
