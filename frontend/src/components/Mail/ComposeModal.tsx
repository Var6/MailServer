import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Minimize2, Maximize2, Send, Paperclip, Bold, Italic, Link2, Minus } from "lucide-react";
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
  const [body, setBody]       = useState("");
  const [showCc, setShowCc]   = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => sendMail({
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">${body.replace(/\n/g, "<br/>")}</div>`,
      text: body,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      addToast("Message sent!", "success");
      closeCompose();
    },
    onError: () => addToast("Failed to send message. Please try again.", "error"),
  });

  if (minimized) {
    return (
      <div
        className="fixed bottom-0 right-6 w-72 bg-[#404040] text-white rounded-t-xl
                   shadow-2xl cursor-pointer z-50"
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
    : "fixed bottom-0 right-6 w-[560px] rounded-t-2xl";

  return (
    <div className={`${containerClass} bg-white shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-200`}
         style={{ maxHeight: fullscreen ? undefined : "calc(100vh - 80px)" }}>

      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#404040] text-white rounded-t-2xl flex-shrink-0">
        <span className="text-sm font-medium truncate max-w-[300px]">{subject || "New Message"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 hover:bg-white/10 rounded-sm" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={() => setFullscreen(v => !v)} className="p-1 hover:bg-white/10 rounded-sm" title="Fullscreen">
            <Maximize2 size={14} />
          </button>
          <button onClick={closeCompose} className="p-1 hover:bg-white/10 rounded-sm" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
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

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your message here..."
        className={`flex-1 px-4 py-3 text-sm text-[#202124] outline-none resize-none
                    placeholder-[#5f6368] leading-relaxed ${fullscreen ? "min-h-[400px]" : "min-h-[220px]"}`}
        autoFocus={!!replyTo}
      />

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => mutation.mutate()}
          disabled={!to.trim() || mutation.isPending}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Send size={14} />
          {mutation.isPending ? "Sending…" : "Send"}
        </button>

        {/* Formatting hints */}
        <div className="flex items-center gap-0.5 border-l border-gray-200 ml-1 pl-2">
          <button className="btn-ghost p-1.5" title="Bold"><Bold size={15} /></button>
          <button className="btn-ghost p-1.5" title="Italic"><Italic size={15} /></button>
          <button className="btn-ghost p-1.5" title="Link"><Link2 size={15} /></button>
          <button className="btn-ghost p-1.5" title="Attach"><Paperclip size={15} /></button>
        </div>

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
