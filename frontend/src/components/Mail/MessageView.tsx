import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Reply, Forward, Trash2, Star, MoreVertical,
  Paperclip, ChevronDown, ExternalLink, Printer, Archive,
  CornerUpLeft, RotateCcw, X, MailOpen,
  FileText, FileSpreadsheet, Presentation, File, Image,
  Download, Eye, Pencil, FolderInput,
} from "lucide-react";
import { getMessage, flagMessage, deleteMessage, moveMessage, permanentDeleteMessage, downloadAttachment, saveAttachmentToFiles } from "../../api/mailApi.ts";
import { apiClient } from "../../api/client.ts";
import { useMailStore, useToastStore } from "../../store/index.ts";
import { useTheme } from "../../lib/themes.ts";
import { formatFullDate, avatarColor, senderInitial, senderName, formatBytes } from "../../lib/utils.ts";
import { MessageSkeleton } from "../ui/Skeleton.tsx";
import { useAuthStore } from "../../store/index.ts";

// ── file type helpers ─────────────────────────────────────────────────────────
const OFFICE_EXTS  = new Set(["doc","docx","odt","xls","xlsx","ods","csv","ppt","pptx","odp","odg","odf"]);
const IMAGE_EXTS   = new Set(["jpg","jpeg","png","gif","webp","bmp","svg","avif"]);
const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

function fileKind(name: string): "pdf" | "office" | "image" | "other" {
  const e = ext(name);
  if (e === "pdf") return "pdf";
  if (OFFICE_EXTS.has(e)) return "office";
  if (IMAGE_EXTS.has(e)) return "image";
  return "other";
}

function FileIcon({ name, size = 18 }: { name: string; size?: number }) {
  const kind = fileKind(name);
  const e = ext(name);
  if (kind === "pdf") return <FileText size={size} className="text-red-500" />;
  if (e === "xls" || e === "xlsx" || e === "ods" || e === "csv")
    return <FileSpreadsheet size={size} className="text-emerald-600" />;
  if (e === "ppt" || e === "pptx" || e === "odp")
    return <Presentation size={size} className="text-orange-500" />;
  if (kind === "office") return <FileText size={size} className="text-blue-600" />;
  if (kind === "image") return <Image size={size} className="text-purple-500" />;
  return <File size={size} className="text-gray-400" />;
}

function iconBg(name: string): string {
  const kind = fileKind(name);
  const e = ext(name);
  if (kind === "pdf") return "bg-red-50";
  if (e === "xls" || e === "xlsx" || e === "ods" || e === "csv") return "bg-emerald-50";
  if (e === "ppt" || e === "pptx" || e === "odp") return "bg-orange-50";
  if (kind === "office") return "bg-blue-50";
  if (kind === "image") return "bg-purple-50";
  return "bg-gray-100";
}

// ── PDF / Image viewer modal ──────────────────────────────────────────────────
function AttachmentViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const kind = fileKind(name);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1f2937] flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileIcon name={name} size={16} />
          <span className="text-sm text-white font-medium truncate max-w-xs">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            download={name}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
          >
            <Download size={13} /> Download
          </a>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
        {kind === "pdf" ? (
          <iframe
            src={url}
            className="w-full h-full rounded-lg bg-white"
            title={name}
          />
        ) : (
          <img
            src={url}
            alt={name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MessageView() {
  const { selectedUid, selectedFolder, openCompose } = useMailStore();
  const { addToast } = useToastStore();
  const userEmail = useAuthStore(s => s.email);
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("");

  const { appBg, textColor, isDark } = useTheme();
  const mutedColor = isDark ? "#9ca3af" : "#5f6368";
  const border = isDark ? "#374151" : "#e5e7eb";

  // Close viewer and revoke blob URL on unmount
  useEffect(() => {
    return () => { if (viewerUrl?.startsWith("blob:")) URL.revokeObjectURL(viewerUrl); };
  }, [viewerUrl]);

  // ── Download (triggers browser save) ──────────────────────────────────────
  const downloadMutation = useMutation({
    mutationFn: async ({ index, filename }: { index: number; filename: string }) => {
      const data = await downloadAttachment(selectedUid!, selectedFolder, index);
      const url = URL.createObjectURL(data.blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      return filename;
    },
    onSuccess: (f) => addToast(`Downloaded ${f}`, "success"),
    onError: () => addToast("Download failed", "error"),
  });

  // ── View inline (PDF / image) ──────────────────────────────────────────────
  const viewMutation = useMutation({
    mutationFn: async ({ index, filename }: { index: number; filename: string }) => {
      const data = await downloadAttachment(selectedUid!, selectedFolder, index);
      return { url: URL.createObjectURL(data.blob), filename };
    },
    onSuccess: ({ url, filename }) => {
      if (viewerUrl?.startsWith("blob:")) URL.revokeObjectURL(viewerUrl);
      setViewerUrl(url);
      setViewerName(filename);
    },
    onError: () => addToast("Could not open attachment", "error"),
  });

  // ── Save to Files ─────────────────────────────────────────────────────────
  const saveToFilesMutation = useMutation({
    mutationFn: ({ index }: { index: number; filename: string }) =>
      saveAttachmentToFiles(selectedUid!, selectedFolder, index),
    onSuccess: (_data, { filename }) => addToast(`"${filename}" saved to Files`, "success"),
    onError: () => addToast("Could not save to Files", "error"),
  });

  // ── Attachment labels (stored in localStorage) ────────────────────────────
  const [attachmentLabels, setAttachmentLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mail_attachment_labels") ?? "{}"); } catch { return {}; }
  });
  const [labelMenuIdx, setLabelMenuIdx] = useState<number | null>(null);

  const LABEL_COLORS = [
    { name: "red",    bg: "#ef4444" },
    { name: "orange", bg: "#f97316" },
    { name: "yellow", bg: "#eab308" },
    { name: "green",  bg: "#22c55e" },
    { name: "blue",   bg: "#3b82f6" },
    { name: "purple", bg: "#a855f7" },
  ];

  const labelKey  = (i: number) => `${selectedUid}_${i}`;
  const applyLabel = (i: number, color: string | null) => {
    const key  = labelKey(i);
    const next = { ...attachmentLabels };
    if (color === null) delete next[key]; else next[key] = color;
    setAttachmentLabels(next);
    localStorage.setItem("mail_attachment_labels", JSON.stringify(next));
    setLabelMenuIdx(null);
  };

  // ── Edit online (Office via Collabora) ────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async ({ index, filename }: { index: number; filename: string }) => {
      // 1. Save attachment to local file storage
      const { data: saved } = await apiClient.post(
        `/mail/messages/${selectedUid}/attachments/${index}/edit-online`,
        { folder: selectedFolder },
      );
      // 2. Get WOPI token for that path
      const { data: wopi } = await apiClient.post(
        `/wopi/token?path=${encodeURIComponent(saved.path)}`,
      );
      return { wopi, filename };
    },
    onSuccess: ({ wopi }) => {
      const wopiSrc    = encodeURIComponent(wopi.wopiSrc);
      const token      = encodeURIComponent(wopi.token);
      const ttl        = wopi.tokenTtl;
      const editorPath = wopi.editorPath ?? "/browser/dist/cool.html";
      window.open(
        `${window.location.origin}${editorPath}?WOPISrc=${wopiSrc}&access_token=${token}&access_token_ttl=${ttl}`,
        "_blank", "noopener",
      );
    },
    onError: () => addToast("Could not open editor", "error"),
  });

  const { data: msg, isLoading } = useQuery({
    queryKey: ["message", selectedFolder, selectedUid],
    queryFn: () => getMessage(selectedUid!, selectedFolder),
    enabled: selectedUid !== null,
  });

  useEffect(() => {
    if (msg) qc.invalidateQueries({ queryKey: ["messages"] });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["messages"] }); addToast("Moved to Trash", "success"); },
  });

  const archiveMutation = useMutation({
    mutationFn: () => moveMessage(selectedUid!, selectedFolder, "Archive"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["messages"] }); addToast("Archived", "success"); },
  });

  const restoreMutation = useMutation({
    mutationFn: () => {
      const isSent = msg && userEmail && msg.from.toLowerCase().includes(userEmail.toLowerCase());
      return moveMessage(selectedUid!, selectedFolder, isSent ? "Sent" : "INBOX");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      const isSent = msg && userEmail && msg.from.toLowerCase().includes(userEmail.toLowerCase());
      addToast(isSent ? "Restored to Sent" : "Restored to Inbox", "success");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => permanentDeleteMessage(selectedUid!, selectedFolder),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["messages"] }); addToast("Deleted forever", "success"); },
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
    <>
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
              <button onClick={() => deleteMutation.mutate()} className="btn-ghost p-2 hover:text-red-500" title="Move to Trash">
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => markUnreadMutation.mutate()} className="btn-ghost p-2" title="Mark as unread">
                <MailOpen size={18} />
              </button>
              <button onClick={() => archiveMutation.mutate()} className="btn-ghost p-2" title="Archive">
                <Archive size={18} />
              </button>
              <button onClick={() => deleteMutation.mutate()} className="btn-ghost p-2 hover:text-red-500" title="Move to Trash">
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
            <button onClick={() => setMenuOpen(v => !v)} className="btn-ghost p-2" title="More options">
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

            {/* ── Attachments ── */}
            {msg.attachments.length > 0 && (
              <div className="mt-8 pt-4 border-t" style={{ borderColor: border }}>
                <div className="flex items-center gap-2 mb-4">
                  <Paperclip size={14} style={{ color: mutedColor }} />
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: mutedColor }}>
                    {msg.attachments.length} attachment{msg.attachments.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {msg.attachments.map((att, i) => {
                    const kind = fileKind(att.filename);
                    const canView = kind === "pdf" || kind === "image";
                    const canEdit = kind === "office";
                    const isDownloading = downloadMutation.isPending && downloadMutation.variables?.index === i;
                    const isViewing    = viewMutation.isPending    && viewMutation.variables?.index === i;
                    const isEditing    = editMutation.isPending    && editMutation.variables?.index === i;
                    const isSaving     = saveToFilesMutation.isPending && saveToFilesMutation.variables?.index === i;
                    const labelColor   = attachmentLabels[labelKey(i)];

                    return (
                      <div
                        key={i}
                        className="flex flex-col rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                        style={{
                          borderColor: labelColor ?? border,
                          borderLeftWidth: labelColor ? "3px" : undefined,
                          backgroundColor: isDark ? "#1f2937" : "white",
                        }}
                      >
                        {/* Top: icon + name + label dot */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg(att.filename)}`}>
                            <FileIcon name={att.filename} size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate" style={{ color: textColor }} title={att.filename}>
                              {att.filename}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: mutedColor }}>{formatBytes(att.size)}</p>
                          </div>
                          {labelColor && (
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: labelColor }} />
                          )}
                        </div>

                        {/* Bottom: all action buttons on one row */}
                        <div
                          className="flex items-center gap-1.5 px-3 pb-3 pt-2 border-t"
                          style={{ borderColor: border }}
                        >
                          {/* Download */}
                          <button
                            onClick={() => downloadMutation.mutate({ index: i, filename: att.filename })}
                            disabled={isDownloading}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                            style={{ borderColor: border, color: textColor }}
                            title="Download"
                          >
                            <Download size={12} />
                            {isDownloading ? "…" : "Download"}
                          </button>

                          {/* View — PDF and images */}
                          {canView && (
                            <button
                              onClick={() => viewMutation.mutate({ index: i, filename: att.filename })}
                              disabled={isViewing}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                              title="View inline"
                            >
                              <Eye size={12} />
                              {isViewing ? "…" : "View"}
                            </button>
                          )}

                          {/* Edit — office files via Collabora */}
                          {canEdit && (
                            <button
                              onClick={() => editMutation.mutate({ index: i, filename: att.filename })}
                              disabled={isEditing}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                              title="Edit in Collabora"
                            >
                              <Pencil size={12} />
                              {isEditing ? "Opening…" : "Edit"}
                            </button>
                          )}

                          {/* Save to Files */}
                          <button
                            onClick={() => saveToFilesMutation.mutate({ index: i, filename: att.filename })}
                            disabled={isSaving}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-violet-200 text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
                            title="Save to Files"
                          >
                            <FolderInput size={12} />
                            {isSaving ? "…" : "Save"}
                          </button>

                          {/* Label / Mark */}
                          <div className="relative ml-auto">
                            <button
                              onClick={() => setLabelMenuIdx(labelMenuIdx === i ? null : i)}
                              className="flex items-center justify-center w-7 h-7 rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                              style={{ borderColor: border }}
                              title={labelColor ? "Change label" : "Add label"}
                            >
                              <div
                                className="w-3.5 h-3.5 rounded-full border-2 transition-colors"
                                style={{
                                  backgroundColor: labelColor ?? "transparent",
                                  borderColor: labelColor ?? mutedColor,
                                }}
                              />
                            </button>
                            {labelMenuIdx === i && (
                              <div
                                className="absolute right-0 bottom-full mb-1.5 flex items-center gap-1 px-2 py-1.5 rounded-xl border shadow-lg z-20"
                                style={{ backgroundColor: isDark ? "#1f2937" : "white", borderColor: border }}
                              >
                                {LABEL_COLORS.map(lc => (
                                  <button
                                    key={lc.name}
                                    onClick={() => applyLabel(i, lc.bg)}
                                    className="w-5 h-5 rounded-full hover:scale-125 transition-transform ring-offset-1 hover:ring-2"
                                    style={{ backgroundColor: lc.bg, outlineColor: lc.bg }}
                                    title={lc.name}
                                  />
                                ))}
                                {labelColor && (
                                  <button
                                    onClick={() => applyLabel(i, null)}
                                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center hover:scale-125 transition-transform"
                                    style={{ borderColor: mutedColor }}
                                    title="Remove label"
                                  >
                                    <X size={9} style={{ color: mutedColor }} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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

      {/* Inline viewer modal */}
      {viewerUrl && (
        <AttachmentViewer
          url={viewerUrl}
          name={viewerName}
          onClose={() => {
            URL.revokeObjectURL(viewerUrl);
            setViewerUrl(null);
          }}
        />
      )}
    </>
  );
}

function sanitize(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/(\s)(bgcolor|background)\s*=\s*["'][^"']*["']/gi, "");
}
