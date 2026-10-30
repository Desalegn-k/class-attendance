import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function MyAttendance() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/students/me/attendance").then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="page-body">Loading…</div>;

  return (
    <div className="max-w-xl mx-auto page-body teacher-dashboard">
      <Link to="/student" className="text-sm text-blue-600">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">My Attendance</h1>
      <p className="text-gray-500 mb-6">
        Overall: {data.percentage == null ? "—" : `${data.percentage}%`}
      </p>

      <ul className="divide-y bg-white border rounded-lg">
        {data.records.map((r) => (
          <li key={r.id} className="px-4 py-3 flex justify-between">
            <div>
              <div className="font-medium">{r.className}</div>
              <div className="text-sm text-gray-500">
                {new Date(r.sessionOpensAt).toLocaleString()}
              </div>
            </div>
            <span className="text-sm uppercase text-gray-500 self-center">
              {r.status}
            </span>
          </li>
        ))}
        {data.records.length === 0 && (
          <li className="px-4 py-3 text-gray-500">No records yet</li>
        )}
      </ul>
    </div>
  );
}
