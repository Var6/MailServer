import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Mail, Calendar, Users, Folder, LogOut, Inbox, Send,
  AlertTriangle, Trash2, FileText, ChevronDown, ChevronRight,
  PenSquare, Building2, UserCog, Receipt, Palette, Settings,
} from "lucide-react";
import { useAuthStore, useMailStore, useUiThemeStore } from "../../store/index.ts";
import { BG_THEMES } from "../../lib/themes.ts";
import { logout } from "../../api/authApi.ts";
import { getFolders } from "../../api/mailApi.ts";
import { avatarColor } from "../../lib/utils.ts";
import { useMemo, useState, useRef, useEffect } from "react";
import type { MailFolder } from "../../types/index.ts";
import { folderToSlug, getDefaultMailRoute } from "../../lib/mailFolders.ts";

const ADMIN_NAV = [
  { to: "/admin/users", icon: UserCog, label: "Users" },
];

const SUPERADMIN_NAV = [
  { to: "/superadmin/tenants", icon: Building2, label: "Tenants" },
  { to: "/superadmin/billing", icon: Receipt, label: "Billing" },
];

const BASE_NAV = [
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/files", icon: Folder, label: "Files" },
  { to: "/contacts", icon: Users, label: "Contacts" },
];

const STANDARD_ORDER = ["INBOX", "Sent", "Drafts", "Junk", "Trash"] as const;
type StandardKey = (typeof STANDARD_ORDER)[number];

const FOLDER_META: Record<StandardKey, { icon: typeof Inbox; label: string }> = {
  INBOX: { icon: Inbox, label: "Inbox" },
  Sent: { icon: Send, label: "Sent" },
  Drafts: { icon: FileText, label: "Draft" },
  Junk: { icon: AlertTriangle, label: "Spam" },
  Trash: { icon: Trash2, label: "Trash" },
};

const FALLBACK_FOLDERS: MailFolder[] = [
  { path: "INBOX", name: "INBOX", delimiter: "/", flags: [], subscribed: true },
  { path: "Sent", name: "Sent", delimiter: "/", flags: [], subscribed: true },
  { path: "Drafts", name: "Drafts", delimiter: "/", flags: [], subscribed: true },
  { path: "Junk", name: "Junk", delimiter: "/", flags: [], subscribed: true },
  { path: "Trash", name: "Trash", delimiter: "/", flags: [], subscribed: true },
];


function detectStandardFolder(folder: MailFolder): StandardKey | null {
  const special = (folder.specialUse ?? "").toLowerCase();
  const hay = `${folder.name} ${folder.path}`.toLowerCase();

  if (special.includes("\\inbox") || /(^|\b)inbox(\b|$)/.test(hay)) return "INBOX";
  if (special.includes("\\sent") || /(^|\b)(sent|sent items|sent mail)(\b|$)/i.test(hay)) return "Sent";
  if (special.includes("\\drafts") || /(^|\b)(draft|drafts)(\b|$)/i.test(hay)) return "Drafts";
  if (special.includes("\\junk") || /(^|\b)(junk|spam)(\b|$)/i.test(hay)) return "Junk";
  if (special.includes("\\trash") || /(^|\b)(trash|bin|deleted)(\b|$)/i.test(hay)) return "Trash";
  return null;
}

export default function Sidebar() {
  const { email, displayName, role, clearAuth, avatar } = useAuthStore();
  const { selectedFolder, setFolder, openCompose } = useMailStore();
  const appBg = useUiThemeStore((s) => s.appBg);
  const setAppBg = useUiThemeStore((s) => s.setAppBg);
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentTheme = typeof appBg === "string" ? BG_THEMES.find(t => t.bg === appBg) : undefined;
  const textColor = currentTheme?.text ?? "#1f2937";
  const isDark = textColor === "#f3f4f6" || textColor === "#f1f5f9" || textColor === "#e9d5ff" || textColor === "#fce7f3" || textColor === "#f0f9ff" || textColor === "#f9fafb";

  // Close theme picker when clicking outside
  useEffect(() => {
    if (!themeOpen) return;
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [themeOpen]);

  // Close profile dropup when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: getFolders,
    enabled: role !== "superadmin",
    staleTime: 60_000,
    retry: 2,
    retryDelay: 1500,
  });

  const allFolders = folders.length > 0 ? folders : FALLBACK_FOLDERS;

  const { orderedMainFolders, otherFolders } = useMemo(() => {
    const byKey = new Map<StandardKey, MailFolder>();

    for (const folder of allFolders) {
      const key = detectStandardFolder(folder);
      if (key && !byKey.has(key)) byKey.set(key, folder);
    }

    // Only add fallbacks when the server returned no folders (offline)
    if (folders.length === 0) {
      for (const fallback of FALLBACK_FOLDERS) {
        const key = detectStandardFolder(fallback);
        if (key && !byKey.has(key)) byKey.set(key, fallback);
      }
    }

    const ordered = STANDARD_ORDER.map((key) => ({
      key,
      folder: byKey.get(key)!,
    })).filter((x) => !!x.folder);

    const standardPaths = new Set(ordered.map((x) => x.folder.path));
    const others = allFolders.filter((f) => !standardPaths.has(f.path));

    return { orderedMainFolders: ordered, otherFolders: others };
  }, [allFolders, folders]);

  const handleFolderClick = (folderPath: string) => {
    setFolder(folderPath);
    navigate(`/mail/${folderToSlug(folderPath)}`);
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearAuth();
    sessionStorage.removeItem("mp");
    window.location.href = "/login";
  };

  const initial = (displayName || email)?.[0]?.toUpperCase() ?? "?";
  const color = avatarColor(email ?? "");

  const navItems = role === "superadmin"
    ? SUPERADMIN_NAV
    : role === "admin"
      ? [...ADMIN_NAV, ...BASE_NAV]
      : BASE_NAV;

  return (
    <aside
      className={`${collapsed ? "w-20" : "w-64"} flex flex-col h-full border-r select-none shadow-sm transition-all`}
      style={{ background: appBg, color: textColor, borderColor: isDark ? "#374151" : "#e5e7eb" }}
    >
      {/* Header — click logo/name to collapse/expand */}
      <div className="px-3 py-3 border-b" style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 w-full rounded transition hover:opacity-80"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Mail size={16} className="text-white" />
          </div>
          {!collapsed && <span className="font-semibold text-base tracking-tight truncate">MailServer</span>}
        </button>
      </div>

      {/* Compose button */}
      {role !== "superadmin" && (
        <div className="px-3 py-2">
          <button
            onClick={() => openCompose()}
            className={`flex items-center gap-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-2xl transition-all shadow-md hover:shadow-lg text-sm ${collapsed ? "justify-center px-0 py-3 w-14" : "px-5 py-3.5 w-full"}`}
            title="Compose"
          >
            <PenSquare size={20} />
            {!collapsed && <span>Compose</span>}
          </button>
        </div>
      )}

      {/* Mail folders */}
      {role !== "superadmin" && (
        <div className="px-3 py-2 border-b" style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
          {orderedMainFolders.map(({ key, folder }) => {
            const meta = FOLDER_META[key];
            const Icon = meta.icon;
            const active = selectedFolder === folder.path;
            return (
              <button
                key={folder.path}
                onClick={() => handleFolderClick(folder.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm font-medium ${
                  active
                    ? isDark
                      ? "bg-blue-600 text-white"
                      : "bg-blue-100 text-blue-900"
                    : isDark
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:bg-gray-100"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={meta.label}
              >
                <Icon size={18} />
                {!collapsed && <span className="flex-1 text-left">{meta.label}</span>}
              </button>
            );
          })}

          {otherFolders.length > 0 && !collapsed && (
            <>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm font-medium ${
                  isDark ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {moreOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <span className="flex-1 text-left">More</span>
              </button>
              {moreOpen && otherFolders.map((f) => (
                <button
                  key={f.path}
                  onClick={() => handleFolderClick(f.path)}
                  className={`w-full flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg transition text-sm ${
                    selectedFolder === f.path
                      ? isDark
                        ? "bg-blue-600 text-white"
                        : "bg-blue-100 text-blue-900"
                      : isDark
                        ? "text-gray-400 hover:bg-gray-700"
                        : "text-gray-600 hover:bg-gray-100"
                  }`}
                  title={f.name}
                >
                  <Folder size={16} />
                  <span className="flex-1 text-left truncate">{f.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 border-b" style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm font-medium ${
              isActive
                ? isDark
                  ? "bg-blue-600 text-white"
                  : "bg-blue-100 text-blue-900"
                : isDark
                  ? "text-gray-300 hover:bg-gray-700"
                  : "text-gray-700 hover:bg-gray-100"
            } ${collapsed ? "justify-center px-0" : ""}`}
            title={label}
          >
            <Icon size={18} />
            {!collapsed && <span className="flex-1 text-left">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Theme picker */}
      {role !== "superadmin" && (
        <div ref={themeRef} className="px-3 py-2 border-b" style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
          <button
            onClick={() => setThemeOpen((v) => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm font-medium ${
              isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"
            } ${collapsed ? "justify-center px-0" : ""}`}
            title="Change Theme"
          >
            <Palette size={18} />
            {!collapsed && <span className="flex-1 text-left">Theme</span>}
          </button>
          {themeOpen && !collapsed && (
            <div className="mt-3 grid grid-cols-4 gap-2 px-1 pb-1">
              {BG_THEMES.map((theme) => (
                <button
                  key={theme.bg}
                  onClick={() => { setAppBg(theme.bg); setThemeOpen(false); }}
                  className="w-10 h-10 rounded-lg border-2 transition"
                  style={{
                    background: theme.bg,
                    borderColor: appBg === theme.bg ? "#fbbf24" : isDark ? "#4b5563" : "#d1d5db",
                  }}
                  title={theme.label}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile footer with dropup */}
      <div ref={profileRef} className="border-t px-3 py-3 relative" style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
        {/* Dropup menu */}
        {profileOpen && !collapsed && (
          <div
            className="absolute bottom-full left-3 right-3 mb-2 rounded-xl shadow-lg border overflow-hidden z-50"
            style={{
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              borderColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            {/* User info */}
            <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: isDark ? "#374151" : "#e5e7eb" }}>
              {avatar ? (
                <img src={avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div
                  className={`avatar ${color} w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}
                >
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: textColor }}>{displayName || email}</p>
                <p className="text-xs truncate" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{email}</p>
              </div>
            </div>
            {/* Settings */}
            <button
              onClick={() => { setProfileOpen(false); navigate("/settings"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: textColor }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
            {/* Logout */}
            <button
              onClick={() => { setProfileOpen(false); handleLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-t"
              style={{ color: "#ef4444", borderColor: isDark ? "#374151" : "#e5e7eb" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#fef2f2")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setProfileOpen(v => !v)}
          className="w-full flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors"
          style={{ backgroundColor: profileOpen ? (isDark ? "#374151" : "#f3f4f6") : "transparent" }}
          onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6"; }}
          onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className={`avatar ${color} text-xs w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
            >
              {initial}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium truncate" style={{ color: textColor }}>{displayName || email}</p>
              <p className="text-xs truncate" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{displayName ? email : "Signed in"}</p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
