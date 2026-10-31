import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, withDates } from "../api";
import { addDays, overlaps, startOfDay } from "../components/Calendar/dateUtils";
import TimeGrid from "../components/Calendar/TimeGrid";
import EventPopover from "../components/Calendar/EventPopover";
import NextUp from "../components/Home/NextUp";
import QuickAdd from "../components/Home/QuickAdd";
import UpcomingList from "../components/Home/UpcomingList";
import DueSoon from "../components/Home/DueSoon";

const UPCOMING_MAX = 6;
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

const greeting = (d) => (d.getHours() < 12 ? "Good morning" : d.getHours() < 18 ? "Good afternoon" : "Good evening");

const Card = ({ title, action, className = "", children }) => (
    <section className={`flex min-w-0 flex-col gap-3 rounded-xl bg-[#2c2c2e] p-4 ${className}`}>
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">{title}</h2>
            {action}
        </div>
        {children}
    </section>
);

function Home() {
    // shortcut: the range is fixed at load, so a page left open past midnight shows yesterday until reload.
    const [range] = useState(() => {
        const today = startOfDay(new Date());
        return { today, start: today.toISOString(), end: addDays(today, 8).toISOString() };
    });
    const [scrollHour] = useState(() => Math.max(0, new Date().getHours() - 1));
    const [now, setNow] = useState(() => new Date());
    const [events, setEvents] = useState([]);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const ctrl = new AbortController();
        const params = new URLSearchParams({ start_time: range.start, end_time: range.end });
        api(`/getEvent?${params}`, { signal: ctrl.signal })
            .then((rows) => {
                setEvents(rows.map(withDates).sort((a, b) => a.start - b.start));
                setError(null);
            })
            .catch((err) => {
                if (err.name !== "AbortError") setError(err.message);
            });
        return () => ctrl.abort();
    }, [range, version]);

    const refresh = () => setVersion((v) => v + 1);
    const tomorrow = addDays(range.today, 1);
    const todays = events.filter((e) => overlaps(e, range.today, tomorrow));
    // Starts tomorrow so nothing repeats today's timeline.
    const upcoming = events.filter((e) => e.start >= tomorrow).slice(0, UPCOMING_MAX);
    const weekFromNow = addDays(now, 7);
    const dueSoon = events.filter((e) => e.mcv_submitted === false && e.end >= now && e.start < weekFromNow);

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-white">
            <header>
                <h1 className="text-2xl font-semibold">{greeting(now)}</h1>
                <p className="text-white/60">{dateFormat.format(now)}</p>
            </header>

            {error && (
                <p role="alert" className="rounded-md bg-[#ff453a]/20 px-3 py-2 text-sm">
                    Couldn't load events: {error}
                </p>
            )}

            {/* Phones: DOM order (Next Up first). Desktop: timeline on the left, the rest stacked on the right. */}
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
                <Card title="Next Up" className="md:col-start-2">
                    <NextUp events={events} now={now} onSelect={setSelected} />
                </Card>
                <Card title="Add Event" className="md:col-start-2">
                    <QuickAdd onAdded={refresh} />
                </Card>
                <Card title="Due Soon (MCV)" className="md:col-start-2">
                    <DueSoon events={dueSoon} now={now} today={range.today} onImported={refresh} />
                </Card>
                <Card
                    title="Today's Timeline"
                    className="md:col-start-1 md:row-span-4 md:row-start-1"
                    action={<Link to="/calendar" className="text-sm text-[#0a84ff] hover:underline">Calendar →</Link>}
                >
                    {/* About the visible screen height below the header, never shorter than 560px. */}
                    <div className="flex h-[max(560px,calc(100dvh-14rem))] flex-col">
                        <TimeGrid days={[range.today]} events={todays} onSelectEvent={setSelected} scrollToHour={scrollHour} />
                    </div>
                </Card>
                <Card
                    title="Upcoming Events"
                    className="md:col-start-2"
                    action={<Link to="/event" className="text-sm text-[#0a84ff] hover:underline">See all →</Link>}
                >
                    <UpcomingList events={upcoming} today={range.today} empty="Nothing in the next 7 days." />
                </Card>
            </div>

            {selected && <EventPopover key={selected.event_id} event={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}

export default Home;
