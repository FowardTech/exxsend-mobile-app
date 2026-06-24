/**
 * Support Chat API utility
 * Centralized data fetching for user ↔ admin live chat
 */
import { API_BASE_URL } from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderType: "user" | "admin";
  senderId: number;
  senderName?: string;
  text: string;
  fileUrl?: string | null;
  fileName?: string | null;
  read: boolean;
  createdAt: string;
}

export interface SupportConversation {
  id: string;
  userId: number;
  status: string;
  assignedAdminId: string | null;
  unreadUser: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export async function getUserPhone(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("user_phone");
  } catch {
    return null;
  }
}

export async function getOrCreateConversation(phone: string): Promise<SupportConversation | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/support-chat/user/conversation?phone=${encodeURIComponent(phone)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("[SupportChat] Failed to get conversation:", error);
    return null;
  }
}

export async function getUserMessages(
  phone: string,
  conversationId?: string,
  since?: string
): Promise<{ messages: ChatMessage[]; conversationId: string | null }> {
  try {
    const params = new URLSearchParams();
    if (conversationId) params.append("conversation_id", conversationId);
    else params.append("phone", phone);
    if (since) params.append("since", since);

    const res = await fetch(
      `${API_BASE_URL}/support-chat/user/messages?${params.toString()}`
    );
    if (!res.ok) return { messages: [], conversationId: null };
    return await res.json();
  } catch (error) {
    console.error("[SupportChat] Failed to fetch messages:", error);
    return { messages: [], conversationId: null };
  }
}

export async function sendUserMessage(
  phone: string,
  text: string
): Promise<{ success: boolean; message?: ChatMessage }> {
  try {
    const res = await fetch(`${API_BASE_URL}/support-chat/user/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, text }),
    });
    return await res.json();
  } catch (error) {
    console.error("[SupportChat] Failed to send message:", error);
    return { success: false };
  }
}

/**
 * Upload a file or image as a chat message
 */
export async function sendUserAttachment(
  phone: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  text?: string
): Promise<{ success: boolean; message?: ChatMessage }> {
  try {
    const formData = new FormData();
    formData.append("phone", phone);
    if (text) formData.append("text", text);
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const res = await fetch(`${API_BASE_URL}/support-chat/user/upload`, {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type header — fetch sets it with boundary automatically
    });
    return await res.json();
  } catch (error) {
    console.error("[SupportChat] Failed to upload file:", error);
    return { success: false };
  }
}
