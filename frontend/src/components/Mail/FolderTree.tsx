import { useQuery } from "@tanstack/react-query";
import { Inbox, Send, Archive, Trash2, AlertOctagon, FileText } from "lucide-react";
import { getFolders } from "../../api/mailApi.ts";
import { useMailStore } from "../../store/index.ts";
import { useLocation } from "react-router-dom";

const SPECIAL_ICONS: Record<string, typeof Inbox> = {
  "\\Inbox":   Inbox,
  "\\Sent":    Send,
  "\\Junk":    AlertOctagon,
  "\\Trash":   Trash2,
  "\\Archive": Archive,
  "\\Drafts":  FileText,
};

export default function FolderTree() {
  const { pathname } = useLocation();
  if (!pathname.startsWith("/inbox")) return null;

  const { data: folders = [] } = useQuery({ queryKey: ["folders"], queryFn: getFolders, staleTime: 60_000 });
  const { selectedFolder, setFolder } = useMailStore();

  return (
    <div>
      {folders.map(f => {
        const Icon = SPECIAL_ICONS[f.specialUse ?? ""] ?? FileText;
        const active = selectedFolder === f.path;
        return (
          <button
            key={f.path}
            onClick={() => setFolder(f.path)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg text-left transition-colors ${
              active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon size={14} />
            <span className="truncate">{f.name}</span>
          </button>
        );
      })}
    </div>
  );
}
