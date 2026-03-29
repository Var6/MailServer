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
  const canonical = FOLDER_ALIASES[normalize(folder)] ?? folder;
  return canonical.toLowerCase().replace(/[\s/]+/g, "-");
}

export function slugToFolder(slug?: string): string {
  if (!slug) return DEFAULT_FOLDER;
  const key = normalize(decodeURIComponent(slug));
  return FOLDER_ALIASES[key] ?? decodeURIComponent(slug);
}

export function getDefaultMailRoute(): string {
  return `/mail/${folderToSlug(DEFAULT_FOLDER)}`;
}
