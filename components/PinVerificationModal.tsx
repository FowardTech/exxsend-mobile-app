/**
 * PinVerificationModal - Reusable PIN verification modal for transaction authorization
 *
 * Usage:
 * <PinVerificationModal
 *   visible={showPinModal}
 *   onClose={() => setShowPinModal(false)}
 *   onSuccess={() => handleConfirmedAction()}
 *   title="Enter PIN to confirm"
 * />
 *
 * If the user has enabled biometrics (Security & Privacy) and a securely
 * cached PIN is available, this modal attempts Face ID / Touch ID first as
 * soon as it opens. On success, the cached PIN is auto-submitted to the same
 * backend verifyPin() call the manual PIN pad uses — biometric success only
 * replaces *typing* the PIN, the backend still genuinely verifies it, since
 * there's no biometric-aware endpoint on the server. If biometric auth
 * fails, is cancelled, or isn't available/enabled, this falls back to the
 * manual PIN pad exactly as before.
 */
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { verifyPin } from "../api/config";
import { useAppTheme } from "../theme/ThemeProvider";
import { cachePinIfBiometricEnabled, getCachedPin } from "../utils/pinCache";
import AppText from "./AppText";

interface PinVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  // Most callers ignore the argument (they only care that verification
  // succeeded). Some endpoints — like /transfers/internal — need the PIN
  // itself in their own request body, so it's passed back here too.
  onSuccess: (pin?: string) => void;
  title?: string;
  subtitle?: string;
}

function DotRow({ count, error, colors }: { count: number; error: boolean; colors: any }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 24 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: error ? colors.red : i < count ? colors.primary : colors.border,
            backgroundColor: i < count ? (error ? colors.red : colors.primary) : "transparent",
          }}
        />
      ))}
    </View>
  );
}

export default function PinVerificationModal({
  visible,
  onClose,
  onSuccess,
  title = "Enter your PIN",
  subtitle = "Enter your 4-digit PIN to authorize this transaction",
}: PinVerificationModalProps) {
  const { colors } = useAppTheme();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bioAttempting, setBioAttempting] = useState(false);
  const submittingRef = useRef(false);
  const bioTriedRef = useRef(false);

  const submitPin = useCallback(async (enteredPin: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const phone = (await AsyncStorage.getItem("user_phone"))?.trim();
      if (!phone) {
        setError("Session expired. Please login again.");
        setPin("");
        return;
      }

      const response = await verifyPin(phone, enteredPin);

      if (response?.success) {
        // Refresh the cache on every successful verification (harmless if
        // biometrics are off — cachePinIfBiometricEnabled no-ops then).
        await cachePinIfBiometricEnabled(enteredPin);
        onSuccess(enteredPin);
        onClose();
      } else {
        setError(response?.message || "Incorrect PIN. Try again.");
        setPin("");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to verify PIN");
      setPin("");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [onSuccess, onClose]);

  // Reset state when modal opens, then attempt biometric auth once per open.
  useEffect(() => {
    if (!visible) return;
    setPin("");
    setError("");
    setLoading(false);
    submittingRef.current = false;
    bioTriedRef.current = false;

    (async () => {
      try {
        const bioEnabled = await AsyncStorage.getItem("biometric_enabled");
        if (bioEnabled !== "true") return;

        const cachedPin = await getCachedPin();
        if (!cachedPin) return;

        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (!hasHardware || !isEnrolled) return;
        if (bioTriedRef.current) return;
        bioTriedRef.current = true;

        setBioAttempting(true);
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirm transaction",
          fallbackLabel: "Use PIN",
          disableDeviceFallback: false,
        });
        setBioAttempting(false);

        if (result.success) {
          await submitPin(cachedPin);
        }
        // On failure/cancel, just fall through to the manual PIN pad —
        // no error shown, since cancelling biometric isn't itself a mistake.
      } catch {
        setBioAttempting(false);
      }
    })();
  }, [visible, submitPin]);

  const keys = useMemo(
    () => [
      ["1", "2", "3"],
      ["4", "5", "6"],
      ["7", "8", "9"],
      ["", "0", "del"],
    ],
    []
  );

  function press(k: string) {
    if (loading || submittingRef.current) return;

    if (k === "del") {
      setError("");
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (k === "") return;
    if (!/^\d$/.test(k)) return;

    setError("");
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + k;
      if (next.length === 4) void submitPin(next);
      return next;
    });
  }

  const renderKey = (k: string) => {
    if (k === "") {
      return <View key="empty" style={{ width: 72, height: 72 }} />;
    }

    if (k === "del") {
      return (
        <Pressable
          key={k}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.bgTertiary,
            opacity: loading ? 0.5 : 1,
          }}
          onPress={() => press(k)}
          disabled={loading}
        >
          <Ionicons name="backspace-outline" size={24} color={colors.text} />
        </Pressable>
      );
    }

    return (
      <Pressable
        key={k}
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.bgTertiary,
          opacity: loading ? 0.5 : 1,
        }}
        onPress={() => press(k)}
        disabled={loading}
      >
        <AppText style={{ fontSize: 28, fontWeight: "600", color: colors.text }}>
          {k}
        </AppText>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 40,
            paddingTop: 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 20,
              marginBottom: 20,
              position: "relative",
            }}
          >
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.greenSoft,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
              </View>
              <AppText style={{ fontSize: 20, fontWeight: "600", color: colors.text }}>
                {title}
              </AppText>
              <AppText
                style={{
                  fontSize: 14,
                  color: colors.muted,
                  marginTop: 4,
                  textAlign: "center",
                  paddingHorizontal: 24,
                }}
              >
                {bioAttempting ? "Confirm with Face ID or fingerprint…" : subtitle}
              </AppText>
            </View>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={{
                position: "absolute",
                top: 0,
                right: 20,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.bgTertiary,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>

          {/* PIN Dots */}
          <DotRow count={pin.length} error={!!error} colors={colors} />

          {/* Error Message */}
          {!!error && (
            <AppText
              style={{
                color: colors.red,
                textAlign: "center",
                marginTop: 12,
                fontSize: 14,
                fontWeight: "500",
              }}
            >
              {error}
            </AppText>
          )}

          {/* Loading Indicator */}
          {(loading || bioAttempting) && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginTop: 16 }}
            />
          )}

          {/* PIN Pad */}
          <View style={{ marginTop: 32, paddingHorizontal: 40 }}>
            {keys.map((row, rIdx) => (
              <View
                key={rIdx}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                {row.map((k) => renderKey(k))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
