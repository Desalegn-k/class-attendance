// In-memory grace-period timers keyed by session id. Good enough for a
// single-server deployment; would need a shared store (e.g. Redis) if this
// ever runs across multiple backend instances.
const timers = new Map();

function schedule(sessionId, onExpire, ms) {
  cancel(sessionId);
  const timeout = setTimeout(() => {
    timers.delete(sessionId);
    onExpire(sessionId);
  }, ms);
  timers.set(sessionId, timeout);
}

function cancel(sessionId) {
  const timeout = timers.get(sessionId);
  if (timeout) {
    clearTimeout(timeout);
    timers.delete(sessionId);
  }
}

module.exports = { schedule, cancel };
