// src/pages/admin/AdminLayout.jsx
import { Outlet, useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("rfid_logged_user");
    navigate("/login");
  };

  return (
    <div className="w-full h-full">
      {/* Header / Title nếu muốn (có thể bổ sung ở từng trang con) */}
      {/* <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-blue-700">Admin Panel</h2>
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-sm"
        >
          Logout
        </button>
      </div> */}

      {/* Render nested routes */}
      <Outlet />
    </div>
  );
}
