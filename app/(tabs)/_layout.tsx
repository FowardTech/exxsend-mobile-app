import React, { useState, useEffect, useCallback } from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppText from "../../components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// Outline icon when inactive, filled/solid variant when active — matching
// the reference style (gray outline vs. solid blue) rather than the same
// glyph just recolored.
function TabIcon({ name, focused, badge = 0, badgeIcon }: {
  name: IoniconName; focused: boolean; badge?: number; badgeIcon?: string;
}) {
  const color = focused ? "#000000" : "rgba(0,0,0,0.35)";
  return (
    <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={23} color={color} />
      {badge > 0 && (
        <View style={ti.badge}>
          <AppText style={ti.badgeText}>{badge > 9 ? "9+" : badge}</AppText>
        </View>
      )}
      {!!badgeIcon && (
        <View style={[ti.iconBadge, { backgroundColor: color }]}>
          <Ionicons name={badgeIcon as IoniconName} size={10} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

// The raised circular center button — always solid/blue regardless of
// focus state, floating above the bar itself rather than sitting flush
// with the other flat tab icons.
function CenterFabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={ti.fabWrap}>
      <View style={[ti.fab, focused && ti.fabFocused]}>
        <MaterialCommunityIcons name="home-variant" size={26} color="#FFFFFF" />
      </View>
    </View>
  );
}

const ti = StyleSheet.create({
  badge: { position: "absolute", top: -5, right: -9, backgroundColor: COLORS.red, borderRadius: 8, minWidth: 16, height: 16, paddingHorizontal: 3, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#FFFFFF" },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  iconBadge: { position: "absolute", bottom: -3, right: -7, borderRadius: 7, width: 14, height: 14, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#FFFFFF" },
  fabWrap: { alignItems: "center", justifyContent: "center", width: 64 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    marginTop: -28,
    borderWidth: 4, borderColor: "#FFFFFF",
    // Intentionally a real shadow, unlike the flat white content cards
    // elsewhere in the app — this is a colored floating button, where the
    // shadow is what sells the "raised" effect rather than something a
    // border could substitute for.
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabFocused: { backgroundColor: COLORS.primaryDark },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // On Android, edgeToEdgeEnabled means the app draws behind the system bars
  // itself, so the tab bar must account for the real gesture/nav bar height
  // (which varies a lot — gesture nav vs 3-button nav vs OEM differences) —
  // a flat hardcoded padding clipped the bar's content under the gesture
  // indicator on gesture-nav devices. iOS keeps its existing fixed values
  // since SafeAreaView/insets already behave consistently there.
  const androidBottomPadding = Math.max(insets.bottom, 8) + 4;
  const androidBarHeight = 54 + androidBottomPadding;

  // Mirrors the "user_kyc_status" cache HomeScreen keeps fresh on every
  // profile fetch — defaults to unverified (fail-closed) until the cached
  // value loads, so a cold-start tap can't slip through before it resolves.
  const [verified, setVerified] = useState(false);
  const refreshVerified = useCallback(() => {
    AsyncStorage.getItem("user_kyc_status").then(v => setVerified(v === "verified")).catch(() => {});
  }, []);
  useEffect(() => { refreshVerified(); }, [refreshVerified]);

  const guardTabPress = useCallback((e: any) => {
    if (!verified) {
      e.preventDefault();
      Alert.alert("Verification Required", "Please complete identity verification to use this feature.");
    }
  }, [verified]);

  return (
    <Tabs
      screenListeners={{ state: refreshVerified }}
      screenOptions={{
      headerShown: false,
      tabBarStyle: {
        height: Platform.OS === "ios" ? 80 : androidBarHeight,
        paddingBottom: Platform.OS === "ios" ? 22 : androidBottomPadding,
        paddingTop: 6,
        backgroundColor: "#FFFFFF",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.borderLight,
        elevation: 0,
        shadowOpacity: 0,
        // So the center FAB's negative marginTop actually pops up above
        // the bar instead of getting clipped at its top edge.
        overflow: "visible",
      },
      tabBarActiveTintColor: "#000000",
      tabBarInactiveTintColor: "rgba(0,0,0,0.35)",
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 0 },
    }}>
      <Tabs.Screen name="transactions" options={{ title: "Transactions", tabBarIcon: ({ focused }) => <TabIcon name={focused ? "swap-horizontal" : "swap-horizontal-outline"} focused={focused} /> }} />
      <Tabs.Screen name="myqr"         options={{ title: "My QR",        tabBarIcon: ({ focused }) => <TabIcon name={focused ? "qr-code" : "qr-code-outline"} focused={focused} /> }} listeners={{ tabPress: guardTabPress }} />
      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => <CenterFabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen name="invest"       options={{ title: "Stock",        tabBarIcon: ({ focused }) => <TabIcon name={focused ? "trending-up" : "trending-up-outline"} focused={focused} /> }} listeners={{ tabPress: guardTabPress }} />
      <Tabs.Screen name="offers"       options={{ title: "Offers",       tabBarIcon: ({ focused }) => <TabIcon name={focused ? "pricetag" : "pricetag-outline"} focused={focused} /> }} />
      <Tabs.Screen name="supporttab"   options={{ title: "Support",      tabBarIcon: ({ focused }) => <TabIcon name={focused ? "headset" : "headset-outline"} focused={focused} /> }} />
      {/* notification.tsx still backs the standalone /notification route
          (pushed to from the bell icon at the top of the Home screen) — like
          referral below, href: null keeps it fully functional as a route
          while excluding it from the tab bar, since the top bell already
          covers this entry point and a second bell here would be redundant. */}
      <Tabs.Screen name="notification" options={{ href: null }} />
      {/* referral.tsx still backs the standalone /referral route (pushed
          to from Home's quick action, the recommendations banner, and
          Profile) — href: null keeps it fully functional as a route while
          excluding it from the tab bar now that Support has taken the 5th
          tab slot instead. Without this explicit entry, Expo Router
          auto-discovers the file and renders it as an extra, unstyled tab
          regardless of whether it's listed here at all. */}
      <Tabs.Screen name="referral"     options={{ href: null }} />
    </Tabs>
  );
}
