import {
    BrowserRouter as Router,
    Routes,
    Route,
} from "react-router-dom";
import Navbar from "../components/Navbar";
import Home from "../pages/home";
import Calendar from "../pages/calendar";
import Event from "../pages/event";
import EventForm from "../pages/eventForm";

function AppRouter () {

    return (
        <Router>
            <div className="m-0 flex min-h-screen flex-col md:flex-row">
                
                <Navbar />
                <main className="min-w-0 flex-1 p-4 md:p-6">
                    <Routes>
                        <Route path="/home" element={<Home />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/event" element={<Event />} />
                        <Route path="/event/new" element={<EventForm />} />
                        <Route path="/event/:id" element={<EventForm />} />
                    </Routes>
                </main>
            </div>
        </Router>
    )
}

export default AppRouter;