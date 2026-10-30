import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import Header from "../components/Header";
import TablePagination from "../components/TablePagination";
import api from "../lib/api";
import "./Admin.css";

const PAGE_SIZE = 15;

const SECTIONS = {
  users: "Users",
  classes: "Classes",
  sessions: "Sessions",
};

function formatDuration(seconds) {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
// Turns any error shape (plain string, or a Zod .flatten() object with
// formErrors/fieldErrors) into a safe, renderable string.
function describeError(err, fallback) {
  const data = err?.response?.data?.error;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.formErrors || data.fieldErrors) {
    const messages = [
      ...(data.formErrors || []),
      ...Object.values(data.fieldErrors || {}).flat(),
    ];
    return messages.length > 0 ? messages.join(", ") : fallback;
  }
  return fallback;
}

/* Short "dd/mm hh:mm" so the date columns stay narrow on phones. */
function formatDateTime(value) {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

// Matches common header spellings to our expected fields, case-insensitively.
function normalizeRow(row) {
  const get = (...keys) => {
    for (const key of Object.keys(row)) {
      if (keys.includes(key.trim().toLowerCase()))
        return String(row[key] ?? "").trim();
    }
    return "";
  };
  const role = get("role").toUpperCase();
  return {
    name: get("name", "full name", "student name"),
    email: get("email", "email address"),
    role: ["ADMIN", "TEACHER", "STUDENT"].includes(role) ? role : "STUDENT",
    temporaryPassword:
      get("password", "temporary password", "temp password") || undefined,
  };
}

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab = SECTIONS[requested] ? requested : "users"; // "users" | "classes" | "sessions"
  const [usersPage, setUsersPage] = useState(1);
  const [classesPage, setClassesPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sortByDuration, setSortByDuration] = useState(false);

  // Create User panel state
  const [createMode, setCreateMode] = useState("manual"); // "manual" | "import"
  const [manualForm, setManualForm] = useState({
    name: "",
    email: "",
    role: "STUDENT",
    temporaryPassword: "",
  });
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");

  const [importRows, setImportRows] = useState([]); // parsed, not-yet-submitted rows
  const [importResults, setImportResults] = useState(null); // results after submitting
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  async function load() {
    const [u, c, s] = await Promise.all([
      api.get("/admin/users"),
      api.get("/admin/classes"),
      api.get("/admin/sessions"),
    ]);
    setUsers(u.data);
    setClasses(c.data);
    setSessions(s.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id, role) {
    await api.patch(`/admin/users/${id}/role`, { role });
    load();
  }

  async function removeUser(id) {
    if (!confirm("Delete this user permanently?")) return;
    await api.delete(`/admin/users/${id}`);
    load();
  }

  async function toggleActive(id, isActive) {
    await api.patch(`/admin/users/${id}/active`, { isActive });
    load();
  }

  async function handleManualCreate(e) {
    e.preventDefault();
    setManualError("");
    setManualSuccess("");
    try {
      await api.post("/admin/users", manualForm);
      setManualSuccess(`Created account for ${manualForm.email}`);
      setManualForm({
        name: "",
        email: "",
        role: "STUDENT",
        temporaryPassword: "",
      });
      load();
    } catch (err) {
      setManualError(describeError(err, "Could not create user"));
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet);
        const normalized = rawRows
          .map(normalizeRow)
          .filter((r) => r.name && r.email);

        if (normalized.length === 0) {
          setImportError(
            "No valid rows found — make sure the file has Name and Email columns.",
          );
          return;
        }
        setImportRows(normalized);
      } catch (err) {
        setImportError(
          "Could not read that file — make sure it's a valid .xlsx, .xls, or .csv file.",
        );
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function submitImport() {
    setImportError("");
    try {
      const { data } = await api.post("/admin/users/bulk", {
        users: importRows,
      });
      setImportResults(data.results);
      setImportRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    } catch (err) {
      setImportError(describeError(err, "Import failed"));
    }
  }

  function copyResultsAsCsv() {
    const created = importResults.filter((r) => r.status === "created");
    const header = "Name,Email,Role,Temporary Password";
    const rows = created.map(
      (r) => `${r.name},${r.email},${r.role},${r.temporaryPassword}`,
    );
    const csv = [header, ...rows].join("\n");
    navigator.clipboard.writeText(csv);
    alert("Copied! Paste into a spreadsheet to share credentials.");
  }

  const displayedSessions = sortByDuration
    ? [...sessions].sort(
        (a, b) =>
          (b.durationSeconds ?? Infinity) - (a.durationSeconds ?? Infinity),
      )
    : sessions;

  const counts = {
    users: users.length,
    classes: classes.length,
    sessions: sessions.length,
  };

  const pageOf = (items, page) => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  };

  return (
    <div className="admin-dashboard">
      <Header
        title={SECTIONS[tab]}
        subtitle={`${counts[tab]} record${counts[tab] === 1 ? "" : "s"}`}
      />

      {tab === "users" && (
        <div className="admin-create-panel">
          <h2 className="admin-section-title">Create User</h2>

          <div className="admin-subtabs">
            <button
              className={createMode === "manual" ? "active" : ""}
              onClick={() => setCreateMode("manual")}
            >
              Manual
            </button>
            <button
              className={createMode === "import" ? "active" : ""}
              onClick={() => setCreateMode("import")}
            >
              Import from Excel
            </button>
          </div>

          {createMode === "manual" && (
            <form onSubmit={handleManualCreate} className="admin-create-form">
              <input
                placeholder="Full name"
                value={manualForm.name}
                onChange={(e) =>
                  setManualForm({ ...manualForm, name: e.target.value })
                }
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={manualForm.email}
                onChange={(e) =>
                  setManualForm({ ...manualForm, email: e.target.value })
                }
                required
              />
              <select
                value={manualForm.role}
                onChange={(e) =>
                  setManualForm({ ...manualForm, role: e.target.value })
                }
              >
                <option value="STUDENT">STUDENT</option>
                <option value="TEACHER">TEACHER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <input
                placeholder="Temporary password"
                value={manualForm.temporaryPassword}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    temporaryPassword: e.target.value,
                  })
                }
                minLength={8}
                required
              />
              <button type="submit">Create</button>
            </form>
          )}
          {manualError && <p className="admin-form-error">{manualError}</p>}
          {manualSuccess && (
            <p className="admin-form-success">{manualSuccess}</p>
          )}

          {createMode === "import" && (
            <div className="admin-import">
              <p className="admin-import-hint">
                Upload a .xlsx, .xls, or .csv file with columns:{" "}
                <strong>Name</strong>, <strong>Email</strong>, optionally{" "}
                <strong>Role</strong> (defaults to STUDENT) and{" "}
                <strong>Password</strong> (auto-generated if left blank).
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {importError && <p className="admin-form-error">{importError}</p>}

              {importRows.length > 0 && (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-preview-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.name}</td>
                            <td>{r.email}</td>
                            <td>{r.role}</td>
                            <td>
                              {r.temporaryPassword || <em>(auto-generate)</em>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="admin-import-submit"
                    onClick={submitImport}
                  >
                    Import {importRows.length} user
                    {importRows.length !== 1 ? "s" : ""}
                  </button>
                </>
              )}

              {importResults && (
                <>
                  <h3 className="admin-section-subtitle">Import results</h3>
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-preview-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Temporary Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.map((r, i) => (
                          <tr key={i}>
                            <td>{r.email}</td>
                            <td>
                              <span
                                className={
                                  r.status === "created"
                                    ? "status-open"
                                    : "status-closed"
                                }
                              >
                                {r.status === "created"
                                  ? "Created"
                                  : `Skipped (${r.reason})`}
                              </span>
                            </td>
                            <td>{r.temporaryPassword || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="admin-import-submit"
                    onClick={copyResultsAsCsv}
                  >
                    Copy credentials as CSV
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Actions</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pageOf(users, usersPage).map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={u.isActive ? "status-open" : "status-closed"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                      <option value="STUDENT">STUDENT</option>
                      <option value="TEACHER">TEACHER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td>
                    <button className={u.isActive ? "danger" : "success"} onClick={() => toggleActive(u.id, !u.isActive)}>
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                  <td>
                    <button className="danger" onClick={() => removeUser(u.id)}>Delete</button>
                  </td>
                  {/* <td>
                    <button className="danger" onClick={() => removeUser(u.id)}>
                      Delete
                    </button>
                  </td> */}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="admin-empty">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "users" && (
        <TablePagination
          total={users.length}
          page={usersPage}
          pageSize={PAGE_SIZE}
          onPageChange={setUsersPage}
          label="users"
        />
      )}

      {tab === "classes" && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Class</th><th>Teacher</th><th>Students</th><th>Sessions</th></tr></thead>
              <tbody>
                {pageOf(classes, classesPage).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.teacher.name}</td>
                    <td>{c._count.enrollments}</td>
                    <td>{c._count.sessions}</td>
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr><td colSpan={4} className="admin-empty">No classes yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination total={classes.length} page={classesPage} pageSize={PAGE_SIZE} onPageChange={setClassesPage} label="classes" />
        </>
      )}

      {tab === "sessions" && (
        <>
          <div className="admin-sessions-controls">
            <label>
              <input
                type="checkbox"
                checked={sortByDuration}
                onChange={(e) => setSortByDuration(e.target.checked)}
              />{" "}
              Sort by longest open duration
            </label>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Started</th>
                  <th>Ended</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {pageOf(displayedSessions, sessionsPage).map((s) => (
                  <tr key={s.id}>
                    <td>{s.className}</td>
                    <td>{s.teacherName}</td>
                    <td title={new Date(s.opensAt).toLocaleString()}>
                      {formatDateTime(s.opensAt)}
                    </td>
                    <td
                      title={
                        s.closesAt
                          ? new Date(s.closesAt).toLocaleString()
                          : "Still open"
                      }
                    >
                      {s.closesAt ? formatDateTime(s.closesAt) : "—"}
                    </td>
                    <td>{formatDuration(s.durationSeconds)}</td>
                    <td>
                      <span
                        className={
                          s.status === "OPEN" ? "status-open" : "status-closed"
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    <td>{s.checkIns}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="admin-empty">
                      No sessions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={displayedSessions.length}
            page={sessionsPage}
            pageSize={PAGE_SIZE}
            onPageChange={setSessionsPage}
            label="sessions"
          />
        </>
      )}
    </div>
  );
}
