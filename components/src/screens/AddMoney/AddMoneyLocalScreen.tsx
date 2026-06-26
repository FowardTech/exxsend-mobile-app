/**
 * AddMoneyLocalScreen
 *
 * Branches on currency to show the correct local deposit experience:
 *   NGN  → Virtual Account (bank transfer details with copy buttons + refresh)
 *   KES / GHS / UGX / TZS / RWF / ZMW / XOF → Mobile Money form
 *   ZAR / other  → Card checkout (opens Flutterwave hosted link)
 *   CAD  → Route to Interac (handled separately)
 *
 * Entry point: push /add-money/local?currency=NGN (or KES, GHS, …)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet, StatusBar, Linking, RefreshControl, Animated, Easing, KeyboardAvoidingView, Platform } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import AppTextInput from "../../../AppTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import {
  getVirtualAccount, createVirtualAccount, chargeMobileMoney,
  chargeCard, recommendedDepositMethod, submitIdentityNumber,
  VirtualAccount, DepositMethod,
} from "../../../../api/flutterwave";
import { getCurrencySymbol } from "../../../../api/flutterwave";
import { getCorridorByCurrency } from "../../../../api/corridors";
import { getStripeConfig, createStripePaymentIntent, confirmStripePayment, getSavedStripeCards, chargeWithSavedStripeCard, SavedStripeCard } from "../../../../api/stripe";
import { StripeProvider, CardField, useConfirmPayment } from "@stripe/stripe-react-native";
import { COLORS } from "@/theme/colors";
import CountryFlag from "../../../CountryFlag";
import ScreenHeader from "../../../../components/ScreenHeader";
import { SPACE, RADIUS, TYPE, CARD_SHADOW, GLASS_BORDER_SUBTLE, SCREEN_PADDING, GLASS_BORDER } from "../../../../theme/designSystem";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return (name || "U").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
}

const MOMO_NETWORKS: Record<string, Array<{ code: string; name: string }>> = {
  KES: [{ code: "MPESA", name: "M-Pesa (Safaricom)" }],
  GHS: [{ code: "MTN", name: "MTN Mobile Money" }, { code: "VODAFONE", name: "Vodafone Cash" }, { code: "AIRTEL", name: "AirtelTigo Money" }],
  UGX: [{ code: "MTN", name: "MTN Mobile Money" }, { code: "AIRTEL", name: "Airtel Money" }],
  TZS: [{ code: "VODACOM", name: "Vodacom M-Pesa" }, { code: "AIRTEL", name: "Airtel Money" }, { code: "TIGO", name: "Tigo Pesa" }],
  RWF: [{ code: "MTN", name: "MTN MoMo" }, { code: "AIRTEL", name: "Airtel Money" }],
  ZMW: [{ code: "AIRTEL", name: "Airtel Money" }, { code: "MTN", name: "MTN MoMo" }, { code: "ZAMTEL", name: "Zamtel Kwacha" }],
  XOF: [{ code: "ORANGE", name: "Orange Money" }, { code: "FREE", name: "Free Money" }, { code: "WAVE", name: "Wave" }],
  XAF: [{ code: "MTN", name: "MTN MoMo" }, { code: "ORANGE", name: "Orange Money" }],
};

// ─── Copy Row ─────────────────────────────────────────────────────────────────

function CopyField({ label, value, large }: { label: string; value: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <View style={s.copyField}>
      <AppText style={s.copyFieldLabel}>{label}</AppText>
      <View style={s.copyFieldRow}>
        <AppText style={[s.copyFieldValue, large && s.copyFieldValueLg]} selectable numberOfLines={1} adjustsFontSizeToFit>{value || "—"}</AppText>
        <Pressable onPress={handleCopy} style={[s.copyBtn, copied && s.copyBtnDone]} hitSlop={8}>
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={copied ? COLORS.green : COLORS.primary} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Virtual Account UI (NGN) ─────────────────────────────────────────────────

// ─── BVN / NIN Collection Sheet ───────────────────────────────────────────────

type IdMode = "bvn" | "nin";

function IdentityCollectionSheet({
  visible, onClose, onSubmit, submitting, error,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (mode: IdMode, value: string) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [mode, setMode] = useState<IdMode>("bvn");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) setValue("");
  }, [visible, mode]);

  const isValid = mode === "bvn" ? value.replace(/\D/g, "").length === 11 : value.replace(/\D/g, "").length === 11;

  if (!visible) return null;

  return (
    <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onClose} />
      <View style={s.idSheet}>
        <View style={s.sheetHandle} />

        <View style={s.idSheetHeader}>
          <View style={s.idSheetIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          </View>
          <AppText style={s.idSheetTitle}>Verify your identity</AppText>
          <AppText style={s.idSheetSub}>
            Flutterwave requires your BVN or NIN to issue a dedicated NGN account number for deposits. This is a one-time step.
          </AppText>
        </View>

        {/* Mode toggle */}
        <View style={s.idModeRow}>
          <Pressable
            onPress={() => setMode("bvn")}
            style={[s.idModeBtn, mode === "bvn" && s.idModeBtnActive]}
          >
            <AppText style={[s.idModeText, mode === "bvn" && s.idModeTextActive]}>BVN</AppText>
          </Pressable>
          <Pressable
            onPress={() => setMode("nin")}
            style={[s.idModeBtn, mode === "nin" && s.idModeBtnActive]}
          >
            <AppText style={[s.idModeText, mode === "nin" && s.idModeTextActive]}>NIN</AppText>
          </Pressable>
        </View>

        <AppText style={s.idFieldLabel}>
          {mode === "bvn" ? "Bank Verification Number" : "National Identity Number"}
        </AppText>
        <View style={[s.inputBox, !!error && { borderColor: COLORS.red }]}>
          <Ionicons name="card-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
          <AppTextInput
            value={value}
            onChangeText={(t) => setValue(t.replace(/\D/g, "").slice(0, 11))}
            keyboardType="number-pad"
            placeholder={mode === "bvn" ? "e.g. 22112345678" : "e.g. 12345678901"}
            placeholderTextColor={COLORS.muted}
            style={s.input}
            maxLength={11}
            // secureTextEntry
            autoFocus
          />
        </View>
        {!!error && <AppText style={s.idFieldError}>{error}</AppText>}

        <View style={s.idPrivacyRow}>
          <Ionicons name="lock-closed-outline" size={12} color={COLORS.muted} />
          <AppText style={s.idPrivacyText}>
            {" "}Encrypted and used only to verify your identity with our banking partner. Never shared or stored in plain text.
          </AppText>
        </View>

        <Pressable
          onPress={() => isValid && onSubmit(mode, value)}
          disabled={!isValid || submitting}
          style={({ pressed }) => [s.cta, (!isValid || submitting) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}
        >
          <View style={s.ctaInner}>
            {submitting
              ? <ActivityIndicator color={COLORS.actionText} />
              : <><Ionicons name="checkmark-circle-outline" size={16} color={COLORS.actionText} style={{ marginRight: 6 }} /><AppText style={s.ctaText}>Verify & Continue</AppText></>
            }
          </View>
        </Pressable>

        <Pressable onPress={submitting ? undefined : onClose} style={{ alignItems: "center", paddingTop: 14 }}>
          <AppText style={s.idCancelText}>Cancel</AppText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function VirtualAccountView({ phone, currency }: { phone: string; currency: string }) {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  // BVN/NIN collection state
  const [needsId, setNeedsId] = useState(false);
  const [idSheetOpen, setIdSheetOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  const startSpin = () => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  };
  const stopSpin = () => spinAnim.stopAnimation();

  const fetchAccount = useCallback(async (isRefresh = false) => {
    if (isRefresh) { setRefreshing(true); startSpin(); }
    else setLoading(true);
    setError(null);
    try {
      const res = await getVirtualAccount(phone);
      if (res.success && res.account) {
        setAccount(res.account);
      } else if (!isRefresh) {
        // No account yet — auto-create
        setCreating(true);
        const createRes = await createVirtualAccount(phone);
        setCreating(false);
        if (createRes.success && createRes.account) {
          setAccount(createRes.account);
        } else if (createRes.code === "BVN_OR_NIN_REQUIRED") {
          // Backend needs identity verification before it can issue an account
          setNeedsId(true);
          setIdSheetOpen(true);
        } else {
          setError(createRes.message || "Could not create virtual account. Please try again.");
        }
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false); setRefreshing(false); stopSpin();
    }
  }, [phone]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const handleSubmitId = useCallback(async (mode: IdMode, value: string) => {
    setSubmittingId(true);
    setIdError(null);
    try {
      const res = await submitIdentityNumber(phone, mode === "bvn" ? { bvn: value } : { nin: value });
      if (!res.success) {
        setIdError(res.message || `Could not verify ${mode.toUpperCase()}. Please check the number and try again.`);
        setSubmittingId(false);
        return;
      }
      // ID accepted — retry account creation
      const createRes = await createVirtualAccount(phone);
      setSubmittingId(false);
      if (createRes.success && createRes.account) {
        setAccount(createRes.account);
        setNeedsId(false);
        setIdSheetOpen(false);
      } else if (createRes.code === "BVN_OR_NIN_REQUIRED") {
        setIdError("We still couldn't verify that number. Please double-check and try again.");
      } else {
        setIdError(createRes.message || "Could not create your account. Please try again.");
      }
    } catch (e: any) {
      setSubmittingId(false);
      setIdError(e?.message || "Network error — please try again.");
    }
  }, [phone]);

  const handleCopyAll = async () => {
    if (!account) return;
    const text = `Bank: ${account.bankName}\nAccount Number: ${account.accountNumber}\nAccount Name: ${account.accountName}`;
    await Clipboard.setStringAsync(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (loading || creating) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <AppText style={s.loadingText}>{creating ? "Setting up your account…" : "Loading…"}</AppText>
        {creating && <AppText style={s.loadingSubtext}>This only takes a moment</AppText>}
      </View>
    );
  }

  if (needsId) {
    return (
      <View style={s.centered}>
        <View style={s.idPromptIcon}><Ionicons name="shield-checkmark-outline" size={36} color={COLORS.primary} /></View>
        <AppText style={s.errorTitle}>One more step</AppText>
        <AppText style={s.errorSub}>We need your BVN or NIN to set up your NGN deposit account.</AppText>
        <Pressable onPress={() => { setIdError(null); setIdSheetOpen(true); }} style={[s.retryBtn, { marginTop: 20 }]}>
          <Ionicons name="arrow-forward-circle-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
          <AppText style={s.retryText}>Continue</AppText>
        </Pressable>
        <IdentityCollectionSheet
          visible={idSheetOpen}
          onClose={() => setIdSheetOpen(false)}
          onSubmit={handleSubmitId}
          submitting={submittingId}
          error={idError}
        />
      </View>
    );
  }

  if (error || !account) {
    return (
      <View style={s.centered}>
        <View style={s.errorIcon}><Ionicons name="alert-circle-outline" size={40} color={COLORS.red} /></View>
        <AppText style={s.errorTitle}>Could not load account</AppText>
        <AppText style={s.errorSub}>{error || "Please try again."}</AppText>
        <Pressable onPress={() => fetchAccount()} style={s.retryBtn}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
          <AppText style={s.retryText}>Try again</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAccount(true)} tintColor={COLORS.primary} />}
    >
      {/* Hero instruction card */}

      <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
        <View style={{ position: "absolute", right: -20, top: -20, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.06)" }} />
        <View style={s.heroIconWrap}><AppText style={{ fontSize: 24, color: COLORS.primaryDark }}>₦</AppText></View>
        <View style={{ flex: 1 }}>
          <AppText style={s.heroTitle}>NGN Virtual Account</AppText>
          <AppText style={s.heroSub}>Transfer any amount to your dedicated account number below — funds arrive in minutes.</AppText>
        </View>
      </LinearGradient>

      {/* ── IMPORTANT warning ── */}
      <View style={s.warnBox}>
        <Ionicons name="information-circle" size={16} color="#B45309" style={{ marginRight: 8, marginTop: 1 }} />
        <AppText style={s.warnText}>
          <AppText style={{ fontWeight: "700" }}>Use this account number only for NGN deposits.</AppText>{" "}
          Transfers from outside Nigeria or in other currencies will be rejected.
        </AppText>
      </View>

      {/* Account details card */}
      <View style={s.detailsCard}>
        <View style={s.detailsHeader}>
          <AppText style={s.detailsHeaderTitle}>Transfer Details</AppText>
          <View style={s.detailsHeaderRight}>
            <Pressable onPress={() => fetchAccount(true)} style={s.refreshBtn} hitSlop={8}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="refresh-outline" size={15} color={COLORS.primary} />
              </Animated.View>
            </Pressable>
            <Pressable onPress={handleCopyAll} style={[s.copyAllBtn, copiedAll && s.copyAllBtnDone]}>
              <Ionicons name={copiedAll ? "checkmark" : "copy-outline"} size={13} color={copiedAll ? COLORS.green : COLORS.primary} />
              <AppText style={[s.copyAllText, copiedAll && { color: COLORS.green }]}>{copiedAll ? "Copied!" : "Copy all"}</AppText>
            </Pressable>
          </View>
        </View>

        <CopyField label="Bank name" value={account.bankName} />
        <View style={s.fieldDivider} />
        <CopyField label="Account number" value={account.accountNumber} large />
        <View style={s.fieldDivider} />
        <CopyField label="Account name" value={account.accountName} />

        {account.reference && (
          <>
            <View style={s.fieldDivider} />
            <CopyField label="Reference" value={account.reference} />
          </>
        )}
        {account.expiresAt && (
          <>
            <View style={s.fieldDivider} />
            <View style={s.expiryRow}>
              <Ionicons name="time-outline" size={14} color={COLORS.muted} style={{ marginRight: 6 }} />
              <AppText style={s.expiryText}>Account valid until {new Date(account.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</AppText>
            </View>
          </>
        )}
      </View>

      {/* How it works steps */}
      <View style={s.stepsCard}>
        <AppText style={s.stepsTitle}>HOW TO DEPOSIT</AppText>
        {[
          { icon: "copy-outline", text: "Copy the account number above" },
          { icon: "phone-portrait-outline", text: "Open your banking app or USSD" },
          { icon: "arrow-forward-circle-outline", text: `Transfer any NGN amount to "${account.accountName}"` },
          { icon: "checkmark-circle-outline", text: "Funds appear in your NGN wallet within minutes" },
        ].map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepDotWrap}>
              <View style={s.stepDot}><Ionicons name={step.icon as any} size={14} color={COLORS.primary} /></View>
              {i < 3 && <View style={s.stepLine} />}
            </View>
            <AppText style={s.stepText}>{step.text}</AppText>
          </View>
        ))}
      </View>

      {/* Limits & fees */}
      <View style={s.limitsRow}>
        <View style={s.limitChip}><Ionicons name="flash-outline" size={12} color={COLORS.green} /><AppText style={s.limitChipText}>No deposit fee</AppText></View>
        <View style={s.limitChip}><Ionicons name="time-outline" size={12} color={COLORS.primary} /><AppText style={s.limitChipText}>Minutes</AppText></View>
        <View style={s.limitChip}><Ionicons name="shield-checkmark-outline" size={12} color={COLORS.primary} /><AppText style={s.limitChipText}>Secured by Flutterwave</AppText></View>
      </View>
    </ScrollView>
  );
}

// ─── Mobile Money UI ──────────────────────────────────────────────────────────

function MobileMoneyView({ phone, currency, userEmail, userName }: { phone: string; currency: string; userEmail: string; userName: string }) {
  const networks = useMemo(() => MOMO_NETWORKS[currency] || [], [currency]);
  const sym = useMemo(() => getCurrencySymbol(currency), [currency]);

  const [amount, setAmount] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [network, setNetwork] = useState<{ code: string; name: string } | null>(networks[0] || null);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [txRef, setTxRef] = useState("");

  const canCharge = !!amount && parseFloat(amount) > 0 && !!mobileNumber && mobileNumber.replace(/\D/g, "").length >= 9 && !!network;

  const handleCharge = async () => {
    if (!canCharge || loading) return;
    setLoading(true);
    setStatus("idle");
    try {
      const res = await chargeMobileMoney({
        phone,
        amount: parseFloat(amount),
        currency,
        mobileNumber: mobileNumber.replace(/\s/g, ""),
        network: network!.code,
        fullName: userName || "Customer",
        email: userEmail || undefined,
      });
      if (res.success) {
        setTxRef(res.flwRef || res.transactionId || "");
        setStatus(res.status === "successful" ? "success" : "pending");
        if (res.redirectUrl) {
          Alert.alert("Authorize Payment", "You'll be redirected to authorize this mobile money charge.", [
            { text: "Continue", onPress: () => Linking.openURL(res.redirectUrl!).catch(() => {}) },
          ]);
        }
      } else {
        setStatus("failed");
        Alert.alert("Charge Failed", res.message || "Please check your mobile number and try again.");
      }
    } catch (e: any) {
      setStatus("failed");
      Alert.alert("Error", e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success" || status === "pending") {
    return (
      <View style={s.centered}>
        <View style={[s.statusIcon, { backgroundColor: status === "success" ? COLORS.greenSoft : COLORS.accentLight }]}>
          <Ionicons name={status === "success" ? "checkmark-circle" : "time"} size={40} color={status === "success" ? COLORS.green : COLORS.accent} />
        </View>
        <AppText style={s.statusTitle}>{status === "success" ? "Deposit Successful!" : "Awaiting Confirmation"}</AppText>
        <AppText style={s.statusSub}>
          {status === "success"
            ? `${sym}${amount} ${currency} has been added to your wallet.`
            : `${sym}${amount} ${currency} mobile money charge is processing. Check your phone to authorize.`
          }
        </AppText>
        {txRef ? <AppText style={s.txRef}>Ref: {txRef}</AppText> : null}
        <Pressable onPress={() => { setStatus("idle"); setAmount(""); }} style={s.retryBtn}>
          <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
          <AppText style={s.retryText}>Make another deposit</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
        <View style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)" }} />
        <View style={s.heroIconWrap}><Ionicons name="phone-portrait-outline" size={22} color={COLORS.primaryDark} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={s.heroTitle}>Mobile Money Deposit</AppText>
          <AppText style={s.heroSub}>Deposit {currency} directly from your mobile money wallet. Funds arrive instantly.</AppText>
        </View>
      </LinearGradient>

      {/* Form */}
      <View style={s.formCard}>
        <AppText style={s.formLabel}>AMOUNT ({currency})</AppText>
        <View style={s.amtRow}>
          <AppText style={s.amtSym}>{sym}</AppText>
          <AppTextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.muted} style={s.amtInput} />
        </View>
      </View>

      <View style={s.formCard}>
        <AppText style={s.formLabel}>MOBILE NETWORK</AppText>
        {networks.length === 1 ? (
          <View style={[s.inputBox, { backgroundColor: COLORS.bg }]}>
            <Ionicons name="phone-portrait-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
            <AppText style={[s.inputText, { color: COLORS.text }]}>{networks[0].name}</AppText>
          </View>
        ) : (
          <Pressable onPress={() => setNetworkOpen(true)} style={s.inputBox}>
            <Ionicons name="phone-portrait-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
            <AppText style={[s.inputText, !network && { color: COLORS.muted }]}>{network?.name || "Select network"}</AppText>
            <Ionicons name="chevron-down" size={16} color={COLORS.muted} />
          </Pressable>
        )}
      </View>

      <View style={s.formCard}>
        <AppText style={s.formLabel}>MOBILE NUMBER</AppText>
        <View style={s.inputBox}>
          <Ionicons name="call-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
          <AppTextInput value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" placeholder="e.g. 0712XXXXXX" placeholderTextColor={COLORS.muted} style={s.input} maxLength={15} />
        </View>
        <AppText style={s.fieldHint}>Enter the mobile number registered to your {network?.name || "mobile money"} account.</AppText>
      </View>

      {/* Fee + ETA */}
      <View style={s.feeRow}>
        <View style={s.feeChip}><Ionicons name="flash-outline" size={12} color={COLORS.green} /><AppText style={s.feeChipText}>No fee</AppText></View>
        <View style={s.feeChip}><Ionicons name="time-outline" size={12} color={COLORS.primary} /><AppText style={s.feeChipText}>Instant</AppText></View>
        <View style={s.feeChip}><Ionicons name="shield-checkmark-outline" size={12} color={COLORS.primary} /><AppText style={s.feeChipText}>Secured</AppText></View>
      </View>

      <Pressable onPress={handleCharge} disabled={!canCharge || loading} style={({ pressed }) => [s.cta, (!canCharge || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
        <View style={s.ctaInner}>
          {loading ? <ActivityIndicator color={COLORS.actionText} /> : <><Ionicons name="phone-portrait-outline" size={16} color={COLORS.actionText} style={{ marginRight: 6 }} /><AppText style={s.ctaText}>Deposit via {network?.name || "Mobile Money"}</AppText></>}
        </View>
      </Pressable>

      {/* Network picker modal */}
      {networkOpen && (
        <Pressable style={s.modalOverlay} onPress={() => setNetworkOpen(false)}>
          <View style={s.networkSheet}>
            <View style={s.sheetHandle} />
            <AppText style={s.sheetTitle}>Select Network</AppText>
            {networks.map(n => (
              <Pressable key={n.code} onPress={() => { setNetwork(n); setNetworkOpen(false); }} style={[s.networkRow, network?.code === n.code && s.networkRowSelected]}>
                <AppText style={s.networkName}>{n.name}</AppText>
                {network?.code === n.code && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Card Checkout UI ─────────────────────────────────────────────────────────

function StripeCardTopUpView({ phone, currency }: { phone: string; currency: string }) {
  const { confirmPayment, loading: confirming } = useConfirmPayment();
  const sym = getCurrencySymbol(currency);

  const [amount, setAmount] = useState("");
  const [cardDetails, setCardDetails] = useState<{ complete: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [holdHours, setHoldHours] = useState(0);
  const [quote, setQuote] = useState<{ surchargeAmount: number; totalCharged: number } | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [savedCards, setSavedCards] = useState<SavedStripeCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [saveNewCard, setSaveNewCard] = useState(false);

  // Step 1: load config once for the surcharge/hold-time display, and any
  // saved cards this user already has on file.
  useEffect(() => {
    (async () => {
      const cfg = await getStripeConfig();
      if (cfg.success) {
        setSurchargePercent(cfg.surchargePercent);
        setHoldHours(cfg.holdHours);
      }
    })();
    if (phone) {
      getSavedStripeCards(phone).then((res) => {
        if (res.success && res.cards.length > 0) setSavedCards(res.cards);
      });
    }
  }, [phone]);

  useFocusEffect(
    useCallback(() => {
      if (!phone) return;
      getSavedStripeCards(phone).then((res) => {
        if (res.success) setSavedCards(res.cards);
      });
    }, [phone])
  );

  const parsedAmount = parseFloat(amount);
  const amountValid = !!amount && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canPay = amountValid && !loading && !confirming && (selectedCardId ? true : !!cardDetails?.complete);

  const handlePay = async () => {
    if (currency.toUpperCase() === "NGN") {
      Alert.alert("Not available", "Card deposits for NGN aren't supported. Please use the local deposit options instead.");
      return;
    }
    if (!amountValid) {
      Alert.alert("Enter amount", "Please enter the amount you want to deposit.");
      return;
    }
    if (!phone) {
      Alert.alert("Error", "Could not find your account phone number. Please try logging in again.");
      return;
    }

    // ── Paying with a saved card — handled entirely server-side, no
    // CardField/confirmPayment involvement since there's no new card data
    // to transmit. ──────────────────────────────────────────────────────
    if (selectedCardId) {
      setLoading(true);
      setQuote(null);
      setPaymentIntentId(null);
      try {
        const res = await chargeWithSavedStripeCard({ phone, amount: parsedAmount, currency, paymentMethodId: selectedCardId });
        if (res.success) {
          setPaymentIntentId(res.reference || null);
          setStatus("success");
        } else {
          Alert.alert("Payment failed", res.message || "Your saved card could not be charged. Please try again or use a different card.");
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Something went wrong while processing your payment.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!cardDetails?.complete) {
      Alert.alert("Card details incomplete", "Please enter your full card number, expiry, and CVC.");
      return;
    }

    setLoading(true);
    setQuote(null);
    setPaymentIntentId(null);

    try {
      // Step 2: create the PaymentIntent server-side.
      const intentRes = await createStripePaymentIntent({ phone, amount: parsedAmount, currency, savePaymentMethod: saveNewCard });
      if (!intentRes.success || !intentRes.clientSecret) {
        Alert.alert("Error", intentRes.message || "Could not start payment. Please try again.");
        setLoading(false);
        return;
      }

      setQuote({
        surchargeAmount: intentRes.surchargeAmount ?? 0,
        totalCharged: intentRes.totalCharged ?? parsedAmount,
      });
      setPaymentIntentId(intentRes.paymentIntentId || null);

      // Step 3: confirm directly with Stripe using the card details entered
      // into our own styled CardField above — no Stripe-branded modal, the
      // card number/expiry/CVC text entry itself is still handled natively
      // by Stripe's SDK (required for PCI compliance), but every pixel
      // around it is ours.
      const { error: confirmError, paymentIntent } = await confirmPayment(intentRes.clientSecret, {
        paymentMethodType: "Card",
        paymentMethodData: { billingDetails: { phone } },
      });

      if (confirmError) {
        Alert.alert("Payment failed", confirmError.message || "Your card could not be charged.");
        setLoading(false);
        return;
      }

      if (paymentIntent?.status !== "Succeeded" && paymentIntent?.status !== "RequiresCapture") {
        Alert.alert(
          "Payment pending",
          "Your card was processed but the payment hasn't completed yet. We'll confirm with our system shortly."
        );
      }

      // Step 4: confirm on our backend — this is what actually verifies the
      // PaymentIntent and credits the wallet. Idempotent, so retrying here
      // (e.g. if the first call's response is lost) is always safe.
      if (intentRes.paymentIntentId) {
        const confirmRes = await confirmStripePayment(intentRes.paymentIntentId);
        if (confirmRes.success) {
          setStatus("success");
        } else {
          Alert.alert(
            "Payment received, confirming…",
            confirmRes.message || "Your card was charged but we're still confirming with our system. This usually resolves within a minute — check your wallet balance shortly."
          );
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong while processing your payment.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <View style={s.centered}>
        <View style={[s.statusIcon, { backgroundColor: COLORS.greenSoft }]}>
          <Ionicons name="checkmark-circle" size={44} color={COLORS.primary} />
        </View>
        <AppText style={s.statusTitle}>Payment successful</AppText>
        <AppText style={s.statusSub}>
          {sym}{parsedAmount.toFixed(2)} {currency} is on its way to your wallet
          {holdHours > 0 ? ` and will be available within ${holdHours} hour${holdHours === 1 ? "" : "s"}.` : " and is available immediately."}
        </AppText>
        {paymentIntentId && <AppText style={s.txRef}>{paymentIntentId}</AppText>}
        <Pressable
          onPress={() => { setStatus("idle"); setAmount(""); setQuote(null); setPaymentIntentId(null); setCardDetails(null); }}
          style={s.retryBtn}
        >
          <AppText style={s.retryText}>Make another deposit</AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
        <View style={s.heroIconWrap}><Ionicons name="card-outline" size={50} color={COLORS.primaryDark} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={s.heroTitle}>Card Deposit</AppText>
          <AppText style={s.heroSub}>Deposit {currency} using your debit or credit card.</AppText>
        </View>
      </LinearGradient>

      <View style={s.formCard}>
        <AppText style={s.formLabel}>AMOUNT ({currency})</AppText>
        <View style={s.amtRow}>
          <AppText style={s.amtSym}>{sym}</AppText>
          <AppTextInput
            value={amount}
            onChangeText={(v) => { setAmount(v); setQuote(null); }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={COLORS.muted}
            style={s.amtInput}
          />
        </View>
      </View>

      {savedCards.length > 0 && (
        <View style={s.formCard}>
          <AppText style={s.formLabel}>SAVED CARDS</AppText>
          {savedCards.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => setSelectedCardId(selectedCardId === card.id ? null : card.id)}
              style={[s.savedCardRow, selectedCardId === card.id && s.savedCardRowActive]}
            >
              <Ionicons name="card-outline" size={18} color={selectedCardId === card.id ? COLORS.primary : COLORS.muted} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <AppText style={s.savedCardName}>{card.brand} •••• {card.last4}</AppText>
                <AppText style={s.savedCardMeta}>Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</AppText>
              </View>
              {selectedCardId === card.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {!selectedCardId && (
        <View style={s.formCard}>
          <AppText style={s.formLabel}>CARD DETAILS</AppText>
          <CardField
            postalCodeEnabled={false}
            placeholders={{ number: "4242 4242 4242 4242" }}
            cardStyle={{
              backgroundColor: "#FFFFFF",
              // NOTE: Stripe's CardField forwards this string straight to
              // Android's native Color.parseColor(), which only understands
              // hex (#RRGGBB / #AARRGGBB) or a few named colors — NOT CSS
              // rgba(...) syntax. An rgba() string here crashes the app on
              // real Android devices with "Unknown color" (it doesn't crash
              // on iOS or in Expo Go, which is why it can slip through).
              // #59B4C3E1 = rgba(180,195,225,0.35) in #AARRGGBB hex.
              borderColor: "#59B4C3E1",
              borderWidth: 1,
              textColor: COLORS.text,
              placeholderColor: COLORS.muted,
              borderRadius: 10,
              fontSize: 15,
            }}
            style={{ width: "100%", height: 50, marginTop: 4 }}
            onCardChange={(details) => setCardDetails({ complete: details.complete })}
          />
          <Pressable onPress={() => setSaveNewCard((v) => !v)} style={s.saveCardRow}>
            <View style={[s.saveCardCheckbox, saveNewCard && s.saveCardCheckboxOn]}>
              {saveNewCard && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
            </View>
            <AppText style={s.saveCardText}>Save this card for future deposits</AppText>
          </Pressable>
        </View>
      )}

      <View style={s.feeRow}>
        {surchargePercent > 0 && (
          <View style={s.feeChip}>
            <Ionicons name="pricetag-outline" size={12} color={COLORS.muted} />
            <AppText style={s.feeChipText}>{surchargePercent}% fee</AppText>
          </View>
        )}
        <View style={s.feeChip}>
          <Ionicons name="time-outline" size={12} color={COLORS.primary} />
          <AppText style={s.feeChipText}>{holdHours > 0 ? `Available in ${holdHours}h` : "Instant"}</AppText>
        </View>
      </View>

      {quote && (
        <View style={[s.warnBox, { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary }]}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
          <AppText style={[s.warnText, { color: COLORS.primary }]}>
            You'll be charged {sym}{quote.totalCharged.toFixed(2)} {currency} total
            {quote.surchargeAmount > 0 ? ` (includes ${sym}${quote.surchargeAmount.toFixed(2)} fee)` : ""}.
          </AppText>
        </View>
      )}

      <Pressable onPress={handlePay} disabled={!canPay} style={({ pressed }) => [s.cta, !canPay && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}>
        <View style={s.ctaInner}>
          {(loading || confirming) ? <ActivityIndicator color={COLORS.actionText} /> : <><Ionicons name="lock-closed" size={15} color={COLORS.actionText} style={{ marginRight: 6 }} /><AppText style={s.ctaText}>Pay {amountValid ? `${sym}${parsedAmount.toFixed(2)}` : ""}</AppText></>}
        </View>
      </Pressable>
      <AppText style={s.checkoutNote}>Your card details are encrypted and sent directly to Stripe — they never pass through our servers.</AppText>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CardCheckoutView({ phone, currency, userEmail, userName }: { phone: string; currency: string; userEmail: string; userName: string }) {
  const sym = getCurrencySymbol(currency);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert("Enter amount", "Please enter the amount you want to deposit."); return; }
    setLoading(true);
    try {
      const res = await chargeCard({ phone, amount: parseFloat(amount), currency, email: userEmail, name: userName });
      if (res.success && res.checkoutUrl) {
        await Linking.openURL(res.checkoutUrl);
      } else {
        Alert.alert("Error", res.message || "Could not generate payment link.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong");
    } finally {
      setLoading(false); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
      <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroCard}>
        <View style={s.heroIconWrap}><Ionicons name="card-outline" size={22} color={COLORS.primaryDark} /></View>
        <View style={{ flex: 1 }}>
          <AppText style={s.heroTitle}>Card Deposit</AppText>
          <AppText style={s.heroSub}>Deposit {currency} using your Visa or Mastercard. Powered by Flutterwave.</AppText>
        </View>
      </LinearGradient>
      <View style={s.formCard}>
        <AppText style={s.formLabel}>AMOUNT ({currency})</AppText>
        <View style={s.amtRow}>
          <AppText style={s.amtSym}>{sym}</AppText>
          <AppTextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={COLORS.muted} style={s.amtInput} />
        </View>
      </View>
      <View style={s.feeRow}>
        <View style={s.feeChip}><Ionicons name="pricetag-outline" size={12} color={COLORS.muted} /><AppText style={s.feeChipText}>1.4% fee</AppText></View>
        <View style={s.feeChip}><Ionicons name="time-outline" size={12} color={COLORS.primary} /><AppText style={s.feeChipText}>Instant</AppText></View>
      </View>
      <Pressable onPress={handleOpen} disabled={loading} style={({ pressed }) => [s.cta, loading && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}>
        <View style={s.ctaInner}>
          {loading ? <ActivityIndicator color={COLORS.actionText} /> : <><Ionicons name="open-outline" size={16} color={COLORS.actionText} style={{ marginRight: 6 }} /><AppText style={s.ctaText}>Open Secure Checkout</AppText></>}
        </View>
      </Pressable>
      <AppText style={s.checkoutNote}>You'll be redirected to Flutterwave's secure payment page. Return here once complete.</AppText>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type LocalDepositMethod = DepositMethod | "stripe_card";

export default function AddMoneyLocalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ currency?: string }>();
  const currency = (params.currency || "NGN").toUpperCase();

  const [method, setMethod] = useState<LocalDepositMethod | null>(null);
  const [phone, setPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [resolving, setResolving] = useState(true);
  const [stripePublishableKey, setStripePublishableKey] = useState("");

  const corridor = getCorridorByCurrency(currency);
  const sym = getCurrencySymbol(currency);

  useEffect(() => {
    (async () => {
      const [ph, storedUser] = await Promise.all([
        AsyncStorage.getItem("user_phone"),
        AsyncStorage.getItem("user_info"),
      ]);
      const p = ph || "";
      setPhone(p);
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          setUserEmail(u.email || "");
          setUserName([u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(" ").trim());
        } catch {}
      }
      const upperCurrency = currency.toUpperCase();

      if (upperCurrency !== "NGN") {
        // Per backend update: Stripe now covers every admin-enabled
        // currency except NGN (including the exotic African currencies
        // that used to route through Flutterwave's mobile-money/card
        // rails). NGN is the only one that still needs Flutterwave's
        // local rails, so it's the only one that still asks
        // recommendedDepositMethod() for a method at all.
        const stripeConfig = await getStripeConfig();
        const stripeCurrenciesUpper = (stripeConfig.currencies || []).map((c) => c.toUpperCase());
        if (stripeConfig.success && stripeCurrenciesUpper.includes(upperCurrency)) {
          setStripePublishableKey(stripeConfig.publishableKey);
          setMethod("stripe_card");
          setResolving(false);
          return;
        }
      }

      const rec = await recommendedDepositMethod(p, currency);

      if (rec.method === "unsupported" && upperCurrency !== "NGN") {
        // Shouldn't normally be reached now that Stripe is checked first
        // for non-NGN currencies above, but kept as a safety net in case
        // Stripe's config hasn't caught up with a newly-enabled currency yet.
        const stripeConfig = await getStripeConfig();
        const stripeCurrenciesUpper = (stripeConfig.currencies || []).map((c) => c.toUpperCase());
        if (stripeConfig.success && stripeCurrenciesUpper.includes(upperCurrency)) {
          setStripePublishableKey(stripeConfig.publishableKey);
          setMethod("stripe_card");
          setResolving(false);
          return;
        }
      }

      setMethod(rec.method);
      setResolving(false);
    })();
  }, [currency]);

  const title = method === "virtual_account" ? "Add NGN Funds"
              : `Add ${currency} Funds`;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <View style={s.headerCenter}>
          <CountryFlag currencyCode={currency} size="sm" />
          <AppText style={s.headerTitle}>{title}</AppText>
        </View>
        <View style={{ width: 34 }} />
      </View>

      {resolving ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <AppText style={s.loadingText}>Loading deposit options…</AppText>
        </View>
      ) : method === "unsupported" ? (
        <View style={s.centered}>
          <View style={s.errorIcon}><Ionicons name="ban-outline" size={40} color={COLORS.muted} /></View>
          <AppText style={s.errorTitle}>{currency} deposits not yet available</AppText>
          <AppText style={s.errorSub}>We're working on adding more deposit methods. Check back soon.</AppText>
          <Pressable onPress={() => router.back()} style={s.retryBtn}>
            <Ionicons name="arrow-back" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <AppText style={s.retryText}>Go back</AppText>
          </Pressable>
        </View>
      ) : method === "virtual_account" ? (
        <VirtualAccountView phone={phone} currency={currency} />
      ) : method === "mobile_money" ? (
        <MobileMoneyView phone={phone} currency={currency} userEmail={userEmail} userName={userName} />
      ) : method === "stripe_card" ? (
        <StripeProvider publishableKey={stripePublishableKey}>
          <StripeCardTopUpView phone={phone} currency={currency} />
        </StripeProvider>
      ) : (
        <CardCheckoutView phone={phone} currency={currency} userEmail={userEmail} userName={userName} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SCREEN_PADDING, height: 54 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  headerTitle: { ...TYPE.subtitle, color: COLORS.text },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.xxxl },
  loadingText: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary, marginTop: SPACE.lg },
  loadingSubtext: { fontSize: 12, color: COLORS.muted, marginTop: SPACE.sm },
  body: { padding: SCREEN_PADDING, paddingBottom: SPACE.huge },
  // Hero
  heroCard: { borderRadius: RADIUS.lg, padding: SPACE.xl, flexDirection: "row", alignItems: "center", gap: SPACE.lg, marginBottom: SPACE.lg, overflow: "hidden", borderWidth: 1, borderColor: COLORS.primary },
  heroIconWrap: { width: 48, height: 48, borderRadius: RADIUS.full, backgroundColor: "rgba(255,255,255,0.55)", justifyContent: "center", alignItems: "center" },
  heroTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark, marginBottom: 4 },
  heroSub: { fontSize: 12, color: COLORS.primaryDark, fontWeight: "500", lineHeight: 18, opacity: 0.85 },
  // Warning
  warnBox: { flexDirection: "row", alignItems: "flex-start", backgroundColor: COLORS.accentLight, borderRadius: RADIUS.sm, padding: SPACE.md + 2, marginBottom: SPACE.md + 2 },
  warnText: { flex: 1, fontSize: 12, color: COLORS.accentDark, fontWeight: "500", lineHeight: 18 },
  // Details card
  detailsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginBottom: SPACE.md + 2, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  detailsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
  detailsHeaderTitle: { ...TYPE.eyebrow, color: COLORS.muted },
  detailsHeaderRight: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  refreshBtn: { width: 32, height: 32, borderRadius: RADIUS.full, backgroundColor: COLORS.bgTertiary, justifyContent: "center", alignItems: "center" },
  copyAllBtn: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm + 2, paddingVertical: SPACE.xs + 2 },
  copyAllBtnDone: { backgroundColor: COLORS.greenSoft },
  copyAllText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  // Copy field
  copyField: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md + 2 },
  copyFieldLabel: { ...TYPE.micro, letterSpacing: 0.5, color: COLORS.muted, marginBottom: SPACE.xs + 1 },
  copyFieldRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  copyFieldValue: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.text },
  copyFieldValueLg: { fontSize: 18, letterSpacing: 0.5 },
  copyBtn: { width: 32, height: 32, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  copyBtnDone: { backgroundColor: COLORS.greenSoft },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight, marginHorizontal: SPACE.lg },
  expiryRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  expiryText: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
  // Steps
  stepsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.md + 2, ...GLASS_BORDER, ...CARD_SHADOW },
  stepsTitle: { ...TYPE.eyebrow, color: COLORS.muted, marginBottom: SPACE.lg },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md, marginBottom: SPACE.xs },
  stepDotWrap: { alignItems: "center", width: 28 },
  stepDot: { width: 28, height: 28, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  stepLine: { width: 2, height: 16, backgroundColor: COLORS.borderLight, marginTop: 2 },
  stepText: { flex: 1, fontSize: 13, fontWeight: "500", color: COLORS.text, paddingTop: 5, lineHeight: 18 },
  // Limits/fees chips
  limitsRow: { flexDirection: "row", gap: SPACE.sm, flexWrap: "wrap" },
  limitChip: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 1, backgroundColor: COLORS.card, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm - 1, ...GLASS_BORDER, ...CARD_SHADOW },
  limitChipText: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  // Form card
  formCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.md, ...GLASS_BORDER, ...CARD_SHADOW },
  formLabel: { ...TYPE.eyebrow, color: COLORS.muted, marginBottom: SPACE.md },
  savedCardRow: { flexDirection: "row", alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACE.sm },
  savedCardRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  savedCardName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  savedCardMeta: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  saveCardRow: { flexDirection: "row", alignItems: "center", marginTop: SPACE.lg, gap: 10 },
  saveCardCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  saveCardCheckboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  saveCardText: { fontSize: 13, color: COLORS.muted, fontWeight: "500" },
  amtRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  amtSym: { fontSize: 26, fontWeight: "700", color: COLORS.muted },
  amtInput: { flex: 1, fontSize: 36, fontWeight: "700", color: COLORS.text, padding: 0 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", ...GLASS_BORDER_SUBTLE, ...CARD_SHADOW, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md + 2, height: 48 },
  inputText: { flex: 1, fontSize: 15, fontWeight: "600" },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
  fieldHint: { fontSize: 11, color: COLORS.muted, fontWeight: "500", marginTop: SPACE.sm, lineHeight: 16 },
  feeRow: { flexDirection: "row", gap: SPACE.sm, flexWrap: "wrap", marginBottom: SPACE.lg },
  feeChip: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, backgroundColor: COLORS.card, borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm + 2, paddingVertical: SPACE.sm, ...GLASS_BORDER, ...CARD_SHADOW },
  feeChipText: { fontSize: 11, fontWeight: "600", color: COLORS.textSecondary },
  // CTA
  cta: { borderRadius: RADIUS.md, overflow: "hidden", marginBottom: SPACE.md, backgroundColor: COLORS.actionBg },
  ctaInner: { paddingVertical: SPACE.lg + 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaText: { color: COLORS.actionText, fontSize: 15, fontWeight: "700" },
  checkoutNote: { fontSize: 12, color: COLORS.muted, textAlign: "center", lineHeight: 18, fontWeight: "500" },
  // Error / status
  errorIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.errorLight, justifyContent: "center", alignItems: "center", marginBottom: SPACE.md + 2 },
  errorTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  errorSub: { fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: SPACE.sm, lineHeight: 20 },
  retryBtn: { flexDirection: "row", alignItems: "center", marginTop: SPACE.xl, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md },
  retryText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  statusIcon: { width: 80, height: 80, borderRadius: RADIUS.full, justifyContent: "center", alignItems: "center", marginBottom: SPACE.lg },
  statusTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  statusSub: { fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: SPACE.sm, lineHeight: 20 },
  txRef: { fontSize: 11, color: COLORS.muted, fontWeight: "600", marginTop: SPACE.md, fontFamily: "monospace" },
  // Network picker
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  // Identity (BVN/NIN) collection
  idPromptIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: SPACE.md + 2 },
  idSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: SPACE.xl, paddingTop: SPACE.sm, paddingBottom: SPACE.xxxl },
  idSheetHeader: { alignItems: "center", marginTop: SPACE.sm, marginBottom: SPACE.xl },
  idSheetIcon: { width: 48, height: 48, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: SPACE.md },
  idSheetTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.sm },
  idSheetSub: { fontSize: 13, color: COLORS.muted, fontWeight: "500", textAlign: "center", lineHeight: 19, paddingHorizontal: SPACE.sm },
  idModeRow: { flexDirection: "row", backgroundColor: COLORS.bgTertiary, borderRadius: RADIUS.sm, padding: SPACE.xs, marginBottom: SPACE.xl - 2 },
  idModeBtn: { flex: 1, paddingVertical: SPACE.sm + 2, borderRadius: RADIUS.xs + 1, alignItems: "center" },
  idModeBtnActive: { backgroundColor: COLORS.card, ...GLASS_BORDER, ...CARD_SHADOW },
  idModeText: { fontSize: 13, fontWeight: "700", color: COLORS.muted },
  idModeTextActive: { color: COLORS.primary },
  idFieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.sm },
  idFieldError: { fontSize: 12, color: COLORS.red, fontWeight: "600", marginTop: SPACE.xs + 2 },
  idPrivacyRow: { flexDirection: "row", alignItems: "flex-start", marginTop: SPACE.md + 2, marginBottom: SPACE.xl },
  idPrivacyText: { flex: 1, fontSize: 11, color: COLORS.muted, fontWeight: "500", lineHeight: 16 },
  idCancelText: { fontSize: 13, fontWeight: "700", color: COLORS.muted },
  networkSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingBottom: SPACE.xxxl },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginTop: SPACE.md - 2, marginBottom: SPACE.sm },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, paddingHorizontal: SPACE.xl, paddingBottom: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
  networkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
  networkRowSelected: { backgroundColor: COLORS.primaryLight },
  networkName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
});
