import { Link } from "react-router-dom";
import { eventHue, startOfDay } from "../Calendar/dateUtils";
import { dayLabel, timeLabel } from "../Event/format";
import SubmittedBadge from "../Event/SubmittedBadge";

// Compact day-grouped list; each row opens the event.
const UpcomingList = ({ events, today, empty }) => {
    if (events.length === 0) return <p className="text-sm text-white/50">{empty}</p>;

    const groups = new Map();
    for (const e of events) {
        const day = startOfDay(e.start);
        const key = day.toDateString();
        if (!groups.has(key)) groups.set(key, { day, items: [] });
        groups.get(key).items.push(e);
    }

    return (
        <div className="flex flex-col gap-2">
            {[...groups.values()].map(({ day, items }) => (
                <section key={day.toDateString()}>
                    <h3 className="mb-0.5 text-xs font-semibold text-white/50">{dayLabel(day, today)}</h3>
                    <ul className="flex flex-col">
                        {items.map((e) => (
                            <li key={e.event_id}>
                                <Link
                                    to={`/event/${e.event_id}`}
                                    className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white"
                                >
                                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${eventHue(e)} 70% 55%)` }} />
                                    <span className="shrink-0 whitespace-nowrap text-white/60">{timeLabel(e)}</span>
                                    {/* min-w-0 lets the title shrink and truncate instead of pushing the badge out. */}
                                    <span className={`min-w-0 flex-1 truncate ${e.mcv_submitted ? "text-white/50 line-through" : ""}`}>{e.event_name || "(No title)"}</span>
                                    <SubmittedBadge submitted={e.mcv_submitted} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
};

export default UpcomingList;
