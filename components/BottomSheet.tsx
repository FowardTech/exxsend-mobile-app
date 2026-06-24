import React from "react";
import { Modal, View, Pressable, ScrollView, StyleSheet } from "react-native";
import AppText from "./AppText";
import { useAppTheme } from "../theme/ThemeProvider";

interface Props {
  visible?: boolean;
  open?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function BottomSheet({ visible, open, onClose, children, title = "" }: Props) {
  const { colors } = useAppTheme();
  const isVisible = visible !== undefined ? visible : (open ?? false);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        {/* Tap backdrop to close */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet panel — capped height so long content (e.g. a long wallet
            list) scrolls inside the sheet instead of pushing the sheet's
            top edge all the way up the screen. */}
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          {/* Drag handle */}
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={[s.header, { borderBottomColor: colors.borderLight }]}>
            <View style={{ width: 36 }} />
            <AppText style={[s.title, { color: colors.text }]} numberOfLines={1}>{title}</AppText>
            <Pressable onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.primaryLight }]} hitSlop={12}>
              <AppText style={[s.closeText, { color: colors.primary }]}>✕</AppText>
            </Pressable>
          </View>

          {/* Content — scrollable, capped so the sheet itself never grows
              past ~80% of the screen regardless of content length. */}
          <ScrollView
            style={s.scrollArea}
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30,21,53,0.50)",
  },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 34,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  scrollArea: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
});
