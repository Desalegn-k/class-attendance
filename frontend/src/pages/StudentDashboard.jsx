import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { logout } from "../lib/api";
import Header from "../components/Header";
import "./Student.css";

export default function StudentDashboard() {
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data));
  }, []);

  return (
    <div className="max-w-xl mx-auto page-body student-dashboard">
      <Header title="Your Classes" />

      <div className="flex gap-3 mb-6">
        <Link
          to="/check-in"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Check in to a session
        </Link>
        <Link
          to="/my-attendance"
          className="bg-gray-800 text-white px-4 py-2 rounded-lg"
        >
          My attendance
        </Link>
      </div>

      <ul className="divide-y bg-white border rounded-lg">
        {classes.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <div className="font-medium">{c.name}</div>
            <div className="text-sm text-gray-500">{c.subject}</div>
          </li>
        ))}
        {classes.length === 0 && (
          <li className="px-4 py-3 text-gray-500">
            Not enrolled in any classes yet
          </li>
        )}
      </ul>
    </div>
  );
}
