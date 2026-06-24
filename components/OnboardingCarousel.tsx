import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Image, Pressable, FlatList, Dimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "./AppText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { styles } from "../theme/styles";

interface Slide {
  key: string;
  title: string;
  subtitle: string;
  image: any;
}

const { width: W, height: H } = Dimensions.get("window");

// One shared gradient across every slide now, rather than a different flat
// color per slide — so this lives once here instead of as a per-slide field.
const GRADIENT_COLORS = ["#315CFD", "#1E3FBF"] as const;

const SLIDES = [
  {
    key: "s1",
    title: "Your money,\nevery currency",
    subtitle: "Hold, send and receive in CAD, USD, GBP,\nEUR, NGN and more — all in one place.",
    image: require("../assets/images/onboarding/slide1.png"),
  },
  {
    key: "s2",
    title: "We're here\nwhenever you need us",
    subtitle: "Real support from real people — any time,\nany day. Your transfers are in safe hands.",
    image: require("../assets/images/onboarding/slide2.png"),
  },
  {
    key: "s3",
    title: "More money\narrives every time",
    subtitle: "Best-in-class exchange rates with zero\nhidden fees. What you see is what they get.",
    image: require("../assets/images/onboarding/slide3.png"),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<Slide> | null>(null);

  // UI index for dots/background
  const [uiIndex, setUiIndex] = useState(0);

  // "truth" index to avoid jumps
  const currentIndexRef = useRef(0);

  // keep interval stable
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const data = useMemo(() => SLIDES, []);

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }:any) => {
    if (!viewableItems || viewableItems.length === 0) return;

    const i = viewableItems[0]?.index ?? 0;

    currentIndexRef.current = i;
    setUiIndex((prev) => (prev === i ? prev : i));
  }).current;

  // ✅ Auto slide that loops correctly back to 0
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const next =
        currentIndexRef.current + 1 >= data.length ? 0 : currentIndexRef.current + 1;

      currentIndexRef.current = next;
      setUiIndex(next);

      listRef.current?.scrollToIndex({
        index: next,
        animated: true,
      });
    }, 3500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data.length]);

  const finishOnboardingAndGo = async (path:any) => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace(path);
  };

  const topInset = Platform.OS === "ios" ? 54 : 22;

  return (
    <LinearGradient colors={GRADIENT_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <StatusBar style="light" />

      <FlatList
        ref={listRef}
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: W, backgroundColor: "transparent" }]}>
            {/* Language pill */}
            {/* <Pressable style={[styles.langPill, { top: topInset, backgroundColor: "#0369A1" }]}>
              <AppText style={[styles.langText, { color: "#FFFFFF" }]}>🌐 English (United Kingdom)</AppText>
              <AppText style={[styles.langArrow, { color: "#FFFFFF" }]}>⌄</AppText>
            </Pressable> */}

            {/* Text block */}
            <View style={styles.textWrap}>
              <AppText style={[styles.title, { color: "#FFFFFF", fontSize: 34, paddingTop: 6 }]}>{item.title}</AppText>
              <AppText style={[styles.subtitle, { color: "rgba(255,255,255,0.75)" }]}>{item.subtitle}</AppText>
            </View>

            {/* Image block */}
            <View style={styles.imageWrap}>
              <Image source={item.image} style={styles.hero} resizeMode="cover" />
            </View>

            {/* Bottom block */}
            <View style={styles.bottomWrap}>
              {/* Dots */}
              <View style={styles.dots}>
                {data.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === uiIndex
                        ? [styles.dotActive, { backgroundColor: "#FFFFFF" }]
                        : [styles.dotInactive, { backgroundColor: "rgba(255,255,255,0.35)" }],
                    ]}
                  />
                ))}
              </View>

              {/* Buttons */}
              <Pressable
                style={[styles.primaryBtn, { borderColor: "transparent" }]}
                onPress={() => finishOnboardingAndGo("/getstarted")}
              >
                <AppText style={styles.primaryBtnText}>Create an account</AppText>
              </Pressable>

              <Pressable onPress={() => finishOnboardingAndGo("/")}>
                <AppText style={[styles.loginText, { color: "#FFFFFF" }]}>Log In</AppText>
              </Pressable>
            </View>
          </View>
        )}
      />
    </LinearGradient>
  );
}
