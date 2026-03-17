import { format, isToday, isYesterday, isThisYear } from "date-fns";

export function formatMailDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (isToday(d))          return format(d, "h:mm a");
  if (isYesterday(d))      return "Yesterday";
  if (isThisYear(d))       return format(d, "MMM d");
  return format(d, "MM/dd/yy");
}

export function formatFullDate(dateStr: string | Date): string {
  return format(new Date(dateStr), "EEE, MMM d, yyyy 'at' h:mm a");
}

// Deterministic color from string
const AVATAR_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-600",
  "bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-purple-600",
  "bg-pink-600", "bg-rose-500",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function senderInitial(from: string): string {
  // Extract name or email
  const nameMatch = from.match(/^([^<]+)</);
  const name = nameMatch ? nameMatch[1].trim() : from.replace(/<.*>/, "").trim();
  return (name[0] || "?").toUpperCase();
}

export function senderName(from: string): string {
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) return nameMatch[1].trim();
  const emailMatch = from.match(/<(.+)>/);
  if (emailMatch) return emailMatch[1].split("@")[0];
  return from.split("@")[0];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
