import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { lookupMemberByUsername } from "../../../api/config";
import { COUNTRY_NAMES, CURRENCY_TO_COUNTRY } from "../../../api/flutterwave";
import { getSavedRecipients, RecentRecipientFromDB } from "../../../api/sync";
import RecipientAvatar from "../../../components/RecipientAvatar";
import { COLORS } from "../../../theme/colors";
import AppText from "../../AppText";
import AppTextInput from "../../AppTextInput";
import BackButton from "../../BackButton";

function getInitials(name: string) {
  return (name || "U").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
}

// Saved with payoutType:"exxsend" / bankCode:"EXXSEND" — sent peer-to-peer
// via @username rather than to an actual bank account (see
// ExxsendMembersScreen.tsx's saveRecipientToDB call).
function isExxsendRecipient(r: any): boolean {
  return r?.payoutType === "exxsend" || r?.bankCode === "EXXSEND";
}
function getExxsendUsername(r: any): string {
  return String(r?.accountNumber || r?.accountName || "").replace(/^@/, "");
}

function RecipientBubble({ item, onPress }: { item: RecentRecipientFromDB; onPress: () => void }) {
  const exxsend = isExxsendRecipient(item);
  return (
    <Pressable onPress={onPress} style={s.bubble}>
      <RecipientAvatar
        name={item.accountName}
        currencyCode={item.destCurrency}
        countryCode={(item as any).countryCode}
        isExxsend={exxsend}
        photoUrl={(item as any).avatarUrl}
        size={56}
        backgroundColor={COLORS.primary}
      />
      <AppText style={s.bubbleName} numberOfLines={1}>{item.accountName.split(" ")[0]}</AppText>
      <AppText style={s.bubbleBank} numberOfLines={1}>{exxsend ? "Exxsend" : (item.bankName ? item.bankName.split(" ")[0] : item.destCurrency)}</AppText>
    </Pressable>
  );
}

function RecipientRow({ item, onPress }: { item: RecentRecipientFromDB; onPress: () => void }) {
  const exxsend = isExxsendRecipient(item);
  return (
    <Pressable onPress={onPress} style={s.row}>
      <RecipientAvatar
        name={item.accountName}
        currencyCode={item.destCurrency}
        countryCode={(item as any).countryCode}
        isExxsend={exxsend}
        photoUrl={(item as any).avatarUrl}
        size={44}
        backgroundColor={COLORS.primary}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <AppText style={s.rowName}>{item.accountName}</AppText>
        <AppText style={s.rowMeta}>
          {exxsend ? `Exxsend • @${getExxsendUsername(item)}` : `${item.bankName}${item.accountNumber ? `, ${item.accountNumber}` : ""}`}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
    </Pressable>
  );
}

export default function RecipientsScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [recipients, setRecipients] = useState<RecentRecipientFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [phone, setPhone] = useState("");

  const load = useCallback(async (ph?: string) => {
    const p = ph || phone;
    if (!p) return;
    try {
      const res = await getSavedRecipients(p, undefined, 50);
      if (res.success) {
        setRecipients(res.recipients);
        // Best-effort, non-blocking — show the list immediately with
        // whatever photo was stored at save time, then upgrade in place
        // as fresher photos come back.
        const exxsendOnes = res.recipients.filter((r) => r.isExxsendMember && r.username);
        if (exxsendOnes.length > 0) {
          Promise.all(
            exxsendOnes.map((r) => lookupMemberByUsername(r.username!).then((lookup) => ({ id: r.id, lookup })))
          ).then((results) => {
            const photoById = new Map(
              results.filter((x) => x.lookup.success && x.lookup.member?.profilePhotoUrl).map((x) => [x.id, x.lookup.member!.profilePhotoUrl])
            );
            if (photoById.size > 0) {
              setRecipients((prev) => prev.map((r) => (photoById.has(r.id) ? { ...r, avatarUrl: photoById.get(r.id) as string } : r)));
            }
          }).catch(() => { });
        }
      }
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, [phone]);

  useEffect(() => {
    AsyncStorage.getItem("user_phone").then(p => {
      if (p) { setPhone(p); load(p); }
      else setLoading(false);
    });
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const list = useMemo(() => {
    if (!q.trim()) return recipients;
    const sq = q.trim().toLowerCase();
    return recipients.filter(r =>
      r.accountName.toLowerCase().includes(sq) ||
      r.accountNumber.toLowerCase().includes(sq) ||
      (r.bankName || "").toLowerCase().includes(sq) ||
      r.destCurrency.toLowerCase().includes(sq)
    );
  }, [q, recipients]);

  // Recent = last 5 (sorted by lastSentAt)
  const recent = useMemo(() =>
    [...recipients].sort((a, b) => (b.lastSentAt || 0) - (a.lastSentAt || 0)).slice(0, 5),
    [recipients]
  );

  const navigateToRecipient = useCallback((r: RecentRecipientFromDB) => {
    if (isExxsendRecipient(r)) {
      router.push({
        pathname: "/exxsendmembers" as any,
        params: { prefillUsername: getExxsendUsername(r) } as any,
      });
      return;
    }

    // Route through amount entry with this recipient already known, rather
    // than pushing straight to /recipientconfirm with no amount params —
    // that always rendered $0.00 since nothing had actually been entered
    // yet. RecipientNewScreen.tsx's prefilledRecipient path skips its own
    // bank-detail form (the recipient is already on file) and goes
    // straight to "pick a wallet, enter an amount", then on to confirm
    // with everything filled in.
    const destCurrency = (r.destCurrency || "NGN").toUpperCase();
    const countryCode = (destCurrency === "CAD" ? "CA" : (CURRENCY_TO_COUNTRY[destCurrency] || "NG")).toUpperCase();
    const countryName = COUNTRY_NAMES[countryCode] || countryCode;
    router.push({
      pathname: "/recipientnew" as any,
      params: {
        destCurrency,
        countryCode,
        countryName,
        prefilledRecipient: JSON.stringify(r),
      } as any,
    });
  }, [router]);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={s.header}>
        <BackButton onPress={() => router.back()} showLabel={false} />
        <AppText style={s.headerTitle}>Who are you sending to?</AppText>
        <View style={s.helpBtn}><AppText style={s.helpText}>?</AppText></View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
        <AppTextInput value={q} onChangeText={setQ} placeholder="Search for a name or phone number" placeholderTextColor={COLORS.muted} style={s.searchInput} />
        {q.length > 0 && <Pressable onPress={() => setQ("")}><Ionicons name="close-circle" size={16} color={COLORS.muted} /></Pressable>}
      </View>

      {/* New recipient — this hub screen (reached from Home with no prior
          currency context) doesn't know what currency the user wants to
          send yet, so route through the destination-currency picker first
          rather than pushing straight to /recipientnew. That screen's own
          "destCurrency || NGN" fallback was silently defaulting every new
          recipient to Nigeria/NGN regardless of what the user actually
          intended to send, since nothing here was passing a currency at all. */}
      <Pressable onPress={() => router.push("/sendmoney" as any)} style={s.newRow}>
        <View style={s.newIcon}><Ionicons name="add" size={20} color={COLORS.primary} /></View>
        <AppText style={s.newText}>Send to a new recipient</AppText>
        <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
      </Pressable>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id || r.accountNumber}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <>
              {/* Recent bubbles */}
              {recent.length > 0 && !q && (
                <View style={s.section}>
                  <AppText style={s.sectionTitle}>Recent</AppText>
                  <View style={s.bubblesRow}>
                    {recent.map((r) => (
                      <RecipientBubble key={r.id} item={r} onPress={() => navigateToRecipient(r)} />
                    ))}
                  </View>
                </View>
              )}

              {/* Tabs */}
              <View style={s.tabsRow}>
                <View style={s.tabActive}><AppText style={s.tabActiveText}>Saved</AppText></View>
                <Pressable onPress={() => router.push("/exxsendmembers" as any)} style={s.tabInactive}>
                  <AppText style={s.tabInactiveText}>Exxsend Members</AppText>
                </Pressable>
              </View>

              {list.length === 0 && (
                <View style={{ alignItems: "center", paddingTop: 48 }}>
                  <Ionicons name="people-outline" size={48} color={COLORS.muted} />
                  <AppText style={{ fontSize: 15, fontWeight: "600", color: COLORS.text, marginTop: 12 }}>
                    {q ? "No results found" : "No saved recipients"}
                  </AppText>
                  <AppText style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 6 }}>
                    {q ? "Try a different name or account number" : "Recipients you send to will appear here."}
                  </AppText>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <RecipientRow item={item} onPress={() => navigateToRecipient(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600", color: COLORS.text },
  helpBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  helpText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 12, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: "500" },
  newRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 10, backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderLight, paddingHorizontal: 14, paddingVertical: 14 },
  newIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center", marginRight: 12 },
  newText: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.text },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 10 },
  bubblesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  bubble: { alignItems: "center", width: 64 },
  bubbleAvatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginBottom: 5 },
  bubbleInitials: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
  bubbleName: { fontSize: 11, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  bubbleBank: { fontSize: 10, color: COLORS.muted, textAlign: "center" },
  tabsRow: { flexDirection: "row", marginTop: 16, marginBottom: 10, gap: 8 },
  tabActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primary },
  tabActiveText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  tabInactive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: COLORS.border },
  tabInactiveText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.borderLight },
  rowAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  rowInitials: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  rowName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  rowMeta: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
});
