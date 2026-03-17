import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Minimize2, Maximize2, Send } from "lucide-react";
import { useMailStore } from "../../store/index.ts";
import { sendMail } from "../../api/mailApi.ts";

export default function ComposeModal() {
  const { closeCompose, replyTo } = useMailStore();
  const qc = useQueryClient();

  const [to, setTo]           = useState(replyTo?.from ?? "");
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : "");
  const [body, setBody]       = useState("");
  const [minimized, setMinimized] = useState(false);

  const mutation = useMutation({
    mutationFn: () => sendMail({ to, subject, html: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      closeCompose();
    },
  });

  if (minimized) {
    return (
      <div
        className="fixed bottom-0 right-4 w-72 bg-white border border-gray-300 rounded-t-lg shadow-lg cursor-pointer"
        onClick={() => setMinimized(false)}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 text-white rounded-t-lg">
          <span className="text-sm font-medium truncate">New Message</span>
          <Maximize2 size={14} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-4 w-[540px] bg-white border border-gray-300 rounded-t-lg shadow-2xl flex flex-col z-50">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 text-white rounded-t-lg">
        <span className="text-sm font-medium">New Message</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setMinimized(true)} className="hover:bg-gray-700 p-1 rounded">
            <Minimize2 size={14} />
          </button>
          <button onClick={closeCompose} className="hover:bg-gray-700 p-1 rounded">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="border-b border-gray-200 px-3 py-1.5">
        <input
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="To"
          className="w-full text-sm outline-none py-1"
        />
      </div>
      <div className="border-b border-gray-200 px-3 py-1.5">
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full text-sm outline-none py-1"
        />
      </div>

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your message..."
        className="flex-1 px-3 py-2 text-sm outline-none resize-none min-h-[200px]"
      />

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={() => mutation.mutate()}
          disabled={!to || mutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
        >
          <Send size={14} />
          {mutation.isPending ? "Sending..." : "Send"}
        </button>
        {mutation.isError && <span className="text-xs text-red-500">Send failed</span>}
      </div>
    </div>
  );
}
