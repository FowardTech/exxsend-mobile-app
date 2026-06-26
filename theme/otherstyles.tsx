// theme/styles.ts
import { useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import { ColorTokens, LIGHT_COLORS } from "./palettes";
import { useAppTheme } from "./ThemeProvider";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER } from "./designSystem";

export function makeOtherStyles(COLORS: ColorTokens) {
  return StyleSheet.create({
    // =========================
  // Network Error State
  // =========================
  netErrWrap: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  netErrWrapCompact: {
    paddingVertical: 16,
    justifyContent: "center",
  },
  netErrIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.bgTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  netErrIcon: {
    fontSize: 26,
  },
  netErrTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  netErrMessage: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    alignItems:'center',
    justifyContent:'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  netErrBtn: {
    marginTop: 14,
    width: "100%",
    maxWidth: 320,
    justifyContent: "center",
    alignItems: "center",
  },
  netErrBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  netErrBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  netErrHint: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: 18,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  backIcon: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  /** ---------------- Recipient Confirm (Flutterwave) ---------------- **/
  confirmContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },

  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  confirmHeaderCenter: {
    flex: 1,
    alignItems: "center",
  },
  confirmHeaderRight: {
    width: 40,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  confirmSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  confirmHeroCard: {
    marginTop: 14,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  confirmHeroLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
    opacity: 0.9,
  },
  confirmHeroAmount: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: "700",
    color: COLORS.primaryDark,
    letterSpacing: -0.3,
  },
  confirmHeroMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  confirmHeroPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  confirmHeroPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  confirmHeroDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginHorizontal: 10,
    backgroundColor: COLORS.muted,
  },
  confirmHeroMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
    opacity: 0.9,
  },

  confirmSectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  confirmCard: {
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: "hidden",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },

  confirmRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmRowLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
  },
  confirmRowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  confirmRowValueSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },

  confirmDivider: {
    height: 1,
    backgroundColor: COLORS.bg,
  },

  confirmDetailBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  confirmDetailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
    marginBottom: 6,
  },
  confirmDetailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  confirmMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 0.2,
  },

  confirmNotice: {
    marginTop: 14,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
  },
  confirmNoticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  confirmNoticeIcon: {
    fontSize: 16,
  },
  confirmNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accentDark,
  },
  confirmNoticeText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accentDark,
    opacity: 0.95,
    lineHeight: 16,
  },
primaryBtn: {
    width: "100%",
    height: 50,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: "#3c3b3bff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
  },
  confirmPrimaryBtn: {
    marginTop: 18,
    // backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPrimaryBtnDisabled: {
    opacity: 0.6,
  },
  confirmPrimaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  confirmPrimaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
  },

  confirmCancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.muted,
  },

  confirmInvalidWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmInvalidText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmInvalidBtn: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  confirmInvalidBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

    /** ---------------- Recipient New (Flutterwave) ---------------- **/
  recipientNewContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },

  recipientNewSummaryCard: {
    marginTop: 14,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  recipientNewSummaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
    opacity: 0.9,
  },
  recipientNewSummaryAmount: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.primaryDark,
    letterSpacing: -0.2,
  },
  recipientNewSummaryPills: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientNewPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    marginRight: 10,
  },
  recipientNewPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  recipientNewPillSoft: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  recipientNewPillSoftText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },

  recipientNewLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  recipientNewSelect: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recipientNewSelectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    paddingRight: 10,
  },
  recipientNewSelectPlaceholder: {
    color: COLORS.muted,
  },
  recipientNewSelectChevron: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.muted,
  },

  recipientNewInputBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientNewInputBoxVerified: {
    backgroundColor: "rgba(26,107,204,0.06)",
    borderColor: "rgba(26,107,204,0.20)",
  },
  recipientNewInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    paddingVertical: 14,
  },

  recipientNewVerifiedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recipientNewVerifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },

  recipientNewHelpText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
    lineHeight: 16,
  },

  recipientNewSoftBtn: {
    marginTop: 12,
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.16)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  recipientNewSoftBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },

  recipientNewSaveRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientNewCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  recipientNewCheckboxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  recipientNewCheckboxTick: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  recipientNewSaveText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  recipientNewContinueBtn: {
    marginTop: 22,
  },

  /** ---------------- Bank Modal ---------------- **/
  bankModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  bankModalBackdrop: {
    flex: 1,
  },
  bankModalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "78%",
    paddingBottom: 18,
    overflow: "hidden",
  },
  bankModalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bankModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  bankModalSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },
  bankModalCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
  },
  bankModalCloseText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },

  bankModalSearchWrap: {
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  bankModalSearchIcon: {
    fontSize: 14,
    color: COLORS.muted,
    marginRight: 8,
  },
  bankModalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  bankModalList: {
    paddingHorizontal: 16,
  },
  bankModalRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bankModalRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    paddingRight: 10,
  },
  bankModalChevron: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.muted,
  },

  bankModalLoading: {
    alignItems: "center",
    paddingVertical: 22,
  },
  bankModalLoadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  bankModalEmpty: {
    paddingVertical: 22,
    alignItems: "center",
  },
  bankModalEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  bankModalEmptySub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: 18,
    lineHeight: 16,
  },


    /** ---------------- Generic center state ---------------- **/
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  centerStateText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  /** ---------------- Recipient Select ---------------- **/
  recipientSelectContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  recipientSelectSearchWrap: {
    marginTop: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientSelectSearchIcon: {
    fontSize: 14,
    color: COLORS.muted,
    marginRight: 8,
  },
  recipientSelectSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },

  recipientSelectNewCard: {
    marginTop: SPACE.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  recipientSelectNewIconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.md,
  },
  recipientSelectNewIconPlus: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  recipientSelectNewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  recipientSelectNewSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  recipientSelectSectionRow: {
    marginTop: SPACE.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recipientSelectSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  recipientSelectSectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  recipientSelectListContent: {
    paddingBottom: 28,
    paddingTop: SPACE.sm + 2,
  },

  recipientSelectCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  recipientSelectRow: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientSelectDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: SPACE.lg,
  },

  recipientSelectAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.md,
  },
  recipientSelectAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  recipientSelectRowInfo: {
    flex: 1,
    paddingRight: 10,
  },
  recipientSelectRowName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  recipientSelectRowSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  recipientSelectChevron: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.muted,
  },

  recipientSelectEmpty: {
    marginTop: SPACE.xl + 2,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACE.xl,
    alignItems: "center",
    ...GLASS_BORDER,
    ...CARD_SHADOW,
  },
  recipientSelectEmptyIcon: {
    fontSize: 26,
  },
  recipientSelectEmptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  recipientSelectEmptySub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 16,
  },
  recipientSelectEmptyBtn: {
    marginTop: 14,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recipientSelectEmptyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },

  netErrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  netErrBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },

  // Modal card
  netErrModalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  netErrModalCardCompact: {
    padding: 14,
  },

  netErrModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  netErrCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  netErrCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  });
}

export function useOtherStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => makeOtherStyles(colors), [colors]);
}

/** Frozen at the light palette — for screens intentionally excluded from the
 *  dark/light redesign (onboarding). Don't use this in any converted screen. */
export const otherstyles = makeOtherStyles(LIGHT_COLORS);
