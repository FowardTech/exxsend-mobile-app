/**
 * usePushNotifications Hook
 * 
 * Initializes push notifications, handles permissions, and manages notification listeners.
 * Should be called once at the app root level.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  removeNotificationSubscription,
} from '../services/pushNotifications';
import { useNotificationContext } from '../context/NotificationContext';

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isRegistered: boolean;
}

export function usePushNotifications() {
  const router = useRouter();
  const { refreshUnreadCount } = useNotificationContext();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // The notification listener below is subscribed once (on mount) and must
  // always call the *current* refreshUnreadCount, which itself is a new
  // function reference whenever the user's phone changes — so we read it
  // through a ref rather than closing over it directly in the effect.
  const refreshUnreadCountRef = useRef(refreshUnreadCount);
  useEffect(() => {
    refreshUnreadCountRef.current = refreshUnreadCount;
  }, [refreshUnreadCount]);

  const navigateFromNotificationData = (data: Record<string, any> | undefined | null) => {
    // Handle navigation based on notification type
    if (data?.type === 'settlement_complete' && data?.conversionId) {
      // Navigate to wallet or transaction detail
      router.push('/(tabs)');
    } else if (data?.type === 'rate_alert_triggered') {
      router.push({
        pathname: '/ratealerts',
        params: data?.alertId ? { highlightId: String(data.alertId) } : {},
      } as any);
    } else if (data?.transactionReference || data?.reference || data?.transactionId) {
      const ref = data.transactionReference || data.reference || data.transactionId;
      router.push({
        pathname: '/transactiondetail/[reference]',
        params: { reference: encodeURIComponent(String(ref)) },
      } as any);
    } else if (data?.type === 'kyc_approved') {
      router.push('/profile');
    } else if (data?.type === 'new_device_signin') {
      router.push('/managedevices' as any);
    }
  };

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        setIsRegistered(true);

        // Try to register with backend if user is logged in
        AsyncStorage.getItem('user_phone').then((phone) => {
          if (phone) {
            registerPushTokenWithBackend(phone);
          }
        });
      }
    });

    // Listen for incoming notifications (foreground)
    notificationListener.current = addNotificationReceivedListener(async (notification) => {
      // Sync the OS badge to the real unread count from the server rather than
      // trusting a possibly-stale/absolute `badge` field on the payload or
      // blindly incrementing — both can drift out of sync with reality.
      const freshCount = await refreshUnreadCountRef.current();
      await Notifications.setBadgeCountAsync(Math.max(0, freshCount));

      setNotification(notification);
    });

    // Listen for notification taps while the app is already running
    responseListener.current = addNotificationResponseListener((response) => {
      console.log('[PushNotifications] Response:', response);
      navigateFromNotificationData(response.notification.request.content.data);
    });

    // Cold start: the app may have been fully killed and launched BY the
    // user tapping a notification. That tap never reaches the listener
    // above — it's only retrievable here, once, on mount. Without this,
    // tapping a notification while the app is killed silently loses the
    // deep link and just opens to whatever the normal launch screen is.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log('[PushNotifications] Cold start from notification:', response);
        navigateFromNotificationData(response.notification.request.content.data);
      }
    });

    return () => {
      if (notificationListener.current) {
        removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router]);

  return {
    expoPushToken,
    notification,
    isRegistered,
  };
}

export default usePushNotifications;
