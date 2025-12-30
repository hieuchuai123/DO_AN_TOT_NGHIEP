// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

// 🔹 Common
import Header from "./components/Header";
import Login from "./pages/Login";
import CardDetail from "./pages/CardDetail";
import Pending from "./pages/Pending";

// 🔹 Admin pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminListStudents from "./pages/admin/AdminListStudents";

// 🔹 Class pages
import ClassLayout from "./pages/class/ClassLayout";
import ClassAccounts from "./pages/ClassAccounts";
import ClassStudentList from "./pages/class/ClassStudentList";

// 🔹 Student pages
import StudentLayout from "./pages/students/StudentsLayout";
import StudentHome from "./pages/students/StudentHome";
import StudentAccounts from "./pages/StudentAccounts";
import StudentNotification from "./pages/students/StudentNotification";

// 🔹 Common route protection
import ProtectedRoute from "./components/ProtectedRoute";

/* ---------------- ROLE REDIRECT ---------------- */
function RoleRedirect() {
  const raw = localStorage.getItem("rfid_logged_user");
  if (!raw) return <Navigate to="/login" replace />;

  try {
    const logged = JSON.parse(raw);
    switch (logged.role) {
      case "admin":
        return <Navigate to="/admin/home" replace />;
      case "class":
        return <Navigate to="/class/home" replace />;
      case "student":
        return <Navigate to="/students/home" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }
}

/* ---------------- APP COMPONENT ---------------- */
export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <BrowserRouter>

      {/* HEADER (sidebar + topbar) */}
      <Header collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* MAIN CONTENT WITH FIXED BACKGROUND */}
      <main
        className={`
          min-h-screen 
          w-full
          transition-all duration-300
          flex  
          ${collapsed ? "md:pl-[80px]" : "md:pl-[256px]"}
          bg-gradient-to-br from-blue-200 via-blue-100 to-blue-300
          bg-fixed
        `}
      >
        {/* CONTENT WRAPPER */}
        <div
          className="
            flex-1
            px-4 py-6 md:px-8 lg:px-10 xl:px-12
            max-w-[1500px]
            mx-auto
            w-full
          "
        >
          <Routes>
            {/* ---------- ROOT ---------- */}
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/login" element={<Login />} />

            {/* ---------- ADMIN ---------- */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminHome />} />
              <Route path="home" element={<AdminHome />} />
              <Route path="accounts" element={<AdminAccounts />} />
              <Route path="liststudents" element={<AdminListStudents />} />
            </Route>

            {/* ---------- CLASS ---------- */}
            <Route
              path="/class/*"
              element={
                <ProtectedRoute roles={["class"]}>
                  <ClassLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ClassAccounts />} />
              <Route path="home" element={<ClassAccounts />} />
              <Route path="accounts" element={<ClassAccounts />} />
              <Route path="liststudents" element={<ClassStudentList />} />
            </Route>

            {/* ---------- STUDENT ---------- */}
            <Route
              path="/students/*"
              element={
                <ProtectedRoute roles={["student"]}>
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentHome />} />
              <Route path="home" element={<StudentHome />} />
              <Route path="checkattendance" element={<StudentAccounts />} />
              <Route path="notification" element={<StudentNotification />} />
            </Route>

            {/* ---------- CARD ---------- */}
            <Route path="/card/:uid" element={<CardDetail />} />

            {/* ---------- FALLBACK ---------- */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </main>
    </BrowserRouter>
  );
}
