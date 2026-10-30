import { useEffect, useState } from "react";
import MonthView from "../components/Calendar/MonthView";
import TimeGrid from "../components/Calendar/TimeGrid";
import EventPopover from "../components/Calendar/EventPopover";
import { step, viewDays, visibleRange } from "../components/Calendar/dateUtils";
import { api, withDates } from "../api";

const VIEWS = ["day", "week", "month"];
const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayTitle = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });

function Calendar() {
    const [view, setView] = useState("month");
    const [cursor, setCursor] = useState(() => new Date());
    const [events, setEvents] = useState([]);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);

    const { start, end } = visibleRange(view, cursor);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    useEffect(() => {
        const ctrl = new AbortController();
        const params = new URLSearchParams({ start_time: startIso, end_time: endIso });
        api(`/getEvent?${params}`, { signal: ctrl.signal })
            .then((rows) => {
                setEvents(rows.map(withDates));
                setError(null);
            })
            .catch((err) => {
                if (err.name !== "AbortError") setError(err.message);
            });
        return () => ctrl.abort();
    }, [startIso, endIso]);

    // Apple Calendar shortcuts: arrows step, T jumps to today.
    useEffect(() => {
        const onKey = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select, dialog")) return;
            if (e.key === "ArrowLeft") setCursor((c) => step(view, c, -1));
            else if (e.key === "ArrowRight") setCursor((c) => step(view, c, 1));
            else if (e.key === "t" || e.key === "T") setCursor(new Date());
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [view]);

    const openDay = (day) => {
        setCursor(day);
        setView("day");
    };

    const navButton =
        "rounded-md px-2.5 py-1 text-sm text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white";

    return (
        <div className="flex h-[calc(100dvh-2rem)] flex-col gap-3 text-white md:h-[calc(100dvh-3rem)]">
            <header className="flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-lg bg-white/5">
                    <button type="button" aria-label="Previous" onClick={() => setCursor((c) => step(view, c, -1))} className={navButton}>
                        ‹
                    </button>
                    <button type="button" onClick={() => setCursor(new Date())} className={navButton}>
                        Today
                    </button>
                    <button type="button" aria-label="Next" onClick={() => setCursor((c) => step(view, c, 1))} className={navButton}>
                        ›
                    </button>
                </div>
                <h1 className="text-2xl font-semibold">
                    {view === "day" ? dayTitle.format(cursor) : monthTitle.format(cursor)}
                </h1>
                <div role="group" aria-label="Calendar view" className="ml-auto flex rounded-lg bg-white/5 p-0.5">
                    {VIEWS.map((v) => (
                        <button
                            key={v}
                            type="button"
                            aria-pressed={view === v}
                            onClick={() => setView(v)}
                            className={`rounded-md px-3 py-1 text-sm capitalize focus-visible:outline-2 focus-visible:outline-white ${
                                view === v ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                            }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </header>

            {error && (
                <p role="alert" className="rounded-md bg-[#ff453a]/20 px-3 py-2 text-sm">
                    Couldn't load events: {error}
                </p>
            )}

            {view === "month" ? (
                <MonthView cursor={cursor} events={events} onSelectEvent={setSelected} onSelectDay={openDay} />
            ) : (
                <TimeGrid days={viewDays(view, cursor)} events={events} onSelectEvent={setSelected} />
            )}

            {selected && <EventPopover key={selected.event_id} event={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}

export default Calendar;
