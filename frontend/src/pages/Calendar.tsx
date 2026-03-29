import axios from "axios";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventApi, DateSelectArg, EventClickArg } from "@fullcalendar/core";
import { Users, User, Plus, Trash2, X, Video, Bell } from "lucide-react";
import { getSharedEvents, createSharedEvent, deleteSharedEvent, type SharedEvent } from "../api/sharedCalendarApi.ts";
import { useToastStore, useAuthStore } from "../store/index.ts";

const FC_STYLES = `
  .fc { font-family: 'Inter', sans-serif; }
  .fc-toolbar-title { font-size: 1.1rem !important; font-weight: 600 !important; color: #202124 !important; }
  .fc-button { background: white !important; border: 1px solid #dadce0 !important; color: #444746 !important;
               border-radius: 20px !important; font-size: 13px !important; font-weight: 500 !important; }
  .fc-button:hover { background: #f1f3f4 !important; }
  .fc-button-active { background: #e8f0fe !important; color: #1a73e8 !important; border-color: #1a73e8 !important; }
  .fc-today-button { background: white !important; border: 1px solid #dadce0 !important; }
  .fc-daygrid-day-number { color: #202124 !important; font-size: 12px !important; }
  .fc-col-header-cell-cushion { color: #5f6368 !important; font-size: 11px !important; font-weight: 500 !important; text-transform: uppercase !important; }
  .fc-daygrid-day.fc-day-today { background: #e8f0fe !important; }
  .fc-event { border: none !important; border-radius: 4px !important; font-size: 12px !important; }
`;

export default function CalendarPage() {
  const [tab, setTab] = useState<"personal" | "team">("personal");

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b border-gray-100">
        {([
          { key: "personal", label: "My Calendar", icon: User },
          { key: "team",     label: "Team Calendar", icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-[#5f6368] hover:text-[#202124]"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "personal" ? <PersonalCalendar /> : <TeamCalendar />}
      </div>
    </div>
  );
}

// ── Personal Calendar ──────────────────────────────────────────────────────
function PersonalCalendar() {
  const calRef = useRef<FullCalendar>(null);

  return (
    <div className="h-full p-4 overflow-auto">
      <style>{FC_STYLES}</style>
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        editable selectable height="100%"
        eventClick={(info: EventClickArg) => alert(`Event: ${info.event.title}`)}
        select={(info: DateSelectArg) => {
          const title = prompt("New event title:");
          if (title) info.view.calendar.addEvent({ title, start: info.start, end: info.end, backgroundColor: "#1a73e8" });
        }}
      />
    </div>
  );
}

// ── Team Calendar ──────────────────────────────────────────────────────────
function TeamCalendar() {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const { email: selfEmail, role } = useAuthStore();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<SharedEvent | null>(null);
  const reminderTimers = useRef<number[]>([]);

  const { data: events = [] } = useQuery({
    queryKey: ["shared-events"],
    queryFn: () => getSharedEvents(),
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSharedEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shared-events"] });
      setSelected(null);
      addToast("Event removed", "info");
    },
    onError: (e: unknown) => addToast(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : "Failed to delete event"), "error"),
  });

  const fcEvents = events.map(e => ({
    id: e._id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: e.color || "#0b8043",
    extendedProps: { raw: e },
  }));

  const canDelete = (e: SharedEvent) =>
    e.createdBy === selfEmail || role === "admin" || role === "superadmin";

  useEffect(() => {
    reminderTimers.current.forEach((id) => window.clearTimeout(id));
    reminderTimers.current = [];

    if (typeof window === "undefined") return;

    for (const event of events) {
      const reminderMinutes = event.reminderMinutesBefore ?? 0;
      if (reminderMinutes <= 0) continue;

      const startMs = new Date(event.start).getTime();
      const reminderAt = startMs - reminderMinutes * 60_000;
      const delay = reminderAt - Date.now();

      if (delay <= 0 || delay > 24 * 60 * 60_000) continue;

      const id = window.setTimeout(() => {
        addToast(`Reminder: ${event.title} starts in ${reminderMinutes} min`, "info");
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Meeting Reminder", {
            body: `${event.title} starts in ${reminderMinutes} minutes`,
          });
        }
      }, delay);
      reminderTimers.current.push(id);
    }

    return () => {
      reminderTimers.current.forEach((id) => window.clearTimeout(id));
      reminderTimers.current = [];
    };
  }, [events, addToast]);

  return (
    <div className="h-full flex flex-col p-4">
      <style>{FC_STYLES}</style>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#5f6368]">Shared with everyone in your company</p>
        <button
          onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
        >
          <Plus size={13} /> Add Event
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
          events={fcEvents}
          height="100%"
          eventClick={(info: EventClickArg) => setSelected(info.event.extendedProps.raw as SharedEvent)}
        />
      </div>

      {/* Event detail popover */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 w-80 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-[#202124]">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <p className="text-xs text-[#5f6368] mb-1">
              {new Date(selected.start).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric" })}
              {!selected.allDay && ` · ${new Date(selected.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </p>
            {selected.description && <p className="text-sm text-[#202124] mt-2">{selected.description}</p>}
            {selected.meetingLink && (
              <a
                href={selected.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800"
              >
                <Video size={13} /> Join free meeting room
              </a>
            )}
            {(selected.reminderMinutesBefore ?? 0) > 0 && (
              <p className="text-xs text-[#5f6368] mt-2 flex items-center gap-1">
                <Bell size={12} /> Reminder: {selected.reminderMinutesBefore} minutes before
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Added by {selected.createdBy}</p>
            {canDelete(selected) && (
              <button
                onClick={() => deleteMutation.mutate(selected._id)}
                disabled={deleteMutation.isPending}
                className="mt-3 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
              >
                <Trash2 size={13} /> {deleteMutation.isPending ? "Removing…" : "Remove event"}
              </button>
            )}
          </div>
        </div>
      )}

      {creating && <CreateEventModal onClose={() => setCreating(false)} />}
    </div>
  );
}

// ── Create Event Modal ─────────────────────────────────────────────────────
function CreateEventModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const today = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    title: "", start: today, end: today,
    allDay: false, description: "", color: "#0b8043",
    meetingLink: "",
    reminderMinutesBefore: "15",
  });

  const ensureNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  };

  const createJitsiLink = () => {
    const slugBase = (form.title || "team-meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const stamp = Date.now().toString(36);
    set("meetingLink", `https://meet.jit.si/${slugBase || "meeting"}-${stamp}`);
  };

  const mutation = useMutation({
    mutationFn: createSharedEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shared-events"] });
      addToast("Event added to team calendar", "success");
      onClose();
    },
    onError: (e: unknown) => addToast(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : "Failed to create event"), "error"),
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#202124]">New Team Event</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            void ensureNotificationPermission();
            mutation.mutate({
              title: form.title,
              start: form.start,
              end: form.end,
              allDay: form.allDay,
              description: form.description || undefined,
              color: form.color,
              meetingLink: form.meetingLink || undefined,
              reminderMinutesBefore: parseInt(form.reminderMinutesBefore, 10) || 0,
            });
          }}
          className="p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#5f6368]">Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} required className="field-input" placeholder="Team meeting, Holiday…" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="allday" checked={form.allDay} onChange={e => set("allDay", e.target.checked)} className="rounded" />
            <label htmlFor="allday" className="text-sm text-[#202124]">All day</label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#5f6368]">Start</label>
              <input value={form.start} onChange={e => set("start", e.target.value)} type={form.allDay ? "date" : "datetime-local"} required className="field-input" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#5f6368]">End</label>
              <input value={form.end} onChange={e => set("end", e.target.value)} type={form.allDay ? "date" : "datetime-local"} required className="field-input" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#5f6368]">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="field-input resize-none" placeholder="Optional details…" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#5f6368]">Meeting link (free alternative to Google Meet)</label>
            <div className="flex gap-2">
              <input
                value={form.meetingLink}
                onChange={e => set("meetingLink", e.target.value)}
                className="field-input"
                placeholder="https://meet.jit.si/..."
              />
              <button type="button" onClick={createJitsiLink} className="btn-ghost whitespace-nowrap">Generate</button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#5f6368]">Reminder</label>
            <select
              value={form.reminderMinutesBefore}
              onChange={e => set("reminderMinutesBefore", e.target.value)}
              className="field-input"
            >
              <option value="0">No reminder</option>
              <option value="5">5 minutes before</option>
              <option value="10">10 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#5f6368]">Color</label>
            <input type="color" value={form.color} onChange={e => set("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Adding…" : "Add to Team Calendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
