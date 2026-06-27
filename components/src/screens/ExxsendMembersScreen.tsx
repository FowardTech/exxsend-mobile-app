import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUserWallets, lookupExxsendMember, lookupMemberByUsername, sendToExxsendMember } from "../../../api/config";
import { fetchMyFeeWaivers } from "../../../api/feeWaivers";
import { fulfillMoneyRequest } from "../../../api/moneyRequests";
import { getSavedRecipients, recordRecentRecipient, saveRecipientToDB } from "../../../api/sync";
import CurrencyPickerModal, { Wallet } from "../../../components/CurrencyPickerModal";
import PinVerificationModal from "../../../components/PinVerificationModal";
import ScreenHeader from "../../../components/ScreenHeader";
import { useDeviceTrustGate } from "../../../hooks/useDeviceTrustGate";
import { COLORS } from "../../../theme/colors";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";

interface Member {
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export default function ExxsendMembersScreen() {
  const router = useRouter();
  const { ensureDeviceTrusted } = useDeviceTrustGate();
  // scannedUsername arrives from ScanToPayScreen after decoding another
  // member's QR "pay code"; prefillUsername arrives from RecipientSelectScreen
  // when the user taps a saved Exxsend-member recipient. Either way, we skip
  // straight to looking that member up instead of waiting for manual entry.
  const params = useLocalSearchParams<{ fromCurrency?: string; fromAmount?: string; scannedUsername?: string; prefillUsername?: string; requestId?: string; requestNote?: string }>();

  const [userPhone, setUserPhone] = useState("");
  const [username, setUsername] = useState(
    params.scannedUsername ? String(params.scannedUsername).replace(/^@/, "")
      : params.prefillUsername ? String(params.prefillUsername).replace(/^@/, "")
        : ""
  );
  const [member, setMember] = useState<Member | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState(params.fromAmount || "");
  const [note, setNote] = useState(params.requestNote ? decodeURIComponent(params.requestNote) : "");
  const [sending, setSending] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  // Wallet/currency to send from — any currency the user has added, not
  // just CAD. Defaults to whatever was passed in (e.g. from a recipient's
  // "Send to this recipient" flow), falling back to the user's first
  // active wallet once the list loads.
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const currencyCode = selectedWallet?.currencyCode || params.fromCurrency || "";
  // Visible control over whether this member gets saved as a recipient —
  // previously this happened silently/automatically with no way to opt out.
  const [saveRecipientToggle, setSaveRecipientToggle] = useState(true);
  // True once we've actively confirmed this exact member is already in the
  // saved-recipients list — not just inferred from how this screen was
  // reached (e.g. prefillUsername), since a plain manual search for an
  // already-saved username should be caught too.
  const [alreadySaved, setAlreadySaved] = useState(false);

  const getInitials = (m: Member) =>
    `${m.firstName?.[0] || ""}${m.lastName?.[0] || ""}`.toUpperCase() || m.username[0]?.toUpperCase() || "?";

  const handleLookup = useCallback(async (lookupUsername?: string) => {
    const u = (lookupUsername ?? username).trim().replace(/^@/, "");
    if (!u || u.length < 3) { Alert.alert("Enter username", "Please enter a valid Exxsend username."); return; }
    setLookupLoading(true);
    setMember(null);
    setNotFound(false);
    setAlreadySaved(false);
    try {
      // Passing our own phone lets the backend exclude ourselves from the
      // result, so scanning/typing your own handle correctly comes back
      // not-found instead of letting you "send" to yourself.
      const res = await lookupExxsendMember(u, userPhone || undefined);
      if (res?.success && res.member) {
        setMember(res.member);

        // Best-effort backfill — the primary lookup above hits an older
        // endpoint that was never explicitly confirmed to return a
        // current profile photo; this one was. If the primary result
        // already has a photo, this is skipped entirely; if not, this
        // fills it in without blocking the member card from showing
        // immediately.
        if (!res.member.avatar) {
          lookupMemberByUsername(u).then((fresh) => {
            if (fresh.success && fresh.member?.profilePhotoUrl) {
              setMember((prev) => (prev ? { ...prev, avatar: fresh.member!.profilePhotoUrl! } : prev));
            }
          }).catch(() => { });
        }
        // Best-effort — if this check fails for any reason, the toggle
        // just defaults back to showing (the safer of the two outcomes:
        // worst case is offering to re-save someone already saved, which
        // is harmless, rather than silently never saving someone new).
        if (userPhone) {
          getSavedRecipients(userPhone)
            .then((savedRes) => {
              if (!savedRes.success) return;
              const target = `@${u}`.toLowerCase();
              const match = (savedRes.recipients || []).some(
                (r) => (r.payoutMethod === "exxsend" || r.bankCode === "EXXSEND") && (r.accountNumber || "").toLowerCase() === target
              );
              setAlreadySaved(match);
            })
            .catch(() => { });
        }
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
      } else if (params.prefillUsername) {
        handleLookup(String(params.prefillUsername));
      }
      if (phone) {
        const res = await getUserWallets(phone);
        if (res.success) {
          const active = res.wallets.filter((w: Wallet) => w.status === "active");
          setWallets(active);
          const preselected = params.fromCurrency
            ? active.find((w: Wallet) => w.currencyCode?.toUpperCase() === String(params.fromCurrency).toUpperCase())
            : undefined;
          setSelectedWallet(preselected || active[0] || null);
        }
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

    const trusted = await ensureDeviceTrusted(userPhone);
    if (!trusted) return;

    setSending(true);
    try {
      const res = await sendToExxsendMember({
        phone: userPhone,
        toUsername: member.username,
        currency: currencyCode,
        amount: parseFloat(amount),
        pin,
        note: note.trim() || undefined,
      });
      if (res?.success) {
        // Best-effort, and now only when the user actually left the toggle
        // on — saving this recipient is a convenience, not a requirement
        // for the transfer itself, so it never blocks or surfaces an error
        // if it fails, and never happens at all if the user opted out.
        if (saveRecipientToggle && !alreadySaved) {
          saveRecipientToDB({
            phone: userPhone,
            accountName: `${member.firstName} ${member.lastName}`.trim() || member.username,
            accountNumber: `@${member.username}`,
            bankCode: "EXXSEND",
            bankName: "Exxsend",
            currency: currencyCode,
            countryCode: "XX",
            payoutMethod: "exxsend",
            payoutType: "exxsend",
            avatarUrl: member.avatar,
          }).catch(() => { });
        }

        // Refresh the cached fee-waiver state — the server already
        // recorded this as a qualifying send (which may grant a new
        // credit), this just keeps Home's banner in sync.
        fetchMyFeeWaivers(userPhone).catch(() => { });

        // Local safety net for Home's "Recent recipients" row — Exxsend
        // member-to-member transfers especially have not been reliably
        // showing up via the backend's /recipients/recent endpoint.
        recordRecentRecipient(userPhone, {
          accountName: `${member.firstName} ${member.lastName}`.trim() || member.username,
          accountNumber: `@${member.username}`,
          bankCode: "EXXSEND",
          bankName: "Exxsend",
          destCurrency: currencyCode,
          countryCode: "XX",
          payoutMethod: "exxsend",
          isExxsendMember: true,
          username: member.username,
          avatarUrl: member.avatar,
          lastAmount: parseFloat(amount) || 0,
        }).catch(() => { });

        // Paying a money request — confirm fulfillment using the actual
        // transfer reference, so the backend can verify it matches before
        // flipping the request to "paid" and notifying the requester.
        if (params.requestId) {
          const reference = (res as any)?.reference;
          if (reference) {
            fulfillMoneyRequest(Number(params.requestId), userPhone, reference).catch(() => { });
          }
        }

        router.push({
          pathname: "/result" as any,
          params: {
            type: "success",
            title: "Sent!",
            message: `Successfully sent ${currencyCode} ${amount} to @${member.username}`,
            amount: `${currencyCode} ${amount}`,
            transactionId: (res as any)?.transaction_id || (res as any)?.reference || (res as any)?.id || "",
            fee: "Free",
            recipientName: `${member.firstName} ${member.lastName}`.trim() || member.username,
            note: `@${member.username}`,
            primaryText: "Done",
            primaryRoute: "/(tabs)/",
            secondaryText: "Go to Home",
            secondaryRoute: "/(tabs)/",
          } as any,
        });
      } else {
        Alert.alert("Failed", res?.message || "Could not complete the transfer.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }, [member, amount, note, userPhone, currencyCode, router, saveRecipientToggle, alreadySaved, params.requestId, ensureDeviceTrusted]);

  const canSend = !!member && !!amount && parseFloat(amount) > 0 && !!currencyCode && !sending;

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
              {member.avatar ? (
                <Image source={{ uri: member.avatar }} style={s.memberAvatarPhoto} />
              ) : (
                <View style={s.memberAvatar}>
                  <AppText style={s.memberInitials}>{getInitials(member)}</AppText>
                </View>
              )}
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
              <AppText style={s.fieldLabel}>Amount {currencyCode ? `(${currencyCode})` : ""}</AppText>
              <View style={s.amountBox}>
                <Pressable
                  onPress={() => wallets.length > 1 && setShowWalletPicker(true)}
                  style={[s.currencyPill, wallets.length > 1 && s.currencyPillTappable]}
                >
                  <AppText style={s.currencySymbol}>{currencyCode || "—"}</AppText>
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
              {!!selectedWallet && (
                <AppText style={s.balanceHint}>
                  Balance: {selectedWallet.formattedBalance} {selectedWallet.currencyCode}
                </AppText>
              )}

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

              {!alreadySaved && (
                <View style={s.saveRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <AppText style={s.saveRowTitle}>Save this recipient</AppText>
                    <AppText style={s.saveRowSub}>For faster transfers next time</AppText>
                  </View>
                  <Switch
                    value={saveRecipientToggle}
                    onValueChange={setSaveRecipientToggle}
                    trackColor={{ true: COLORS.primary, false: COLORS.border }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              )}

              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                style={[s.sendBtn, !canSend && { opacity: 0.45 }]}
              >
                {sending
                  ? <ActivityIndicator color={COLORS.actionText} />
                  : <AppText style={s.sendBtnText}>Send {currencyCode} {amount || "0.00"} to @{member.username}</AppText>
                }
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PinVerificationModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={performSend}
        title="Confirm Transfer"
        subtitle={member ? `Enter your PIN to send ${currencyCode} ${amount || "0.00"} to @${member.username}` : undefined}
      />

      <CurrencyPickerModal
        visible={showWalletPicker}
        onClose={() => setShowWalletPicker(false)}
        wallets={wallets}
        selected={selectedWallet}
        onSelect={(w) => { setSelectedWallet(w); setShowWalletPicker(false); }}
        title="Send From"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 32 },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: 14, padding: 14, marginBottom: 20 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.primary, fontWeight: "600", lineHeight: 19 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 8, marginTop: 18 },
  usernameRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, overflow: "hidden" },
  atWrap: { paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: COLORS.borderLight },
  at: { fontSize: 16, fontWeight: "600", color: COLORS.primary },
  usernameInput: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text, paddingHorizontal: 12, paddingVertical: 14 },
  lookupBtn: { margin: 6, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  lookupBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  notFoundBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginTop: 10 },
  notFoundText: { flex: 1, fontSize: 13, color: COLORS.red, fontWeight: "600" },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.greenLight, },
  memberAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  memberAvatarPhoto: { width: 46, height: 46, borderRadius: 15, marginRight: 12 },
  memberInitials: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  memberUsername: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 12, fontWeight: "600", color: COLORS.green },
  amountBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, height: 54 },
  currencyPill: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: 10, paddingRight: 10, borderRightWidth: 1, borderRightColor: COLORS.borderLight },
  currencyPillTappable: { opacity: 1 },
  currencySymbol: { fontSize: 15, fontWeight: "600", color: COLORS.muted },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "600", color: COLORS.text },
  balanceHint: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 6 },
  noteBox: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 80 },
  noteInput: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  rateNote: { flexDirection: "row", alignItems: "center", marginTop: 14, backgroundColor: COLORS.primaryLight, borderRadius: 10, padding: 12 },
  rateNoteText: { flex: 1, fontSize: 12, color: COLORS.green, fontWeight: "600" },
  saveRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, padding: 14, marginTop: 14 },
  saveRowTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  saveRowSub: { fontSize: 12, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  sendBtn: { backgroundColor: COLORS.actionBg, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  sendBtnText: { color: COLORS.actionText, fontSize: 15, fontWeight: "600" },
});
