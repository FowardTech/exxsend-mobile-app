import React, { useState, useCallback, useEffect } from "react";
import { View, Pressable, ActivityIndicator, Alert, StyleSheet, StatusBar, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../../../theme/colors";
import ScreenHeader from "../../../components/ScreenHeader";
import PinVerificationModal from "../../../components/PinVerificationModal";
import { lookupExxsendMember, sendToExxsendMember } from "../../../api/config";

interface Member {
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export default function ExxsendMembersScreen() {
  const router = useRouter();
  // scannedUsername arrives from ScanToPayScreen after decoding another
  // member's QR "pay code" — when present, we skip straight to looking
  // that member up instead of waiting for manual entry.
  const params = useLocalSearchParams<{ fromCurrency?: string; fromAmount?: string; scannedUsername?: string }>();

  const [userPhone, setUserPhone]     = useState("");
  const [username, setUsername]       = useState(params.scannedUsername ? String(params.scannedUsername).replace(/^@/, "") : "");
  const [member, setMember]           = useState<Member | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [notFound, setNotFound]       = useState(false);
  const [amount, setAmount]           = useState(params.fromAmount || "");
  const [note, setNote]               = useState("");
  const [sending, setSending]         = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const getInitials = (m: Member) =>
    `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`.toUpperCase() || m.username[0]?.toUpperCase() || "?";

  const handleLookup = useCallback(async (lookupUsername?: string) => {
    const u = (lookupUsername ?? username).trim().replace(/^@/, "");
    if (!u || u.length < 3) { Alert.alert("Enter username", "Please enter a valid Exxsend username."); return; }
    setLookupLoading(true);
    setMember(null);
    setNotFound(false);
    try {
      // Passing our own phone lets the backend exclude ourselves from the
      // result, so scanning/typing your own handle correctly comes back
      // not-found instead of letting you "send" to yourself.
      const res = await lookupExxsendMember(u, userPhone || undefined);
      if (res?.success && res.member) {
        setMember(res.member);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLookupLoading(false);
    }
  }, [username, userPhone]);

  // Load the sender's phone once on mount, then — if we arrived here from a
  // QR scan — immediately look up the scanned username automatically rather
  // than making the user retype it and tap "Find" themselves.
  useEffect(() => {
    (async () => {
      const phone = (await AsyncStorage.getItem("user_phone")) || "";
      setUserPhone(phone);
      if (params.scannedUsername) {
        handleLookup(String(params.scannedUsername));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(() => {
    if (!member || !amount || parseFloat(amount) <= 0) {
      Alert.alert("Enter amount", "Please enter a valid amount to send.");
      return;
    }
    setShowPinModal(true);
  }, [member, amount]);

  const performSend = useCallback(async (pin?: string) => {
    if (!member || !pin) return;
    setSending(true);
    try {
      const res = await sendToExxsendMember({
        phone: userPhone,
        toUsername: member.username,
        currency: params.fromCurrency || "CAD",
        amount: parseFloat(amount),
        pin,
        note: note.trim() || undefined,
      });
      if (res?.success) {
        Alert.alert("Sent! 🎉", `Successfully sent ${params.fromCurrency || "CAD"} ${amount} to @${member.username}`, [
          { text: "Done", onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        Alert.alert("Failed", res?.message || "Could not complete the transfer.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }, [member, amount, note, userPhone, params, router]);

  const canSend = !!member && !!amount && parseFloat(amount) > 0 && !sending;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="Send to Exxsend Member" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Info banner */}
          <View style={s.infoBanner}>
            <Ionicons name="people-outline" size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
            <AppText style={s.infoText}>Send money instantly to any Exxsend member using their @username — no bank details needed.</AppText>
          </View>

          {/* Username input */}
          <AppText style={s.fieldLabel}>Exxsend Username</AppText>
          <View style={s.usernameRow}>
            <View style={s.atWrap}><AppText style={s.at}>@</AppText></View>
            <AppTextInput
              value={username}
              onChangeText={t => { setUsername(t); setMember(null); setNotFound(false); }}
              placeholder="username"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={s.usernameInput}
              onSubmitEditing={() => handleLookup()}
              returnKeyType="search"
            />
            <Pressable
              onPress={() => handleLookup()}
              disabled={lookupLoading || username.trim().length < 3}
              style={[s.lookupBtn, (lookupLoading || username.trim().length < 3) && { opacity: 0.45 }]}
            >
              {lookupLoading
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <AppText style={s.lookupBtnText}>Find</AppText>
              }
            </Pressable>
          </View>

          {/* Not found */}
          {notFound && (
            <View style={s.notFoundBox}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} style={{ marginRight: 8 }} />
              <AppText style={s.notFoundText}>No Exxsend member found with that username.</AppText>
            </View>
          )}

          {/* Member found card */}
          {member && (
            <View style={s.memberCard}>
              <View style={s.memberAvatar}>
                <AppText style={s.memberInitials}>{getInitials(member)}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.memberName}>{member.firstName} {member.lastName}</AppText>
                <AppText style={s.memberUsername}>@{member.username}</AppText>
              </View>
              <View style={s.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                <AppText style={s.verifiedText}>Verified</AppText>
              </View>
            </View>
          )}

          {/* Amount */}
          {member && (
            <>
              <AppText style={s.fieldLabel}>Amount ({params.fromCurrency || "CAD"})</AppText>
              <View style={s.amountBox}>
                <AppText style={s.currencySymbol}>{params.fromCurrency || "CAD"}</AppText>
                <AppTextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  style={s.amountInput}
                />
              </View>

              <AppText style={s.fieldLabel}>Note (optional)</AppText>
              <View style={s.noteBox}>
                <AppTextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="What's this for?"
                  placeholderTextColor={COLORS.muted}
                  style={s.noteInput}
                  multiline
                  maxLength={100}
                />
              </View>

              <View style={s.rateNote}>
                <Ionicons name="flash-outline" size={14} color={COLORS.green} style={{ marginRight: 6 }} />
                <AppText style={s.rateNoteText}>Transfers between Exxsend members are instant and free.</AppText>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {member && (
        <View style={s.footer}>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={[s.sendBtn, !canSend && { opacity: 0.45 }]}
          >
            {sending
              ? <ActivityIndicator color={COLORS.actionText} />
              : <AppText style={s.sendBtnText}>Send {params.fromCurrency || ""} {amount || "0.00"} to @{member.username}</AppText>
            }
          </Pressable>
        </View>
      )}

      <PinVerificationModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={performSend}
        title="Confirm Transfer"
        subtitle={member ? `Enter your PIN to send ${params.fromCurrency || "CAD"} ${amount || "0.00"} to @${member.username}` : undefined}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 32 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 14, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: "600", lineHeight: 19 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 8, marginTop: 18 },
  usernameRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden" },
  atWrap: { paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: COLORS.borderLight },
  at: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  usernameInput: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text, paddingHorizontal: 12, paddingVertical: 14 },
  lookupBtn: { margin: 6, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  lookupBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  notFoundBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginTop: 10 },
  notFoundText: { flex: 1, fontSize: 13, color: COLORS.red, fontWeight: "600" },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.greenLight,},
  memberAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  memberInitials: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  memberUsername: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 12, fontWeight: "700", color: COLORS.green },
  amountBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 54 },
  currencySymbol: { fontSize: 15, fontWeight: "700", color: COLORS.muted, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "700", color: COLORS.text },
  noteBox: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80 },
  noteInput: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  rateNote: { flexDirection: "row", alignItems: "center", marginTop: 14, backgroundColor: COLORS.greenSoft, borderRadius: 10, padding: 12 },
  rateNoteText: { flex: 1, fontSize: 12, color: COLORS.green, fontWeight: "600" },
  footer: { padding: 20, paddingBottom: 32, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
  sendBtn: { backgroundColor: COLORS.actionBg, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  sendBtnText: { color: COLORS.actionText, fontSize: 15, fontWeight: "700" },
});
