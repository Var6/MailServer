import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";
import Header  from "./Header.tsx";
import ComposeModal from "../Mail/ComposeModal.tsx";
import Toast from "../ui/Toast.tsx";
import { useMailStore } from "../../store/index.ts";

export default function Layout() {
  const composeOpen = useMailStore(s => s.composeOpen);

  return (
    <div className="flex h-screen overflow-hidden">
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
