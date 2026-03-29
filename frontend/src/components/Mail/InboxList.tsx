import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Paperclip, RefreshCw, Search, X, Trash2, Archive, MailOpen, Mail } from "lucide-react";
import { useState, useMemo } from "react";
import { getMessages, flagMessage, deleteMessage, moveMessage } from "../../api/mailApi.ts";
import { useMailStore, useToastStore } from "../../store/index.ts";
import { formatMailDate, avatarColor, senderInitial, senderName, stripHtml } from "../../lib/utils.ts";
import { MailListSkeleton } from "../ui/Skeleton.tsx";
import type { MailHeader } from "../../types/index.ts";

export default function InboxList() {
  const {
    selectedFolder, selectedUid, selectMessage,
    selectedUids, toggleSelectUid, selectAllUids, clearSelection,
  } = useMailStore();
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
  const hasSelection = selectedUids.size > 0;
  const allVisibleUids = allMessages.map(m => m.uid);
  const allSelected = allVisibleUids.length > 0 && allVisibleUids.every(uid => selectedUids.has(uid));
  const someSelected = !allSelected && allVisibleUids.some(uid => selectedUids.has(uid));

  const messages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allMessages;
    return allMessages.filter(m =>
      m.subject?.toLowerCase().includes(q) ||
      m.from?.toLowerCase().includes(q) ||
      m.preview?.toLowerCase().includes(q)
    );
  }, [allMessages, search]);

  // ── Bulk actions ────────────────────────────────────────
  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      Promise.all(Array.from(selectedUids).map(uid => deleteMessage(uid, selectedFolder))),
    onSuccess: () => {
      clearSelection();
      qc.invalidateQueries({ queryKey: ["messages", selectedFolder] });
      addToast(`${selectedUids.size} message${selectedUids.size !== 1 ? "s" : ""} moved to Trash`, "success");
    },
    onError: () => addToast("Bulk delete failed", "error"),
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: () =>
      Promise.all(Array.from(selectedUids).map(uid => moveMessage(uid, selectedFolder, "Archive"))),
    onSuccess: () => {
      clearSelection();
      qc.invalidateQueries({ queryKey: ["messages", selectedFolder] });
      addToast(`${selectedUids.size} message${selectedUids.size !== 1 ? "s" : ""} archived`, "success");
    },
    onError: () => addToast("Bulk archive failed", "error"),
  });

  const bulkReadMutation = useMutation({
    mutationFn: (markRead: boolean) =>
      Promise.all(Array.from(selectedUids).map(uid =>
        flagMessage(uid, selectedFolder, "\\Seen", markRead)
      )),
    onSuccess: (_data, markRead) => {
      clearSelection();
      qc.invalidateQueries({ queryKey: ["messages", selectedFolder] });
      addToast(`Marked as ${markRead ? "read" : "unread"}`, "success");
    },
    onError: () => addToast("Failed to update read status", "error"),
  });

  const isBulkPending =
    bulkDeleteMutation.isPending ||
    bulkArchiveMutation.isPending ||
    bulkReadMutation.isPending;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden shadow-sm">

      {/* Toolbar — switches to bulk bar when items selected */}
      {hasSelection ? (
        <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-1 bg-blue-50 min-h-[44px]">
          {/* Select-all / deselect checkbox */}
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onChange={() => allSelected ? clearSelection() : selectAllUids(allVisibleUids)}
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer mr-1 flex-shrink-0"
          />
          <span className="text-xs font-semibold text-blue-700 mr-2 whitespace-nowrap">
            {selectedUids.size} selected
          </span>

          <button
            onClick={() => bulkReadMutation.mutate(true)}
            disabled={isBulkPending}
            title="Mark read"
            className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600 disabled:opacity-50 transition-colors"
          >
            <MailOpen size={15} />
          </button>
          <button
            onClick={() => bulkReadMutation.mutate(false)}
            disabled={isBulkPending}
            title="Mark unread"
            className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600 disabled:opacity-50 transition-colors"
          >
            <Mail size={15} />
          </button>
          <button
            onClick={() => bulkArchiveMutation.mutate()}
            disabled={isBulkPending}
            title="Archive selected"
            className="p-1.5 rounded-full hover:bg-blue-100 text-blue-600 disabled:opacity-50 transition-colors"
          >
            <Archive size={15} />
          </button>
          <button
            onClick={() => bulkDeleteMutation.mutate()}
            disabled={isBulkPending}
            title="Delete selected"
            className="p-1.5 rounded-full hover:bg-red-100 text-red-500 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>

          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="p-1 rounded-full hover:bg-blue-100 text-blue-400"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="px-4 py-2.5 border-b border-gray-200 flex items-center gap-2 bg-white min-h-[44px]">
          {/* Select-all checkbox (always visible in header) */}
          <input
            type="checkbox"
            checked={false}
            onChange={() => selectAllUids(allVisibleUids)}
            disabled={allMessages.length === 0}
            title="Select all"
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0 disabled:opacity-30"
          />
          <div className="flex-1">
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
      )}

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
            checked={selectedUids.has(msg.uid)}
            showCheckbox={hasSelection}
            onClick={() => {
              if (hasSelection) {
                toggleSelectUid(msg.uid);
              } else {
                selectMessage(msg.uid);
              }
            }}
            onCheck={(e) => {
              e.stopPropagation();
              toggleSelectUid(msg.uid);
            }}
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
  msg, selected, checked, showCheckbox, onClick, onCheck, onStar,
}: {
  msg: MailHeader;
  selected: boolean;
  checked: boolean;
  showCheckbox: boolean;
  onClick: () => void;
  onCheck: (e: React.MouseEvent) => void;
  onStar: (e: React.MouseEvent) => void;
}) {
  const color = avatarColor(msg.from);
  const initial = senderInitial(msg.from);
  const name = senderName(msg.from);

  return (
    <div
      onClick={onClick}
      className={`mail-item relative group
        ${checked ? "bg-blue-50 border-l-4 border-l-blue-400" : ""}
        ${!checked && selected ? "mail-item-selected" : ""}
        ${!checked && !selected && msg.seen ? "mail-item-read hover:bg-blue-50" : ""}
        ${!checked && !selected && !msg.seen ? "mail-item-unread hover:bg-blue-50" : ""}
      `}
    >
      {/* Unread indicator */}
      {!msg.seen && !selected && !checked && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full" />
      )}

      {/* Checkbox — always visible when showCheckbox, otherwise on hover */}
      <div
        className={`flex-shrink-0 mr-2 transition-opacity ${showCheckbox || checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={onCheck}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => {}}
          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
        />
      </div>

      {/* Avatar — hidden when checkbox visible to save space */}
      {!showCheckbox && (
        <div className={`avatar ${color} text-xs mr-3 flex-shrink-0 transition-opacity ${checked ? "opacity-0 w-0 mr-0 overflow-hidden" : ""}`}>
          {initial}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`truncate text-sm ${msg.seen && !selected && !checked ? "text-[#444746]" : "font-semibold text-[#202124]"}`}>
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
            <span className={`text-xs ${msg.seen && !selected && !checked ? "text-[#5f6368]" : "font-medium text-[#202124]"}`}>
              {formatMailDate(msg.date)}
            </span>
          </div>
        </div>

        <div className={`text-xs truncate mb-0.5 ${msg.seen && !selected && !checked ? "text-[#5f6368]" : "font-medium text-[#202124]"}`}>
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
