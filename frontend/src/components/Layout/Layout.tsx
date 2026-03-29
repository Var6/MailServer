import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";
import Header  from "./Header.tsx";
import ComposeModal from "../Mail/ComposeModal.tsx";
import Toast from "../ui/Toast.tsx";
import { useMailStore, useUiThemeStore } from "../../store/index.ts";

export default function Layout() {
  const composeOpen = useMailStore(s => s.composeOpen);
  const appBg = useUiThemeStore(s => s.appBg);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: appBg }}>
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
