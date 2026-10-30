import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { eventHue } from "./dateUtils";
import { toLinks } from "../../api";

const rangeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
// Only http(s) links become clickable, so a stored javascript: URL can't run.
const SAFE_URL = /^https?:\/\//i;

// Native <dialog> gives Esc-to-close, focus handling and role="dialog" for free.
const EventPopover = ({ event, onClose }) => {
    const ref = useRef(null);
    const links = toLinks(event.associate_links);

    useEffect(() => {
        ref.current.showModal();
    }, []);

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            // Clicks on the backdrop target the dialog itself; the inner div catches the rest.
            onClick={(e) => e.target === ref.current && ref.current.close()}
            className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-[#2c2c2e] p-0 text-white shadow-2xl backdrop:bg-black/50"
        >
            <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                    <span
                        aria-hidden="true"
                        className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                        style={{ background: `hsl(${eventHue(event)} 70% 55%)` }}
                    />
                    <h2 className="text-lg font-semibold">{event.event_name || "(No title)"}</h2>
                </div>
                <p className="text-sm text-white/70">{rangeFormat.formatRange(event.start, event.end)}</p>
                {event.tags.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                        {event.tags.map((t) => (
                            <li key={t.id} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                                {t.name}
                            </li>
                        ))}
                    </ul>
                )}
                {event.description && (
                    <p className="whitespace-pre-wrap text-sm text-white/80">{event.description}</p>
                )}
                {links.length > 0 && (
                    <ul aria-label="Links" className="flex flex-col gap-1 border-t border-white/10 pt-3 text-sm">
                        {links.map((l, i) => (
                            <li key={i} className="flex min-w-0 items-baseline gap-2">
                                <span aria-hidden="true" className="text-white/40">↗</span>
                                {SAFE_URL.test(l.url) ? (
                                    <a
                                        href={l.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={l.url}
                                        className="truncate text-[#0a84ff] hover:underline focus-visible:outline-2 focus-visible:outline-white"
                                    >
                                        {l.label || l.url}
                                    </a>
                                ) : (
                                    <span className="truncate text-white/60">{l.label || l.url}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex justify-end gap-2">
                    <Link
                        to={`/event/${event.event_id}`}
                        className="rounded-md bg-[#0a84ff] px-3 py-1 text-sm hover:bg-[#0a84ff]/85 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        Edit
                    </Link>
                    <button
                        type="button"
                        onClick={() => ref.current.close()}
                        className="rounded-md bg-white/10 px-3 py-1 text-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </dialog>
    );
};

export default EventPopover;
