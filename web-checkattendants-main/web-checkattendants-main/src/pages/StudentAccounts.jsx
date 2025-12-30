// FIXED StudentAccounts Pagination (final version)
import { useEffect, useState } from "react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 12;

export default function StudentAccounts() {
  const navigate = useNavigate();
  const raw = localStorage.getItem("rfid_logged_user");
  const logged = raw ? JSON.parse(raw) : null;
  const uid = logged?.uid || null;

  const [user, setUser] = useState(null);
  const [rfid, setRfid] = useState(null);
  const [history, setHistory] = useState([]);

  const [page, setPage] = useState(1);

  /* ===================== LOAD DATA ===================== */
  useEffect(() => {
    if (!logged) { navigate("/login"); return; }
    if (logged.role !== "student" || !uid) { navigate("/login"); return; }

    // Load user info
    get(ref(db, `USER/${uid}`)).then((snap) => {
      if (snap.exists()) setUser(snap.val());
    });

    // Listen RFID data realtime
    const rRef = ref(db, `RFID/${uid}`);
    const unsub = onValue(rRef, (snap) => {
      if (!snap.exists()) {
        setRfid(null);
        setHistory([]);
        return;
      }

      const data = snap.val();
      setRfid({
        lastStatus: data.lastStatus ?? "Undefined",
        createdAt: data.createdAt ?? null,
        raw: data
      });

      const logs = data.accessLog || data.accessLogs || {};

      let newHistory = Object.values(logs).map((item) => ({
        time: item.time ?? null,
        status: item.status ?? item.state ?? "Undefined",
      }));

      newHistory.sort(
        (a, b) =>
          (b.time ? new Date(b.time) : 0) -
          (a.time ? new Date(a.time) : 0)
      );

      /* -------------------------------
         🔥 FIX: Chỉ reset page khi dữ liệu thay đổi thật sự
      ------------------------------- */
      setHistory((prev) => {
        const oldJson = JSON.stringify(prev);
        const newJson = JSON.stringify(newHistory);

        if (oldJson !== newJson) {
          setPage(1); // reset only when content changed
        }

        return newHistory;
      });
    });

    return () => unsub();
  }, [logged, uid, navigate]);

  /* ===================== PAGINATION ===================== */

  const totalPages =
    history.length === 0 ? 1 : Math.ceil(history.length / PAGE_SIZE);

  // Auto adjust nếu page > totalPages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const currentPageItems = history.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  /* ===================== UI ===================== */

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Trang học sinh</h2>

      {/* USER INFO */}
      <div className="bg-white p-4 rounded shadow mb-6 grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold mb-2">Thông tin cá nhân</h4>
          <div className="text-sm space-y-1">
            <div><strong>UID:</strong> {uid}</div>
            <div><strong>Họ tên:</strong> {user?.name || "-"}</div>
            <div><strong>Phụ huynh:</strong> {user?.parentName || "-"}</div>
            <div><strong>Lớp:</strong> {user?.class || "-"}</div>
            <div><strong>Điện thoại:</strong> {user?.phone || "-"}</div>
            <div><strong>SĐT phụ huynh:</strong> {user?.parentPhone || "-"}</div>
            <div><strong>Ngày sinh:</strong> {user?.dob || "-"}</div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">RFID / trạng thái</h4>
          <div className="mb-2">
            <div
              className={`inline-block px-3 py-1 rounded text-sm ${
                rfid?.lastStatus
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {rfid?.lastStatus ?? "Không có"}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <strong>Created:</strong> {rfid?.createdAt ?? "-"}
          </div>
        </div>
      </div>

      {/* RFID HISTORY */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold">Lịch sử quẹt thẻ</h4>
          <div className="text-sm text-gray-500">
            Tổng: {history.length} | Trang {page}/{totalPages}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-sm text-gray-500">Không có lịch sử</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Thời gian</th>
                    <th className="p-2 text-left">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageItems.map((h, idx) => (
                    <tr key={idx} className="border-t hover:bg-gray-50">
                      <td className="p-2">{h.time ?? "-"}</td>
                      <td className="p-2">{h.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="flex justify-between items-center mt-3">
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
    </div>
  );
}
