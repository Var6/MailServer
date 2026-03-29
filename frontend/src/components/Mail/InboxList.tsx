import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Paperclip, RefreshCw, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { getMessages, flagMessage } from "../../api/mailApi.ts";
import { useMailStore } from "../../store/index.ts";
import { useToastStore } from "../../store/index.ts";
import { formatMailDate, avatarColor, senderInitial, senderName, stripHtml } from "../../lib/utils.ts";
import { MailListSkeleton } from "../ui/Skeleton.tsx";
import type { MailHeader } from "../../types/index.ts";

export default function InboxList() {
  const { selectedFolder, selectedUid, selectMessage } = useMailStore();
  const { addToast } = useToastStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["messages", selectedFolder, 1],
    queryFn: () => getMessages(selectedFolder, 1, 50),
  });

  const starMutation = useMutation({
    mutationFn: ({ uid, add }: { uid: number; add: boolean }) =>
      flagMessage(uid, selectedFolder, "\\Flagged", add),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", selectedFolder] }),
    onError: () => addToast("Failed to update star", "error"),
  });

  const allMessages = data?.messages ?? [];
  const total = data?.total ?? 0;

  const messages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allMessages;
    return allMessages.filter(m =>
      m.subject?.toLowerCase().includes(q) ||
      m.from?.toLowerCase().includes(q) ||
      m.preview?.toLowerCase().includes(q)
    );
  }, [allMessages, search]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between bg-white">
        <div>
          <span className="font-semibold text-[#202124] text-sm">{selectedFolder}</span>
          {total > 0 && (
            <span className="ml-2 text-xs text-gray-400 font-normal">{total}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className={`p-2 rounded-full hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors ${isFetching ? "animate-spin" : ""}`}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-200 bg-[#eef2ff]">
        <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 border border-gray-200 shadow-sm">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 outline-none text-xs text-[#202124] placeholder-gray-400 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && <MailListSkeleton />}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">
                {search ? "No matches found" : "No messages"}
              </p>
              <p className="text-xs mt-0.5">
                {search ? `No results for "${search}"` : `Your ${selectedFolder.toLowerCase()} is empty`}
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MailItem
            key={msg.uid}
            msg={msg}
            selected={selectedUid === msg.uid}
            onClick={() => selectMessage(msg.uid)}
            onStar={(e) => {
              e.stopPropagation();
              starMutation.mutate({ uid: msg.uid, add: !msg.flagged });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MailItem({
  msg, selected, onClick, onStar,
}: {
  msg: MailHeader;
  selected: boolean;
  onClick: () => void;
  onStar: (e: React.MouseEvent) => void;
}) {
  const color = avatarColor(msg.from);
  const initial = senderInitial(msg.from);
  const name = senderName(msg.from);

  return (
    <div
      onClick={onClick}
      className={`mail-item relative group
        ${selected ? "mail-item-selected" : ""}
        ${!selected && msg.seen ? "mail-item-read hover:bg-blue-50" : ""}
        ${!selected && !msg.seen ? "mail-item-unread hover:bg-blue-50" : ""}
      `}
    >
      {/* Unread indicator */}
      {!msg.seen && !selected && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full" />
      )}

      {/* Avatar */}
      <div className={`avatar ${color} text-xs mr-3 flex-shrink-0`}>{initial}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`truncate text-sm ${msg.seen && !selected ? "text-[#444746]" : "font-semibold text-[#202124]"}`}>
            {name}
          </span>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            <button
              onClick={onStar}
              className={`opacity-0 group-hover:opacity-100 ${msg.flagged ? "opacity-100" : ""} transition-opacity`}
            >
              <Star
                size={14}
                className={msg.flagged ? "text-amber-400 fill-amber-400" : "text-gray-400"}
              />
            </button>
            <span className={`text-xs ${msg.seen && !selected ? "text-[#5f6368]" : "font-medium text-[#202124]"}`}>
              {formatMailDate(msg.date)}
            </span>
          </div>
        </div>

        <div className={`text-xs truncate mb-0.5 ${msg.seen && !selected ? "text-[#5f6368]" : "font-medium text-[#202124]"}`}>
          {msg.subject || "(no subject)"}
        </div>

        <div className="flex items-center gap-1">
          {msg.hasAttachments && <Paperclip size={11} className="text-gray-400 flex-shrink-0" />}
          <span className="text-xs text-[#5f6368] truncate">
            {msg.preview ? stripHtml(msg.preview) : ""}
          </span>

        </div>
      </div>
    </div>
  );
}
