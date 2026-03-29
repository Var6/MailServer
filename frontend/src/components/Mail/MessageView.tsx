import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Reply, Forward, Trash2, Star, MoreVertical,
  Paperclip, ChevronDown, ExternalLink, Printer, Archive,
  CornerUpLeft, RotateCcw, X, MailOpen,
} from "lucide-react";
import { getMessage, flagMessage, deleteMessage, moveMessage, permanentDeleteMessage, downloadAttachment, openAttachmentOnline } from "../../api/mailApi.ts";
import { apiClient } from "../../api/client.ts";
import { useMailStore, useToastStore, useAuthStore, useUiThemeStore } from "../../store/index.ts";
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

  const DARK_TEXT_COLORS = ["#f3f4f6", "#f1f5f9", "#f3e8ff", "#e9d5ff", "#f0f9ff", "#f9fafb", "#fce7f3"];
  const BG_THEMES = [
    { bg: "#eef2ff", text: "#1f2937" }, { bg: "#f5f7fb", text: "#1f2937" },
    { bg: "#e9f5ff", text: "#1f2937" }, { bg: "#f4efe6", text: "#1f2937" },
    { bg: "linear-gradient(120deg,#e0f2fe,#f5f3ff)", text: "#1f2937" },
    { bg: "linear-gradient(120deg,#fef3c7,#fde68a)", text: "#1f2937" },
    { bg: "linear-gradient(120deg,#dcfce7,#ccfbf1)", text: "#1f2937" },
    { bg: "linear-gradient(120deg,#fee2e2,#fecdd3)", text: "#1f2937" },
    { bg: "#1f2937", text: "#f3f4f6" }, { bg: "#0f172a", text: "#f1f5f9" },
    { bg: "#1e1b4b", text: "#f3e8ff" }, { bg: "#0c0a1e", text: "#e9d5ff" },
    { bg: "linear-gradient(120deg,#0f172a,#1e1b4b)", text: "#f0f9ff" },
    { bg: "linear-gradient(120deg,#1f2937,#111827)", text: "#f9fafb" },
    { bg: "linear-gradient(120deg,#1e293b,#0f172a)", text: "#f1f5f9" },
    { bg: "linear-gradient(120deg,#2d1b69,#0c0a1e)", text: "#fce7f3" },
  ];
  const appBg = useUiThemeStore((s) => s.appBg);
  const foundTheme = BG_THEMES.find(t => t.bg === appBg);
  const textColor = foundTheme?.text || "#1f2937";
  const isDark = DARK_TEXT_COLORS.includes(textColor);
  const mutedColor = isDark ? "#9ca3af" : "#5f6368";
  const border = isDark ? "#374151" : "#e5e7eb";

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
      <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: appBg, color: textColor }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? "#374151" : "#eaf1fb" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4285f4" strokeWidth="1.2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-medium" style={{ color: textColor }}>No message selected</p>
          <p className="text-sm mt-1" style={{ color: mutedColor }}>Select a message from the list to read it</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex-1 overflow-y-auto" style={{ background: appBg }}><MessageSkeleton /></div>;
  if (!msg)      return <div className="flex-1 flex items-center justify-center text-sm" style={{ background: appBg, color: mutedColor }}>Message not found</div>;

  const senderColor = avatarColor(msg.from);
  const senderInit  = senderInitial(msg.from);
  const senderN     = senderName(msg.from);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: appBg, color: textColor }}>
      {/* Top toolbar */}
      <div className="px-4 py-2 border-b flex items-center gap-1 flex-shrink-0" style={{ borderColor: border }}>
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
              className="absolute right-0 top-full mt-1 w-44 border rounded-lg shadow-lg z-20 py-1"
              style={{ backgroundColor: isDark ? "#1f2937" : "white", borderColor: border }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" style={{ color: textColor }}>
                <Printer size={14} /> Print
              </button>
              <button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" style={{ color: textColor }}>
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
          <h1 className="text-2xl font-normal mb-4 leading-snug" style={{ color: textColor }}>
            {msg.subject || "(no subject)"}
          </h1>

          {/* Sender row */}
          <div className="flex items-start gap-3 mb-6">
            <div className={`avatar ${senderColor} w-10 h-10`}>{senderInit}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm" style={{ color: textColor }}>{senderN}</span>
                  <span className="text-sm ml-1.5" style={{ color: mutedColor }}>&lt;{msg.from.match(/<(.+)>/)?.[1] ?? msg.from}&gt;</span>
                </div>
                <span className="text-xs flex-shrink-0 ml-4" style={{ color: mutedColor }}>
                  {formatFullDate(msg.date)}
                </span>
              </div>

              <button
                onClick={() => setShowDetails(v => !v)}
                className="flex items-center gap-0.5 text-xs mt-0.5 transition-colors"
                style={{ color: mutedColor }}
              >
                {showDetails ? "to me" : `to ${msg.to}`}
                <ChevronDown size={12} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </button>

              {showDetails && (
                <div className="mt-2 text-xs space-y-0.5 rounded-lg p-3" style={{ color: mutedColor, backgroundColor: isDark ? "#374151" : "#f9fafb" }}>
                  <div><span className="font-medium w-12 inline-block" style={{ color: textColor }}>from:</span> {msg.from}</div>
                  <div><span className="font-medium w-12 inline-block" style={{ color: textColor }}>to:</span> {msg.to}</div>
                  <div><span className="font-medium w-12 inline-block" style={{ color: textColor }}>date:</span> {formatFullDate(msg.date)}</div>
                  <div><span className="font-medium w-12 inline-block" style={{ color: textColor }}>subject:</span> {msg.subject}</div>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="text-sm leading-relaxed" style={{ color: textColor }}>
            {msg.html ? (
              <div
                className="p-4 prose prose-sm max-w-none [&_a]:text-blue-400 email-body"
                style={{ color: isDark ? "#f9fafb" : "#111827" }}
                dangerouslySetInnerHTML={{ __html: sanitize(msg.html) }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.text}</pre>
            )}
          </div>

          {/* Attachments */}
          {msg.attachments.length > 0 && (
            <div className="mt-8 pt-4 border-t" style={{ borderColor: border }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: mutedColor }}>
                {msg.attachments.length} attachment{msg.attachments.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-3">
                {msg.attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 border rounded-xl px-4 py-3 transition-colors group"
                    style={{ borderColor: border, backgroundColor: isDark ? "#1f2937" : "white" }}
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Paperclip size={15} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium max-w-[160px] truncate" style={{ color: textColor }}>{att.filename}</p>
                      <p className="text-xs" style={{ color: mutedColor }}>{formatBytes(att.size)}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => downloadAttachmentMutation.mutate({ index: i, filename: att.filename })}
                        className="text-xs px-2 py-1 rounded-md border"
                        style={{ borderColor: border, color: textColor }}
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
              className="flex items-center gap-2 border rounded-full px-5 py-2.5 text-sm transition-colors hover:shadow-sm"
              style={{ borderColor: border, color: textColor }}
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
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")  // strip email-embedded CSS so our theme wins
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/(\s)(bgcolor|background)\s*=\s*["'][^"']*["']/gi, "");  // strip bgcolor attrs
}
