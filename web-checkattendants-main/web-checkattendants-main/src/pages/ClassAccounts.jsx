// src/pages/ClassAccounts.jsx
import { useEffect, useState } from "react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

// --- Helpers xử lý ngày giờ giống AdminAccounts ---
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

export default function ClassAccounts() {
  const navigate = useNavigate();
  const raw = localStorage.getItem("rfid_logged_user");
  const logged = raw ? JSON.parse(raw) : null;
  const className = logged?.classManaged || null;

  const [students, setStudents] = useState({}); // { uid: { uid, name, createdAt } }
  const [usersMap, setUsersMap] = useState({}); // full USER data for uids
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    if (!logged) {
      navigate("/login");
      return;
    }
    if (logged.role !== "class" || !className) {
      navigate("/login");
      return;
    }

    // listen Class/<className>/students
    const cRef = ref(db, `Class/${className}/students`);
    const unsub = onValue(cRef, (snap) => {
      const val = snap.val() || {};
      setStudents(val);
      // prefetch USER details for these uids
      Object.keys(val).forEach((uid) => {
        get(ref(db, `USER/${uid}`))
          .then((s) => {
            if (s.exists()) {
              setUsersMap((prev) => ({ ...prev, [uid]: s.val() }));
            }
          })
          .catch((err) => console.error("prefetch USER error", err));
      });
    });

    return () => unsub();
  }, [logged, className, navigate]);

  if (!logged) return null;

  // Lấy danh sách lớp trong lớp này (nếu có)
  const classOptions = Array.from(
    new Set(Object.values(usersMap).map((u) => u.class).filter(Boolean))
  );

  // Lọc và search
  const filtered = Object.entries(students)
    .filter(([uid, s]) => {
      const u = usersMap[uid] || {};
      if (
        search &&
        !(u.name || s.name || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (filterGender && (u.gender || "-") !== filterGender) return false;
      if (filterClass && (u.class || "") !== filterClass) return false;
      return true;
    })
    .sort((a, b) => {
      // Sắp xếp theo createdAt mới nhất lên đầu
      const aUser = usersMap[a[0]] || {};
      const bUser = usersMap[b[0]] || {};
      const aCreatedStr = aUser.createdAt || a[1]?.createdAt;
      const bCreatedStr = bUser.createdAt || b[1]?.createdAt;

      const ca = aCreatedStr ? (parseVNDate(aCreatedStr)?.getTime() || 0) : 0;
      const cb = bCreatedStr ? (parseVNDate(bCreatedStr)?.getTime() || 0) : 0;

      return cb - ca;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, filterGender, filterClass, Object.keys(students).length]);

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-semibold mb-4 text-blue-700">
        Trang lớp: {className}
      </h2>

      {/* Bộ lọc + search */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-col md:flex-row md:items-center gap-3">
        <input
          type="text"
          placeholder="Tìm theo tên học sinh..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full md:w-56"
        />
        <select
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full md:w-40"
        >
          <option value="">Tất cả giới tính</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full md:w-40"
        >
          <option value="">Tất cả lớp</option>
          {classOptions.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
        <div className="text-sm text-gray-600 ml-auto">
          Tổng: {filtered.length} | Trang {page}/{totalPages}
        </div>
      </div>

      {/* Responsive table/cards */}
      <div>
        {/* Mobile: cards */}
        <div className="block md:hidden">
          {paged.length === 0 ? (
            <div className="text-sm text-gray-500 p-4">
              Hiện chưa có học sinh trong lớp này.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paged.map(([uid, s]) => {
                const u = usersMap[uid] || {};
                const createdStr = u.createdAt || s.createdAt ||  "";
                return (
                  <div
                    key={uid}
                    className="bg-gray-50 rounded-lg p-4 shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="font-semibold text-blue-700 mb-1">
                        {u.name || s.name || "-"}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        UID: <span className="font-mono">{uid}</span>
                      </div>
                      <div className="text-sm mb-1">
                        <b>Lớp:</b> {u.class || className}
                      </div>
                      <div className="text-sm mb-1">
                        <b>Giới tính:</b> {u.gender || "-"}
                      </div>
                      <div className="text-sm mb-1">
                        <b>Ngày sinh:</b> {u.dob || "-"}
                      </div>
                      <div className="text-sm mb-1">
                        <b>Ngày tạo:</b>{" "}
                        {createdStr ? formatCreatedAt(createdStr) : "-"}
                      </div>
                      <div className="text-sm mb-1">
                        <b>Phụ huynh:</b> {u.parentName || "-"}
                      </div>
                      <div className="text-sm mb-1">
                        <b>SĐT phụ huynh:</b> {u.parentPhone || "-"}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {/* <Link
                        to={`/card/${uid}`}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      >
                        Xem thẻ
                      </Link> */}
                      <button
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                        onClick={() => navigate(`/card/${uid}`)}
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tablet/Laptop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-400">
              <tr>
                <th className="p-2 text-left">UID</th>
                <th className="p-2 text-left">Họ tên</th>
                <th className="p-2 text-left">Ngày tạo</th>
                <th className="p-2 text-left">Lớp</th>
                <th className="p-2 text-left">Giới tính</th>
                <th className="p-2 text-left">Ngày sinh</th>
                <th className="p-2 text-left">Phụ huynh</th>
                <th className="p-2 text-left">SĐT phụ huynh</th>
                <th className="p-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-center text-gray-500"
                  >
                    Hiện chưa có học sinh trong lớp này.
                  </td>
                </tr>
              ) : (
                paged.map(([uid, s]) => {
                  const u = usersMap[uid] || {};
                  const createdStr = u.createdAt || s.createdAt || "";
                  return (
                    <tr key={uid} className="border-t hover:bg-blue-50">
                      <td className="p-2">{uid}</td>
                      <td className="p-2">{u.name || s.name || "-"}</td>
                      <td className="p-2">
                        {createdStr ? formatCreatedAt(createdStr) : "-"}
                      </td>
                      <td className="p-2">{u.class || className}</td>
                      <td className="p-2">{u.gender || "-"}</td>
                      <td className="p-2">{u.dob || "-"}</td>
                      <td className="p-2">{u.parentName || "-"}</td>
                      <td className="p-2">{u.parentPhone || "-"}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          {/* <Link
                            to={`/card/${uid}`}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                          >
                            Xem thẻ
                          </Link> */}
                          <button
                            className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                            onClick={() => navigate(`/card/${uid}`)}
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            Previous
          </button>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            Next
          </button>
        </div>

        <div className="text-sm text-gray-600">
          Trang {page}/{totalPages}
        </div>
      </div>
    </div>
  );
}
