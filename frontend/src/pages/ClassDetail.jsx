import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../lib/api";
import TablePagination from "../components/TablePagination";

const PAGE_SIZE = 15;

function paginate(items, page) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

export default function ClassDetail() {
  const { id } = useParams();
  const [cls, setCls] = useState(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [rosterPage, setRosterPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [startingSession, setStartingSession] = useState(false);
  const navigate = useNavigate();

  async function load() {
    const { data } = await api.get(`/classes/${id}`);
    setCls(data);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function enroll(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/classes/${id}/enroll`, { studentEmail });
      setStudentEmail("");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not enroll student");
    }
  }

  // async function startSession() {
  //   const { data } = await api.post(`/classes/${id}/sessions`, {
  //     gracePeriodSec: 300,
  //   });
  //   navigate(`/teacher/sessions/${data.id}`);
  // }
async function startSession() {
  setLocationError("");
  setStartingSession(true);

  if (!navigator.geolocation) {
    setLocationError(
      "Your browser doesn't support location. Attendance sessions require it.",
    );
    setStartingSession(false);
    return;
  }

  let position;
  try {
    position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
      });
    });
  } catch (err) {
    setLocationError(
      "Location access is required to start a session — please allow location permission and try again.",
    );
    setStartingSession(false);
    return;
  }

  try {
    const { data } = await api.post(`/classes/${id}/sessions`, {
      gracePeriodSec: 300,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      radiusMeters: 50,
    });
    navigate(`/teacher/sessions/${data.id}`);
    // not resetting setStartingSession(false) here on purpose — the page is
    // about to navigate away, so the spinner just stays until that happens
  } catch (err) {
    setLocationError(
      err.response?.data?.error ||
        "Could not start the session, please try again.",
    );
    setStartingSession(false);
  }
}
  async function downloadReport() {
    // Plain <a href> can't send the auth header, so fetch as a blob instead.
    const { data } = await api.get(`/classes/${id}/report.csv`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cls.name}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!cls) return <div className="page-body">Loading…</div>;

  const roster = cls.enrollments;
  const pastSessions = cls.sessions;

  return (
    <div className="max-w-2xl mx-auto page-body teacher-dashboard">
      <Link to="/teacher" className="text-sm text-blue-600">
        ← All classes
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{cls.name}</h1>
      <p className="text-gray-500 mb-6">{cls.subject}</p>

      <button
        onClick={startSession}
        disabled={startingSession}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg mb-8 flex items-center gap-2 disabled:opacity-70"
      >
        {startingSession && (
          <span className="spinner" aria-label="Starting session" />
        )}
        {startingSession ? "Starting…" : "Start attendance session"}
      </button>
      {locationError && (
        <p className="text-sm text-red-600 mb-4">{locationError}</p>
      )}

      <h2 className="font-semibold mb-2">Roster</h2>
      <form onSubmit={enroll} className="flex gap-2 mb-3">
        <input
          type="email"
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Student email"
          value={studentEmail}
          onChange={(e) => setStudentEmail(e.target.value)}
          required
        />
        <button className="bg-gray-800 text-white px-4 rounded-lg">
          Enroll
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <ul className="mb-8 divide-y bg-white border rounded-lg">
        {paginate(roster, rosterPage).map((e) => (
          <li key={e.id} className="px-4 py-2">
            {e.student.name}{" "}
            <span className="text-gray-400 text-sm">({e.student.email})</span>
          </li>
        ))}
        {roster.length === 0 && (
          <li className="px-4 py-2 text-gray-500">No students enrolled yet</li>
        )}
      </ul>

      <TablePagination
        total={roster.length}
        page={rosterPage}
        pageSize={PAGE_SIZE}
        onPageChange={setRosterPage}
        label="students"
      />

      <h2 className="font-semibold mb-2 mt-8">Past sessions</h2>
      <div className="space-y-2 mb-4">
        {paginate(pastSessions, sessionPage).map((s) => (
          <Link
            key={s.id}
            to={`/teacher/sessions/${s.id}`}
            className="block bg-white border rounded-lg px-4 py-2 hover:border-blue-400"
          >
            {new Date(s.opensAt).toLocaleString()} ·{" "}
            <span className="uppercase text-xs">{s.status}</span>
          </Link>
        ))}
        {pastSessions.length === 0 && (
          <p className="text-gray-500">No sessions yet</p>
        )}
      </div>

      <TablePagination
        total={pastSessions.length}
        page={sessionPage}
        pageSize={PAGE_SIZE}
        onPageChange={setSessionPage}
        label="sessions"
      />

      <button onClick={downloadReport} className="text-sm text-blue-600">
        Download attendance report (CSV)
      </button>
    </div>
  );
}
