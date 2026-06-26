import { API_BASE_URL } from "./config";

export type MoneyRequestStatus = "pending" | "paid" | "declined" | "cancelled" | "expired";

export interface MoneyRequest {
  id: number;
  requesterUserId?: number;
  requesterPhone: string;
  requesterName?: string;
  recipientUserId?: number | null;
  recipientPhone: string;
  recipientName?: string;
  recipientIsMember?: boolean;
  amount: number;
  currency: string;
  note?: string;
  status: MoneyRequestStatus;
  shareToken?: string;
  paidTxnReference?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export async function createMoneyRequest(params: {
  requesterPhone: string;
  recipientPhone: string;
  amount: number;
  currency: string;
  note?: string;
}): Promise<{ success: boolean; request?: MoneyRequest; shareUrl?: string; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/money-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true, request: data.request, shareUrl: data.shareUrl };
  } catch (e: any) {
    return { success: false, message: e?.message || "Could not create request" };
  }
}

export async function getIncomingMoneyRequests(phone: string): Promise<{
  success: boolean;
  requests: MoneyRequest[];
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/money-requests/incoming?phone=${encodeURIComponent(phone)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, requests: [], message: data?.message || `HTTP ${res.status}` };
    }
    const list = Array.isArray(data?.requests) ? data.requests : Array.isArray(data) ? data : [];
    return { success: true, requests: list };
  } catch (e: any) {
    return { success: false, requests: [], message: e?.message || "Could not load incoming requests" };
  }
}

export async function getOutgoingMoneyRequests(phone: string): Promise<{
  success: boolean;
  requests: MoneyRequest[];
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/money-requests/outgoing?phone=${encodeURIComponent(phone)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, requests: [], message: data?.message || `HTTP ${res.status}` };
    }
    const list = Array.isArray(data?.requests) ? data.requests : Array.isArray(data) ? data : [];
    return { success: true, requests: list };
  } catch (e: any) {
    return { success: false, requests: [], message: e?.message || "Could not load outgoing requests" };
  }
}

/** Called after successfully sending the money via /api/transfers/internal —
 * this just confirms to the backend that this specific request has been
 * paid, by reference, so it flips to "paid" and notifies the requester. */
export async function fulfillMoneyRequest(id: number, phone: string, reference: string): Promise<{
  success: boolean;
  request?: MoneyRequest;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/money-requests/${id}/fulfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, reference }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true, request: data.request };
  } catch (e: any) {
    return { success: false, message: e?.message || "Could not confirm payment" };
  }
}

export async function declineMoneyRequest(id: number, phone: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/money-requests/${id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || "Could not decline request" };
  }
}

export async function cancelMoneyRequest(id: number, phone: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/money-requests/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false, message: data?.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.message || "Could not cancel request" };
  }
}
