import { getUserWallets, lookupExxsendMember } from "@/api/config";
import { createMoneyRequest } from "@/api/moneyRequests";
import AppText from "@/components/AppText";
import AppTextInput from "@/components/AppTextInput";
import BackButton from "@/components/BackButton";
import CurrencyPickerModal, { Wallet } from "@/components/CurrencyPickerModal";
import { COLORS } from "@/theme/colors";
import { GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RequestMoneyScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Recipient — either a phone number directly, or an @username that gets
  // looked up (mirrors ExxsendMembersScreen.tsx's pattern) to confirm who
  // it is and grab their actual phone number.
  const [recipientInput, setRecipientInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundMember, setFoundMember] = useState<{ username: string; firstName: string; lastName: string; phone?: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = (await AsyncStorage.getItem("user_phone")) || "";
      setPhone(p);
      if (p) {
        const res = await getUserWallets(p);
        if (res.success) {
          const active = res.wallets.filter((w: Wallet) => w.status === "active");
          setWallets(active);
          setSelectedWallet(active[0] || null);
        }
      }
    })();
  }, []);

  const isUsernameInput = recipientInput.trim().startsWith("@");

  const handleLookup = async () => {
    const u = recipientInput.trim().replace(/^@/, "");
    if (!u) return;
    setLookupLoading(true);
    setFoundMember(null);
    try {
      const res = await lookupExxsendMember(u, phone || undefined);
      if (res?.success && res.member) {
        setFoundMember(res.member as any);
      } else {
        Alert.alert("Not found", "We couldn't find an Exxsend member with that username.");
      }
    } catch {
      Alert.alert("Error", "Could not look up that username. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const canSubmit = !!selectedWallet && !!amount && parseFloat(amount) > 0 && (isUsernameInput ? !!foundMember : recipientInput.trim().length >= 7) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedWallet) return;
    // A username lookup doesn't actually return a phone number per the
    // documented Member shape — the request still needs recipientPhone,
    // so a username-based request can only proceed once we have an actual
    // phone number for them. Since that's not guaranteed to be available,
    // fall back to asking for a phone number directly in that case.
    const recipientPhone = isUsernameInput ? foundMember?.phone : recipientInput.trim();
    if (!recipientPhone) {
      Alert.alert(
        "Phone number needed",
        "We found that member, but need their phone number to create the request — please enter it directly instead of their @username."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await createMoneyRequest({
        requesterPhone: phone,
        recipientPhone,
        amount: parseFloat(amount),
        currency: selectedWallet.currencyCode,
        note: note.trim() || undefined,
      });
      if (res.success) {
        setShareUrl(res.shareUrl || null);
      } else {
        Alert.alert("Couldn't create request", res.message || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      await Share.share({
        message: `${foundMember ? `@${foundMember.username}` : "Hey"}, I'm requesting ${selectedWallet?.currencyCode} ${amount} on Exxsend${note.trim() ? ` for ${note.trim()}` : ""}. Pay here: ${shareUrl}`,
        url: shareUrl,
      });
    } catch { }
  };

  if (shareUrl) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={40} color="#059669" />
          </View>
          <AppText style={s.successTitle}>Request sent</AppText>
          <AppText style={s.successBody}>
            {foundMember ? `@${foundMember.username}` : "Your recipient"} will be notified. You can also share the link directly.
          </AppText>

          <View style={s.linkBox}>
            <AppText style={s.linkText} numberOfLines={1}>{shareUrl}</AppText>
          </View>

          <Pressable onPress={handleShare} style={s.shareBtn}>
            <Ionicons name="share-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <AppText style={s.shareBtnText}>Share link</AppText>
          </Pressable>
          <Pressable onPress={() => router.back()} style={s.doneBtn}>
            <AppText style={s.doneBtnText}>Done</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Request Money</AppText>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AppText style={s.fieldLabel}>Amount</AppText>
          <View style={s.amountBox}>
            <Pressable onPress={() => wallets.length > 1 && setShowWalletPicker(true)} style={s.currencyPill}>
              <AppText style={s.currencySymbol}>{selectedWallet?.currencyCode || "—"}</AppText>
              {wallets.length > 1 && <Ionicons name="chevron-down" size={14} color={COLORS.primary} />}
            </Pressable>
            <AppTextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              style={s.amountInput}
            />
          </View>

          <AppText style={s.fieldLabel}>Request from</AppText>
          <View style={s.recipientRow}>
            <AppTextInput
              value={recipientInput}
              onChangeText={(t) => { setRecipientInput(t); setFoundMember(null); }}
              placeholder="@username or phone number"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              style={s.recipientInput}
            />
            {isUsernameInput && (
              <Pressable onPress={handleLookup} disabled={lookupLoading} style={s.findBtn}>
                {lookupLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <AppText style={s.findBtnText}>Find</AppText>}
              </Pressable>
            )}
          </View>

          {!!foundMember && (
            <View style={s.memberCard}>
              <View style={s.memberAvatar}>
                <AppText style={s.memberAvatarText}>@</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.memberName}>{foundMember.firstName} {foundMember.lastName}</AppText>
                <AppText style={s.memberUsername}>@{foundMember.username}</AppText>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
            </View>
          )}

          <AppText style={s.fieldLabel}>Note (optional)</AppText>
          <AppTextInput
            value={note}
            onChangeText={setNote}
            placeholder="What's this for?"
            placeholderTextColor={COLORS.muted}
            style={s.noteInput}
            multiline
          />

          <Pressable onPress={handleSubmit} disabled={!canSubmit} style={[s.submitBtn, !canSubmit && { opacity: 0.45 }]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText style={s.submitBtnText}>
                Request {selectedWallet?.currencyCode || ""} {amount || "0.00"}
              </AppText>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <CurrencyPickerModal
        visible={showWalletPicker}
        onClose={() => setShowWalletPicker(false)}
        wallets={wallets}
        selected={selectedWallet}
        onSelect={(w) => { setSelectedWallet(w); setShowWalletPicker(false); }}
        title="Request in"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: COLORS.text },
  body: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACE.huge },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: SPACE.sm, marginTop: SPACE.lg },

  amountBox: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, height: 56, ...GLASS_BORDER },
  currencyPill: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: SPACE.md, paddingRight: SPACE.md, borderRightWidth: 1, borderRightColor: COLORS.borderLight },
  currencySymbol: { fontSize: 15, fontWeight: "600", color: COLORS.muted },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "600", color: COLORS.text },

  recipientRow: { flexDirection: "row", gap: SPACE.sm },
  recipientInput: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, height: 50, fontSize: 15, color: COLORS.text, ...GLASS_BORDER },
  findBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, alignItems: "center", justifyContent: "center" },
  findBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },

  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginTop: SPACE.md, borderWidth: 1.5, borderColor: COLORS.primary, gap: SPACE.md },
  memberAvatar: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  memberUsername: { fontSize: 12, color: COLORS.muted, marginTop: 1 },

  noteInput: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: 70, fontSize: 14, color: COLORS.text, textAlignVertical: "top", ...GLASS_BORDER },

  submitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", marginTop: SPACE.xxl },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING * 1.5 },
  successIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: SPACE.xl },
  successTitle: { fontSize: 20, fontWeight: "600", color: COLORS.text },
  successBody: { fontSize: 14, color: COLORS.muted, fontWeight: "500", textAlign: "center", marginTop: SPACE.sm, lineHeight: 21 },
  linkBox: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, marginTop: SPACE.xl, alignSelf: "stretch", ...GLASS_BORDER },
  linkText: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  shareBtn: { flexDirection: "row", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, alignItems: "center", justifyContent: "center", marginTop: SPACE.xl, alignSelf: "stretch" },
  shareBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  doneBtn: { paddingVertical: SPACE.md, marginTop: SPACE.sm },
  doneBtnText: { color: COLORS.muted, fontSize: 14, fontWeight: "600" },
});
