import { getUserProfile } from "@/api/config";
import { getCurrencySymbol } from "@/api/flutterwave";
import { createSubscriptionPaymentIntent, getSubscriptionPlans, getWalletOptions, SubscriptionPlan, WalletOption } from "@/api/investments";
import AppText from "@/components/AppText";
import BackButton from "@/components/BackButton";
import { useCustomAlert } from "@/components/CustomAlert";
import { COLORS } from "@/theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SCREEN_PADDING, SPACE } from "@/theme/designSystem";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CardField, StripeProvider, useConfirmPayment } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WalletOptionsSheet from "./WalletOptionsSheet";
import WalletPinModal from "./WalletPinModal";

export default function InvestPaywallScreen({
  embedded = false,
  onSubscribed,
}: {
  /** True when rendered inline inside the Invest tab itself (no subscription
   * yet) rather than reached by navigating to a standalone route. There's no
   * real "back" destination in that context, so the header is hidden. */
  embedded?: boolean;
  /** Called after a successful subscription when embedded, instead of
   * navigating to a standalone route — the parent tab re-checks status and
   * swaps to its real content on its own. */
  onSubscribed?: () => void;
}) {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [phone, setPhone] = useState("");
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  // "plan" shows the plan card + Wallet/Card choice; "card" swaps the body
  // for the custom in-app card form, matching exactly how the wallet
  // top-up flow swaps its own view rather than navigating to a new screen.
  const [viewMode, setViewMode] = useState<"plan" | "card">("plan");

  // Pay-with-wallet flow: tapping the button fetches every wallet's live
  // FX-converted price first (GET /wallet-options) — if exactly one wallet
  // can actually cover it, skip straight to PIN entry; otherwise show the
  // picker so the user chooses which wallet to pay from.
  const [walletOptionsLoading, setWalletOptionsLoading] = useState(false);
  const [walletPickerVisible, setWalletPickerVisible] = useState(false);
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [walletPriceInfo, setWalletPriceInfo] = useState<{ priceCurrency: string; price: number }>({ priceCurrency: "USD", price: 0 });
  const [selectedWalletCurrency, setSelectedWalletCurrency] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const savedPhone = (await AsyncStorage.getItem("user_phone")) || "";
        setPhone(savedPhone);

        let ccy = "USD";
        if (savedPhone) {
          const profile = await getUserProfile(savedPhone);
          if (profile.success && profile.user?.homeCurrency) ccy = profile.user.homeCurrency;
        }
        setBaseCurrency(ccy);

        const res = await getSubscriptionPlans(ccy);
        if (res.success && res.plans.length > 0) {
          setPlan(res.plans[0]);
        }
      } catch { }
      setLoading(false);
    })();
  }, []);

  const onWalletSubscribeSuccess = () => {
    setWalletModalVisible(false);
    if (embedded && onSubscribed) {
      onSubscribed();
    } else {
      router.replace("/investoverview" as any);
    }
  };

  const handlePayFromWallet = async () => {
    if (!phone) return;
    setWalletOptionsLoading(true);
    try {
      const res = await getWalletOptions(phone);
      if (!res.success) {
        showAlert("Couldn't load wallets", res.message || "Please try again.");
        return;
      }
      setWalletPriceInfo({ priceCurrency: res.priceCurrency, price: res.price });
      setWalletOptions(res.options);

      const sufficientOnes = res.options.filter((o) => o.sufficient);
      if (sufficientOnes.length === 1) {
        // Only one wallet can actually cover it — skip the picker and go
        // straight to PIN entry, per the spec.
        setSelectedWalletCurrency(sufficientOnes[0].currency);
        setWalletModalVisible(true);
      } else {
        // Either several wallets qualify (let the user choose) or none do
        // (show the picker anyway so they can see balances vs. what's
        // needed, rather than a bare "insufficient funds" with no context).
        setWalletPickerVisible(true);
      }
    } catch {
      showAlert("Couldn't load wallets", "Please try again.");
    } finally {
      setWalletOptionsLoading(false);
    }
  };

  const handleWalletOptionSelected = (option: WalletOption) => {
    setWalletPickerVisible(false);
    setSelectedWalletCurrency(option.currency);
    setWalletModalVisible(true);
  };

  const sym = getCurrencySymbol(baseCurrency);
  const nativeSym = plan ? getCurrencySymbol(plan.currency) : "";

  if (viewMode === "card") {
    return (
      <SubscriptionCardView
        phone={phone}
        onBack={() => setViewMode("plan")}
        embedded={embedded}
        onSubscribed={onSubscribed}
      />
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any)} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.heroIcon}>
          <Ionicons name="trending-up" size={32} color={COLORS.primary} />
        </View>
        <AppText style={s.title}>Trade Stocks with ExxSend</AppText>
        <AppText style={s.subtitle}>
          Connect your brokerage and track every holding in your home currency.
        </AppText>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : plan ? (
          <View style={s.planCard}>
            <AppText style={s.planLabel}>{plan.billingInterval === "year" ? "Annual" : "Monthly"} plan</AppText>
            <View style={s.priceRow}>
              <AppText style={s.priceBig}>
                {sym}{plan.priceInBase.toFixed(2)}
              </AppText>
              <AppText style={s.priceSuffix}>/{plan.billingInterval}</AppText>
            </View>
            {plan.currency !== baseCurrency && (
              <AppText style={s.priceSmall}>
                ({nativeSym}{plan.price.toFixed(2)} {plan.currency})
              </AppText>
            )}

            <View style={s.featureList}>
              {plan.features.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                  <AppText style={s.featureText}>{f}</AppText>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.planCard}>
            <AppText style={s.errorText}>Couldn't load the Stock plan. Please try again later.</AppText>
          </View>
        )}

        {!!plan && (
          <View style={s.buttonsWrap}>
            <Pressable
              onPress={handlePayFromWallet}
              disabled={walletOptionsLoading}
              style={[s.btn, s.btnPrimary, walletOptionsLoading && { opacity: 0.7 }]}
            >
              {walletOptionsLoading ? (
                <ActivityIndicator color={COLORS.actionText} />
              ) : (
                <>
                  <Ionicons name="wallet-outline" size={18} color={COLORS.actionText} style={{ marginRight: 8 }} />
                  <AppText style={s.btnPrimaryText}>Pay from Wallet</AppText>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => setViewMode("card")}
              style={[s.btn, s.btnSecondary]}
            >
              <Ionicons name="card-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
              <AppText style={s.btnSecondaryText}>Pay with Card</AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <WalletOptionsSheet
        visible={walletPickerVisible}
        onClose={() => setWalletPickerVisible(false)}
        priceCurrency={walletPriceInfo.priceCurrency}
        price={walletPriceInfo.price}
        options={walletOptions}
        onSelect={handleWalletOptionSelected}
      />

      <WalletPinModal
        visible={walletModalVisible}
        onClose={() => setWalletModalVisible(false)}
        onSuccess={onWalletSubscribeSuccess}
        phone={phone}
        walletCurrency={selectedWalletCurrency}
      />
    </SafeAreaView>
  );
}

/**
 * Custom in-app card UI for subscribing, mirroring the wallet top-up's
 * StripeCardTopUpView (components/src/screens/AddMoney/AddMoneyLocalScreen.tsx)
 * exactly: our own styled CardField for entry, useConfirmPayment to confirm
 * directly with Stripe, no hosted Checkout page or WebView involved. Stripe
 * SDK still owns the actual card number/expiry/CVC text entry internally
 * for PCI compliance, but every pixel around it is ours.
 *
 * Differs from the wallet top-up version in one structural way: the amount
 * is the plan's fixed price, not something the user types in, so there's
 * no amount-entry card at all — just the price recap and the card field.
 */
function SubscriptionCardView({
  phone,
  onBack,
  embedded,
  onSubscribed,
}: {
  phone: string;
  onBack: () => void;
  embedded?: boolean;
  onSubscribed?: () => void;
}) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!phone) {
        setInitError("Could not find your account phone number. Please try logging in again.");
        setInitializing(false);
        return;
      }
      const res = await createSubscriptionPaymentIntent(phone);
      if (!res.success || !res.clientSecret || !res.publishableKey) {
        setInitError(res.message || "Could not start payment. Please try again.");
        setInitializing(false);
        return;
      }
      setClientSecret(res.clientSecret);
      setPublishableKey(res.publishableKey);
      setAmount(res.amount ?? null);
      setCurrency(res.currency || "");
      setInitializing(false);
    })();
  }, [phone]);

  if (initializing) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <BackButton onPress={onBack} />
        </View>
        <View style={s.centeredFill}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (initError || !clientSecret || !publishableKey) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <BackButton onPress={onBack} />
        </View>
        <View style={s.centeredFill}>
          <View style={s.heroIcon}>
            <Ionicons name="alert-circle-outline" size={32} color={COLORS.red} />
          </View>
          <AppText style={s.errorText}>{initError || "Something went wrong."}</AppText>
          <Pressable onPress={onBack} style={[s.btn, s.btnSecondary, { marginTop: SPACE.xl, width: "100%" }]}>
            <AppText style={s.btnSecondaryText}>Go back</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <StripeProvider publishableKey={publishableKey}>
      <SubscriptionCardForm
        clientSecret={clientSecret}
        amount={amount}
        currency={currency}
        onBack={onBack}
        embedded={embedded}
        onSubscribed={onSubscribed}
      />
    </StripeProvider>
  );
}

function SubscriptionCardForm({
  clientSecret,
  amount,
  currency,
  onBack,
  embedded,
  onSubscribed,
}: {
  clientSecret: string;
  amount: number | null;
  currency: string;
  onBack: () => void;
  embedded?: boolean;
  onSubscribed?: () => void;
}) {
  const router = useRouter();
  const { showAlert } = useCustomAlert();
  const { confirmPayment, loading: confirming } = useConfirmPayment();
  const [cardDetails, setCardDetails] = useState<{ complete: boolean } | null>(null);
  const [paying, setPaying] = useState(false);
  const [status, setStatus] = useState<"idle" | "success">("idle");

  const sym = currency ? getCurrencySymbol(currency) : "";
  const canPay = !!cardDetails?.complete && !paying && !confirming;

  const handlePay = async () => {
    if (!cardDetails?.complete) {
      showAlert("Card details incomplete", "Please enter your full card number, expiry, and CVC.");
      return;
    }

    setPaying(true);
    try {
      // Same confirmPayment call the wallet top-up uses — confirms directly
      // with Stripe using our own CardField, no hosted page involved. The
      // backend's invoice.payment_succeeded webhook activates the
      // subscription once this succeeds; no separate confirm call needed
      // on our end the way the wallet top-up needs (that one credits a
      // wallet balance directly, this one just needs Stripe to confirm).
      const { error: confirmError, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: "Card",
      });

      if (confirmError) {
        showAlert("Payment failed", confirmError.message || "Your card could not be charged.");
        setPaying(false);
        return;
      }

      if (paymentIntent?.status === "Succeeded" || paymentIntent?.status === "RequiresCapture") {
        setStatus("success");
      } else {
        showAlert(
          "Payment pending",
          "Your card was processed but the payment hasn't completed yet. We'll activate your subscription shortly once it's confirmed."
        );
      }
    } catch (e: any) {
      showAlert("Error", e?.message || "Something went wrong while processing your payment.");
    } finally {
      setPaying(false);
    }
  };

  if (status === "success") {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centeredFill}>
          <View style={[s.heroIcon, { backgroundColor: COLORS.greenSoft }]}>
            <Ionicons name="checkmark-circle" size={32} color={COLORS.green} />
          </View>
          <AppText style={s.title}>Subscription active</AppText>
          <AppText style={s.subtitle}>Your Stock subscription is now active.</AppText>
          <Pressable
            onPress={() => embedded && onSubscribed ? onSubscribed() : router.replace("/investoverview" as any)}
            style={[s.btn, s.btnPrimary, { marginTop: SPACE.xl, width: "100%" }]}
          >
            <AppText style={s.btnPrimaryText}>Continue</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <BackButton onPress={onBack} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.heroIcon}>
            <Ionicons name="card-outline" size={32} color={COLORS.primary} />
          </View>
          <AppText style={s.title}>Pay with Card</AppText>
          {amount != null && (
            <AppText style={s.subtitle}>
              You'll be charged {sym}{amount.toFixed(2)} {currency} now, then renews automatically.
            </AppText>
          )}

          <View style={s.cardFormCard}>
            <AppText style={s.planLabel}>CARD DETAILS</AppText>
            <CardField
              postalCodeEnabled={false}
              placeholders={{ number: "4242 4242 4242 4242" }}
              cardStyle={{
                backgroundColor: "#FFFFFF",
                // See AddMoneyLocalScreen.tsx for why this can't be an
                // rgba() string — Stripe's CardField hands this straight to
                // Android's native Color.parseColor(), which crashes on
                // CSS-style colors. #59B4C3E1 = rgba(180,195,225,0.35).
                borderColor: "#59B4C3E1",
                borderWidth: 1,
                textColor: COLORS.text,
                placeholderColor: COLORS.muted,
                borderRadius: 10,
                fontSize: 15,
              }}
              style={{ width: "100%", height: 50, marginTop: SPACE.xs + 2 }}
              onCardChange={(details) => setCardDetails({ complete: details.complete })}
            />
          </View>

          <Pressable
            onPress={handlePay}
            disabled={!canPay}
            style={[s.btn, s.btnPrimary, { width: "100%", marginTop: SPACE.xl, opacity: canPay ? 1 : 0.5 }]}
          >
            {(paying || confirming) ? (
              <ActivityIndicator color={COLORS.actionText} />
            ) : (
              <>
                <Ionicons name="lock-closed" size={15} color={COLORS.actionText} style={{ marginRight: 6 }} />
                <AppText style={s.btnPrimaryText}>
                  Subscribe{amount != null ? ` — ${sym}${amount.toFixed(2)}` : ""}
                </AppText>
              </>
            )}
          </Pressable>
          <AppText style={s.checkoutNote}>
            Your card details are encrypted and sent directly to Stripe — they never pass through our servers.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.sm },
  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: SPACE.lg, paddingBottom: SPACE.huge, alignItems: "center" },
  centeredFill: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SCREEN_PADDING },
  heroIcon: { width: 72, height: 72, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: SPACE.lg },
  title: { fontSize: 22, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.muted, textAlign: "center", marginTop: SPACE.sm, lineHeight: 20, paddingHorizontal: SPACE.lg },
  planCard: { width: "100%", backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xxl, marginTop: SPACE.xxl, alignItems: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  cardFormCard: { width: "100%", backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACE.xl, marginTop: SPACE.xxl, ...GLASS_BORDER, ...CARD_SHADOW },
  planLabel: { fontSize: 12, fontWeight: "600", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: SPACE.sm },
  priceBig: { fontSize: 40, fontWeight: "600", color: COLORS.text, letterSpacing: -1 },
  priceSuffix: { fontSize: 16, fontWeight: "600", color: COLORS.muted, marginBottom: 6, marginLeft: 4 },
  priceSmall: { fontSize: 13, color: COLORS.muted, fontWeight: "600", marginTop: 2 },
  featureList: { width: "100%", marginTop: SPACE.xl, gap: SPACE.md },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  featureText: { fontSize: 14, color: COLORS.text, flex: 1 },
  errorText: { fontSize: 14, color: COLORS.muted, textAlign: "center" },
  checkoutNote: { fontSize: 12, color: COLORS.muted, textAlign: "center", marginTop: SPACE.lg, lineHeight: 18, paddingHorizontal: SPACE.lg },
  buttonsWrap: { width: "100%", marginTop: SPACE.xxl, gap: SPACE.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md, paddingVertical: SPACE.lg },
  btnPrimary: { backgroundColor: COLORS.actionBg },
  btnPrimaryText: { color: COLORS.actionText, fontSize: 15, fontWeight: "600" },
  btnSecondary: { backgroundColor: COLORS.primaryLight },
  btnSecondaryText: { color: COLORS.primary, fontSize: 15, fontWeight: "600" },
});
