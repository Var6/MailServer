import { useNavigate, NavLink } from "react-router-dom";
import { Mail, Settings, LogOut, ChevronDown, Search, Mail as MailIcon, Calendar, Users, Folder, BookOpen, Building2, Receipt, UserCog } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuthStore, useMailStore, useUiThemeStore } from "../../store/index.ts";
import { useTheme } from "../../lib/themes.ts";
import { avatarColor } from "../../lib/utils.ts";
import { logout } from "../../api/authApi.ts";

const USER_NAV = [
  { to: "/mail/INBOX",  icon: MailIcon,  label: "Mail" },
  { to: "/calendar",    icon: Calendar,  label: "Calendar" },
  { to: "/files",       icon: Folder,    label: "Files" },
  { to: "/contacts",    icon: Users,     label: "Contacts" },
];

const ADMIN_NAV = [
  { to: "/admin/users", icon: UserCog,   label: "Users" },
  { to: "/admin/guide", icon: BookOpen,  label: "Guide" },
  { to: "/calendar",    icon: Calendar,  label: "Calendar" },
  { to: "/files",       icon: Folder,    label: "Files" },
  { to: "/contacts",    icon: Users,     label: "Contacts" },
];

const SUPERADMIN_NAV = [
  { to: "/superadmin/tenants", icon: Building2, label: "Tenants" },
  { to: "/superadmin/billing", icon: Receipt,   label: "Billing" },
];

export default function AppNavbar() {
  const { email, displayName, role, avatar, clearAuth } = useAuthStore();
  const searchQuery = useMailStore(s => s.searchQuery);
  const setSearchQuery = useMailStore(s => s.setSearchQuery);
  const { appBg, textColor, isDark } = useTheme();
  const toggleSidebar = useUiThemeStore(s => s.toggleSidebar);
  const navigate = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const mutedColor = isDark ? "#9ca3af" : "#6b7280";
  const borderColor = isDark ? "#374151" : "#e5e7eb";
  const hoverBg = isDark ? "#374151" : "#f3f4f6";

  const navItems =
    role === "superadmin" ? SUPERADMIN_NAV :
    role === "admin"      ? ADMIN_NAV :
    USER_NAV;

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  const handleLogout = async () => {
    await logout().catch(() => {});
    clearAuth();
    sessionStorage.removeItem("mp");
    window.location.href = "/login";
  };

  const initial = (displayName || email)?.[0]?.toUpperCase() ?? "?";
  const color = avatarColor(email ?? "");

  return (
    <>
      <style>{`.navbar-search::placeholder { color: ${mutedColor}; opacity: 1; }`}</style>
      <nav
        className="flex items-center px-4 h-14 border-b flex-shrink-0 gap-3"
        style={{ background: appBg, color: textColor, borderColor }}
      >
        {/* Logo — clicks to collapse/expand sidebar */}
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-2 mr-2 flex-shrink-0 rounded-lg px-1 py-1 transition-colors"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          title="Toggle sidebar"
        >
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Mail size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">MailServer</span>
        </button>

        {/* Nav links */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? isDark ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-800"
                    : isDark ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Search */}
        <div className={`flex-1 max-w-sm transition-all ${focused ? "max-w-lg" : ""}`}>
          <div
            className="relative flex items-center rounded-2xl transition-all"
            style={{
              backgroundColor: focused ? (isDark ? "#374151" : "#ffffff") : (isDark ? "#374151" : "#f3f4f6"),
              boxShadow: focused ? "0 1px 6px rgba(0,0,0,.15)" : "none",
              outline: focused ? `1px solid ${isDark ? "#60a5fa" : "#bfdbfe"}` : "none",
            }}
          >
            <Search size={16} className="absolute left-3 pointer-events-none" style={{ color: mutedColor }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search mail"
              className="navbar-search w-full pl-9 pr-4 py-2 bg-transparent text-sm focus:outline-none rounded-2xl"
              style={{ color: textColor }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-xs px-1 transition"
                style={{ color: mutedColor }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Profile dropdown */}
        <div ref={dropRef} className="relative flex-shrink-0">
          <button
            onClick={() => setDropOpen(v => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: dropOpen ? hoverBg : "transparent" }}
            onMouseEnter={e => { if (!dropOpen) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
            onMouseLeave={e => { if (!dropOpen) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ backgroundColor: color }}
              >
                {initial}
              </div>
            )}
            <span className="text-sm max-w-[120px] truncate hidden sm:block" style={{ color: textColor }}>
              {displayName || email}
            </span>
            <ChevronDown size={14} style={{ color: mutedColor }} />
          </button>

          {dropOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-52 rounded-xl shadow-lg border overflow-hidden z-50"
              style={{ backgroundColor: isDark ? "#1f2937" : "#ffffff", borderColor }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor }}>
                <p className="text-sm font-medium truncate" style={{ color: textColor }}>{displayName || email}</p>
                <p className="text-xs truncate" style={{ color: mutedColor }}>{displayName ? email : role}</p>
              </div>

              {role !== "superadmin" && (
                <button
                  onClick={() => { setDropOpen(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: textColor }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Settings size={15} />
                  Settings
                </button>
              )}

              <button
                onClick={() => { setDropOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm border-t transition-colors"
                style={{ color: "#ef4444", borderColor }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#fef2f2")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
