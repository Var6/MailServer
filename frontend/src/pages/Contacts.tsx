import { useQuery } from "@tanstack/react-query";
import { Users, Mail } from "lucide-react";
import { apiClient } from "../api/client.ts";

export default function ContactsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiClient.get("/contacts").then(r => r.data),
    retry: false,
  });

  return (
    <div className="h-full bg-white p-6 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Users size={20} className="text-blue-600" />
          <h1 className="text-lg font-semibold">Contacts</h1>
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading contacts...</p>}

        {!isLoading && (!data || data.length === 0) && (
          <div className="text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No contacts yet</p>
            <p className="text-xs mt-1">Contacts synced from Nextcloud CardDAV</p>
          </div>
        )}

        <div className="space-y-2">
          {Array.isArray(data) && data.map((contact: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
              <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm uppercase">
                {(contact.name || "?")[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{contact.name || "(no name)"}</p>
                <p className="text-xs text-gray-500">{contact.email}</p>
              </div>
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-gray-400 hover:text-blue-600">
                  <Mail size={16} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
