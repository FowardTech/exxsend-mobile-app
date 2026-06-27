import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PinVerificationModal from "../../../../components/PinVerificationModal";
import { COLORS } from "../../../../theme/colors";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SPACE } from "../../../../theme/designSystem";
import { clearCachedPin } from "../../../../utils/pinCache";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}

function Row({ icon, label, onPress, right, danger }: RowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={icon}
            size={18}
            color={danger ? COLORS.red : COLORS.primary}
          />
        </View>
        <AppText style={[styles.label, danger && { color: COLORS.red }]}>
          {label}
        </AppText>
      </View>

      {right}
    </Pressable>
  );
}

export default function SecurityPrivacyScreen() {
  const router = useRouter();

  const [bioEnabled, setBioEnabled] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [warmCacheModalVisible, setWarmCacheModalVisible] = useState(false);

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    (async () => {
      try {
        const savedBio = await AsyncStorage.getItem("biometric_enabled");
        const savedHide = await AsyncStorage.getItem("hide_balance_preference");

        setBioEnabled(savedBio === "true");
        setHideBalance(savedHide === "true");

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (compatible && enrolled) {
          const types =
            await LocalAuthentication.supportedAuthenticationTypesAsync();

          if (
            types.includes(
              LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
            )
          ) {
            setBioType("Face ID");
          } else if (
            types.includes(
              LocalAuthentication.AuthenticationType.FINGERPRINT
            )
          ) {
            setBioType("Touch ID");
          } else {
            setBioType("Biometric");
          }
        }
      } catch (e) {
        console.log("Init error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------- BIOMETRIC TOGGLE ---------------- */

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Authenticate to enable ${bioType}`,
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });

        if (result.success) {
          await AsyncStorage.setItem("biometric_enabled", "true");
          setBioEnabled(true);
          // Warm the PIN cache right away rather than waiting for an
          // unrelated future transaction — without this, the very first
          // transaction after enabling biometric would silently fall
          // through to the manual PIN pad with no cached PIN to use yet,
          // making it look like the toggle did nothing.
          setWarmCacheModalVisible(true);
        } else {
          Alert.alert("Authentication failed");
        }
      } catch {
        Alert.alert("Biometric authentication unavailable");
      }
    } else {
      await AsyncStorage.setItem("biometric_enabled", "false");
      await clearCachedPin();
      setBioEnabled(false);
    }
  };

  /* ---------------- HIDE BALANCE ---------------- */

  const handleHideBalanceToggle = async (value: boolean) => {
    setHideBalance(value);
    await AsyncStorage.setItem(
      "hide_balance_preference",
      value ? "true" : "false"
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />

        <AppText style={styles.headerTitle}>Security and privacy</AppText>

        <View style={{ width: 40 }} />
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Row
          icon="lock-closed-outline"
          label="Reset Password"
          onPress={() => router.push("/reset-password")}
          right={<Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
        />

        <View style={styles.divider} />

        <Row
          icon="key-outline"
          label="Transaction PIN"
          onPress={() => router.push("/changepin")}
          right={<Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
        />

        <View style={styles.divider} />

        <Row
          icon="phone-portrait-outline"
          label="Manage Devices"
          onPress={() => router.push("/managedevices" as any)}
          right={<Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
        />

        <View style={styles.divider} />

        {bioType && (
          <>
            <Row
              icon="finger-print-outline"
              label={`Enable ${bioType}`}
              right={
                <Switch
                  value={bioEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ true: COLORS.primary }}
                />
              }
            />
            <View style={styles.divider} />
          </>
        )}

        <Row
          icon="shield-checkmark-outline"
          label="View Privacy Settings"
          onPress={() => router.push("/privacysettings")}
          right={<Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
        />

        <View style={styles.divider} />

        <Row
          icon="eye-off-outline"
          label="Hide Balance"
          right={
            <Switch
              value={hideBalance}
              onValueChange={handleHideBalanceToggle}
              trackColor={{ true: COLORS.primary }}
            />
          }
        />
      </View>

      <PinVerificationModal
        visible={warmCacheModalVisible}
        onClose={() => setWarmCacheModalVisible(false)}
        onSuccess={() => setWarmCacheModalVisible(false)}
        title="Confirm your PIN"
        subtitle="Enter your PIN once to finish enabling biometric login."
      />
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    marginTop: SPACE.md,
    overflow: "hidden",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  row: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: 64,
  },
});