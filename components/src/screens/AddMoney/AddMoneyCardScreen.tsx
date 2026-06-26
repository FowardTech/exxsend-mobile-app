import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import AppText from "../../../AppText";
import AppTextInput from "../../../AppTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { fundWithCard } from "../../../../api/paysafe";
import ScreenHeader from "../../../../components/ScreenHeader";
import { COLORS } from "@/theme/colors";

const SAVED_KEY = "saved_cards_v1";

interface SavedCard { id: string; last4: string; brand: string; cardholderName: string; expiryMonth: string; expiryYear: string; }

function detectBrand(num: string) {
  const n = num.replace(/\s/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  return "Card";
}
function formatNum(t: string) {
  return t.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function CardVisual({ number, name, expiry, brand }: { number: string; name: string; expiry: string; brand: string }) {
  const masked = number ? number.padEnd(19, "·").slice(0, 19) : "···· ···· ···· ····";
  return (
    <LinearGradient colors={["#315CFD", "#1E3FBF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={cv.card}>
      <View style={{ position: "absolute", right: -20, top: -20, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.07)" }} />
      <View style={{ position: "absolute", right: 50, bottom: -40, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.05)" }} />
      <View style={cv.top}>
        <View style={cv.chip}><View style={cv.chipLine} /></View>
        <AppText style={cv.brand}>{brand}</AppText>
      </View>
      <AppText style={cv.number}>{masked}</AppText>
      <View style={cv.bottom}>
        <View>
          <AppText style={cv.smallLabel}>Card holder</AppText>
          <AppText style={cv.smallValue}>{name || "YOUR NAME"}</AppText>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText style={cv.smallLabel}>Expires</AppText>
          <AppText style={cv.smallValue}>{expiry || "MM / YY"}</AppText>
        </View>
      </View>
    </LinearGradient>
  );
}

const cv = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, marginBottom: 24, overflow: "hidden", height: 200, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chip: { width: 36, height: 28, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.3)", justifyContent: "center", padding: 4 },
  chipLine: { height: 1, backgroundColor: "rgba(255,255,255,0.5)", marginVertical: 3 },
  brand: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 14, letterSpacing: 1 },
  number: { color: "#FFFFFF", fontSize: 18, fontWeight: "600", letterSpacing: 3, marginTop: 16 },
  bottom: { flexDirection: "row", justifyContent: "space-between" },
  smallLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  smallValue: { color: "#FFFFFF", fontWeight: "700", fontSize: 14, marginTop: 2 },
});

export default function AddMoneyCardScreen() {
  const params = useLocalSearchParams<{ currencyCode?: string }>();
  const ccy = params.currencyCode || "CAD";

  const [amount, setAmount]   = useState("");
  const [num, setNum]         = useState("");
  const [month, setMonth]     = useState("");
  const [year, setYear]       = useState("");
  const [cvv, setCvv]         = useState("");
  const [name, setName]       = useState("");
  const [save, setSave]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phone, setPhone]     = useState("");
  const [email, setEmail]     = useState("");

  const brand = detectBrand(num);
  const expiry = month && year ? `${month} / ${year}` : "";

  useEffect(() => {
    (async () => {
      const [p, u] = await Promise.all([AsyncStorage.getItem("user_phone"), AsyncStorage.getItem("user_info")]);
      if (p) setPhone(p);
      if (u) { try { const info = JSON.parse(u); setEmail(info.email || ""); const n = [info.firstName || info.first_name, info.lastName || info.last_name].filter(Boolean).join(" ").trim(); if (n) setName(n); } catch {} }
      const raw = await AsyncStorage.getItem(SAVED_KEY).catch(() => null);
      if (raw) setSavedCards(JSON.parse(raw));
    })();
  }, []);

  const selectSaved = (card: SavedCard) => {
    setSelectedId(card.id); setName(card.cardholderName); setMonth(card.expiryMonth); setYear(card.expiryYear); setNum(""); setCvv("");
  };

  const handlePay = async () => {
    if (!amount || parseFloat(amount) <= 0) { Alert.alert("Enter amount", "Please enter a valid amount."); return; }
    const rawNum = num.replace(/\s/g, "");
    const selectedCard = selectedId ? savedCards.find((c) => c.id === selectedId) : null;
    if (rawNum.length < 15) {
      Alert.alert(
        selectedCard ? "Confirm your card" : "Invalid card",
        selectedCard
          ? `For security, please re-enter the full card number for ${selectedCard.brand} •••• ${selectedCard.last4} to continue.`
          : "Please enter a valid card number."
      );
      return;
    }
    if (selectedCard && rawNum.slice(-4) !== selectedCard.last4) {
      Alert.alert("That doesn't match", `The number you entered doesn't match ${selectedCard.brand} •••• ${selectedCard.last4}. Please re-check, or use a different card.`);
      return;
    }
    if (!month || !year) { Alert.alert("Expiry required", "Please enter the card expiry date."); return; }
    if (cvv.length < 3) { Alert.alert("CVV required", "Please enter the 3 or 4 digit CVV."); return; }
    if (!name.trim()) { Alert.alert("Name required", "Please enter the cardholder name."); return; }
    setLoading(true);
    try {
      const result = await fundWithCard({ amount: parseFloat(amount), cardNumber: rawNum, expiryMonth: parseInt(month), expiryYear: parseInt(year), cvv, cardholderName: name.trim(), phone, email: email || undefined });
      if (result.success) {
        if (save && !selectedId) {
          const card: SavedCard = { id: Date.now().toString(), last4: rawNum.slice(-4), brand, cardholderName: name.trim(), expiryMonth: month, expiryYear: year };
          const updated = [...savedCards, card];
          await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(updated));
          setSavedCards(updated);
        }
        Alert.alert("Success 🎉", `${ccy} ${amount} has been added to your wallet.`, [{ text: "Done", onPress: () => router.back() }]);
      } else {
        Alert.alert("Payment failed", result.message || "Please check your card details and try again.");
      }
    } catch { Alert.alert("Error", "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="Add Money by Card" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Card visual */}
          <CardVisual number={num} name={name} expiry={expiry} brand={brand} />

          {/* Amount */}
          <View style={s.section}>
            <AppText style={s.sectionTitle}>Amount</AppText>
            <View style={s.amtRow}>
              <AppText style={s.ccy}>{ccy}</AppText>
              <AppTextInput
                value={amount} onChangeText={setAmount}
                keyboardType="decimal-pad" placeholder="0.00"
                placeholderTextColor={COLORS.muted}
                style={s.amtInput}
              />
            </View>
          </View>

          {/* Saved cards */}
          {savedCards.length > 0 && (
            <View style={s.section}>
              <AppText style={s.sectionTitle}>Saved Cards</AppText>
              {savedCards.map(card => (
                <Pressable key={card.id} onPress={() => selectSaved(card)}
                  style={[s.savedRow, selectedId === card.id && s.savedRowActive]}>
                  <View style={s.savedIcon}>
                    <Ionicons name="card-outline" size={18} color={selectedId === card.id ? COLORS.primary : COLORS.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.savedName}>{card.brand} •••• {card.last4}</AppText>
                    <AppText style={s.savedMeta}>{card.cardholderName} · {card.expiryMonth}/{card.expiryYear}</AppText>
                  </View>
                  {selectedId === card.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </Pressable>
              ))}
              <Pressable onPress={() => { setSelectedId(null); setNum(""); setMonth(""); setYear(""); setCvv(""); }} style={s.useNewBtn}>
                <AppText style={s.useNewText}>+ Use a different card</AppText>
              </Pressable>
            </View>
          )}

          {/* Card details form */}
          <View style={s.section}>
            <AppText style={s.sectionTitle}>{selectedId ? "Confirm Card" : "Card Details"}</AppText>
            {!!selectedId && (
              <AppText style={s.confirmHint}>
                For your security, re-enter the full card number and CVV to confirm this is the right card.
              </AppText>
            )}

            <AppText style={s.fieldLabel}>Card number</AppText>
            <View style={s.inputRow}>
              <Ionicons name="card-outline" size={18} color={COLORS.muted} style={{ marginRight: 10 }} />
              <AppTextInput value={num} onChangeText={t => setNum(formatNum(t))} keyboardType="number-pad" placeholder="1234 5678 9012 3456" placeholderTextColor={COLORS.muted} style={s.input} maxLength={19} />
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <AppText style={s.fieldLabel}>Month</AppText>
                <AppTextInput
                  value={month} onChangeText={t => setMonth(t.replace(/\D/g, "").slice(0, 2))}
                  keyboardType="number-pad" placeholder="MM" placeholderTextColor={COLORS.muted}
                  editable={!selectedId}
                  style={[s.inputPlain, !!selectedId && s.inputLocked]} maxLength={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.fieldLabel}>Year</AppText>
                <AppTextInput
                  value={year} onChangeText={t => setYear(t.replace(/\D/g, "").slice(0, 2))}
                  keyboardType="number-pad" placeholder="YY" placeholderTextColor={COLORS.muted}
                  editable={!selectedId}
                  style={[s.inputPlain, !!selectedId && s.inputLocked]} maxLength={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.fieldLabel}>CVV</AppText>
                <AppTextInput value={cvv} onChangeText={t => setCvv(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="•••" placeholderTextColor={COLORS.muted} style={s.inputPlain} secureTextEntry maxLength={4} />
              </View>
            </View>

            <AppText style={[s.fieldLabel, { marginTop: 14 }]}>Cardholder name</AppText>
            <AppTextInput
              value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={COLORS.muted}
              autoCapitalize="words" editable={!selectedId}
              style={[s.inputPlain, !!selectedId && s.inputLocked]}
            />

            {!selectedId && (
              <Pressable onPress={() => setSave(v => !v)} style={s.saveRow}>
                <View style={[s.checkbox, save && s.checkboxOn]}>
                  {save && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <AppText style={s.saveText}>Save this card for future payments</AppText>
              </Pressable>
            )}
          </View>

          {/* Pay button */}
          <Pressable onPress={handlePay} disabled={loading} style={({ pressed }) => [s.payBtn, (loading) && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}>
            <View style={s.payInner}>
              {loading
                ? <ActivityIndicator color={COLORS.actionText} />
                : <AppText style={s.payText}>Add {amount ? `${ccy} ${amount}` : "Money"}</AppText>
              }
            </View>
          </Pressable>

          <View style={s.secureRow}>
            <Ionicons name="lock-closed" size={12} color={COLORS.green} />
            <AppText style={s.secureText}>Your payment is secured by Paysafe</AppText>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { padding: 20, paddingBottom: 40 },
  section: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderLight },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 14 },
  confirmHint: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: -8, marginBottom: 14, lineHeight: 17 },
  amtRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ccy: { fontSize: 16, fontWeight: "700", color: COLORS.muted },
  amtInput: { flex: 1, fontSize: 32, fontWeight: "700", color: COLORS.text, padding: 0 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 50 },
  input: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text, padding: 0 },
  inputPlain: { backgroundColor: COLORS.bg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 50, fontSize: 15, fontWeight: "600", color: COLORS.text },
  inputLocked: { backgroundColor: COLORS.borderLight, color: COLORS.muted },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  saveRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  checkboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  saveText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  savedRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: 10 },
  savedRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  savedIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", marginRight: 12 },
  savedName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  savedMeta: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  useNewBtn: { paddingTop: 8, alignItems: "center" },
  useNewText: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  payBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 14, backgroundColor: COLORS.actionBg },
  payInner: { paddingVertical: 17, alignItems: "center", justifyContent: "center" },
  payText: { color: COLORS.actionText, fontSize: 15, fontWeight: "700" },
  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  secureText: { fontSize: 12, color: COLORS.muted, fontWeight: "600" },
});
