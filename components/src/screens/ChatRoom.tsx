import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../theme/styles";
import { COLORS } from "../../../theme/colors";

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    role: "support",
    text: "Hi 👋 Welcome to support. How can we help you today?",
    time: "10:02",
  },
  {
    id: "2",
    role: "user",
    text: "Hi, I’m having issues converting currencies.",
    time: "10:03",
  },
  {
    id: "3",
    role: "support",
    text: "No problem. Which currency are you converting from, and which one to?",
    time: "10:03",
  },
];

interface Message {
  id: string;
  role: "user" | "support";
  text: string;
  time: string;
}
interface SupportChatScreenProps {
  messages: Message[];
  onSendMessage: (message: Message) => void;
}
export default function SupportChatScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<Message> | null>(null);

  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [text, setText] = useState("");

  const quickActions = useMemo(
    () => [
      { id: "qa1", label: "KYC status", value: "Hi, can you help me check my KYC status?" },
      { id: "qa2", label: "Exchange rates", value: "How do you calculate the exchange rate in the app?" },
      { id: "qa3", label: "Convert issue", value: "My currency conversion is failing. Can you help?" },
    ],
    []
  );

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current?.scrollToEnd) listRef.current.scrollToEnd({ animated: true });
    }, 50);
  };

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMsg: Message = {
      id: String(Date.now()),
      role: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setText("");
    scrollToBottom();

    // (Optional demo) auto support reply
    setTimeout(() => {
      const reply: Message = {
        id: String(Date.now() + 1),
        role: "support",
        text: "Thanks. A support agent will respond shortly. ✅",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, reply]);
      scrollToBottom();
    }, 800);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.chatRow, isUser ? styles.chatRowRight : styles.chatRowLeft]}>
        {!isUser ? (
          <View style={styles.chatAvatar}>
            <Ionicons name="headset-outline" size={16} color="#111827" />
          </View>
        ) : (
          <View style={{ width: 34 }} />
        )}

        <View style={[styles.chatBubble, isUser ? styles.chatBubbleUser : styles.chatBubbleSupport]}>
          <AppText style={[styles.chatText, isUser ? styles.chatTextUser : styles.chatTextSupport]}>
            {item.text}
          </AppText>
          <AppText style={[styles.chatTime, isUser ? styles.chatTimeUser : styles.chatTimeSupport]}>
            {item.time}
          </AppText>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {/* Header */}
        <View style={styles.chatHeader}>
          <Pressable onPress={() => router.back()} style={styles.chatHeaderBack}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>

          <View style={{ flex: 1 }}>
            <AppText style={styles.chatHeaderTitle}>Support</AppText>
            <View style={styles.chatHeaderSubRow}>
              <View style={styles.chatOnlineDot} />
              <AppText style={styles.chatHeaderSubtitle}>Online • replies usually under 5 min</AppText>
            </View>
          </View>

          <Pressable style={styles.chatHeaderIconBtn} onPress={() => {}}>
            <Ionicons name="information-circle-outline" size={22} color="#111827" />
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={styles.chatQuickWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={quickActions}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.chatQuickPill}
                onPress={() => {
                  setText(item.value);
                }}
              >
                <AppText style={styles.chatQuickText}>{item.label}</AppText>
              </Pressable>
            )}
          />
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.chatListContent}
          onContentSizeChange={scrollToBottom}
        />

        {/* Input bar */}
        <View style={styles.chatComposerWrap}>
          <Pressable style={styles.chatAttachBtn} onPress={() => {}}>
            <Ionicons name="add" size={22} color="#111827" />
          </Pressable>

          <View style={styles.chatInputBox}>
            <AppTextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor="#9CA3AF"
              style={styles.chatInput}
              multiline
            />
          </View>

          <Pressable
            style={[styles.chatSendBtn, !text.trim() && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
