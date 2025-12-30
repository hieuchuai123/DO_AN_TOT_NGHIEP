// src/pages/StudentList.jsx
import { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../firebase";
import ModalEditStudent from "../components/ModalEditStudent";
import toast from "react-hot-toast";

const PAGE_SIZE = 8;

export default function StudentList() {
  const [students, setStudents] = useState({});
  const [editUID, setEditUID] = useState(null);
  const [classStudentUIDs, setClassStudentUIDs] = useState(new Set());
  const [page, setPage] = useState(1);

  // Bộ lọc
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [classOptions, setClassOptions] = useState([]);

  useEffect(() => {
    const userRef = ref(db, "USER");
    const unsub = onValue(userRef, (snapshot) =>
      setStudents(snapshot.val() || {})
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const loggedRaw = localStorage.getItem("rfid_logged_user");
    if (!loggedRaw) return;
    const logged = JSON.parse(loggedRaw);
    if (logged.role !== "class" || !logged.classManaged) {
      setClassStudentUIDs(new Set());
      return;
    }

    const cRef = ref(db, `Class/${logged.classManaged}/students`);
    const unsub = onValue(cRef, (snap) => {
      const val = snap.val() || {};
      setClassStudentUIDs(new Set(Object.keys(val)));
    });
    return () => unsub();
  }, []);

  // Lấy danh sách lớp học cho filter
  useEffect(() => {
    const cRef = ref(db, "Class");
    const unsub = onValue(cRef, (snap) => {
      const v = snap.val() || {};
      setClassOptions(Object.keys(v));
    });
    return () => unsub();
  }, []);

  const loggedRaw = localStorage.getItem("rfid_logged_user");
  const logged = loggedRaw ? JSON.parse(loggedRaw) : null;

  // Lọc dữ liệu + Sắp xếp theo createdAt mới nhất
  const visibleEntries = Object.entries(students)
    .filter(([uid, s]) => {
      if (!logged) return false;
      if (logged.role === "admin") return true;
      if (logged.role === "class") return classStudentUIDs.has(uid);
      if (logged.role === "student") return uid === logged.uid;
      return false;
    })
    .filter(([uid, s]) => {
      // Search theo tên
      if (
        search &&
        !(s.name || "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      // Lọc theo lớp
      if (filterClass && s.class !== filterClass) return false;
      // Lọc theo ngày sinh
      if (filterDateFrom) {
        const dob = s.dob ? new Date(s.dob) : null;
        if (!dob || dob < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const dob = s.dob ? new Date(s.dob) : null;
        if (!dob || dob > new Date(filterDateTo)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const createdA = a[1].createdAt ? new Date(a[1].createdAt).getTime() : 0;
      const createdB = b[1].createdAt ? new Date(b[1].createdAt).getTime() : 0;
      return createdB - createdA; // Mới nhất lên đầu
    });

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const pagedEntries = visibleEntries.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const fmtDate = (d) => {
    if (!d) return "-";
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
      try {
        const dt = new Date(d);
        if (!isNaN(dt)) return dt.toLocaleDateString();
      } catch {}
    }
    return d;
  };

  const handleDeleteStudent = async (uid) => {
    if (window.confirm("Bạn có chắc muốn xoá học sinh này?")) {
      try {
        await remove(ref(db, `USER/${uid}`));
        toast.success("Đã xoá học sinh");
      } catch (err) {
        console.error(err);
        toast.error("Lỗi xoá học sinh");
      }
    }
  };

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [visibleEntries.length, totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterClass,
    filterDateFrom,
    filterDateTo,
    visibleEntries.length,
  ]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <h3 className="text-xl font-semibold">Danh sách học sinh</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Tìm theo tên học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
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
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            placeholder="Từ ngày sinh"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            placeholder="Đến ngày sinh"
          />
        </div>
        <div className="text-sm text-gray-600">
          {visibleEntries.length} học sinh &nbsp;|&nbsp; Trang {page}/
          {totalPages}
        </div>
      </div>

      {/* Cards view: shown on screens < lg */}
      <div className="block lg:hidden">
        {pagedEntries.length === 0 ? (
          <div className="text-center text-gray-500 p-6 bg-white rounded-lg shadow">
            Không có học sinh nào
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pagedEntries.map(([uid, s]) => (
              <div
                key={uid}
                className="bg-white p-4 rounded-lg shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500 font-mono">{uid}</div>
                    <div className="text-xs text-gray-400">
                      {s.class || "-"}
                    </div>
                  </div>
                  <div className="text-lg font-medium text-gray-800 mb-1 truncate">
                    {s.name || "-"}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    {s.parentName
                      ? `Phụ huynh: ${s.parentName}`
                      : "Phụ huynh: -"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                    <div>
                      <span className="text-gray-500">SĐT HS:</span>{" "}
                      <span className="font-medium">{s.phone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">SĐT PH:</span>{" "}
                      <span className="font-medium">
                        {s.parentPhone || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Giới tính:</span>{" "}
                      <span className="font-medium">{s.gender || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ngày sinh:</span>{" "}
                      <span className="font-medium">{fmtDate(s.dob)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => setEditUID(uid)}
                    className="flex-1 px-3 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 rounded-md"
                  >
                    ✏️ Chỉnh sửa
                  </button>
                  <a
                    href={`/card/${uid}`}
                    className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md text-center"
                  >
                    🔎 Xem
                  </a>
                  {/* <button
                    // onClick={() => handleDeleteStudent(uid)}
                    className="px-3 py-2 text-sm bg-gray-100 text-black rounded-md hover:bg-red-500 transition-colors"
                  >
                    ✉️ Gửi thông báo
                  </button> */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table view: shown on lg and above */}
      <div className="hidden lg:block">
        <section className="bg-white p-6 rounded-2xl shadow-md border">
          <div className="overflow-x-auto rounded-2xl">
            <table className="min-w-full text-sm divide-y">
              <thead className="bg-blue-400 text-black">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-sm">UID</th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    Họ tên
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    Phụ huynh
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-sm">Lớp</th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    SĐT PH
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    SĐT HS
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    Giới tính
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    Ngày sinh
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-sm">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y">
                {pagedEntries.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-6 text-center text-gray-500">
                      Không có học sinh nào
                    </td>
                  </tr>
                ) : (
                  pagedEntries.map(([uid, s]) => (
                    <tr key={uid} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">{uid}</td>
                      <td className="px-4 py-3 text-sm">{s.name || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        {s.parentName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">{s.class || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        {s.parentPhone || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">{s.phone || "-"}</td>
                      <td className="px-4 py-3 text-sm">{s.gender || "-"}</td>
                      <td className="px-4 py-3 text-sm">{fmtDate(s.dob)}</td>

                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditUID(uid)}
                            className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 rounded-md"
                          >
                            ✏️
                          </button>
                          <a
                            href={`/card/${uid}`}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md"
                          >
                            🔎
                          </a>
                          {/* <button className="px-3 py-1 bg-gray-100 hover:bg-red-500 text-black rounded-md">
                            📤
                          </button> */}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition"
          >
            Previous
          </button>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition"
          >
            Next
          </button>
        </div>

        <div className="text-sm text-gray-600">
          Trang {page} / {totalPages}
        </div>
      </div>

      {editUID && (
        <ModalEditStudent uid={editUID} onClose={() => setEditUID(null)} />
      )}
    </div>
  );
}
