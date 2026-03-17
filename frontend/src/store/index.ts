import { create } from "zustand";
import { persist } from "zustand/middleware";

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

interface MailState {
  selectedFolder: string;
  selectedUid: number | null;
  composeOpen: boolean;
  replyTo: { uid: number; from: string; subject: string } | null;
  setFolder: (folder: string) => void;
  selectMessage: (uid: number | null) => void;
  openCompose: (replyTo?: MailState["replyTo"]) => void;
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
