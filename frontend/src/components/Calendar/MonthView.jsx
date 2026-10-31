import { addDays, eventHue, monthGrid, overlaps, sameDay } from "./dateUtils";

const MAX_PILLS = 3;
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

const MonthView = ({ cursor, events, onSelectEvent, onSelectDay }) => {
    const days = monthGrid(cursor);
    const today = new Date();

    return (
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-hidden rounded-lg border border-white/10">
            {days.slice(0, 7).map((d) => (
                <div key={d.getDay()} className="border-b border-white/10 px-2 py-1 text-right text-xs text-white/50">
                    {weekdayFormat.format(d)}
                </div>
            ))}
            {days.map((day) => {
                const next = addDays(day, 1);
                const dayEvents = events
                    .filter((e) => overlaps(e, day, next))
                    .sort((a, b) => a.start - b.start);
                const inMonth = day.getMonth() === cursor.getMonth();
                const isToday = sameDay(day, today);
                const hidden = dayEvents.length - MAX_PILLS;

                return (
                    <div
                        key={day.toISOString()}
                        className={`flex min-h-0 flex-col gap-0.5 overflow-hidden border-r border-b border-white/10 p-1 [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-black/15"}`}
                    >
                        <button
                            type="button"
                            onClick={() => onSelectDay(day)}
                            aria-label={day.toDateString()}
                            className={`ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${
                                isToday
                                    ? "bg-[#ff453a] font-semibold text-white hover:bg-[#ff453a]"
                                    : inMonth
                                      ? "text-white"
                                      : "text-white/35"
                            }`}
                        >
                            {day.getDate()}
                        </button>
                        {dayEvents.slice(0, MAX_PILLS).map((e) => (
                            <button
                                key={e.event_id}
                                type="button"
                                onClick={() => onSelectEvent(e)}
                                className="flex min-w-0 items-center gap-1 rounded px-1 text-left text-xs text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                            >
                                <span
                                    aria-hidden="true"
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: `hsl(${eventHue(e)} 70% 55%)` }}
                                />
                                <span className={`truncate ${e.mcv_submitted ? "text-white/50 line-through" : ""}`}>{e.event_name || "(No title)"}</span>
                                <span className="ml-auto hidden shrink-0 text-white/50 lg:inline">
                                    {sameDay(e.start, day) ? timeFormat.format(e.start) : ""}
                                </span>
                            </button>
                        ))}
                        {hidden > 0 && (
                            <button
                                type="button"
                                onClick={() => onSelectDay(day)}
                                className="px-1 text-left text-xs text-white/50 hover:text-white"
                            >
                                {hidden} more
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MonthView;
