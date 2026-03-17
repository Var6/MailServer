import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "../../store/index.ts";

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
};
const COLORS = {
  success: "bg-green-600",
  error:   "bg-red-600",
  info:    "bg-[#202124]",
};

export default function Toast() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[100] pointer-events-none">
      {toasts.map(t => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-white text-sm
                        shadow-lg pointer-events-auto min-w-[280px] max-w-[400px] animate-in
                        slide-in-from-bottom-4 duration-200 ${COLORS[t.type]}`}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
