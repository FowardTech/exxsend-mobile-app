import { Ionicons } from "@expo/vector-icons";
/**
 * RecipientConfirmScreen - Confirm and execute transfer to Flutterwave-supported countries or Interac (CAD)
 *
 * ✅ Update added from the other code:
 * - Interac security question + answer fields
 * - Validate Q&A before showing PIN modal
 * - Pass securityQuestion/securityAnswer to sendInteracPayout
 *
 * (Your original UI + otherstyles layout is preserved.)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, Alert, ActivityIndicator, ScrollView, Platform, Switch } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import ScreenShell from "../../../components/ScreenShell";
import PinVerificationModal from "../../../components/PinVerificationModal";
import { useOtherStyles } from "../../../theme/otherstyles";
import { useStyles } from "../../../theme/styles";
import {
  sendFlutterwave,
  getCurrencySymbol,
  COUNTRY_NAMES,
  CURRENCY_TO_COUNTRY,
  isFlutterwaveCurrency,
} from "../../../api/flutterwave";
import { saveRecipientToDB, recordRecentRecipient } from "../../../api/sync";
import { classify403, executeCurrencyCloudWithdrawal } from "../../../api/config";
import { toPayoutType } from "../../../api/corridors";
import { fetchMyFeeWaivers } from "../../../api/feeWaivers";

import { sendInteracPayout } from "../../../api/paysafe";
import { useAppTheme } from "@/theme/ThemeProvider";
import { checkLiquidity, isLiquidityLowResponse, LiquidityResult } from "../../../api/liquidity";
import LiquidityBanner from "../../../components/LiquidityBanner";

interface RecipientData {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  countryCode: string;
  isInterac?: boolean | string;
  payoutMethod?: string;
  payoutType?: string;
  beneficiaryId?: string;
  bankCountry?: string;
  iban?: string;
  bicSwift?: string;
  routingFieldType?: "aba" | "sort_code" | "bsb_code" | "iban_only" | null;
  routingNumber?: string;
  sortCode?: string;
  bsbCode?: string;
  // Optional network fields used in recent-recipient recording and other flows
  networkCode?: string;
  networkName?: string;
  // Whether the recipient's name has been verified by the backend
  nameVerified?: boolean;
}

export default function RecipientConfirmScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const otherstyles = useOtherStyles();
  const params = useLocalSearchParams<{
    destCurrency: string;
    fromWalletId: string;
    fromCurrency: string;
    fromAmount: string;
    toAmount: string;
    rate?: string;
    recipient: string;
    mode: string;
  }>();

  const [userPhone, setUserPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  // Only meaningful for a genuinely new recipient (no beneficiaryId — one
  // picked from "saved beneficiary" is already saved, so there's nothing
  // to ask about). Defaults on since saving is the common case.
  const [saveRecipientToggle, setSaveRecipientToggle] = useState(true);

  // ✅ Interac security Q&A state (NEW)
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");

  const recipient: RecipientData | null = useMemo(() => {
    try {
      return params.recipient ? (JSON.parse(params.recipient) as RecipientData) : null;
    } catch {
      return null;
    }
  }, [params.recipient]);

  // Detect Interac: check isInterac flag OR bankCode === "INTERAC"
  const isInterac = useMemo(() => {
    if (!recipient) return false;
    if (recipient.isInterac === true || recipient.isInterac === "true") return true;
    if (recipient.bankCode === "INTERAC") return true;
    return false;
  }, [recipient]);

  const destCurrency = (recipient?.currency || params.destCurrency || "NGN").toUpperCase();

  // Detect the CurrencyCloud corridor (USD/GBP/AUD/EUR/... per api/corridors.ts).
  // recipient.payoutMethod is the primary signal, but several different
  // recipient-construction paths (manual entry, saved beneficiary,
  // prefilled-from-Home, saved-recipient tap) all have to set it correctly
  // for this to work, and more than one of them has been found getting it
  // wrong over time — each time, the symptom was a CurrencyCloud-only
  // currency (most recently GBP) silently falling through to the
  // Flutterwave branch below and failing with "currency not supported for
  // Flutterwave payouts", since Flutterwave only covers a specific, fixed
  // list of currencies. Rather than trust payoutMethod alone, fall back to
  // deriving it from the currency itself: if it's not Interac and not a
  // currency Flutterwave actually supports, it has to be CurrencyCloud by
  // elimination — there's no fourth destination in this app's routing.
  const isCurrencyCloud = useMemo(() => {
    if (!recipient || isInterac) return false;
    if (recipient.payoutMethod === "currencycloud") return true;
    // An explicit, different non-CC method (e.g. "momo") should still be
    // trusted — only fall back when payoutMethod is missing/ambiguous.
    if (recipient.payoutMethod && recipient.payoutMethod !== "bank") return false;
    return !isFlutterwaveCurrency(destCurrency);
  }, [recipient, isInterac, destCurrency]);

  const countryCode = recipient?.countryCode || CURRENCY_TO_COUNTRY[destCurrency] || "NG";
  const countryName = isInterac ? "Canada" : COUNTRY_NAMES[countryCode] || countryCode;

  const symbol = getCurrencySymbol(destCurrency);
  const fromCurrency = (params.fromCurrency || "USD").toUpperCase();
  const fromSymbol = getCurrencySymbol(fromCurrency);

  const fromAmount = Number.parseFloat(params.fromAmount || "0") || 0;
  const toAmount = Number.parseFloat(params.toAmount || "0") || 0;

  const rate = params.rate ? Number.parseFloat(params.rate) : null;
  const showRate = !!rate && fromCurrency !== destCurrency;

  const formattedToAmount = useMemo(() => {
    return `${symbol}${toAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [symbol, toAmount]);

  const formattedFromAmount = useMemo(() => {
    return `${fromSymbol}${fromAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${fromCurrency}`;
  }, [fromSymbol, fromAmount, fromCurrency]);

  const formattedRate = useMemo(() => {
    if (!rate) return "";
    return `1 ${fromCurrency} = ${rate.toFixed(4)} ${destCurrency}`;
  }, [rate, fromCurrency, destCurrency]);

  useEffect(() => {
    AsyncStorage.getItem("user_phone").then((phone) => {
      if (phone) setUserPhone(phone);
    });
  }, []);

  // ── Liquidity pre-flight ──
  // Interac withdrawals (CAD) and bank-transfer sends both execute from this screen,
  // so we run the check against whichever operation actually applies here.
  const [liquidityBlock, setLiquidityBlock] = useState<LiquidityResult | null>(null);
  const [liquidityChecking, setLiquidityChecking] = useState(false);
  const liquidityCheckSeq = useRef(0);

  const runLiquidityCheck = useCallback(async () => {
    if (!toAmount || toAmount <= 0) {
      setLiquidityBlock(null);
      return;
    }
    const seq = ++liquidityCheckSeq.current;
    setLiquidityChecking(true);
    try {
      const result = await checkLiquidity({
        currency: destCurrency,
        amount: toAmount,
        operation: isInterac ? "interac_withdrawal" : "bank_withdrawal",
      });
      if (seq !== liquidityCheckSeq.current) return;
      setLiquidityBlock(result.ok ? null : result);
    } finally {
      if (seq === liquidityCheckSeq.current) setLiquidityChecking(false);
    }
  }, [toAmount, destCurrency, isInterac, isCurrencyCloud]);

  useEffect(() => {
    const debounce = setTimeout(runLiquidityCheck, 500);
    return () => clearTimeout(debounce);
  }, [runLiquidityCheck]);

  const handleConfirmButtonPress = () => {
    if (!recipient || !userPhone) {
      Alert.alert("Error", "Missing recipient or user information");
      return;
    }

    if (liquidityBlock) {
      Alert.alert("Try again soon", liquidityBlock.message);
      return;
    }

    // ✅ Validate Interac security Q&A before PIN modal (NEW)
    if (isInterac) {
      const q = securityQuestion.trim();
      const a = securityAnswer.trim();
      if (!q || q.length < 5) {
        Alert.alert("Security question required", "Please enter a security question (at least 5 characters).");
        return;
      }
      if (!a || a.length < 3) {
        Alert.alert("Security answer required", "Please enter a security answer (at least 3 characters).");
        return;
      }
    }

    setShowPinModal(true);
  };

  // Navigates straight to the Sumsub verification screen — unlike the old
  // Persona flow, no session needs to be pre-created here; the screen
  // fetches its own SDK token on mount.
  const handleVerifyIdentity = () => {
    router.push("/sumsub-verification" as any);
  };

  const handleConfirmSend = async () => {
    if (!recipient || !userPhone) {
      Alert.alert("Error", "Missing recipient or user information");
      return;
    }

    setSending(true);

    try {
      // Persist recipient BEFORE triggering payout — this avoids dangling
      // CurrencyCloud beneficiaries if the network call fails mid-flight.
      // If this attempt fails for any reason (transient network blip,
      // a validation edge case), it's retried once more after a
      // successful transfer below — by then we have positive confirmation
      // the bank details were valid, so the retry should succeed even if
      // the first attempt didn't. Without this, a failed pre-save with no
      // retry meant a successful withdrawal could still silently leave the
      // recipient missing from Saved Recipients.
      const persistRecipient = async (): Promise<string | undefined> => {
        try {
          const saveRes = await saveRecipientToDB({
            phone: userPhone,
            accountName: recipient.accountName,
            // IBAN-based corridors (EUR/CHF) keep the account identifier in
            // recipient.iban, not recipient.accountNumber — the saved-recipient
            // schema only has one generic account-number field, so without
            // this fallback those recipients were being saved with an empty
            // account number, silently losing the IBAN entirely.
            accountNumber: recipient.accountNumber || recipient.iban || "",
            bankCode: recipient.bankCode || (isInterac ? "INTERAC" : ""),
            bankName: recipient.bankName || (isInterac ? "Interac e-Transfer" : ""),
            currency: destCurrency,
            countryCode: isInterac ? "CA" : countryCode,
            isInterac: isInterac,
            payoutMethod: recipient.payoutMethod,
            // The backend's /users/recipients/saved 400s without this — it
            // validates payoutType (bank|momo|iban|interac), not payoutMethod
            // (this app's internal method name, e.g. "currencycloud", which
            // the backend doesn't recognize at all).
            payoutType: isInterac ? "interac" : (recipient.payoutType || toPayoutType((recipient.payoutMethod as any) || "bank")),
          });
          return saveRes?.recipient?.id;
        } catch (saveErr) {
          console.warn("[RecipientConfirmScreen] Save recipient failed:", saveErr);
          return undefined;
        }
      };

      // Already-saved beneficiaries persist regardless (idempotent — there's
      // nothing new to decide); a brand new recipient only gets saved if the
      // user left the "Save this recipient" toggle on.
      const shouldPersist = !!recipient.beneficiaryId || saveRecipientToggle;
      let savedRecipientId = shouldPersist ? await persistRecipient() : undefined;

      let response;

      if (isInterac) {
        // CAD via Interac e-Transfer (Paysafe)
        response = await sendInteracPayout({
          phone: userPhone,
          amount: toAmount,
          recipientEmail: recipient.accountNumber, // Email stored as accountNumber for Interac
          recipientName: recipient.accountName,
          message: `Transfer to ${recipient.accountName}`,
          // ✅ pass Q&A (NEW)
          securityQuestion: securityQuestion.trim(),
          securityAnswer: securityAnswer.trim(),
        });
      } else if (isCurrencyCloud) {
        // USD/GBP/AUD/EUR/... via CurrencyCloud Payments API, routed through the
        // same /withdrawal/execute endpoint the backend dispatches by currency.
        response = await executeCurrencyCloudWithdrawal({
          phone: userPhone,
          amount: toAmount,
          currency: destCurrency,
          narration: `Transfer to ${recipient.accountName}`,
          bankDetails: recipient.beneficiaryId
            ? { beneficiaryId: recipient.beneficiaryId }
            : {
                accountName: recipient.accountName,
                accountNumber: recipient.accountNumber || undefined,
                iban: recipient.iban || undefined,
                bankName: recipient.bankName,
                bankCountry: recipient.bankCountry || countryCode,
                routingNumber: recipient.routingFieldType === "aba" ? recipient.routingNumber : undefined,
                sortCode: recipient.routingFieldType === "sort_code" ? recipient.sortCode : undefined,
                bsbCode: recipient.routingFieldType === "bsb_code" ? recipient.bsbCode : undefined,
                bicSwift: recipient.bicSwift || undefined,
              },
        });
      } else {
        // African currencies via Flutterwave
        response = await sendFlutterwave({
          phone: userPhone,
          amount: toAmount,
          currency: destCurrency,
          accountNumber: recipient.accountNumber,
          bankCode: recipient.bankCode,
          bankName: recipient.bankName,
          accountName: recipient.accountName,
          fromCurrency: params.fromCurrency,
          fromAmount: fromAmount,
          narration: `Transfer to ${recipient.accountName}`,
        });
      }

      if (response.success) {
        if (!savedRecipientId && shouldPersist) {
          savedRecipientId = await persistRecipient();
        }

        // Best-effort — the server already decremented/awarded waiver
        // credits as part of processing the transfer; this just refreshes
        // what the app has cached so Home's fee-waiver banner reflects it
        // next time it's seen, without blocking on the result here.
        fetchMyFeeWaivers(userPhone).catch(() => {});

        // Local safety net for Home's "Recent recipients" row — recorded
        // synchronously here rather than depending solely on the backend's
        // /recipients/recent endpoint reflecting this transfer in time.
        recordRecentRecipient(userPhone, {
          id: savedRecipientId,
          accountName: recipient.accountName,
          accountNumber: recipient.accountNumber || recipient.iban,
          bankCode: recipient.bankCode,
          bankName: recipient.bankName,
          destCurrency,
          countryCode: recipient.countryCode,
          payoutMethod: recipient.payoutMethod,
          networkCode: recipient.networkCode,
          networkName: recipient.networkName,
          nameVerified: recipient.nameVerified,
          lastAmount: toAmount,
        }).catch(() => {});

        const successMessage = isInterac
          ? `An Interac e-Transfer of ${formattedToAmount} ${destCurrency} has been sent to ${recipient.accountNumber}`
          : `${formattedToAmount} ${destCurrency} has been sent to ${recipient.accountName}`;

        router.push({
          pathname: "/result",
          params: {
            type: "success",
            title: isInterac ? "Interac Transfer Sent" : "Transfer Successful",
            message: successMessage,
            amount: `${formattedToAmount} ${destCurrency}`,
            transactionId: (response as any)?.transaction_id || (response as any)?.reference || (response as any)?.id || "",
            fee: (response as any)?.fee != null ? `${(response as any).fee} ${destCurrency}` : "Free",
            recipientName: recipient.accountName,
            note: isInterac ? recipient.accountNumber : `${recipient.bankName || ""}`.trim(),
            primaryText: "Done",
            primaryRoute: "/(tabs)/",
            secondaryText: "Go to Home",
            secondaryRoute: "/(tabs)/",
          },
        });
      } else {
        const liquidityFail = isLiquidityLowResponse(response);
        if (liquidityFail) {
          Alert.alert("Try again in a few minutes", liquidityFail.message, [{ text: "OK" }]);
        } else {
          const errorMessage = isInterac
            ? `Interac e-Transfer to ${recipient.accountNumber} could not be completed`
            : `${formattedToAmount} ${destCurrency} could not be sent to ${recipient.accountName}`;

          router.push({
            pathname: "/result",
            params: {
              type: "error",
              title: "Transfer Failed",
              message: response.message || errorMessage,
              primaryText: "Try Again",
              primaryRoute: "/(tabs)/",
              secondaryText: "Go to Home",
              secondaryRoute: "/(tabs)/",
            },
          });
        }
      }
    } catch (error: any) {
      console.error("Transfer error:", error);
      const liquidityFail = isLiquidityLowResponse(error);
      if (liquidityFail) {
        Alert.alert("Try again in a few minutes", liquidityFail.message, [{ text: "OK" }]);
        setSending(false);
        return;
      }
      const gate = classify403(error);
      if (gate === "email") {
        Alert.alert("Email Verification Required", "Please verify your email address before sending money.", [
          { text: "Cancel", style: "cancel" },
          { text: "Verify Now", onPress: () => router.push("/checkemail" as any) },
        ]);
      } else if (gate === "kyc") {
        Alert.alert("Identity Verification Required", "Please complete identity verification to send money.", [
          { text: "Cancel", style: "cancel" },
          { text: "Verify Identity", onPress: handleVerifyIdentity },
        ]);
      } else {
        Alert.alert("Transfer Failed", error?.message || "An error occurred. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  if (!recipient) {
    return (
      <ScreenShell keyboardAware>
        <View style={otherstyles.confirmInvalidWrap}>
          <AppText style={otherstyles.confirmInvalidText}>Invalid recipient data</AppText>
          <Pressable style={otherstyles.confirmInvalidBtn} onPress={() => router.back()}>
            <AppText style={otherstyles.confirmInvalidBtnText}>Go Back</AppText>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  // Display values for Interac vs Bank transfers
  const transferMethodLabel = isInterac ? "Interac e-Transfer" : "Bank Transfer";
  const accountFieldLabel = isInterac ? "Email address" : "Account number";
  const bankFieldLabel = isInterac ? "Transfer method" : "Bank";
  const bankFieldValue = isInterac ? "Interac e-Transfer" : recipient.bankName;

  // Notice text differs for Interac vs bank transfers
  const noticeTitle = isInterac ? "Interac e-Transfer" : "Transfer timeline";
  const noticeText = isInterac
    ? "The recipient will receive an email to accept the transfer. Funds are typically available within minutes once accepted."
    : "Fees may apply. Transfers typically arrive within 24 hours depending on the bank.";

  return (
    <ScreenShell padded={false}>
      <ScrollView contentContainerStyle={otherstyles.confirmContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={otherstyles.confirmHeader}>
          <BackButton onPress={() => router.back()} />

          <View style={otherstyles.confirmHeaderCenter}>
            <AppText style={otherstyles.confirmTitle}>Confirm transfer</AppText>
            <AppText style={otherstyles.confirmSubtitle}>Review details before you send</AppText>
          </View>

          <View style={otherstyles.confirmHeaderRight} />
        </View>

        {/* Big Amount Card */}
        <View style={otherstyles.confirmHeroCard}>
          <AppText style={otherstyles.confirmHeroLabel}>Recipient gets</AppText>

          <AppText style={otherstyles.confirmHeroAmount} numberOfLines={1}>
            {formattedToAmount}
          </AppText>

          <View style={otherstyles.confirmHeroMetaRow}>
            <View style={otherstyles.confirmHeroPill}>
              <AppText style={otherstyles.confirmHeroPillText}>{destCurrency}</AppText>
            </View>

            <View style={otherstyles.confirmHeroDot} />

            <AppText style={otherstyles.confirmHeroMetaText}>
              {isInterac ? "Interac e-Transfer" : countryName}
            </AppText>
          </View>
        </View>

        {/* Breakdown */}
        <View style={otherstyles.confirmCard}>
          <View style={otherstyles.confirmRow}>
            <AppText style={otherstyles.confirmRowLabel}>You send</AppText>
            <AppText style={otherstyles.confirmRowValue}>{formattedFromAmount}</AppText>
          </View>

          {showRate && (
            <>
              <View style={otherstyles.confirmDivider} />
              <View style={otherstyles.confirmRow}>
                <AppText style={otherstyles.confirmRowLabel}>Exchange rate</AppText>
                <AppText style={otherstyles.confirmRowValueSmall}>{formattedRate}</AppText>
              </View>
            </>
          )}

          <View style={otherstyles.confirmDivider} />
          <View style={otherstyles.confirmRow}>
            <AppText style={otherstyles.confirmRowLabel}>Transfer method</AppText>
            <AppText style={otherstyles.confirmRowValueSmall}>{transferMethodLabel}</AppText>
          </View>
        </View>

        {/* Recipient details */}
        <AppText style={otherstyles.confirmSectionTitle}>Recipient details</AppText>

        <View style={otherstyles.confirmCard}>
          <View style={otherstyles.confirmDetailBlock}>
            <AppText style={otherstyles.confirmDetailLabel}>Recipient name</AppText>
            <AppText style={otherstyles.confirmDetailValue}>{recipient.accountName}</AppText>
          </View>

          <View style={otherstyles.confirmDivider} />

          <View style={otherstyles.confirmDetailBlock}>
            <AppText style={otherstyles.confirmDetailLabel}>{accountFieldLabel}</AppText>
            <AppText style={[otherstyles.confirmDetailValue, otherstyles.confirmMono]}>
              {recipient.accountNumber}
            </AppText>
          </View>

          <View style={otherstyles.confirmDivider} />

          <View style={otherstyles.confirmDetailBlock}>
            <AppText style={otherstyles.confirmDetailLabel}>{bankFieldLabel}</AppText>
            <AppText style={otherstyles.confirmDetailValue}>{bankFieldValue}</AppText>
          </View>

          <View style={otherstyles.confirmDivider} />

          <View style={otherstyles.confirmDetailBlock}>
            <AppText style={otherstyles.confirmDetailLabel}>Country</AppText>
            <AppText style={otherstyles.confirmDetailValue}>{countryName}</AppText>
          </View>
        </View>

        {/* Save recipient toggle — only meaningful for a brand new
            recipient; one already picked from saved beneficiaries is
            already saved, so there's nothing to ask. */}
        {!recipient.beneficiaryId && (
          <View style={otherstyles.confirmCard}>
            <View style={[otherstyles.confirmDetailBlock, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <AppText style={otherstyles.confirmDetailValue}>Save this recipient</AppText>
                <AppText style={otherstyles.confirmDetailLabel}>For faster transfers next time</AppText>
              </View>
              <Switch
                value={saveRecipientToggle}
                onValueChange={setSaveRecipientToggle}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        )}

        {/* ✅ Interac Security Q&A (NEW, inserted using your existing design language) */}
        {isInterac && (
          <>
            <AppText style={otherstyles.confirmSectionTitle}>Security question</AppText>

            <View style={otherstyles.confirmCard}>
              <View style={otherstyles.confirmDetailBlock}>
                <AppText style={otherstyles.confirmDetailLabel}>Security question</AppText>
                <AppTextInput
                  value={securityQuestion}
                  onChangeText={setSecurityQuestion}
                  placeholder="e.g., What is your favourite colour?"
                  placeholderTextColor={colors.muted}
                  maxLength={100}
                  autoCapitalize="sentences"
                  style={[
                    otherstyles.confirmDetailValue,
                    {
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.bgTertiary,
                      marginTop: 8,
                      fontFamily: Platform.OS === "ios" ? undefined : undefined,
                    },
                  ]}
                />
              </View>

              <View style={otherstyles.confirmDivider} />

              <View style={otherstyles.confirmDetailBlock}>
                <AppText style={otherstyles.confirmDetailLabel}>Security answer</AppText>
                <AppTextInput
                  value={securityAnswer}
                  onChangeText={setSecurityAnswer}
                  placeholder="e.g., Blue"
                  placeholderTextColor={colors.muted}
                  maxLength={50}
                  autoCapitalize="none"
                  style={[
                    otherstyles.confirmDetailValue,
                    {
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.bgTertiary,
                      marginTop: 8,
                    },
                  ]}
                />
              </View>
            </View>
          </>
        )}

        {/* Liquidity check */}
        <View style={{ marginBottom: 16 }}>
          <LiquidityBanner
            result={liquidityBlock}
            retrying={liquidityChecking}
            onRetry={runLiquidityCheck}
          />
        </View>

        {/* Notice */}
        <View style={otherstyles.confirmNotice}>
          <View style={otherstyles.confirmNoticeIconWrap}>
            <Ionicons name={isInterac ? "mail" : "information-circle"} size={17} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={otherstyles.confirmNoticeTitle}>{noticeTitle}</AppText>
            <AppText style={otherstyles.confirmNoticeText}>{noticeText}</AppText>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          style={[styles.primaryBtn, (sending || !!liquidityBlock) && styles.disabledBigBtn]}
          onPress={handleConfirmButtonPress}
          disabled={sending || !!liquidityBlock}
        >
          {sending ? (
            <View style={otherstyles.confirmPrimaryBtnInner}>
              <ActivityIndicator size="small" color={colors.actionText} style={{ marginRight: 10 }} />
              <AppText style={otherstyles.confirmPrimaryBtnText}>Sending…</AppText>
            </View>
          ) : (
            <AppText style={[otherstyles.confirmPrimaryBtnText]}>
              {isInterac ? "Send Interac e-Transfer" : "Confirm & send"}
            </AppText>
          )}
        </Pressable>

        <Pressable
          style={otherstyles.confirmCancelBtn}
          onPress={() => router.push("/(tabs)")}
          disabled={sending}
        >
          <AppText style={otherstyles.confirmCancelText}>Cancel</AppText>
        </Pressable>

        <View style={{ height: 18 }} />
      </ScrollView>

      {/* PIN Verification Modal */}
      <PinVerificationModal
        visible={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handleConfirmSend}
        title={isInterac ? "Authorize Interac transfer" : "Authorize transfer"}
        subtitle="Enter your 4-digit PIN to confirm this transfer"
      />
    </ScreenShell>
  );
}
