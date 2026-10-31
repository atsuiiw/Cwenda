import { eventHue, nextUp, relativeTime, sameDay, startOfDay } from "../Calendar/dateUtils";
import { dayLabel, timeLabel } from "../Event/format";
import SubmittedBadge from "../Event/SubmittedBadge";

// The event happening now, or the next one to start, with a live countdown.
const NextUp = ({ events, now, onSelect }) => {
    const e = nextUp(events, now);
    if (!e) return <p className="text-sm text-white/50">Nothing coming up this week.</p>;

    const live = e.start <= now && e.end > now;
    const when = sameDay(e.start, now) ? timeLabel(e) : `${dayLabel(startOfDay(e.start), startOfDay(now))} · ${timeLabel(e)}`;

    return (
        <button
            type="button"
            onClick={() => onSelect(e)}
            className="flex w-full items-start gap-3 rounded-lg p-1 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-white"
        >
            <span aria-hidden="true" className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: `hsl(${eventHue(e)} 70% 55%)` }} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-lg font-semibold">{e.event_name || "(No title)"}</span>
                <span className="text-sm text-white/60">{when}</span>
                <span className="flex flex-wrap gap-1">
                    {e.tags.map((t) => (
                        <span key={t.id} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{t.name}</span>
                    ))}
                    <SubmittedBadge submitted={e.mcv_submitted} />
                </span>
            </span>
            <span className={`shrink-0 text-sm font-semibold ${live ? "text-[#ff453a]" : "text-[#0a84ff]"}`}>
                {live ? `Now · ends in ${relativeTime(e.end - now)}` : `in ${relativeTime(e.start - now)}`}
            </span>
        </button>
    );
};

export default NextUp;
