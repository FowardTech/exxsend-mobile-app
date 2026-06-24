import React, { useState, useEffect, useCallback } from "react";
import { View, Pressable, FlatList, Alert, StyleSheet, StatusBar, ActivityIndicator, Modal } from "react-native";
import AppText from "../../../AppText";
import AppTextInput from "../../../AppTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ScreenHeader from "../../../../components/ScreenHeader";
import { getRecentRecipientsFromDB, deleteRecipientFromDB } from "../../../../api/sync";
import { updateSavedRecipient } from "../../../../api/config";
import { COLORS } from "../../../../theme/colors";
import { SPACE, RADIUS, CARD_SHADOW, GLASS_BORDER_SUBTLE, GLASS_BORDER } from "../../../../theme/designSystem";

interface Recipient {
  id?: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  destCurrency: string;
  countryCode?: string;
  isInterac?: boolean;
}

function RecipientCard({ item, onSend, onEdit, onDelete }: {
  item: Recipient;
  onSend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = item.accountName.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
  return (
    <View style={s.card}>
      <View style={s.cardLeft}>
        <View style={s.avatar}><AppText style={s.avatarText}>{initials}</AppText></View>
        <View style={{ flex: 1 }}>
          <AppText style={s.name}>{item.accountName}</AppText>
          <AppText style={s.meta}>{item.bankName} · {item.accountNumber}</AppText>
          <View style={s.ccyTag}><AppText style={s.ccyText}>{item.destCurrency}</AppText></View>
        </View>
      </View>
      <View style={s.actions}>
        <Pressable onPress={onSend} style={[s.actionBtn, { backgroundColor: COLORS.primaryLight }]}>
          <Ionicons name="arrow-forward-outline" size={15} color={COLORS.primary} />
        </Pressable>
        <Pressable onPress={onEdit} style={[s.actionBtn, { backgroundColor: COLORS.bg }]}>
          <Ionicons name="pencil-outline" size={15} color={COLORS.textSecondary} />
        </Pressable>
        <Pressable onPress={onDelete} style={[s.actionBtn, { backgroundColor: "rgba(239,68,68,0.08)" }]}>
          <Ionicons name="trash-outline" size={15} color={COLORS.red} />
        </Pressable>
      </View>
    </View>
  );
}

export default function RecipientsManagementScreen() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editTarget, setEditTarget] = useState<Recipient | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ph = await AsyncStorage.getItem("user_phone") || "";
      setPhone(ph);
      if (!ph) return;
      const res = await getRecentRecipientsFromDB(ph, 100);
      setRecipients(res.success ? res.recipients as unknown as Recipient[] : []);
    } catch { setRecipients([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = recipients.filter(r =>
    !q.trim() ||
    r.accountName.toLowerCase().includes(q.toLowerCase()) ||
    r.bankName.toLowerCase().includes(q.toLowerCase()) ||
    r.destCurrency.toLowerCase().includes(q.toLowerCase())
  );

  // Group by currency
  const grouped = filtered.reduce<Record<string, Recipient[]>>((acc, r) => {
    const key = r.destCurrency;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const handleSend = (r: Recipient) => {
    router.push({
      pathname: "/sendmoney" as any,
      params: { recipient: JSON.stringify(r), mode: "recent" },
    } as any);
  };

  const handleDelete = (r: Recipient) => {
    Alert.alert(
      "Delete recipient",
      `Remove ${r.accountName} from your saved recipients?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              if (r.id) await deleteRecipientFromDB(phone, r.id);
              setRecipients(prev => prev.filter(x => x !== r));
            } catch { Alert.alert("Error", "Could not delete recipient."); }
          },
        },
      ]
    );
  };

  const handleEdit = (r: Recipient) => { setEditTarget(r); setEditName(r.accountName); };

  const handleSaveEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    try {
      if (editTarget.id) await updateSavedRecipient(editTarget.id, { accountName: editName.trim() });
      setRecipients(prev => prev.map(x => x === editTarget ? { ...x, accountName: editName.trim() } : x));
      setEditTarget(null);
    } catch { Alert.alert("Error", "Could not update recipient name."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScreenHeader title="Saved Recipients" onBack={() => router.back()} />

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.muted} style={{ marginRight: 8 }} />
        <AppTextInput value={q} onChangeText={setQ} placeholder="Search recipients…" placeholderTextColor={COLORS.muted} style={s.searchInput} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="people-outline" size={48} color={COLORS.muted} />
          <AppText style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 12 }}>No saved recipients</AppText>
          <AppText style={{ fontSize: 13, color: COLORS.muted, textAlign: "center", marginTop: 6 }}>Recipients you send to will appear here for quick access.</AppText>
        </View>
      ) : (
        <FlatList
          data={Object.keys(grouped)}
          keyExtractor={k => k}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: ccy }) => (
            <View style={{ marginBottom: 20 }}>
              <View style={s.groupHeader}>
                <AppText style={s.groupLabel}>{ccy}</AppText>
                <AppText style={s.groupCount}>{grouped[ccy].length}</AppText>
              </View>
              {grouped[ccy].map((r, i) => (
                <RecipientCard
                  key={`${r.accountNumber}-${i}`}
                  item={r}
                  onSend={() => handleSend(r)}
                  onEdit={() => handleEdit(r)}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </View>
          )}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editTarget} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <AppText style={s.modalTitle}>Rename recipient</AppText>
            <AppTextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              placeholderTextColor={COLORS.muted}
              style={s.modalInput}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setEditTarget(null)} style={[s.modalBtn, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}>
                <AppText style={{ fontWeight: "700", color: COLORS.text }}>Cancel</AppText>
              </Pressable>
              <Pressable onPress={handleSaveEdit} disabled={saving} style={[s.modalBtn, { backgroundColor: COLORS.actionBg, flex: 1 }]}>
                {saving ? <ActivityIndicator color={COLORS.actionText} size="small" /> : <AppText style={{ fontWeight: "700", color: COLORS.actionText }}>Save</AppText>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: SPACE.lg, marginVertical: SPACE.sm + 2, backgroundColor: COLORS.white, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md + 2, height: 46, ...GLASS_BORDER, ...CARD_SHADOW },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.sm },
  groupLabel: { fontSize: 12, fontWeight: "700", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.7 },
  groupCount: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACE.lg, marginBottom: SPACE.sm + 2, flexDirection: "row", alignItems: "center", ...GLASS_BORDER, ...CARD_SHADOW },
  cardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE.md },
  avatar: { width: 44, height: 44, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  name: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.muted, fontWeight: "500", marginTop: 2 },
  ccyTag: { marginTop: 4, alignSelf: "flex-start", backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.xs - 2, paddingHorizontal: 7, paddingVertical: 2 },
  ccyText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  actions: { flexDirection: "row", gap: SPACE.xs + 2 },
  actionBtn: { width: 34, height: 34, borderRadius: RADIUS.full, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: SPACE.xxxl },
  modalCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl - 4, padding: SPACE.xxl, width: "100%" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: SPACE.lg - 2 },
  modalInput: { backgroundColor: "#FFFFFF", ...GLASS_BORDER_SUBTLE, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md + 2, height: 50, fontSize: 15, fontWeight: "600", color: COLORS.text },
  modalBtn: { paddingVertical: SPACE.md + 2, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", minWidth: 90 },
});
