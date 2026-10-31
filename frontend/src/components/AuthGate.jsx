import { useEffect, useState } from "react";
import { api, LOGGED_OUT } from "../api";
import Login from "../pages/login";

// Shows the app only with a valid session; otherwise the login page.
// The URL is left alone, so logging in lands on the page that was requested.
const AuthGate = ({ children }) => {
    const [state, setState] = useState("checking"); // checking | in | out | unconfigured

    useEffect(() => {
        api("/session")
            .then((s) => setState(!s.configured ? "unconfigured" : s.authenticated ? "in" : "out"))
            .catch(() => setState("out")); // backend down: the login form will show the error on submit
        const onLoggedOut = () => setState("out");
        window.addEventListener(LOGGED_OUT, onLoggedOut);
        return () => window.removeEventListener(LOGGED_OUT, onLoggedOut);
    }, []);

    if (state === "checking") return null;
    if (state === "in") return children;
    return <Login unconfigured={state === "unconfigured"} onLoggedIn={() => setState("in")} />;
};

export default AuthGate;
