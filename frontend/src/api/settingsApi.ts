import { apiClient } from "./client.ts";

export const getProfile = () =>
  apiClient.get<{ email: string; displayName: string; avatar: string; domain: string; role: string }>("/settings/profile").then(r => r.data);

export const updateProfile = (displayName: string) =>
  apiClient.patch<{ ok: true; displayName: string }>("/settings/profile", { displayName }).then(r => r.data);

export const updateAvatar = (avatar: string) =>
  apiClient.patch<{ ok: true; avatar: string }>("/settings/avatar", { avatar }).then(r => r.data);

export const changePassword = (currentPassword: string, newPassword: string) =>
  apiClient.patch<{ ok: true }>("/settings/password", { currentPassword, newPassword }).then(r => r.data);
