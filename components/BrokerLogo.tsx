import React, { useState } from "react";
import { View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../theme/colors";
import { RADIUS } from "../theme/designSystem";

interface BrokerLogoProps {
  logoUrl?: string | null;
  size?: number;
}

/**
 * Shows a brokerage's real logo when the backend provides one, falling
 * back to a generic icon both when no URL is given at all and when the
 * image itself fails to load (broken link, network hiccup) — a broken
 * <Image> would otherwise just render blank, which reads as more broken
 * than the deliberate fallback icon does.
 */
export default function BrokerLogo({ logoUrl, size = 40 }: BrokerLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!logoUrl && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.primaryLight,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: logoUrl! }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="business" size={Math.round(size * 0.45)} color={COLORS.primary} />
      )}
    </View>
  );
}
