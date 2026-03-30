import { useIsDark } from "../../lib/themes.ts";

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
