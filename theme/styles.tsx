import { useMemo } from "react";
import { Platform, StyleSheet, Dimensions } from "react-native";
import { ColorTokens, LIGHT_COLORS } from "./palettes";
import { useAppTheme } from "./ThemeProvider";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER } from "./designSystem";

const { width: W, height: H } = Dimensions.get("window");

export function makeStyles(colors: ColorTokens) {
  return StyleSheet.create({

  // ─────────────────────────────────────────────
  // Onboarding / Slide
  // ─────────────────────────────────────────────
  slide: { flex: 1, marginTop:10 },

  langPill: {
    position: "absolute", right: 16, zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.borderLight,
  },
  langText:  { fontSize: 14, fontWeight: "700", color: colors.text },
  langArrow: { marginLeft: 6, color: colors.muted },

  textWrap: {
    paddingTop: Platform.OS === "ios" ? 120 : 100,
    paddingHorizontal: 24,
    marginTop: -10,
  },
  title: {
    fontSize: 20, lineHeight: 26, fontWeight: "700",
    color: colors.text, letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 8, fontSize: 13, lineHeight: 20,
    fontWeight: "500", color: colors.textSecondary,
  },

  imageWrap: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 14 },
  hero: { width: W, height: Math.min(H * 0.55, 520) },

  bottomWrap: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    alignItems: "center",
  },
  dots: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dot:  { width: 8, height: 8, borderRadius: 99, marginHorizontal: 5 },
  dotActive:   { backgroundColor: colors.primary, transform: [{ scaleX: 2 }] },
  dotInactive: { backgroundColor: colors.border },

  // ─────────────────────────────────────────────
  // Buttons
  // ─────────────────────────────────────────────
  primaryBtn: {
    width: "100%", height: 54, borderRadius: 16,
    backgroundColor: colors.actionBg,
    alignItems: "center", justifyContent: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: colors.actionText, fontSize: 14, fontWeight: "700", letterSpacing: 0.1 },

  outlineBtn: {
    width: "100%", height: 54, borderRadius: 16,
    borderWidth: 1.5, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent", marginTop: 12,
  },
  outlineBtnText: { color: colors.primary, fontWeight: "700", fontSize: 16 },

  disabledBigBtn: {
    height: 54, borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: "center", alignItems: "center", marginTop: 16,
  },
  disabledContinue: {
    height: 54, borderRadius: 16,
    backgroundColor: colors.borderLight,
    justifyContent: "center", alignItems: "center",
  },
  disabledBigBtnText: { color: colors.muted, fontWeight: "600", fontSize: 16 },

  bigBtn: {
    height: 54, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 18,
  },
  bigBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  bigBottomBtn: {
    height: 54, borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  bigBottomBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },

  loginText: { marginTop: 14, fontSize: 16, fontWeight: "500", color: colors.text },

  // ─────────────────────────────────────────────
  // Tab Bar
  // ─────────────────────────────────────────────
  tabBar: {
    height: 74, paddingBottom: 10, paddingTop: 8,
    backgroundColor: colors.card,
    borderTopColor: colors.line, borderTopWidth: 1,
  },
  tabLabel: { fontSize: 11, fontWeight: "700" },
  tabIconDot: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
  },
  tabIconText: { fontSize: 16, color: colors.muted, fontWeight: "500" },

  // ─────────────────────────────────────────────
  // Typography
  // ─────────────────────────────────────────────
  bigTitle: {
    fontSize: 20, fontWeight: "700", marginTop: 10,
    color: colors.text, marginBottom: 10,
  },
  muted: { color: colors.muted, fontWeight: "600" },

  pageSectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  headerTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  flowHeaderTitle: { fontWeight: "700", color: colors.text, fontSize: 15, flex: 1, textAlign: "center" },

  // ─────────────────────────────────────────────
  // Home screen layout
  // ─────────────────────────────────────────────
  topBar: { paddingHorizontal: 16, paddingTop: 10, flexDirection: "row", alignItems: "center" },

  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: colors.primary,
  },

  getGiftPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.accentLight,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
  },
  getGiftText: { marginLeft: 6, fontWeight: "700", color: colors.accentDark },

  sectionRow: { marginTop: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  hideBalanceRow: { flexDirection: "row", alignItems: "center" },
  hideBalanceText: { color: colors.muted, fontWeight: "700" },

  // Wallet / account cards
  accountsRow: { paddingHorizontal: 12, flexDirection: "row", gap: 0, marginTop: 12 },
  accountCard: {
    flex: 1, backgroundColor: colors.primaryLight,
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18,
  },
  accountCardGradient: {
    width: 210, height: 145, borderRadius: 20, padding: 20,
    position: "relative", overflow: "hidden",
  },
  accountCardShadow: {
    borderRadius: 20, backgroundColor: colors.card,
  },
  accountHeader: { flexDirection: "row", alignItems: "center" },
  flag: { fontSize: 18, marginRight: 8 },
  accountLabel: { fontWeight: "700", color: colors.textSecondary },
  accountLabelWhite: { fontWeight: "600", color: "#FFFFFF", fontSize: 18, margin: 4 },
  accountAmount: { marginTop: 16, fontSize: 26, fontWeight: "700", color: colors.text },
  accountAmountWhite: { marginTop: 16, fontSize: 26, fontWeight: "700", color: "#FFFFFF" },
  cardCornerImage: {
    position: "absolute", right: 0, bottom: 50,
    width: 60, height: 70, opacity: 0.8, zIndex: 1,
  },

  actionsRow: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", marginTop: 14 },

  moreCircle: {
    marginLeft: 12, width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: colors.primary,
    justifyContent: "center", alignItems: "center", backgroundColor: colors.primaryLight,
  },

  // Recent recipients
  recentRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 12, marginBottom: 15 },
  recentCard: {
    width: 120, backgroundColor: colors.card,
    borderRadius: 18, padding: 12,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  recentAvatarWrap: { position: "relative", width: 44, height: 44 },
  recentAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center",
  },
  smallFlag: {
    position: "absolute", right: -6, bottom: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.borderLight,
  },
  recentName: { marginTop: 8, fontWeight: "600", color: colors.text },
  recentBank: { marginTop: 2, color: colors.muted, fontWeight: "700", fontSize: 11 },

  // Service icons
  servicesRow: { flexDirection: "row", gap: 18, paddingHorizontal: 16, marginTop: 12 },
  serviceItem: { alignItems: "center", width: 72 },
  serviceIcon: {
    width: 58, height: 58, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    backgroundColor: colors.primaryLight,
  },
  serviceText: { marginTop: 8, fontWeight: "600", textAlign: "center", fontSize: 12, color: colors.text },

  // ─────────────────────────────────────────────
  // Bottom Sheet
  // ─────────────────────────────────────────────
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(30,21,53,0.45)" },
  sheetContainer: { position: "relative", left: 0, right: 0, bottom: 0 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: 28 },
  sheetHandle: {
    alignSelf: "center", width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginTop: 8, marginBottom: 6,
  },
  sheetClose: {
    position: "absolute", left: 14, top: 14,
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    backgroundColor: colors.primaryLight,
  },
  sheetTitle: { textAlign: "center", fontWeight: "700", fontSize: 15, marginBottom: 10, marginTop: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  sheetRow: {
    width: "100%", backgroundColor: colors.card,
    borderRadius: 16, padding: 14,
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 10,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  sheetRowLeft: { flexDirection: "row", alignItems: "center" },
  sheetRowTitle: { fontWeight: "600", fontSize: 16, color: colors.text },
  sheetRowSub: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  sheetRowAmt: { fontWeight: "700", color: colors.text },
  sheetText: {
    marginTop: 14, textAlign: "center",
    color: colors.textSecondary, fontSize: 15,
    fontWeight: "600", lineHeight: 22,
  },
  sheetCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sheetCloseText: { fontSize: 20, fontWeight: "500", color: colors.text },
  sheetDivider: { height: 1, backgroundColor: colors.borderLight },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(30,21,53,0.45)", justifyContent: "flex-end" },

  // ─────────────────────────────────────────────
  // Send / Convert Cards
  // ─────────────────────────────────────────────
  noticePill: {
    backgroundColor: colors.accentLight,
    borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginTop: 8,
  },
  sendCard: {
    backgroundColor: colors.card, borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: colors.borderLight, marginTop: 12,
  },
  fieldLabel: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  amountRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  amountInput: { flex: 1, fontSize: 34, fontWeight: "700", color: colors.text, paddingVertical: 6 },
  currencyPill: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.primaryLight, marginLeft: 10,
  },
  ratePill: {
    alignSelf: "flex-end",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, marginTop: 10,
  },
  payWithCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 14, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 14,
    ...GLASS_BORDER,
  },
  changeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10,
  },

  // Convert
  convertHint: { color: colors.muted, fontWeight: "600", marginTop: 6 },
  convertBox: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACE.xl,
    marginTop: SPACE.lg, ...GLASS_BORDER, ...CARD_SHADOW,
  },
  convertRow: { flexDirection: "row", alignItems: "center", marginTop: SPACE.md },
  convertBalance: { marginTop: SPACE.sm, color: colors.muted, fontWeight: "600" as const },
  convertMid: { alignItems: "flex-start", marginTop: SPACE.md, marginLeft: SPACE.md, gap: SPACE.sm },
  feesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },

  // ─────────────────────────────────────────────
  // Transactions
  // ─────────────────────────────────────────────
  bottomHint: { textAlign: "center", color: colors.muted, fontWeight: "600", marginTop: 10 },

  groupDate: { fontWeight: "700", color: colors.text, fontSize: 13 },
  groupLine: { height: 1, backgroundColor: colors.line, marginTop: 8 },

  txRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", padding: 14,
    backgroundColor: colors.card, borderRadius: 16, marginTop: 10,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  txLeft:   { flexDirection: "row", alignItems: "center", gap: 12 },
  txIcon:   { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: "center", alignItems: "center" },
  txTitle:  { fontWeight: "600", color: colors.text },
  txTime:   { color: colors.muted, fontWeight: "600", marginTop: 2, fontSize: 12 },
  txRight:  { alignItems: "flex-end" },
  txAmt:    { fontWeight: "700", color: colors.text },
  txSubAmt: { marginTop: 2, color: colors.muted, fontWeight: "600", fontSize: 12 },

  // Filter pills
  filtersRow: { flexDirection: "row", gap: 8, marginTop: 4, padding: 12 },
  filterPill: {
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText:       { fontWeight: "600", color: colors.textSecondary, fontSize: 13 },
  filterTextActive: { color: "#FFFFFF" },

  // ─────────────────────────────────────────────
  // Wallet detail screen
  // ─────────────────────────────────────────────
  centerHeader:  { alignItems: "center" },
  flagBig:       { fontSize: 24, marginTop: 6 },
  walletTitle:   { marginTop: 8, fontWeight: "700", color: colors.textSecondary },
  walletAmount:  { marginTop: 10, fontSize: 36, fontWeight: "700", color: colors.text },
  limitsPill:    { flexDirection: "row", alignItems: "center", backgroundColor: colors.primaryLight, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, marginTop: 12 },
  walletActionRow: { flexDirection: "row", gap: 18, marginTop: 16 },
  walletActionCircle: {
    borderColor: colors.primary, borderWidth: 1.5,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center",
  },

  pillTabs: { flexDirection: "row", backgroundColor: colors.card, borderRadius: 999, padding: 4, marginTop: 16, width: "100%" },
  pillTab:  { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  pillTabActive: { backgroundColor: colors.card },
  pillTabText:   { fontWeight: "600", color: colors.muted, fontSize: 13 },
  pillTabTextActive: { color: colors.text },

  detailsCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.borderLight, marginTop: 10,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  detailKey: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  detailVal: { fontWeight: "600", color: colors.text },

  // ─────────────────────────────────────────────
  // Add Money Methods
  // ─────────────────────────────────────────────
  methodCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.borderLight, marginTop: 12,
  },
  methodIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentLight, justifyContent: "center", alignItems: "center" },
  methodTitle: { fontWeight: "700", fontSize: 16, marginBottom: 3, color: colors.text },

  // ─────────────────────────────────────────────
  // Flow / nav headers
  // ─────────────────────────────────────────────
  flowHeader: {
    paddingTop: 10, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: "center", alignItems: "center",
  },
  iconBtnText: { fontWeight: "700", color: colors.text, fontSize: 14 },

  stackHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, paddingBottom: 10 },

  // ─────────────────────────────────────────────
  // Recipients
  // ─────────────────────────────────────────────
  searchBox: {
    marginTop: 12, height: 48, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, flexDirection: "row", alignItems: "center",
  },
  newRecipientRow: {
    marginTop: 12, backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderLight, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  plusCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  newRecipientText: { fontWeight: "700", fontSize: 15, color: colors.text },
  blockTitle: { marginTop: 18, fontWeight: "700", color: colors.text, fontSize: 15 },

  recentBubblesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  recentBubble: { width: 78, alignItems: "center" },
  recentBubbleAvatarWrap: { position: "relative", width: 56, height: 56 },
  recentBubbleAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  recentBubbleName: { marginTop: 8, fontWeight: "600", maxWidth: 78, color: colors.text, fontSize: 12 },
  recentBubbleBank: { marginTop: 2, color: colors.muted, fontWeight: "600", fontSize: 11, maxWidth: 78 },

  segmentRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  segmentPill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.card },
  segmentPillActive: { backgroundColor: colors.primary },
  segmentText: { fontWeight: "600", color: colors.textSecondary, fontSize: 13 },
  segmentTextActive: { color: "#FFFFFF" },

  recipientRow: {
    backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: 14, marginTop: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  recipientLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  recipientAvatarWrap: { width: 44, height: 44, position: "relative" },
  recipientAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  recipientName: { fontWeight: "600", color: colors.text },
  recipientMeta: { marginTop: 2, color: colors.muted, fontWeight: "600", fontSize: 12 },
  chev: { fontSize: 18, color: colors.border, fontWeight: "500" },

  // ─────────────────────────────────────────────
  // Recipient details / form
  // ─────────────────────────────────────────────
  inputLabel: { fontWeight: "600", color: colors.muted, marginBottom: 10, marginTop: 14, fontSize: 13 },
  dropdown: {
    marginTop: 10, height: 54, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  dropdownText:  { fontWeight: "600", color: colors.text },
  dropdownArrow: { fontWeight: "600", color: colors.muted },
  textField: {
    marginTop: 10, height: 54, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, justifyContent: "center",
  },
  textFieldInput: { fontWeight: "600", fontSize: 15, color: colors.text },

  toggleRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  toggle: { width: 44, height: 26, borderRadius: 999, padding: 2, justifyContent: "center" },
  toggleOn:  { backgroundColor: colors.primary },
  toggleOff: { backgroundColor: colors.border },
  toggleDot:  { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.card },
  toggleText: { marginLeft: 12, fontWeight: "700", color: colors.muted },
  toggleTrack:    { width: 44, height: 26, borderRadius: 15, padding: 2, justifyContent: "center" },
  toggleTrackOn:  { backgroundColor: colors.primary },
  toggleTrackOff: { backgroundColor: colors.border },
  toggleKnob:     { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.card },
  toggleLabel:    { marginLeft: 10, fontSize: 15, fontWeight: "500", color: colors.text },

  // ─────────────────────────────────────────────
  // Confirm / Review
  // ─────────────────────────────────────────────
  confirmAvatar: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  verifyBadge: {
    position: "absolute", top: 74, right: "38%",
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.green,
    justifyContent: "center", alignItems: "center",
    borderWidth: 3, borderColor: "#FFFFFF",
  },
  confirmTitle: { marginTop: 18, fontWeight: "700", fontSize: 18, color: colors.text },
  confirmCard: {
    width: "100%", backgroundColor: colors.card,
    borderRadius: 18, padding: 16, marginTop: 12, alignItems: "center",
    ...GLASS_BORDER,
  },
  confirmName: { fontWeight: "700", fontSize: 16, color: colors.text },
  confirmMeta: { marginTop: 6, color: colors.muted, fontWeight: "600" },
  confirmHint: { marginTop: 14, color: colors.muted, fontWeight: "600", textAlign: "center" },

  reviewTopIcons: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 6 },
  reviewFlagCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.borderLight,
    justifyContent: "center", alignItems: "center",
  },
  reviewAvatarSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  reviewSmall:  { textAlign: "center", marginTop: 14, color: colors.muted, fontWeight: "700" },
  reviewBig:    { textAlign: "center", marginTop: 8, fontSize: 34, fontWeight: "700", color: colors.text },
  reviewTo:     { textAlign: "center", marginTop: 6, color: colors.muted, fontWeight: "600" },
  hr:           { height: 1, backgroundColor: colors.line, marginTop: 14 },
  reviewSection: { marginTop: 14, fontWeight: "700", color: colors.text },
  reviewCard: {
    backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: 16, marginTop: 12,
  },
  reviewRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  reviewKey:     { color: colors.muted, fontWeight: "600", fontSize: 13 },
  reviewVal:     { fontWeight: "700", color: colors.text },
  reviewDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  deliveryPill:  { marginTop: 12, backgroundColor: colors.greenSoft, borderRadius: 14, padding: 12, alignItems: "center" },

  // ─────────────────────────────────────────────
  // Fraud Aware
  // ─────────────────────────────────────────────
  warnTriangle: {
    alignSelf: "center", width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accentLight,
    justifyContent: "center", alignItems: "center",
  },
  warnTitle: { textAlign: "center", marginTop: 14, fontSize: 26, fontWeight: "700", color: colors.text },
  warnCard: {
    marginTop: 14, backgroundColor: colors.card,
    borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight, padding: 16,
  },
  warnStop: { fontWeight: "700", marginBottom: 8, color: colors.text },
  warnRow:  { flexDirection: "row", gap: 10, marginTop: 10 },
  warnX:    { color: colors.red, fontWeight: "700", marginTop: 2 },
  warnText: { flex: 1, color: colors.muted, fontWeight: "600", lineHeight: 20 },
  infoBox: {
    marginTop: 14, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, padding: 14,
  },

  // ─────────────────────────────────────────────
  // PIN
  // ─────────────────────────────────────────────
  pinHeader: { paddingTop: 10, paddingHorizontal: 12 },
  pinTop:    { alignItems: "center", marginTop: 30 },
  pinShield: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight,
    borderWidth: 2, borderColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  pinTitle:   { marginTop: 14, fontSize: 26, fontWeight: "700", color: colors.text },
  pinDotsRow: { flexDirection: "row", gap: 14, marginTop: 20 },
  pinDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.border, borderWidth: 1, borderColor: colors.border,
  },
  pinPad: { marginTop: 36, paddingHorizontal: 28 },
  pinRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  pinKey: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: "center", alignItems: "center",
  },
  pinKeyText: { fontSize: 22, fontWeight: "600", color: colors.text },
  forgotPin:  { textAlign: "center", marginTop: 24, color: colors.primary, fontWeight: "700" },
  pinError: {
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: colors.errorLight, color: colors.red,
    borderRadius: 12, fontSize: 14, fontWeight: "600",
    textAlign: "center", alignSelf: "center",
  },

  // ─────────────────────────────────────────────
  // Auth screens
  // ─────────────────────────────────────────────
  shell: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 0, paddingTop: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  backBtn:  { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  backIcon: { fontSize: 22, fontWeight: "700", color: colors.primary },
  backArrow: { fontSize: 22, fontWeight: "700", color: colors.primary },

  getHelpPillWrap: { alignItems: "flex-end" },
  getHelpPill:     { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.primaryLight },
  getHelpPillText: { color: colors.primary, fontWeight: "600" },
  getHelpText:     { color: colors.primary, fontWeight: "600" },

  phoneRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  countryBox: {
    width: 72, height: 56, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  phoneInputBox: {
    flex: 1, height: 56, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, flexDirection: "row", alignItems: "center",
  },
  signInRow:  { textAlign: "center", marginTop: 18, color: colors.textSecondary, fontWeight: "600" },
  checkRow:   { flexDirection: "row", marginTop: 14 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: colors.primary,
    marginRight: 12, marginTop: 2, backgroundColor: colors.card,
  },
  checkText: { flex: 1, color: colors.textSecondary, fontWeight: "600", lineHeight: 20 },
  link: { color: colors.primary, fontWeight: "600" },

  inputBox: {
    height: 54, borderRadius: 16,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, justifyContent: "center",
  },
  input: { fontSize: 16, fontWeight: "600", color: colors.text },
  phoneInput: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  dialCodeText: { marginRight: 8, fontWeight: "700", color: colors.text },

  passwordBox: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 14, height: 54,
    flexDirection: "row", alignItems: "center",
  },
  passwordInput: { flex: 1, height: "100%", fontSize: 16, fontWeight: "600", color: colors.text, paddingVertical: 0 },
  showBtn:  { paddingLeft: 12, paddingVertical: 10 },
  showText: { color: colors.primary, fontWeight: "600" },
  eyeBtn:  { paddingLeft: 10, paddingVertical: 10 },
  eyeIcon: { fontSize: 18, opacity: 0.55 },

  secureText: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: 16, marginBottom: 32 },

  ruleRow:  { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  ruleDot:  { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginRight: 10 },
  ruleText: { color: colors.muted, fontWeight: "600", flex: 1, lineHeight: 20 },

  recoverRow:  { flexDirection: "row", alignItems: "center", marginTop: 14 },
  recoverLink: { color: colors.primary, fontWeight: "600", textDecorationLine: "underline" },

  bottomAuthRow:  { flexDirection: "row", justifyContent: "center", marginTop: 18, marginBottom: 6 },
  authGreenLink:  { color: colors.primary, fontWeight: "600" },

  // Progress
  progressTrack: { height: 5, backgroundColor: colors.borderLight, borderRadius: 99, marginTop: 10, overflow: "hidden" },
  progressFill:  { height: 5, width: "45%", backgroundColor: colors.primary },

  // OTP
  otpRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  otpBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
    marginRight: 10, alignItems: "center", justifyContent: "center",
  },
  otpChar: { fontSize: 20, fontWeight: "600", color: colors.text, textAlign: "center", lineHeight: 50 },
  otpBoxActive: { borderColor: colors.primary, borderWidth: 2 },
  otpBoxFilled: { borderColor: colors.primaryMid },
  otpHiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },

  resendText: { textAlign: "left", color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 8, paddingHorizontal: 6 },
  resendLink:  { color: colors.primary, fontWeight: "600" },
  resendTimer: { color: colors.text, fontWeight: "600" },

  // Check Email
  centerIconWrap: { marginTop: 26, alignItems: "center", justifyContent: "center" },
  centerIcon: { width: 95, height: 95 },
  checkEmailTitle: { marginTop: 18, fontSize: 28, fontWeight: "700", textAlign: "center", color: colors.text },
  checkEmailSub:   { marginTop: 10, fontSize: 15, textAlign: "center", color: colors.muted },
  checkEmailEmail: { marginTop: 8, fontSize: 16, fontWeight: "700", textAlign: "center", color: colors.text },
  changeEmailLink: { marginTop: 8, fontSize: 15, fontWeight: "700", textAlign: "center", color: colors.primary },
  checkEmailHint:  { marginTop: 14, fontSize: 15, lineHeight: 22, textAlign: "center", color: colors.muted, paddingHorizontal: 18 },

  // ─────────────────────────────────────────────
  // Cards & Info
  // ─────────────────────────────────────────────
  infoCard: { backgroundColor: colors.primaryLight, borderRadius: 14, padding: 14, marginTop: 16, flexDirection: "row", alignItems: "flex-start" },
  infoIcon: { marginRight: 8, fontSize: 16 },

  step: { flexDirection: "row", marginTop: 16 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginRight: 12 },
  stepNumberText: { fontWeight: "700", color: "#FFFFFF", fontSize: 14 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 2 },
  stepDesc:  { fontSize: 13, color: colors.muted, lineHeight: 18 },

  emailBox:  { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginTop: 8, alignItems: "center" },
  emailText: { fontSize: 15, fontWeight: "700", color: colors.text },
  copyText:  { fontSize: 11, color: colors.muted, marginTop: 2 },

  currencySymbol: { fontSize: 24, fontWeight: "600", color: colors.textSecondary },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },

  yellowInfo:     { marginTop: 14, backgroundColor: colors.accentLight, borderRadius: 14, padding: 14 },
  yellowInfoText: { color: colors.accentDark, fontSize: 14, fontWeight: "600", lineHeight: 20 },

  label: { color: colors.muted, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  formLabel: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 },

  twoColRow: { flexDirection: "row", marginTop: 16 },
  dobBox: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 12, height: 54,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  calendarIcon: { fontSize: 18, opacity: 0.65 },

  infoRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  infoText: { color: colors.muted, fontWeight: "600" },

  // ─────────────────────────────────────────────
  // Profile / Settings
  // ─────────────────────────────────────────────
  profileTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", paddingTop: 4 },
  banner: { height: 110, borderRadius: 18, overflow: "hidden", marginTop: 8, backgroundColor: colors.primaryLight },
  bannerArt: { flex: 1, backgroundColor: colors.primaryLight },
  profileHeader: { alignItems: "center", marginTop: -36, marginBottom: 8 },
  avatarWrap:    { marginBottom: 10 },
  avatarPlus: {
    position: "absolute", right: -2, bottom: 0,
    width: 22, height: 22, borderRadius: 999,
    backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderLight,
  },
  profileName:  { fontSize: 20, fontWeight: "700", color: colors.text },
  greenCheck:   { color: colors.green, fontWeight: "500", fontSize: 18, marginLeft: 4 },
  profileEmail: { marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.muted },

  menuRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuIconWrap: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: colors.primaryLight },
  menuIcon:     { fontSize: 18 },
  menuTitle:    { fontSize: 15, fontWeight: "600", color: colors.text },
  menuSubtitle: { marginTop: 2, fontSize: 12, fontWeight: "600", color: colors.muted },
  versionText:  { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 10 },

  card: { backgroundColor: colors.card, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight },
  settingRow: { paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  settingLeft:  { flexDirection: "row", alignItems: "center", flex: 1 },
  settingIcon:  { width: 28, fontSize: 18, marginRight: 12, opacity: 0.9 },
  settingLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  divider:      { height: 1, backgroundColor: colors.borderLight, marginLeft: 54 },

  // ─────────────────────────────────────────────
  // Add Account
  // ─────────────────────────────────────────────
  addAccCard:    { backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight },
  addAccRow:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  addAccFlag:    { fontSize: 26, marginRight: 12 },
  addAccTitle:   { fontSize: 16, fontWeight: "600", color: colors.text },
  addAccSubtitle:{ marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.muted },
  addAccDivider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 54 },
  addAccountPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  addAccountIcon: { fontSize: 18, color: colors.primary, fontWeight: "600", marginRight: 6 },
  addAccountText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  addAccountSingle: { marginRight: 8, backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12, alignItems: "center" },

  // ─────────────────────────────────────────────
  // FX Rate Card (Home)
  // ─────────────────────────────────────────────
  fxCard: {
    backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: colors.borderLight,
  },
  fxHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fxTitle:    { fontSize: 16, fontWeight: "700", color: colors.text },
  fxSubtitle: { marginTop: 4, fontSize: 12, fontWeight: "500", color: colors.muted },
  fxSeeAll:   { fontSize: 13, fontWeight: "700", color: colors.primary },
  fxDivider:  { height: 1, backgroundColor: colors.borderLight, marginTop: 12, marginBottom: 6 },
  fxRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  fxLeft:     { flexDirection: "row", alignItems: "center", flex: 1 },
  fxFlags:    { width: 54, flexDirection: "row", alignItems: "center" },
  fxFlag:     { fontSize: 18, marginRight: 6 },
  fxPair:     { fontSize: 14, fontWeight: "700", color: colors.text, margin: 25 },
  fxPairSub:  { margin: 25, marginTop: -10, marginBottom: -7, fontSize: 12, fontWeight: "500", color: colors.muted },
  fxRight:      { flexDirection: "row", alignItems: "center" },
  fxChangePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginRight: 10 },
  fxUp:         { backgroundColor: "rgba(5,150,105,0.10)", borderColor: "rgba(5,150,105,0.22)" },
  fxDown:       { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.22)" },
  fxChangeText: { fontSize: 12, fontWeight: "600" },
  fxUpText:     { color: colors.green },
  fxDownText:   { color: colors.red },
  fxChevron:    { fontSize: 22, color: colors.border, marginTop: -2 },
  fxFooter:     { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  fxFooterText: { fontSize: 12, fontWeight: "500", color: colors.muted },

  // ─────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────
  notifHeader:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  notifHeaderTitle:      { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.text, marginRight: 44 },
  notifHeaderAction:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primaryLight },
  notifHeaderActionText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  notifFiltersRow:       { flexDirection: "row", paddingHorizontal: 16, marginTop: 6 },
  notifFilterPill:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.card, marginRight: 8 },
  notifFilterPillActive: { backgroundColor: colors.primary },
  notifFilterText:       { fontSize: 13, fontWeight: "600", color: colors.muted },
  notifFilterTextActive: { color: "#FFFFFF" },
  notifSectionTitle:     { paddingHorizontal: 16, fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  notifCard:     { backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight, overflow: "hidden" },
  notifRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 14 },
  notifLeft:     { flexDirection: "row", alignItems: "center", flex: 1 },
  notifIconWrap: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 12, backgroundColor: colors.card },
  notifIconSuccess: { backgroundColor: colors.greenSoft },
  notifIconWarning: { backgroundColor: colors.accentLight },
  notifIconInfo:    { backgroundColor: colors.primaryLight },
  notifIconText:    { fontSize: 18 },
  notifTitleRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginRight: 10 },
  notifTitle:       { fontSize: 14, fontWeight: "700", color: colors.text, flex: 1, paddingRight: 10 },
  notifTitleUnread: { color: colors.text },
  notifUnreadDot:   { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary },
  notifBody:        { marginTop: 4, fontSize: 12, fontWeight: "600", color: colors.muted },
  notifTime:        { marginTop: 6, fontSize: 11, fontWeight: "600", color: colors.muted },
  notifChevron:     { fontSize: 22, color: colors.border, marginLeft: 10 },
  notifDivider:     { height: 1, backgroundColor: colors.borderLight, marginLeft: 70 },
  notifEmpty:       { paddingTop: 80, alignItems: "center", paddingHorizontal: 30 },
  notifEmptyTitle:  { marginTop: 12, fontSize: 18, fontWeight: "700", color: colors.text },
  notifEmptySub:    { marginTop: 8, fontSize: 13, fontWeight: "600", textAlign: "center", color: colors.muted },

  // ─────────────────────────────────────────────
  // Result Screen
  // ─────────────────────────────────────────────
  resultHeader:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  resultWrap:     { flex: 1, paddingHorizontal: 16, justifyContent: "center", paddingBottom: 24 },
  resultCard:     { borderRadius: 24, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 20, borderWidth: 1, borderColor: colors.borderLight },
  resultIconRing: { width: 96, height: 96, borderRadius: 48, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  resultIconInner:{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 8 },
  resultTitle:    { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", marginTop: 2 },
  resultSubtitle: { fontSize: 13, fontWeight: "600", color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 18 },
  resultDetailsBox: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.80)", borderWidth: 1, borderColor: colors.borderLight },
  resultDetailsText:  { fontSize: 12, fontWeight: "600", color: colors.muted, lineHeight: 18 },
  resultPrimaryBtn:   { marginTop: 16, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  resultPrimaryBtnText:   { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  resultSecondaryBtn:     { marginTop: 14, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  resultSecondaryText:    { fontWeight: "700", fontSize: 14 },

  // ─────────────────────────────────────────────
  // Mid-market disclaimer
  // ─────────────────────────────────────────────
  midMarketBox:     { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.30)", backgroundColor: "rgba(245,158,11,0.06)", padding: 14 },
  midMarketRow:     { flexDirection: "row", alignItems: "flex-start" },
  midMarketIconWrap:{ width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(245,158,11,0.15)", alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 2 },
  midMarketIcon:    { color: colors.accentDark },
  midMarketTextWrap:{ flex: 1 },
  midMarketTitle:   { fontSize: 14, fontWeight: "700", color: colors.text },
  midMarketDescription: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 18 },
  midMarketStrong:  { fontWeight: "700", color: colors.text },

  // ─────────────────────────────────────────────
  // Chat Support
  // ─────────────────────────────────────────────
  chatHeader:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  chatHeaderBack:    { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  chatHeaderTitle:   { fontSize: 16, fontWeight: "700", color: colors.text },
  chatHeaderSubRow:  { flexDirection: "row", alignItems: "center", marginTop: 3 },
  chatOnlineDot:     { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.green, marginRight: 6 },
  chatHeaderSubtitle:{ fontSize: 11.5, color: colors.muted, fontWeight: "600" },
  chatHeaderIconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  chatQuickWrap:     { paddingBottom: 10 },
  chatQuickPill:     { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderRadius: 999, borderWidth: 1, borderColor: colors.borderLight, marginRight: 10 },
  chatQuickText:     { fontSize: 12.5, fontWeight: "700", color: colors.text },
  chatListContent:   { paddingHorizontal: 16, paddingBottom: 14 },
  chatRow:           { flexDirection: "row", alignItems: "flex-end", marginTop: 10 },
  chatRowLeft:       { justifyContent: "flex-start" },
  chatRowRight:      { justifyContent: "flex-end" },
  chatAvatar:        { width: 34, height: 34, borderRadius: 14, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center", marginRight: 8 },
  chatBubble:        { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  chatBubbleSupport: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight, borderTopLeftRadius: 6 },
  chatBubbleUser:    { backgroundColor: colors.primary, borderTopRightRadius: 6 },
  chatText:          { fontSize: 13.5, lineHeight: 19 },
  chatTextSupport:   { color: colors.text, fontWeight: "600" },
  chatTextUser:      { color: "#FFFFFF", fontWeight: "600" },
  chatTime:          { marginTop: 6, fontSize: 10.5, fontWeight: "600" },
  chatTimeSupport:   { color: colors.muted, textAlign: "right" },
  chatTimeUser:      { color: "rgba(255,255,255,0.65)", textAlign: "right" },
  chatComposerWrap:  { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 14 : 12, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.bg },
  chatAttachBtn:     { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  chatInputBox:      { flex: 1, minHeight: 42, maxHeight: 110, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, paddingVertical: 10 },
  chatInput:         { fontSize: 14, color: colors.text, fontWeight: "600" },
  chatSendBtn:       { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 10 },

  // ─────────────────────────────────────────────
  // Wallet transactions
  // ─────────────────────────────────────────────
  walletTxWrap:       { marginTop: 12, paddingHorizontal: 16, flex: 1 },
  walletTxLoading:    { marginTop: 24 },
  walletTxEmpty:      { color: colors.muted, textAlign: "center", marginTop: 24, fontWeight: "600" },
  walletTxGroupTitle: { marginTop: 14, marginBottom: 8, fontSize: 12, fontWeight: "700", color: colors.text, textTransform: "uppercase", letterSpacing: 0.4 },
  walletTxCard:       { backgroundColor: colors.card, borderRadius: RADIUS.md, overflow: "hidden", ...GLASS_BORDER, ...CARD_SHADOW },
  walletTxRow:        { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  walletTxDivider:    { height: 1, backgroundColor: colors.borderLight, marginLeft: 58 },
  walletTxIconWrap:   { width: 42, height: 42, borderRadius: RADIUS.full, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: SPACE.md },
  walletTxIconText:   { fontSize: 14, fontWeight: "700", color: colors.primary },
  walletTxMid:        { flex: 1 },
  walletTxName:       { fontSize: 13, fontWeight: "700", color: colors.text },
  walletTxBank:       { marginTop: 3, fontSize: 11, fontWeight: "600", color: colors.muted },
  walletTxMetaRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  walletTxTime:       { fontSize: 11, fontWeight: "600", color: colors.muted },
  walletTxStatus:     { fontSize: 11, fontWeight: "600" },
  walletTxRight:      { alignItems: "flex-end" },
  walletTxAmt:        { fontSize: 13, fontWeight: "700", color: colors.text },
  walletTxAmtNeg:     { color: colors.text },
  walletTxAmtPos:     { color: colors.green },
  walletTxStatusCompleted: { color: colors.green },
  walletTxStatusPending:   { color: colors.accentDark },
  walletTxStatusFailed:    { color: colors.red },

  // ─────────────────────────────────────────────
  // Misc / helpers used across screens
  // ─────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: "rgba(30,21,53,0.35)", justifyContent: "center", alignItems: "center" },
  dropdownSheet: { width: "88%", maxHeight: "70%", backgroundColor: colors.card, borderRadius: 22, padding: 16 },
  dropdownTitle: { fontWeight: "700", fontSize: 18, marginBottom: 10, color: colors.text },

  countryRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  countryName: { fontWeight: "600", fontSize: 16, color: colors.text },
  countryDial: { marginTop: 2, fontWeight: "600", color: colors.muted, fontSize: 13 },

  trigger: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 14, marginRight: 10 },
  arrow:   { fontSize: 10, color: colors.muted },
  overlay: { flex: 1, backgroundColor: "rgba(30,21,53,0.45)", justifyContent: "flex-end" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  closeBtn:  { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 18, color: colors.text },
  searchInput: { margin: 16, padding: 14, backgroundColor: colors.card, borderRadius: 14, fontSize: 16 },

  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  itemSelected: { backgroundColor: colors.primaryLight },
  itemFlag:     { fontSize: 28, marginRight: 12 },
  itemInfo:     { flex: 1, margin: 10 },
  itemName:     { fontSize: 16, fontWeight: "600", color: colors.text },
  itemDialCode: { fontSize: 14, color: colors.muted, marginTop: 2 },
  itemBalance:  { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "600" },
  checkmark:    { fontSize: 18, color: colors.primary, fontWeight: "700" },
  emptyText:    { textAlign: "center", padding: 20, color: colors.muted },

  headerCenterTitle:  { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.text },
  headerRightSpacer:  { width: 44 },

  // Row-based detail layouts
  headerRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 5 },
  sentLabel:  { color: colors.green, fontWeight: "700", fontSize: 12, textTransform: "lowercase", marginBottom: 8 },
  bigAmount:  { fontSize: 28, fontWeight: "700", color: colors.text },
  dateText:   { marginTop: 8, color: colors.muted, fontWeight: "600", fontSize: 12 },

  segmentWrap: { marginTop: 16, backgroundColor: colors.card, borderRadius: 999, padding: 4, flexDirection: "row" },
  segmentBtn:     { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentBtnActive: { backgroundColor: colors.bgTertiary },

  row:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  rowLabel:  { color: colors.muted, fontWeight: "700", fontSize: 12 },
  rowValue:  { color: colors.text, fontWeight: "600", fontSize: 12, maxWidth: "62%", textAlign: "right" },

  statementRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  downloadBtn:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primaryLight },
  downloadIcon: { marginRight: 8, color: colors.primary, fontWeight: "600" },
  downloadText: { color: colors.primary, fontWeight: "700", fontSize: 12 },

  refRow:  { marginTop: 6, flexDirection: "row", alignItems: "center", paddingTop: 10 },
  refText: { marginTop: 6, fontWeight: "600", color: colors.text, fontSize: 12 },
  copyBtn: { marginLeft: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.card },

  updateRow:   { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10 },
  updateDot:   { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.primary, marginTop: 4, marginRight: 10 },
  updateTitle: { fontWeight: "700", color: colors.text, fontSize: 13 },
  updateSub:   { marginTop: 2, color: colors.muted, fontWeight: "600", fontSize: 12 },
  updateTime:  { marginLeft: 10, color: colors.muted, fontWeight: "600", fontSize: 11 },

  amountCard: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 20, padding: 24, alignItems: "center" as const, borderWidth: 1, borderColor: colors.borderLight,},
  typeLabel:  { fontSize: 14, color: colors.muted, fontWeight: "600" as const, marginBottom: 8 },
  amount:     { fontSize: 30, fontWeight: "700" as const, marginBottom: 16, color: colors.text },
  statusBadge:{ flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  statusText: { fontSize: 14, fontWeight: "700" as const, textTransform: "capitalize" as const },

  section:      { marginHorizontal: 16, marginTop: 20, backgroundColor: colors.card, borderRadius: 16, padding: 16, ...GLASS_BORDER },
  sectionTitle: { fontSize: 13, fontWeight: "700" as const, color: colors.muted, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 12 },
  detailLabel:  { fontSize: 14, color: colors.muted, fontWeight: "500" as const },
  detailValue:  { fontSize: 14, color: colors.text, fontWeight: "700" as const, textAlign: "right" as const, flex: 1, marginLeft: 16 },

  conversionRow:    { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginBottom: 12 },
  conversionBox:    { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, alignItems: "center" as const, ...GLASS_BORDER },
  conversionLabel:  { fontSize: 12, color: colors.muted, fontWeight: "600" as const, marginBottom: 4 },
  conversionAmount: { fontSize: 16, color: colors.text, fontWeight: "700" as const },
  conversionArrow:  { fontSize: 20, color: colors.muted, marginHorizontal: 12 },
  description:  { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  helpButton:   { backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, alignItems: "center" as const, ...GLASS_BORDER },
  helpButtonText: { color: colors.text, fontWeight: "700" as const, fontSize: 14 },
  bottomArea:   { marginTop: 16 },

  // Recipient select screen
  recipientScreen:        { width: "100%" },
  recipientHeaderTitle:   { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center", flex: 1 },
  helpCircle:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  helpCircleText: { fontWeight: "700", color: colors.primary },
  recipientCard:  { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.borderLight },
  inputWrap:       { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center" },
  inputWrapVerified: { borderColor: colors.primary },
  inputText:         { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  inputPlaceholderText: { color: colors.muted, fontWeight: "500" },
  textInput:    { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text, padding: 0 },
  verifiedTick: { marginLeft: 10, fontSize: 18, fontWeight: "500", color: colors.primary },
  verifiedCard: { marginTop: 10, backgroundColor: colors.greenSoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.greenLight },
  verifiedCardSmall: { fontSize: 12, fontWeight: "600", color: colors.greenDark },
  verifiedCardName:  { marginTop: 4, fontSize: 16, fontWeight: "600", color: colors.greenDark },
  helperHint: { marginTop: 10, fontSize: 12, fontWeight: "600", color: colors.muted },

  sheetHandle2: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 10, marginBottom: 6 },
  bankRow: { paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.card },
  bankRowSelected: { backgroundColor: colors.primaryLight },
  bankRowText:  { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  bankRowArrow: { fontSize: 22, fontWeight: "700", color: colors.primary },
  loadingWrap:  { paddingVertical: 24, alignItems: "center" },
  loadingText:  { marginTop: 10, color: colors.muted, fontWeight: "600" },

  recipientListContainer:     { paddingHorizontal: 18, paddingTop: 10, flex: 1 },
  recipientListHeaderRow:     { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  recipientListBackBtn:       { paddingVertical: 8, paddingRight: 10 },
  recipientListBackIcon:      { fontSize: 22 },
  recipientListTitle:         { fontSize: 20, fontWeight: "700", color: colors.text },
  recipientListHelpCircle:    { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  recipientListHelpText:      { fontWeight: "700", color: colors.primary },
  recipientListSearchWrap:    { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  recipientListSearchIcon:    { fontSize: 18, marginRight: 10, color: colors.muted },
  recipientListSearchInput:   { flex: 1, fontSize: 15 },
  recipientListNewRow:        { marginTop: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexDirection: "row", alignItems: "center" },
  recipientListNewIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  recipientListNewIconPlus:   { fontSize: 24, color: colors.primary },
  recipientListNewText:       { marginLeft: 12, fontSize: 16, fontWeight: "700", color: colors.text },
  recipientListSectionTitle:  { marginTop: 18, marginBottom: 10, fontSize: 15, fontWeight: "700", color: colors.text },
  recipientListRow:           { paddingVertical: 14, flexDirection: "row", alignItems: "center" },
  recipientListAvatarCircle:  { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  recipientListAvatarText:    { color: "#FFFFFF", fontWeight: "700" },
  recipientListRowInfo:       { marginLeft: 12, flex: 1 },
  recipientListRowName:       { fontSize: 16, fontWeight: "700", color: colors.text },
  recipientListRowSub:        { marginTop: 2, fontSize: 13, color: colors.muted },
  recipientListChevron:       { color: colors.primary, fontSize: 22 },
  recipientListEmpty:         { textAlign: "center", color: colors.muted, marginTop: 30, fontWeight: "600" },
  recipientListBottomSpacer:  { height: 40 },

  searchWrap: { marginTop: 12, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center" },
  searchIcon: { fontSize: 40, color: colors.muted },
  inputIcon:  { fontSize: 40, color: colors.muted, position: "absolute", left: 5 },

  container: { flex: 1, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 },

  // Referral
  welcomeTiny:   { marginTop: 18, fontWeight: "600", letterSpacing: 0.4, color: colors.muted },
  referralIllustration: { width: "100%", height: 240, marginTop: 10 },

  referralBanner: {
    width: "93%", margin: 12, backgroundColor: colors.card,
    borderRadius: 16, borderColor: colors.borderLight, borderWidth: 1,
    padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  referralLeft:     { flexDirection: "row", alignItems: "center" },
  referralIconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  referralTitle:    { fontSize: 15, fontWeight: "700", color: colors.text },
  referralSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },

  refHowCard:    { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.borderLight },
  refHowHeader:  { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  refHowIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  refHowTitle:   { fontSize: 15, fontWeight: "700", color: colors.text },
  refStepRow:    { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
  refStepBadge:  { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 1 },
  refStepBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  refStepText:   { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  refRuleDivider:{ height: 1, backgroundColor: colors.borderLight, marginTop: 14 },
  refRuleRow:    { flexDirection: "row", alignItems: "center", marginTop: 12 },
  refRuleText:   { flex: 1, marginLeft: 10, color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "600" },

  recentEmptyCard: { marginTop: 20, marginBottom: 20, bottom: 0, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, padding: 14, alignItems: "center", left: 0, width: "40%" },
  recentEmptyIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginRight: 12 },
  recentEmptyTitle:  { fontSize: 14, fontWeight: "700", color: colors.text, textAlign: "center" },
  recentEmptySub:    { marginTop: 4, fontSize: 12, fontWeight: "600", color: colors.muted, lineHeight: 16 },
  recentEmptyBtn:    { marginTop: 10, alignSelf: "flex-start", backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  recentEmptyBtnText:{ fontSize: 12, fontWeight: "700", color: colors.primary },

  // Global account screen
  globalHeroWrap:  { width: "100%", height: 320, backgroundColor: colors.primaryLight },
  globalHero:      { width: "100%", height: "100%" },
  globalCard:      { marginTop: -28, backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20 },
  globalTitle:     { fontSize: 26, fontWeight: "700", color: colors.text, marginBottom: 12 },
  globalRow:       { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  globalIcon:      { fontSize: 22, marginRight: 12, marginTop: 2 },
  globalRowTitle:  { fontSize: 16, fontWeight: "600", color: colors.text },
  globalRowSub:    { marginTop: 4, color: colors.muted, fontWeight: "600", lineHeight: 20 },

  // Security
  iconWrap: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 12 },

  // Simple nav
  simpleHeader: { flexDirection: "row", alignItems: "center", paddingTop: 4, paddingBottom: 8 },

  // Verify email card
  verifyCard: { backgroundColor: colors.card, borderRadius: 20, width: "96%", margin: 9, borderWidth: 1, borderColor: colors.borderLight, padding: 16, flexDirection: "row", marginTop: 22, alignItems: "center", justifyContent: "space-between" },
  verifyCardLeft: { flex: 1, paddingRight: 12 },
  verifySmallTitle: { color: colors.primary, fontWeight: "700", fontSize: 13, marginBottom: 6 },
  verifyBigTitle:   { color: colors.text, fontWeight: "700", fontSize: 22, marginBottom: 10 },
  verifyProgressRow:    { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  verifyProgressTrack:  { flex: 1, height: 8, backgroundColor: colors.borderLight, borderRadius: 999, overflow: "hidden", marginRight: 10 },
  verifyProgressFill:   { width: "100%", height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
  verifyProgressHalf:   { width: "50%",  height: "100%", backgroundColor: colors.primary, borderRadius: 999 },
  verifyProgressEmpty:  { width: "0%",   height: "100%", backgroundColor: colors.borderLight, borderRadius: 999 },
  verifyProgressText:   { color: colors.text, fontWeight: "700", fontSize: 13 },
  verifyCardBtn:     { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  verifyCardBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
  verifyCardIcon:    { width: 54, height: 54 },
  });
}

/** Drop-in replacement for the old static `styles` import: call this inside a
 *  component body instead of importing `styles` directly, so the returned
 *  stylesheet re-evaluates against the live theme on every theme change. */
export function useStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

/** Frozen at the light palette, for screens intentionally excluded from the
 *  dark/light redesign (e.g. onboarding, which keeps its original always-
 *  light appearance regardless of the user's chosen app theme). Don't use
 *  this in any newly-converted screen — use useStyles() instead. */
export const styles = makeStyles(LIGHT_COLORS);
