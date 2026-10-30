import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, toLinks } from "../api";
import { eventHue, toLocalInput } from "../components/Calendar/dateUtils";

const SAFE_URL = /^https?:\/\//i;

const blankForm = () => {
    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    return {
        name: "",
        start: toLocalInput(start),
        end: toLocalInput(new Date(start.getTime() + 60 * 60 * 1000)),
        description: "",
        tagIds: [],
        links: [],
    };
};

const field =
    "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/35 focus:border-[#0a84ff] focus:outline-none";
const label = "flex flex-col gap-1 text-sm text-white/70";

function EventForm() {
    const { id } = useParams();
    const isEdit = id !== undefined;
    const navigate = useNavigate();
    const location = useLocation();

    const [form, setForm] = useState(blankForm);
    const [loaded, setLoaded] = useState(!isEdit);
    const [allTags, setAllTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    // Return to wherever the user came from (calendar or list); direct visits fall back to the list.
    const goBack = () => (location.key === "default" ? navigate("/event") : navigate(-1));
    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

    useEffect(() => {
        api("/getAllTags").then(setAllTags).catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        if (!isEdit) return;
        const ctrl = new AbortController();
        api(`/getEvent/${id}`, { signal: ctrl.signal })
            .then((ev) => {
                setForm({
                    name: ev.name ?? "",
                    start: ev.start_time ? toLocalInput(new Date(ev.start_time)) : "",
                    end: ev.end_time ? toLocalInput(new Date(ev.end_time)) : "",
                    description: ev.description ?? "",
                    tagIds: ev.tags.map((t) => t.id),
                    // Keeps older {url} rows' link instead of dropping it on save.
                    links: toLinks(ev.associate_links),
                });
                setLoaded(true);
            })
            .catch((err) => {
                if (err.name !== "AbortError") setError(err.status === 404 ? "Event not found" : err.message);
            });
        return () => ctrl.abort();
    }, [id, isEdit]);

    const toggleTag = (tagId) =>
        setForm((f) => ({
            ...f,
            tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((x) => x !== tagId) : [...f.tagIds, tagId],
        }));

    // Space (or Enter) turns the typed name into a tag: reuse a match, otherwise create it.
    const addTag = async () => {
        const name = tagInput.trim();
        if (!name) return;
        const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        try {
            const tag = existing ?? (await api("/postTag", { method: "POST", body: { name } }));
            if (!existing) setAllTags((ts) => [...ts, tag]);
            setForm((f) => (f.tagIds.includes(tag.id) ? f : { ...f, tagIds: [...f.tagIds, tag.id] }));
            setTagInput("");
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    };

    const setLink = (i, key, value) =>
        setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }));

    const save = async (e) => {
        e.preventDefault();
        const start = new Date(form.start);
        // updateEvent can't take "", so a blank end becomes a zero-length event.
        const end = form.end ? new Date(form.end) : start;
        const links = form.links
            .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
            .filter((l) => l.url);

        if (Number.isNaN(start.getTime())) return setError("Start time is required");
        if (end < start) return setError("End time cannot be before start time");
        if (links.some((l) => !SAFE_URL.test(l.url))) return setError("Links must start with http:// or https://");

        const body = {
            name: form.name.trim(),
            description: form.description,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            tags: form.tagIds,
            associate_links: links,
        };

        setSaving(true);
        try {
            await api(isEdit ? `/updateEvent/${id}` : "/postEvent", { method: isEdit ? "PUT" : "POST", body });
            goBack();
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Delete "${form.name || "this event"}"?`)) return;
        setSaving(true);
        try {
            await api(`/deleteEvent/${id}`, { method: "DELETE" });
            goBack();
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto flex max-w-xl flex-col gap-4 text-white">
            <h1 className="text-2xl font-semibold">{isEdit ? "Edit Event" : "New Event"}</h1>

            {error && (
                <p role="alert" className="rounded-md bg-[#ff453a]/20 px-3 py-2 text-sm">
                    {error}
                </p>
            )}

            {!loaded ? (
                !error && <p className="text-sm text-white/50">Loading…</p>
            ) : (
                <form onSubmit={save} className="flex flex-col gap-4 rounded-xl bg-[#2c2c2e] p-5">
                    <label className={label}>
                        Title
                        <input required value={form.name} onChange={set("name")} placeholder="New Event" className={field} />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className={label}>
                            Starts
                            <input type="datetime-local" required value={form.start} onChange={set("start")} className={`${field} [color-scheme:dark]`} />
                        </label>
                        <label className={label}>
                            Ends
                            <input type="datetime-local" value={form.end} onChange={set("end")} className={`${field} [color-scheme:dark]`} />
                        </label>
                    </div>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-sm text-white/70">Tags</legend>
                        {allTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {allTags.map((t) => {
                                    const on = form.tagIds.includes(t.id);
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => toggleTag(t.id)}
                                            className={`rounded-full px-2.5 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-white ${on ? "text-white" : "bg-white/10 text-white/60 hover:text-white"}`}
                                            style={on ? { background: `hsl(${eventHue({ tags: [t] })} 70% 45%)` } : undefined}
                                        >
                                            {t.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <input
                            value={tagInput}
                            // Tag names can't contain spaces: space is the "create" key.
                            onChange={(e) => setTagInput(e.target.value.replace(/\s/g, ""))}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") {
                                    e.preventDefault();
                                    addTag();
                                }
                            }}
                            placeholder="Type a tag, press space to add"
                            aria-label="New tag"
                            className={field}
                        />
                    </fieldset>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="mb-1 text-sm text-white/70">Links</legend>
                        {form.links.map((l, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    value={l.label}
                                    onChange={(e) => setLink(i, "label", e.target.value)}
                                    placeholder="Label"
                                    aria-label={`Link ${i + 1} label`}
                                    className={`${field} w-1/3`}
                                />
                                <input
                                    type="url"
                                    value={l.url}
                                    onChange={(e) => setLink(i, "url", e.target.value)}
                                    placeholder="https://…"
                                    aria-label={`Link ${i + 1} URL`}
                                    className={field}
                                />
                                <button
                                    type="button"
                                    aria-label={`Remove link ${i + 1}`}
                                    onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}
                                    className="rounded-md px-2 text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, links: [...f.links, { label: "", url: "" }] }))}
                            className="self-start text-sm text-[#0a84ff] hover:underline"
                        >
                            + Add link
                        </button>
                    </fieldset>

                    <label className={label}>
                        Notes
                        <textarea rows={4} value={form.description} onChange={set("description")} className={field} />
                    </label>

                    <div className="flex items-center gap-2 pt-1">
                        {isEdit && (
                            <button
                                type="button"
                                onClick={remove}
                                disabled={saving}
                                className="rounded-md px-3 py-1.5 text-sm text-[#ff453a] hover:bg-[#ff453a]/10 disabled:opacity-50"
                            >
                                Delete Event
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={goBack}
                            className="ml-auto rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-md bg-[#0a84ff] px-4 py-1.5 text-sm font-medium hover:bg-[#0a84ff]/85 disabled:opacity-50"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default EventForm;
