import { Search, Settings, HelpCircle } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <header className="bg-[#f6f8fc] px-4 py-2 flex items-center gap-3 flex-shrink-0">
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
        <button className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors" title="Settings">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}
