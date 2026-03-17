import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Reply, Forward, Trash2, Star, MoreHorizontal, Paperclip } from "lucide-react";
import { getMessage } from "../../api/mailApi.ts";
import { useMailStore } from "../../store/index.ts";
import DOMPurify from "dompurify";

// DOMPurify may not be installed — add a simple fallback
function safeHtml(html: string) {
  if (typeof DOMPurify !== "undefined") return DOMPurify.sanitize(html);
  return html.replace(/<script[^>]*>.*?<\/script>/gis, "");
}

export default function MessageView() {
  const { selectedUid, selectedFolder, openCompose } = useMailStore();

  const { data: msg, isLoading } = useQuery({
    queryKey: ["message", selectedFolder, selectedUid],
    queryFn: () => getMessage(selectedUid!, selectedFolder),
    enabled: selectedUid !== null,
  });

  if (!selectedUid) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select a message to read
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>;
  }

  if (!msg) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2">
        <button onClick={() => openCompose({ uid: msg.uid, from: msg.from, subject: msg.subject })}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100">
          <Reply size={16} /> Reply
        </button>
        <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100">
          <Forward size={16} /> Forward
        </button>
        <div className="flex-1" />
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Star size={16} /></button>
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Trash2 size={16} /></button>
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><MoreHorizontal size={16} /></button>
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{msg.subject || "(no subject)"}</h2>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-sm text-gray-800">{msg.from}</span>
            <div className="text-xs text-gray-500 mt-0.5">To: {msg.to}</div>
          </div>
          <span className="text-xs text-gray-400">
            {format(new Date(msg.date), "MMM d, yyyy h:mm a")}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {msg.html ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: safeHtml(msg.html) }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{msg.text}</pre>
        )}

        {/* Attachments */}
        {msg.attachments.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              Attachments ({msg.attachments.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {msg.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <Paperclip size={14} className="text-gray-400" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">{att.filename}</p>
                    <p className="text-xs text-gray-400">{Math.round(att.size / 1024)} KB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
