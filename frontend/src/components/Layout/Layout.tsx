import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "./Sidebar.tsx";
import Header  from "./Header.tsx";
import ComposeModal from "../Mail/ComposeModal.tsx";
import Toast from "../ui/Toast.tsx";
import { useMailStore, useUiThemeStore, useAuthStore } from "../../store/index.ts";
import { getProfile } from "../../api/settingsApi.ts";

export default function Layout() {
  const composeOpen = useMailStore(s => s.composeOpen);
  const appBg = useUiThemeStore(s => s.appBg);
  const { setAvatar, accessToken } = useAuthStore();

  // Hydrate avatar + displayName from server on every session start
  useEffect(() => {
    if (!accessToken) return;
    getProfile().then(p => {
      if (p.avatar)      setAvatar(p.avatar);
    }).catch(() => {});
  }, [accessToken]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: appBg }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {composeOpen && <ComposeModal />}
      <Toast />
    </div>
  );
}
