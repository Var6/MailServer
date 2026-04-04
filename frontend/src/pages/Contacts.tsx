import { useQuery } from "@tanstack/react-query";
import { Users, Mail, Phone, Search } from "lucide-react";
import { useState } from "react";
import { apiClient } from "../api/client.ts";
import { avatarColor } from "../lib/utils.ts";
import { useTheme } from "../lib/themes.ts";

export default function ContactsPage() {
  const [query, setQuery] = useState("");
  const { appBg, textColor, isDark } = useTheme();
  const border  = isDark ? "#374151" : "#e5e7eb";
  const muted   = isDark ? "#9ca3af" : "#6b7280";
  const cardBg  = isDark ? "#1f2937" : "#ffffff";
  const inputBg = isDark ? "#111827" : "#f9fafb";
  const hoverBg = isDark ? "#374151" : "#f3f4f6";

  const { data, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiClient.get("/contacts").then(r => r.data as any[]),
    retry: false,
  });

  const contacts = (Array.isArray(data) ? data : []).filter(c =>
    !query || c.name?.toLowerCase().includes(query.toLowerCase()) || c.email?.includes(query)
  );

  return (
    <div className="h-full flex flex-col" style={{ background: appBg, color: textColor }}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: border }}>
        <div className="flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          <h1 className="font-semibold" style={{ color: textColor }}>Contacts</h1>
          {data && <span className="text-xs ml-1" style={{ color: muted }}>({data.length})</span>}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: muted }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 border w-56"
            style={{ backgroundColor: inputBg, borderColor: border, color: textColor }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-4">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-3 w-1/4 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && contacts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? "#374151" : "#f3f4f6" }}>
              <Users size={36} className="opacity-40" style={{ color: muted }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: muted }}>No contacts found</p>
              <p className="text-xs mt-1" style={{ color: muted }}>Contacts are synced from Nextcloud CardDAV</p>
            </div>
          </div>
        )}

        {!isLoading && contacts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
            {contacts.map((contact: any, i: number) => {
              const name = contact.name || contact.email?.split("@")[0] || "Unknown";
              const color = avatarColor(name);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 rounded-xl transition-all cursor-pointer group border"
                  style={{ backgroundColor: cardBg, borderColor: border, color: textColor }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = hoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = cardBg; }}
                >
                  <div className="avatar w-11 h-11 text-base flex-shrink-0" style={{ backgroundColor: color }}>
                    {name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: textColor }}>{name}</p>
                    {contact.email && (
                      <p className="text-xs truncate" style={{ color: muted }}>{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-xs truncate" style={{ color: muted }}>{contact.phone}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`}
                         className="p-1.5 rounded-full transition-colors"
                         style={{ color: muted }}
                         onMouseEnter={e => (e.currentTarget.style.color = "#2563eb")}
                         onMouseLeave={e => (e.currentTarget.style.color = muted)}>
                        <Mail size={14} />
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`}
                         className="p-1.5 rounded-full transition-colors"
                         style={{ color: muted }}
                         onMouseEnter={e => (e.currentTarget.style.color = "#16a34a")}
                         onMouseLeave={e => (e.currentTarget.style.color = muted)}>
                        <Phone size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
