// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import bcrypt from "bcryptjs";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ✅ Nếu đã đăng nhập → tự động điều hướng đúng role
  useEffect(() => {
    const raw = localStorage.getItem("rfid_logged_user");
    if (!raw) return;
    try {
      const logged = JSON.parse(raw);
      switch (logged.role) {
        case "admin":
          navigate("/admin/home", { replace: true });
          break;
        case "class":
          navigate("/class/home", { replace: true });
          break;
        case "student":
          navigate("/students/home", { replace: true });
          break;
        default:
          navigate("/", { replace: true });
      }
    } catch {
      localStorage.removeItem("rfid_logged_user");
    }
  }, [navigate]);

  // ✅ Hàm đăng nhập
  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username || !password) {
      toast.error("Vui lòng nhập username và password");
      return;
    }

    setLoading(true);
    try {
      const snap = await get(ref(db, `ACCOUNTS/${username}`));
      if (!snap.exists()) {
        toast.error("Tài khoản không tồn tại");
        setLoading(false);
        return;
      }

      const acc = snap.val();
      const ok = bcrypt.compareSync(password, acc.passwordHash);
      if (!ok) {
        toast.error("Sai mật khẩu");
        setLoading(false);
        return;
      }

      // ✅ Lưu thông tin đăng nhập
      const logged = {
        username: acc.username,
        uid: acc.uid || null,
        role: acc.role || "student",
        classManaged: acc.classManaged || null,
        loginAt: new Date().toISOString(),
      };
      localStorage.setItem("rfid_logged_user", JSON.stringify(logged));
      toast.success("Đăng nhập thành công");

      // ✅ Điều hướng đúng vai trò
      if (acc.role === "admin") navigate("/admin/home", { replace: true });
      else if (acc.role === "class") navigate("/class/home", { replace: true });
      else if (acc.role === "student")
        navigate("/students/home", { replace: true });
      else navigate("/", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Lỗi đăng nhập (xem console)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo / Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-700">
            Hệ thống điểm danh RFID
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Trường Tiểu học Thuận Hiếu
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Username
            </label>
            <input
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              placeholder="Nhập username..."
              autoComplete="off"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập password..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 text-white rounded-md transition-colors ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-4 text-center text-sm text-gray-600">
          Mật khẩu mặc định = <b>username</b> (nếu tài khoản được tạo qua hệ thống)
        </div>

        <div className="mt-3 text-center">
          <button
            onClick={() => {
              setUsername("");
              setPassword("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Xóa thông tin nhập
          </button>
        </div>
      </div>
    </div>
  );
}
