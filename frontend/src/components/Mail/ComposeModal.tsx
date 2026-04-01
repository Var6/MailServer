import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Minimize2, Maximize2, Send, Paperclip, Minus,
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link2, Heading2, Undo2, Redo2, RemoveFormatting, FileText,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useMailStore, useToastStore, useAuthStore } from "../../store/index.ts";
import { useTheme } from "../../lib/themes.ts";
import { sendMail } from "../../api/mailApi.ts";
import { formatBytes, avatarColor } from "../../lib/utils.ts";


const DRAFT_KEY = "mail_draft";
const RECIPIENTS_KEY = "mail_known_recipients";

interface Attachment {
  filename: string;
  content: string;   // base64
  contentType: string;
  size: number;
}

function readFileAsBase64WithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ base64: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      resolve({
        base64,
        contentType: file.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(file);
  });
}

function getKnownRecipients(): string[] {
  try { return JSON.parse(localStorage.getItem(RECIPIENTS_KEY) ?? "[]"); }
  catch { return []; }
}

function addKnownRecipient(email: string) {
  if (!email.includes("@")) return;
  const known = new Set(getKnownRecipients());
  known.add(email.trim().toLowerCase());
  localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(Array.from(known)));
}

function saveRecipientsFromField(field: string) {
  field.split(",").map(e => e.trim()).filter(Boolean).forEach(e => {
    const match = e.match(/<(.+)>/) ?? e.match(/(\S+@\S+)/);
    if (match) addKnownRecipient(match[1]);
  });
}

export default function ComposeModal() {
  const { closeCompose, replyTo } = useMailStore();
  const { addToast } = useToastStore();
  const { email: authEmail, displayName: authName, avatar } = useAuthStore();
  const { isDark } = useTheme();
  const t = {
    bg: isDark ? "#1f2937" : "#ffffff",
    text: isDark ? "#e5e7eb" : "#202124",
    muted: isDark ? "#9ca3af" : "#5f6368",
    border: isDark ? "#374151" : "#e5e7eb",
    borderLight: isDark ? "#2d3748" : "#f3f4f6",
    toolbar: isDark ? "#111827" : "#f9fafb",
    inputBg: isDark ? "#111827" : "#ffffff",
    hoverBg: isDark ? "#374151" : "#f3f4f6",
    attachBg: isDark ? "#1e3a5f" : "#eff6ff",
    attachBorder: isDark ? "#2563eb44" : "#dbeafe",
    titleBar: isDark ? "#111827" : "#404040",
  };
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [to, setTo]           = useState(replyTo?.from ?? "");
  const [cc, setCc]           = useState("");
  const [bcc, setBcc]         = useState("");
  const [subject, setSubject] = useState(
    replyTo
      ? (replyTo.type === "reply" ? `Re: ${replyTo.subject}` : `Fwd: ${replyTo.subject}`)
      : ""
  );
  const [showCc, setShowCc]     = useState(false);
  const [showBcc, setShowBcc]   = useState(false);
  const [minimized, setMinimized]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentPrep, setAttachmentPrep] = useState<{ active: boolean; fileName: string; progress: number }>({
    active: false,
    fileName: "",
    progress: 0,
  });
  const [sendUploadProgress, setSendUploadProgress] = useState<number | null>(null);
  const [toSuggestions, setToSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const knownRecipients = useRef(getKnownRecipients());

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline" } }),
      Placeholder.configure({ placeholder: "Write your message here…" }),
      TextStyle,
      Color,
    ],
    editorProps: {
      attributes: {
        class: "outline-none min-h-[180px] text-sm leading-relaxed prose prose-sm max-w-none",
      },
    },
    autofocus: !!replyTo,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
  });

  // Restore draft on open (only for new compose, not reply/forward)
  useEffect(() => {
    if (replyTo) return;
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (saved && (saved.to || saved.subject || saved.body)) {
        const restore = window.confirm("You have an unsaved draft. Restore it?");
        if (restore) {
          if (saved.to) setTo(saved.to);
          if (saved.subject) setSubject(saved.subject);
          // Editor may not be ready immediately
          setTimeout(() => {
            if (saved.body && editor) editor.commands.setContent(saved.body);
          }, 100);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (replyTo) return;
    const interval = setInterval(() => {
      if (!to && !subject && (!editor || editor.isEmpty)) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        to, subject, body: editor?.getHTML() ?? "",
      }));
    }, 30_000);
    return () => clearInterval(interval);
  }, [to, subject, editor, replyTo]);

  const handleToChange = (value: string) => {
    setTo(value);
    const last = value.split(",").pop()?.trim() ?? "";
    if (last.length >= 1) {
      const matches = knownRecipients.current.filter(r => r.includes(last.toLowerCase()));
      setToSuggestions(matches.slice(0, 6));
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const pickSuggestion = (email: string) => {
    const parts = to.split(",");
    parts[parts.length - 1] = " " + email;
    setTo(parts.join(",").trimStart() + ", ");
    setShowSuggestions(false);
  };

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newAttachments: Attachment[] = [];
    const allFiles = Array.from(files);
    setAttachmentPrep({ active: true, fileName: allFiles[0]?.name ?? "", progress: 0 });

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      try {
        const result = await readFileAsBase64WithProgress(file, (fileProgress) => {
          const combinedProgress = Math.round(((i + fileProgress / 100) / allFiles.length) * 100);
          setAttachmentPrep({ active: true, fileName: file.name, progress: combinedProgress });
        });
        newAttachments.push({
          filename: file.name,
          content: result.base64,
          contentType: result.contentType,
          size: file.size,
        });
      } catch {
        addToast(`Failed to attach ${file.name}`, "error");
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setAttachmentPrep({ active: false, fileName: "", progress: 100 });
  }, [addToast]);

  const removeAttachment = (idx: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx));

  const mutation = useMutation({
    mutationFn: () => {
      const html = editor?.getHTML() ?? "";
      const text = editor?.getText() ?? "";
      return sendMail({
        to, cc: cc || undefined, bcc: bcc || undefined, subject,
        html: `<div style="font-family:Inter,sans-serif;font-size:14px;line-height:1.6;">${html}</div>`,
        text,
        attachments: attachments.length
          ? attachments.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
          : undefined,
      }, (event) => {
        if (event.total && event.total > 0) {
          setSendUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    },
    onSuccess: () => {
      setSendUploadProgress(null);
      saveRecipientsFromField(to);
      if (cc) saveRecipientsFromField(cc);
      localStorage.removeItem(DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ["messages"] });
      addToast("Message sent!", "success");
      closeCompose();
    },
    onError: () => {
      setSendUploadProgress(null);
      addToast("Failed to send message. Please try again.", "error");
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const handleClose = () => {
    if (to || subject || (editor && !editor.isEmpty)) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        to, subject, body: editor?.getHTML() ?? "",
      }));
    }
    closeCompose();
  };

  if (minimized) {
    return (
      <div
        className="fixed bottom-0 right-6 w-72 bg-[#404040] text-white rounded-t-xl shadow-2xl cursor-pointer z-50"
        onClick={() => setMinimized(false)}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium truncate">{subject || "New Message"}</span>
          <div className="flex items-center gap-1.5">
            <Maximize2 size={14} className="opacity-70" />
            <button onClick={(e) => { e.stopPropagation(); handleClose(); }} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const containerClass = fullscreen
    ? "fixed inset-4 rounded-2xl"
    : "fixed bottom-0 right-6 w-[600px] rounded-t-2xl h-[560px]";

  const isBodyEmpty = !editor || editor.isEmpty;

  return (
    <div className={`${containerClass} shadow-2xl flex flex-col z-50 overflow-hidden border`}
      style={{ backgroundColor: t.bg, borderColor: t.border }}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 text-white rounded-t-2xl flex-shrink-0"
        style={{ backgroundColor: t.titleBar }}>
        <span className="text-sm font-medium truncate max-w-[380px]">{subject || "New Message"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-white/10 rounded-sm" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={() => setFullscreen(v => !v)} className="p-1 hover:bg-white/10 rounded-sm" title="Toggle fullscreen">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-sm" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Header fields */}
      <div className="flex flex-col flex-shrink-0 border-b" style={{ borderColor: t.border }}>
        {/* From field with avatar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b" style={{ borderColor: t.borderLight }}>
          {avatar ? (
            <img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className={`avatar ${avatarColor(authEmail ?? "")} w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0`}>
              {(authName || authEmail)?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <span className="text-xs" style={{ color: t.muted }}>From</span>
          <span className="text-sm truncate" style={{ color: t.text }}>{authName ? `${authName} <${authEmail}>` : authEmail}</span>
        </div>
        {/* To field with autocomplete */}
        <div className="relative">
          <div className="flex items-center gap-0 px-4 border-b" style={{ borderColor: t.borderLight }}>
            <span className="text-xs w-6 flex-shrink-0" style={{ color: t.muted }}>To</span>
            <input
              value={to}
              onChange={e => handleToChange(e.target.value)}
              onFocus={() => {
                if (to.trim()) {
                  const last = to.split(",").pop()?.trim() ?? "";
                  const matches = knownRecipients.current.filter(r => r.includes(last.toLowerCase()));
                  setToSuggestions(matches.slice(0, 6));
                  setShowSuggestions(matches.length > 0);
                }
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Recipients"
              className="flex-1 outline-none text-sm py-2 bg-transparent"
              style={{ color: t.text }}
              autoFocus={!replyTo}
            />
            <div className="flex items-center gap-1 text-xs" style={{ color: t.muted }}>
              {!showCc  && <button onClick={() => setShowCc(true)}  className="px-1 hover:opacity-80">Cc</button>}
              {!showBcc && <button onClick={() => setShowBcc(true)} className="px-1 hover:opacity-80">Bcc</button>}
            </div>
          </div>
          {showSuggestions && toSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full rounded-lg shadow-lg z-20 py-1 max-h-40 overflow-y-auto border"
              style={{ backgroundColor: t.bg, borderColor: t.border }}>
              {toSuggestions.map(email => (
                <button
                  key={email}
                  onMouseDown={() => pickSuggestion(email)}
                  className="w-full text-left px-4 py-2 text-sm hover:opacity-80"
                  style={{ color: t.text }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {email}
                </button>
              ))}
            </div>
          )}
        </div>

        {showCc && (
          <FieldRow label="Cc" borderColor={t.borderLight} mutedColor={t.muted}>
            <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Cc recipients"
              className="flex-1 outline-none text-sm py-2 bg-transparent" style={{ color: t.text }} />
          </FieldRow>
        )}
        {showBcc && (
          <FieldRow label="Bcc" borderColor={t.borderLight} mutedColor={t.muted}>
            <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Bcc recipients"
              className="flex-1 outline-none text-sm py-2 bg-transparent" style={{ color: t.text }} />
          </FieldRow>
        )}
        <FieldRow borderColor={t.borderLight} mutedColor={t.muted}>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
            className="flex-1 outline-none text-sm py-2 font-medium bg-transparent" style={{ color: t.text }} />
        </FieldRow>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b flex-shrink-0 flex-wrap"
        style={{ borderColor: t.borderLight, backgroundColor: t.toolbar }}>
        <ToolbarBtn title="Bold"          active={!!editor?.isActive("bold")}      onClick={() => editor?.chain().focus().toggleBold().run()} isDark={isDark}><Bold size={14} /></ToolbarBtn>
        <ToolbarBtn title="Italic"        active={!!editor?.isActive("italic")}    onClick={() => editor?.chain().focus().toggleItalic().run()} isDark={isDark}><Italic size={14} /></ToolbarBtn>
        <ToolbarBtn title="Underline"     active={!!editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} isDark={isDark}><Underline size={14} /></ToolbarBtn>
        <ToolbarBtn title="Strikethrough" active={!!editor?.isActive("strike")}    onClick={() => editor?.chain().focus().toggleStrike().run()} isDark={isDark}><Strikethrough size={14} /></ToolbarBtn>
        <div className="w-px h-4 mx-1" style={{ backgroundColor: isDark ? "#4b5563" : "#d1d5db" }} />
        <ToolbarBtn title="Heading"       active={!!editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} isDark={isDark}><Heading2 size={14} /></ToolbarBtn>
        <ToolbarBtn title="Bullet list"   active={!!editor?.isActive("bulletList")}  onClick={() => editor?.chain().focus().toggleBulletList().run()} isDark={isDark}><List size={14} /></ToolbarBtn>
        <ToolbarBtn title="Numbered list" active={!!editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} isDark={isDark}><ListOrdered size={14} /></ToolbarBtn>
        <div className="w-px h-4 mx-1" style={{ backgroundColor: isDark ? "#4b5563" : "#d1d5db" }} />
        <ToolbarBtn title="Align left"   active={!!editor?.isActive({ textAlign: "left" })}   onClick={() => editor?.chain().focus().setTextAlign("left").run()} isDark={isDark}><AlignLeft size={14} /></ToolbarBtn>
        <ToolbarBtn title="Align center" active={!!editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} isDark={isDark}><AlignCenter size={14} /></ToolbarBtn>
        <ToolbarBtn title="Align right"  active={!!editor?.isActive({ textAlign: "right" })}  onClick={() => editor?.chain().focus().setTextAlign("right").run()} isDark={isDark}><AlignRight size={14} /></ToolbarBtn>
        <div className="w-px h-4 mx-1" style={{ backgroundColor: isDark ? "#4b5563" : "#d1d5db" }} />
        <ToolbarBtn title="Insert link"       active={!!editor?.isActive("link")} onClick={setLink} isDark={isDark}><Link2 size={14} /></ToolbarBtn>
        <ToolbarBtn title="Undo"              active={false} onClick={() => editor?.chain().focus().undo().run()} isDark={isDark}><Undo2 size={14} /></ToolbarBtn>
        <ToolbarBtn title="Redo"              active={false} onClick={() => editor?.chain().focus().redo().run()} isDark={isDark}><Redo2 size={14} /></ToolbarBtn>
        <ToolbarBtn title="Clear formatting"  active={false} onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} isDark={isDark}><RemoveFormatting size={14} /></ToolbarBtn>
      </div>

      {/* Body */}
      <div
        className={`flex-1 overflow-y-auto px-4 py-3 ${fullscreen ? "min-h-[400px]" : ""}`}
        style={{ color: t.text }}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t flex flex-wrap gap-2 flex-shrink-0" style={{ borderColor: t.borderLight }}>
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs border"
              style={{ backgroundColor: t.attachBg, borderColor: t.attachBorder }}>
              <FileText size={12} className="text-blue-500 flex-shrink-0" />
              <span className="max-w-[120px] truncate" style={{ color: t.text }}>{a.filename}</span>
              <span style={{ color: t.muted }}>{formatBytes(a.size)}</span>
              <button onClick={() => removeAttachment(i)} className="text-gray-400 hover:text-red-500 ml-0.5">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {(attachmentPrep.active || (mutation.isPending && sendUploadProgress !== null)) && (
        <div className="px-4 py-2 border-t flex-shrink-0 space-y-1.5" style={{ borderColor: t.borderLight, backgroundColor: t.attachBg }}>
          {attachmentPrep.active && (
            <>
              <div className="flex items-center justify-between text-xs" style={{ color: t.text }}>
                <span className="truncate pr-2">Preparing attachment: {attachmentPrep.fileName}</span>
                <span>{attachmentPrep.progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-blue-100 overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${attachmentPrep.progress}%` }} />
              </div>
            </>
          )}
          {mutation.isPending && sendUploadProgress !== null && (
            <>
              <div className="flex items-center justify-between text-xs" style={{ color: t.text }}>
                <span>Uploading email payload</span>
                <span>{sendUploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${sendUploadProgress}%` }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center gap-3 flex-shrink-0"
        style={{ borderColor: t.borderLight, backgroundColor: t.toolbar }}>
        <button
          onClick={() => mutation.mutate()}
          disabled={!to.trim() || isBodyEmpty || mutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Send size={15} />
          {mutation.isPending ? "Sending…" : "Send"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors"
          style={{ color: t.muted }}
          title="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={15} />
          <span className="text-xs">Attach</span>
        </button>

        <div className="flex-1" />
        <span className="text-[11px] hidden sm:inline text-right max-w-[260px] leading-4" style={{ color: t.muted }}>
          Sent mails and attachments are saved in your mailbox Sent folder (IMAP).
        </span>
        <button onClick={handleClose} className="btn-ghost p-1.5" style={{ color: t.muted }} title="Discard">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children, borderColor, mutedColor }: { label?: string; children: React.ReactNode; borderColor?: string; mutedColor?: string }) {
  return (
    <div className="flex items-center gap-0 px-4 border-b last:border-b-0" style={{ borderColor: borderColor ?? "#f3f4f6" }}>
      {label && <span className="text-xs w-6 flex-shrink-0" style={{ color: mutedColor ?? "#5f6368" }}>{label}</span>}
      {children}
    </div>
  );
}

function ToolbarBtn({ title, active, onClick, children, isDark }: {
  title: string; active: boolean; onClick: () => void; children: React.ReactNode; isDark?: boolean;
}) {
  return (
    <button
      type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active
          ? (isDark ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-700")
          : (isDark ? "text-gray-400 hover:bg-gray-700 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-700")
      }`}
    >
      {children}
    </button>
  );
}
