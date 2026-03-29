import { apiClient } from "./client.ts";

export interface SharedEvent {
  _id: string;
  tenantDomain: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  color?: string;
  meetingLink?: string;
  reminderMinutesBefore?: number;
  createdBy: string;
  createdAt: string;
}

export const getSharedEvents = (start?: string, end?: string) =>
  apiClient.get<SharedEvent[]>("/calendar/shared", { params: { start, end } }).then(r => r.data);

export const createSharedEvent = (payload: {
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  description?: string;
  color?: string;
  meetingLink?: string;
  reminderMinutesBefore?: number;
}) => apiClient.post<SharedEvent>("/calendar/shared", payload).then(r => r.data);

export const deleteSharedEvent = (id: string) =>
  apiClient.delete(`/calendar/shared/${id}`).then(r => r.data);
