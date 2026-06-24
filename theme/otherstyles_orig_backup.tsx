// theme/styles.ts
import { Platform, StyleSheet } from "react-native";
import { COLORS } from "./colors";

export const otherstyles = StyleSheet.create({
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
    backgroundColor: "#F2F4F7",
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
    color: "#111827",
    textAlign: "center",
  },
  netErrMessage: {
    marginTop: 6,
    fontSize: 13,
    color: "#6B7280",
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
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 18,
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  backIcon: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E1E1E",
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
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  confirmSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },

  confirmHeroCard: {
    marginTop: 14,
    backgroundColor: "rgba(25,149,95,0.10)",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(25,149,95,0.14)",
  },
  confirmHeroLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F5132",
    opacity: 0.9,
  },
  confirmHeroAmount: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: "700",
    color: "#0F5132",
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
    backgroundColor: "rgba(25,149,95,0.14)",
  },
  confirmHeroPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F5132",
  },
  confirmHeroDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginHorizontal: 10,
    backgroundColor: "rgba(15,81,50,0.5)",
  },
  confirmHeroMetaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F5132",
    opacity: 0.9,
  },

  confirmSectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  confirmCard: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
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
    color: "#6B7280",
  },
  confirmRowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  confirmRowValueSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },

  confirmDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },

  confirmDetailBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  confirmDetailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  confirmDetailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  confirmMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 0.2,
  },

  confirmNotice: {
    marginTop: 14,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.22)",
  },
  confirmNoticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
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
    color: "#92400E",
  },
  confirmNoticeText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
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
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPrimaryBtnDisabled: {
    opacity: 0.6,
  },
  confirmPrimaryBtnText: {
    color: COLORS.black,
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
    color: "#6B7280",
  },

  confirmInvalidWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmInvalidText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmInvalidBtn: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
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
    backgroundColor: "rgba(25,149,95,0.10)",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(25,149,95,0.14)",
  },
  recipientNewSummaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F5132",
    opacity: 0.9,
  },
  recipientNewSummaryAmount: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: "#0F5132",
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
    backgroundColor: "rgba(25,149,95,0.14)",
    marginRight: 10,
  },
  recipientNewPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F5132",
  },
  recipientNewPillSoft: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  recipientNewPillSoftText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },

  recipientNewLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },

  recipientNewSelect: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    color: "#111827",
    paddingRight: 10,
  },
  recipientNewSelectPlaceholder: {
    color: "#9CA3AF",
  },
  recipientNewSelectChevron: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  recipientNewInputBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientNewInputBoxVerified: {
    backgroundColor: "rgba(25,149,95,0.06)",
    borderColor: "rgba(25,149,95,0.25)",
  },
  recipientNewInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    paddingVertical: 14,
  },

  recipientNewVerifiedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(25,149,95,0.12)",
    borderWidth: 1,
    borderColor: "rgba(25,149,95,0.22)",
  },
  recipientNewVerifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#19955f",
  },

  recipientNewHelpText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    lineHeight: 16,
  },

  recipientNewSoftBtn: {
    marginTop: 12,
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.16)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  recipientNewSoftBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8",
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
    borderColor: "#D1D5DB",
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
    color: "#374151",
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
    color: "#111827",
  },
  bankModalSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  bankModalCloseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  bankModalCloseText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },

  bankModalSearchWrap: {
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  bankModalSearchIcon: {
    fontSize: 14,
    color: "#9CA3AF",
    marginRight: 8,
  },
  bankModalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  bankModalList: {
    paddingHorizontal: 16,
  },
  bankModalRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bankModalRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    paddingRight: 10,
  },
  bankModalChevron: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  bankModalLoading: {
    alignItems: "center",
    paddingVertical: 22,
  },
  bankModalLoadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  bankModalEmpty: {
    paddingVertical: 22,
    alignItems: "center",
  },
  bankModalEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  bankModalEmptySub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
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
    color: "#9CA3AF",
  },

  /** ---------------- Recipient Select ---------------- **/
  recipientSelectContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  recipientSelectSearchWrap: {
    marginTop: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientSelectSearchIcon: {
    fontSize: 14,
    color: "#9CA3AF",
    marginRight: 8,
  },
  recipientSelectSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  recipientSelectNewCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientSelectNewIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(25,149,95,0.12)",
    borderWidth: 1,
    borderColor: "rgba(25,149,95,0.20)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recipientSelectNewIconPlus: {
    fontSize: 18,
    fontWeight: "700",
    color: "#19955f",
  },
  recipientSelectNewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  recipientSelectNewSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },

  recipientSelectSectionRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recipientSelectSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  recipientSelectSectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  recipientSelectListContent: {
    paddingBottom: 28,
    paddingTop: 10,
  },

  recipientSelectCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  recipientSelectRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  recipientSelectDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginLeft: 14,
  },

  recipientSelectAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recipientSelectAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  recipientSelectRowInfo: {
    flex: 1,
    paddingRight: 10,
  },
  recipientSelectRowName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  recipientSelectRowSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },

  recipientSelectChevron: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  recipientSelectEmpty: {
    marginTop: 22,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    alignItems: "center",
  },
  recipientSelectEmptyIcon: {
    fontSize: 26,
  },
  recipientSelectEmptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  recipientSelectEmptySub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 16,
  },
  recipientSelectEmptyBtn: {
    marginTop: 14,
    backgroundColor: "rgba(25,149,95,0.12)",
    borderWidth: 1,
    borderColor: "rgba(25,149,95,0.22)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recipientSelectEmptyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#19955f",
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
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    backgroundColor: "#F3F4F6",
  },
  netErrCloseText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },

  // Reuse your existing ones if you already have them:
  netErrIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  netErrIcon: { fontSize: 20 },

  netErrTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginTop: 4 },
  netErrMessage: { marginTop: 6, color: "#6B7280", fontWeight: "600", lineHeight: 20, textAlign:'center' },

  netErrBtn: { marginTop: 14, borderRadius: 12 },
  netErrBtnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  netErrBtnText: { color: "#fff", fontWeight: "700", fontSize: 16, marginLeft: 10 },

  netErrHint: { marginTop: 12, color: "#9CA3AF", fontWeight: "700", fontSize: 12 },
});
