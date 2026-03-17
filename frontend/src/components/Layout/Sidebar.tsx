import { NavLink } from "react-router-dom";
import { Mail, Calendar, Users, Folder, LogOut } from "lucide-react";
import { useAuthStore } from "../../store/index.ts";
import { useMailStore } from "../../store/index.ts";
import { logout } from "../../api/authApi.ts";
import FolderTree from "../Mail/FolderTree.tsx";

const NAV = [
  { to: "/inbox",    icon: Mail,      label: "Mail"     },
  { to: "/calendar", icon: Calendar,  label: "Calendar" },
  { to: "/contacts", icon: Users,     label: "Contacts" },
  { to: "/files",    icon: Folder,    label: "Files"    },
];

export default function Sidebar() {
  const { email, clearAuth } = useAuthStore();
  const openCompose = useMailStore(s => s.openCompose);

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearAuth();
    sessionStorage.removeItem("mp");
    window.location.href = "/login";
  };

  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-gray-200">
        <span className="font-bold text-blue-600 text-lg">MailServer</span>
      </div>

      {/* Compose button */}
      <div className="p-3">
        <button
          onClick={() => openCompose()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-full py-2 px-4 text-sm font-medium transition-colors"
        >
          + Compose
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 text-sm rounded-r-full mr-3 transition-colors ${
                isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        {/* IMAP folder tree — shows only under /inbox */}
        <div className="mt-2 pl-4 pr-2">
          <FolderTree />
        </div>
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-200 p-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase">
          {email?.[0] ?? "?"}
        </div>
        <span className="text-xs text-gray-600 truncate flex-1">{email}</span>
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
