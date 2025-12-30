// src/components/ModalApprove.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ref, set, remove, get, onValue } from "firebase/database";
import { db } from "../firebase";
import toast from "react-hot-toast";
import bcrypt from "bcryptjs";

export default function ModalApprove({ uid, onClose }) {
  const [form, setForm] = useState({
    name: "",
    parentName: "",
    role: "student", // fixed
    class: "",
    parentPhone: "",
    phone: "",
    email: "",
    address: "",
    gender: "",
    dob: "",
  });

  const [classOptions, setClassOptions] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  const [emailError, setEmailError] = useState("");

  /* ==============================
        Validate Email
  ============================== */
  const validateEmail = (email) => {
    if (!email) return "Email không được để trống";

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email))
      return "Email không hợp lệ (ví dụ: example@gmail.com)";

    return "";
  };

  /* ==============================
        Load Class List
  ============================== */
  useEffect(() => {
    const classRef = ref(db, "Class");
    const unsub = onValue(classRef, (snap) => {
      const val = snap.val() || {};
      const list = Object.keys(val).map((k) => ({ key: k, ...val[k] }));
      setClassOptions(list);

      if (!form.class && list.length > 0) {
        setForm((s) => ({ ...s, class: list[0].className || list[0].key }));
      }
    });

    return () => unsub();
  }, []);

  /* ==============================
        Các Helper
  ============================== */
  const formatDateVN = (date = new Date()) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const sanitize = (str) =>
    (str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const makeBaseUsername = (fullName) => {
    const clean = sanitize(fullName || "user").replace(/\s+/g, "");
    const base = clean.length > 6 ? clean.slice(0, 6) : clean;
    const rand3 = Math.floor(100 + Math.random() * 900);
    return `${base}${rand3}`;
  };

  const isUsernameTaken = async (username) =>
    (await get(ref(db, `ACCOUNTS/${username}`))).exists();

  const generateUniqueUsername = async (fullName, attempts = 0) => {
    if (attempts > 8) return `user${Date.now().toString().slice(-6)}`;
    const candidate = makeBaseUsername(fullName);
    if (!(await isUsernameTaken(candidate))) return candidate;
    return generateUniqueUsername(fullName + Math.floor(Math.random() * 1000), attempts + 1);
  };

  /* ==============================
        Handle input change
  ============================== */
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((s) => ({ ...s, [name]: value }));

    if (name === "email") {
      setEmailError(validateEmail(value));
    }
  };

  /* ==============================
        Approve Student
  ============================== */
  const handleApprove = async () => {
    const required = ["name", "class"];
    for (const f of required) {
      if (!form[f]) {
        toast.error(`Trường "${f}" không được để trống`);
        return;
      }
    }

    // Check email
    const emailErr = validateEmail(form.email);
    if (emailErr) {
      toast.error(emailErr);
      return;
    }

    setIsCreating(true);

    try {
      const username = await generateUniqueUsername(form.name || "user");
      const passwordHash = bcrypt.hashSync(username, 10);
      const now = formatDateVN();
      const role = "student";

      /* ----- USER ----- */
      await set(ref(db, `USER/${uid}`), {
        ...form,
        role,
        account: { username, role },
      });

      /* ----- RFID ----- */
      await set(ref(db, `RFID/${uid}`), {
        lastStatus: "Undefined",
        createdAt: now,
        accessLog: {},
      });

      /* ----- ACCOUNT ----- */
      await set(ref(db, `ACCOUNTS/${username}`), {
        uid,
        username,
        passwordHash,
        role,
        classManaged: form.class,
        createdAt: now,
      });

      /* ----- CLASS/STUDENT ----- */
      const classKey = form.class;
      if (classKey) {
        await set(ref(db, `Class/${classKey}/students/${uid}`), {
          uid,
          name: form.name,
          createdAt: now,
          email: form.email,
        });
      }

      /* ----- REMOVE PENDING ----- */
      await remove(ref(db, `Pending/${uid}`));

      toast.success("Phê duyệt thành công (username = password mặc định)");
      toast(`Username: ${username}`, { duration: 6000 });

      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi phê duyệt");
    } finally {
      setIsCreating(false);
    }
  };

  /* ==============================
        UI
  ============================== */
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!isCreating) onClose();
        }}
      />

      {/* Modal */}
      <div className="relative bg-white p-6 rounded-xl shadow-lg w-full max-w-lg z-10">
        <h2 className="text-xl font-semibold mb-4">Điền thông tin học sinh</h2>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["name", "Họ và tên học sinh"],
            ["parentName", "Tên phụ huynh"],
            ["parentPhone", "SĐT phụ huynh"],
            ["phone", "SĐT học sinh"],
            ["address", "Địa chỉ"],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="block text-sm text-gray-600 mb-1">{label}</label>
              <input
                name={k}
                value={form[k] || ""}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
            </div>
          ))}

          {/* ===== EMAIL ===== */}
          <div className="col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Email học sinh</label>
            <input
              name="email"
              value={form.email || ""}
              onChange={handleChange}
              placeholder="example@gmail.com"
              className={`border p-2 rounded w-full ${
                emailError ? "border-red-500" : ""
              }`}
            />
            {emailError && (
              <p className="text-red-500 text-xs mt-1">{emailError}</p>
            )}
          </div>

          {/* CLASS */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Lớp</label>
            <select
              name="class"
              value={form.class || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            >
              <option value="">-- Chọn lớp --</option>
              {classOptions.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.className || c.key}
                </option>
              ))}
            </select>
          </div>

          {/* GENDER */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Giới tính</label>
            <select
              name="gender"
              value={form.gender || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            >
              <option value="">-- Chọn --</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>

          {/* DOB */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Ngày sinh</label>
            <input
              type="date"
              name="dob"
              value={form.dob || ""}
              onChange={handleChange}
              className="border p-2 rounded w-full"
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end mt-5 gap-3">
          <button
            onClick={() => !isCreating && onClose()}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Hủy
          </button>

          <button
            onClick={handleApprove}
            disabled={isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {isCreating ? "Đang tạo..." : "Phê duyệt & Tạo account"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
