import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Reply, Forward, Trash2, Star, MoreVertical,
  Paperclip, ChevronDown, ExternalLink, Printer, Archive,
  CornerUpLeft, RotateCcw, X, MailOpen,
} from "lucide-react";
import { getMessage, flagMessage, deleteMessage, moveMessage, permanentDeleteMessage, downloadAttachment, openAttachmentOnline } from "../../api/mailApi.ts";
import { apiClient } from "../../api/client.ts";
import { useMailStore, useToastStore, useAuthStore } from "../../store/index.ts";
import { formatFullDate, avatarColor, senderInitial, senderName } from "../../lib/utils.ts";
import { MessageSkeleton } from "../ui/Skeleton.tsx";
import { formatBytes } from "../../lib/utils.ts";

export default function MessageView() {
  const { selectedUid, selectedFolder, openCompose } = useMailStore();
  const { addToast } = useToastStore();
  const userEmail = useAuthStore(s => s.email);
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const OFFICE_TYPES = new Set(["doc", "docx", "odt", "xls", "xlsx", "ods", "ppt", "pptx", "odp"]);
  const isOfficeFile = (name: string) => OFFICE_TYPES.has(name.split(".").pop()?.toLowerCase() ?? "");

  const openNextcloud = async (redirect: string) => {
    try {
      const { data } = await apiClient.post<{ token: string }>("/files/nc-login", { redirect });
      window.open(`/api/files/nc-redirect?token=${data.token}`, "_blank");
    } catch {
      window.open(`/nextcloud${redirect}`, "_blank");
    }
  };

  const openAttachmentMutation = useMutation({
    mutationFn: ({ index, filename }: { index: number; filename: string }) =>
      openAttachmentOnline(selectedUid!, selectedFolder, index).then(async (data) => {
        await openNextcloud(data.redirect);
        return { ...data, filename };
      }),
    onSuccess: (data) => {
      addToast(`Opened ${data.filename} in online editor`, "success");
    },
    onError: () => {
      addToast("Could not open attachment in online editor", "error");
    },
  });

  const downloadAttachmentMutation = useMutation({
    mutationFn: async ({ index, filename }: { index: number; filename: string }) => {
      const data = await downloadAttachment(selectedUid!, selectedFolder, index);
      const url = URL.createObjectURL(data.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return filename;
    },
    onSuccess: (filename) => addToast(`Downloaded ${filename}`, "success"),
    onError: () => addToast("Attachment download failed", "error"),
  });

  const { data: msg, isLoading } = useQuery({
    queryKey: ["message", selectedFolder, selectedUid],
    queryFn: () => getMessage(selectedUid!, selectedFolder),
    enabled: selectedUid !== null,
  });

  // After fetching (which marks \Seen server-side), refresh the list so bold/unread count updates
  useEffect(() => {
    if (msg) {
      qc.invalidateQueries({ queryKey: ["messages"] });
    }
  }, [msg?.uid]);

  const starMutation = useMutation({
    mutationFn: (add: boolean) => flagMessage(selectedUid!, selectedFolder, "\\Flagged", add),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["message"] });
      addToast(msg?.flagged ? "Removed star" : "Starred", "success");
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: () => flagMessage(selectedUid!, selectedFolder, "\\Seen", false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["message"] });
      addToast("Marked as unread", "success");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMessage(selectedUid!, selectedFolder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      addToast("Moved to Trash", "success");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => moveMessage(selectedUid!, selectedFolder, "Archive"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      addToast("Archived", "success");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => {
      // If the user's own email is in the From header, it was a sent message
      const isSent = msg && userEmail && msg.from.toLowerCase().includes(userEmail.toLowerCase());
      const restoreFolder = isSent ? "Sent" : "INBOX";
      return moveMessage(selectedUid!, selectedFolder, restoreFolder);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      const isSent = msg && userEmail && msg.from.toLowerCase().includes(userEmail.toLowerCase());
      addToast(isSent ? "Restored to Sent" : "Restored to Inbox", "success");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => permanentDeleteMessage(selectedUid!, selectedFolder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      addToast("Deleted forever", "success");
    },
  });

  const isTrash   = selectedFolder === "Trash";
  const isArchive = selectedFolder === "Archive";

  if (!selectedUid) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
        <div className="w-24 h-24 rounded-full bg-[#eaf1fb] flex items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="1.2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-[#202124]">No message selected</p>
          <p className="text-sm text-[#5f6368] mt-1">Select a message from the list to read it</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex-1 bg-white overflow-y-auto"><MessageSkeleton /></div>;
  if (!msg)      return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Message not found</div>;

  const senderColor = avatarColor(msg.from);
  const senderInit  = senderInitial(msg.from);
  const senderN     = senderName(msg.from);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Top toolbar */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => openCompose({ uid: msg.uid, from: msg.from, subject: msg.subject, type: "reply" })}
          className="btn-ghost flex items-center gap-1.5 text-sm"
        >
          <Reply size={16} /> Reply
        </button>
        <button
          onClick={() => openCompose({ uid: msg.uid, from: msg.from, subject: msg.subject, type: "forward" })}
          className="btn-ghost flex items-center gap-1.5 text-sm"
        >
          <Forward size={16} /> Forward
        </button>
        <div className="flex-1" />
        {isTrash ? (
          <>
            <button
              onClick={() => restoreMutation.mutate()}
              className="btn-ghost flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700"
              title="Restore to original folder"
            >
              <RotateCcw size={16} /> Restore
            </button>
            <button
              onClick={() => permanentDeleteMutation.mutate()}
              className="btn-ghost flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
              title="Delete Forever"
            >
              <X size={16} /> Delete Forever
            </button>
          </>
        ) : isArchive ? (
          <>
            <button
              onClick={() => moveMessage(selectedUid!, selectedFolder, "INBOX").then(() => qc.invalidateQueries({ queryKey: ["messages"] })).then(() => addToast("Moved to Inbox", "success"))}
              className="btn-ghost flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
              title="Move back to Inbox"
            >
              <RotateCcw size={16} /> Move to Inbox
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              className="btn-ghost p-2 hover:text-red-500"
              title="Move to Trash"
            >
              <Trash2 size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => markUnreadMutation.mutate()}
              className="btn-ghost p-2"
              title="Mark as unread"
            >
              <MailOpen size={18} />
            </button>
            <button
              onClick={() => archiveMutation.mutate()}
              className="btn-ghost p-2"
              title="Archive"
            >
              <Archive size={18} />
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              className="btn-ghost p-2 hover:text-red-500"
              title="Move to Trash"
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
        <button
          onClick={() => starMutation.mutate(!msg.flagged)}
          className="btn-ghost p-2"
          title={msg.flagged ? "Unstar" : "Star"}
        >
          <Star size={18} className={msg.flagged ? "text-amber-400 fill-amber-400" : ""} />
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="btn-ghost p-2"
            title="More options"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg
                         shadow-lg z-20 py-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <Printer size={14} /> Print
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <ExternalLink size={14} /> Open in new window
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Message content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-6 py-5 max-w-4xl">
          {/* Subject */}
          <h1 className="text-2xl font-normal text-[#202124] mb-4 leading-snug">
            {msg.subject || "(no subject)"}
          </h1>

          {/* Sender row */}
          <div className="flex items-start gap-3 mb-6">
            <div className={`avatar ${senderColor} w-10 h-10`}>{senderInit}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-[#202124] text-sm">{senderN}</span>
                  <span className="text-[#5f6368] text-sm ml-1.5">&lt;{msg.from.match(/<(.+)>/)?.[1] ?? msg.from}&gt;</span>
                </div>
                <span className="text-xs text-[#5f6368] flex-shrink-0 ml-4">
                  {formatFullDate(msg.date)}
                </span>
              </div>

              <button
                onClick={() => setShowDetails(v => !v)}
                className="flex items-center gap-0.5 text-xs text-[#5f6368] hover:text-[#202124] mt-0.5 transition-colors"
              >
                {showDetails ? "to me" : `to ${msg.to}`}
                <ChevronDown size={12} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </button>

              {showDetails && (
                <div className="mt-2 text-xs text-[#5f6368] space-y-0.5 bg-gray-50 rounded-lg p-3">
                  <div><span className="font-medium text-[#202124] w-12 inline-block">from:</span> {msg.from}</div>
                  <div><span className="font-medium text-[#202124] w-12 inline-block">to:</span> {msg.to}</div>
                  <div><span className="font-medium text-[#202124] w-12 inline-block">date:</span> {formatFullDate(msg.date)}</div>
                  <div><span className="font-medium text-[#202124] w-12 inline-block">subject:</span> {msg.subject}</div>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="text-sm text-[#202124] leading-relaxed">
            {msg.html ? (
              <div
                className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline email-body-render"
                dangerouslySetInnerHTML={{ __html: sanitize(msg.html) }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.text}</pre>
            )}
          </div>

          {/* Attachments */}
          {msg.attachments.length > 0 && (
            <div className="mt-8 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-[#5f6368] uppercase tracking-wider mb-3">
                {msg.attachments.length} attachment{msg.attachments.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-3">
                {msg.attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 border border-gray-200 hover:border-gray-300
                               rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Paperclip size={15} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#202124] max-w-[160px] truncate">{att.filename}</p>
                      <p className="text-xs text-[#5f6368]">{formatBytes(att.size)}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => downloadAttachmentMutation.mutate({ index: i, filename: att.filename })}
                        className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-white text-[#202124]"
                        disabled={downloadAttachmentMutation.isPending}
                      >
                        Download
                      </button>
                      {isOfficeFile(att.filename) && (
                        <button
                          onClick={() => openAttachmentMutation.mutate({ index: i, filename: att.filename })}
                          disabled={openAttachmentMutation.isPending}
                          className="text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          {openAttachmentMutation.isPending ? "Opening..." : "Edit Online"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Reply */}
          <div className="mt-8">
            <button
              onClick={() => openCompose({ uid: msg.uid, from: msg.from, subject: msg.subject, type: "reply" })}
              className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 rounded-full
                         px-5 py-2.5 text-sm text-[#202124] transition-colors hover:shadow-sm"
            >
              <CornerUpLeft size={15} />
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function sanitize(html: string): string {
  // Basic script removal — install DOMPurify for production
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}
