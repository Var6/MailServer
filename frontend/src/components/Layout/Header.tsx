import { Search, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useMailStore } from "../../store/index.ts";
import { useTheme } from "../../lib/themes.ts";

export default function Header() {
  const [focused, setFocused] = useState(false);
  const searchQuery = useMailStore(s => s.searchQuery);
  const setSearchQuery = useMailStore(s => s.setSearchQuery);
  const { appBg, textColor, isDark } = useTheme();
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <>
      <style>{`
        .header-search::placeholder { color: ${mutedColor}; opacity: 1; }
      `}</style>
      <header
        className="px-4 py-2 flex items-center gap-3 flex-shrink-0 border-b"
        style={{ background: appBg, color: textColor, borderColor: isDark ? "#374151" : "#e5e7eb" }}
      >
        {/* Search */}
        <div className={`flex-1 max-w-2xl transition-all ${focused ? "max-w-3xl" : ""}`}>
          <div
            className={`relative flex items-center rounded-2xl transition-all`}
            style={{
              backgroundColor: focused
                ? isDark ? "#374151" : "#ffffff"
                : isDark ? "#374151" : "#f3f4f6",
              boxShadow: focused ? "0 1px 6px rgba(0,0,0,.15)" : "none",

              outline: focused ? `1px solid ${isDark ? "#60a5fa" : "#bfdbfe"}` : "none",
            }}
          >
            <Search
              size={18}
              className="absolute left-4 pointer-events-none"
              style={{ color: mutedColor }}
            />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search mail"
              className="header-search w-full pl-11 pr-4 py-2.5 bg-transparent text-sm focus:outline-none rounded-2xl"
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

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-full transition-colors"
            style={{
              color: textColor,
              backgroundColor: isDark ? "#374151" : "#f3f4f6",
            }}
            title="Help"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </header>
    </>
  );
}
