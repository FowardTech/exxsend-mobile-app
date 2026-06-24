import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert, Modal, FlatList, ScrollView } from "react-native";
import AppText from "../../../AppText";
import BackButton from "../../../BackButton";
import { useRouter } from "expo-router";
import { useStyles } from "../../../../theme/styles";
import { useAppTheme } from "../../../../theme/ThemeProvider";
import { getPublicCurrencies, createCurrencyAccount, getCountries, saveBaseCurrency } from "@/api/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import CountryFlag from "../../../../components/CountryFlag";

interface Currency {
  countryCode: string;
  code: string;
  name: string;
  countryName: string;
  flag: string;
  symbol: string;
  enabled?: boolean;
}

interface CurrencyRowProps {
  currencyCode: string;
  countryCode?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}

function CurrencyRow({ currencyCode, countryCode, title, subtitle, onPress, disabled }: CurrencyRowProps) {
  const { colors } = useAppTheme();
  const styles = useStyles();
  return (
    <Pressable 
      style={[styles.addAccRow, disabled && { opacity: 0.5, backgroundColor: colors.bgTertiary }]} 
      onPress={onPress}
    >
      <View style={disabled ? { opacity: 0.6 } : undefined}>
        <CountryFlag 
          currencyCode={currencyCode} 
          countryCode={countryCode} 
          size="md" 
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText style={[styles.addAccTitle, disabled && { color: '#9ca3af' }]}>{title}</AppText>
          {disabled && (
            <View style={{ 
              backgroundColor: '#ef4444', 
              paddingHorizontal: 6, 
              paddingVertical: 2, 
              borderRadius: 4, 
              marginLeft: 8 
            }}>
              <AppText style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>INACTIVE</AppText>
            </View>
          )}
        </View>
        <AppText style={[styles.addAccSubtitle, disabled && { color: '#d1d5db' }]}>{subtitle}</AppText>
      </View>
      <AppText style={[styles.chev, disabled && { color: '#d1d5db' }]}>›</AppText>
    </Pressable>
  );
}

export default function AddAccountScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useStyles();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [userCurrencyEnabled, setUserCurrencyEnabled] = useState<boolean | null>(null);
  const [showBaseCurrencyModal, setShowBaseCurrencyModal] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState<Currency | null>(null);

  // Load user info
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const storedPhone = await AsyncStorage.getItem("user_phone");
        const userInfo = await AsyncStorage.getItem("user_info");
        
        if (mounted && storedPhone) {
          setUserPhone(storedPhone);
        }
        
        if (mounted && userInfo) {
          const parsed = JSON.parse(userInfo);
          setUserCountry(parsed.country || null);
        }
      } catch (e) {
        console.warn("Failed to load user info:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch currencies and check if user's country currency is enabled
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch ALL currencies including disabled ones
        const data = await getPublicCurrencies(true);
        if (mounted) {
          setCurrencies(data);
          
          // Check if user's country has an enabled currency
          if (userCountry) {
            const userCurrency = data.find(
              (c) => c.countryName?.toLowerCase() === userCountry.toLowerCase() ||
                     c.countryCode?.toLowerCase() === userCountry.toLowerCase()
            );
            
            if (userCurrency) {
              setUserCurrencyEnabled(userCurrency.enabled !== false);
              if (userCurrency.enabled !== false) {
                // Auto-set base currency if user's country currency is enabled
                setBaseCurrency(userCurrency);
              }
            } else {
              // Country not found in currencies - needs base currency selection
              setUserCurrencyEnabled(false);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch currencies:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userCountry]);

  // Show base currency modal if user's country currency is not enabled
  useEffect(() => {
    if (!loading && userCurrencyEnabled === false && !baseCurrency) {
      setShowBaseCurrencyModal(true);
    }
  }, [loading, userCurrencyEnabled, baseCurrency]);

  const handleSelectBaseCurrency = async (currency: Currency) => {
    setBaseCurrency(currency);
    setShowBaseCurrencyModal(false);
    
    // Persist to AsyncStorage
    await AsyncStorage.setItem('base_currency', currency.code);
    
    // Save to backend
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const phone = await AsyncStorage.getItem('user_phone');
      if (token && phone) {
        await saveBaseCurrency(phone, currency.code, token);
      }
    } catch (error) {
      console.log('Failed to save base currency to backend:', error);
    }
  };

  const handleCurrencyPress = async (currency: Currency) => {
    // Check if currency is disabled
    if (currency.enabled === false) {
      Alert.alert(
        "Currency Disabled", 
        "This currency is currently disabled. Please contact support for assistance."
      );
      return;
    }

    // Check if user is authenticated
    if (!userPhone) {
      Alert.alert("Error", "User not authenticated");
      return;
    }
    
    try {
      const result = await createCurrencyAccount(userPhone, currency.code, currency.countryCode || "");
      if (result.success) {
        router.push({
          pathname: "/result",
          params: {
            type: "success",
            title: "Wallet Added",
            message: `${currency.code} Wallet Added Successfully`,
            primaryText: "Go Back",
            primaryRoute: "/(tabs)",
            secondaryText: "Add Another Wallet",
            secondaryRoute: "/(tabs)",
          },
        });
      } else {
        router.push({
          pathname: "/result",
          params: {
            type: "Failure",
            title: "Failed To Add Wallet",
            message: `Failed To Add ${currency.code} Wallet`,
            primaryText: "Go Back",
            primaryRoute: "/(tabs)",
            secondaryText: "Add Another Wallet",
            secondaryRoute: "/(tabs)",
          },
        });
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to create account");
    }
  };

  // Get only enabled currencies for base currency selection
  const enabledCurrencies = currencies.filter(c => c.enabled !== false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.shell}>
        <View style={styles.headerRow}>
          <BackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <AppText style={styles.headerTitle}>Add Your Wallet</AppText>
          </View>
        </View>

        {/* Show base currency if selected */}
        {baseCurrency && userCurrencyEnabled === false && (
          <View style={{ 
            backgroundColor: '#f0fdf4', 
            padding: 12, 
            borderRadius: 8, 
            marginTop: 16,
            borderWidth: 1,
            borderColor: '#22c55e20',
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <CountryFlag currencyCode={baseCurrency.code} countryCode={baseCurrency.countryCode} size="sm" />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <AppText style={{ fontSize: 12, color: '#16a34a', fontWeight: '600' }}>
                Base Currency: {baseCurrency.name}
              </AppText>
              <Pressable onPress={() => setShowBaseCurrencyModal(true)}>
                <AppText style={{ fontSize: 11, color: '#16a34a', marginTop: 2, textDecorationLine: 'underline' }}>
                  Change base currency
                </AppText>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 22 }} />

        {loading ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <ActivityIndicator size="large" color={colors.green} />
          </View>
        ) : currencies.length === 0 ? (
          <AppText style={styles.muted}>No currencies available.</AppText>
        ) : (
          <ScrollView>
            <View style={styles.addAccCard}>
              {currencies.map((currency, index) => (
                <React.Fragment key={currency.code}>
                  {index > 0 && <View style={styles.addAccDivider} />}
                  <CurrencyRow
                    currencyCode={currency.code}
                    countryCode={currency.countryCode}
                    title={currency.name}
                    subtitle={currency.countryName || currency.name}
                    disabled={currency.enabled === false}
                    onPress={() => handleCurrencyPress(currency)}
                  />
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Base Currency Selection Modal */}
      <Modal
        visible={showBaseCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (baseCurrency) setShowBaseCurrencyModal(false);
        }}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          justifyContent: 'flex-end' 
        }}>
          <View style={{ 
            backgroundColor: '#fff', 
            borderTopLeftRadius: 20, 
            borderTopRightRadius: 20,
            paddingTop: 20,
            paddingBottom: 40,
            maxHeight: '80%'
          }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <AppText style={{ fontSize: 20, fontWeight: '700', color: '#1f2937' }}>
                Select Base Currency
              </AppText>
              <AppText style={{ fontSize: 14, color: '#6b7280', marginTop: 8, lineHeight: 20 }}>
                Your country's currency is not available. Please select a base currency for your account.
              </AppText>
            </View>

            <FlatList
              data={enabledCurrencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f3f4f6',
                  }}
                  onPress={() => handleSelectBaseCurrency(item)}
                >
                  <CountryFlag currencyCode={item.code} countryCode={item.countryCode} size="lg" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText style={{ fontSize: 16, fontWeight: '600', color: '#1f2937' }}>
                      {item.name}
                    </AppText>
                    <AppText style={{ fontSize: 13, color: '#6b7280' }}>
                      {item.countryName || item.code}
                    </AppText>
                  </View>
                  <AppText style={{ fontSize: 14, color: '#9ca3af' }}>›</AppText>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}