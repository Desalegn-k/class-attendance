import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../lib/api";
import ConfirmDialog from "./ConfirmDialog";
import "./MainHeader.css";

/* Inline SVG icons keep the bundle free of an icon-font request. */
const Icon = ({ path, filled = false }) => (
  <svg
    className="ico"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d={path} />
  </svg>
);

const ICONS = {
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  dashboard: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z",
  classes: "M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4",
  mark: "M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z",
  reports:
    "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h6l6 6v12a2 2 0 01-2 2z",
  students:
    "M17 20h5v-1a4 4 0 00-3-3.87M9 20H2v-1a5 5 0 019.33-2.5M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM9 15a3 3 0 100-6 3 3 0 000 6z",
  bell: "M15 17H9m9 0a2 2 0 002-2l-1-1.5V11a6 6 0 10-12 0v2.5L7 15a2 2 0 002 2m0 0h10m-5 3a2.5 2.5 0 003 0",
  profile:
    "M5 20a7 7 0 0114 0M12 12a4 4 0 100-8 4 4 0 000 8z",
  logout: "M15 17l5-5-5-5m5 5H9M12 3H6a2 2 0 00-2 2v14a2 2 0 002 2h6",
  shield:
    "M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6l8-3zm-1.5 12.5l4-4-4-4",
};

const NAV_BY_ROLE = {
  TEACHER: [
    { to: "/teacher", label: "Me", icon: ICONS.dashboard, end: true },
    // { to: "/teacher", label: "Classes", icon: ICONS.classes, match: "classes" },
    // { to: "/teacher", label: "Mark Attendance", icon: ICONS.mark, match: "sessions" },
    // { to: "/teacher", label: "Reports", icon: ICONS.reports, match: "report" },
    // { to: "/teacher", label: "Students", icon: ICONS.students },
  ],
  ADMIN: [
    { to: "/admin", label: "Dashboard", icon: ICONS.dashboard, tab: "users" },
    { to: "/admin?tab=create-user", label: "Create User", icon: ICONS.profile, tab: "create-user" },
    { to: "/admin?tab=all-users", label: "All Users", icon: ICONS.students, tab: "all-users" },
    { to: "/admin?tab=classes", label: "Classes", icon: ICONS.classes, tab: "classes" },
    { to: "/admin?tab=sessions", label: "Sessions", icon: ICONS.reports, tab: "sessions" },
    { to: "/admin/academic?tab=create-course", label: "Create Course", icon: ICONS.reports, tab: "create-course" },
    { to: "/admin/academic?tab=all-courses", label: "All Courses", icon: ICONS.classes, tab: "all-courses" },
  ],
  DEPARTMENT_HEAD: [
    { to: "/department", label: "Department", icon: ICONS.dashboard, end: true },
  ],
  STUDENT: [
    { to: "/student", label: "Dashboard", icon: ICONS.dashboard, end: true },
    { to: "/check-in", label: "Mark Attendance", icon: ICONS.mark },
    { to: "/my-attendance", label: "My Attendance", icon: ICONS.reports },
    { to: "/student", label: "Classes", icon: ICONS.classes, match: "classes" },
  ],
};

export default function MainHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const toggleRef = useRef(null);
  const sidebarRef = useRef(null);
  const user = getCurrentUser();

  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";
  const role = user?.role || "";
  const links = NAV_BY_ROLE[role] || [];

  /* Close the drawer whenever the route changes. */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  /* Shadow the sticky header once the page is scrolled. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Escape closes the drawer and returns focus to the hamburger. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  /* Keep Tab focus inside the drawer while it is open. */
  useEffect(() => {
    if (!open || !sidebarRef.current) return;
    const node = sidebarRef.current;
    const focusables = node.querySelectorAll("a[href], button:not([disabled])");
    focusables[0]?.focus();

    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(
        node.querySelectorAll("a[href], button:not([disabled])"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [open]);

  function handleLogout() {
    logout();
    setConfirmLogout(false);
    setOpen(false);
    navigate("/login");
  }

  function isActive(item) {
    if (item.tab) {
      const current = new URLSearchParams(location.search).get("tab") || "users";
      if (item.tab === "create-course" || item.tab === "all-courses") {
        return location.pathname === "/admin/academic" && current === item.tab;
      }
      return location.pathname === "/admin" && current === item.tab;
    }
    if (item.end) return location.pathname === item.to;
    if (item.match) return location.pathname.includes(item.match);
    return location.pathname === item.to;
  }

  return (
    <>
      <header className={`app-header${scrolled ? " is-scrolled" : ""}`}>
        {/* divide the header into  two sections ,the right section  the background color is red the right section is blue-black */}
        <div className="app-header__left-section">
          {/* Left section content */}
        </div>
        <div className="app-header__right-section">
          {/* Right section content */}
        </div>

        <div className="app-header__inner">
          <Link
            to={
              user
                ? role === "ADMIN"
                  ? "/admin"
                  : role === "DEPARTMENT_HEAD"
                    ? "/department"
                    : `/${role.toLowerCase()}`
                : "/login"
            }
            className="app-brand"
            aria-label="Class Attendance — go to dashboard"
          >
           
              <span className="app-brand__mark" aria-hidden="true">
                {/* <Icon path={ICONS.classes} /> */}
                Logo
              </span>
              <span className="app-brand__text">
                Class Attendance
                <small>
                  {role
                    ? `${role.charAt(0)}${role.slice(1).toLowerCase()} portal`
                    : "School portal"}
                </small>
              </span>
           
          </Link>
          
            <nav className="app-header__nav" aria-label="Primary">
              {links.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive: active }) =>
                    `nav-link${item.match || active ? " is-active" : ""}`
                  }
                  aria-current={isActive(item) ? "page" : undefined}
                >
                  <Icon path={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="app-header__actions">
              <button
                type="button"
                className={`icon-btn${alertsOn ? " is-active" : ""}`}
                aria-label={
                  alertsOn
                    ? "Notifications — 2 unread (shown)"
                    : "Notifications — 2 unread"
                }
                aria-pressed={alertsOn}
                onClick={() => setAlertsOn((v) => !v)}
              >
                <Icon path={ICONS.bell} />
                {!alertsOn && (
                  <span className="icon-btn__dot" aria-hidden="true" />
                )}
              </button>

              {user ? (
                <>
                  <span className="user-chip">
                    <span className="avatar" aria-hidden="true">
                      {initial}
                    </span>
                    <span className="first-name">{user.name}</span>
                  </span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--logout"
                    aria-label="Log out"
                    title="Log out"
                    onClick={() => setConfirmLogout(true)}
                  >
                    <Icon path={ICONS.logout} />
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn btn--primary btn--sm">
                  Log in
                </Link>
              )}

              <button
                ref={toggleRef}
                type="button"
                className={`hamburger${open ? " is-active" : ""}`}
                aria-label={
                  open ? "Close navigation menu" : "Open navigation menu"
                }
                aria-expanded={open}
                aria-controls="app-sidebar"
                onClick={() => setOpen((v) => !v)}
              >
                <span className="hamburger__bars" aria-hidden="true" />
              </button>
            </div>
          
        </div>
      </header>

      <div
        className={`sidebar__overlay${open ? " is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        ref={sidebarRef}
        className={`sidebar${open ? " is-open" : ""}`}
        aria-label="Navigation"
      >
        <div className="sidebar__header">
          <strong>Navigation</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close navigation menu"
            onClick={() => {
              setOpen(false);
              toggleRef.current?.focus();
            }}
          >
            <Icon path={ICONS.close} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <p className="sidebar__section">Main</p>
          {links.map((item) => (
            <NavLink
              key={`side-${item.label}`}
              to={item.to}
              end={item.end}
              className={`sidebar__link${isActive(item) ? " is-active" : ""}`}
              aria-current={isActive(item) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="icon" aria-hidden="true">
                <Icon path={item.icon} filled />
              </span>
              {item.label}
            </NavLink>
          ))}

          <p className="sidebar__section">Account</p>
          {user && (
            <NavLink
              to={role === "DEPARTMENT_HEAD" ? "/department" : `/${role.toLowerCase()}`}
              className="sidebar__link"
              onClick={() => setOpen(false)}
            >
              <span className="icon" aria-hidden="true">
                <Icon path={ICONS.profile} filled />
              </span>
              Profile
            </NavLink>
          )}
          <span className="sidebar__link">
            <span className="icon" aria-hidden="true">
              <Icon path={ICONS.bell} filled />
            </span>
            Notifications
          </span>
        </nav>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        tone="danger"
        title="Log out of Class Attendance?"
        message={
          user
            ? `You are signed in as ${user.name}. You will need your email and password to sign back in.`
            : "You will need your email and password to sign back in."
        }
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}
