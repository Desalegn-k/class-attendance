import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { saveSession, getCurrentUser } from "../lib/api";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const user = getCurrentUser();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirm) {
      setError("New passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    try {
      const { data } = await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      saveSession(data.token, data.user);

      const dest =
        data.user.role === "TEACHER"
          ? "/teacher"
          : data.user.role === "ADMIN"
            ? "/admin"
            : "/student";
      navigate(dest);
    } catch (err) {
      setError(err.response?.data?.error || "Could not change password");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-1">Set a new password</h1>
        <p className="text-sm text-gray-500 mb-4">
          {user?.mustChangePassword
            ? "Your administrator gave you a temporary password. Choose a new one to continue."
            : "Enter your current password and choose a new one."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Current (temporary) password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium">
            Set password & continue
          </button>
        </form>
      </div>
    </div>
  );
}
