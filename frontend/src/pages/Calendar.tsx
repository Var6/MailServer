import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarPage() {
  return (
    <div className="h-full bg-white p-4 overflow-auto">
      <style>{`
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
        .fc-event { background: #1a73e8 !important; border: none !important; border-radius: 4px !important; font-size: 12px !important; }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left:   "prev,next today",
          center: "title",
          right:  "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        editable
        selectable
        height="100%"
        eventClick={info => alert(`Event: ${info.event.title}`)}
        select={info => {
          const title = prompt("New event title:");
          if (title) info.view.calendar.addEvent({ title, start: info.start, end: info.end });
        }}
      />
    </div>
  );
}
