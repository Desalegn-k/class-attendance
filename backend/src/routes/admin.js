const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { generateTempPassword } = require("../lib/tokens");
const { ensureCourseClass } = require("../lib/courseClass");
const router = express.Router();
router.use(requireAuth, requireRole("ADMIN"));

// Wrap async handlers so a thrown/rejected error becomes a normal 500 response
// instead of an unhandled rejection that crashes the whole server.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// List every user
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        collegeId: true,
        departmentId: true,
        academicYearId: true,
        semesterId: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  }),
);

// Change a user's role
const roleSchema = z.object({ role: z.enum(["ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"]) });

router.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    if (req.params.id === req.user.id && parsed.data.role !== "ADMIN") {
      return res
        .status(400)
        .json({ error: "You cannot remove your own admin role" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(user);
  }),
);

// Delete a user, cleaning up everything that references them first
router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (id === req.user.id) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.$transaction(async (tx) => {
      // Records that reference this user as a STUDENT
      await tx.attendanceRecord.deleteMany({ where: { studentId: id } });
      await tx.enrollment.deleteMany({ where: { studentId: id } });

      // If this user is a TEACHER, remove everything under the classes they own
      const ownedClasses = await tx.class.findMany({
        where: { teacherId: id },
        select: { id: true },
      });
      const classIds = ownedClasses.map((c) => c.id);

      if (classIds.length > 0) {
        const ownedSessions = await tx.session.findMany({
          where: { classId: { in: classIds } },
          select: { id: true },
        });
        const sessionIds = ownedSessions.map((s) => s.id);

        if (sessionIds.length > 0) {
          await tx.attendanceRecord.deleteMany({
            where: { sessionId: { in: sessionIds } },
          });
          await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
        }

        await tx.enrollment.deleteMany({
          where: { classId: { in: classIds } },
        });
        await tx.class.deleteMany({ where: { id: { in: classIds } } });
      }

      await tx.user.delete({ where: { id } });
    });

    res.json({ ok: true });
  }),
);

// Overview of all classes (for the admin dashboard)
router.get(
  "/classes",
  asyncHandler(async (req, res) => {
    const classes = await prisma.class.findMany({
      include: {
        teacher: { select: { name: true, email: true } },
        _count: { select: { enrollments: true, sessions: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(classes);
  }),
);
// Every session across every teacher, with computed duration — for auditing
// how long teachers keep attendance sessions open.
router.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      include: {
        class: { include: { teacher: { select: { name: true, email: true } } } },
        _count: { select: { attendanceRecords: true } },
      },
      orderBy: { opensAt: "desc" },
      take: 200,
    });

    const withDuration = sessions.map((s) => ({
      id: s.id,
      className: s.class.name,
      teacherName: s.class.teacher.name,
      teacherEmail: s.class.teacher.email,
      opensAt: s.opensAt,
      closesAt: s.closesAt,
      status: s.status,
      durationSeconds: s.closesAt ? Math.round((new Date(s.closesAt) - new Date(s.opensAt)) / 1000) : null,
      checkIns: s._count.attendanceRecords,
    }));

    res.json(withDuration);
  })
);

// Admin creates an account directly — this replaces public self-registration.
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"]),
  temporaryPassword: z.string().min(8),
  collegeId: z.string().optional(),
  departmentId: z.string().optional(),
  academicYearId: z.string().optional(),
  semesterId: z.string().optional(),
});

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { name, email, role, temporaryPassword, collegeId, departmentId, academicYearId, semesterId } = parsed.data;

    const academicRoles = ["STUDENT", "TEACHER", "DEPARTMENT_HEAD"];
    if (academicRoles.includes(role)) {
      if (!collegeId || !departmentId) {
        return res.status(400).json({ error: "College and department are required for this role" });
      }
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, collegeId: true },
      });
      if (!department || department.collegeId !== collegeId) {
        return res.status(400).json({ error: "Department must belong to the selected college" });
      }
    }
    if (role === "STUDENT") {
      if (!academicYearId || !semesterId) {
        return res.status(400).json({ error: "Academic year and semester are required for students" });
      }
      const [academicYear, semester] = await Promise.all([
        prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true } }),
        prisma.semester.findUnique({ where: { id: semesterId }, select: { id: true } }),
      ]);
      if (!academicYear || !semester) {
        return res.status(400).json({ error: "Invalid academic year or semester" });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        isActive: true,
        mustChangePassword: true,
        collegeId: collegeId || null,
        departmentId: departmentId || null,
        academicYearId: academicYearId || null,
        semesterId: semesterId || null,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    res.status(201).json(user);
  })
);

// Toggle an account active/inactive (e.g. deactivating a graduated student).
// Unlike delete, this never touches their historical data.
const activeSchema = z.object({ isActive: z.boolean() });

router.patch(
  "/users/:id/active",
  asyncHandler(async (req, res) => {
    const parsed = activeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (req.params.id === req.user.id && !parsed.data.isActive) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: parsed.data.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  })
);
// Bulk-create accounts from an admin's spreadsheet import. Any row without
// a password gets one auto-generated; existing emails are skipped, not
// overwritten. Returns a per-row result so the admin can see what happened
// and copy any generated passwords to share with each person.
const bulkUserSchema = z.object({
  users: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"]),
        temporaryPassword: z.string().min(8).optional(),
      })
    )
    .min(1)
    .max(300),
});

// Bulk-create accounts from an admin's spreadsheet import. Each row is
// validated and processed independently, so one bad row (e.g. a password
// that's too short) only gets skipped — it never fails the whole batch.
const bulkRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "DEPARTMENT_HEAD", "TEACHER", "STUDENT"]),
  temporaryPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const bulkRequestSchema = z.object({
  users: z.array(z.record(z.any())).min(1).max(300),
});

router.post(
  "/users/bulk",
  asyncHandler(async (req, res) => {
    const parsedRequest = bulkRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      return res.status(400).json({ error: "No valid rows were provided." });
    }

    const results = [];

    for (const rawEntry of parsedRequest.data.users) {
      const parsedRow = bulkRowSchema.safeParse(rawEntry);
      if (!parsedRow.success) {
        const firstIssue = parsedRow.error.issues[0];
        results.push({
          email: rawEntry?.email || "(unknown)",
          name: rawEntry?.name || "",
          status: "skipped",
          reason: firstIssue?.message || "Invalid row",
        });
        continue;
      }

      const entry = parsedRow.data;
      const existing = await prisma.user.findUnique({ where: { email: entry.email } });
      if (existing) {
        results.push({ email: entry.email, name: entry.name, status: "skipped", reason: "Email already exists" });
        continue;
      }

      const temporaryPassword = entry.temporaryPassword || generateTempPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      await prisma.user.create({
        data: {
          name: entry.name,
          email: entry.email,
          passwordHash,
          role: entry.role,
          isActive: true,
          mustChangePassword: true,
        },
      });

      results.push({
        email: entry.email,
        name: entry.name,
        role: entry.role,
        status: "created",
        temporaryPassword,
      });
    }

    res.status(201).json({ results });
  })
);

const courseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  departmentId: z.string().min(1),
  academicYearId: z.string().min(1),
  semesterId: z.string().min(1),
  teacherId: z.string().min(1),
  assignedClass: z.string().optional().nullable(),
});

router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const courses = await prisma.course.findMany({
      include: {
        department: { include: { college: true } },
        academicYear: true,
        semester: true,
        assignments: { include: { teacher: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(courses);
  }),
);

router.post(
  "/courses",
  asyncHandler(async (req, res) => {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;

    const [department, teacher, academicYear, semester] = await Promise.all([
      prisma.department.findUnique({ where: { id: data.departmentId } }),
      prisma.user.findUnique({ where: { id: data.teacherId } }),
      prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
      prisma.semester.findUnique({ where: { id: data.semesterId } }),
    ]);
    if (!department || !academicYear || !semester) {
      return res.status(400).json({ error: "Invalid department, academic year, or semester" });
    }
    if (!teacher || teacher.role !== "TEACHER" || teacher.departmentId !== department.id) {
      return res.status(400).json({ error: "Teacher must belong to the course department" });
    }

    try {
      const course = await prisma.$transaction(async (tx) => {
        const created = await tx.course.create({
          data: {
            name: data.name,
            code: data.code.toUpperCase(),
            departmentId: data.departmentId,
            academicYearId: data.academicYearId,
            semesterId: data.semesterId,
          },
        });
        const assignment = await tx.courseAssignment.create({
          data: { courseId: created.id, teacherId: data.teacherId, assignedClass: data.assignedClass || null },
        });
        await ensureCourseClass(created, assignment, tx);
        return created;
      });
      res.status(201).json(course);
    } catch (err) {
      if (err.code === "P2002") return res.status(409).json({ error: "Course code already exists or assignment is duplicated" });
      throw err;
    }
  }),
);

router.patch(
  "/courses/:id",
  asyncHandler(async (req, res) => {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;
    const teacher = await prisma.user.findUnique({ where: { id: data.teacherId } });
    if (!teacher || teacher.role !== "TEACHER" || teacher.departmentId !== data.departmentId) {
      return res.status(400).json({ error: "Teacher must belong to the course department" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.update({
        where: { id: req.params.id },
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          departmentId: data.departmentId,
          academicYearId: data.academicYearId,
          semesterId: data.semesterId,
        },
      });
      await tx.courseAssignment.deleteMany({ where: { courseId: course.id } });
      const assignment = await tx.courseAssignment.create({
        data: { courseId: course.id, teacherId: data.teacherId, assignedClass: data.assignedClass || null },
      });
      await ensureCourseClass(course, assignment, tx);
      return course;
    });
    res.json(result);
  }),
);

router.delete(
  "/courses/:id",
  asyncHandler(async (req, res) => {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

module.exports = router;
