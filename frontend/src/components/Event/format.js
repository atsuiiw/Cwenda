import { addDays, sameDay } from "../Calendar/dateUtils";

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// "Today" / "Tomorrow" / "Yesterday" / "Mon, Nov 2" for a day header.
export const dayLabel = (day, today) => {
    if (sameDay(day, today)) return "Today";
    if (sameDay(day, addDays(today, 1))) return "Tomorrow";
    if (sameDay(day, addDays(today, -1))) return "Yesterday";
    return dayFormat.format(day);
};

// "9:00 – 10:00 AM", or with dates when the event spans days.
export const timeLabel = (e) =>
    sameDay(e.start, e.end) ? timeFormat.formatRange(e.start, e.end) : dateTimeFormat.formatRange(e.start, e.end);
