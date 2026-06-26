import React from "react";
import { View, StyleSheet } from "react-native";
import AppText from "./AppText";
import { COLORS } from "../theme/colors";
import { SPACE } from "../theme/designSystem";

interface Props {
  content: string;
}

// Splits "some **bold** and *italic* text" into styled AppText spans.
function renderInline(text: string, baseKey: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((p) => p.length > 0);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <AppText key={`${baseKey}-${i}`} style={s.bold}>{part.slice(2, -2)}</AppText>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <AppText key={`${baseKey}-${i}`} style={s.italic}>{part.slice(1, -1)}</AppText>;
    }
    return <AppText key={`${baseKey}-${i}`}>{part}</AppText>;
  });
}

export default function SimpleMarkdown({ content }: Props) {
  const blocks = (content || "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return (
    <View>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

        // Heading block (only ever the first line of a block in practice)
        const headingMatch = lines[0]?.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch && lines.length === 1) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          return (
            <AppText key={bi} style={[s.heading, level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3]}>
              {renderInline(text, `h${bi}`)}
            </AppText>
          );
        }

        // List block — every line starts with -, *, or a number+period
        const isBulletList = lines.every((l) => /^[-*]\s+/.test(l));
        const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l));
        if ((isBulletList || isNumberedList) && lines.length > 0) {
          return (
            <View key={bi} style={s.listBlock}>
              {lines.map((line, li) => {
                const itemText = line.replace(/^([-*]|\d+\.)\s+/, "");
                return (
                  <View key={li} style={s.listRow}>
                    <AppText style={s.listBullet}>{isNumberedList ? `${li + 1}.` : "•"}</AppText>
                    <AppText style={s.listText}>{renderInline(itemText, `l${bi}-${li}`)}</AppText>
                  </View>
                );
              })}
            </View>
          );
        }

        // Plain paragraph — join wrapped lines back into one block of text
        return (
          <AppText key={bi} style={s.paragraph}>
            {renderInline(lines.join(" "), `p${bi}`)}
          </AppText>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  heading: { fontWeight: "700", color: COLORS.text, marginBottom: SPACE.sm, marginTop: SPACE.lg },
  h1: { fontSize: 22 },
  h2: { fontSize: 18 },
  h3: { fontSize: 15 },
  paragraph: { fontSize: 14, color: COLORS.text, lineHeight: 22, marginBottom: SPACE.lg },
  bold: { fontWeight: "700", fontSize: 14, color: COLORS.text },
  italic: { fontStyle: "italic", fontSize: 14, color: COLORS.text },
  listBlock: { marginBottom: SPACE.lg },
  listRow: { flexDirection: "row", marginBottom: SPACE.sm, paddingRight: SPACE.sm },
  listBullet: { fontSize: 14, color: COLORS.primary, fontWeight: "700", width: 22 },
  listText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 21 },
});
