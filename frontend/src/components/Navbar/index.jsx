import { useState } from "react";
import { NavLink } from "react-router-dom";
import { logout } from "../../api";

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const linkClassName = ({ isActive }) =>
        `z-[13] font-navbar ml-5 text-2xl flex cursor-pointer items-center px-4 py-2 text-white no-underline transition-[translate,text-shadow] duration-150 md:py-3 ${
            isActive ? "-translate-y-0.5 [text-shadow:0_5px_2px_black] bg-[#4f385a] rounded-tl-lg rounded-bl-lg" : ""
        }`;

    return (
        <nav className="z-[12] w-full shrink-0 bg-[#3a3847] text-xl md:min-h-screen md:w-[clamp(12rem,20vw,16rem)] md:rounded-[0.4rem] md:text-[2em]">
            <div className="flex flex-col md:min-h-screen">
                <h1 className="mt-2 ml-2 hidden md:block text-sm text-white"> @Cwenda </h1>
                <div className="flex items-center justify-between p-3 md:justify-center md:p-0">
                    <img
                        src="/logo.jpg"
                        alt="Cwenda logo"
                        className="mt-5 mb-5 aspect-square h-12 w-12 rounded-full object-cover md:h-25 md:w-25"
                    />
                    <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls="primary-navigation"
                        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
                        onClick={() => setIsOpen((open) => !open)}
                        className="rounded p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
                    >
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-7 w-7"
                        >
                            {isOpen ? (
                                <path d="M6 6l12 12M18 6L6 18" />
                            ) : (
                                <path d="M3 6h18M3 12h18M3 18h18" />
                            )}
                        </svg>
                    </button>
                </div>
                <div
                    id="primary-navigation"
                    className={`${isOpen ? "flex" : "hidden"} flex-col md:flex`}
                >
                    <NavLink
                        to="/home"
                        onClick={() => setIsOpen(false)}
                        className={linkClassName}
                    >
                        HOME
                    </NavLink>
                    <NavLink
                        to="/calendar"
                        onClick={() => setIsOpen(false)}
                        className={linkClassName}
                    >
                        CALENDAR
                    </NavLink>
                    <NavLink
                        to="/event"
                        onClick={() => setIsOpen(false)}
                        className={linkClassName}
                    >
                        EVENT
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            logout();
                        }}
                        className={`${linkClassName({ isActive: false })} text-left text-white/70 hover:text-white`}
                    >
                        LOG OUT
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;