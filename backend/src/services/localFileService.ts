import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  contentType: string;
  size: number;
}

function sanitizeUserSegment(email: string): string {
  return email.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeVirtualPath(virtualPath: string): string {
  const raw = virtualPath || "/";
  const normalized = path.posix.normalize(raw.startsWith("/") ? raw : `/${raw}`);
  if (normalized.includes("..")) {
    throw new Error("Invalid path");
  }
  return normalized;
}

function resolveUserPath(email: string, virtualPath: string): string {
  const root = path.resolve(config.LOCAL_FILES_ROOT);
  const userRoot = path.resolve(root, sanitizeUserSegment(email));
  const normalized = normalizeVirtualPath(virtualPath);
  const relative = normalized.replace(/^\//, "");
  const fullPath = path.resolve(userRoot, relative);

  if (!fullPath.startsWith(userRoot)) {
    throw new Error("Invalid path traversal");
  }

  return fullPath;
}

export function localStorageLocation(email: string): string {
  const root = path.resolve(config.LOCAL_FILES_ROOT);
  return path.resolve(root, sanitizeUserSegment(email));
}

export async function listLocalFiles(email: string, virtualPath = "/"): Promise<FileEntry[]> {
  const dirPath = resolveUserPath(email, virtualPath);
  await fs.mkdir(dirPath, { recursive: true });

  const items = await fs.readdir(dirPath, { withFileTypes: true });
  const results = await Promise.all(items.map(async (entry: { name: string; isDirectory: () => boolean }) => {
    const full = path.resolve(dirPath, entry.name);
    const stat = await fs.stat(full);
    const isDirectory = entry.isDirectory();
    const contentType = isDirectory ? "" : "application/octet-stream";

    return {
      name: entry.name,
      isDirectory,
      contentType,
      size: isDirectory ? 0 : stat.size,
    } satisfies FileEntry;
  }));

  return results.sort((a: FileEntry, b: FileEntry) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function uploadLocalFile(
  email: string,
  virtualPath: string,
  content: Buffer
): Promise<void> {
  const filePath = resolveUserPath(email, virtualPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}
