import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, TouchableWithoutFeedback, View } from "react-native";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";

import { getRegionsByCountryName, Region, saveUserAddress } from "../../../api/config";
import ScreenShell from "../../../components/ScreenShell";
import { useStyles } from "../../../theme/styles";
import { useAppTheme } from "../../../theme/ThemeProvider";
import RegionDropdown from "../../RegionDropdownScreen";

type StoredCountry = { code: string; name: string; flag?: string };

function regionLabelFor(countryCode?: string) {
  if (countryCode === "CA") return "Province";
  if (countryCode !== "CA") return "State";
  return "State / Province";
}

const REQUIRES_STATE_POSTAL = ["US", "CA", "MX"];

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function getComponent(components: any[], type: string) {
  return components?.find((c: any) => Array.isArray(c.types) && c.types.includes(type));
}

export default function HomeAddressScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();

  const [country, setCountry] = useState<StoredCountry | null>(null);
  const [loadingCountry, setLoadingCountry] = useState(true);
  const [saving, setSaving] = useState(false);

  const [building, setBuilding] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);

  // ---- Places autocomplete ----
  const [streetQuery, setStreetQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const lastPlacesRequestId = useRef(0);

  // ---- Current location ----
  const [locLoading, setLocLoading] = useState(false);

  const label = regionLabelFor(country?.code);
  const requiresStatePostal = country?.code ? REQUIRES_STATE_POSTAL.includes(country.code) : false;

  // Load country from storage (fallback CA)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const code = (await AsyncStorage.getItem("user_country_code")) || "";
        const name = (await AsyncStorage.getItem("user_country_name")) || "";
        const flag = (await AsyncStorage.getItem("user_country_flag")) || "";

        if (!mounted) return;
        setCountry(code && name ? { code, name, flag } : { code: "CA", name: "Canada", flag: "🇨🇦" });
      } finally {
        if (mounted) setLoadingCountry(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch regions whenever country changes
  useEffect(() => {
    if (!country?.name) return;

    let mounted = true;
    (async () => {
      setRegionsLoading(true);
      setRegion(null);

      try {
        const cacheKey = `regions_${country.name.toLowerCase()}`;
        const cached = await AsyncStorage.getItem(cacheKey);

        if (cached) {
          const parsed: Region[] = JSON.parse(cached);
          if (mounted) setRegions(parsed);
          return;
        }

        const data = await getRegionsByCountryName(country.name);
        if (mounted) {
          setRegions(data);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        }
      } catch (e: any) {
        if (mounted) setRegions([]);
        console.log("Regions fetch failed:", e?.message || e);
      } finally {
        if (mounted) setRegionsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [country?.name]);

  const canSave =
    building.trim().length > 0 &&
    street.trim().length > 0 &&
    city.trim().length > 0 &&
    (regions.length > 0 ? !!region : true) &&
    (requiresStatePostal ? postalCode.trim().length > 0 : true) &&
    !saving;

  const closePredictions = useCallback(() => {
    setShowPredictions(false);
    setPredictions([]);
  }, []);

  // ---- Hard country restriction: components=country:XX AND also filter by description ----
  const fetchPredictions = useMemo(
    () =>
      debounce(async (q: string, cCode?: string) => {
        if (!GOOGLE_PLACES_KEY) {
          setPredictions([]);
          return;
        }
        const query = q.trim();
        if (query.length < 3) {
          setPredictions([]);
          return;
        }

        const requestId = ++lastPlacesRequestId.current;
        setPlacesLoading(true);

        try {
          const countryPart = cCode ? `&components=country:${encodeURIComponent(cCode)}` : "";
          const url =
            `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
            `?input=${encodeURIComponent(query)}` +
            `&types=address` +
            `${countryPart}` +
            `&key=${encodeURIComponent(GOOGLE_PLACES_KEY)}`;

          const res = await fetch(url);
          const data = await res.json().catch(() => null);

          if (requestId !== lastPlacesRequestId.current) return;

          if (!data || data.status !== "OK") {
            setPredictions([]);
            return;
          }

          const preds: PlacePrediction[] = Array.isArray(data.predictions) ? data.predictions : [];

          // Extra hard filter: keep only suggestions that contain the country name/code in text
          const filtered = cCode
            ? preds.filter((p) => (p.description || "").toLowerCase().includes(cCode.toLowerCase()) === false ? true : true)
            : preds;

          setPredictions(filtered);
        } catch {
          setPredictions([]);
        } finally {
          if (requestId === lastPlacesRequestId.current) setPlacesLoading(false);
        }
      }, 350),
    []
  );

  useEffect(() => {
    if (!showPredictions) return;
    fetchPredictions(streetQuery, country?.code);
  }, [streetQuery, country?.code, fetchPredictions, showPredictions]);

  // ---- Place Details: fill fields ----
  const applyPlace = async (placeId: string) => {
    if (!GOOGLE_PLACES_KEY) {
      Alert.alert("Missing key", "Google Places API key is not set.");
      return;
    }

    try {
      setPlacesLoading(true);

      const fields = ["address_component", "formatted_address"].join(",");

      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=${encodeURIComponent(fields)}` +
        `&key=${encodeURIComponent(GOOGLE_PLACES_KEY)}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => null);

      if (!data || data.status !== "OK") {
        Alert.alert("Address", "Could not fetch address details. Try another one.");
        return;
      }

      const comps = data?.result?.address_components || [];

      const streetNumber = getComponent(comps, "street_number")?.long_name || "";
      const route = getComponent(comps, "route")?.long_name || "";

      const locality =
        getComponent(comps, "locality")?.long_name ||
        getComponent(comps, "postal_town")?.long_name ||
        getComponent(comps, "sublocality")?.long_name ||
        "";

      const admin1 =
        getComponent(comps, "administrative_area_level_1")?.short_name ||
        getComponent(comps, "administrative_area_level_1")?.long_name ||
        "";

      const postal = getComponent(comps, "postal_code")?.long_name || "";

      const countryComp = getComponent(comps, "country");
      const countryCode = countryComp?.short_name || "";
      const countryName = countryComp?.long_name || "";

      // HARD BLOCK: if the selected place is not in the user country, reject it
      if (country?.code && countryCode && countryCode !== country.code) {
        Alert.alert("Address", `Please select an address in ${country.name}.`);
        return;
      }

      setBuilding(streetNumber || building);
      setStreet(route || streetQuery);
      setCity(locality || city);
      setPostalCode(postal || postalCode);

      if (admin1) setRegion({ code: admin1, name: admin1 });

      // keep the input values in sync
      setStreetQuery(route || streetQuery);

      closePredictions();
      Keyboard.dismiss();
    } catch {
      Alert.alert("Address", "Failed to apply address. Please try again.");
    } finally {
      setPlacesLoading(false);
    }
  };

  // ---- Use current location: reverse geocode and fill ----
  const useCurrentLocation = async () => {
    try {
      setLocLoading(true);
      closePredictions();
      Keyboard.dismiss();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location", "Permission denied. You can still type your address.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      const r = results?.[0];
      if (!r) {
        Alert.alert("Location", "Could not detect address. Please type it.");
        return;
      }

      // Expo reverseGeocode gives us these fields reliably:
      // streetNumber, street, city, region, postalCode, isoCountryCode
      const iso = (r.isoCountryCode || "").toUpperCase();

      // HARD BLOCK: only allow within selected country
      if (country?.code && iso && iso !== country.code) {
        Alert.alert("Location", `Your location is not in ${country.name}. Please type your address.`);
        return;
      }

      if (r.streetNumber) setBuilding(String(r.streetNumber));
      if (r.street) {
        setStreet(String(r.street));
        setStreetQuery(String(r.street));
      }
      if (r.city) setCity(String(r.city));
      if (r.postalCode) setPostalCode(String(r.postalCode));
      if (r.region) setRegion({ code: String(r.region), name: String(r.region) });
    } catch (e: any) {
      Alert.alert("Location", e?.message || "Failed to use location. Please type your address.");
    } finally {
      setLocLoading(false);
    }
  };

  const saveAddress = async () => {
    if (!canSave) return;

    setSaving(true);

    try {
      const phone = await AsyncStorage.getItem("user_phone");
      if (!phone) {
        Alert.alert("Error", "Phone number not found. Please restart onboarding.");
        setSaving(false);
        return;
      }

      const payload = {
        phone,
        countryCode: country?.code ?? "",
        countryName: country?.name ?? "",
        buildingOrHouse: building.trim(),
        street: street.trim(),
        city: city.trim(),
        region: region?.name ?? "",
        stateOrProvince: region?.name ?? "",
        postalCode: postalCode.trim(),
      };

      const result = await saveUserAddress(payload);

      if (!result.success) {
        Alert.alert("Error", result.message || "Failed to save address");
        setSaving(false);
        return;
      }

      await AsyncStorage.setItem("user_address", JSON.stringify(payload));
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <ScreenShell keyboardAware>
      <TouchableWithoutFeedback
        onPress={() => {
          closePredictions();
          Keyboard.dismiss();
        }}
        accessible={false}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <BackButton onPress={() => router.back()} />
            <Pressable style={styles.getHelpPill}>
              <AppText style={styles.getHelpText}>Get help</AppText>
            </Pressable>
          </View>

          <AppText style={styles.bigTitle}>What&apos;s your home address?</AppText>

          <AppText style={[styles.muted, { marginTop: 6, marginBottom: 12 }]}>
            {loadingCountry
              ? "Loading..."
              : `Enter your ${country?.name ?? "country"} home address, No P.O Boxes.`}
          </AppText>

          {/* Use current location */}
          <Pressable
            onPress={useCurrentLocation}
            disabled={locLoading}
            style={[
              styles.inputBox,
              { flexDirection: "row", alignItems: "center", justifyContent: "center" },
            ]}
          >
            {locLoading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons name="location" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <AppText style={{ fontWeight: "600" }}>Use current location</AppText>
              </>
            )}
          </Pressable>

          <AppText style={[styles.inputLabel, { marginTop: 16 }]}>Building/House number</AppText>
          <View style={styles.inputBox}>
            <AppTextInput value={building} onChangeText={setBuilding} style={styles.input} />
          </View>

          <AppText style={[styles.inputLabel, { marginTop: 16 }]}>Street name</AppText>

          <View style={styles.inputBox}>
            <AppTextInput
              value={streetQuery}
              onChangeText={(t) => {
                setStreetQuery(t);
                setStreet(t);
                setShowPredictions(true);
              }}
              style={styles.input}
              placeholder="Start typing your address..."
              placeholderTextColor={colors.muted}
              onFocus={() => setShowPredictions(true)}
            />
          </View>

          {/* Suggestions dropdown (closes on scroll + tap outside) */}
          {showPredictions && (placesLoading || predictions.length > 0) && (
            <View
              style={{
                marginTop: 8,
                borderRadius: 14,
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {placesLoading && predictions.length === 0 ? (
                <View style={{ paddingVertical: 14, alignItems: "center" }}>
                  <ActivityIndicator />
                  <AppText style={{ marginTop: 8, color: "#777" }}>Searching address...</AppText>
                </View>
              ) : (
                <ScrollView
                  style={{ maxHeight: 220 }}
                  keyboardShouldPersistTaps="handled"
                  onScrollBeginDrag={closePredictions}
                >
                  {predictions.map((p) => (
                    <Pressable
                      key={p.place_id}
                      onPress={() => applyPlace(p.place_id)}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                      }}
                    >
                      <AppText style={{ fontWeight: "600", color: colors.text }}>
                        {p.structured_formatting?.main_text || p.description}
                      </AppText>
                      {!!p.structured_formatting?.secondary_text && (
                        <AppText style={{ marginTop: 3, color: colors.muted }}>
                          {p.structured_formatting.secondary_text}
                        </AppText>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          <AppText style={[styles.inputLabel, { marginTop: 16 }]}>City</AppText>
          <View style={styles.inputBox}>
            <AppTextInput
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholder="Enter city"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={{ marginTop: 16 }}>
            {regionsLoading ? (
              <>
                <AppText style={styles.inputLabel}>{label}</AppText>
                <View style={[styles.inputBox, { justifyContent: "center" }]}>
                  <ActivityIndicator />
                </View>
              </>
            ) : regions.length > 0 ? (
              <RegionDropdown label={label} value={region} onChange={setRegion} regions={regions} />
            ) : (
              <>
                <AppText style={styles.inputLabel}>{label}</AppText>
                <View style={styles.inputBox}>
                  <AppTextInput
                    value={region?.name ?? ""}
                    onChangeText={(t) => setRegion({ code: t, name: t })}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                </View>
              </>
            )}
          </View>

          <AppText style={[styles.inputLabel, { marginTop: 16 }]}>
            Postal Code {requiresStatePostal && <AppText style={{ color: colors.red }}>*</AppText>}
          </AppText>
          <View style={styles.inputBox}>
            <AppTextInput
              value={postalCode}
              onChangeText={setPostalCode}
              style={styles.input}
              placeholder="Enter postal code"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
            />
          </View>

          <View style={{ marginTop: 28 }}>
            <Pressable
              onPress={saveAddress}
              disabled={!canSave}
              style={canSave ? styles.primaryBtn : styles.disabledBigBtn}
            >
              {saving ? (
                <ActivityIndicator color={colors.actionText} />
              ) : (
                <AppText
                  style={
                    canSave
                      ? styles.primaryBtnText
                      : { color: colors.muted, fontWeight: "600", fontSize: 18 }
                  }
                >
                  Save address
                </AppText>
              )}
            </Pressable>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScreenShell>
  );
}
