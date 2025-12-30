// src/components/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const [openMobile, setOpenMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname]);

  const navItem = (to, label, icon = null) => {
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-colors
          ${active ? "bg-purple-600 text-white" : "text-white/90 hover:bg-purple-500/60"}`}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b p-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpenMobile(v => !v)} className="p-2 rounded bg-purple-700 text-white">
            ☰
          </button>
          <Link to="/" className="font-bold text-lg">Primary School</Link>
        </div>
        <div className="text-sm text-gray-600">Admin</div>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-40 md:hidden ${openMobile ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity ${openMobile ? "opacity-100" : "opacity-0"}`}
          onClick={() => setOpenMobile(false)}
        />
        <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-purple-700 p-4 transform transition-transform ${openMobile ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-6">
            <div className="bg-white/10 rounded p-3 flex items-center justify-center">
              <div className="w-12 h-12 rounded bg-white/30 flex items-center justify-center text-2xl font-bold text-white">TH</div>
            </div>
            <h3 className="text-white mt-3 font-bold">TRƯỜNG TIỂU HỌC</h3>
          </div>
          <nav className="flex flex-col gap-2">
            {navItem("/admin/home", "Admin Home", null)}
            {navItem("/admin/liststudents", "Attendance Histories", null)}
            {navItem("/admin/accounts", "Account", null)}
            <div className="mt-4 border-t border-white/10 pt-3 text-white/80 text-xs">© Primary School</div>
          </nav>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-64 md:flex md:flex-col md:bg-purple-700 md:py-6 md:px-4">
        <div className="mb-6">
          <div className="bg-white/10 rounded p-3 flex items-center justify-center">
            <div className="w-16 h-16 rounded bg-white/30 flex items-center justify-center text-3xl font-bold text-white">TH</div>
          </div>
          <h3 className="text-white mt-3 font-bold text-lg">Primary School</h3>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {navItem("/admin/home", "Thông tin học sinh")}
          {navItem("/admin/liststudents", "Lịch sử điểm danh")}
          {navItem("/admin/accounts", "Quản lý tài khoản")}
        </nav>

        <div className="mt-6 pt-4 border-t border-white/10 text-white/90">
          <div className="text-sm font-medium">Admin</div>
          <div className="text-xs">thu@thschool.edu.vn</div>
        </div>
      </aside>
    </>
  );
}
