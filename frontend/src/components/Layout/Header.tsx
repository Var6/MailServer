import { Search, Settings, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useUiThemeStore } from "../../store/index.ts";

const BG_THEMES = ["#eef2ff", "#f5f7fb", "#e9f5ff", "#f4efe6", "#f0fdf4", "#fff1f2", "#f3f4f6"];

export default function Header() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const appBg = useUiThemeStore(s => s.appBg);
  const setAppBg = useUiThemeStore(s => s.setAppBg);

  return (
    <header className="px-4 py-2 flex items-center gap-3 flex-shrink-0" style={{ backgroundColor: appBg }}>
      {/* Search */}
      <div className={`flex-1 max-w-2xl transition-all ${focused ? "max-w-3xl" : ""}`}>
        <div className={`relative flex items-center bg-[#eaf1fb] hover:bg-[#dde9f9] rounded-2xl transition-all
                         ${focused ? "bg-white shadow-md hover:bg-white ring-1 ring-blue-200" : ""}`}>
          <Search
            size={18}
            className="absolute left-4 text-gray-500 pointer-events-none"
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search mail"
            className="w-full pl-11 pr-4 py-2.5 bg-transparent text-sm text-[#202124]
                       placeholder-[#5f6368] focus:outline-none rounded-2xl"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 text-gray-400 hover:text-gray-600 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Help">
          <HelpCircle size={20} />
        </button>
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
            title="Settings"
          >
            <Settings size={20} />
          </button>
          {settingsOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-3">
              <p className="text-xs font-medium text-[#5f6368] mb-2">MailServer background</p>
              <div className="grid grid-cols-7 gap-2">
                {BG_THEMES.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setAppBg(color);
                      setSettingsOpen(false);
                    }}
                    className={`w-6 h-6 rounded-full border ${appBg === color ? "border-gray-900" : "border-gray-300"}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
