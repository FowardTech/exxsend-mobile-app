import { Platform } from 'react-native';

// Platform-specific API URLs - matches config.ts pattern (includes /api suffix)
const API_BASE_URL =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_API_BASE_URL_ANDROID || 'http://10.0.2.2:5000/api'
    : process.env.EXPO_PUBLIC_API_BASE_URL_IOS || 'http://127.0.0.1:5000/api';

// ============ Card Funding Types ============
export interface FundWithCardRequest {
  amount: number;
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  cardholderName: string;
  phone: string;
  email?: string;
}

export interface FundWithCardResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  reference?: string;
  amount?: number;
  status?: string;
}

// ============ EFT Deposit Types ============
export interface FundWithEFTRequest {
  amount: number;
  accountHolderName: string;
  institutionNumber: string;
  transitNumber: string;
  accountNumber: string;
  phone: string;
  email?: string;
}

export interface FundWithEFTResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  reference?: string;
  amount?: number;
  status?: string;
}

// ============ EFT Payout Types ============
export interface SendEFTRequest {
  phone: string;
  amount: number;
  recipientName: string;
  accountNumber: string;
  institutionNumber: string;
  transitNumber: string;
  message?: string;
}

export interface SendEFTResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  reference?: string;
  amount?: number;
  recipientName?: string;
  accountNumber?: string;
  status?: string;
}

export interface EFTTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  reference: string;
  createdAt: string;
}

export interface ValidateBankResponse {
  success: boolean;
  valid: boolean;
  bankName?: string;
  errors?: string[];
  message?: string;
}

// ============ Interac Deposit Types (Automatic via Paysafe) ============
export interface InteracDepositRequest {
  amount: number;
  phone: string;
  email: string;
  name: string;
}

export interface InteracDepositResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  depositId?: string;
  reference?: string;
  status?: string;
  redirectUrl?: string;
  handleStatus?: string;
}

// ============ Interac Payout Types ============
export interface InteracPayoutRequest {
  phone: string;
  amount: number;
  recipientEmail: string;
  recipientName: string;
  message?: string;
  securityQuestion: string;  // ← Added
  securityAnswer: string; 
}

export interface InteracPayoutResponse {
  success: boolean;
  message?: string;
  transactionId?: string;
  reference?: string;
  amount?: number;
  recipientEmail?: string;
  recipientName?: string;
  status?: string;
}

// ============ Card Funding API ============
export async function fundWithCard(request: FundWithCardRequest): Promise<FundWithCardResponse> {
  try {
    console.log('[Paysafe] Funding with card:', {
      amount: request.amount,
      cardNumber: `****${request.cardNumber.slice(-4)}`,
    });

    const response = await fetch(`${API_BASE_URL}/paysafe/fund-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'No response from server. Please check your connection.',
      };
    }

    try {
      const data = JSON.parse(text);
      console.log('[Paysafe] Card funding response:', data);
      return data;
    } catch (parseError) {
      return {
        success: false,
        message: 'Invalid response from server. Please try again.',
      };
    }
  } catch (error) {
    console.error('[Paysafe] Card funding error:', error);
    return {
      success: false,
      message: 'Failed to process card payment. Please check your network connection.',
    };
  }
}

// ============ EFT Deposit API ============
export async function fundWithEFT(request: FundWithEFTRequest): Promise<FundWithEFTResponse> {
  try {
    console.log('[Paysafe] Funding with EFT:', {
      amount: request.amount,
      accountNumber: `***${request.accountNumber.slice(-4)}`,
    });

    const response = await fetch(`${API_BASE_URL}/paysafe/fund-eft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'No response from server. Please check your connection.',
      };
    }

    try {
      const data = JSON.parse(text);
      console.log('[Paysafe] EFT funding response:', data);
      return data;
    } catch (parseError) {
      return {
        success: false,
        message: 'Invalid response from server. Please try again.',
      };
    }
  } catch (error) {
    console.error('[Paysafe] EFT funding error:', error);
    return {
      success: false,
      message: 'Failed to initiate EFT deposit. Please check your network connection.',
    };
  }
}

// ============ Interac Deposit API ============
export async function submitInteracDeposit(request: InteracDepositRequest): Promise<InteracDepositResponse> {
  try {
    console.log('[Paysafe] Initiating automatic Interac deposit:', {
      amount: request.amount,
      email: request.email,
      name: request.name,
    });

    const response = await fetch(`${API_BASE_URL}/paysafe/interac-deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'No response from server. Please check your connection.',
      };
    }

    try {
      const data = JSON.parse(text);
      console.log('[Paysafe] Interac deposit response:', data);
      return data;
    } catch (parseError) {
      return {
        success: false,
        message: 'Invalid response from server. Please try again.',
      };
    }
  } catch (error) {
    console.error('[Paysafe] Interac deposit error:', error);
    return {
      success: false,
      message: 'Failed to initiate Interac deposit. Please check your network connection.',
    };
  }
}

// ============ Interac Payout API ============
export async function sendInteracPayout(request: InteracPayoutRequest): Promise<InteracPayoutResponse> {
  try {
    console.log('[Paysafe] Sending Interac payout:', {
      amount: request.amount,
      recipientEmail: request.recipientEmail,
      recipientName: request.recipientName,
    });

    const response = await fetch(`${API_BASE_URL}/paysafe/interac-payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!text) {
      return {
        success: false,
        message: 'No response from server. Please check your connection.',
      };
    }

    try {
      const data = JSON.parse(text);
      console.log('[Paysafe] Interac payout response:', data);
      return data;
    } catch (parseError) {
      return {
        success: false,
        message: 'Invalid response from server. Please try again.',
      };
    }
  } catch (error) {
    console.error('[Paysafe] Interac payout error:', error);
    return {
      success: false,
      message: 'Failed to send Interac payout. Please check your network connection.',
    };
  }
}

// ============ EFT Payout API ============
export async function sendEFT(request: SendEFTRequest): Promise<SendEFTResponse> {
  try {
    console.log('[Paysafe] Sending EFT:', {
      amount: request.amount,
      recipientName: request.recipientName,
      accountNumber: `***${request.accountNumber.slice(-4)}`
    });

    const response = await fetch(`${API_BASE_URL}/paysafe/send-eft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!text) {
      console.error('[Paysafe] Empty response from server');
      return {
        success: false,
        message: 'No response from server. Please check your connection.',
      };
    }

    try {
      const data = JSON.parse(text);
      console.log('[Paysafe] EFT response:', data);
      return data;
    } catch (parseError) {
      console.error('[Paysafe] Failed to parse response:', text);
      return {
        success: false,
        message: 'Invalid response from server. Please try again.',
      };
    }
  } catch (error) {
    console.error('[Paysafe] Send EFT error:', error);
    return {
      success: false,
      message: 'Failed to send EFT. Please check your network connection.',
    };
  }
}

// ============ Bank Validation API ============
export async function validateBankDetails(
  institutionNumber: string,
  transitNumber: string,
  accountNumber: string
): Promise<ValidateBankResponse> {
  try {
    console.log('[Paysafe] Validating bank details');

    const response = await fetch(`${API_BASE_URL}/paysafe/validate-bank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ institutionNumber, transitNumber, accountNumber }),
    });

    const data = await response.json();
    console.log('[Paysafe] Bank validation response:', data);

    return data;
  } catch (error) {
    console.error('[Paysafe] Validate bank error:', error);
    return {
      success: false,
      valid: false,
      message: 'Failed to validate banking details.',
    };
  }
}

// ============ Transaction History API ============
export async function getEFTTransactions(phone: string): Promise<{
  success: boolean;
  transactions: EFTTransaction[];
  message?: string;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/paysafe/transactions?phone=${encodeURIComponent(phone)}`
    );

    const data = await response.json();
    return {
      success: data.success,
      transactions: data.transactions || [],
      message: data.message,
    };
  } catch (error) {
    console.error('[Paysafe] Get transactions error:', error);
    return {
      success: false,
      transactions: [],
      message: 'Failed to fetch transactions',
    };
  }
}

export async function getTransactionStatus(transactionId: string): Promise<{
  success: boolean;
  status?: string;
  message?: string;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/paysafe/status/${encodeURIComponent(transactionId)}`
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Paysafe] Get status error:', error);
    return {
      success: false,
      message: 'Failed to get transaction status',
    };
  }
}

// ============ Validation Helpers ============
export function isValidInstitutionNumber(num: string): boolean {
  return /^\d{3}$/.test(num);
}

export function isValidTransitNumber(num: string): boolean {
  return /^\d{5}$/.test(num);
}

export function isValidAccountNumber(num: string): boolean {
  return /^\d{5,12}$/.test(num);
}

export interface InteracRegisterRequest {
  phone: string;
  email: string;
  name: string;
}

export interface InteracRegisterResponse {
  success: boolean;
  message?: string;
  registered?: boolean;
  email?: string;
}

export interface InteracStatusResponse {
  success: boolean;
  registered?: boolean;
  email?: string;
  message?: string;
}

export interface InteracRegistrationAPI {
  registerForInterac(request: InteracRegisterRequest): Promise<InteracRegisterResponse>;
  getInteracStatus(phone: string): Promise<InteracStatusResponse>;
}

// ============ Interac Registration API ============
export async function registerForInterac(request: InteracRegisterRequest): Promise<InteracRegisterResponse> {
  try {
    console.log('[Paysafe] Registering for Interac e-Transfer:', { email: request.email });

    const response = await fetch(`${API_BASE_URL}/paysafe/interac-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!text) {
      return { success: false, message: 'No response from server.' };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: 'Invalid response from server.' };
    }
  } catch (error) {
    console.error('[Paysafe] Interac registration error:', error);
    return { success: false, message: 'Failed to register. Please check your network connection.' };
  }
}

export async function getInteracStatus(phone: string): Promise<InteracStatusResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/paysafe/interac-status?phone=${encodeURIComponent(phone)}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Paysafe] Interac status check error:', error);
    return { success: false, message: 'Failed to check registration status.' };
  }
}


  