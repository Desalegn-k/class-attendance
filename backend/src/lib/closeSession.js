const prisma = require("./prisma");

async function markAbsentees(sessionId, classId) {
  const enrolled = await prisma.enrollment.findMany({ where: { classId } });
  const existing = await prisma.attendanceRecord.findMany({
    where: { sessionId },
  });
  const existingIds = new Set(existing.map((r) => r.studentId));

  const missing = enrolled.filter((e) => !existingIds.has(e.studentId));
  if (missing.length === 0) return;

  await prisma.attendanceRecord.createMany({
    data: missing.map((e) => ({
      sessionId,
      studentId: e.studentId,
      status: "ABSENT",
    })),
  });
}

// Closes a session if it's still open. Returns the updated session, or null
// if it was already closed (so callers can tell whether anything happened).
async function closeSession(sessionId) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== "OPEN") return null;

  const closesAt = new Date();
  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { status: "CLOSED", closesAt },
  });

  await markAbsentees(sessionId, session.classId);
  return updated;
}

module.exports = { closeSession, markAbsentees };
