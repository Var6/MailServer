import { useUiThemeStore } from "../../store/index.ts";

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

function useIsDark() {
  const appBg = useUiThemeStore((s) => s.appBg);
  const found = BG_THEMES.find(t => t.bg === appBg);
  return DARK_TEXT_COLORS.includes(found?.text || "#1f2937");
}

export function MailListSkeleton() {
  const isDark = useIsDark();
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: isDark ? "#374151" : "#f3f4f6", backgroundColor: isDark ? "#1f2937" : "white" }}
        >
          <div className="animate-pulse rounded-full w-9 h-9 flex-shrink-0" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
          <div className="flex-1 space-y-2">
            <div className="animate-pulse h-3 w-1/3 rounded" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
            <div className="animate-pulse h-3 w-2/3 rounded" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
            <div className="animate-pulse h-3 w-1/2 rounded" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
          </div>
          <div className="animate-pulse h-3 w-10 rounded" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
        </div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  const isDark = useIsDark();
  const bg = isDark ? "#374151" : "#e5e7eb";
  return (
    <div className="p-6 space-y-4">
      <div className="animate-pulse h-7 w-3/4 rounded" style={{ backgroundColor: bg }} />
      <div className="flex items-center gap-3">
        <div className="animate-pulse w-10 h-10 rounded-full" style={{ backgroundColor: bg }} />
        <div className="space-y-2 flex-1">
          <div className="animate-pulse h-3 w-1/4 rounded" style={{ backgroundColor: bg }} />
          <div className="animate-pulse h-3 w-1/3 rounded" style={{ backgroundColor: bg }} />
        </div>
      </div>
      <div className="space-y-2 pt-4">
        {[80, 90, 70, 85, 60].map((w, i) => (
          <div key={i} className="animate-pulse h-3 rounded" style={{ width: `${w}%`, backgroundColor: bg }} />
        ))}
      </div>
    </div>
  );
}
