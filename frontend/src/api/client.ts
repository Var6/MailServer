import axios from "axios";
import { useAuthStore } from "../store/index.ts";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
});

// Attach Bearer token + stored password on every request
apiClient.interceptors.request.use((cfg) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    cfg.headers.Authorization = `Bearer ${accessToken}`;
    // Password stored in sessionStorage (cleared on tab close)
    const pw = sessionStorage.getItem("mp");
    if (pw) cfg.headers["X-Mail-Pass"] = pw;
  }
  return cfg;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        const { data } = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        const cur = useAuthStore.getState();
        useAuthStore.getState().setAuth(data.accessToken, {
          email:       data.user?.email       ?? cur.email!,
          role:        data.user?.role        ?? cur.role!,
          domain:      data.user?.domain      ?? cur.domain!,
          displayName: data.user?.displayName ?? cur.displayName ?? undefined,
          avatar:      cur.avatar             ?? undefined,
        });
        err.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(err.config);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
