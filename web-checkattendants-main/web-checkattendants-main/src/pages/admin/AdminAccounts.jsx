// src/pages/AdminAccounts.jsx
import { useEffect, useState } from "react";
import { ref, set, get, onValue, update } from "firebase/database";
import { db } from "../../firebase";
import bcrypt from "bcryptjs";
import toast from "react-hot-toast";

const PAGE_SIZE = 8;

// Tạo chuỗi ngày giờ dạng dd-mm-yyyy HH:MM:SS
function getVNDateTimeString() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year} ${hh}:${mm}:${ss}`;
}

// Parse string ngày (ISO hoặc dd-mm-yyyy HH:MM:SS) -> Date để SORT
function parseVNDate(d) {
  if (!d) return null;

  // ISO: 2025-11-12T15:20:38.982Z
  if (d.includes("T")) {
    try {
      const [datePart, timeRaw] = d.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const timePart = timeRaw.replace("Z", "").split(".")[0]; // "15:20:38"
      const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hh, mm, ss);
    } catch {
      return null;
    }
  }

  // VN: dd-mm-yyyy HH:MM:SS
  try {
    const [datePart, timePart = ""] = d.split(" ");
    const [day, month, year] = datePart.split("-").map(Number);
    const [hh = 0, mm = 0, ss = 0] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hh, mm, ss);
  } catch {
    return null;
  }
}

// Format ra string để HIỂN THỊ
function formatCreatedAt(d) {
  if (!d) return "-";

  // Nếu đã là dạng dd-mm-yyyy ... thì trả luôn
  if (d.includes("-") && !d.includes("T")) return d;

  // Nếu là ISO thì convert sang dd-mm-yyyy HH:MM:SS
  if (d.includes("T")) {
    try {
      const [datePart, timeRaw] = d.split("T");
      const [year, month, day] = datePart.split("-");
      const timePart = timeRaw.replace("Z", "").split(".")[0]; // "15:20:38"
      return `${day}-${month}-${year} ${timePart}`;
    } catch {
      return d;
    }
  }

  // Trường hợp khác: trả nguyên
  return d;
}

function ModalDetail({ account, onClose }) {
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    if (account?.uid) {
      get(ref(db, `USER/${account.uid}`)).then((snap) => {
        setStudentName(snap.val()?.name || "");
      });
    } else {
      setStudentName("");
    }
  }, [account]);

  if (!account) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white p-6 rounded-lg shadow-lg max-w-md w-full z-10">
        <h3 className="text-lg font-bold mb-2">Chi tiết tài khoản</h3>
        <div className="space-y-2 text-sm">
          <div>
            <b>Username:</b> {account.username}
          </div>
          <div>
            <b>Role:</b> {account.role}
          </div>
          <div>
            <b>Lớp quản lý:</b> {account.classManaged || "-"}
          </div>
          <div>
            <b>Tên học sinh:</b> {studentName || "-"}
          </div>
          <div>
            <b>Ngày tạo:</b>{" "}
            {account.createdAt ? formatCreatedAt(account.createdAt) : "-"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-black"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}

function ModalUpdate({ account, classOptions, onClose, onUpdated }) {
  const [role, setRole] = useState(account?.role || "class");
  const [classManaged, setClassManaged] = useState(account?.classManaged || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!account) return null;

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const updates = {
        role,
        classManaged: role === "class" ? classManaged : null,
      };
      if (password) {
        updates.passwordHash = bcrypt.hashSync(password, 10);
      }
      await update(ref(db, `ACCOUNTS/${account.username}`), updates);
      toast.success("Cập nhật thành công");
      onUpdated();
      onClose();
    } catch (err) {
      toast.error("Lỗi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white p-6 rounded-lg shadow-lg max-w-md w-full z-10">
        <h3 className="text-lg font-bold mb-2">Cập nhật tài khoản</h3>
        <div className="space-y-3">
          {role === "class" && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Lớp quản lý
              </label>
              <select
                value={classManaged}
                onChange={(e) => setClassManaged(e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">-- Chọn lớp --</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded px-2 py-1 w-full"
              placeholder="Để trống nếu không đổi"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-black"
          >
            Huỷ
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAccounts() {
  // Tạo account
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("class");
  const [classManaged, setClassManaged] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);

  // Class options
  const [classOptions, setClassOptions] = useState([]);

  // Account list & pagination
  const [accountsArr, setAccountsArr] = useState([]); // [{ username, ... }]
  const [accountsPage, setAccountsPage] = useState(1);

  // Bộ lọc
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterClass, setFilterClass] = useState("");

  // Modal
  const [detailAcc, setDetailAcc] = useState(null);
  const [updateAcc, setUpdateAcc] = useState(null);

  // Load class options
  useEffect(() => {
    const cRef = ref(db, "Class");
    const unsub = onValue(cRef, (snap) => {
      const v = snap.val() || {};
      setClassOptions(Object.keys(v));
    });
    return () => unsub();
  }, []);

  // Load ACCOUNTS list realtime
  useEffect(() => {
    const aRef = ref(db, "ACCOUNTS");
    const unsub = onValue(aRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.keys(val).map((username) => ({
        username,
        ...(val[username] || {}),
      }));
      // Sắp xếp theo createdAt mới nhất lên đầu
      arr.sort((a, b) => {
        const ca = a.createdAt ? parseVNDate(a.createdAt)?.getTime() || 0 : 0;
        const cb = b.createdAt ? parseVNDate(b.createdAt)?.getTime() || 0 : 0;
        return cb - ca;
      });
      setAccountsArr(arr);
      setAccountsPage((cur) => {
        const max = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
        return cur > max ? max : cur;
      });
    });
    return () => unsub();
  }, []);

  // Tạo account
  const create = async () => {
    if (!username) return toast.error("Bạn hãy thêm username");
    if (role === "class" && !classManaged) return toast.error("Nhập mã lớp");
    setLoadingCreate(true);
    try {
      const snap = await get(ref(db, `ACCOUNTS/${username}`));
      if (snap.exists()) {
        toast.error("Username tồn tại");
        setLoadingCreate(false);
        return;
      }

      const hash = bcrypt.hashSync(username, 10);
      await set(ref(db, `ACCOUNTS/${username}`), {
        uid: null,
        username,
        passwordHash: hash,
        role,
        classManaged: role === "class" ? classManaged : null,
        createdAt: getVNDateTimeString(), // dùng format VN
      });

      if (role === "class") {
        // Chỉ tạo node class nếu chưa có
        const classSnap = await get(ref(db, `Class/${classManaged}`));
        if (!classSnap.exists()) {
          await set(ref(db, `Class/${classManaged}`), {
            className: classManaged,
            classAccount: username,
            students: {},
          });
        } else {
          await set(ref(db, `Class/${classManaged}/classAccount`), username);
        }
      }

      toast.success("Tạo account thành công. (Mật khẩu = username)");
      setUsername("");
      setClassManaged("");
      setRole("class");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi tạo account");
    } finally {
      setLoadingCreate(false);
    }
  };

  // Xoá account + toàn bộ dữ liệu liên quan
  const handleDeleteAccount = async (username) => {
    if (
      !window.confirm(
        "Bạn có chắc muốn xoá tài khoản này và toàn bộ dữ liệu liên quan?"
      )
    ) {
      return;
    }

    try {
      const accRef = ref(db, `ACCOUNTS/${username}`);
      const snap = await get(accRef);

      if (!snap.exists()) {
        toast.error("Account không tồn tại");
        return;
      }

      const acc = snap.val();
      const uid = acc.uid || null;
      const classManaged = acc.classManaged || null;

      // --- Batch updates ---
      const updates = {};

      // 1. Xoá ACCOUNTS
      updates[`ACCOUNTS/${username}`] = null;

      // 2. Xoá USER/{uid}
      if (uid) {
        updates[`USER/${uid}`] = null;
      }

      // 3. Xoá RFID/{uid}
      if (uid) {
        updates[`RFID/${uid}`] = null;
      }

      // 4. Nếu tài khoản này là class admin → xoá liên kết ở Class
      if (classManaged) {
        updates[`Class/${classManaged}/classAccount`] = null;
      }

      // 5. Nếu USER/{uid} nằm trong danh sách lớp nào đó thì xoá luôn reference trong students
      if (uid && classManaged) {
        updates[`Class/${classManaged}/students/${uid}`] = null;
      }

      await update(ref(db), updates);

      toast.success("Đã xoá toàn bộ dữ liệu liên quan đến account!");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi xoá account");
    }
  };

  // Phân trang + lọc
  const filteredAccounts = accountsArr
    .filter(
      (acc) =>
        !search || acc.username.toLowerCase().includes(search.toLowerCase())
    )
    .filter((acc) => !filterRole || acc.role === filterRole)
    .filter((acc) => !filterClass || acc.classManaged === filterClass);

  const accountsTotalPages = Math.max(
    1,
    Math.ceil(filteredAccounts.length / PAGE_SIZE)
  );
  const accountsPageItems = filteredAccounts.slice(
    (accountsPage - 1) * PAGE_SIZE,
    accountsPage * PAGE_SIZE
  );

  useEffect(() => {
    setAccountsPage(1);
  }, [search, filterRole, filterClass, accountsArr.length]);

  return (
    <div className="space-y-8">
      {/* --- Tạo tài khoản --- */}
      <section className="bg-white p-6 rounded-2xl shadow-md border">
        <h3
          className="text-xl font-semibold mb-6 text-gray-800">
          ⚙️ Tạo tài khoản Admin / Class
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            placeholder="Nhập username"
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {/* <option value="admin">Admin</option> */}
            <option value="class">Class</option>
          </select>
          {role === "class" ? (
            <select
              value={classManaged}
              onChange={(e) => setClassManaged(e.target.value)}
              className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn hoặc nhập lớp --</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <div className="hidden md:block" />
          )}
          <div className="md:col-span-3 flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={create}
              disabled={loadingCreate}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {loadingCreate ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
            <p className="text-sm text-gray-500 self-center">
              *Mật khẩu mặc định = username.
            </p>
          </div>
        </div>
      </section>

      {/* --- Bộ lọc --- */}
      <section className="bg-white p-4 rounded-2xl shadow-md border">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Tìm theo username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border rounded px-2 py-1 text-sm disabled:opacity-50"
          >
            <option value="">Tất cả role</option>
            <option value="admin">Admin</option>
            <option value="class">Class</option>
            <option value="student">Student</option>
          </select>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Tất cả lớp</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* --- Danh sách tất cả account --- */}
      <section className="bg-white p-6 rounded-2xl shadow-md border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-800">
            👤 Danh sách tất cả tài khoản
          </h4>
          <div className="text-sm text-gray-600">
            Tổng: {filteredAccounts.length} | Trang {accountsPage} /{" "}
            {accountsTotalPages}
          </div>
        </div>
        {filteredAccounts.length === 0 ? (
          <div className="text-sm text-gray-500">Không có tài khoản nào.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-400">
                  <tr>
                    <th className="p-2 text-left">Username</th>
                    <th className="p-2 text-left">Role</th>
                    <th className="p-2 text-left">Lớp quản lý</th>
                    <th className="p-2 text-left">Ngày tạo</th>
                    <th className="p-2 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsPageItems.map((acc) => (
                    <tr
                      key={acc.username}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-2">{acc.username}</td>
                      <td className="p-2">{acc.role}</td>
                      <td className="p-2">{acc.classManaged || "-"}</td>
                      <td className="p-2">
                        {acc.createdAt
                          ? parseVNDate(acc.createdAt)?.toLocaleString()
                          : "-"}
                      </td>

                      <td className="p-2 flex gap-2">
                        <button
                          onClick={() => setDetailAcc(acc)}
                          className="px-2 py-1 bg-gray-100 text-black rounded text-sm hover:bg-blue-200 transition-colors"
                        >
                          Xem
                        </button>
                        <button
                          onClick={() => setUpdateAcc(acc)}
                          className="px-2 py-1 bg-yellow-400 text-black rounded text-sm hover:bg-yellow-500 transition-colors"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.username)}
                          className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* pagination controls */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setAccountsPage((s) => Math.max(1, s - 1))}
                  disabled={accountsPage <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setAccountsPage((s) => Math.min(accountsTotalPages, s + 1))
                  }
                  disabled={accountsPage >= accountsTotalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="text-sm text-gray-600">
                Trang {accountsPage} / {accountsTotalPages}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal xem chi tiết */}
      {detailAcc && (
        <ModalDetail account={detailAcc} onClose={() => setDetailAcc(null)} />
      )}

      {/* Modal cập nhật */}
      {updateAcc && (
        <ModalUpdate
          account={updateAcc}
          classOptions={classOptions}
          onClose={() => setUpdateAcc(null)}
          onUpdated={() => {}}
        />
      )}
    </div>
  );
}
