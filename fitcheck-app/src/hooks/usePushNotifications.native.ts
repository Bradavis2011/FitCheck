import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { pushNotificationService } from '../services/push.service';
import { useAuthStore } from '../stores/authStore';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { token: authToken, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!authToken || !user) {
      return;
    }

    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        pushNotificationService.registerToken(token, platform).catch((error) => {
          console.error('Failed to register push token:', error);
        });
      }
    });

    // Listen for incoming notifications (while app is foregrounded)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Handle notification taps — deep link to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        linkType?: string;
        linkId?: string;
      };

      if (data.type === 'event_followup' && data.linkId) {
        // Navigate to the outfit screen — EventFollowUpModal can be triggered there
        router.push(`/outfit/${data.linkId}` as any);
      } else if (data.type === 'style_narrative') {
        router.push('/(tabs)/profile' as any);
      } else if (data.type === 'milestone') {
        router.push('/(tabs)/profile' as any);
      } else if (data.linkType === 'outfit' && data.linkId) {
        router.push(`/outfit/${data.linkId}` as any);
      } else if (data.type === 'follow') {
        router.push('/(tabs)/community' as any);
      } else if (data.type === 'live') {
        router.push('/(tabs)/community' as any);
      }
    });

    return () => {
      if (notificationListener.current) {
        try {
          notificationListener.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (responseListener.current) {
        try {
          responseListener.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [authToken, user]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // Check if running on physical device
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission to send push notifications was denied');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id',
    });

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E85D4C',
      });
    }

    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}
