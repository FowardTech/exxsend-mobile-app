import React from "react";
import { View, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";

interface Props {
  children: React.ReactNode;
  padded?: boolean;
  scrollable?: boolean;
  keyboardAware?: boolean;
}

export default function ScreenShell({
  children,
  padded = true,
  scrollable = true,
  keyboardAware = false,
}: Props) {
  const { colors, isDark } = useAppTheme();

  const inner = scrollable ? (
    <ScrollView
      contentContainerStyle={{ padding: padded ? 18 : 0, paddingBottom: 36 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}
