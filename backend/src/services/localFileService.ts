import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { config } from "../config/index.js";

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  contentType: string;
  size: number;
  modified: string;
}

function sanitizeUserSegment(email: string): string {
  return email.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveUserPath(email: string, virtualPath: string): string {
  const root = path.resolve(config.LOCAL_FILES_ROOT);
  const userRoot = path.resolve(root, sanitizeUserSegment(email));
  const raw = virtualPath || "/";
  const normalized = path.posix.normalize(raw.startsWith("/") ? raw : `/${raw}`);
  if (normalized.includes("..")) throw new Error("Invalid path");
  const fullPath = path.resolve(userRoot, normalized.replace(/^\//, ""));
  if (!fullPath.startsWith(userRoot)) throw new Error("Path traversal denied");
  return fullPath;
}

export function userRootPath(email: string): string {
  return path.resolve(config.LOCAL_FILES_ROOT, sanitizeUserSegment(email));
}

export async function listLocalFiles(email: string, virtualPath = "/"): Promise<FileEntry[]> {
  const dirPath = resolveUserPath(email, virtualPath);
  await fs.mkdir(dirPath, { recursive: true });
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  const results = await Promise.all(
    items
      .filter(e => e.name !== ".keep")
      .map(async (entry) => {
        const stat = await fs.stat(path.resolve(dirPath, entry.name));
        const isDirectory = entry.isDirectory();
        return {
          name: entry.name,
          isDirectory,
          contentType: isDirectory ? "" : guessContentType(entry.name),
          size: isDirectory ? 0 : stat.size,
          modified: stat.mtime.toISOString(),
        } satisfies FileEntry;
      })
  );
  return results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function uploadLocalFile(email: string, virtualPath: string, content: Buffer): Promise<void> {
  const filePath = resolveUserPath(email, virtualPath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

export function streamLocalFile(email: string, virtualPath: string): Readable {
  const filePath = resolveUserPath(email, virtualPath);
  return createReadStream(filePath);
}

export async function statLocalFile(email: string, virtualPath: string) {
  return fs.stat(resolveUserPath(email, virtualPath));
}

export async function deleteLocalFile(email: string, virtualPath: string): Promise<void> {
  const filePath = resolveUserPath(email, virtualPath);
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    await fs.rm(filePath, { recursive: true, force: true });
  } else {
    await fs.unlink(filePath);
  }
}

export async function mkdirLocal(email: string, virtualPath: string): Promise<void> {
  await fs.mkdir(resolveUserPath(email, virtualPath), { recursive: true });
}

export async function renameLocal(email: string, oldVPath: string, newVPath: string): Promise<void> {
  const src = resolveUserPath(email, oldVPath);
  const dst = resolveUserPath(email, newVPath);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.rename(src, dst);
}

function guessContentType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm",
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav",
    txt: "text/plain", md: "text/markdown", csv: "text/csv",
    html: "text/html", htm: "text/html", json: "application/json",
    xml: "application/xml", zip: "application/zip",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword", xls: "application/vnd.ms-excel",
    ppt: "application/vnd.ms-powerpoint",
  };
  return map[ext] ?? "application/octet-stream";
}
