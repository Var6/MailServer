import { apiClient } from "./client.ts";

export interface Tenant {
  _id: string;
  name: string;
  domain: string;
  adminEmail: string;
  maxUsers: number;
  storagePerUserMb: number;
  active: boolean;
  currentUsers: number;
  createdAt: string;
  createdBy: string;
}

export const listTenants = () =>
  apiClient.get<Tenant[]>("/tenants").then(r => r.data);

export const getTenant = (domain: string) =>
  apiClient.get<Tenant & { users: unknown[] }>(`/tenants/${domain}`).then(r => r.data);

export const createTenant = (payload: {
  name: string;
  domain: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName?: string;
  maxUsers: number;
  storagePerUserMb: number;
}) => apiClient.post<{ tenant: Tenant }>("/tenants", payload).then(r => r.data);

export const updateTenant = (domain: string, patch: Partial<{
  name: string;
  maxUsers: number;
  storagePerUserMb: number;
  active: boolean;
}>) => apiClient.patch<Tenant>(`/tenants/${domain}`, patch).then(r => r.data);

export const deleteTenant = (domain: string) =>
  apiClient.delete(`/tenants/${domain}`).then(r => r.data);
