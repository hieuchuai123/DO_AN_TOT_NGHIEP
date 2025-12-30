// src/pages/admin/AdminLayout.jsx
import { Link, Outlet, useNavigate } from "react-router-dom";

export default function StudentLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("rfid_logged_user");
    navigate("/login");
  };
  console.log("Hello sờ babby");

  return (
    <div className="bg-white p-6 rounded-xl shadow-md ">
      {/* <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <div>
          <h2 className="text-xl font-semibold">Admin Panel</h2>


      {/* content area for nested routes */}
      <div className="mt-4">
      
        <Outlet />
      </div>
    </div>
  );
}
