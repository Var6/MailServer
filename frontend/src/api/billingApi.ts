import { apiClient } from "./client.ts";

export type BillStatus = "unpaid" | "paid" | "overdue";

export interface Bill {
  _id: string;
  tenantDomain: string;
  tenantName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: BillStatus;
  notes: string;
  createdAt: string;
  paidAt?: string;
}

export interface BillSummary {
  _id: string;           // tenantDomain
  tenantName: string;
  totalBilled: number;
  totalPaid: number;
  unpaidCount: number;
  lastBillDate: string;
}

export const getBills = (domain?: string) =>
  apiClient.get<Bill[]>("/billing", { params: domain ? { domain } : {} }).then(r => r.data);

export const getBillSummary = () =>
  apiClient.get<BillSummary[]>("/billing/summary").then(r => r.data);

export const createBill = (payload: {
  tenantDomain: string;
  amount: number;
  currency: string;
  dueDate: string;
  notes?: string;
}) => apiClient.post<Bill>("/billing", payload).then(r => r.data);

export const updateBillStatus = (id: string, status: BillStatus) =>
  apiClient.patch<Bill>(`/billing/${id}/status`, { status }).then(r => r.data);

export const deleteBill = (id: string) =>
  apiClient.delete(`/billing/${id}`).then(r => r.data);
