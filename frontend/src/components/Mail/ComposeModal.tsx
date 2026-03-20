import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Minimize2, Maximize2, Send, Paperclip, Minus,
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link2, Heading2, Undo2, Redo2, RemoveFormatting,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExt from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useMailStore, useToastStore } from "../../store/index.ts";
import { sendMail } from "../../api/mailApi.ts";

export default function ComposeModal() {
  const { closeCompose, replyTo } = useMailStore();
  const { addToast } = useToastStore();
  const qc = useQueryClient();

  const [to, setTo]           = useState(replyTo?.from ?? "");
  const [cc, setCc]           = useState("");
  const [bcc, setBcc]         = useState("");
  const [subject, setSubject] = useState(
    replyTo
      ? (replyTo.type === "reply" ? `Re: ${replyTo.subject}` : `Fwd: ${replyTo.subject}`)
      : ""
  );
  const [showCc, setShowCc]   = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

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
        class: "outline-none min-h-[180px] text-sm text-[#202124] leading-relaxed prose prose-sm max-w-none",
      },
    },
    autofocus: !!replyTo,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const html = editor?.getHTML() ?? "";
      const text = editor?.getText() ?? "";
      return sendMail({
        to,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        html: `<div style="font-family:Inter,sans-serif;font-size:14px;line-height:1.6;">${html}</div>`,
        text,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      addToast("Message sent!", "success");
      closeCompose();
    },
    onError: () => addToast("Failed to send message. Please try again.", "error"),
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

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
            <button onClick={(e) => { e.stopPropagation(); closeCompose(); }} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const containerClass = fullscreen
    ? "fixed inset-4 rounded-2xl"
    : "fixed bottom-0 right-6 w-[600px] rounded-t-2xl";

  const isBodyEmpty = !editor || editor.isEmpty;

  return (
    <div
      className={`${containerClass} bg-white shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200`}
      style={{ maxHeight: fullscreen ? undefined : "calc(100vh - 80px)" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#404040] text-white rounded-t-2xl flex-shrink-0">
        <span className="text-sm font-medium truncate max-w-[380px]">{subject || "New Message"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-white/10 rounded-sm" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={() => setFullscreen(v => !v)} className="p-1 hover:bg-white/10 rounded-sm" title="Toggle fullscreen">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={closeCompose} className="p-1 hover:bg-white/10 rounded-sm" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Header fields */}
      <div className="flex flex-col flex-shrink-0 border-b border-gray-200">
        <FieldRow label="To">
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="Recipients"
            className="flex-1 outline-none text-sm py-2 text-[#202124] placeholder-[#5f6368]"
            autoFocus={!replyTo}
          />
          <div className="flex items-center gap-1 text-xs text-[#5f6368]">
            {!showCc  && <button onClick={() => setShowCc(true)}  className="hover:text-[#202124] px-1">Cc</button>}
            {!showBcc && <button onClick={() => setShowBcc(true)} className="hover:text-[#202124] px-1">Bcc</button>}
          </div>
        </FieldRow>
        {showCc && (
          <FieldRow label="Cc">
            <input value={cc} onChange={e => setCc(e.target.value)} placeholder="Cc recipients"
              className="flex-1 outline-none text-sm py-2 placeholder-[#5f6368]" />
          </FieldRow>
        )}
        {showBcc && (
          <FieldRow label="Bcc">
            <input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Bcc recipients"
              className="flex-1 outline-none text-sm py-2 placeholder-[#5f6368]" />
          </FieldRow>
        )}
        <FieldRow>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 outline-none text-sm py-2 placeholder-[#5f6368] font-medium"
          />
        </FieldRow>
      </div>

      {/* Formatting toolbar */}
      {editor && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-100 flex-shrink-0 flex-wrap bg-gray-50">
          <ToolbarBtn title="Bold" active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Italic" active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Underline" active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <Underline size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Strikethrough" active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough size={14} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn title="Heading" active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={14} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn title="Align left" active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Align center" active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Align right" active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight size={14} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn title="Insert link" active={editor.isActive("link")} onClick={setLink}>
            <Link2 size={14} />
          </ToolbarBtn>

          <div className="w-px h-4 bg-gray-300 mx-1" />

          <ToolbarBtn title="Undo" active={false} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Redo" active={false} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 size={14} />
          </ToolbarBtn>
          <ToolbarBtn title="Clear formatting" active={false}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
            <RemoveFormatting size={14} />
          </ToolbarBtn>
        </div>
      )}

      {/* Body — Tiptap editor */}
      <div
        className={`flex-1 overflow-y-auto px-4 py-3 ${fullscreen ? "min-h-[400px]" : ""}`}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => mutation.mutate()}
          disabled={!to.trim() || isBodyEmpty || mutation.isPending}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Send size={14} />
          {mutation.isPending ? "Sending…" : "Send"}
        </button>

        <button className="btn-ghost p-1.5" title="Attach file">
          <Paperclip size={15} />
        </button>

        <div className="flex-1" />

        <button onClick={closeCompose} className="btn-ghost text-gray-400 p-1.5" title="Discard">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0 px-4 border-b border-gray-100 last:border-b-0">
      {label && <span className="text-xs text-[#5f6368] w-6 flex-shrink-0">{label}</span>}
      {children}
    </div>
  );
}

function ToolbarBtn({
  title, active, onClick, children,
}: {
  title: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
