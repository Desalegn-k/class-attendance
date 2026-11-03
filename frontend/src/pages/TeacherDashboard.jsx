import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import Header from "../components/Header";
import "./Teacher.css";

export default function TeacherDashboard() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/academic/teacher/courses")
      .then(({ data }) => setClasses(data))
      .catch((err) => setError(err.response?.data?.error || "Could not load assigned courses"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto page-body teacher-dashboard">
      <Header title="My Assigned Courses" subtitle="Courses assigned by your administrator" />
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading courses...</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((course) => (
          <Link
            key={course.assignmentId}
            to={`/teacher/classes/${course.classId}`}
            className="block bg-white border rounded-xl px-5 py-4 shadow-sm"
          >
            <div className="font-semibold text-lg">{course.name}</div>
            <div className="text-sm text-blue-700 font-medium">{course.code}</div>
            <div className="text-sm text-gray-500 mt-1">
              {course.department?.name} · {course.academicYear?.name || "Academic year not set"} · {course.semester?.name || "Semester not set"}
            </div>
            <div className="mt-2 text-sm">Assigned class: {course.assignedClass || "Not specified"}</div>
            <div className="mt-3 text-sm font-semibold text-blue-600">Open course to start attendance</div>
          </Link>
        ))}
        {!loading && classes.length === 0 && (
          <div className="md:col-span-2 rounded-xl border border-dashed p-8 text-center text-gray-500">
            No courses have been assigned to you.
          </div>
        )}
      </div>
    </div>
  );
}
