import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { eventHue } from "../Calendar/dateUtils";

const field =
    "min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/35 focus:border-[#0a84ff] focus:outline-none";
// Same rule as the event form: tag names have no spaces.
const noSpaces = (v) => v.replace(/\s/g, "");

// Add, rename and delete tags. Calls onClose(changed) so the page can refetch.
const TagManager = ({ onClose }) => {
    const ref = useRef(null);
    const changed = useRef(false);
    const [tags, setTags] = useState(null);
    const [drafts, setDrafts] = useState({});
    const [newName, setNewName] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        ref.current.showModal();
        api("/getTagUsage").then(setTags).catch((err) => setError(err.message));
    }, []);

    const run = async (fn) => {
        setBusy(true);
        try {
            await fn();
            changed.current = true;
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const clearDraft = (id) =>
        setDrafts((d) => {
            const rest = { ...d };
            delete rest[id];
            return rest;
        });

    const add = (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        run(async () => {
            const tag = await api("/postTag", { method: "POST", body: { name } });
            setTags((ts) => [...ts, { ...tag, event_count: 0 }]);
            setNewName("");
        });
    };

    const rename = (t) => {
        const name = (drafts[t.id] ?? t.name).trim();
        if (!name || name === t.name) return clearDraft(t.id);
        run(async () => {
            const updated = await api(`/updateTag/${t.id}`, { method: "PUT", body: { name } });
            setTags((ts) => ts.map((x) => (x.id === t.id ? { ...x, name: updated.name } : x)));
            clearDraft(t.id);
        });
    };

    const remove = (t) => {
        const uses = t.event_count === 1 ? "1 event" : `${t.event_count} events`;
        if (!window.confirm(`Delete tag "${t.name}"? It will be removed from ${uses}. The events themselves stay.`)) return;
        run(async () => {
            await api(`/deleteTag/${t.id}`, { method: "DELETE" });
            setTags((ts) => ts.filter((x) => x.id !== t.id));
            clearDraft(t.id);
        });
    };

    return (
        <dialog
            ref={ref}
            onClose={() => onClose(changed.current)}
            onClick={(e) => e.target === ref.current && ref.current.close()}
            aria-labelledby="tag-manager-title"
            className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-[#2c2c2e] p-0 text-white shadow-2xl backdrop:bg-black/50"
        >
            <div className="flex max-h-[80vh] flex-col gap-4 p-5">
                <h2 id="tag-manager-title" className="text-lg font-semibold">
                    Manage Tags
                </h2>

                {error && (
                    <p role="alert" className="rounded-md bg-[#ff453a]/20 px-3 py-2 text-sm">
                        {error}
                    </p>
                )}

                <form onSubmit={add} className="flex gap-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(noSpaces(e.target.value))}
                        placeholder="New tag name"
                        aria-label="New tag name"
                        className={field}
                    />
                    <button
                        type="submit"
                        disabled={busy || !newName.trim()}
                        className="rounded-md bg-[#0a84ff] px-3 py-1.5 text-sm font-medium hover:bg-[#0a84ff]/85 disabled:opacity-50"
                    >
                        Add
                    </button>
                </form>

                {tags === null && !error && <p className="text-sm text-white/50">Loading…</p>}
                {tags?.length === 0 && <p className="text-sm text-white/50">No tags yet.</p>}

                {tags?.length > 0 && (
                    <ul className="-mx-1 flex flex-col gap-1 overflow-y-auto px-1">
                        {tags.map((t) => {
                            const draft = drafts[t.id] ?? t.name;
                            const dirty = draft.trim() !== t.name;
                            return (
                                <li key={t.id} className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ background: `hsl(${eventHue({ tags: [t] })} 70% 55%)` }}
                                    />
                                    <input
                                        value={draft}
                                        onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: noSpaces(e.target.value) }))}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                rename(t);
                                            }
                                        }}
                                        aria-label={`Rename tag ${t.name}`}
                                        className={field}
                                    />
                                    <span className="w-16 shrink-0 text-right text-xs text-white/50">
                                        {t.event_count} {t.event_count === 1 ? "event" : "events"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => rename(t)}
                                        disabled={busy || !dirty}
                                        className="rounded-md px-2 py-1 text-sm text-[#0a84ff] hover:bg-white/10 disabled:invisible"
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => remove(t)}
                                        disabled={busy}
                                        aria-label={`Delete tag ${t.name}`}
                                        className="rounded-md px-2 py-1 text-sm text-[#ff453a] hover:bg-[#ff453a]/10 disabled:opacity-50"
                                    >
                                        Delete
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <button
                    type="button"
                    onClick={() => ref.current.close()}
                    className="self-end rounded-md bg-white/10 px-3 py-1 text-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
                >
                    Done
                </button>
            </div>
        </dialog>
    );
};

export default TagManager;
