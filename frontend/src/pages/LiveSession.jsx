import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import api from "../lib/api";
import SessionTimer from "../components/SessionTimer";

export default function LiveSession() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [inRange, setInRange] = useState(true);
  const socketRef = useRef(null);

  async function load() {
    const { data } = await api.get(`/sessions/${id}`);
    setSession(data);
  }

  useEffect(() => {
    load();

    const socket = io(
      import.meta.env.VITE_API_URL?.replace("/api", "") ||
        "http://localhost:4000",
    );
    socketRef.current = socket;
    socket.emit("session:join", id);

    socket.on("attendance:update", () => load());
    socket.on("session:closed", (data) => {
      load();
      if (data?.reason === "teacher_disconnected") {
        alert(
          "This session was automatically closed because the live view lost connection for too long.",
        );
      } else if (data?.reason === "teacher_never_joined") {
        alert(
          "This session was automatically closed because the live view was never opened after it started.",
        );
      } else if (data?.reason === "teacher_left_area") {
        alert(
          "This session was automatically closed because your device moved away from the classroom location.",
        );
      }
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Every ~90s, silently re-check the teacher's GPS to confirm they're still
  // physically near the classroom (not just that the tab is connected).
  useEffect(() => {
    if (!session || session.status !== "OPEN" || !navigator.geolocation) return;

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { data } = await api.patch(`/sessions/${id}/presence`, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setInRange(data.inRange);
          } catch {
            // ignore transient network errors — next heartbeat will retry
          }
        },
        () => setInRange(false), // permission revoked / unavailable — treat as a miss
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }, 90 * 1000);

    return () => clearInterval(interval);
  }, [session?.status, id]);

  async function closeSession() {
    await api.patch(`/sessions/${id}/close`);
    load();
  }

  if (!session) return <div className="page-body">Loading…</div>;

  const present = session.attendanceRecords.filter(
    (r) => r.status === "PRESENT",
  ).length;
  const late = session.attendanceRecords.filter(
    (r) => r.status === "LATE",
  ).length;

  return (
    <div className="max-w-xl mx-auto page-body teacher-dashboard">
      <Link
        to={`/teacher/classes/${session.classId}`}
        className="text-sm text-blue-600"
      >
        ← Back to class
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{session.class.name}</h1>
      <SessionTimer
        opensAt={session.opensAt}
        closesAt={session.closesAt}
        status={session.status}
      />
      <p className="text-gray-500 mb-6">
        Status: <span className="font-medium">{session.status}</span> · Code:{" "}
        <span className="font-mono text-lg">{session.code}</span>
      </p>

      {session.status === "OPEN" && !inRange && (
        <p className="text-sm text-orange-600 mb-4">
          ⚠️ Your device appears to be away from the classroom location — the
          session will auto-close if this continues.
        </p>
      )}

      {session.qrDataUrl && (
        <img
          src={session.qrDataUrl}
          alt="Check-in QR code"
          className="w-56 h-56 mb-6"
        />
      )}

      {session.status === "OPEN" && (
        <button
          onClick={closeSession}
          className="bg-red-600 text-white px-4 py-2 rounded-lg mb-6"
        >
          End session now
        </button>
      )}

      <p className="text-sm text-gray-600 mb-2">
        {present} present · {late} late · {session.attendanceRecords.length}{" "}
        total records
      </p>

      <ul className="divide-y bg-white border rounded-lg">
        {session.attendanceRecords.map((r) => (
          <li key={r.id} className="px-4 py-2 flex justify-between">
            <span>{r.student.name}</span>
            <span className="text-sm uppercase text-gray-500">{r.status}</span>
          </li>
        ))}
        {session.attendanceRecords.length === 0 && (
          <li className="px-4 py-2 text-gray-500">No check-ins yet</li>
        )}
      </ul>
    </div>
  );
}
