import { useState } from "react";
import { importMcv } from "../../api";
import { relativeTime } from "../Calendar/dateUtils";
import UpcomingList from "./UpcomingList";

// Unsubmitted MyCourseVille assignments due in the next 7 days, plus an Import button.
const DueSoon = ({ events, now, today, onImported }) => {
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null); // { ok, text }

    const runImport = async () => {
        setImporting(true);
        setResult(null);
        try {
            setResult({ ok: true, text: await importMcv() });
            onImported();
        } catch (err) {
            setResult({ ok: false, text: err.message });
        } finally {
            setImporting(false);
        }
    };

    const next = events[0];
    return (
        <div className="flex flex-col gap-2">
            {next && (
                <p className="text-sm text-[#ff9f0a]">
                    {events.length} due · next in {relativeTime(next.start - now)}
                </p>
            )}
            <UpcomingList events={events} today={today} empty="No MCV assignments due in the next 7 days." />
            {result && (
                <p role={result.ok ? "status" : "alert"} className={`rounded-md px-2.5 py-1.5 text-sm ${result.ok ? "bg-[#30d158]/15" : "bg-[#ff453a]/20"}`}>
                    {result.text}
                </p>
            )}
            <button
                type="button"
                onClick={runImport}
                disabled={importing}
                aria-busy={importing}
                className="self-start rounded-md bg-white/10 px-3 py-1 text-sm hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-60"
            >
                {importing ? "Importing…" : "Import from MCV"}
            </button>
        </div>
    );
};

export default DueSoon;
