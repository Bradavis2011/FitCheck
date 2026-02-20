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
import { useSignIn, useSignUp, useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import OrThisLogo from '../src/components/OrThisLogo';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';

export default function LoginScreen() {
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { signOut } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Intercept Android hardware back during email verification or password reset
  useEffect(() => {
    if (!pendingVerification && !isForgotPassword) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pendingVerification) { setPendingVerification(false); setCode(''); }
      if (isForgotPassword) { setIsForgotPassword(false); setPendingReset(false); setResetCode(''); setNewPassword(''); }
      return true;
    });
    return () => handler.remove();
  }, [pendingVerification, isForgotPassword]);

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
      } else {
        console.error('Sign in not complete:', signInAttempt);
        Alert.alert('Error', 'Sign in failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      Alert.alert('Sign In Error', error.errors?.[0]?.message || error.message || 'Failed to sign in');
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
      Alert.alert('Sign Up Error', error.errors?.[0]?.message || error.message || 'Failed to sign up');
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
      Alert.alert('Error', error.errors?.[0]?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (pendingVerification) {
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
    fontSize: 48,
    fontWeight: 'bold',
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
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
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
});
