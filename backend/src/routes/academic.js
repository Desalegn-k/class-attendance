const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get("/options", asyncHandler(async (req, res) => {
  const [colleges, departments, academicYears, semesters] = await Promise.all([
    prisma.college.findMany({ include: { departments: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ include: { college: true }, orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.semester.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  res.json({ colleges, departments, academicYears, semesters });
}));

router.get("/department/dashboard", requireRole("DEPARTMENT_HEAD"), asyncHandler(async (req, res) => {
  const head = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { departmentId: true },
  });
  if (!head?.departmentId) return res.status(403).json({ error: "No department is assigned to this account" });

  const departmentWhere = { departmentId: head.departmentId };
  const [students, teachers, courses] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", ...departmentWhere, ...(req.query.academicYearId ? { academicYearId: String(req.query.academicYearId) } : {}), ...(req.query.semesterId ? { semesterId: String(req.query.semesterId) } : {}) },
      select: { id: true, name: true, email: true, isActive: true, collegeId: true, departmentId: true, academicYearId: true, semesterId: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER", ...departmentWhere },
      select: { id: true, name: true, email: true, isActive: true, departmentId: true },
      orderBy: { name: "asc" },
    }),
    prisma.course.findMany({
      where: { departmentId: head.departmentId },
      include: { department: true, academicYear: true, semester: true, assignments: { include: { teacher: { select: { id: true, name: true, email: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  res.json({ students, teachers, courses });
}));

router.get("/teacher/courses", requireRole("TEACHER"), asyncHandler(async (req, res) => {
  const assignments = await prisma.courseAssignment.findMany({
    where: { teacherId: req.user.id },
    include: {
      course: {
        include: { department: { include: { college: true } }, academicYear: true, semester: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(assignments.map((assignment) => ({
    assignmentId: assignment.id,
    assignedClass: assignment.assignedClass,
    id: assignment.course.id,
    name: assignment.course.name,
    code: assignment.course.code,
    department: assignment.course.department,
    academicYear: assignment.course.academicYear,
    semester: assignment.course.semester,
  })));
}));

module.exports = router;
