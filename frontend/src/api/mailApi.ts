import { apiClient } from "./client.ts";
import type { AxiosProgressEvent } from "axios";
import type { MailFolder, MailHeader, MailMessage, PaginatedMessages } from "../types/index.ts";

export const getFolders = () =>
  apiClient.get<MailFolder[]>("/mail/folders").then(r => r.data);

export const getMessages = (folder: string, page: number, limit = 50) =>
  apiClient.get<PaginatedMessages>("/mail/messages", { params: { folder, page, limit } }).then(r => r.data);

export const getMessage = (uid: number, folder: string) =>
  apiClient.get<MailMessage>(`/mail/messages/${uid}`, { params: { folder } }).then(r => r.data);

export const downloadAttachment = (uid: number, folder: string, index: number) =>
  apiClient.get(`/mail/messages/${uid}/attachments/${index}/download`, {
    params: { folder },
    responseType: "blob",
  }).then(r => ({
    blob: r.data as Blob,
    contentType: (r.headers["content-type"] as string | undefined) ?? "application/octet-stream",
  }));

export const openAttachmentOnline = (uid: number, folder: string, index: number) =>
  apiClient.post<{ ok: true; redirect: string; targetPath: string; filename: string }>(
    `/mail/messages/${uid}/attachments/${index}/edit-online`,
    { folder }
  ).then(r => r.data);

export const sendMail = (payload: {
  to: string; cc?: string; bcc?: string; subject: string; html?: string; text?: string;
  fromName?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}, onUploadProgress?: (event: AxiosProgressEvent) => void) =>
  apiClient.post("/mail/send", payload, { onUploadProgress }).then(r => r.data);

export const saveAttachmentToFiles = (uid: number, folder: string, index: number) =>
  apiClient.post<{ ok: true; path: string }>(
    `/mail/messages/${uid}/attachments/${index}/save-to-files`,
    { folder }
  ).then(r => r.data);

export const getContactSuggestions = (q: string) =>
  apiClient.get<Array<{ name: string; address: string }>>("/mail/contacts/suggestions", { params: { q } }).then(r => r.data);

export const moveMessage = (uid: number, folder: string, destination: string) =>
  apiClient.post(`/mail/messages/${uid}/move`, { folder, destination }).then(r => r.data);

export const deleteMessage = (uid: number, folder: string) =>
  apiClient.delete(`/mail/messages/${uid}`, { params: { folder } }).then(r => r.data);

export const permanentDeleteMessage = (uid: number, folder: string) =>
  apiClient.delete(`/mail/messages/${uid}/permanent`, { params: { folder } }).then(r => r.data);

export const flagMessage = (uid: number, folder: string, flag: string, add: boolean) =>
  apiClient.post(`/mail/messages/${uid}/flag`, { folder, flag, add }).then(r => r.data);

// Download a JSON backup of all mailbox emails
export const downloadBackup = async (): Promise<void> => {
  const res = await apiClient.get("/mail/backup", { responseType: "blob" });
  const cd = res.headers["content-disposition"] as string | undefined;
  const match = cd?.match(/filename="(.+?)"/);
  const filename = match?.[1] ?? "mailbackup.json";
  const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};

// Stream-restore backup — calls onProgress(done, total) and returns { imported, skipped }
export const restoreBackup = (
  backupJson: object,
  onProgress: (done: number, total: number) => void
): Promise<{ imported: number; skipped: number }> => {
  return new Promise((resolve, reject) => {
    // Use fetch directly for SSE streaming
    const token = (apiClient.defaults.headers.common["Authorization"] as string | undefined)?.replace("Bearer ", "") ?? "";
    fetch("/api/mail/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(backupJson),
    }).then(res => {
      if (!res.ok || !res.body) { reject(new Error("Restore failed")); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const pump = (): void => {
        reader.read().then(({ done, value }) => {
          if (done) { resolve({ imported: 0, skipped: 0 }); return; }
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6)) as { type: string; done?: number; total?: number; imported?: number; skipped?: number };
              if (ev.type === "progress" && ev.done !== undefined && ev.total !== undefined) {
                onProgress(ev.done, ev.total);
              } else if (ev.type === "done") {
                resolve({ imported: ev.imported ?? 0, skipped: ev.skipped ?? 0 });
                return;
              }
            } catch { /* ignore malformed lines */ }
          }
          pump();
        }).catch(reject);
      };
      pump();
    }).catch(reject);
  });
};
