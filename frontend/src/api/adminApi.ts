import { apiClient } from "./client.ts";

export interface ManagedUser {
  _id: string;
  email: string;
  displayName?: string;
  domain: string;
  role: string;
  quotaMb: number;
  active: boolean;
  createdAt: string;
}

export interface AdminStats {
  domain: string;
  companyName: string;
  totalUsers: number;
  activeUsers: number;
  maxUsers: number;
  storagePerUserMb: number;
  slotsRemaining: number;
}

export const getAdminStats = () =>
  apiClient.get<AdminStats>("/admin/stats").then(r => r.data);

export const getTenantInfo = () =>
  apiClient.get("/admin/tenant").then(r => r.data);

export const listUsers = () =>
  apiClient.get<ManagedUser[]>("/admin/users").then(r => r.data);

export const createUser = (payload: {
  email: string;
  password: string;
  displayName?: string;
  quotaMb?: number;
}) => apiClient.post<ManagedUser>("/admin/users", payload).then(r => r.data);

export const updateUser = (email: string, patch: Partial<{
  displayName: string;
  quotaMb: number;
  active: boolean;
}>) => apiClient.patch<ManagedUser>(`/admin/users/${encodeURIComponent(email)}`, patch).then(r => r.data);

export const deactivateUser = (email: string) =>
  apiClient.delete(`/admin/users/${encodeURIComponent(email)}`).then(r => r.data);
