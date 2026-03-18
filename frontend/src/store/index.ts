import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "superadmin" | "admin" | "user";

// ── Auth Store ────────────────────────────────────────────
interface AuthState {
  accessToken: string | null;
  email: string | null;
  role: UserRole | null;
  domain: string | null;
  displayName: string | null;
  setAuth: (token: string, user: { email: string; role: UserRole; domain: string; displayName?: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      email: null,
      role: null,
      domain: null,
      displayName: null,
      setAuth: (accessToken, user) => set({
        accessToken,
        email: user.email,
        role: user.role,
        domain: user.domain,
        displayName: user.displayName ?? null,
      }),
      clearAuth: () => set({ accessToken: null, email: null, role: null, domain: null, displayName: null }),
    }),
    { name: "auth" }
  )
);

// ── Mail Store ────────────────────────────────────────────
interface ReplyContext {
  uid: number;
  from: string;
  subject: string;
  type: "reply" | "forward";
}

interface MailState {
  selectedFolder: string;
  selectedUid: number | null;
  composeOpen: boolean;
  replyTo: ReplyContext | null;
  setFolder: (folder: string) => void;
  selectMessage: (uid: number | null) => void;
  openCompose: (replyTo?: ReplyContext | null) => void;
  closeCompose: () => void;
}

export const useMailStore = create<MailState>()((set) => ({
  selectedFolder: "INBOX",
  selectedUid: null,
  composeOpen: false,
  replyTo: null,
  setFolder: (selectedFolder) => set({ selectedFolder, selectedUid: null }),
  selectMessage: (selectedUid) => set({ selectedUid }),
  openCompose: (replyTo = null) => set({ composeOpen: true, replyTo }),
  closeCompose: () => set({ composeOpen: false, replyTo: null }),
}));

// ── Toast Store ───────────────────────────────────────────
type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  addToast: (message, type = "info") => {
    const id = ++toastId;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000);
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
