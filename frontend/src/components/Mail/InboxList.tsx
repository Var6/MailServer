import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Paperclip, RefreshCw, X, Trash2, Archive, MailOpen, Mail } from "lucide-react";
import { useMemo } from "react";
import { getMessages, flagMessage, deleteMessage, moveMessage } from "../../api/mailApi.ts";
import { useMailStore, useToastStore } from "../../store/index.ts";
import { useTheme } from "../../lib/themes.ts";
import { formatMailDate, avatarColor, senderInitial, senderName, stripHtml } from "../../lib/utils.ts";
import { MailListSkeleton } from "../ui/Skeleton.tsx";
import type { MailHeader } from "../../types/index.ts";


export default function InboxList() {
  const {
    selectedFolder, selectedUid, selectMessage,
    selectedUids, toggleSelectUid, selectAllUids, clearSelection,
    searchQuery, setSearchQuery,
  } = useMailStore();
  const { addToast } = useToastStore();
  const { appBg, textColor, isDark } = useTheme();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allMessages;
    return allMessages.filter(m =>
      m.subject?.toLowerCase().includes(q) ||
      m.from?.toLowerCase().includes(q) ||
      m.preview?.toLowerCase().includes(q)
    );
  }, [allMessages, searchQuery]);

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

  const border = isDark ? "#374151" : "#e5e7eb";

  return (
    <div
      className="w-80 flex-shrink-0 flex flex-col border-r overflow-hidden shadow-sm"
      style={{ background: appBg, color: textColor, borderColor: border }}
    >
      {/* Toolbar */}
      {hasSelection ? (
        <div
          className="px-3 py-2 border-b flex items-center gap-1 min-h-[44px]"
          style={{ borderColor: border, backgroundColor: isDark ? "#1f2937" : "#eff6ff" }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => { if (el) el.indeterminate = someSelected; }}
            onChange={() => allSelected ? clearSelection() : selectAllUids(allVisibleUids)}
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer mr-1 flex-shrink-0"
          />
          <span
            className="text-xs font-semibold mr-2 whitespace-nowrap"
            style={{ color: isDark ? "#60a5fa" : "#1e40af" }}
          >
            {selectedUids.size} selected
          </span>

          <button onClick={() => bulkReadMutation.mutate(true)} disabled={isBulkPending} title="Mark read"
            className="p-1.5 rounded-full text-blue-600 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: isDark ? "#374151" : "#dbeafe" }}>
            <MailOpen size={15} />
          </button>
          <button onClick={() => bulkReadMutation.mutate(false)} disabled={isBulkPending} title="Mark unread"
            className="p-1.5 rounded-full text-blue-600 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: isDark ? "#374151" : "#dbeafe" }}>
            <Mail size={15} />
          </button>
          <button onClick={() => bulkArchiveMutation.mutate()} disabled={isBulkPending} title="Archive"
            className="p-1.5 rounded-full text-blue-600 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: isDark ? "#374151" : "#dbeafe" }}>
            <Archive size={15} />
          </button>
          <button onClick={() => bulkDeleteMutation.mutate()} disabled={isBulkPending} title="Delete"
            className="p-1.5 rounded-full text-red-500 disabled:opacity-50 transition-colors"
            style={{ backgroundColor: isDark ? "#374151" : "#fee2e2" }}>
            <Trash2 size={15} />
          </button>

          <div className="flex-1" />
          <button onClick={clearSelection} className="p-1 rounded-full transition-colors"
            style={{ color: isDark ? "#60a5fa" : "#93c5fd" }} title="Clear selection">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="px-4 py-2.5 border-b flex items-center gap-2 min-h-[44px]"
          style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#f9fafb" }}
        >
          <input
            type="checkbox"
            checked={false}
            onChange={() => selectAllUids(allVisibleUids)}
            disabled={allMessages.length === 0}
            title="Select all"
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0 disabled:opacity-30"
          />
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: textColor }}>{selectedFolder}</span>
            {total > 0 && (
              <span
                className="text-xs rounded-full px-2 py-0.5 font-normal"
                style={{ color: isDark ? "#9ca3af" : "#6b7280", backgroundColor: isDark ? "#374151" : "#f3f4f6" }}
              >
                {total}
              </span>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className={`p-2 rounded-full transition-colors ${isFetching ? "animate-spin" : ""}`}
            style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading && <MailListSkeleton />}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isDark ? "#374151" : "#fef2f2" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#ef4444" }}>Failed to load messages</p>
              <p className="text-xs mt-1" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                {(error as Error)?.message?.includes("401") || (error as Error)?.message?.includes("password")
                  ? "Session expired — please log out and log in again."
                  : "Could not connect to the mail server."}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 text-xs font-medium px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !isError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isDark ? "#374151" : "#eff6ff" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                {searchQuery ? "No matches found" : "No messages"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>
                {searchQuery ? `No results for "${searchQuery}"` : `Your ${selectedFolder.toLowerCase()} is empty`}
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
            isDark={isDark}
            textColor={textColor}
            onClick={() => {
              if (hasSelection) {
                toggleSelectUid(msg.uid);
              } else {
                selectMessage(msg.uid);
                if (!msg.seen) {
                  qc.setQueryData(
                    ["messages", selectedFolder, 1],
                    (old: typeof data) => old
                      ? { ...old, messages: old.messages.map(m => m.uid === msg.uid ? { ...m, seen: true } : m) }
                      : old
                  );
                }
              }
            }}
            onCheck={(e) => { e.stopPropagation(); toggleSelectUid(msg.uid); }}
            onStar={(e) => { e.stopPropagation(); starMutation.mutate({ uid: msg.uid, add: !msg.flagged }); }}
          />
        ))}
      </div>
    </div>
  );
}

function MailItem({
  msg, selected, checked, showCheckbox, isDark, textColor, onClick, onCheck, onStar,
}: {
  msg: MailHeader;
  selected: boolean;
  checked: boolean;
  showCheckbox: boolean;
  isDark: boolean;
  textColor: string;
  onClick: () => void;
  onCheck: (e: React.MouseEvent) => void;
  onStar: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        relative group px-2 py-1.5 transition border-b cursor-pointer
        ${checked ? "border-l-4 border-l-blue-400" : ""}
        ${!checked && selected ? "bg-blue-600 text-white" : ""}
        ${!checked && !selected && msg.seen ? (isDark ? "hover:bg-gray-700" : "hover:bg-gray-50") : ""}
        ${!checked && !selected && !msg.seen ? (isDark ? "bg-gray-700" : "bg-blue-50 hover:bg-blue-100") : ""}
      `}
      style={{
        borderBottomColor: isDark ? "#374151" : "#e5e7eb",
        backgroundColor: checked ? (isDark ? "#1e40af" : "#dbeafe") : undefined,
        color: textColor,
      }}
    >
      <div className={`absolute left-1 top-4 w-2 h-2 rounded-full ${(!msg.seen && !selected && !checked) ? "bg-blue-600" : "bg-transparent"}`} />

      <div className="flex items-center gap-2 pl-3">
        <div
          className={`flex-shrink-0 transition-opacity ${showCheckbox || checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          onClick={onCheck}
        >
          <input type="checkbox" checked={checked} onChange={() => {}} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
        </div>

        {!showCheckbox && (
          <div className="avatar text-xs flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: avatarColor(msg.from) }}>
            {senderInitial(msg.from)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="truncate text-sm font-medium">{senderName(msg.from)}</span>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <button onClick={onStar} className={`opacity-0 group-hover:opacity-100 ${msg.flagged ? "opacity-100" : ""} transition-opacity`}>
                <Star size={14} className={msg.flagged ? "text-amber-400 fill-amber-400" : (isDark ? "text-gray-600" : "text-gray-300")} />
              </button>
              <span className="text-xs font-medium" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                {formatMailDate(msg.date)}
              </span>
            </div>
          </div>
          <div className="text-xs truncate mb-0.5 font-medium">{msg.subject || "(no subject)"}</div>
          <div className="flex items-center gap-1">
            {msg.hasAttachments && <Paperclip size={11} className="text-gray-400 flex-shrink-0" />}
            <span className="text-xs truncate" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
              {msg.preview ? stripHtml(msg.preview) : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
