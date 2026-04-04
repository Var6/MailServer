import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "./Sidebar.tsx";
import Header  from "./Header.tsx";
import AppNavbar from "./AppNavbar.tsx";
import ComposeModal from "../Mail/ComposeModal.tsx";
import Toast from "../ui/Toast.tsx";
import { useMailStore, useUiThemeStore, useAuthStore } from "../../store/index.ts";
import { getProfile } from "../../api/settingsApi.ts";

export default function Layout() {
  const composeOpen = useMailStore(s => s.composeOpen);
  const appBg = useUiThemeStore(s => s.appBg);
  const { setAvatar, accessToken } = useAuthStore();

  // Fetch profile once per session and keep avatar in store
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (profile?.avatar) setAvatar(profile.avatar);
  }, [profile?.avatar]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: appBg }}>
      <AppNavbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
      {composeOpen && <ComposeModal />}
      <Toast />
    </div>
  );
}
