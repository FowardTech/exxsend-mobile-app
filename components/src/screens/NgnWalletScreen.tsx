import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { styles } from "../../../theme/styles";
import AppText from "../../AppText";
import { cadWalletTx } from "../data/MockData";
import DetailRow from "./../../DetailRow";
import ScreenShell from "./../../ScreenShell";
import WalletAction from "./../../WalletAction";

export default function NgnWalletScreen() {
  const router = useRouter();
  const [tab, setTab] = useState("Transactions");

  return (
    <ScreenShell>
      <View style={styles.centerHeader}>
        <AppText style={styles.flagBig}>🇨🇦</AppText>
        <AppText style={styles.walletTitle}>CAD balance</AppText>
        <AppText style={styles.walletAmount}>0 CAD</AppText>

        <Pressable style={styles.limitsPill}>
          <AppText style={{ marginRight: 8 }}>🪙</AppText>
          <AppText style={{ fontWeight: "600", color: "#2D2D2D" }}>View account limits</AppText>
        </Pressable>

        <View style={styles.walletActionRow}>
          <WalletAction icon="↑" label="Send" onPress={() => router.push("/sendmoney")} />
          <WalletAction icon="＋" label="Add" onPress={() => router.push("/addmoneymethods")} />
          <WalletAction icon="－" label="Withdraw" onPress={() => { }} />
          <WalletAction icon="↻" label="Convert" onPress={() => router.push("/convert")} />
        </View>

        <View style={styles.pillTabs}>
          <Pressable
            style={[styles.pillTab, tab === "Transactions" && styles.pillTabActive]}
            onPress={() => setTab("Transactions")}
          >
            <AppText style={[styles.pillTabText, tab === "Transactions" && styles.pillTabTextActive]}>
              Transactions
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.pillTab, tab === "Account" && styles.pillTabActive]}
            onPress={() => setTab("Account")}
          >
            <AppText style={[styles.pillTabText, tab === "Account" && styles.pillTabTextActive]}>
              Account details
            </AppText>
          </Pressable>
        </View>
      </View>

      {tab === "Transactions" ? (
        <View style={{ marginTop: 12 }}>
          {cadWalletTx.map((group, idx) => (
            <View key={idx} style={{ marginBottom: 18 }}>
              <AppText style={styles.groupDate}>{group.date}</AppText>
              <View style={styles.groupLine} />
              {group.items.map((t, i) => (
                <View key={i} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={styles.txIcon}>
                      <AppText>💱</AppText>
                    </View>
                    <View>
                      <AppText style={styles.txTitle}>{t.title}</AppText>
                      <AppText style={styles.txTime}>{t.time}</AppText>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <AppText style={styles.txAmt}>{t.right}</AppText>
                    {!!t.subRight && <AppText style={styles.txSubAmt}>{t.subRight}</AppText>}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <AppText style={styles.sectionTitle}>Account details</AppText>
          <View style={styles.detailsCard}>
            <DetailRow k="Account name" v="Your Name" />
            <DetailRow k="Currency" v="CAD" />
            <DetailRow k="Status" v="Active" />
            <DetailRow k="Limits" v="View account limits" />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}
