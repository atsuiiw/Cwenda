// Calls the backend (proxied at /api in dev). Throws Error(message) with .status on non-2xx.
export async function api(path, { method = "GET", body, signal } = {}) {
    const res = await fetch(`/api${path}`, {
        method,
        signal,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message ?? res.statusText), { status: res.status });
    return data;
}

// getEvent rows carry ISO strings; views work with Date objects.
export const withDates = (row) => ({ ...row, start: new Date(row.start_time), end: new Date(row.end_time) });

// associate_links comes as [{label, url}], an older single {url} object, or the {} default.
export const toLinks = (raw) => {
    const list = Array.isArray(raw) ? raw : raw?.url ? [raw] : [];
    return list.filter((l) => typeof l?.url === "string" && l.url).map((l) => ({ label: l.label ?? "", url: l.url }));
};
