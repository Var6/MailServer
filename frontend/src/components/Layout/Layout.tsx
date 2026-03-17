import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";
import Header  from "./Header.tsx";
import ComposeModal from "../Mail/ComposeModal.tsx";
import { useMailStore } from "../../store/index.ts";

export default function Layout() {
  const composeOpen = useMailStore(s => s.composeOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {composeOpen && <ComposeModal />}
    </div>
  );
}
