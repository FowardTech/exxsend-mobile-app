import { Platform } from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID || 'http://10.0.2.2:5000/api'
    : process.env.EXPO_PUBLIC_API_BASE_URL_IOS || 'http://127.0.0.1:5000/api';

// ============================================================
// Types
// ============================================================

export interface BeneficiaryRequiredField {
  payment_type: string;
  beneficiary_entity_type: string;
  required_fields: string[];
}

export interface Beneficiary {
  id: string;
  bank_account_holder_name: string;
  name: string;
  bank_country: string;
  currency: string;
  bank_name?: string;
  account_number?: string;
  routing_code_value_1?: string;
  routing_code_value_2?: string;
  iban?: string;
  bic_swift?: string;
}

export interface CreateBeneficiaryRequest {
  phone: string;
  walletId?: number;
  currency: string;
  bankCountry: string;
  beneficiaryCountry: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  routingCodeValue1?: string; // Institution/Routing number
  routingCodeValue2?: string; // Transit number (for CAD)
  iban?: string;
  bicSwift?: string;
  beneficiaryAddress?: string;
  beneficiaryCity?: string;
  beneficiaryStateOrProvince?: string;
  beneficiaryPostcode?: string;
  email?: string;
}

export interface CreatePaymentRequest {
  phone: string;
  walletId?: number;
  currency: string;
  beneficiaryId: string;
  amount: number;
  reason: string;
  reference: string;
  paymentType?: string;
}

export interface PaymentResponse {
  success: boolean;
  message?: string;
  payment?: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    beneficiary_id: string;
    reference: string;
    short_reference: string;
    payment_date: string;
  };
}

// ============================================================
// API Functions
// ============================================================

function formatCurrencyCloudError(details: any): string | undefined {
  if (!details) return undefined;

  // Most common CurrencyCloud error shape:
  // { error_code: string, error_messages: { field: [messages] } }
  const err = details?.error_messages ?? details;

  const toText = (v: any): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);

    // Some CurrencyCloud SDKs nest messages as objects (e.g. { message: "..." })
    if (typeof v === 'object' && typeof v.message === 'string') return v.message;

    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  if (Array.isArray(err)) return err.map(toText).filter(Boolean).join(', ');
  if (typeof err === 'string') return err;

  if (err && typeof err === 'object') {
    const msgs: string[] = [];

    for (const [field, val] of Object.entries(err)) {
      if (field === 'error_code') continue;

      if (Array.isArray(val)) {
        msgs.push(...val.map((m) => `${field}: ${toText(m)}`).filter((s) => !s.endsWith(': ')));
        continue;
      }

      // If we accidentally got nested objects, try to flatten one level
      if (val && typeof val === 'object') {
        for (const [subField, subVal] of Object.entries(val as any)) {
          if (Array.isArray(subVal)) {
            msgs.push(...subVal.map((m) => `${subField}: ${toText(m)}`).filter((s) => !s.endsWith(': ')));
          } else {
            msgs.push(`${subField}: ${toText(subVal)}`);
          }
        }
        continue;
      }

      msgs.push(`${field}: ${toText(val)}`);
    }

    return msgs.length ? msgs.filter(Boolean).join('; ') : undefined;
  }

  return undefined;
}



/**
 * Get required fields for creating a beneficiary
 */
export async function getBeneficiaryRequiredDetails(
  currency: string,
  bankAccountCountry: string
): Promise<{ success: boolean; details?: BeneficiaryRequiredField[]; message?: string }> {
  try {
    const params = new URLSearchParams({
      currency: currency.toUpperCase(),
      bank_account_country: bankAccountCountry.toUpperCase(),
    });

    const response = await fetch(
      `${API_BASE_URL}/currencycloud/beneficiaries/required-details?${params}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await response.json();
    
    if (data.success) {
      return { success: true, details: data.details };
    }
    
    return { success: false, message: data.message || 'Failed to get required fields' };
  } catch (error) {
    console.error('[CurrencyCloud] Get beneficiary required details error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/**
 * Create a beneficiary for bank payments
 */
export async function createBeneficiary(
  request: CreateBeneficiaryRequest
): Promise<{ success: boolean; beneficiary?: Beneficiary; message?: string }> {
  try {
    console.log('[CurrencyCloud] Creating beneficiary:', {
      currency: request.currency,
      name: request.name,
      bankCountry: request.bankCountry,
      accountNumberLen: request.accountNumber?.length,
      institutionLen: request.routingCodeValue1?.length,
      transitLen: request.routingCodeValue2?.length,
    });

    const payload: Record<string, string> = {
      currency: request.currency.toUpperCase(),
      bank_country: request.bankCountry.toUpperCase(),
      beneficiary_country: request.beneficiaryCountry.toUpperCase(),
      name: request.name,
      beneficiary_entity_type: 'individual',
    };

    // Add optional fields
    if (request.bankName) payload.bank_name = request.bankName;
    if (request.accountNumber) payload.account_number = request.accountNumber;
    if (request.routingCodeValue1) payload.routing_code_value_1 = request.routingCodeValue1;
    if (request.routingCodeValue2) payload.routing_code_value_2 = request.routingCodeValue2;
    if (request.iban) payload.iban = request.iban;
    if (request.bicSwift) payload.bic_swift = request.bicSwift;
    if (request.beneficiaryAddress) payload.beneficiary_address = request.beneficiaryAddress;
    if (request.beneficiaryCity) payload.beneficiary_city = request.beneficiaryCity;
    if (request.beneficiaryStateOrProvince) payload.beneficiary_state_or_province = request.beneficiaryStateOrProvince;
    if (request.beneficiaryPostcode) payload.beneficiary_postcode = request.beneficiaryPostcode;
    if (request.email) payload.email = request.email;
    if (request.walletId) payload.wallet_id = String(request.walletId);

    const response = await fetch(`${API_BASE_URL}/currencycloud/beneficiaries/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('[CurrencyCloud] Create beneficiary response:', data);

    if (data.success && data.beneficiary) {
      return { success: true, beneficiary: data.beneficiary };
    }

    // Parse error message from various response formats
    const parsed = formatCurrencyCloudError(data.details);
    const errorMsg = parsed || data.message || 'Failed to create beneficiary';
    return { success: false, message: errorMsg };
  } catch (error) {
    console.error('[CurrencyCloud] Create beneficiary error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/**
 * Create a payment to a beneficiary
 * This will automatically debit the user's balance
 */
export async function createPayment(
  request: CreatePaymentRequest
): Promise<PaymentResponse> {
  try {
    console.log('[CurrencyCloud] Creating payment:', {
      currency: request.currency,
      amount: request.amount,
      beneficiaryId: request.beneficiaryId,
    });

    const normalizedPaymentType = request.paymentType === "priority" ? "priority" : "regular";
    const payload: Record<string, string | number> = {
      currency: request.currency.toUpperCase(),
      beneficiary_id: request.beneficiaryId,
      amount: request.amount,
      reason: request.reason,
      reference: request.reference,
      payment_type: normalizedPaymentType,
    };

    if (request.walletId) payload.wallet_id = request.walletId;

    const response = await fetch(`${API_BASE_URL}/currencycloud/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('[CurrencyCloud] Create payment response:', data);

    if (data.success && data.payment) {
      return { success: true, payment: data.payment };
    }

    const parsed = formatCurrencyCloudError(data.details);
    const errorMsg = parsed || data.message || 'Payment failed';
    return { success: false, message: errorMsg };
  } catch (error) {
    console.error('[CurrencyCloud] Create payment error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/**
 * Get payment status
 */
export async function getPaymentStatus(
  paymentId: string
): Promise<{ success: boolean; status?: string; payment?: any; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/currencycloud/payments/${paymentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (data.success && data.payment) {
      return { success: true, status: data.payment.status, payment: data.payment };
    }

    return { success: false, message: data.message || 'Failed to get payment status' };
  } catch (error) {
    console.error('[CurrencyCloud] Get payment status error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/**
 * List user's beneficiaries
 */
export async function listBeneficiaries(
  currency?: string
): Promise<{ success: boolean; beneficiaries?: Beneficiary[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (currency) params.set('currency', currency.toUpperCase());

    const response = await fetch(`${API_BASE_URL}/currencycloud/beneficiaries?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      // Response wasn't JSON (e.g. an upstream block page) — fall through with
      // an empty body so the status-based message below still surfaces.
    }

    if (data.success) {
      return { success: true, beneficiaries: data.beneficiaries || [] };
    }

    if (!response.ok) {
      const reason = data.message || `Beneficiary service unavailable (HTTP ${response.status}). Please try again shortly.`;
      return { success: false, message: reason };
    }

    return { success: false, message: data.message || 'Failed to list beneficiaries' };
  } catch (error) {
    console.error('[CurrencyCloud] List beneficiaries error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/**
 * Delete a beneficiary
 */
export async function deleteBeneficiary(
  beneficiaryId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/currencycloud/beneficiaries/${beneficiaryId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return { success: data.success, message: data.message };
  } catch (error) {
    console.error('[CurrencyCloud] Delete beneficiary error:', error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

// ============================================================
// Helper: Full Payment Flow (Create Beneficiary + Payment)
// ============================================================

export interface SendBankPaymentRequest {
  phone: string;
  walletId?: number;
  currency: string;
  amount: number;
  recipientName: string;
  bankCountry: string;
  beneficiaryCountry: string;
  bankName?: string;
  accountNumber?: string;
  institutionNumber?: string; // For CAD
  transitNumber?: string; // For CAD
  iban?: string;
  bicSwift?: string;
  reason?: string;
  reference?: string;
}

/**
 * Complete flow: Create beneficiary → Create payment
 * This is the main function for sending bank transfers via CurrencyCloud
 */
export async function sendBankPayment(
  request: SendBankPaymentRequest
): Promise<{
  success: boolean;
  message?: string;
  paymentId?: string;
  reference?: string;
  status?: string;
  beneficiaryId?: string;
}> {
  try {
    console.log('[CurrencyCloud] Starting bank payment flow:', {
      currency: request.currency,
      amount: request.amount,
      recipientName: request.recipientName,
    });

    // Step 1: Create beneficiary
    const beneficiaryResult = await createBeneficiary({
      phone: request.phone,
      walletId: request.walletId,
      currency: request.currency,
      bankCountry: request.bankCountry,
      beneficiaryCountry: request.beneficiaryCountry,
      name: request.recipientName,
      bankName: request.bankName,
      accountNumber: request.accountNumber,
      routingCodeValue1: request.institutionNumber,
      routingCodeValue2: request.transitNumber,
      iban: request.iban,
      bicSwift: request.bicSwift,
    });

    if (!beneficiaryResult.success || !beneficiaryResult.beneficiary) {
      return {
        success: false,
        message: beneficiaryResult.message || 'Failed to create recipient',
      };
    }

    const beneficiaryId = beneficiaryResult.beneficiary.id;
    console.log('[CurrencyCloud] Beneficiary created:', beneficiaryId);

    // Step 2: Create payment
    const paymentReference = request.reference || `PAY-${Date.now()}`;
    const paymentResult = await createPayment({
      phone: request.phone,
      walletId: request.walletId,
      currency: request.currency,
      beneficiaryId: beneficiaryId,
      amount: request.amount,
      reason: request.reason || 'Bank Transfer',
      reference: paymentReference,
    });

    if (!paymentResult.success || !paymentResult.payment) {
      return {
        success: false,
        message: paymentResult.message || 'Payment failed',
        beneficiaryId: beneficiaryId,
      };
    }

    console.log('[CurrencyCloud] Payment created:', paymentResult.payment.id);

    return {
      success: true,
      paymentId: paymentResult.payment.id,
      reference: paymentResult.payment.short_reference || paymentReference,
      status: paymentResult.payment.status,
      beneficiaryId: beneficiaryId,
      message: 'Payment initiated successfully',
    };
  } catch (error) {
    console.error('[CurrencyCloud] Send bank payment error:', error);
    return {
      success: false,
      message: 'Failed to process payment. Please try again.',
    };
  }
}