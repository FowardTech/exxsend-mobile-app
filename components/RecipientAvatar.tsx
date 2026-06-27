import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { COLORS } from "../theme/colors";
import AppText from "./AppText";
import CountryFlag from "./CountryFlag";

interface Props {
  name: string;
  /** Either is enough — CountryFlag itself derives one from the other if
   * only currencyCode is given. */
  countryCode?: string | null;
  currencyCode?: string | null;
  /** Diameter of the main avatar circle. */
  size?: number;
  /** Exxsend-member recipients (sent via @username) don't have a real bank
   * country — their countryCode is the placeholder "XX" — so they get an
   * "@" glyph instead of initials, and no flag badge at all. */
  isExxsend?: boolean;
  /** A recipient's actual photo, when one is available (currently only
   * possible for Exxsend members who've uploaded a profile picture —
   * bank-recipient records have no photo at all). Takes priority over
   * initials/the "@" glyph when present. */
  photoUrl?: string | null;
  backgroundColor?: string;
  textColor?: string;
  style?: object;
}

function getInitials(name: string) {
  return (name || "U").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function RecipientAvatar({
  name,
  countryCode,
  currencyCode,
  size = 44,
  isExxsend = false,
  photoUrl,
  backgroundColor,
  textColor,
  style,
}: Props) {
  // CountryFlag's own size prop is a fixed enum ("sm" | "ms" | ...), not an
  // arbitrary pixel value, since the underlying flag SVGs are fetched at a
  // fixed render size — so the badge size is picked from that same enum
  // rather than scaled continuously with the avatar.
  const flagToken = size >= 64 ? "ms" : "sm";
  const badgeBox = size >= 64 ? 26 : 20;

  const validCountry = (countryCode || "").toUpperCase().trim();
  const showFlag = !isExxsend && !photoUrl && validCountry !== "XX" && (validCountry || currencyCode);

  return (
    <View style={[{ width: size, height: size }, style]}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            s.circle,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: backgroundColor || COLORS.primary },
          ]}
        >
          <AppText style={[s.text, { fontSize: size * 0.36, color: textColor || "#FFFFFF" }]}>
            {isExxsend ? "@" : getInitials(name)}
          </AppText>
        </View>
      )}

      {!!showFlag && (
        <View style={[s.flagBadge, { width: badgeBox, height: badgeBox, borderRadius: badgeBox / 2 }]}>
          <CountryFlag countryCode={countryCode || undefined} currencyCode={currencyCode || undefined} size={flagToken} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "600" },
  flagBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
