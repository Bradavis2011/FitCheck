import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors, Fonts } from '../../src/constants/theme';

const PENDING_REFERRAL_KEY = 'orthis_pending_referral_code';

/**
 * Deep link handler for referral invites.
 * URL: orthis://invite/CODE  (custom scheme)
 *
 * Stores the referral code in SecureStore and redirects to login.
 * The ReferralCard in profile.tsx reads and claims it after signup.
 */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    async function handleInvite() {
      if (code && typeof code === 'string') {
        try {
          await SecureStore.setItemAsync(PENDING_REFERRAL_KEY, code.trim());
        } catch {
          // Non-fatal — app still works without referral tracking
        }
      }
      // Always redirect to login
      router.replace('/login');
    }
    handleInvite();
  }, [code]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Opening Or This?...</Text>
    </View>
  );
}

export { PENDING_REFERRAL_KEY };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  text: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.textMuted,
  },
});
