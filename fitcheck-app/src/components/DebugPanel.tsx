import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useSegments } from 'expo-router';
import { Colors, Spacing, FontSize, Fonts } from '../constants/theme';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';

export function DebugPanel() {
  const { isAuthenticated, hasCompletedOnboarding, user } = useAuthStore();
  const segments = useSegments();
  const [isVisible, setIsVisible] = useState(true);

  const handleResetOnboarding = async () => {
    await SecureStore.deleteItemAsync('orthis_onboarding_completed');
    alert('Onboarding flag cleared! Restart app to see onboarding.');
  };

  const handleSetOnboarding = async () => {
    await SecureStore.setItemAsync('orthis_onboarding_completed', 'true');
    alert('Onboarding flag set to true! Restart app.');
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.toggleButtonText}>🐛</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🐛 Debug Panel</Text>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <DebugRow label="Authenticated" value={isAuthenticated ? '✅ YES' : '❌ NO'} />
        <DebugRow label="Onboarding Done" value={hasCompletedOnboarding ? '✅ YES' : '❌ NO'} />
        <DebugRow label="Current Route" value={segments.join('/') || '/'} />
        <DebugRow label="User Email" value={user?.email || 'none'} />
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.buttonReset]}
          onPress={handleResetOnboarding}
        >
          <Text style={styles.buttonText}>Clear Onboarding</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSet]}
          onPress={handleSetOnboarding}
        >
          <Text style={styles.buttonText}>Set Onboarding</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00ff00',
    padding: 10,
    minWidth: 280,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.sansBold,
    color: '#00ff00',
    fontSize: 14,
  },
  closeButton: {
    fontFamily: Fonts.sansBold,
    color: '#00ff00',
    fontSize: 18,
  },
  content: {
    gap: 6,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#888',
    fontSize: 12,
  },
  value: {
    fontFamily: Fonts.sansSemiBold,
    color: '#fff',
    fontSize: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonReset: {
    backgroundColor: '#ff4444',
  },
  buttonSet: {
    backgroundColor: '#4444ff',
  },
  buttonText: {
    fontFamily: Fonts.sansSemiBold,
    color: '#fff',
    fontSize: 11,
  },
  toggleButton: {
    position: 'absolute',
    top: 50,
    right: 10,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00ff00',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toggleButtonText: {
    fontSize: 20,
  },
});
