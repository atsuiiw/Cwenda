import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { toLocalInput } from "../Calendar/dateUtils";

const LENGTHS = [
    { minutes: 30, label: "30 min" },
    { minutes: 60, label: "1 hour" },
    { minutes: 120, label: "2 hours" },
];
const field =
    "min-w-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/35 focus:border-[#0a84ff] focus:outline-none";

const nextHour = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
};

// Title + start + length; the full form is one link away.
const QuickAdd = ({ onAdded }) => {
    const [title, setTitle] = useState("");
    const [start, setStart] = useState(nextHour);
    const [minutes, setMinutes] = useState(60);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const add = async (e) => {
        e.preventDefault();
        const startDate = new Date(start);
        if (!title.trim()) return setError("Give the event a title");
        if (Number.isNaN(startDate.getTime())) return setError("Pick a start time");
        setSaving(true);
        try {
            await api("/postEvent", {
                method: "POST",
                body: {
                    name: title.trim(),
                    start_time: startDate.toISOString(),
                    end_time: new Date(startDate.getTime() + minutes * 60_000).toISOString(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    tags: [],
                    associate_links: [],
                },
            });
            setTitle("");
            setStart(nextHour());
            setError(null);
            onAdded();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={add} className="flex flex-col gap-2">
            {error && (
                <p role="alert" className="rounded-md bg-[#ff453a]/20 px-2.5 py-1.5 text-sm">
                    {error}
                </p>
            )}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New event title" aria-label="Title" className={`${field} w-full`} />
            <div className="flex flex-wrap gap-2">
                <input
                    type="datetime-local"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    aria-label="Starts"
                    className={`${field} flex-1 [color-scheme:dark]`}
                />
                <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Length" className={`${field} [color-scheme:dark]`}>
                    {LENGTHS.map((l) => (
                        <option key={l.minutes} value={l.minutes}>
                            {l.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex items-center justify-between">
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-[#0a84ff] px-4 py-1.5 text-sm font-medium hover:bg-[#0a84ff]/85 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                >
                    {saving ? "Adding…" : "Add"}
                </button>
                <Link to="/event/new" className="text-sm text-[#0a84ff] hover:underline">
                    More options →
                </Link>
            </div>
        </form>
    );
};

export default QuickAdd;
