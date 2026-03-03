import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Modal, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import * as Sentry from '@sentry/react-native';
import { tokenCache } from '../src/lib/clerk';
import { initAnalytics, identify, track, reset } from '../src/lib/analytics';
import { setClerkTokenGetter } from '../src/lib/api';
import { Colors, Fonts, FontSize, Spacing } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useLegalVersions, useAcceptLegal } from '../src/hooks/useApi';

// Keep splash screen visible until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialize PostHog analytics
initAnalytics();

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

const TERMS_ACCEPTED_KEY = 'orthis_tos_accepted_version';

function AuthGate() {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const { hasCompletedOnboarding, loadAuth } = useAuthStore();
  const { initialize: initSubscription } = useSubscriptionStore();
  const queryClient = useQueryClient();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingTerms, setPendingTerms] = useState<{ tosVersion: string; privacyVersion: string } | null>(null);
  const termsCheckedRef = useRef(false);

  const { data: legalVersions } = useLegalVersions();
  const acceptLegal = useAcceptLegal();

  // Track previous userId to detect account switches
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // Initialize push notifications
  usePushNotifications();

  // Set up Clerk token getter for API requests
  useEffect(() => {
    setClerkTokenGetter(getToken);
  }, [getToken]);

  // Check legal terms acceptance for signed-in users
  useEffect(() => {
    if (!isSignedIn || !hasCompletedOnboarding || !legalVersions || termsCheckedRef.current) return;
    termsCheckedRef.current = true;
    (async () => {
      try {
        const accepted = await SecureStore.getItemAsync(TERMS_ACCEPTED_KEY);
        if (accepted !== legalVersions.tosVersion) {
          setPendingTerms(legalVersions);
          setShowTermsModal(true);
        }
      } catch {
        // Non-fatal — skip terms check on SecureStore error
      }
    })();
  }, [isSignedIn, hasCompletedOnboarding, legalVersions]);

  // Re-run loadAuth when sign-in state changes so Zustand stays in sync
  useEffect(() => {
    loadAuth();
  }, [isSignedIn]);

  // Clear all caches whenever the active userId changes (account switch or sign-out).
  // This is the primary safety net — it fires regardless of which auth path was taken.
  useEffect(() => {
    // Skip the very first render (undefined → first resolved value)
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = userId ?? null;
      return;
    }
    const normalizedUserId = userId ?? null;
    if (prevUserIdRef.current !== normalizedUserId) {
      queryClient.clear();
      useSubscriptionStore.setState({ tier: 'free', isLoaded: false, offerings: null, customerInfo: null, limits: null });
      prevUserIdRef.current = normalizedUserId;
    }
  }, [userId]);

  // Initialize RevenueCat when user is signed in
  useEffect(() => {
    if (isSignedIn && userId) {
      initSubscription(userId).catch((error) => {
        console.error('[AuthGate] Subscription init failed:', error);
        // Non-fatal - user can still use app with free tier
      });
    }
  }, [isSignedIn, userId]);

  // Analytics: identify user and track app_opened
  useEffect(() => {
    if (isSignedIn && userId) {
      identify(userId);
      track('app_opened', {});
    } else if (!isSignedIn && isLoaded) {
      reset();
    }
  }, [isSignedIn, userId, isLoaded]);

  // Send first-touch UTM attribution to backend on fresh sign-in
  useEffect(() => {
    if (!isSignedIn || !userId) return;
    // prevUserIdRef.current is null when this is a fresh sign-in (no previous user)
    if (prevUserIdRef.current !== null) return;

    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('orthis_attribution');
        if (!stored) return;
        const attribution = JSON.parse(stored) as Record<string, string>;
        const token = await getToken();
        if (!token) return;
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://fitcheck-production-0f92.up.railway.app';
        await fetch(`${apiUrl}/api/user/attribution`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(attribution),
        });
        await SecureStore.deleteItemAsync('orthis_attribution');
      } catch {
        // Non-fatal — attribution is best-effort
      }
    })();
  }, [isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!navigationState?.key) return; // Navigator not mounted yet

    const inAuthGroup = segments[0] === 'login';
    const inOnboardingScreen = segments[0] === 'onboarding';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/login');
    } else if (isSignedIn && !hasCompletedOnboarding && !inOnboardingScreen) {
      router.replace('/onboarding' as any);
    } else if (isSignedIn && hasCompletedOnboarding && (inAuthGroup || inOnboardingScreen)) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoaded, hasCompletedOnboarding, segments, navigationState?.key]);

  const handleAcceptTerms = async () => {
    if (!pendingTerms) return;
    try {
      await acceptLegal.mutateAsync(pendingTerms);
      await SecureStore.setItemAsync(TERMS_ACCEPTED_KEY, pendingTerms.tosVersion);
      setShowTermsModal(false);
      setPendingTerms(null);
    } catch {
      // Non-fatal — still dismiss the modal so the user isn't blocked
      setShowTermsModal(false);
      setPendingTerms(null);
    }
  };

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <Modal visible={showTermsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {}}>
        <View style={styles.termsModal}>
          <Text style={styles.termsTitle}>Updated Terms & Privacy</Text>
          <Text style={styles.termsSubtitle}>
            We've updated our Terms of Service and Privacy Policy. Please review and accept to continue.
          </Text>
          <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.termsBody}>
              By tapping "Accept", you agree to the Or This? Terms of Service and Privacy Policy. These govern your use of the app, including how we process your outfit photos and personal data.
            </Text>
          </ScrollView>
          <View style={styles.termsLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://orthis.app/terms')}>
              <Text style={styles.termsLink}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://orthis.app/privacy')}>
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.termsAcceptButton}
            onPress={handleAcceptTerms}
            activeOpacity={0.85}
          >
            {acceptLegal.isPending
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.termsAcceptText}>Accept & Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  // Warm up the browser for faster OAuth flows (Android optimization)
  useEffect(() => {
    WebBrowser.warmUpAsync().catch(() => {});
    return () => {
      WebBrowser.coolDownAsync().catch(() => {});
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env');
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  termsModal: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    paddingTop: Spacing.xl * 2,
  },
  termsTitle: {
    fontFamily: Fonts.serifItalic,
    fontSize: FontSize.xl,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  termsSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  termsScroll: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  termsBody: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  termsLinks: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  termsLink: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  termsAcceptButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: 0,
    marginBottom: Spacing.xl,
  },
  termsAcceptText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
