import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { saveSession } from "../lib/api";
import "./Login.css";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      saveSession(data.token, data.user);

      if (data.user.mustChangePassword) {
        navigate("/change-password");
        return;
      }

      const dest =
        data.user.role === "TEACHER"
          ? "/teacher"
          : data.user.role === "ADMIN"
            ? "/admin"
            : "/student";
      navigate(dest);
      // navigate("/")
      // write a simple resopnse on the browser to indicate that the user has logged in successfully
      // alert("You have logged in successfully!");
      
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 login-bg">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-4">Log in</h1>

        <form onSubmit={handleSubmit} className="space-y-3 login-form">
          <input
            type="email"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium">
            Log in
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-3">
          Don't have an account? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
