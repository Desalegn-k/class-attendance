const express = require("express");
const QRCode = require("qrcode");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { generateShortCode, generateQrToken } = require("../lib/tokens");
const { distanceMeters } = require("../lib/geo");
const { closeSession } = require("../lib/closeSession");

const router = express.Router();
router.use(requireAuth);

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---- Start a session for a class (teacher only) ----
// Sessions no longer have a fixed duration — they stay OPEN until the
// teacher explicitly closes them via PATCH /sessions/:id/close (or until
// auto-close kicks in — see index.js for the presence/disconnect logic).
const startSessionSchema = z.object({
  gracePeriodSec: z.number().int().nonnegative().max(3600).default(300),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.number().int().positive().max(500).default(50),
});

router.post(
  "/classes/:classId/sessions",
  requireRole("TEACHER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = startSessionSchema.safeParse(req.body || {});
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const cls = await prisma.class.findUnique({
      where: { id: req.params.classId },
    });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (cls.teacherId !== req.user.id && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only the class owner can start a session" });
    }

    const { gracePeriodSec, latitude, longitude, radiusMeters } = parsed.data;
    const opensAt = new Date();

    let session;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        session = await prisma.session.create({
          data: {
            classId: cls.id,
            code: generateShortCode(),
            qrToken: generateQrToken(),
            opensAt,
            closesAt: null, // set only when the session ends (manually or auto)
            gracePeriodSec,
            latitude,
            longitude,
            radiusMeters,
          },
        });
        break;
      } catch (err) {
        if (err.code !== "P2002") throw err;
      }
    }
    if (!session)
      return res
        .status(500)
        .json({ error: "Could not create a unique session code, try again" });

    // Safety net: if the teacher's live-session view never connects (crash,
    // closed too fast), auto-close this session after a couple of minutes.
    req.app.get("sessionPresence")?.scheduleNeverJoined(session.id);

    const checkInUrl = `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/check-in?session=${session.id}&token=${session.qrToken}`;
    const qrDataUrl = await QRCode.toDataURL(checkInUrl);

    res.status(201).json({ ...session, checkInUrl, qrDataUrl });
  }),
);

// ---- Close a session (teacher only, or triggered automatically) ----
router.patch(
  "/sessions/:id/close",
  requireRole("TEACHER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { class: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.class.teacherId !== req.user.id && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only the class owner can close this session" });
    }
    if (session.status === "CLOSED") {
      return res.status(409).json({ error: "This session is already closed" });
    }

    const updated = await closeSession(session.id);

    const io = req.app.get("io");
    io?.to(`session:${session.id}`).emit("session:closed", {
      sessionId: session.id,
      closesAt: updated.closesAt,
    });

    res.json(updated);
  }),
);

// ---- Periodic GPS presence heartbeat from the teacher's live session view ----
// Confirms the teacher's device is still physically near where the session
// was started, not just that a browser tab is connected.
const HEARTBEAT_RENEW_MS = 3 * 60 * 1000; // in range: push the auto-close deadline out by this much
const OUT_OF_RANGE_GRACE_MS = 60 * 1000; // out of range: shorter grace before closing

const presenceSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

router.patch(
  "/sessions/:id/presence",
  requireRole("TEACHER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = presenceSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { class: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.class.teacherId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Not authorized for this session" });
    }
    if (session.status !== "OPEN") {
      return res.json({ inRange: null, sessionStatus: session.status });
    }

    const presence = req.app.get("sessionPresence");

    if (session.latitude == null || session.longitude == null) {
      return res.json({ inRange: null, sessionStatus: session.status });
    }

    const dist = distanceMeters(
      session.latitude,
      session.longitude,
      parsed.data.latitude,
      parsed.data.longitude,
    );
    const inRange = dist <= (session.radiusMeters ?? 50);

    if (inRange) {
      presence?.renew(`gps:${session.id}`, session.id, HEARTBEAT_RENEW_MS);
      await prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      presence?.renew(`gps:${session.id}`, session.id, OUT_OF_RANGE_GRACE_MS);
    }

    res.json({ inRange, sessionStatus: session.status });
  }),
);

// ---- Get session status + live records ----
router.get(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        class: true,
        attendanceRecords: {
          include: {
            student: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const isOwner = session.class.teacherId === req.user.id;
    if (!isOwner && req.user.role !== "ADMIN" && req.user.role !== "STUDENT") {
      return res
        .status(403)
        .json({ error: "Not authorized to view this session" });
    }

    const checkInUrl = `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/check-in?session=${session.id}&token=${session.qrToken}`;
    const qrDataUrl = await QRCode.toDataURL(checkInUrl);

    res.json({ ...session, checkInUrl, qrDataUrl });
  }),
);

// ---- Student check-in ----
const checkInSchema = z.object({
  code: z.string().optional(),
  token: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

router.post(
  "/sessions/check-in",
  requireRole("STUDENT"),
  asyncHandler(async (req, res) => {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const { code, token, latitude, longitude } = parsed.data;

    if (!code && !token) {
      return res
        .status(400)
        .json({ error: "Provide either a session code or a QR token" });
    }

    const session = await prisma.session.findFirst({
      where: token ? { qrToken: token } : { code: code.toUpperCase() },
      include: { class: true },
    });
    if (!session)
      return res.status(404).json({ error: "Invalid or unknown session code" });

    if (session.status !== "OPEN") {
      return res
        .status(410)
        .json({ error: "This attendance session is closed" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        classId_studentId: { classId: session.classId, studentId: req.user.id },
      },
    });
    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You are not enrolled in this class" });
    }
    if (
      session.radiusMeters &&
      session.latitude != null &&
      session.longitude != null
    ) {
      if (latitude == null || longitude == null) {
        return res
          .status(400)
          .json({ error: "This session requires your location to check in" });
      }
      const dist = distanceMeters(
        session.latitude,
        session.longitude,
        latitude,
        longitude,
      );
      if (dist > session.radiusMeters) {
        return res.status(403).json({
          error: "You appear to be outside the allowed check-in area",
        });
      }
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentId: { sessionId: session.id, studentId: req.user.id },
      },
    });
    if (existing && existing.checkedInAt) {
      return res
        .status(409)
        .json({ error: "You have already checked in for this session" });
    }

    const now = new Date();
    const graceDeadline = new Date(
      session.opensAt.getTime() + session.gracePeriodSec * 1000,
    );
    const status = now <= graceDeadline ? "PRESENT" : "LATE";

    await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: { sessionId: session.id, studentId: req.user.id },
      },
      update: { status, checkedInAt: now },
      create: {
        sessionId: session.id,
        studentId: req.user.id,
        status,
        checkedInAt: now,
      },
    });

    const io = req.app.get("io");
    io?.to(`session:${session.id}`).emit("attendance:update", {
      sessionId: session.id,
      studentId: req.user.id,
      studentName: req.user.name,
      status,
      checkedInAt: now,
    });

    res.status(201).json({
      status,
      checkedInAt: now,
      class: session.class.name,
      opensAt: session.opensAt,
      closesAt: session.closesAt, // still null — session is open until it ends
      sessionStatus: session.status,
    });
  }),
);

// ---- Manual override by teacher ----
const overrideSchema = z.object({
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
  note: z.string().optional(),
});

router.patch(
  "/sessions/:sessionId/records/:studentId",
  requireRole("TEACHER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
      include: { class: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.class.teacherId !== req.user.id && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only the class owner can edit attendance" });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: req.params.studentId,
        },
      },
      update: { status: parsed.data.status, note: parsed.data.note },
      create: {
        sessionId: session.id,
        studentId: req.params.studentId,
        status: parsed.data.status,
        note: parsed.data.note,
      },
    });

    res.json(record);
  }),
);

// ---- CSV export for a class's attendance ----
router.get(
  "/classes/:classId/report.csv",
  requireRole("TEACHER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.classId },
      include: {
        sessions: { orderBy: { opensAt: "asc" } },
        enrollments: { include: { student: true } },
      },
    });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (cls.teacherId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { session: { classId: cls.id } },
    });
    const bySessionStudent = new Map(
      records.map((r) => [`${r.sessionId}:${r.studentId}`, r]),
    );

    const header = [
      "Student Name",
      "Student Email",
      ...cls.sessions.map((s) => s.opensAt.toISOString()),
    ];
    const rows = cls.enrollments.map((e) => {
      const cells = cls.sessions.map((s) => {
        const rec = bySessionStudent.get(`${s.id}:${e.studentId}`);
        return rec ? rec.status : "ABSENT";
      });
      return [e.student.name, e.student.email, ...cells];
    });

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${cls.name}-attendance.csv"`,
    );
    res.send(csv);
  }),
);

function csvEscape(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

module.exports = router;
