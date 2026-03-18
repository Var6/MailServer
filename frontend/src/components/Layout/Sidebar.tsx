import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Mail, Calendar, Users, Folder, LogOut, Inbox, Send,
  AlertTriangle, Trash2, Archive, FileText, ChevronDown, ChevronRight,
  PenSquare, Building2, UserCog
} from "lucide-react";
import { useAuthStore, useMailStore } from "../../store/index.ts";
import { logout } from "../../api/authApi.ts";
import { getFolders } from "../../api/mailApi.ts";
import { avatarColor } from "../../lib/utils.ts";
import { useState } from "react";

const USER_NAV = [
  { to: "/inbox",    icon: Mail,      label: "Mail"     },
  { to: "/calendar", icon: Calendar,  label: "Calendar" },
  { to: "/contacts", icon: Users,     label: "Contacts" },
  { to: "/files",    icon: Folder,    label: "Files"    },
];

const ADMIN_NAV = [
  { to: "/admin/users", icon: UserCog, label: "Users"    },
  { to: "/inbox",       icon: Mail,    label: "Mail"     },
  { to: "/calendar",    icon: Calendar,label: "Calendar" },
  { to: "/files",       icon: Folder,  label: "Files"    },
];

const SUPERADMIN_NAV = [
  { to: "/superadmin/tenants", icon: Building2, label: "Tenants" },
];

const SPECIAL_MAP: Record<string, { icon: typeof Inbox; label: string; order: number }> = {
  "INBOX":   { icon: Inbox,        label: "Inbox",   order: 0 },
  "Sent":    { icon: Send,         label: "Sent",    order: 1 },
  "Drafts":  { icon: FileText,     label: "Drafts",  order: 2 },
  "Junk":    { icon: AlertTriangle,label: "Spam",    order: 3 },
  "Trash":   { icon: Trash2,       label: "Trash",   order: 4 },
  "Archive": { icon: Archive,      label: "Archive", order: 5 },
};

export default function Sidebar() {
  const { email, displayName, role, clearAuth } = useAuthStore();
  const { selectedFolder, setFolder, openCompose } = useMailStore();
  const { pathname } = useLocation();
  const isMailRoute = pathname.startsWith("/inbox");
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: getFolders,
    enabled: isMailRoute,
    staleTime: 60_000,
  });

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearAuth();
    sessionStorage.removeItem("mp");
    window.location.href = "/login";
  };

  const initial  = (displayName || email)?.[0]?.toUpperCase() ?? "?";
  const color    = avatarColor(email ?? "");

  const navItems = role === "superadmin" ? SUPERADMIN_NAV
                 : role === "admin"      ? ADMIN_NAV
                 : USER_NAV;

  const mainFolders = folders
    .filter(f => SPECIAL_MAP[f.name])
    .sort((a, b) => (SPECIAL_MAP[a.name]?.order ?? 99) - (SPECIAL_MAP[b.name]?.order ?? 99));
  const otherFolders = folders.filter(f => !SPECIAL_MAP[f.name]);

  return (
    <aside className="w-64 bg-white flex flex-col h-full border-r border-gray-100 select-none">

      {/* Logo */}
      <div className="px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-white" />
        </div>
        <span className="font-semibold text-[#202124] text-base tracking-tight">MailServer</span>
      </div>

      {/* Compose — only for mail users */}
      {role !== "superadmin" && (
        <div className="px-3 mb-2">
          <button
            onClick={() => openCompose()}
            className="flex items-center gap-3 bg-[#c2e7ff] hover:bg-[#b0d8f5] active:bg-[#9ecbec]
                       text-[#001d35] font-medium rounded-2xl px-5 py-3 w-full transition-colors shadow-sm"
          >
            <PenSquare size={18} />
            Compose
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin pt-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `folder-btn ${isActive ? "folder-btn-active" : ""}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Mail folders — only visible on mail route */}
        {isMailRoute && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            {mainFolders.map(f => {
              const meta = SPECIAL_MAP[f.name];
              const Icon = meta.icon;
              const active = selectedFolder === f.path;
              return (
                <button
                  key={f.path}
                  onClick={() => setFolder(f.path)}
                  className={`folder-btn ${active ? "folder-btn-active" : ""}`}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{meta.label}</span>
                </button>
              );
            })}

            {otherFolders.length > 0 && (
              <>
                <button
                  onClick={() => setMoreOpen(v => !v)}
                  className="folder-btn text-gray-500"
                >
                  {moreOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span>More</span>
                </button>
                {moreOpen && otherFolders.map(f => (
                  <button
                    key={f.path}
                    onClick={() => setFolder(f.path)}
                    className={`folder-btn pl-8 ${selectedFolder === f.path ? "folder-btn-active" : ""}`}
                  >
                    <Folder size={16} />
                    <span className="flex-1 text-left truncate">{f.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </nav>

      {/* Role badge */}
      {role && role !== "user" && (
        <div className="px-4 py-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            role === "superadmin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
          }`}>
            {role === "superadmin" ? "Super Admin" : "Admin"}
          </span>
        </div>
      )}

      {/* User */}
      <div className="border-t border-gray-100 px-3 py-3 flex items-center gap-2.5">
        <div className={`avatar ${color} text-xs`}>{initial}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#202124] truncate">{displayName || email}</p>
          <p className="text-xs text-gray-400 truncate">{displayName ? email : "Signed in"}</p>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
