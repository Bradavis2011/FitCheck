import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useSignIn, useSignUp, useAuth, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import OrThisLogo from '../src/components/OrThisLogo';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';

// Required for OAuth redirect handling on both iOS and Android
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { signOut } = useAuth();
  const { startSSOFlow } = useSSO();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingSignInVerification, setPendingSignInVerification] = useState(false);
  const [signInEmailAddressId, setSignInEmailAddressId] = useState<string | null>(null);
  const [isSecondFactor, setIsSecondFactor] = useState(false);
  const [code, setCode] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  // Intercept Android hardware back during email verification or password reset
  useEffect(() => {
    if (!pendingVerification && !pendingSignInVerification && !isForgotPassword) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pendingSignInVerification) { setPendingSignInVerification(false); setSignInEmailAddressId(null); setIsSecondFactor(false); setCode(''); }
      if (pendingVerification) { setPendingVerification(false); setCode(''); }
      if (isForgotPassword) { setIsForgotPassword(false); setPendingReset(false); setResetCode(''); setNewPassword(''); }
      return true;
    });
    return () => handler.remove();
  }, [pendingVerification, pendingSignInVerification, isForgotPassword]);

  const handleSignIn = async () => {
    if (!signInLoaded) return;

    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Clear any stale session — prevents "session already exists" error
      try { await signOut(); } catch {}

      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActiveSignIn({ session: signInAttempt.createdSessionId });
        router.replace('/(tabs)');
      } else if (signInAttempt.status === 'needs_first_factor') {
        // Account exists but email unverified — send verification code via sign-in flow
        const emailFactor = signInAttempt.supportedFirstFactors?.find(
          (f) => f.strategy === 'email_code'
        );
        if (emailFactor && 'emailAddressId' in emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId,
          });
          setSignInEmailAddressId(emailFactor.emailAddressId);
          setIsSecondFactor(false);
          setPendingSignInVerification(true);
        } else {
          Alert.alert('Error', 'Please verify your email. Check your inbox or try signing in with Google or Apple.');
        }
      } else if (signInAttempt.status === 'needs_second_factor') {
        // MFA required — send email code as second factor
        const emailFactor = signInAttempt.supportedSecondFactors?.find(
          (f: any) => f.strategy === 'email_code'
        );
        if (emailFactor && 'emailAddressId' in (emailFactor as any)) {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: (emailFactor as any).emailAddressId,
          });
          setSignInEmailAddressId((emailFactor as any).emailAddressId);
          setIsSecondFactor(true);
          setPendingSignInVerification(true);
        } else {
          Alert.alert('Error', 'Two-factor authentication is required. Please try signing in with Google or Apple.');
        }
      } else {
        console.error('Sign in not complete:', signInAttempt);
        Alert.alert('Error', 'Sign in failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      const clerkCode = error.errors?.[0]?.code;
      const clerkMsg: string = error.errors?.[0]?.message || '';
      if (clerkCode === 'form_password_incorrect' || clerkMsg.toLowerCase().includes('password')) {
        Alert.alert(
          'Incorrect Password',
          'That password is incorrect. Try "Forgot Password" or sign in with Google or Apple.',
          [
            { text: 'Forgot Password', onPress: () => { setIsRegister(false); setIsForgotPassword(true); } },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Sign In Error', clerkMsg || error.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded) return;

    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      // Clear any stale session — prevents "session already exists" error
      try { await signOut(); } catch {}

      // Clerk persists sign-up state in SecureStore between app launches (and
      // across installs on iOS via Keychain). If a pending sign-up exists for a
      // DIFFERENT email, create() will throw "Invalid action". Handle upfront.
      if (signUp.status === 'missing_requirements') {
        if (signUp.emailAddress === email) {
          // Same email — resend code and resume verification
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
          return;
        } else {
          // Different email stuck in Keychain from a previous install/session.
          // We cannot abandon it via the SDK — guide the user to an alternative.
          Alert.alert(
            'Account Pending',
            `A previous sign-up for ${signUp.emailAddress} is still awaiting verification on this device. Please verify that account, or sign up with Google or Apple instead.`
          );
          return;
        }
      }

      await signUp.create({
        emailAddress: email,
        password,
        firstName: name || undefined,
      });

      // Send verification email
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      setPendingVerification(true);
    } catch (error: any) {
      console.error('Sign up error:', error);
      const clerkCode = error.errors?.[0]?.code;
      const clerkMsg: string = error.errors?.[0]?.message || '';

      if (clerkCode === 'form_password_pwned') {
        Alert.alert('Sign Up Error', 'That password appears in a known data breach. Try a longer or more unique password (e.g. 3 random words + a number).');
        return;
      }

      // Email already registered — auto-attempt sign-in with the same credentials
      if (clerkCode === 'form_identifier_exists' || clerkMsg.toLowerCase().includes('taken')) {
        try {
          const signInAttempt = await signIn.create({ identifier: email, password });
          if (signInAttempt.status === 'complete') {
            await setActiveSignIn({ session: signInAttempt.createdSessionId });
            router.replace('/(tabs)');
            return;
          }
          if (signInAttempt.status === 'needs_first_factor') {
            const emailFactor = signInAttempt.supportedFirstFactors?.find(
              (f) => f.strategy === 'email_code'
            );
            if (emailFactor && 'emailAddressId' in emailFactor) {
              await signIn.prepareFirstFactor({
                strategy: 'email_code',
                emailAddressId: emailFactor.emailAddressId,
              });
              setSignInEmailAddressId(emailFactor.emailAddressId);
              setPendingSignInVerification(true);
              return;
            }
          }
        } catch (signInErr: any) {
          const signInErrCode: string = signInErr.errors?.[0]?.code || '';
          const signInMsg: string = signInErr.errors?.[0]?.message || '';
          if (signInErrCode === 'form_identifier_not_found') {
            // Email taken in Clerk but not findable via sign-in — unverified/orphaned account.
            Alert.alert(
              'Verification Required',
              'Your account needs email verification. Check your inbox for a verification link, or sign in with Google or Apple.',
              [{ text: 'OK', style: 'cancel' }]
            );
            return;
          }
          if (signInErrCode === 'form_password_incorrect' || signInMsg.toLowerCase().includes('password')) {
            Alert.alert(
              'Account Exists',
              "This email is already registered but the password doesn't match. Try \"Forgot Password\" or sign in with Google or Apple.",
              [
                { text: 'Forgot Password', onPress: () => { setIsRegister(false); setIsForgotPassword(true); } },
                { text: 'OK', style: 'cancel' },
              ]
            );
            return;
          }
        }
        // Fallback — couldn't auto-resolve
        Alert.alert('Account Exists', 'This email is already registered. Try signing in, or use Google or Apple.');
        return;
      }

      // Stale sign-up for the same email surfaced at create() time — resend code
      if (clerkMsg === 'Invalid action' || clerkCode === 'session_exists') {
        const staleEmail = signUp.emailAddress;
        if (staleEmail && staleEmail !== email) {
          Alert.alert(
            'Account Pending',
            `A previous sign-up for ${staleEmail} is still pending on this device. Please verify that account, or sign up with Google or Apple instead.`
          );
          return;
        }
        try {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
          return;
        } catch {
          Alert.alert('Sign Up Error', 'A previous sign-up is pending verification. Please check your email or try again shortly.');
          return;
        }
      }

      Alert.alert('Sign Up Error', clerkMsg || error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!signUpLoaded) return;

    if (!code) {
      Alert.alert('Error', 'Please enter verification code');
      return;
    }

    setLoading(true);
    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (signUpAttempt.status === 'complete') {
        await setActiveSignUp({ session: signUpAttempt.createdSessionId });
        router.replace('/onboarding');
      } else {
        console.error('Verification not complete:', signUpAttempt);
        Alert.alert('Error', 'Verification failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      Alert.alert('Verification Error', error.errors?.[0]?.message || error.message || 'Failed to verify email');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignIn = async () => {
    if (!signInLoaded || !code) return;
    setLoading(true);
    try {
      const result = isSecondFactor
        ? await signIn.attemptSecondFactor({ strategy: 'email_code', code })
        : await signIn.attemptFirstFactor({ strategy: 'email_code', code });
      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Verification failed. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Verification Error', error.errors?.[0]?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSignInCode = async () => {
    if (!signInLoaded || !signInEmailAddressId) return;
    setLoading(true);
    try {
      if (isSecondFactor) {
        await signIn.prepareSecondFactor({ strategy: 'email_code', emailAddressId: signInEmailAddressId });
      } else {
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: signInEmailAddressId });
      }
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Error', error.errors?.[0]?.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSignUpCode = async () => {
    if (!signUpLoaded) return;
    setLoading(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Error', error.errors?.[0]?.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!signInLoaded || !email) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setPendingReset(true);
    } catch (error: any) {
      Alert.alert('Error', error.errors?.[0]?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!signInLoaded || !resetCode || !newPassword) {
      Alert.alert('Error', 'Please enter the code and a new password');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });
      if (result.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Reset failed. Please try again.');
      }
    } catch (error: any) {
      const clerkCode = error.errors?.[0]?.code;
      const message =
        clerkCode === 'form_password_pwned'
          ? 'That password appears in a known data breach. Try a longer or more unique password (e.g. 3 random words + a number).'
          : error.errors?.[0]?.message || 'Failed to reset password';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'oauth_google' | 'oauth_apple') => {
    const key = provider === 'oauth_google' ? 'google' : 'apple';
    setSocialLoading(key);
    try {
      const redirectUrl = Linking.createURL('login');
      console.log(`[Social login ${key}] redirectUrl:`, redirectUrl);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: provider,
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Don't navigate manually — AuthGate watches isSignedIn and routes to
        // /(tabs) or /onboarding once the Clerk session (and its token) are ready.
        // Navigating here races ahead of token propagation and causes 401s.
      }
    } catch (error: any) {
      console.error(`[Social login ${key}] error:`, JSON.stringify(error?.errors ?? error?.message ?? error));
      const msg = error.errors?.[0]?.message || error.message || `Failed to sign in with ${key}`;
      Alert.alert('Sign In Error', msg);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = () => {
    if (pendingSignInVerification) {
      handleVerifySignIn();
    } else if (pendingVerification) {
      handleVerifyEmail();
    } else if (isRegister) {
      handleSignUp();
    } else {
      handleSignIn();
    }
  };

  // ── Forgot password: enter reset code + new password ──────────────────────
  if (isForgotPassword && pendingReset) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <OrThisLogo size={42} />
            <Text style={styles.subtitle}>Check your email for a reset code</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reset Code</Text>
              <TextInput
                style={styles.input}
                value={resetCode}
                onChangeText={setResetCode}
                placeholder="6-digit code"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 8 characters"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Resetting...' : 'Reset Password'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchButton} onPress={() => { setIsForgotPassword(false); setPendingReset(false); setResetCode(''); setNewPassword(''); }}>
              <Text style={styles.switchText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Forgot password: enter email ───────────────────────────────────────────
  if (isForgotPassword) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <OrThisLogo size={42} />
            <Text style={styles.subtitle}>Enter your email to reset your password</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Code'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchButton} onPress={() => setIsForgotPassword(false)}>
              <Text style={styles.switchText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Sign-in verification (unverified account) ─────────────────────────────
  if (pendingSignInVerification) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>We sent a verification code to {email}</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify Email'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={handleResendSignInCode}
              disabled={loading}
            >
              <Text style={styles.switchText}>Resend code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => { setPendingSignInVerification(false); setSignInEmailAddressId(null); setIsSecondFactor(false); setCode(''); }}
            >
              <Text style={styles.switchText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>
              We sent a code to {email}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Verifying...' : 'Verify Email'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={handleResendSignUpCode}
              disabled={loading}
            >
              <Text style={styles.switchText}>Resend code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                setPendingVerification(false);
                setCode('');
              }}
            >
              <Text style={styles.switchText}>
                Back to sign up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <OrThisLogo size={42} />
          <Text style={styles.subtitle}>
            {isRegister ? 'Create your account' : 'Welcome back'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Social Login Buttons */}
          <TouchableOpacity
            style={[styles.socialButton, styles.socialButtonGoogle, socialLoading === 'google' && styles.buttonDisabled]}
            onPress={() => handleSocialLogin('oauth_google')}
            disabled={socialLoading !== null}
            activeOpacity={0.8}
          >
            {socialLoading === 'google'
              ? <ActivityIndicator size="small" color={Colors.text} />
              : <Text style={styles.socialButtonTextDark}>Continue with Google</Text>
            }
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.socialButtonApple, socialLoading === 'apple' && styles.buttonDisabled]}
              onPress={() => handleSocialLogin('oauth_apple')}
              disabled={socialLoading !== null}
              activeOpacity={0.8}
            >
              {socialLoading === 'apple'
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.socialButtonTextLight}>Continue with Apple</Text>
              }
            </TouchableOpacity>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={isRegister ? 'Min 8 characters' : 'Your password'}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || !signInLoaded || !signUpLoaded}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Please wait...' : isRegister ? 'Sign Up' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {!isRegister && (
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsForgotPassword(true)}
            >
              <Text style={styles.switchText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsRegister(!isRegister)}
          >
            <Text style={styles.switchText}>
              {isRegister
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    fontFamily: Fonts.sans,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 0,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  switchButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  socialButton: {
    borderRadius: BorderRadius.sharp,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  socialButtonGoogle: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  socialButtonApple: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  socialButtonTextDark: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.text,
  },
  socialButtonTextLight: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
