// src/pages/class/ClassStudentList.jsx
import { useEffect, useState } from "react";
import { ref, onValue, remove, get } from "firebase/database";
import { db } from "../../firebase";

import ModalEditStudent from "../../components/ModalEditStudent";
import ModalSendNotification from "../../components/ModalSendNotification";
import ModalViewNotifications from "../../components/ModalViewNotifications";

import toast from "react-hot-toast";

const PAGE_SIZE = 8;

export default function ClassStudentList() {
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);

  const [editUID, setEditUID] = useState(null);
  const [sendNotifUID, setSendNotifUID] = useState(null);
  const [viewNotifUID, setViewNotifUID] = useState(null);

  // FILTER
  const [search, setSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Class teacher info
  const logged = JSON.parse(localStorage.getItem("rfid_logged_user") || "{}");
  const classManaged = logged?.classManaged || null;

  /* ---------------- LOAD STUDENTS ---------------- */
  useEffect(() => {
    if (!classManaged) return;

    const classRef = ref(db, `Class/${classManaged}/students`);
    const unsub = onValue(classRef, async (snap) => {
      const uids = Object.keys(snap.val() || {});
      const arr = [];

      for (let uid of uids) {
        const s = await get(ref(db, `USER/${uid}`));
        if (s.exists()) arr.push([uid, s.val()]);
      }

      // Sort newest first
      arr.sort((a, b) => {
        const tA = a[1].createdAt ? new Date(a[1].createdAt).getTime() : 0;
        const tB = b[1].createdAt ? new Date(b[1].createdAt).getTime() : 0;
        return tB - tA;
      });

      setStudents(arr);
    });

    return () => unsub();
  }, [classManaged]);

  /* ---------------- FILTERING ---------------- */
  const visibleEntries = students
    .filter(([uid, s]) =>
      !search || (s.name || "").toLowerCase().includes(search.toLowerCase())
    )
    .filter(([uid, s]) => {
      if (filterDateFrom) {
        const dob = s.dob ? new Date(s.dob) : null;
        if (!dob || dob < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const dob = s.dob ? new Date(s.dob) : null;
        if (!dob || dob > new Date(filterDateTo)) return false;
      }
      return true;
    });

  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / PAGE_SIZE));
  const pagedEntries = visibleEntries.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  /* ---------------- UTILS ---------------- */
  const fmtDate = (d) => {
    if (!d) return "-";
    try {
      const dt = new Date(d);
      return isNaN(dt) ? d : dt.toLocaleDateString();
    } catch {
      return d;
    }
  };

  /* ---------------- DELETE ---------------- */
  const handleDeleteStudent = async (uid) => {
    if (!window.confirm("Bạn có chắc muốn xoá học sinh này?")) return;

    try {
      await remove(ref(db, `USER/${uid}`));
      await remove(ref(db, `Class/${classManaged}/students/${uid}`));
      toast.success("Đã xoá học sinh");
    } catch {
      toast.error("Lỗi xoá học sinh");
    }
  };

  /* ---------------- RESET PAGE ---------------- */
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [visibleEntries.length, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, filterDateFrom, filterDateTo]);

  /* ---------------- UI ---------------- */
  return (
    <div>
      {/* HEADER + FILTER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
        <h3 className="text-xl font-semibold">Danh sách học sinh lớp {classManaged}</h3>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Tìm theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div className="text-sm text-gray-600">
          {visibleEntries.length} học sinh • Trang {page}/{totalPages}
        </div>
      </div>

      {/* ---------------- MOBILE VIEW ---------------- */}
      <div className="block lg:hidden">
        {pagedEntries.length === 0 ? (
          <div className="text-center text-gray-500 p-6 bg-white rounded-lg shadow">
            Không có học sinh nào
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pagedEntries.map(([uid, s]) => (
              <div key={uid} className="bg-white p-4 rounded-lg shadow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between mb-2">
                    <div className="text-sm text-gray-500 font-mono">{uid}</div>
                    <div className="text-xs text-gray-400">{s.class || "-"}</div>
                  </div>

                  <div className="text-lg font-semibold">{s.name}</div>
                  <div className="text-sm text-gray-600">Phụ huynh: {s.parentName || "-"}</div>
                </div>

                <div className="mt-4 flex gap-2">
                  {/* <button
                    onClick={() => setEditUID(uid)}
                    className="flex-1 px-3 py-2 bg-yellow-400 rounded hover:bg-yellow-500"
                  >
                    ✏️
                  </button> */}

                  <a href={`/card/${uid}`} className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">
                    🔎
                  </a>

                  <button
                    onClick={() => setSendNotifUID(uid)}
                    className="px-3 py-2 bg-blue-200 rounded hover:bg-blue-300"
                  >
                    📤
                  </button>

                  <button
                    onClick={() => setViewNotifUID(uid)}
                    className="px-3 py-2 bg-purple-200 rounded hover:bg-purple-300"
                  >
                    📄
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- DESKTOP TABLE ---------------- */}
      <div className="hidden lg:block">
        <section className="bg-white p-6 rounded-2xl shadow-md border">
          <div className="overflow-x-auto rounded">
            <table className="min-w-full text-sm divide-y">
              <thead className="bg-blue-400 text-black font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">UID</th>
                  <th className="px-4 py-3 text-left">Họ tên</th>
                  <th className="px-4 py-3 text-left">Phụ huynh</th>
                  {/* <th className="px-4 py-3 text-left">SĐT PH</th> */}
                  <th className="px-4 py-3 text-left">SĐT HS</th>
                  <th className="px-4 py-3 text-left">Giới tính</th>
                  <th className="px-4 py-3 text-left">Ngày sinh</th>
                  <th className="px-4 py-3 text-left">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {pagedEntries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center p-6 text-gray-500">
                      Không có học sinh
                    </td>
                  </tr>
                ) : (
                  pagedEntries.map(([uid, s]) => (
                    <tr key={uid} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{uid}</td>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">{s.parentName || "-"}</td>
                      {/* <td className="px-4 py-3">{s.parentPhone || "-"}</td> */}
                      <td className="px-4 py-3">{s.phone || "-"}</td>
                      <td className="px-4 py-3">{s.gender || "-"}</td>
                      <td className="px-4 py-3">{fmtDate(s.dob)}</td>

                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {/* <button
                            onClick={() => setEditUID(uid)}
                            className="px-3 py-1 bg-yellow-400 rounded hover:bg-yellow-500"
                          >
                            ✏️
                          </button> */}

                          <a href={`/card/${uid}`} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
                            🔎
                          </a>

                          <button
                            onClick={() => setSendNotifUID(uid)}
                            className="px-3 py-1 bg-blue-200 rounded hover:bg-blue-300"
                          >
                            📤
                          </button>

                          <button
                            onClick={() => setViewNotifUID(uid)}
                            className="px-3 py-1 bg-purple-200 rounded hover:bg-purple-300"
                          >
                            📄
                          </button>
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

      {/* ---------------- PAGINATION ---------------- */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            Previous
          </button>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

      {/* ---------------- MODALS ---------------- */}
      {editUID && (
        <ModalEditStudent uid={editUID} onClose={() => setEditUID(null)} />
      )}

      {sendNotifUID && (
        <ModalSendNotification
          studentUID={sendNotifUID}
          classManaged={classManaged}
          onClose={() => setSendNotifUID(null)}
        />
      )}

      {viewNotifUID && (
        <ModalViewNotifications
          studentUID={viewNotifUID}
          onClose={() => setViewNotifUID(null)}
        />
      )}
    </div>
  );
}
