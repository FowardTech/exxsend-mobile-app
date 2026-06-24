import React from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import TransactionDetailScreen from "../../components/src/screens/TransactionDetailScreen";

const TypedTransactionDetailScreen = TransactionDetailScreen as React.ComponentType<{
  reference: string;
}>;

export default function TransactionDetailRoute() {
  const { reference } = useLocalSearchParams<{ reference: string }>();

  return (
    <>
      <Stack.Screen options={{ title: "Transaction Details" }} />
      <TypedTransactionDetailScreen reference={reference ?? ""} />
    </>
  );
}
