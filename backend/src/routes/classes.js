const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Create a class (teacher only)
const createClassSchema = z.object({
  name: z.string().min(1),
  subject: z.string().optional(),
});

router.post("/", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const cls = await prisma.class.create({
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      teacherId: req.user.id,
    },
  });
  res.status(201).json(cls);
});

// List classes: teacher sees classes they teach, student sees classes they're enrolled in
router.get("/", async (req, res) => {
  if (req.user.role === "TEACHER") {
    const classes = await prisma.class.findMany({
      where: { teacherId: req.user.id },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json(classes);
  }

  if (req.user.role === "STUDENT") {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.id },
      include: { class: true },
    });
    return res.json(enrollments.map((e) => e.class));
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "You do not have permission to list all classes" });
  }

  const classes = await prisma.class.findMany({ orderBy: { createdAt: "desc" } });
  res.json(classes);
});

// Class detail: roster + recent sessions
router.get("/:id", async (req, res) => {
  const cls = await prisma.class.findUnique({
    where: { id: req.params.id },
    include: {
      enrollments: { include: { student: { select: { id: true, name: true, email: true } } } },
      sessions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!cls) return res.status(404).json({ error: "Class not found" });

  const isOwner = req.user.role === "TEACHER" && cls.teacherId === req.user.id;
  const isEnrolled = cls.enrollments.some((e) => e.student.id === req.user.id);
  if (!isOwner && !isEnrolled && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "You do not have access to this class" });
  }

  res.json(cls);
});

// Enroll a student in a class (teacher only, by student email)
const enrollSchema = z.object({ studentEmail: z.string().email() });

router.post("/:id/enroll", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
  if (!cls) return res.status(404).json({ error: "Class not found" });
  if (cls.teacherId !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only the class owner can enroll students" });
  }

  const student = await prisma.user.findUnique({ where: { email: parsed.data.studentEmail } });
  if (!student || student.role !== "STUDENT") {
    return res.status(404).json({ error: "No student found with that email" });
  }
  try {
    const enrollment = await prisma.enrollment.create({
      data: { classId: cls.id, studentId: student.id },
    });
    res.status(201).json(enrollment);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Student is already enrolled in this class" });
    }
    throw err;
  }
});

module.exports = router;
