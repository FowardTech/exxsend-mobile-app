import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../../../../api/config";
import {
  getOrCreateConversation,
  getUserMessages,
  getUserPhone,
  sendUserAttachment,
  sendUserMessage,
} from "../../../../api/supportchat";
import { COLORS } from "../../../../theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS } from "../../../../theme/designSystem";
import AppText from "../../../AppText";
import AppTextInput from "../../../AppTextInput";
import BackButton from "../../../BackButton";

const POLL_INTERVAL = 3000;

type UIMessage = {
  id: string;
  text?: string;
  image?: string;
  file?: { name: string; uri: string };
  sender: "user" | "support";
  time: string;
};

export default function CustomerSupportChat() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    type: "image" | "file";
  } | null>(null);

  const lastTimestamp = useRef<string | null>(null);
  const hasSentToday = useRef(false);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const normalizeUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const isImageFile = (name?: string) =>
    !!name && /\.(png|jpe?g|gif|webp)$/i.test(name);

  const mapApiMessage = (msg: any): UIMessage => {
    const fileUrl = normalizeUrl(
      msg.fileUrl || msg.file_url || msg.attachmentUrl
    );

    const fileName =
      msg.fileName || msg.file_name || msg.name || "Attachment";

    const base: UIMessage = {
      id: msg.id,
      text: msg.text || undefined,
      sender: msg.senderType === "admin" ? "support" : "user",
      time: formatTime(msg.createdAt),
    };

    if (fileUrl) {
      if (isImageFile(fileName)) {
        base.image = fileUrl;
      } else {
        base.file = { name: fileName, uri: fileUrl };
      }
    }

    return base;
  };

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    (async () => {
      try {
        const userPhone = await getUserPhone();
        if (!userPhone) return;
        setPhone(userPhone);

        const conv = await getOrCreateConversation(userPhone);
        if (!conv) return;

        setConversationId(conv.id);

        const res = await getUserMessages(userPhone, conv.id);

        if (res.messages.length) {
          setMessages(res.messages.map(mapApiMessage));
          lastTimestamp.current =
            res.messages[res.messages.length - 1].createdAt;
        } else {
          setMessages([
            {
              id: "welcome",
              text: "Hi there 👋 How can we help you today?",
              sender: "support",
              time: formatTime(new Date().toISOString()),
            },
          ]);
        }
      } catch (e) {
        console.log("Chat init error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------- POLLING ---------------- */

  useEffect(() => {
    if (!phone || !conversationId) return;

    const interval = setInterval(async () => {
      const res = await getUserMessages(
        phone,
        conversationId,
        lastTimestamp.current || undefined
      );

      if (res.messages.length) {
        const mapped = res.messages.map(mapApiMessage);

        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const unique = mapped.filter((m) => !existing.has(m.id));
          return unique.length ? [...prev, ...unique] : prev;
        });

        lastTimestamp.current =
          res.messages[res.messages.length - 1].createdAt;

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [phone, conversationId]);

  /* ---------------- SEND ---------------- */

  const handleSend = async () => {
    if ((!input.trim() && !pendingAttachment) || !phone) return;

    const tempId = Date.now().toString();
    setSending(true);

    const optimistic: UIMessage = {
      id: tempId,
      text: input.trim() || undefined,
      image:
        pendingAttachment?.type === "image"
          ? pendingAttachment.uri
          : undefined,
      file:
        pendingAttachment?.type === "file"
          ? { name: pendingAttachment.name, uri: pendingAttachment.uri }
          : undefined,
      sender: "user",
      time: formatTime(new Date().toISOString()),
    };

    setMessages((prev) => [...prev, optimistic]);
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      let res;

      if (pendingAttachment) {
        res = await sendUserAttachment(
          phone,
          pendingAttachment.uri,
          pendingAttachment.name,
          pendingAttachment.mimeType
        );
      } else {
        res = await sendUserMessage(phone, input.trim());
      }

      if (res?.success && res.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? mapApiMessage(res.message) : m
          )
        );
        lastTimestamp.current = res.message.createdAt;
      }
    } catch {
      Alert.alert("Send failed");
    }

    setInput("");
    setPendingAttachment(null);
    setSending(false);
  };

  /* ---------------- PICK IMAGE ---------------- */

  const handlePickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    setPendingAttachment({
      uri: asset.uri,
      name: asset.fileName || `image_${Date.now()}.jpg`,
      mimeType: asset.mimeType || "image/jpeg",
      type: "image",
    });
  };

  /* ---------------- PICK FILE ---------------- */

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    setPendingAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || "application/octet-stream",
      type: "file",
    });
  };

  /* ---------------- RENDER ---------------- */

  const renderMessage = ({ item }: { item: UIMessage }) => {
    const isUser = item.sender === "user";
    const hasContent = item.text || item.image || item.file;
    if (!hasContent) return null;

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.supportRow,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.supportBubble,
          ]}
        >
          {item.text && (
            <AppText
              style={[
                styles.messageText,
                isUser && { color: "#fff" },
              ]}
            >
              {item.text}
            </AppText>
          )}

          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          )}

          {item.file && (
            <Pressable
              style={styles.fileRow}
              onPress={() => Linking.openURL(item.file!.uri)}
            >
              <Ionicons
                name="document-attach-outline"
                size={18}
                color={isUser ? "#fff" : COLORS.primary}
              />
              <AppText
                style={[
                  styles.fileName,
                  isUser && { color: "#fff" },
                ]}
                numberOfLines={1}
              >
                {item.file.name}
              </AppText>
            </Pressable>
          )}

          <AppText
            style={[
              styles.timeText,
              isUser && { color: "rgba(255,255,255,0.7)" },
            ]}
          >
            {item.time}
          </AppText>
        </View>
      </View>
    );
  };

  /* ---------------- UI ---------------- */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />

        <View style={{ flex: 1, alignItems: "center" }}>
          <AppText style={styles.headerTitle}>Support</AppText>
          <AppText style={styles.headerSubtitle}>Online</AppText>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          {pendingAttachment && (
            <View style={styles.previewBar}>
              {pendingAttachment.type === "image" ? (
                <Image
                  source={{ uri: pendingAttachment.uri }}
                  style={styles.previewImage}
                />
              ) : (
                <View style={styles.previewFile}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <AppText numberOfLines={1}>
                    {pendingAttachment.name}
                  </AppText>
                </View>
              )}

              <Pressable onPress={() => setPendingAttachment(null)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </Pressable>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Pressable onPress={handlePickImage}>
              <Ionicons name="image-outline" size={22} color={COLORS.primary} />
            </Pressable>

            <Pressable onPress={handlePickFile} style={{ marginLeft: 8 }}>
              <Ionicons name="attach-outline" size={22} color={COLORS.primary} />
            </Pressable>

            <AppTextInput
              placeholder="Type your message..."
              value={input}
              onChangeText={setInput}
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />

            <Pressable
              style={styles.sendBtn}
              onPress={handleSend}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  headerSubtitle: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageRow: { marginBottom: 12, flexDirection: "row" },
  userRow: { justifyContent: "flex-end" },
  supportRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "75%", padding: 12, borderRadius: 18 },
  userBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 6 },
  supportBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  timeText: { fontSize: 10, marginTop: 6 },
  imagePreview: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginTop: 8,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  fileName: { marginLeft: 6, fontSize: 13, fontWeight: "600" },
  previewBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    ...GLASS_BORDER,
    ...CARD_SHADOW,
    justifyContent: "space-between",
  },
  previewImage: { width: 60, height: 60, borderRadius: 10 },
  previewFile: { flexDirection: "row", alignItems: "center" },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#EEF2F7",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 8,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
});