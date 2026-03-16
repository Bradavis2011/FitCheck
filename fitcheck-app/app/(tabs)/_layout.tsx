import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Colors, Fonts } from '../../src/constants/theme';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';

function SessionTimer() {
  const { sessionExpiresAt, isSessionActive } = useSubscriptionStore();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isSessionActive || !sessionExpiresAt) {
      setLabel(null);
      return;
    }
    const update = () => {
      const msLeft = sessionExpiresAt.getTime() - Date.now();
      if (msLeft <= 0) { setLabel(null); return; }
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      setLabel(`Your session · ${hoursLeft}h remaining`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [sessionExpiresAt, isSessionActive]);

  if (!label) return null;

  return (
    <View style={sessionTimerStyles.container}>
      <Text style={sessionTimerStyles.text}>{label}</Text>
    </View>
  );
}

const sessionTimerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: Colors.white,
  },
  text: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <SessionTimer />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: 'rgba(0,0,0,0.12)',
          borderTopWidth: 1,
          height: 85 + Math.round(insets.bottom * 0.75),
          paddingBottom: Math.round(insets.bottom * 0.75) + 4,
          paddingTop: 8,
          // sharp top border — no rounding per editorial spec
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: Fonts.sansMedium,
          fontSize: 10,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={24} color={Colors.white} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Archive',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // accessed via avatar button in home header
        }}
      />
      {/* Community tab hidden — underbuilt at launch */}
      <Tabs.Screen
        name="community"
        options={{
          href: null, // exclude from tab bar
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraButton: {
    width: 56,
    height: 56,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -24,
  },
});
