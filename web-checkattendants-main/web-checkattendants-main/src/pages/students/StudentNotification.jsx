import { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../../firebase";
import toast from "react-hot-toast";

const PAGE_SIZE = 6; // 🔥 số thông báo mỗi trang

export default function StudentNotification() {
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);

  const loggedRaw = localStorage.getItem("rfid_logged_user");
  const logged = loggedRaw ? JSON.parse(loggedRaw) : null;
  const studentUID = logged?.uid || null;

  /* ---------------- LOAD NOTIFICATIONS ---------------- */
  useEffect(() => {
    if (!studentUID) return;

    const notifRef = ref(db, `Notifications/${studentUID}`);

    const unsub = onValue(notifRef, (snap) => {
      const val = snap.val() || {};

      const arr = Object.keys(val).map((id) => ({
        id,
        ...val[id],
      }));

      arr.sort((a, b) => new Date(b.time) - new Date(a.time));

      setList(arr);
    });

    return () => unsub();
  }, [studentUID]);

  /* ---------------- UPDATE STATUS ---------------- */
  const markAsRead = async (notifID) => {
    try {
      await update(ref(db, `Notifications/${studentUID}/${notifID}`), {
        status: "read",
      });
      toast.success("Đã đánh dấu đã đọc");
    } catch {
      toast.error("Không thể cập nhật");
    }
  };

  const markAllRead = async () => {
    try {
      const updates = {};

      list.forEach((n) => {
        updates[`Notifications/${studentUID}/${n.id}/status`] = "read";
      });

      await update(ref(db), updates);
      toast.success("Đã đánh dấu tất cả!");
    } catch (err) {
      toast.error("Lỗi khi đánh dấu");
    }
  };

  /* ---------------- PAGINATION ---------------- */
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));

  const pagedList = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Auto reset page khi list thay đổi, tránh lỗi trang vượt
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [list.length, totalPages]);

  const fmt = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------------- HEADER ---------------- */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Thông báo của bạn</h2>

        {list.some((n) => n.status === "unread") && (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={markAllRead}
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* ---------------- EMPTY ---------------- */}
      {list.length === 0 ? (
        <div className="p-6 text-center text-gray-500 bg-white rounded shadow">
          Không có thông báo nào
        </div>
      ) : (
        <>
          {/* ---------------- LIST ---------------- */}
          <div className="space-y-3">
            {pagedList.map((n) => (
              <div
                key={n.id}
                className={`p-4 border rounded shadow-sm ${
                  n.status === "unread" ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                {/* TAG + TIME */}
                <div className="flex justify-between items-center">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      n.type === "sleepy"
                        ? "bg-yellow-300"
                        : n.type === "health"
                        ? "bg-red-300"
                        : n.type === "focus"
                        ? "bg-green-300"
                        : "bg-gray-300"
                    }`}
                  >
                    {n.type}
                  </span>

                  <span className="text-xs text-gray-500">{fmt(n.time)}</span>
                </div>

                {/* MESSAGE */}
                <div className="mt-2 text-sm text-gray-800">{n.message}</div>

                {/* SENT BY */}
                <div className="mt-1 text-xs text-gray-600">
                  Gửi bởi: {n.sentBy || "-"}
                </div>

                {/* MARK READ BUTTON */}
                {n.status === "unread" && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="mt-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ---------------- PAGINATION ---------------- */}
          <div className="mt-4 flex items-center justify-between px-1">
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
        </>
      )}
    </div>
  );
}
