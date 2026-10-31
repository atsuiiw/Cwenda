import { useState } from "react";
import { api } from "../api";

// Full-screen password prompt. `unconfigured` means the backend has no password yet.
function Login({ unconfigured, onLoggedIn }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!password) return;
        setBusy(true);
        try {
            await api("/login", { method: "POST", body: { password } });
            onLoggedIn();
        } catch (err) {
            setError(err.message);
            setPassword("");
            setBusy(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center p-4 text-white">
            <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-[#2c2c2e] p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                    <img src="/logo.jpg" alt="" className="h-12 w-12 rounded-full object-cover" />
                    <h1 className="text-2xl font-semibold">Cwenda</h1>
                </div>

                {unconfigured ? (
                    <p className="text-sm text-white/80">
                        No password is set yet. In <code>backend/</code> run <code>npm run set-password</code>, restart the backend, then
                        reload this page.
                    </p>
                ) : (
                    <>
                        {error && (
                            <p role="alert" className="rounded-md bg-[#ff453a]/20 px-3 py-2 text-sm">
                                {error}
                            </p>
                        )}
                        <label className="flex flex-col gap-1 text-sm text-white/70">
                            Password
                            <input
                                type="password"
                                autoFocus
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-[#0a84ff] focus:outline-none"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={busy || !password}
                            className="rounded-md bg-[#0a84ff] px-4 py-2 font-medium hover:bg-[#0a84ff]/85 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
                        >
                            {busy ? "Logging in…" : "Log in"}
                        </button>
                    </>
                )}
            </form>
        </main>
    );
}

export default Login;
