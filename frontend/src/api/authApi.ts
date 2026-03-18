import axios from "axios";
import type { UserRole } from "../store/index.ts";

const base = import.meta.env.VITE_API_URL ?? "/api";

interface LoginResponse {
  accessToken: string;
  user: { email: string; role: UserRole; domain: string; displayName?: string };
}

export const login = (email: string, password: string) =>
  axios.post<LoginResponse>(`${base}/auth/login`, { email, password }, { withCredentials: true })
    .then(r => r.data);

export const logout = () =>
  axios.post(`${base}/auth/logout`, {}, { withCredentials: true });

export const refresh = () =>
  axios.post<{ accessToken: string; user: { email: string; role: UserRole; domain: string } }>(
    `${base}/auth/refresh`, {}, { withCredentials: true }
  ).then(r => r.data);
