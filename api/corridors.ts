/**
 * api/corridors.ts — Single source of truth for every supported payout corridor.
 *
 * Adding a new country = add one entry to CORRIDORS.
 * Nothing else needs to change.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PayoutMethod = "bank" | "momo" | "interac" | "wallet" | "currencycloud";

/** Which CurrencyCloud routing_code_type_1 applies for this corridor's bank-detail fields, if any. */
export type RoutingFieldType = "aba" | "sort_code" | "bsb_code" | "iban_only" | null;

export interface MomoNetwork {
  code: string;
  name: string;
  /** Regex to validate the mobile number for this network */
  numberPattern?: RegExp;
}

export interface FieldRule {
  key: string;
  label: string;
  placeholder: string;
  /** "text" | "phone" | "numeric" | "email" */
  keyboardType: "text" | "phone" | "numeric" | "email";
  maxLength?: number;
  /** Validator — returns null on pass, error string on fail */
  validate: (value: string) => string | null;
}

export interface CorridorMethod {
  method: PayoutMethod;
  label: string;
  /** Whether this method supports real-time account-name verification */
  canVerify: boolean;
  /** Fields rendered for this method (ordered) */
  fields: FieldRule[];
  /** MoMo networks (only for method === "momo") */
  networks?: MomoNetwork[];
  /** For method === "currencycloud": which routing_code_type_1 the backend should infer for these fields. */
  routingFieldType?: RoutingFieldType;
}

export interface Corridor {
  currency: string;       // e.g. "NGN"
  countryCode: string;    // ISO-3166-1 alpha-2
  countryName: string;
  flag: string;           // emoji
  methods: CorridorMethod[];
}

// ─── Validators ───────────────────────────────────────────────────────────────

const req = (label: string) => (v: string) =>
  v.trim() ? null : `${label} is required`;

const minLen = (n: number, label: string) => (v: string) =>
  v.trim().length >= n ? null : `${label} must be at least ${n} characters`;

const exactLen = (n: number, label: string) => (v: string) =>
  v.replace(/\s/g, "").length === n ? null : `${label} must be exactly ${n} digits`;

const numeric = (label: string) => (v: string) =>
  /^\d+$/.test(v.replace(/\s/g, "")) ? null : `${label} must be numeric`;

const email = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : "Please enter a valid email address";

const phoneLen =
  (min: number, max: number, label = "Phone number") =>
  (v: string) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= min && digits.length <= max
      ? null
      : `${label} must be ${min}–${max} digits`;
  };

/** Always passes, even on empty input. Use for fields the spec marks "ideally provided" but not required. */
const optional = () => (_v: string) => null;

/** SWIFT/BIC shape: 4-letter bank code + 2-letter country + 2-char location, optional 3-char branch suffix.
 * Still optional overall (empty passes) — this only validates the FORMAT once something is actually
 * typed, since optional() was letting through any garbage string up to 11 characters with zero checking,
 * which the backend then rejected as "invalid format" with no client-side warning beforehand. */
const bicShape = (label: string) => (v: string) => {
  const cleaned = v.replace(/\s/g, "").toUpperCase();
  if (!cleaned) return null;
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned) ? null : `${label} doesn't look like a valid SWIFT/BIC code`;
};

/** Loose IBAN shape check: 2 letters + 2 digits + up to 30 alphanumeric chars, per ISO 13616. */
const ibanShape = (label: string) => (v: string) => {
  const cleaned = v.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned) ? null : `${label} doesn't look like a valid IBAN`;
};

const alphanumericLen = (n: number, label: string) => (v: string) =>
  v.replace(/\s/g, "").length === n ? null : `${label} must be exactly ${n} characters`;

function chain(...fns: Array<(v: string) => string | null>) {
  return (v: string) => {
    for (const fn of fns) {
      const err = fn(v);
      if (err) return err;
    }
    return null;
  };
}

// ─── CurrencyCloud field builder ───────────────────────────────────────────────
// Shared field set for every CurrencyCloud-routed corridor (USD/AUD/GBP/EUR/...).
// `routingField` is undefined for currencies with no extra routing identifier
// beyond IBAN/account number + SWIFT (most of the 20: EUR, CHF, JPY, HKD, SGD,
// NZD, SEK, NOK, DKK, PLN, CZK, HUF, ZAR, AED, ILS, MXN, TRY).
function ccFields(opts: {
  countryName: string;
  routingField?: { key: string; label: string; placeholder: string; len: number };
  useIban: boolean;
}): FieldRule[] {
  const fields: FieldRule[] = [
    {
      key: "accountName",
      label: "Account holder name",
      placeholder: "Full name on the account",
      keyboardType: "text",
      validate: minLen(2, "Account holder name"),
    },
  ];

  if (opts.useIban) {
    fields.push({
      key: "iban",
      label: "IBAN",
      placeholder: "e.g. DE89370400440532013000",
      keyboardType: "text",
      maxLength: 34,
      validate: ibanShape("IBAN"),
    });
  } else {
    fields.push({
      key: "accountNumber",
      label: "Account number",
      placeholder: "Enter account number",
      keyboardType: "text",
      validate: minLen(4, "Account number"),
    });
  }

  if (opts.routingField) {
    fields.push({
      key: opts.routingField.key,
      label: opts.routingField.label,
      placeholder: opts.routingField.placeholder,
      keyboardType: "numeric",
      maxLength: opts.routingField.len,
      validate: alphanumericLen(opts.routingField.len, opts.routingField.label),
    });
  }

  fields.push(
    {
      key: "bankName",
      label: "Bank name",
      placeholder: "e.g. Chase Bank",
      keyboardType: "text",
      validate: minLen(2, "Bank name"),
    },
    {
      key: "bicSwift",
      label: "SWIFT / BIC (optional)",
      placeholder: "e.g. CHASUS33",
      keyboardType: "text",
      maxLength: 11,
      validate: bicShape("SWIFT/BIC"),
    }
  );

  return fields;
}

function ccCorridor(
  currency: string,
  countryCode: string,
  countryName: string,
  flag: string,
  routingFieldType: RoutingFieldType,
  routingField: { key: string; label: string; placeholder: string; len: number } | undefined,
  useIban: boolean
): Corridor {
  return {
    currency,
    countryCode,
    countryName,
    flag,
    methods: [
      {
        method: "currencycloud",
        label: "Bank Transfer",
        canVerify: false,
        routingFieldType,
        fields: ccFields({ countryName, routingField, useIban }),
      },
    ],
  };
}

// ─── Backend payload helpers ────────────────────────────────────────────────
// The backend's POST /users/recipients/saved only recognizes a "payoutType"
// of "bank" | "momo" | "iban" | "interac" — it has no concept of this app's
// internal "currencycloud" method name, and the screens that build that
// payload were sending the wrong field name entirely (payoutMethod instead
// of payoutType), so every save 400'd regardless of currency.

/**
 * Maps this app's internal PayoutMethod (+ routingFieldType for CurrencyCloud
 * corridors) to the payoutType enum the backend actually validates against.
 * "currencycloud" always needs translating into "bank" or "iban" depending
 * on whether the corridor pays out via IBAN or account+routing-code.
 */
export function toPayoutType(method: PayoutMethod, routingFieldType?: RoutingFieldType): "bank" | "momo" | "iban" | "interac" {
  if (method === "interac") return "interac";
  if (method === "momo") return "momo";
  if (method === "currencycloud") return routingFieldType === "iban_only" ? "iban" : "bank";
  return "bank"; // plain "bank" corridors (Flutterwave) map straight across
}

/**
 * Extracts the routing/SWIFT code out of a CurrencyCloud corridor's form
 * values for the backend's generic "bankCode" field. Which literal key
 * holds it (routingNumber/sortCode/bsbCode/bicSwift) depends on the
 * corridor's routingFieldType — e.g. the US/ABA corridor stores it under
 * "routingNumber", not "bankCode", so a screen can't just read values.bankCode
 * and expect it to exist for these corridors.
 */
export function getRoutingValue(routingFieldType: RoutingFieldType | undefined, values: Record<string, string | undefined>): string {
  switch (routingFieldType) {
    case "aba": return values.routingNumber?.trim() || "";
    case "sort_code": return values.sortCode?.trim() || "";
    case "bsb_code": return values.bsbCode?.trim() || "";
    case "iban_only": return values.bicSwift?.trim() || "";
    default: return "";
  }
}

// ─── Corridor definitions ─────────────────────────────────────────────────────

export const CORRIDORS: Corridor[] = [
  // ── Nigeria ───────────────────────────────────────────────────────────────
  {
    currency: "NGN",
    countryCode: "NG",
    countryName: "Nigeria",
    flag: "🇳🇬",
    methods: [
      {
        method: "bank",
        label: "Bank Transfer",
        canVerify: true,
        fields: [
          {
            key: "bankCode",
            label: "Bank name",
            placeholder: "Select a bank",
            keyboardType: "text",
            validate: req("Bank"),
          },
          {
            key: "accountNumber",
            label: "Account number",
            placeholder: "10-digit NUBAN",
            keyboardType: "numeric",
            maxLength: 10,
            validate: chain(numeric("Account number"), exactLen(10, "Account number")),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Auto-filled after verification",
            keyboardType: "text",
            validate: minLen(2, "Account name"),
          },
        ],
      },
    ],
  },

  // ── Ghana ─────────────────────────────────────────────────────────────────
  {
    currency: "GHS",
    countryCode: "GH",
    countryName: "Ghana",
    flag: "🇬🇭",
    methods: [
      {
        method: "bank",
        label: "Bank Transfer",
        canVerify: true,
        fields: [
          {
            key: "bankCode",
            label: "Bank name",
            placeholder: "Select a bank",
            keyboardType: "text",
            validate: req("Bank"),
          },
          {
            key: "accountNumber",
            label: "Account number",
            placeholder: "Enter account number",
            keyboardType: "numeric",
            maxLength: 16,
            validate: chain(numeric("Account number"), minLen(6, "Account number")),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Auto-filled after verification",
            keyboardType: "text",
            validate: minLen(2, "Account name"),
          },
        ],
      },
      {
        method: "momo",
        label: "Mobile Money",
        canVerify: false,
        networks: [
          { code: "MTN", name: "MTN Mobile Money" },
          { code: "VODAFONE", name: "Vodafone Cash" },
          { code: "AIRTEL", name: "AirtelTigo Money" },
        ],
        fields: [
          {
            key: "networkCode",
            label: "Mobile network",
            placeholder: "Select network",
            keyboardType: "text",
            validate: req("Network"),
          },
          {
            key: "accountNumber",
            label: "Mobile number",
            placeholder: "e.g. 024XXXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: chain(phoneLen(9, 12, "Mobile number")),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Kenya ─────────────────────────────────────────────────────────────────
  {
    currency: "KES",
    countryCode: "KE",
    countryName: "Kenya",
    flag: "🇰🇪",
    methods: [
      {
        method: "bank",
        label: "Bank Transfer",
        canVerify: false,
        fields: [
          {
            key: "bankCode",
            label: "Bank name",
            placeholder: "Select a bank",
            keyboardType: "text",
            validate: req("Bank"),
          },
          {
            key: "accountNumber",
            label: "Account number",
            placeholder: "Enter account number",
            keyboardType: "numeric",
            maxLength: 20,
            validate: chain(numeric("Account number"), minLen(5, "Account number")),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
      {
        method: "momo",
        label: "M-Pesa",
        canVerify: false,
        networks: [
          { code: "MPESA", name: "M-Pesa" },
        ],
        fields: [
          {
            key: "accountNumber",
            label: "M-Pesa number",
            placeholder: "e.g. 0712XXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: phoneLen(9, 12, "M-Pesa number"),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Uganda ────────────────────────────────────────────────────────────────
  {
    currency: "UGX",
    countryCode: "UG",
    countryName: "Uganda",
    flag: "🇺🇬",
    methods: [
      {
        method: "bank",
        label: "Bank Transfer",
        canVerify: false,
        fields: [
          {
            key: "bankCode",
            label: "Bank name",
            placeholder: "Select a bank",
            keyboardType: "text",
            validate: req("Bank"),
          },
          {
            key: "accountNumber",
            label: "Account number",
            placeholder: "Enter account number",
            keyboardType: "numeric",
            maxLength: 20,
            validate: chain(numeric("Account number"), minLen(5, "Account number")),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
      {
        method: "momo",
        label: "Mobile Money",
        canVerify: false,
        networks: [
          { code: "MTN", name: "MTN Mobile Money" },
          { code: "AIRTEL", name: "Airtel Money" },
        ],
        fields: [
          {
            key: "networkCode",
            label: "Mobile network",
            placeholder: "Select network",
            keyboardType: "text",
            validate: req("Network"),
          },
          {
            key: "accountNumber",
            label: "Mobile number",
            placeholder: "e.g. 0712XXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: phoneLen(9, 12, "Mobile number"),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Tanzania ──────────────────────────────────────────────────────────────
  {
    currency: "TZS",
    countryCode: "TZ",
    countryName: "Tanzania",
    flag: "🇹🇿",
    methods: [
      {
        method: "momo",
        label: "Mobile Money",
        canVerify: false,
        networks: [
          { code: "VODACOM", name: "Vodacom M-Pesa" },
          { code: "AIRTEL", name: "Airtel Money" },
          { code: "TIGO", name: "Tigo Pesa" },
          { code: "HALOTEL", name: "Halotel" },
        ],
        fields: [
          {
            key: "networkCode",
            label: "Mobile network",
            placeholder: "Select network",
            keyboardType: "text",
            validate: req("Network"),
          },
          {
            key: "accountNumber",
            label: "Mobile number",
            placeholder: "e.g. 0712XXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: phoneLen(9, 12, "Mobile number"),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Rwanda ────────────────────────────────────────────────────────────────
  {
    currency: "RWF",
    countryCode: "RW",
    countryName: "Rwanda",
    flag: "🇷🇼",
    methods: [
      {
        method: "momo",
        label: "Mobile Money",
        canVerify: false,
        networks: [
          { code: "MTN", name: "MTN MoMo" },
          { code: "AIRTEL", name: "Airtel Money" },
        ],
        fields: [
          {
            key: "networkCode",
            label: "Mobile network",
            placeholder: "Select network",
            keyboardType: "text",
            validate: req("Network"),
          },
          {
            key: "accountNumber",
            label: "Mobile number",
            placeholder: "e.g. 0783XXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: phoneLen(9, 12, "Mobile number"),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Zambia ────────────────────────────────────────────────────────────────
  {
    currency: "ZMW",
    countryCode: "ZM",
    countryName: "Zambia",
    flag: "🇿🇲",
    methods: [
      {
        method: "momo",
        label: "Mobile Money",
        canVerify: false,
        networks: [
          { code: "AIRTEL", name: "Airtel Money" },
          { code: "MTN", name: "MTN MoMo" },
          { code: "ZAMTEL", name: "Zamtel Kwacha" },
        ],
        fields: [
          {
            key: "networkCode",
            label: "Mobile network",
            placeholder: "Select network",
            keyboardType: "text",
            validate: req("Network"),
          },
          {
            key: "accountNumber",
            label: "Mobile number",
            placeholder: "e.g. 097XXXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: phoneLen(9, 12, "Mobile number"),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── South Africa ──────────────────────────────────────────────────────────
  {
    currency: "ZAR",
    countryCode: "ZA",
    countryName: "South Africa",
    flag: "🇿🇦",
    methods: [
      {
        method: "bank",
        label: "Bank Transfer",
        canVerify: false,
        fields: [
          {
            key: "bankCode",
            label: "Bank name",
            placeholder: "Select a bank",
            keyboardType: "text",
            validate: req("Bank"),
          },
          {
            key: "accountNumber",
            label: "Account number",
            placeholder: "Enter account number",
            keyboardType: "numeric",
            maxLength: 16,
            validate: chain(numeric("Account number"), minLen(8, "Account number")),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Senegal / West Africa (XOF) ───────────────────────────────────────────
  {
    currency: "XOF",
    countryCode: "SN",
    countryName: "Senegal",
    flag: "🇸🇳",
    methods: [
      {
        method: "momo",
        label: "Mobile Money",
        canVerify: false,
        networks: [
          { code: "ORANGE", name: "Orange Money" },
          { code: "FREE", name: "Free Money" },
          { code: "WAVE", name: "Wave" },
        ],
        fields: [
          {
            key: "networkCode",
            label: "Mobile network",
            placeholder: "Select network",
            keyboardType: "text",
            validate: req("Network"),
          },
          {
            key: "accountNumber",
            label: "Mobile number",
            placeholder: "e.g. 77XXXXXXX",
            keyboardType: "phone",
            maxLength: 12,
            validate: phoneLen(8, 12, "Mobile number"),
          },
          {
            key: "accountName",
            label: "Account holder name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── Canada (Interac) ──────────────────────────────────────────────────────
  {
    currency: "CAD",
    countryCode: "CA",
    countryName: "Canada",
    flag: "🇨🇦",
    methods: [
      {
        method: "interac",
        label: "Interac e-Transfer®",
        canVerify: false,
        fields: [
          {
            key: "accountNumber", // stores email for Interac
            label: "Recipient email",
            placeholder: "email@example.com",
            keyboardType: "email",
            validate: email,
          },
          {
            key: "accountName",
            label: "Recipient name",
            placeholder: "Full name",
            keyboardType: "text",
            validate: minLen(2, "Name"),
          },
        ],
      },
    ],
  },

  // ── CurrencyCloud corridors ──────────────────────────────────────────────────
  // USD/GBP/AUD carry a country-specific routing identifier; the rest rely on
  // IBAN (where the country uses IBAN) or plain account number + SWIFT.
  ccCorridor("USD", "US", "United States", "🇺🇸", "aba",
    { key: "routingNumber", label: "Routing Number / ABA (9 digits) *", placeholder: "9-digit ABA routing number", len: 9 }, false),
  ccCorridor("GBP", "GB", "United Kingdom", "🇬🇧", "sort_code",
    { key: "sortCode", label: "Sort Code (6 digits) *", placeholder: "6-digit sort code", len: 6 }, false),
  ccCorridor("AUD", "AU", "Australia", "🇦🇺", "bsb_code",
    { key: "bsbCode", label: "BSB Code (6 digits) *", placeholder: "6-digit BSB code", len: 6 }, false),
  ccCorridor("EUR", "DE", "Eurozone", "🇪🇺", "iban_only", undefined, true),
  ccCorridor("CHF", "CH", "Switzerland", "🇨🇭", "iban_only", undefined, true),
  ccCorridor("JPY", "JP", "Japan", "🇯🇵", null, undefined, false),
  ccCorridor("HKD", "HK", "Hong Kong", "🇭🇰", null, undefined, false),
  ccCorridor("SGD", "SG", "Singapore", "🇸🇬", null, undefined, false),
  ccCorridor("NZD", "NZ", "New Zealand", "🇳🇿", null, undefined, false),
  ccCorridor("SEK", "SE", "Sweden", "🇸🇪", "iban_only", undefined, true),
  ccCorridor("NOK", "NO", "Norway", "🇳🇴", "iban_only", undefined, true),
  ccCorridor("DKK", "DK", "Denmark", "🇩🇰", "iban_only", undefined, true),
  ccCorridor("PLN", "PL", "Poland", "🇵🇱", "iban_only", undefined, true),
  ccCorridor("CZK", "CZ", "Czech Republic", "🇨🇿", "iban_only", undefined, true),
  ccCorridor("HUF", "HU", "Hungary", "🇭🇺", "iban_only", undefined, true),
  ccCorridor("ZAR", "ZA", "South Africa", "🇿🇦", null, undefined, false),
  ccCorridor("AED", "AE", "United Arab Emirates", "🇦🇪", "iban_only", undefined, true),
  ccCorridor("ILS", "IL", "Israel", "🇮🇱", null, undefined, false),
  ccCorridor("MXN", "MX", "Mexico", "🇲🇽", null, undefined, false),
  ccCorridor("TRY", "TR", "Turkey", "🇹🇷", "iban_only", undefined, true),
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Get corridor by currency code. Returns undefined if not supported. */
export function getCorridorByCurrency(currency: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.currency === currency.toUpperCase().trim());
}

/**
 * Synthesizes a generic bank-transfer corridor (account name, account number/IBAN,
 * bank name, bank country, optional SWIFT) for a currency the admin has activated
 * but that isn't in the hardcoded CORRIDORS list above. Used as a fallback so a
 * newly-activated currency (e.g. PHP) is never hard-blocked client-side — the
 * backend is the actual source of truth on whether it's payable; this just gives
 * the user a reasonable form to fill in. Routed as "currencycloud" since that's
 * the catch-all bank-transfer rail per the backend's /withdrawal/execute routing.
 */
export function buildGenericBankCorridor(
  currency: string,
  countryCode?: string,
  countryName?: string,
  flag?: string
): Corridor {
  const cc = (countryCode || "").toUpperCase() || "XX";
  const name = countryName || currency;
  return ccCorridor(currency.toUpperCase(), cc, name, flag || "🏳️", null, undefined, false);
}

/**
 * Looks up a known corridor by currency; if none exists (e.g. a currency the
 * admin just activated that hasn't been added to CORRIDORS yet), synthesizes a
 * generic bank-transfer corridor instead of returning undefined. Prefer this
 * over getCorridorByCurrency anywhere the currency is already known to be
 * admin-activated (i.e. it came back from /currencies/public).
 */
export function getCorridorOrFallback(
  currency: string,
  countryCode?: string,
  countryName?: string,
  flag?: string
): Corridor {
  return getCorridorByCurrency(currency) || buildGenericBankCorridor(currency, countryCode, countryName, flag);
}

/** Get corridor by country code. */
export function getCorridorByCountry(countryCode: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.countryCode === countryCode.toUpperCase().trim());
}

/** True if the currency is supported for payout. */
export function isSupportedCorridor(currency: string): boolean {
  return !!getCorridorByCurrency(currency);
}

/** Get all supported currency codes. */
export function getSupportedCurrencies(): string[] {
  return CORRIDORS.map((c) => c.currency);
}

/** True if this currency is routed through the CurrencyCloud Payments API
 *  (USD, GBP, AUD, EUR, CHF, JPY, HKD, SGD, NZD, SEK, NOK, DKK, PLN, CZK,
 *  HUF, ZAR, AED, ILS, MXN, TRY) — as opposed to Interac (CAD) or the
 *  Flutterwave exotic-currency flow. */
export function isCurrencyCloudCorridor(currency: string): boolean {
  const corridor = getCorridorByCurrency(currency);
  return !!corridor && corridor.methods.some((m) => m.method === "currencycloud");
}

/** All currency codes routed through CurrencyCloud. */
export function getCurrencyCloudCurrencies(): string[] {
  return CORRIDORS.filter((c) => c.methods.some((m) => m.method === "currencycloud")).map((c) => c.currency);
}

/** Run all field validators for a method. Returns a map of fieldKey → error. */
export function validateCorridorFields(
  method: CorridorMethod,
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of method.fields) {
    const err = field.validate(values[field.key] || "");
    if (err) errors[field.key] = err;
  }
  return errors;
}
