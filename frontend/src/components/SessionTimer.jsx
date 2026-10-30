import { useEffect, useState } from "react";
import "./SessionTimer.css";

function formatClock(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Shows the fixed start time. While the session is OPEN, shows a live
 * elapsed counter (no countdown — sessions no longer auto-close on a timer).
 * Once CLOSED, shows the fixed end time and the total duration it stayed open.
 */
export default function SessionTimer({ opensAt, closesAt, status }) {
  const [now, setNow] = useState(new Date());
  const isOpen = status === "OPEN";

  useEffect(() => {
    if (!isOpen) return; // no need to tick once closed — the duration is fixed
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const opens = new Date(opensAt);
  const closes = closesAt ? new Date(closesAt) : null;
  const elapsedMs = (closes || now) - opens;

  return (
    <div className="session-timer">
      <div className="timer-row">
        <span className="timer-label">Started at</span>
        <span className="timer-fixed">{formatClock(opens)}</span>
      </div>

      {closes ? (
        <div className="timer-row">
          <span className="timer-label">Ended at</span>
          <span className="timer-fixed">{formatClock(closes)}</span>
        </div>
      ) : (
        <div className="timer-row">
          <span className="timer-label">Status</span>
          <span className="timer-live timer-open">Open</span>
        </div>
      )}

      <div className="timer-row">
        <span className="timer-label">
          {isOpen ? "Elapsed" : "Total duration"}
        </span>
        <span className={`timer-live ${!isOpen ? "timer-closed" : ""}`}>
          {formatDuration(elapsedMs)}
        </span>
      </div>
    </div>
  );
}
