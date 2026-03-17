import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Paperclip, Star } from "lucide-react";
import { getMessages } from "../../api/mailApi.ts";
import { useMailStore } from "../../store/index.ts";
import type { MailHeader } from "../../types/index.ts";

export default function InboxList() {
  const { selectedFolder, selectedUid, selectMessage } = useMailStore();

  const { data, isLoading } = useQuery({
    queryKey: ["messages", selectedFolder, 1],
    queryFn: () => getMessages(selectedFolder, 1, 50),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  const messages = data?.messages ?? [];

  return (
    <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="font-medium text-sm">{selectedFolder}</span>
        <span className="text-xs text-gray-400">{data?.total ?? 0}</span>
      </div>
      {messages.length === 0 && (
        <div className="p-6 text-center text-gray-400 text-sm">No messages</div>
      )}
      {messages.map((msg: MailHeader) => (
        <MessageRow
          key={msg.uid}
          msg={msg}
          selected={selectedUid === msg.uid}
          onClick={() => selectMessage(msg.uid)}
        />
      ))}
    </div>
  );
}

function MessageRow({ msg, selected, onClick }: { msg: MailHeader; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`px-3 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
        selected ? "bg-blue-50" : msg.seen ? "hover:bg-gray-50" : "bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-sm truncate flex-1 ${msg.seen ? "text-gray-700" : "font-semibold text-gray-900"}`}>
          {msg.from.replace(/<.*>/, "").trim() || msg.from}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {msg.flagged && <Star size={12} className="text-yellow-400 fill-yellow-400" />}
          {msg.hasAttachments && <Paperclip size={12} className="text-gray-400" />}
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(msg.date), { addSuffix: false })}
          </span>
        </div>
      </div>
      <div className={`text-xs truncate mb-0.5 ${msg.seen ? "text-gray-600" : "font-medium text-gray-800"}`}>
        {msg.subject || "(no subject)"}
      </div>
      {msg.preview && (
        <div className="text-xs text-gray-400 truncate">{msg.preview}</div>
      )}
    </div>
  );
}
