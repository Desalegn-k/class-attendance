import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
 import { getCurrentUser } from "./lib/api";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassDetail from "./pages/ClassDetail";
import LiveSession from "./pages/LiveSession";
import StudentDashboard from "./pages/StudentDashboard";
import CheckIn from "./pages/CheckIn";
import MyAttendance from "./pages/MyAttendance";
// import Home from "./pages/Home";
import ShearedLyout from "./components/ShearedLyout";
import AdminDashboard from "./pages/AdminDashboard";
import ChangePassword from "./pages/ChangePassword";
import Home from "./pages/Home"

export default function App() {
  const user = getCurrentUser();

  return (
    <Routes>
      <Route path="/" element={<ShearedLyout />}>
        <Route path="/" element={<Home/>}/>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            user ? (
              <Navigate
                to={user.role === "TEACHER" ? "/teacher" : "/student"}
                replace
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="TEACHER">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="ADMIN">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/classes/:id"
          element={
            <ProtectedRoute role="TEACHER">
              <ClassDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/sessions/:id"
          element={
            <ProtectedRoute role="TEACHER">
              <LiveSession />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute role="STUDENT">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/check-in"
          element={
            <ProtectedRoute role="STUDENT">
              <CheckIn />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-attendance"
          element={
            <ProtectedRoute role="STUDENT">
              <MyAttendance />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
