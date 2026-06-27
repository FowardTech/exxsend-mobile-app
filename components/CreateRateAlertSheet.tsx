import { createRateAlert } from "@/api/config";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Switch, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import AppText from "./AppText";
import AppTextInput from "./AppTextInput";
import BottomSheet from "./BottomSheet";
import CountryFlag from "./CountryFlag";

type Props = {
  open: boolean;
  onClose: () => void;
  fromCurrency: string;
  toCurrency: string;
  currentRate: number;
  fromFlag?: string;
  toFlag?: string;
  onSuccess?: () => void;
};

export default function CreateRateAlertSheet({
  open,
  onClose,
  fromCurrency,
  toCurrency,
  currentRate,
  fromFlag = "",
  toFlag = "",
  onSuccess,
}: Props) {
  const { colors } = useAppTheme();
  const [targetRate, setTargetRate] = useState(currentRate.toFixed(4));
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    const rate = parseFloat(targetRate);
    if (!rate || rate <= 0) {
      setError("Please enter a valid target rate");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) {
        setError("User not found");
        setLoading(false);
        return;
      }

      const res = await createRateAlert({
        phone,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        target_rate: rate,
        direction,
        is_recurring: isRecurring,
      });

      if (res.success) {
        onSuccess?.();
        onClose();
        // Reset state
        setTargetRate(currentRate.toFixed(4));
        setDirection("above");
        setIsRecurring(false);
      } else {
        setError(res.message || "Failed to create alert");
      }
    } catch (e) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <AppText style={{ fontSize: 20, fontWeight: "600", color: colors.text, marginBottom: 4 }}>
        Set Rate Alert
      </AppText>
      <AppText style={{ color: colors.muted, marginBottom: 20 }}>
        Get notified when the rate hits your target
      </AppText>

      {/* Currency Pair */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <CountryFlag currencyCode={fromCurrency} fallbackEmoji={fromFlag} size="md" />
        <AppText style={{ fontSize: 18, fontWeight: "600", marginHorizontal: 8, color: colors.text }}>
          {fromCurrency} → {toCurrency}
        </AppText>
        <CountryFlag currencyCode={toCurrency} fallbackEmoji={toFlag} size="md" />
      </View>

      {/* Current Rate */}
      <View
        style={{
          backgroundColor: colors.bgTertiary,
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <AppText style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Current Rate</AppText>
        <AppText style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
          1 {fromCurrency} = {currentRate.toFixed(4)} {toCurrency}
        </AppText>
      </View>

      {/* Target Rate Input */}
      <AppText style={{ fontWeight: "600", color: colors.text, marginBottom: 8 }}>Target Rate</AppText>
      <AppTextInput
        value={targetRate}
        onChangeText={setTargetRate}
        keyboardType="decimal-pad"
        placeholder="Enter target rate"
        placeholderTextColor={colors.muted}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 14,
          fontSize: 18,
          fontWeight: "600",
          marginBottom: 16,
          color: colors.text,
        }}
      />

      {/* Direction Toggle */}
      <AppText style={{ fontWeight: "600", color: colors.text, marginBottom: 8 }}>Alert When Rate</AppText>
      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <Pressable
          onPress={() => setDirection("above")}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: direction === "above" ? colors.primaryLight : colors.bgTertiary,
            borderWidth: 2,
            borderColor: direction === "above" ? colors.primary : "transparent",
            alignItems: "center",
            marginRight: 8,
          }}
        >
          <Ionicons name="trending-up" size={18} color={direction === "above" ? colors.primary : colors.muted} style={{ marginBottom: 4 }} />
          <AppText style={{ fontWeight: "600", color: direction === "above" ? colors.primary : colors.muted }}>
            Goes Above
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setDirection("below")}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: direction === "below" ? colors.errorLight : colors.bgTertiary,
            borderWidth: 2,
            borderColor: direction === "below" ? colors.red : "transparent",
            alignItems: "center",
          }}
        >
          <Ionicons name="trending-down" size={18} color={direction === "below" ? colors.red : colors.muted} style={{ marginBottom: 4 }} />
          <AppText style={{ fontWeight: "600", color: direction === "below" ? colors.red : colors.muted }}>
            Drops Below
          </AppText>
        </Pressable>
      </View>

      {/* Recurring Toggle */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          marginBottom: 16,
        }}
      >
        <View>
          <AppText style={{ fontWeight: "600", color: colors.text }}>Recurring Alert</AppText>
          <AppText style={{ color: colors.muted, fontSize: 12 }}>Keep alerting each time target is hit</AppText>
        </View>
        <Switch
          value={isRecurring}
          onValueChange={setIsRecurring}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {/* Error */}
      {error ? (
        <AppText style={{ color: colors.red, marginBottom: 12, textAlign: "center" }}>{error}</AppText>
      ) : null}

      {/* Create Button */}
      <Pressable
        onPress={handleCreate}
        disabled={loading}
        style={{
          backgroundColor: colors.actionBg,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.actionText} />
        ) : (
          <AppText style={{ color: colors.actionText, fontWeight: "600", fontSize: 16 }}>Create Alert</AppText>
        )}
      </Pressable>
    </BottomSheet>
  );
}
