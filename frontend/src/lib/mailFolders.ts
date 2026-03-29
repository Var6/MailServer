const DEFAULT_FOLDER = "INBOX";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

const FOLDER_ALIASES: Record<string, string> = {
  inbox: "INBOX",
  sent: "Sent",
  "sent-items": "Sent",
  "sent-mail": "Sent",
  drafts: "Drafts",
  draft: "Drafts",
  junk: "Junk",
  spam: "Junk",
  trash: "Trash",
  bin: "Trash",
  archive: "Archive",
};

export function folderToSlug(folder: string): string {
  return encodeURIComponent(folder);
}

export function slugToFolder(slug?: string): string {
  if (!slug) return DEFAULT_FOLDER;
  const decoded = decodeURIComponent(slug);
  const key = normalize(decoded);
  return FOLDER_ALIASES[key] ?? decoded;
}

export function getDefaultMailRoute(): string {
  return `/mail/${folderToSlug(DEFAULT_FOLDER)}`;
}
