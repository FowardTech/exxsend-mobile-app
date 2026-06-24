
import { Platform } from 'react-native';
import { useRouter, useFocusEffect } from "expo-router";
// @ts-ignore: module may not have type declarations in this project
import NetInfo from '@react-native-community/netinfo';

// Strict timeout for transaction-critical operations (5 seconds)
export const TRANSACTION_TIMEOUT_MS = 5000;

// Regular timeout for non-critical operations (10 seconds)
export const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Custom error class for transaction failures
 */
export class TransactionError extends Error {
  
  public readonly code: string;
  public readonly isNetworkError: boolean;
  public readonly isTimeoutError: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    code: string,
    options?: {
      isNetworkError?: boolean;
      isTimeoutError?: boolean;
      details?: any;
    }
  ) {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
    this.isNetworkError = options?.isNetworkError ?? false;
    this.isTimeoutError = options?.isTimeoutError ?? false;
    this.details = options?.details;
  }
}

export async function ensureNetworkOrThrow() {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    throw new Error("NO_INTERNET");
  }
}

/**
 * Check network connectivity BEFORE making any transaction request
 * Throws immediately if network is not available
 */
export async function ensureNetworkConnected(): Promise<void> {
  try {
    const state = await NetInfo.fetch();
    
    if (!state.isConnected) {
      throw new TransactionError(
        'No internet connection. Please check your network and try again.',
        'NETWORK_DISCONNECTED',
        { isNetworkError: true }
      );
    }

    if (!state.isInternetReachable && state.isInternetReachable !== null) {
      throw new TransactionError(
        'Internet is not reachable. Please check your connection and try again.',
        'INTERNET_UNREACHABLE',
        { isNetworkError: true }
      );
    }
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    // NetInfo itself failed - be cautious and throw
    console.warn('[NetworkGuard] NetInfo check failed:', error);
    throw new TransactionError(
      'Unable to verify network connection. Please try again.',
      'NETWORK_CHECK_FAILED',
      { isNetworkError: true }
    );
  }
}

/**
 * Make a fetch request with strict timeout and error handling
 * Throws on ANY error - never returns a failed state silently
 */
export async function strictFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = TRANSACTION_TIMEOUT_MS, ...fetchOptions } = options;

  // Pre-flight network check
  await ensureNetworkConnected();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error.name === 'AbortError') {
      throw new TransactionError(
        'Request timed out. Please check your connection and try again.',
        'REQUEST_TIMEOUT',
        { isTimeoutError: true }
      );
    }

    // Handle network errors
    if (error.message?.includes('Network request failed') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Network Error')) {
      throw new TransactionError(
        'Network error. Please check your connection and try again.',
        'NETWORK_ERROR',
        { isNetworkError: true }
      );
    }

    // Re-throw as TransactionError for any other error
    throw new TransactionError(
      error.message || 'Request failed. Please try again.',
      'FETCH_FAILED',
      { details: error }
    );
  }
}

/**
 * Parse JSON response with strict validation
 * Throws if response is not valid JSON or indicates failure
 */
export async function strictParseJSON<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  
  // Validate content type
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '<unreadable>');
    throw new TransactionError(
      'Server returned invalid response. Please try again later.',
      'INVALID_CONTENT_TYPE',
      { details: { contentType, body: text.slice(0, 200) } }
    );
  }

  // Read response text first
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw new TransactionError(
      'Failed to read server response. Please try again.',
      'RESPONSE_READ_FAILED',
      { isNetworkError: true }
    );
  }

  // Validate non-empty
  if (!text || text.trim() === '') {
    throw new TransactionError(
      'Server returned empty response. Please try again later.',
      'EMPTY_RESPONSE'
    );
  }

  // Parse JSON
  let data: T;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new TransactionError(
      'Server returned invalid data. Please try again later.',
      'JSON_PARSE_FAILED',
      { details: { body: text.slice(0, 200) } }
    );
  }

  return data;
}

/**
 * Validate API response success field
 * Throws if success is false or response indicates an error
 */
export function validateAPIResponse(
  data: any,
  context: string = 'Transaction'
): void {
  // Check HTTP-level errors embedded in response
  if (data.error || data.errors) {
    const errorMsg = 
      data.error?.message || 
      data.message || 
      (Array.isArray(data.errors) ? data.errors.join(', ') : 'Operation failed');
    throw new TransactionError(
      `${context} failed: ${errorMsg}`,
      'API_ERROR',
      { details: data }
    );
  }

  // Check success flag
  if (data.success === false) {
    throw new TransactionError(
      data.message || `${context} failed. Please try again.`,
      'API_FAILURE',
      { details: data }
    );
  }
}

/**
 * Complete strict API call with all validations
 * Use this for ALL transaction-critical operations
 */
export async function strictAPICall<T = any>(
  url: string,
  options: RequestInit & { 
    timeoutMs?: number;
    context?: string;
    validateSuccess?: boolean;
  } = {}
): Promise<T> {
  const { context = 'Transaction', validateSuccess = true, ...fetchOptions } = options;

  console.log(`[NetworkGuard] Starting ${context}: ${url}`);

  // Make request with strict error handling
  const response = await strictFetch(url, fetchOptions);

  // Check HTTP status
  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }

    const errorMsg = 
      errorData?.message || 
      errorData?.error?.message ||
      `Server error (${response.status})`;

    throw new TransactionError(
      `${context} failed: ${errorMsg}`,
      `HTTP_${response.status}`,
      { details: errorData }
    );
  }

  // Parse and validate response
  const data = await strictParseJSON<T>(response);

  // Validate success if required
  if (validateSuccess) {
    validateAPIResponse(data, context);
  }

  console.log(`[NetworkGuard] ${context} completed successfully`);
  return data;
}

/**
 * Wrapper for transaction operations that ensures atomic behavior
 * If anything fails, the entire operation fails with a clear error
 */
export async function executeTransaction<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    // Pre-flight network check
    await ensureNetworkConnected();

    // Execute the operation
    const result = await operation();

    return result;
  } catch (error) {
    if (error instanceof TransactionError) {
      console.error(`[Transaction] ${context} failed:`, error.message, error.code);
      throw error;
    }

    // Wrap unknown errors
    console.error(`[Transaction] ${context} unexpected error:`, error);
    throw new TransactionError(
      `${context} failed unexpectedly. Please try again.`,
      'UNEXPECTED_ERROR',
      { details: error }
    );
  }
}