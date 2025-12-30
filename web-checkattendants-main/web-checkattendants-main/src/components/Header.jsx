// src/components/Header.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  ClipboardList,
  Bell,
  IdCard,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

export default function Header({ collapsed, setCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loggedRaw = localStorage.getItem("rfid_logged_user");
  const logged = loggedRaw ? JSON.parse(loggedRaw) : null;

  const role = logged?.role || null;
  const username = logged?.username || "";
  const studentUID = logged?.uid || null;

  /* ===========================
      Unread notifications
  =========================== */
  useEffect(() => {
    if (role !== "student" || !studentUID) return;

    const notifRef = ref(db, `Notifications/${studentUID}`);

    const unsub = onValue(notifRef, (snap) => {
      const val = snap.val() || {};
      const count = Object.values(val).filter((n) => n.status === "unread").length;
      setUnreadCount(count);
    });

    return () => unsub();
  }, [role, studentUID]);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path);

  /* ===========================
      NAV CONFIG
  =========================== */
  const navConfig = {
    admin: [
      { to: "/admin/home", label: "Admin Home", icon: Home },
      { to: "/admin/liststudents", label: "List Students", icon: Users },
      { to: "/admin/accounts", label: "Accounts", icon: ClipboardList },
    ],
    class: [
      { to: "/class/home", label: "Class Home", icon: Home },
      {
        to: "/class/liststudents",
        label: "List Students",
        icon: GraduationCap,
      },
    ],
    student: [
      { to: "/students/home", label: "Student Home", icon: IdCard },
      {
        to: "/students/checkattendance",
        label: "Attendance Histories",
        icon: ClipboardList,
      },
      {
        to: "/students/notification",
        label: unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications",
        icon: Bell,
        badge: unreadCount,
      },
    ],
  };

  const homeTarget =
    role === "admin"
      ? "/admin/home"
      : role === "class"
      ? "/class/home"
      : role === "student"
      ? "/students/home"
      : "/login";

  const handleLogout = () => {
    localStorage.removeItem("rfid_logged_user");
    navigate("/login");
  };

  /* ===========================
      RENDER ITEM - DESKTOP
  =========================== */
  const renderNavItem = (item, index) => {
    const Icon = item.icon;
    const active = isActive(item.to);

    return (
      <Link
        key={index}
        to={item.to}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-all
          ${
            active
              ? "bg-blue-500/80 text-white shadow-sm"
              : "bg-blue-50/70 text-gray-800 hover:bg-blue-200/70 backdrop-blur"
          }
        `}
        title={collapsed ? item.label : ""}
      >
        <Icon size={18} />
        {!collapsed && <span>{item.label}</span>}

        {item.badge > 0 && (
          <span className="absolute right-2 top-2 bg-red-500 text-white text-xs rounded-full px-1.5 shadow">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ===========================
          MOBILE TOPBAR
      =========================== */}
      <div className="md:hidden flex items-center justify-between 
          bg-white/70 backdrop-blur-xl shadow-md p-3 border-b border-white/30">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded bg-blue-100/50 hover:bg-blue-200"
        >
          <Menu size={20} />
        </button>

        <Link to={homeTarget} className="font-bold text-lg text-blue-700">
           Primary School
        </Link>

        <div className="text-sm font-medium">{username}</div>
      </div>

      {/* ===========================
          MOBILE DRAWER
      =========================== */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
          <div className="absolute left-0 top-0 w-64 
              bg-white/80 backdrop-blur-xl shadow-2xl h-full p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-blue-700">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 hover:bg-blue-100 rounded"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {(navConfig[role] || []).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setDrawerOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded text-sm
                    ${
                      isActive(item.to)
                        ? "bg-blue-500 text-white"
                        : "bg-blue-50 hover:bg-blue-100"
                    }`}
                >
                  <item.icon size={18} />
                  {item.label}

                  {item.badge > 0 && (
                    <span className="absolute right-3 top-2 
                        bg-red-500 text-white text-xs rounded-full px-1.5 shadow">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            <div className="mt-auto pt-4 border-t border-white/40">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 shadow"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===========================
          DESKTOP SIDEBAR
      =========================== */}
      <aside
        className={`
          hidden md:flex md:flex-col md:justify-between md:fixed md:inset-y-0 md:left-0
          shadow-xl border-r border-white/30
          bg-white/60 backdrop-blur-xl
          transition-all duration-300
          ${collapsed ? "md:w-20" : "md:w-64"}
        `}
      >
        {/* TOP */}
        <div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/40">
            {!collapsed ? (
              <Link to={homeTarget} className="text-lg font-bold text-blue-700">
                Primary School
              </Link>
            ) : (
              <Link to={homeTarget}>
                <Home size={22} className="text-blue-700" />
              </Link>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 hover:bg-blue-200/60 rounded"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {(navConfig[role] || []).map((item, i) => renderNavItem(item, i))}
          </nav>
        </div>

        {/* BOTTOM */}
        <div className="border-t border-white/30 p-3">
          {!collapsed && (
            <div className="mb-2">
              <div className="text-sm font-semibold text-blue-800">{username}</div>
              <div className="text-xs text-gray-600">{role}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 shadow text-sm w-full"
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* EMPTY padding */}
      <div
        className="hidden md:block transition-all duration-300"
        style={{ paddingLeft: collapsed ? "80px" : "256px" }}
      />
    </>
  );
}
