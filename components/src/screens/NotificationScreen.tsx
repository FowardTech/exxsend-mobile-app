import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import AppText from "../../AppText";
import BackButton from "../../BackButton";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScreenShell from "../../ScreenShell";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { 
  getNotifications, 
  markNotificationRead, 
  markAllNotificationsRead,
  Notification 
} from "../../../api/notifications";
import { useAutoPolling } from "../../../hooks/useAutoPolling";
import { useNotificationContext } from "../../../context/NotificationContext";

interface NotifRowProps {
  item: {
    id: string;
    type: any;
    icon: any;
    title: string;
    body: string;
    time: string;
    read: boolean;
    createdAt?: string;
    data?: any;
    category?: string;
  };
  onPress: () => void;
}

function NotifRow({ item, onPress }: NotifRowProps) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={styles.notifRow}>
      <View style={styles.notifLeft}>
        <View
          style={[
            styles.notifIconWrap,
            item.type === "success" && styles.notifIconSuccess,
            item.type === "warning" && styles.notifIconWarning,
            item.type === "info" && styles.notifIconInfo,
            item.type === "error" && styles.notifIconWarning,
          ]}
        >
          <AppText style={styles.notifIconText}>{item.icon}</AppText>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.notifTitleRow}>
            <AppText style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>
              {item.title}
            </AppText>
            {!item.read && <View style={styles.notifUnreadDot} />}
          </View>

          <AppText style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </AppText>

          <AppText style={styles.notifTime}>{item.time}</AppText>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

// Group notifications by date
function groupNotificationsByDate(notifications: Notification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sections: { section: string; items: Notification[] }[] = [];
  const groups: Record<string, Notification[]> = {};

  notifications.forEach((notif) => {
    const date = new Date(notif.createdAt);
    date.setHours(0, 0, 0, 0);

    let key: string;
    if (date.getTime() === today.getTime()) {
      key = "Today";
    } else if (date.getTime() === yesterday.getTime()) {
      key = "Yesterday";
    } else {
      key = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(notif);
  });

  // Order: Today, Yesterday, then older dates
  const orderedKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Yesterday") return -1;
    if (b === "Yesterday") return 1;
    return 0;
  });

  orderedKeys.forEach((key) => {
    sections.push({ section: key, items: groups[key] });
  });

  return sections;
}

// Format time for display
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function NotificationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const { decrementUnread, markAllAsRead, setUnreadCount } = useNotificationContext();
  const [filter, setFilter] = useState("All");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Get user phone on mount
  useEffect(() => {
    AsyncStorage.getItem("user_phone").then(setPhone);
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!phone) return;

    try {
      const response = await getNotifications(phone, { 
        perPage: 50,
        unreadOnly: filter === "Unread" 
      });
      
      if (response.success) {
        setNotifications(response.notifications);
        setError(null);
      } else {
        setError(response.message || "Failed to load notifications");
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phone, filter]);

  // Initial fetch
  useEffect(() => {
    if (phone) {
      setLoading(true);
      fetchNotifications();
    }
  }, [phone, filter]);

  // Auto-polling every 10 seconds
  useAutoPolling(fetchNotifications, {
    intervalMs: 15000,
    enabled: !!phone,
    fetchOnMount: false,
    pauseInBackground: true,
  });

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle notification tap - mark as read
  const handleNotificationPress = useCallback(async (notif: Notification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      // Update tab badge immediately
      decrementUnread();
    }
    
    // Deep-link to related transaction
    if (notif.data?.transactionReference || notif.data?.reference) {
      const ref = notif.data.transactionReference || notif.data.reference;
      router.push({
        pathname: "/transactiondetail/[reference]",
        params: { reference: encodeURIComponent(String(ref)) },
      } as any);
    } else if (notif.data?.transactionId) {
      router.push({
        pathname: "/transactiondetail/[reference]",
        params: { reference: encodeURIComponent(String(notif.data.transactionId)) },
      } as any);
    }
  }, [router, decrementUnread]);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (!phone) return;
    
    const result = await markAllNotificationsRead(phone);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      // Update tab badge immediately
      markAllAsRead();
    }
  }, [phone, markAllAsRead]);

  // Transform and group notifications
  const visibleSections = useMemo(() => {
    const filtered = filter === "Unread" 
      ? notifications.filter((n) => !n.read)
      : notifications;

    return groupNotificationsByDate(filtered);
  }, [notifications, filter]);

  const unreadCount = useMemo(() => 
    notifications.filter((n) => !n.read).length, 
    [notifications]
  );

  return (
    <ScreenShell padded={false} scrollable={false}>
      {/* Header */}
        <View style={styles.notifHeader}>
          <BackButton onPress={() => router.back()} />

          <AppText style={styles.notifHeaderTitle}>Notifications</AppText>

          <Pressable 
            onPress={handleMarkAllRead} 
            style={styles.notifHeaderAction}
            disabled={unreadCount === 0}
          >
            <AppText style={[
              styles.notifHeaderActionText,
              unreadCount === 0 && { opacity: 0.4 }
            ]}>
              Mark all
            </AppText>
          </Pressable>
        </View>

        {/* Filters */}
        <View style={styles.notifFiltersRow}>
          {["All", "Unread"].map((x) => {
            const active = x === filter;
            return (
              <Pressable
                key={x}
                onPress={() => setFilter(x)}
                style={[styles.notifFilterPill, active && styles.notifFilterPillActive]}
              >
                <AppText style={[styles.notifFilterText, active && styles.notifFilterTextActive]}>
                  {x}
                  {x === "Unread" && unreadCount > 0 && ` (${unreadCount})`}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Loading state */}
        {loading && notifications.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText style={{ marginTop: 12, color: colors.gray }}>Loading notifications...</AppText>
          </View>
        ) : error && notifications.length === 0 ? (
          <View style={styles.notifEmpty}>
            <Ionicons name="alert-circle-outline" size={26} color={colors.muted} />
            <AppText style={styles.notifEmptyTitle}>Something went wrong</AppText>
            <AppText style={styles.notifEmptySub}>{error}</AppText>
            <Pressable onPress={fetchNotifications} style={{ marginTop: 16 }}>
              <AppText style={{ color: colors.primary, fontWeight: "600" }}>Try again</AppText>
            </Pressable>
          </View>
        ) : (
          <ScrollView 
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {visibleSections.length === 0 ? (
              <View style={styles.notifEmpty}>
                <Ionicons name="notifications-off-outline" size={26} color={colors.muted} />
                <AppText style={styles.notifEmptyTitle}>No notifications</AppText>
                <AppText style={styles.notifEmptySub}>
                  You're all caught up. New alerts will appear here.
                </AppText>
              </View>
            ) : (
              visibleSections.map((section) => (
                <View key={section.section} style={{ marginTop: 14 }}>
                  <AppText style={styles.notifSectionTitle}>{section.section}</AppText>

                  <View style={styles.notifCard}>
                    {section.items.map((item, idx) => (
                      <View key={item.id}>
                        <NotifRow
                          item={{
                            id: item.id,
                            type: item.category,
                            icon: item.icon,
                            title: item.title,
                            body: item.body,
                            time: formatTime(item.createdAt),
                            read: item.read,
                          }}
                          onPress={() => handleNotificationPress(item)}
                        />
                        {idx !== section.items.length - 1 && <View style={styles.notifDivider} />}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
    </ScreenShell>
  );
}