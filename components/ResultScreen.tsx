import React, { useMemo } from "react";
import { View, Pressable, ScrollView, Share, Alert } from "react-native";
import AppText from "./AppText";
import BackButton from "./BackButton";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import ScreenShell from "../components/ScreenShell";
import { useAppTheme } from "../theme/ThemeProvider";

interface ResultScreenParams {
  type: "success" | "error";
  title: string;
  message: string;
  primaryText: string;
  primaryRoute: string;
  secondaryText: string;
  secondaryRoute: string;
  details: string;
}

interface ResultScreenProps {
  params: ResultScreenParams;
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderLight,
      }}
    >
      <AppText style={{ fontSize: 13, color: colors.muted }}>{label}</AppText>
      <AppText style={{ fontSize: 13, fontWeight: "600", color: colors.text, maxWidth: "60%", textAlign: "right" }} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

export default function ResultScreen({ params }: ResultScreenProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const searchParams = useLocalSearchParams();

  // params come in as strings in expo-router
  const type = (searchParams.type || "success").toString(); // "success" | "error"
  const title = (searchParams.title || (type === "error" ? "Something went wrong" : "Transfer Successful!")).toString();
  const message = (searchParams.message || "").toString();

  // optional params
  const primaryText = (searchParams.primaryText || "Continue").toString();
  const primaryRoute = (searchParams.primaryRoute || "/(tabs)").toString(); // where the big button goes
  const secondaryText = (searchParams.secondaryText || "").toString(); // e.g., "View receipt"
  const secondaryRoute = (searchParams.secondaryRoute || "").toString();
  const details = (searchParams.details || "").toString(); // long text (optional)

  // Structured transaction-detail fields (preferred). Falls back to the
  // freeform message/subtitle display below when these aren't provided, so
  // any call site not yet updated to pass structured fields still renders
  // a correct, complete screen rather than a broken or empty one.
  const amount = (searchParams.amount || "").toString();
  const transactionId = (searchParams.transactionId || "").toString();
  const fee = (searchParams.fee || "").toString();
  const recipientName = (searchParams.recipientName || "").toString();
  const note = (searchParams.note || "").toString();
  const dateStr = (searchParams.dateStr || new Date().toLocaleString("en-US", {
    day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
  })).toString();

  const hasStructuredDetails = !!(amount || transactionId || fee || recipientName);

  const ui = useMemo(() => {
    const isError = type === "error";
    return {
      isError,
      icon: isError ? "circle-exclamation" : "checkmark",
      accent: isError ? colors.red : colors.green,
      soft: isError ? colors.errorLight : colors.greenSoft,
      subtitle: message || (isError ? "Please try again in a moment." : "Your request was completed successfully."),
    };
  }, [type, message, colors]);

  const onPrimary = () => {
    if (primaryRoute === "back") return router.back();
    if (primaryRoute === "pop") return router.dismiss ? router.dismiss() : router.back();
    router.replace(primaryRoute as any);
  };

  const onSecondary = () => {
    if (!secondaryRoute) return;
    router.push(secondaryRoute as any);
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: `${title}\n${amount ? `Amount: ${amount}\n` : ""}${transactionId ? `Reference: ${transactionId}\n` : ""}${dateStr}`,
      });
    } catch {
      Alert.alert("Error", "Could not share receipt.");
    }
  };

  return (
    <ScreenShell padded={false} scrollable={false}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8 }}>
          <BackButton onPress={() => router.back()} />
        </View>

        <View style={{ alignItems: "center", paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: ui.soft, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: ui.accent, alignItems: "center", justifyContent: "center" }}>
              {ui.isError ? (
                <FontAwesome6 name="circle-exclamation" size={30} color="#FFFFFF" />
              ) : (
                <Ionicons name="checkmark" size={34} color="#FFFFFF" />
              )}
            </View>
          </View>
          <AppText style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>{title}</AppText>
          <AppText style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{dateStr}</AppText>
        </View>

        {/* Card */}
        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight, padding: 18 }}>
          {hasStructuredDetails ? (
            <>
              {!!recipientName && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                    <AppText style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
                      {recipientName.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                    </AppText>
                  </View>
                  <View>
                    <AppText style={{ fontSize: 12, color: colors.muted }}>Transfer to</AppText>
                    <AppText style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{recipientName}</AppText>
                  </View>
                </View>
              )}
              <AppText style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 }}>Transaction Details</AppText>
              {!!amount && <DetailRow label="Amount" value={amount} />}
              {!!transactionId && <DetailRow label="Transaction ID" value={transactionId} />}
              {!!fee && <DetailRow label="Fee" value={fee} />}
              {!!note && <DetailRow label="Note" value={note} last />}
            </>
          ) : (
            <>
              <AppText style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{ui.subtitle}</AppText>
              {!!details && (
                <View style={{ marginTop: 12, backgroundColor: colors.bgTertiary, borderRadius: 10, padding: 12 }}>
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>{details}</AppText>
                </View>
              )}
            </>
          )}
        </View>

        {!ui.isError && (
          <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 14, backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12 }}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <AppText style={{ fontSize: 11, color: colors.primaryDark, flex: 1, lineHeight: 15 }}>
              Money transfer activities on ExxSend are protected end-to-end. Your transaction is secure.
            </AppText>
          </View>
        )}

        {/* Share / Download row */}
        {!ui.isError && hasStructuredDetails && (
          <View style={{ flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 16 }}>
            <Pressable onPress={onShare} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <AppText style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Share Receipt</AppText>
              <Ionicons name="share-outline" size={16} color={colors.text} />
            </Pressable>
            {!!secondaryText && !!secondaryRoute && (
              <Pressable onPress={onSecondary} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primaryLight }}>
                <AppText style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>{secondaryText}</AppText>
                <Ionicons name="download-outline" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Primary CTA */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}>
          <Pressable
            onPress={onPrimary}
            style={{ backgroundColor: ui.isError ? colors.text : colors.actionBg, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
          >
            <AppText style={{ color: ui.isError ? "#FFFFFF" : colors.actionText, fontSize: 16, fontWeight: "700" }}>{primaryText}</AppText>
          </Pressable>
          {!hasStructuredDetails && !!secondaryText && !!secondaryRoute && (
            <Pressable onPress={onSecondary} style={{ alignItems: "center", paddingVertical: 14 }}>
              <AppText style={{ fontSize: 14, fontWeight: "700", color: ui.accent }}>{secondaryText}</AppText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
