import React, { useState } from "react";
import { View, LayoutChangeEvent } from "react-native";
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import AppText from "@/components/AppText";
import { COLORS } from "@/theme/colors";
import { PerformancePoint } from "@/api/investments";

interface Props {
  series: PerformancePoint[];
  height?: number;
}

/**
 * Builds a smooth-ish path through the points using simple straight
 * segments (no need for real spline math here — investment value series
 * are daily snapshots, not high-frequency data, so straight segments
 * already read as a clean line at this density).
 */
function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");
}

export default function PerformanceChart({ series, height = 120 }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (series.length < 2 || width === 0) {
    return (
      <View style={{ height }} onLayout={onLayout}>
        {series.length < 2 && width > 0 && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <AppText style={{ fontSize: 12, color: COLORS.muted, fontWeight: "600" }}>
              Not enough history yet — check back after your next sync.
            </AppText>
          </View>
        )}
      </View>
    );
  }

  const values = series.map((p) => p.totalValueInBase);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padY = 10;

  const isUp = values[values.length - 1] >= values[0];
  const lineColor = isUp ? COLORS.green : COLORS.red;

  const points = series.map((p, i) => ({
    x: (i / (series.length - 1)) * width,
    y: padY + (1 - (p.totalValueInBase - min) / span) * (height - padY * 2),
  }));

  const linePath = buildPath(points);
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.18} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Baseline */}
        <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={COLORS.borderLight} strokeWidth={1} />
        <Path d={fillPath} fill="url(#fillGrad)" stroke="none" />
        <Path d={linePath} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={4} fill={lineColor} />
      </Svg>
    </View>
  );
}
