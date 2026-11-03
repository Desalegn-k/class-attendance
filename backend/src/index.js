require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const classRoutes = require("./routes/classes");
const sessionRoutes = require("./routes/sessions");
const studentRoutes = require("./routes/students");
const adminRoutes = require("./routes/admin");
const academicRoutes = require("./routes/academic");
const { schedule, cancel } = require("./lib/sessionPresence");
const { closeSession } = require("./lib/closeSession");
const { startSessionSweeper } = require("./lib/sessionSweep");
const prisma = require("./lib/prisma");

// How long we wait after the teacher's live-session tab disconnects before
// treating it as "they left" and auto-closing the session.
const DISCONNECT_GRACE_MS = 90 * 1000; // 90 seconds — survives refreshes/brief drops

// Safety net: if a session is created but the teacher's live-session view
// never even connects (crash, closed too fast), close it after this long.
const NEVER_JOINED_MS = 2 * 60 * 1000; // 2 minutes

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "http://localhost:5173" },
});
app.set("io", io);

async function autoCloseSession(sessionId, reason) {
  const updated = await closeSession(sessionId);
  if (updated) {
    io.to(`session:${sessionId}`).emit("session:closed", {
      sessionId,
      closesAt: updated.closesAt,
      reason, // "teacher_disconnected" | "teacher_never_joined" | "teacher_left_area"
    });
    console.log(`Session ${sessionId} auto-closed (${reason})`);
  }
}

// Exposed so routes (session creation, the GPS heartbeat route) can use the
// same grace-timer mechanism as the socket disconnect handler below.
app.set("sessionPresence", {
  scheduleNeverJoined(sessionId) {
    schedule(
      sessionId,
      (id) => autoCloseSession(id, "teacher_never_joined"),
      NEVER_JOINED_MS,
    );
  },
  cancel,
  // Generic "renew the dead-man's-switch": any proof-of-life event (a good
  // GPS heartbeat, a socket reconnect) pushes the auto-close deadline for
  // `key` out by `ms`. Used with key = `gps:${sessionId}` by the heartbeat
  // route, separately from the plain sessionId key used by socket presence.
  renew(key, sessionId, ms) {
    schedule(key, () => autoCloseSession(sessionId, "teacher_left_area"), ms);
  },
});
startSessionSweeper(io);

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// Basic rate limit on check-in to slow down brute-forcing session codes
const checkInLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
app.use("/api/sessions/check-in", checkInLimiter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/classes", classRoutes);
app.use("/api", sessionRoutes); // sessions.js defines its own /classes/:id/sessions and /sessions/* paths
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/academic", academicRoutes);

// Socket.IO: clients join a room per session to receive live check-in updates,
// and we track presence to auto-close a session if the teacher's live view
// disconnects and never comes back.
io.on("connection", (socket) => {
  socket.on("session:join", (sessionId) => {
    socket.join(`session:${sessionId}`);
    cancel(sessionId);
    prisma.session
      .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  });

  socket.on("session:leave", (sessionId) => {
    socket.leave(`session:${sessionId}`);
  });

  // Fires while the socket still knows which rooms it was in, right before
  // it actually disconnects (tab closed, navigated away, network dropped).
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (!room.startsWith("session:")) continue;
      const sessionId = room.slice("session:".length);

      const roomMembers = io.sockets.adapter.rooms.get(room);
      const remainingAfterThisSocket = roomMembers ? roomMembers.size - 1 : 0;

      // Only start the grace timer if this was the LAST viewer of that session.
      if (remainingAfterThisSocket <= 0) {
        schedule(
          sessionId,
          (id) => autoCloseSession(id, "teacher_disconnected"),
          DISCONNECT_GRACE_MS,
        );
      }
    }
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Attendance API listening on http://localhost:${PORT}`);
});
