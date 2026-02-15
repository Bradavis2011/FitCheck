import { useState } from 'react';

// Web stub - push notifications not supported on web
export function usePushNotifications() {
  const [expoPushToken] = useState<string | null>(null);
  const [notification] = useState<any>(null);

  // No-op on web
  return {
    expoPushToken,
    notification,
  };
}
