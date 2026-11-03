import { useEffect, useState } from "react";
import api from "../lib/api";
import Header from "../components/Header";

const blank = { name: "", code: "", departmentId: "", academicYearId: "", semesterId: "", teacherId: "", assignedClass: "" };

export default function AcademicAdmin() {
  const [options, setOptions] = useState({ departments: [], academicYears: [], semesters: [] });
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [opts, users, courseList] = await Promise.all([
        api.get("/academic/options"),
        api.get("/admin/users"),
        api.get("/admin/courses"),
      ]);
      setOptions(opts.data);
      setTeachers(users.data.filter((user) => user.role === "TEACHER"));
      setCourses(courseList.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load academic data");
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError(""); setMessage("");
    try {
      if (editingId) await api.patch(`/admin/courses/${editingId}`, form);
      else await api.post("/admin/courses", form);
      setMessage(editingId ? "Course assignment updated" : "Course registered and assigned");
      setEditingId(""); setForm(blank); load();
    } catch (err) {
      const detail = err.response?.data?.error;
      setError(typeof detail === "string" ? detail : "Could not save course");
    }
  }

  function edit(course) {
    setEditingId(course.id);
    setForm({
      name: course.name, code: course.code, departmentId: course.departmentId,
      academicYearId: course.academicYearId || "", semesterId: course.semesterId || "",
      teacherId: course.assignments?.[0]?.teacher?.id || "", assignedClass: course.assignments?.[0]?.assignedClass || "",
    });
  }
  async function remove(id) {
    if (!window.confirm("Remove this course and its teacher assignment?")) return;
    await api.delete(`/admin/courses/${id}`);
    load();
  }

  const departmentTeachers = teachers.filter((teacher) => !form.departmentId || teacher.departmentId === form.departmentId);

  return (
    <div className="max-w-6xl mx-auto page-body">
      <Header title="Course Management" subtitle="Register courses and assign teachers" />
      <form onSubmit={submit} className="bg-white border rounded-xl p-5 mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <input className="border rounded-lg px-3 py-2" placeholder="Course name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
        <input className="border rounded-lg px-3 py-2" placeholder="Course code" value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} required />
        <select className="border rounded-lg px-3 py-2" value={form.departmentId} onChange={(e) => setForm({...form, departmentId: e.target.value, teacherId: ""})} required><option value="">Department</option>{options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select className="border rounded-lg px-3 py-2" value={form.academicYearId} onChange={(e) => setForm({...form, academicYearId: e.target.value})} required><option value="">Academic year</option>{options.academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
        <select className="border rounded-lg px-3 py-2" value={form.semesterId} onChange={(e) => setForm({...form, semesterId: e.target.value})} required><option value="">Semester</option>{options.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="border rounded-lg px-3 py-2" value={form.teacherId} onChange={(e) => setForm({...form, teacherId: e.target.value})} required><option value="">Assigned teacher</option>{departmentTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Assigned class (optional)" value={form.assignedClass} onChange={(e) => setForm({...form, assignedClass: e.target.value})} />
        <button className="bg-blue-600 text-white rounded-lg px-4 py-2">{editingId ? "Update course" : "Register course"}</button>
      </form>
      {message && <p className="text-green-700 mb-4">{message}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="w-full text-left"><thead className="bg-gray-50"><tr><th className="p-3">Course</th><th className="p-3">Department</th><th className="p-3">Academic</th><th className="p-3">Teacher</th><th className="p-3">Actions</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id} className="border-t"><td className="p-3"><div className="font-medium">{course.name}</div><div className="text-sm text-gray-500">{course.code}</div></td><td className="p-3">{course.department?.name}</td><td className="p-3">{course.academicYear?.name || "—"} · {course.semester?.name || "—"}</td><td className="p-3">{course.assignments?.map((a) => a.teacher.name).join(", ") || "—"}</td><td className="p-3 whitespace-nowrap"><button className="text-blue-600 mr-3" onClick={() => edit(course)}>Edit</button><button className="text-red-600" onClick={() => remove(course.id)}>Remove</button></td></tr>)}</tbody></table>
        {courses.length === 0 && <p className="p-6 text-center text-gray-500">No courses registered.</p>}
      </div>
    </div>
  );
}
