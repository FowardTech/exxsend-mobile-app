import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { getTransactionByReference, WalletTransaction } from "../../../api/transactions";
import { EXXSEND_LOGO_BASE64 } from "../../../assets/exxsendLogoBase64";
import ScreenShell from "../../../components/ScreenShell";
import { COLORS } from "../../../theme/colors";
import { styles } from "../../../theme/styles";
import AppText from "../../AppText";
import BackButton from "../../BackButton";

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { reference } = useLocalSearchParams<{ reference: string }>();

  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<WalletTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const loadTransaction = useCallback(async () => {
    if (!reference) {
      setError("No transaction reference provided");
      setLoading(false);
      return;
    }

    try {
      const res = await getTransactionByReference(reference);
      if (res.success && res.transaction) {
        setTransaction(res.transaction);
      } else {
        setError(res.message || "Transaction not found");
      }
    } catch (e) {
      console.error("Failed to load transaction:", e);
      setError("Failed to load transaction");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    loadTransaction();
  }, [loadTransaction]);

  const getStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case "completed":
        return COLORS.text;
      case "pending":
      case "processing":
        return COLORS.yellow;
      case "failed":
      case "cancelled":
        return COLORS.error;
      default:
        return COLORS.muted;
    }
  };

  const getStatusBgColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "rgba(34, 197, 94, 0.1)";
      case "pending":
      case "processing":
        return "rgba(245, 158, 11, 0.1)";
      case "failed":
      case "cancelled":
        return "rgba(239, 68, 68, 0.1)";
      default:
        return "rgba(107, 114, 128, 0.1)";
    }
  };

  const getTransactionTypeLabel = (type: string): string => {
    switch (type) {
      case "conversion":
        return "Currency Conversion";
      case "payout":
        return "Money Sent";
      case "deposit":
        return "Money Received";
      case "transfer_in":
        return "Transfer In";
      case "transfer_out":
        return "Transfer Out";
      case "fee":
        return "Fee";
      default:
        return type || "Transaction";
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatAmount = (amount: number, currency: string): string => {
    return `${Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const generateReceiptHtml = (tx: WalletTransaction): string => {
    const isOut = tx.transactionType === "payout" || tx.transactionType === "transfer_out" || tx.amount < 0;
    const amountColor = isOut ? COLORS.error : COLORS.primary;
    const amountPrefix = isOut ? "-" : "+";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 20px; }
            .receipt { max-width: 400px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: #FFFFFF; padding: 28px 24px 20px; text-align: center; border-bottom: 1px solid #EEF0F4; }
            .header img.logo { width: 48px; height: 48px; margin-bottom: 12px; }
            .header h1 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 2px; }
            .header p { font-size: 12px; color: #6b7280; }
            .amount-section { padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb; }
            .type-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
            .amount { font-size: 32px; font-weight: 700; color: ${amountColor}; }
            .status { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 12px; background: ${getStatusBgColor(tx.status)}; color: ${getStatusColor(tx.status)}; }
            .section { padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
            .section:last-child { border-bottom: none; }
            .section-title { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
            .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
            .row-label { font-size: 14px; color: #6b7280; }
            .row-value { font-size: 14px; color: #111827; font-weight: 500; text-align: right; }
            .row-value.red { color: #ef4444; }
            .reference { font-family: monospace; font-size: 12px; background: #f3f4f6; padding: 8px 12px; border-radius: 8px; margin-top: 8px; word-break: break-all; }
            .footer { padding: 20px 24px; text-align: center; background: #f9fafb; }
            .footer p { font-size: 11px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${EXXSEND_LOGO_BASE64}" alt="ExxSend" />
              <h1>Payment Receipt</h1>
              <p>Thank you for using ExxSend</p>
            </div>
            <div class="amount-section">
              <div class="type-label">${getTransactionTypeLabel(tx.transactionType)}</div>
              <div class="amount">${amountPrefix}${formatAmount(tx.amount, tx.currency)}</div>
              <div class="status">${tx.status.toUpperCase()}</div>
            </div>

${tx.transactionType === "conversion" && tx.fromCurrency && tx.toCurrency ? `
            <div class="section">
              <div class="section-title">Conversion Details</div>
              <div class="row">
                <span class="row-label">From</span>
                <span class="row-value">${tx.fromAmount?.toLocaleString()} ${tx.fromCurrency}</span>
              </div>
              <div class="row">
                <span class="row-label">To</span>
                <span class="row-value">${tx.toAmount?.toLocaleString()} ${tx.toCurrency}</span>
              </div>
${tx.exchangeRate ? `
              <div class="row">
                <span class="row-label">Exchange Rate</span>
                <span class="row-value">1 ${tx.fromCurrency} = ${tx.exchangeRate.toFixed(6)} ${tx.toCurrency}</span>
              </div>
` : ''}
            </div>
` : ''}

${tx.counterpartyName ? `
            <div class="section">
              <div class="section-title">${isOut ? 'Recipient' : 'Sender'}</div>
              <div class="row">
                <span class="row-label">Name</span>
                <span class="row-value">${tx.counterpartyName}</span>
              </div>
${tx.counterpartyBank ? `
              <div class="row">
                <span class="row-label">Bank</span>
                <span class="row-value">${tx.counterpartyBank}</span>
              </div>
` : ''}
${tx.counterpartyAccount ? `
              <div class="row">
                <span class="row-label">Account</span>
                <span class="row-value">•••• ${tx.counterpartyAccount.slice(-4)}</span>
              </div>
` : ''}
            </div>
` : ''}

            <div class="section">
              <div class="section-title">Transaction Info</div>
              <div class="row">
                <span class="row-label">Date</span>
                <span class="row-value">${formatDate(tx.createdAt)}</span>
              </div>
              <div class="row">
                <span class="row-label">Time</span>
                <span class="row-value">${formatTime(tx.createdAt)}</span>
              </div>
${tx.provider ? `
              <div class="row">
                <span class="row-label">Provider</span>
                <span class="row-value">${tx.provider}</span>
              </div>
` : ''}
              <div class="reference">${tx.reference}</div>
            </div>

${tx.feeAmount && tx.feeAmount > 0 ? `
            <div class="section">
              <div class="section-title">Fees & Charges</div>
              <div class="row">
                <span class="row-label">Transaction Amount</span>
                <span class="row-value">${formatAmount(Math.abs(tx.amount), tx.currency)}</span>
              </div>
              <div class="row">
                <span class="row-label">Transaction Fee</span>
                 <span class="row-value red">-${tx.feeAmountInBaseCurrency && tx.baseCurrency && tx.baseCurrency !== (tx.feeCurrency || tx.currency) ? `${tx.baseCurrencySymbol || ''}${tx.feeAmountInBaseCurrency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="color:#6B7280;font-size:12px;">(≈ ${formatAmount(tx.feeAmount, tx.feeCurrency || tx.currency)})</span>` : formatAmount(tx.feeAmount, tx.feeCurrency || tx.currency)}</span>
              </div>
              <div class="row">
                <span class="row-label"><strong>Total Charged</strong></span>
                <span class="row-value"><strong>${formatAmount(Math.abs(tx.amount) + tx.feeAmount, tx.currency)}</strong></span>
              </div>
            </div>
` : ''}

            <div class="footer">
              <p>Generated on ${new Date().toLocaleString()}</p>
              <p>Reference: ${tx.reference}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadReceipt = async () => {
    if (!transaction) return;

    setGeneratingPdf(true);
    try {
      const html = generateReceiptHtml(transaction);
      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or Share Receipt",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Success", "Receipt saved to: " + uri);
      }
    } catch (e) {
      console.error("Failed to generate receipt:", e);
      Alert.alert("Error", "Failed to generate receipt. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareReceipt = async () => {
    if (!transaction) return;

    setGeneratingPdf(true);
    try {
      const html = generateReceiptHtml(transaction);
      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Receipt",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Sharing Unavailable", "Sharing is not available on this device.");
      }
    } catch (e) {
      console.error("Failed to share receipt:", e);
      Alert.alert("Error", "Failed to share receipt. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <ScreenShell>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <AppText style={{ marginTop: 12, color: "#9CA3AF", fontWeight: "600" }}>
            Loading transaction...
          </AppText>
        </View>
      </ScreenShell>
    );
  }

  if (error || !transaction) {
    return (
      <ScreenShell>
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <AppText style={styles.headerTitle}>Transaction Details</AppText>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="close-circle-outline" size={48} color={COLORS.error} style={{ marginBottom: 12 }} />
          <AppText style={{ color: COLORS.error, fontWeight: "600", fontSize: 16 }}>
            {error || "Transaction not found"}
          </AppText>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 20,
              paddingHorizontal: 24,
              paddingVertical: 12,
              backgroundColor: COLORS.primary,
              borderRadius: 8,
            }}
          >
            <AppText style={{ color: "#fff", fontWeight: "600" }}>Go Back</AppText>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const isOutgoing = transaction.transactionType === "payout" || transaction.transactionType === "transfer_out" || transaction.amount < 0;

  return (
    <ScreenShell padded={false} scrollable={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <AppText style={styles.headerTitle}>Transaction Details</AppText>
        </View>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <AppText style={styles.typeLabel}>
            {getTransactionTypeLabel(transaction.transactionType)}
          </AppText>
          <AppText
            style={[
              styles.amount,
              { color: isOutgoing ? COLORS.error : COLORS.green },
            ]}
          >
            {isOutgoing ? "-" : "+"}
            {formatAmount(transaction.amount, transaction.currency)}
          </AppText>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusBgColor(transaction.status) },
            ]}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: getStatusColor(transaction.status),
              }}
            />
            <AppText
              style={[
                styles.statusText,
                { color: getStatusColor(transaction.status) },
              ]}
            >
              {transaction.status}
            </AppText>
          </View>
        </View>

        {/* Conversion Details */}
        {transaction.transactionType === "conversion" &&
          transaction.fromCurrency &&
          transaction.toCurrency && (
            <View style={styles.section}>
              <AppText style={styles.sectionTitle}>Conversion Details</AppText>
              <View style={styles.conversionRow}>
                <View style={styles.conversionBox}>
                  <AppText style={styles.conversionLabel}>From</AppText>
                  <AppText style={styles.conversionAmount}>
                    {transaction.fromAmount?.toLocaleString()} {transaction.fromCurrency}
                  </AppText>
                </View>
                <AppText style={styles.conversionArrow}>→</AppText>
                <View style={styles.conversionBox}>
                  <AppText style={styles.conversionLabel}>To</AppText>
                  <AppText style={styles.conversionAmount}>
                    {transaction.toAmount?.toLocaleString()} {transaction.toCurrency}
                  </AppText>
                </View>
              </View>
              {transaction.exchangeRate && (
                <View style={styles.detailRow}>
                  <AppText style={styles.detailLabel}>Exchange Rate</AppText>
                  <AppText style={styles.detailValue}>
                    1 {transaction.fromCurrency} = {transaction.exchangeRate.toFixed(6)} {transaction.toCurrency}
                  </AppText>
                </View>
              )}
            </View>
          )}

        {/* Recipient Details */}
        {transaction.counterpartyName && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>
              {isOutgoing ? "Recipient" : "Sender"}
            </AppText>
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Name</AppText>
              <AppText style={styles.detailValue}>{transaction.counterpartyName}</AppText>
            </View>
            {transaction.counterpartyBank && (
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Bank</AppText>
                <AppText style={styles.detailValue}>{transaction.counterpartyBank}</AppText>
              </View>
            )}
            {transaction.counterpartyAccount && (
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Account</AppText>
                <AppText style={styles.detailValue}>
                  •••• {transaction.counterpartyAccount.slice(-4)}
                </AppText>
              </View>
            )}
          </View>
        )}

        {/* Transaction Info */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Transaction Info</AppText>
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>Reference</AppText>
            <AppText style={[styles.detailValue, { fontFamily: "monospace" }]}>
              {transaction.reference}
            </AppText>
          </View>
          {/* {transaction.externalReference && (
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Provider Ref</AppText>
                <AppText style={[styles.detailValue, { fontFamily: "monospace" }]}>
                  {transaction.externalReference}
                </AppText>
              </View>
            )} */}
          {/* {transaction.provider && (
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Provider</AppText>
                <AppText style={styles.detailValue}>{transaction.provider}</AppText>
              </View>
            )} */}
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>Date</AppText>
            <AppText style={styles.detailValue}>{formatDate(transaction.createdAt)}</AppText>
          </View>
          <View style={styles.detailRow}>
            <AppText style={styles.detailLabel}>Time</AppText>
            <AppText style={styles.detailValue}>{formatTime(transaction.createdAt)}</AppText>
          </View>
          {transaction.completedAt && (
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Completed</AppText>
              <AppText style={styles.detailValue}>
                {formatDate(transaction.completedAt)} at {formatTime(transaction.completedAt)}
              </AppText>
            </View>
          )}
        </View>

        {/* Fees & Charges Section */}
        {transaction.feeAmount && transaction.feeAmount > 0 && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Fees & Charges</AppText>
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Transaction Amount</AppText>
              <AppText style={styles.detailValue}>
                {formatAmount(Math.abs(transaction.amount), transaction.currency)}
              </AppText>
            </View>
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Transaction Fee</AppText>
              <View style={{ alignItems: 'flex-end' }}>
                {transaction.feeAmountInBaseCurrency && transaction.baseCurrency &&
                  transaction.baseCurrency !== (transaction.feeCurrency || transaction.currency) ? (
                  <>
                    <AppText style={[styles.detailValue, { color: COLORS.error }]}>
                      -{transaction.baseCurrencySymbol || ''}{transaction.feeAmountInBaseCurrency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      ≈ {formatAmount(transaction.feeAmount, transaction.feeCurrency || transaction.currency)}
                    </AppText>
                  </>
                ) : (
                  <AppText style={[styles.detailValue, { color: COLORS.error }]}>
                    -{formatAmount(transaction.feeAmount, transaction.feeCurrency || transaction.currency)}
                  </AppText>
                )}
              </View>
            </View>
            <View style={{
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              borderStyle: 'dashed',
              marginVertical: 8
            }} />
            <View style={styles.detailRow}>
              <AppText style={[styles.detailLabel, { fontWeight: "600" }]}>Total Charged</AppText>
              <AppText style={[styles.detailValue, { fontWeight: "600" }]}>
                {formatAmount(Math.abs(transaction.amount) + transaction.feeAmount, transaction.currency)}
              </AppText>
            </View>
          </View>
        )}

        {/* Description */}
        {transaction.description && (
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>Description</AppText>
            <AppText style={styles.description}>{transaction.description}</AppText>
          </View>
        )}

        {/* Download & Share Buttons */}
        <View style={{ paddingHorizontal: 16, marginTop: 24, gap: 12 }}>
          <Pressable
            onPress={handleDownloadReceipt}
            disabled={generatingPdf}
            style={styles.outlineBtn}
          >
            <AppText style={{ color: COLORS.text, fontWeight: "600", fontSize: 16 }}>
              Download Receipt
            </AppText>
          </Pressable>

          <Pressable
            onPress={handleShareReceipt}
            disabled={generatingPdf}
            style={styles.primaryBtn}
          >
            <AppText style={{ color: COLORS.white, fontWeight: "600", fontSize: 16 }}>
              Share Receipt
            </AppText>
          </Pressable>
        </View>

        {/* Help Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Pressable
            onPress={() => { }}
            style={styles.helpButton}
          >
            <AppText style={styles.helpButtonText} onPress={() => router.push('/support')}>Need help with this transaction?</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

