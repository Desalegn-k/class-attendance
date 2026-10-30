const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// A student's own attendance history, with a running percentage
router.get("/me/attendance", async (req, res) => {
  if (req.user.role !== "STUDENT") {
    return res.status(403).json({ error: "Only students have attendance history" });
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: req.user.id },
    include: { session: { include: { class: true } } },
    orderBy: { session: { opensAt: "desc" } },
  });

  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const percentage = total === 0 ? null : Math.round((present / total) * 1000) / 10;

  res.json({
    percentage,
    records: records.map((r) => ({
      id: r.id,
      className: r.session.class.name,
      sessionOpensAt: r.session.opensAt,
      status: r.status,
      checkedInAt: r.checkedInAt,
    })),
  });
});

module.exports = router;
