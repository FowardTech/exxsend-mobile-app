import { Platform } from "react-native";
import { strictAPICall, TransactionError } from "../utils/networkGuard";

const API_BASE_URL =
  Platform.OS === "android"
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID || "http://10.0.2.2:5000/api"
    : process.env.EXPO_PUBLIC_API_BASE_URL_IOS || "http://127.0.0.1:5000/api";

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  category?: "success" | "warning" | "info" | "error" | string;
  icon?: string;
  data?: any;
}

export type NotificationsResponse = {
  unreadCount?: number;
  success: boolean;
  notifications: Notification[];
  message?: string;
  code?: string;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
};

function mapErr(err: any, fallback: string): NotificationsResponse {
  if (err instanceof TransactionError) {
    return {
      success: false,
      notifications: [],
      message: err.message,
      code: err.code,
      isNetworkError: err.isNetworkError,
      isTimeoutError: err.isTimeoutError,
    };
  }
  return { success: false, notifications: [], message: fallback, code: "UNKNOWN_ERROR" };
}

function normalizeNotif(n: any): Notification {
  return {
    id: String(n.id ?? n._id ?? ""),
    title: String(n.title ?? "Notification"),
    body: String(n.body ?? n.message ?? ""),
    read: Boolean(n.read ?? false),
    createdAt: String(n.created_at ?? n.createdAt ?? new Date().toISOString()),
    readAt: n.read_at ?? n.readAt ?? null,
    category: n.category ?? n.type ?? "info",
    icon: n.icon ?? "🔔",
    data: n.data ?? {},
  };
}

/**
 * GET notifications for a user
 */
export async function getNotifications(
  phone: string,
  opts?: { page?: number; perPage?: number; unreadOnly?: boolean }
): Promise<NotificationsResponse> {
  try {
    const page = opts?.page ?? 1;
    const perPage = opts?.perPage ?? 50;
    const unreadOnly = opts?.unreadOnly ?? false;

    const url =
      `${API_BASE_URL}/notifications?phone=${encodeURIComponent(phone)}` +
      `&page=${page}&perPage=${perPage}` +
      (unreadOnly ? `&unreadOnly=true` : "");

    // ✅ strictAPICall prevents "Unexpected end of input" by:
    // - checking network
    // - handling timeouts
    // - validating JSON safely
    const data = await strictAPICall<any>(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: "Fetch notifications",
      validateSuccess: false,
    });

    const listRaw = Array.isArray(data?.notifications)
      ? data.notifications
      : Array.isArray(data?.data)
      ? data.data
      : [];

    // This was the actual bug: unreadCount was never read from the response
    // at all, so every call to this function silently returned undefined
    // for it — which NotificationContext.tsx's refreshUnreadCount then
    // coerced to 0 via `Number(response.unreadCount ?? 0)`, forcibly
    // resetting the badge to zero on every single poll, foreground-resume,
    // and incoming push notification, regardless of the real count.
    const rawUnread = data?.unreadCount ?? data?.unread_count ?? data?.unreadTotal;
    const unreadCount = typeof rawUnread === "number" ? rawUnread : typeof rawUnread === "string" && !isNaN(Number(rawUnread)) ? Number(rawUnread) : undefined;

    return {
      success: !!data?.success,
      notifications: listRaw.map(normalizeNotif),
      unreadCount,
      message: data?.message,
    };
  } catch (err) {
    return mapErr(err, "Failed to fetch notifications. Please check your network and try again.");
  }
}

/**
 * Mark one notification as read
 */
export async function markNotificationRead(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const url = `${API_BASE_URL}/notifications/${encodeURIComponent(id)}/read`;

    const data = await strictAPICall<any>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeoutMs: 10000,
      context: "Mark notification read",
      validateSuccess: false,
    });

    return { success: !!data?.success, message: data?.message };
  } catch (err) {
    const mapped = mapErr(err, "Failed to mark as read");
    return { success: false, message: mapped.message };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(phone: string): Promise<{ success: boolean; message?: string }> {
  try {
    const url = `${API_BASE_URL}/notifications/read-all`;

    const data = await strictAPICall<any>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      timeoutMs: 12000,
      context: "Mark all notifications read",
      validateSuccess: false,
    });

    return { success: !!data?.success, message: data?.message };
  } catch (err) {
    const mapped = mapErr(err, "Failed to mark all as read");
    return { success: false, message: mapped.message };
  }
}
