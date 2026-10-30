const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { generateTempPassword } = require("../lib/tokens");
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
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  }),
);

// Change a user's role
const roleSchema = z.object({ role: z.enum(["ADMIN", "TEACHER", "STUDENT"]) });

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
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
  temporaryPassword: z.string().min(8),
});

router.post(
  "/users",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { name, email, role, temporaryPassword } = parsed.data;

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
        role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
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
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
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

module.exports = router;
