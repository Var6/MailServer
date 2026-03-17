import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Auth Store ────────────────────────────────────────────
interface AuthState {
  accessToken: string | null;
  email: string | null;
  setAuth: (token: string, email: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      email: null,
      setAuth: (accessToken, email) => set({ accessToken, email }),
      clearAuth: () => set({ accessToken: null, email: null }),
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
