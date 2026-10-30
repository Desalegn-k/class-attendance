const prisma = require("./prisma");
const { closeSession } = require("./closeSession");

// If a session hasn't had any proof-of-life (socket join or a good GPS
// heartbeat) in this long, treat it as abandoned and close it — this is
// what catches a session left open across a server restart, crash, or the
// host machine being shut down, none of which the in-memory timers survive.
const STALE_MS = 3 * 60 * 1000; // 3 minutes

async function sweepStaleSessions(io) {
  const staleCutoff = new Date(Date.now() - STALE_MS);

  const stale = await prisma.session.findMany({
    where: { status: "OPEN", lastSeenAt: { lt: staleCutoff } },
  });

  for (const session of stale) {
    const updated = await closeSession(session.id);
    if (updated) {
      io?.to(`session:${session.id}`).emit("session:closed", {
        sessionId: session.id,
        closesAt: updated.closesAt,
        reason: "stale_abandoned",
      });
      console.log(`Session ${session.id} auto-closed (stale_abandoned)`);
    }
  }
}

// Runs once immediately (catches anything abandoned before this server start,
// e.g. across a crash/reboot) and then on a recurring interval.
function startSessionSweeper(io, intervalMs = 60 * 1000) {
  sweepStaleSessions(io).catch((err) =>
    console.error("Initial session sweep failed:", err),
  );

  setInterval(() => {
    sweepStaleSessions(io).catch((err) =>
      console.error("Session sweep failed:", err),
    );
  }, intervalMs);
}

module.exports = { startSessionSweeper };
