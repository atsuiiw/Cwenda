import { useEffect, useRef, useState } from "react";
import { addDays, eventHue, layoutDay, minutesInDay, overlaps, sameDay } from "./dateUtils";

const HOUR = 48; // px per hour
const PX_PER_MIN = HOUR / 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const hourLines = {
    backgroundImage: `repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.1) 0 1px, transparent 1px ${HOUR}px)`,
};

// Shared by Week (7 days) and Day (1 day) views.
const TimeGrid = ({ days, events, onSelectEvent, scrollToHour = 8 }) => {
    const scrollRef = useRef(null);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    // Open scrolled to ~8 AM by default, like Apple Calendar.
    useEffect(() => {
        scrollRef.current.scrollTop = Math.max(0, scrollToHour * HOUR - 8);
    }, [scrollToHour]);

    // Events lasting a day or more go in the all-day strip; shorter ones are clipped per day.
    const allDay = events.filter((e) => e.end - e.start >= DAY_MS);
    const timed = events.filter((e) => e.end - e.start < DAY_MS);
    const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

    const pill = (e) => (
        <button
            key={e.event_id}
            type="button"
            onClick={() => onSelectEvent(e)}
            className="truncate rounded px-1.5 text-left text-xs text-white focus-visible:outline-2 focus-visible:outline-white"
            style={{ background: `hsl(${eventHue(e)} 70% 50% / 0.45)` }}
        >
            {e.event_name || "(No title)"}
        </button>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10">
            <div className="grid border-b border-white/10" style={columns}>
                <div />
                {days.map((day) => (
                    <div key={day.toISOString()} className="flex items-center justify-center gap-1.5 py-2 text-sm text-white/70">
                        {weekdayFormat.format(day)}
                        <span
                            className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-base ${
                                sameDay(day, now) ? "bg-[#ff453a] font-semibold text-white" : "text-white"
                            }`}
                        >
                            {day.getDate()}
                        </span>
                    </div>
                ))}
            </div>

            {allDay.length > 0 && (
                <div className="grid border-b border-white/10" style={columns}>
                    <div className="py-1 pr-2 text-right text-[10px] text-white/50">all-day</div>
                    {days.map((day) => (
                        <div key={day.toISOString()} className="flex min-w-0 flex-col gap-0.5 border-l border-white/10 p-0.5">
                            {allDay.filter((e) => overlaps(e, day, addDays(day, 1))).map(pill)}
                        </div>
                    ))}
                </div>
            )}

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid" style={columns}>
                    <div className="relative" style={{ height: 24 * HOUR }}>
                        {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                            <span
                                key={h}
                                className="absolute right-2 -translate-y-1/2 text-[10px] text-white/50"
                                style={{ top: h * HOUR }}
                            >
                                {hourFormat.format(new Date(2000, 0, 1, h))}
                            </span>
                        ))}
                    </div>

                    {days.map((day) => {
                        const next = addDays(day, 1);
                        const segs = layoutDay(
                            timed
                                .filter((e) => overlaps(e, day, next))
                                .map((e) => ({
                                    event: e,
                                    start: new Date(Math.max(e.start, day)),
                                    end: new Date(Math.min(e.end, next)),
                                })),
                        );

                        return (
                            <div
                                key={day.toISOString()}
                                className="relative border-l border-white/10"
                                style={{ height: 24 * HOUR, ...hourLines }}
                            >
                                {segs.map(({ event: e, start, end, col, cols }) => {
                                    const top = minutesInDay(start, day);
                                    const height = Math.max(minutesInDay(end, day) - top, 15) * PX_PER_MIN;
                                    const hue = eventHue(e);
                                    return (
                                        <button
                                            key={e.event_id}
                                            type="button"
                                            onClick={() => onSelectEvent(e)}
                                            className="absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-tight text-white focus-visible:outline-2 focus-visible:outline-white"
                                            style={{
                                                top: top * PX_PER_MIN,
                                                height,
                                                left: `calc(${(col / cols) * 100}% + 1px)`,
                                                width: `calc(${100 / cols}% - 3px)`,
                                                background: `hsl(${hue} 70% 50% / 0.35)`,
                                                borderColor: `hsl(${hue} 70% 55%)`,
                                            }}
                                        >
                                            <span className={`block truncate font-semibold ${e.mcv_submitted ? "text-white/60 line-through" : ""}`}>{e.event_name || "(No title)"}</span>
                                            {height >= 32 && (
                                                <span className="block truncate text-white/70">{timeFormat.format(e.start)}</span>
                                            )}
                                        </button>
                                    );
                                })}

                                {sameDay(day, now) && (
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 bg-[#ff453a]"
                                        style={{ top: minutesInDay(now, day) * PX_PER_MIN }}
                                    >
                                        <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-[#ff453a]" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TimeGrid;
