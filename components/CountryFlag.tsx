import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import AppText from "./AppText";
import { SvgUri } from "react-native-svg";

type FlagSize = "sm" | "ms" | "md" | "lg" | "xl";

interface CountryFlagProps {
  countryCode?: string;
  currencyCode?: string;
  fallbackEmoji?: string;
  size?: FlagSize;
  style?: object;
}

const sizeMap: Record<FlagSize, number> = {
  sm: 20,
  ms: 28,
  md: 40,
  lg: 80,
  xl: 96,
};

// Currency → Country mapping
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  USD: "US",
  AUD: "AU",
  GBP: "GB",
  EUR: "EU",
  CAD: "CA",
  NGN: "NG",
  GHS: "GH",
  KES: "KE",
  ZAR: "ZA",
  TZS: "TZ",
  UGX: "UG",
  RWF: "RW",
  XOF: "SN",
  XAF: "CM",
  EGP: "EG",
  MAD: "MA",
  ZMW: "ZM",
  BWP: "BW",
  MUR: "MU",
  ETB: "ET",
  MWK: "MW",
  AOA: "AO",
  CDF: "CD",
  SLL: "SL",
  GMD: "GM",
  LRD: "LR",
  MZN: "MZ",
  NAD: "NA",
  SCR: "SC",
  SDG: "SD",
  SZL: "SZ",
  TND: "TN",
  DZD: "DZ",
  LYD: "LY",
  JPY: "JP",
  CNY: "CN",
  INR: "IN",
  CHF: "CH",
  NZD: "NZ",
  SGD: "SG",
  HKD: "HK",
  MXN: "MX",
  BRL: "BR",
  AED: "AE",
  SAR: "SA",
  QAR: "QA",
  KWD: "KW",
  BHD: "BH",
  OMR: "OM",
  JOD: "JO",
  ILS: "IL",
  TRY: "TR",
  PLN: "PL",
  CZK: "CZ",
  HUF: "HU",
  SEK: "SE",
  NOK: "NO",
  DKK: "DK",
  RUB: "RU",
  THB: "TH",
  MYR: "MY",
  IDR: "ID",
  PHP: "PH",
  VND: "VN",
  KRW: "KR",
  TWD: "TW",
  PKR: "PK",
  BDT: "BD",
  LKR: "LK",
  NPR: "NP",
  MMK: "MM",
  KHR: "KH",
  LAK: "LA",
};

export default function CountryFlag({
  countryCode,
  currencyCode,
  fallbackEmoji = "🏳️",
  size = "sm",
  style,
}: CountryFlagProps) {
  const [hasError, setHasError] = useState(false);

  // Determine ISO code
  let code = (countryCode || "").toUpperCase().trim();

  if (!code && currencyCode) {
    code = CURRENCY_TO_COUNTRY[currencyCode.toUpperCase().trim()] || "";
  }

  const dimension = sizeMap[size];

  if (!code || hasError) {
    return (
      <View
        style={[
          styles.fallbackContainer,
          { width: dimension, height: dimension },
          style,
        ]}
      >
        <AppText style={[styles.emoji, { fontSize: dimension * 0.7 }]}>
          {fallbackEmoji}
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <SvgUri
        uri={`https://hatscripts.github.io/circle-flags/flags/${code.toLowerCase()}.svg`}
        width={dimension}
        height={dimension}
        onError={() => setHasError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    textAlign: "center",
  },
});