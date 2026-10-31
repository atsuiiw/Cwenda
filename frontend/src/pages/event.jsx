import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, importMcv as runMcvImport, withDates } from "../api";
import TagManager from "../components/Event/TagManager";
import SubmittedBadge from "../components/Event/SubmittedBadge";
import { dayLabel, timeLabel } from "../components/Event/format";
import { addDays, eventHue, sameDay, startOfDay } from "../components/Calendar/dateUtils";

const DAYS_AHEAD = 90;
const DAYS_BACK = 30;
function EventList() {
    // Fixed at mount so the fetch effect doesn't re-run every render.
    const [range] = useState(() => {
        const now = new Date();
        return {
            now,
            start: now.toISOString(),
            end: addDays(now, DAYS_AHEAD).toISOString(),
            pastStart: addDays(now, -DAYS_BACK).toISOString(),
        };
    });
    const [showPast, setShowPast] = useState(false);
    const [tags, setTags] = useState([]);
    const [filter, setFilter] = useState([]);
    const [match, setMatch] = useState("any");
    const [events, setEvents] = useState(null);
    const [error, setError] = useState(null);
    const [managing, setManaging] = useState(false);
    // Bumped after tag edits so tags and events (which carry tag names) reload.
    const [version, setVersion] = useState(0);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null); // { ok, text }

    useEffect(() => {
        api("/getAllTags")
            .then((fresh) => {
                setTags(fresh);
                // Drop deleted tags from the active filter.
                setFilter((f) => {
                    const kept = f.filter((id) => fresh.some((t) => t.id === id));
                    return kept.length === f.length ? f : kept;
                });
            })
            .catch((err) => setError(err.message));
    }, [version]);

    useEffect(() => {
        const ctrl = new AbortController();
        const params = showPast
            ? new URLSearchParams({ start_time: range.pastStart, end_time: range.start, match })
            : new URLSearchParams({ start_time: range.start, end_time: range.end, match });
        filter.forEach((id) => params.append("tag", id));
        api(`/getEvent?${params}`, { signal: ctrl.signal })
            .then((rows) => {
                const list = rows.map(withDates);
                // Past = already ended (in-progress events stay in Upcoming), newest first.
                setEvents(
                    showPast
                        ? list.filter((e) => e.end < range.now).sort((a, b) => b.start - a.start)
                        : list.sort((a, b) => a.start - b.start),
                );
                setError(null);
            })
            .catch((err) => {
                if (err.name !== "AbortError") setError(err.message);
            });
        return () => ctrl.abort();
    }, [range, filter, match, version, showPast]);

    // Group by day; upcoming events already in progress are listed under today.
    const today = startOfDay(range.now);
    const groups = new Map();
    for (const e of events ?? []) {
        const day = !showPast && e.start < today ? today : startOfDay(e.start);
        const key = day.toDateString();
        if (!groups.has(key)) groups.set(key, { day, items: [] });
        groups.get(key).items.push(e);
    }

    const importMcv = async () => {
        setImporting(true);
        setImportResult(null);
        try {
            setImportResult({ ok: true, text: await runMcvImport() });
            setVersion((v) => v + 1);
        } catch (err) {
            setImportResult({ ok: false, text: err.message });
        } finally {
            setImporting(false);
        }
    };

    const toggle = (id) => setFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-white">
            <header className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{showPast ? "Past Events" : "Events"}</h1>
                <button
                    type="button"
                    aria-pressed={showPast}
                    onClick={() => {
                        setEvents(null);
                        setShowPast((p) => !p);
                    }}
                    className={`ml-auto rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-white ${showPast ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
                >
                    {showPast ? "Upcoming" : `Past ${DAYS_BACK} Days`}
                </button>
                <button
                    type="button"
                    onClick={() => setManaging(true)}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                >
                    Manage Tags
                </button>
                <button
                    type="button"
                    onClick={importMcv}
                    disabled={importing}
                    aria-busy={importing}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-60"
                >
                    {importing ? "Importing…" : "Import from MCV"}
                </button>
                <Link
                    to="/event/new"
                    className="rounded-md bg-[#0a84ff] px-3 py-1.5 text-sm font-medium hover:bg-[#0a84ff]/85 focus-visible:outline-2 focus-visible:outline-white"
                >
                    New Event
                </Link>
            </header>

            {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
                    {tags.map((t) => {
                        const on = filter.includes(t.id);
                        return (
                            <button
                                key={t.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggle(t.id)}
                                className={`rounded-full px-2.5 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-white ${on ? "text-white" : "bg-white/10 text-white/70 hover:text-white"}`}
                                style={on ? { background: `hsl(${eventHue({ tags: [t] })} 70% 45%)` } : undefined}
                            >
                                {t.name}
                            </button>
                        );
                    })}
                    {filter.length > 1 && (
                        <button
                            type="button"
                            onClick={() => setMatch((m) => (m === "any" ? "all" : "any"))}
                            className="ml-1 rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/70 hover:text-white"
                        >
                            Match {match === "any" ? "any tag" : "all tags"}
                        </button>
                    )}
                </div>
            )}

            {importResult && (
                <p
                    role={importResult.ok ? "status" : "alert"}
                    className={`rounded-md px-3 py-2 text-sm ${importResult.ok ? "bg-[#30d158]/15" : "bg-[#ff453a]/20"}`}
                >
                    {importResult.text}
                </p>
            )}

            {error && (
                <p role="alert" className="rounded-md bg-[#ff453a]/20 px-3 py-2 text-sm">
                    Couldn't load events: {error}
                </p>
            )}

            {events === null && !error && <p className="text-sm text-white/50">Loading…</p>}
            {events?.length === 0 && (
                <p className="py-10 text-center text-white/50">{showPast ? `No events in the past ${DAYS_BACK} days.` : `No events in the next ${DAYS_AHEAD} days.`}</p>
            )}

            {[...groups.values()].map(({ day, items }) => (
                <section key={day.toDateString()} className="flex flex-col gap-1">
                    <h2 className={`text-sm font-semibold ${sameDay(day, today) ? "text-[#ff453a]" : "text-white/60"}`}>
                        {dayLabel(day, today)}
                    </h2>
                    <ul className="overflow-hidden rounded-xl bg-[#2c2c2e]">
                        {items.map((e) => (
                            <li key={e.event_id} className="border-b border-white/10 last:border-b-0">
                                <Link
                                    to={`/event/${e.event_id}`}
                                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-9 w-1 shrink-0 rounded-full"
                                        style={{ background: `hsl(${eventHue(e)} 70% 55%)` }}
                                    />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className={`truncate font-medium ${e.mcv_submitted ? "text-white/50 line-through" : ""}`}>
                                                {e.event_name || "(No title)"}
                                            </span>
                                            <SubmittedBadge submitted={e.mcv_submitted} />
                                        </span>
                                        <span className="text-xs text-white/60">{timeLabel(e)}</span>
                                    </span>
                                    <span className="ml-auto hidden shrink-0 gap-1 sm:flex">
                                        {e.tags.map((t) => (
                                            <span key={t.id} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                                                {t.name}
                                            </span>
                                        ))}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {managing && (
                <TagManager
                    onClose={(changed) => {
                        setManaging(false);
                        if (changed) setVersion((v) => v + 1);
                    }}
                />
            )}
        </div>
    );
}

export default EventList;
