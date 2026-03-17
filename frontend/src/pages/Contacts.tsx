import { useQuery } from "@tanstack/react-query";
import { Users, Mail, Phone, Search } from "lucide-react";
import { useState } from "react";
import { apiClient } from "../api/client.ts";
import { avatarColor } from "../lib/utils.ts";

export default function ContactsPage() {
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiClient.get("/contacts").then(r => r.data as any[]),
    retry: false,
  });

  const contacts = (Array.isArray(data) ? data : []).filter(c =>
    !query || c.name?.toLowerCase().includes(query.toLowerCase()) || c.email?.includes(query)
  );

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          <h1 className="font-semibold text-[#202124]">Contacts</h1>
          {data && <span className="text-xs text-[#5f6368] ml-1">({data.length})</span>}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-300 bg-gray-50 w-56"
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
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <Users size={36} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#5f6368]">No contacts found</p>
              <p className="text-xs mt-1">Contacts are synced from Nextcloud CardDAV</p>
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
                  className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl
                             hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className={`avatar ${color} w-11 h-11 text-base flex-shrink-0`}>
                    {name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#202124] truncate">{name}</p>
                    {contact.email && (
                      <p className="text-xs text-[#5f6368] truncate">{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-xs text-[#5f6368] truncate">{contact.phone}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`}
                         className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-600">
                        <Mail size={14} />
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`}
                         className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-green-600">
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
