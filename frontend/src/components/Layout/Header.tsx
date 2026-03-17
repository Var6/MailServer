import { Search, Settings } from "lucide-react";
import { useState } from "react";

export default function Header() {
  const [query, setQuery] = useState("");

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search mail..."
            className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>
      <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
        <Settings size={18} />
      </button>
    </header>
  );
}
