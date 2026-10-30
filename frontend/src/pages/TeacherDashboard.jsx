import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { logout } from "../lib/api";
import Header from "../components/Header";
import "./Teacher.css";

export default function TeacherDashboard() {
  const [classes, setClasses] = useState([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");

  async function load() {
    const { data } = await api.get("/classes");
    setClasses(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function createClass(e) {
    e.preventDefault();
    await api.post("/classes", { name, subject });
    setName("");
    setSubject("");
    load();
  }

  return (
    <div className="max-w-2xl mx-auto page-body teacher-dashboard">
      <Header title="Your Classes" />

      <form onSubmit={createClass} className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Class name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-4 rounded-lg">
          Create
        </button>
      </form>

      <div className="space-y-2">
        {classes.map((c) => (
          <Link
            key={c.id}
            to={`/teacher/classes/${c.id}`}
            className="block bg-white border rounded-lg px-4 py-3 hover:border-blue-400"
          >
            <div className="font-medium">{c.name}</div>
            <div className="text-sm text-gray-500">
              {c.subject || "No subject"} · {c._count?.enrollments ?? 0}{" "}
              students
            </div>
          </Link>
        ))}
        {classes.length === 0 && (
          <p className="text-gray-500">No classes yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
