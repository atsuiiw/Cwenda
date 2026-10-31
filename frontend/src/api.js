// Calls the backend (proxied at /api in dev). Throws Error(message) with .status on non-2xx.
export async function api(path, { method = "GET", body, signal } = {}) {
    const res = await fetch(`/api${path}`, {
        method,
        signal,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        // Cwenda's own session ended: AuthGate shows the login page. (MCV's expired login is
        // also a 401 but carries a different code, so it doesn't log you out.)
        if (res.status === 401 && data.code === "auth_required") window.dispatchEvent(new Event(LOGGED_OUT));
        throw Object.assign(new Error(data.message ?? res.statusText), { status: res.status, code: data.code });
    }
    return data;
}

export const LOGGED_OUT = "cwenda:logged-out";

export async function logout() {
    await api("/logout", { method: "POST" }).catch(() => {});
    window.dispatchEvent(new Event(LOGGED_OUT));
}

// getEvent rows carry ISO strings; views work with Date objects.
export const withDates = (row) => ({ ...row, start: new Date(row.start_time), end: new Date(row.end_time) });

// associate_links comes as [{label, url}], an older single {url} object, or the {} default.
export const toLinks = (raw) => {
    const list = Array.isArray(raw) ? raw : raw?.url ? [raw] : [];
    return list.filter((l) => typeof l?.url === "string" && l.url).map((l) => ({ label: l.label ?? "", url: l.url }));
};

// Runs the MyCourseVille import and returns a one-line summary (throws on failure, like api()).
export async function importMcv() {
    const r = await api("/mcv/import", { method: "POST" });
    const parts = [`${r.created} new`, `${r.updated} already imported`, `${r.submitted} submitted`];
    if (r.skipped) parts.push(`${r.skipped} skipped (no due date)`);
    return `MyCourseVille: ${parts.join(", ")}.`;
}
