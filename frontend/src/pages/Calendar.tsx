import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarPage() {
  return (
    <div className="h-full bg-white p-4 overflow-auto">
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
        dateClick={info => alert(`Date: ${info.dateStr}`)}
      />
    </div>
  );
}
