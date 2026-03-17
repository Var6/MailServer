import axios from "axios";

const base = import.meta.env.VITE_API_URL ?? "/api";

export const login = (email: string, password: string) =>
  axios.post<{ accessToken: string; user: { email: string } }>(`${base}/auth/login`, { email, password }, { withCredentials: true })
    .then(r => r.data);

export const logout = () =>
  axios.post(`${base}/auth/logout`, {}, { withCredentials: true });

export const refresh = () =>
  axios.post<{ accessToken: string }>(`${base}/auth/refresh`, {}, { withCredentials: true })
    .then(r => r.data);
