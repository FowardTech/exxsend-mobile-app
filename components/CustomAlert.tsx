import { Ionicons } from "@expo/vector-icons";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { CARD_SHADOW, GLASS_BORDER, RADIUS, SPACE } from "../theme/designSystem";
import AppText from "./AppText";

export interface CustomAlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: CustomAlertButton[];
}

interface CustomAlertContextValue {
  /**
   * Drop-in replacement for React Native's Alert.alert(title, message, buttons).
   * Existing call sites can migrate by swapping their import for this hook's
   * showAlert function — the call shape is intentionally identical.
   */
  showAlert: (title: string, message?: string, buttons?: CustomAlertButton[]) => void;
}

const CustomAlertContext = createContext<CustomAlertContextValue | null>(null);

export function useCustomAlert(): CustomAlertContextValue {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) {
    throw new Error("useCustomAlert must be used within a CustomAlertProvider");
  }
  return ctx;
}

/** Icon shown above the title — chosen automatically based on whether any
 * button is destructive, the same visual cue native iOS/Android alerts give
 * without saying so explicitly. */
function iconForButtons(buttons: CustomAlertButton[]): { name: keyof typeof Ionicons.glyphMap; tint: "danger" | "neutral" } {
  const hasDestructive = buttons.some((b) => b.style === "destructive");
  return hasDestructive
    ? { name: "alert-circle", tint: "danger" }
    : { name: "information-circle", tint: "neutral" };
}

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<AlertState>({ visible: false, title: "", buttons: [] });
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const close = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setState((s) => ({ ...s, visible: false }));
    });
  }, [opacity]);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: CustomAlertButton[]) => {
      const finalButtons: CustomAlertButton[] =
        buttons && buttons.length > 0 ? buttons : [{ text: "OK", style: "default" }];
      setState({ visible: true, title, message, buttons: finalButtons });
      // Defer the entrance animation one tick so the Modal has actually
      // mounted first — starting it in the same call can occasionally
      // race the Modal's own mount on Android.
      requestAnimationFrame(animateIn);
    },
    [animateIn]
  );

  const handlePress = useCallback(
    (button: CustomAlertButton) => {
      close();
      // Let the close animation begin before running the handler, so a
      // synchronous onPress that triggers another alert/navigation doesn't
      // visually fight with this one's exit animation.
      setTimeout(() => {
        button.onPress?.();
      }, 80);
    },
    [close]
  );

  const icon = iconForButtons(state.buttons);
  const iconTint = icon.tint === "danger" ? colors.red : colors.primary;
  const iconBg = icon.tint === "danger" ? colors.errorLight : colors.primaryLight;

  return (
    <CustomAlertContext.Provider value={{ showAlert }}>
      {children}

      <Modal visible={state.visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
        <Animated.View style={[s.overlay, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { }} />
          <Animated.View
            style={[
              s.card,
              { backgroundColor: colors.card, transform: [{ scale }] },
            ]}
          >
            <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name={icon.name} size={28} color={iconTint} />
            </View>

            <AppText style={[s.title, { color: colors.text }]}>{state.title}</AppText>
            {!!state.message && (
              <AppText style={[s.message, { color: colors.muted }]}>{state.message}</AppText>
            )}

            <View style={state.buttons.length > 2 ? s.buttonColumn : s.buttonRow}>
              {state.buttons.map((button, i) => {
                const isDestructive = button.style === "destructive";
                const isCancel = button.style === "cancel";
                const isPrimary = !isDestructive && !isCancel;
                return (
                  <Pressable
                    key={i}
                    onPress={() => handlePress(button)}
                    style={[
                      s.button,
                      state.buttons.length <= 2 && { flex: 1 },
                      isPrimary && { backgroundColor: colors.actionBg },
                      isDestructive && { backgroundColor: colors.errorLight },
                      isCancel && { backgroundColor: colors.bgTertiary },
                    ]}
                  >
                    <AppText
                      style={[
                        s.buttonText,
                        isPrimary && { color: colors.actionText },
                        isDestructive && { color: colors.red },
                        isCancel && { color: colors.textSecondary },
                      ]}
                    >
                      {button.text}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.xxl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: RADIUS.lg,
    padding: SPACE.xxl,
    alignItems: "center",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginTop: SPACE.sm,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SPACE.sm + 2,
    marginTop: SPACE.xxl,
    width: "100%",
  },
  buttonColumn: {
    flexDirection: "column",
    gap: SPACE.sm,
    marginTop: SPACE.xxl,
    width: "100%",
  },
  button: {
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.md + 2,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
