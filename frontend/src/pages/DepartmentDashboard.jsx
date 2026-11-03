import { useEffect, useState } from "react";
import api from "../lib/api";
import Header from "../components/Header";

export default function DepartmentDashboard() {
  const [data, setData] = useState({ students: [], teachers: [], courses: [] });
  const [options, setOptions] = useState({ academicYears: [], semesters: [] });
  const [filters, setFilters] = useState({ academicYearId: "", semesterId: "" });
  const [error, setError] = useState("");

  async function load() {
    try {
      const params = {};
      if (filters.academicYearId) params.academicYearId = filters.academicYearId;
      if (filters.semesterId) params.semesterId = filters.semesterId;
      const [dashboard, opts] = await Promise.all([
        api.get("/academic/department/dashboard", { params }),
        api.get("/academic/options"),
      ]);
      setData(dashboard.data);
      setOptions(opts.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load department data");
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [filters.academicYearId, filters.semesterId]);

  return (
    <div className="max-w-6xl mx-auto page-body">
      <Header title="Department Dashboard" subtitle="Students, teachers, and courses in your department" />
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="border rounded-lg px-3 py-2" value={filters.academicYearId} onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value })}>
          <option value="">All academic years</option>
          {options.academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2" value={filters.semesterId} onChange={(e) => setFilters({ ...filters, semesterId: e.target.value })}>
          <option value="">All semesters</option>
          {options.semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
        </select>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 mb-6">
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Students ({data.students.length})</h2>
          <div className="space-y-2">{data.students.map((student) => <div key={student.id} className="border-b pb-2"><div className="font-medium">{student.name}</div><div className="text-sm text-gray-500">{student.email}</div></div>)}</div>
          {data.students.length === 0 && <p className="text-gray-500">No students match these filters.</p>}
        </section>
        <section className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Teachers ({data.teachers.length})</h2>
          <div className="space-y-2">{data.teachers.map((teacher) => <div key={teacher.id} className="border-b pb-2"><div className="font-medium">{teacher.name}</div><div className="text-sm text-gray-500">{teacher.email}</div></div>)}</div>
          {data.teachers.length === 0 && <p className="text-gray-500">No teachers in this department.</p>}
        </section>
      </div>
      <section className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Courses ({data.courses.length})</h2>
        <div className="grid gap-3 md:grid-cols-2">{data.courses.map((course) => <article key={course.id} className="border rounded-lg p-4"><div className="font-medium">{course.name} ({course.code})</div><div className="text-sm text-gray-500">{course.academicYear?.name} · {course.semester?.name}</div><div className="text-sm mt-1">{course.assignments.map((a) => a.teacher.name).join(", ") || "No teacher assigned"}</div></article>)}</div>
        {data.courses.length === 0 && <p className="text-gray-500">No courses registered for this department.</p>}
      </section>
    </div>
  );
}
