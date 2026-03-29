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
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}, onUploadProgress?: (event: AxiosProgressEvent) => void) =>
  apiClient.post("/mail/send", payload, { onUploadProgress }).then(r => r.data);

export const moveMessage = (uid: number, folder: string, destination: string) =>
  apiClient.post(`/mail/messages/${uid}/move`, { folder, destination }).then(r => r.data);

export const deleteMessage = (uid: number, folder: string) =>
  apiClient.delete(`/mail/messages/${uid}`, { params: { folder } }).then(r => r.data);

export const permanentDeleteMessage = (uid: number, folder: string) =>
  apiClient.delete(`/mail/messages/${uid}/permanent`, { params: { folder } }).then(r => r.data);

export const flagMessage = (uid: number, folder: string, flag: string, add: boolean) =>
  apiClient.post(`/mail/messages/${uid}/flag`, { folder, flag, add }).then(r => r.data);
