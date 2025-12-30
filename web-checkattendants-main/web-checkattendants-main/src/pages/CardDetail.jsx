// src/pages/CardDetail.jsx
import { useEffect, useState } from "react";
import { ref, get, onValue } from "firebase/database";
import { db } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";

const PAGE_SIZE = 12; // 🔹 số log mỗi trang

export default function CardDetail() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [rfid, setRfid] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1); // 🔹 trạng thái phân trang

  /* ---------------------------------------------------
     LOAD DATA
  --------------------------------------------------- */
  useEffect(() => {
    const loggedRaw = localStorage.getItem("rfid_logged_user");
    if (!loggedRaw) {
      navigate("/login");
      return;
    }

    const logged = JSON.parse(loggedRaw);

    // Load USER
    get(ref(db, `USER/${uid}`))
      .then((snap) => {
        if (!snap.exists()) {
          setUser(null);
          setLoading(false);
          return;
        }

        const data = snap.val();

        const isAdmin = logged.role === "admin";
        const isClass =
          logged.role === "class" &&
          String(data.class).toLowerCase() === String(logged.classManaged).toLowerCase();
        const isOwner = logged.role === "student" && logged.uid === uid;

        if (!(isAdmin || isClass || isOwner)) {
          setUser(null);
          setLoading(false);
          return;
        }

        setUser(data);
      })
      .finally(() => setLoading(false));

    // Load RFID realtime
    const rfidRef = ref(db, `RFID/${uid}`);
    const unsub = onValue(rfidRef, (snap) => {
      if (!snap.exists()) {
        setRfid(null);
        setHistory([]);
        return;
      }

      const data = snap.val();
      setRfid({
        lastStatus: data.lastStatus ?? "Undefined",
        createdAt: data.createdAt ?? "-",
      });

      const logs = data.accessLog || data.accessLogs || {};
      let arr = Object.values(logs).map((item) => ({
        time: item.time ?? "-",
        status: item.status ?? item.state ?? JSON.stringify(item),
      }));

      arr.sort((a, b) => new Date(b.time) - new Date(a.time));

      setHistory(arr);
      setPage(1); // reset về trang đầu khi dữ liệu reload
    });

    return () => unsub();
  }, [uid, navigate]);

  /* ---------------------------------------------------
     PAGINATION
  --------------------------------------------------- */
  const totalPages =
    history.length === 0 ? 1 : Math.ceil(history.length / PAGE_SIZE);

  const currentPageItems = history.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  /* ---------------------------------------------------
     UI HELPERS
  --------------------------------------------------- */
  const statusColor = (s) => {
    if (!s) return "bg-gray-200 text-gray-700";
    const t = s.toLowerCase();
    if (t.includes("in") || t.includes("lên") || t.includes("len"))
      return "bg-green-100 text-green-800";
    if (t.includes("out") || t.includes("xuống") || t.includes("xuong"))
      return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  /* ---------------------------------------------------
     RENDER
  --------------------------------------------------- */
  if (loading)
    return <div className="p-8 text-center text-gray-600">Đang tải dữ liệu...</div>;

  if (!user)
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 font-semibold mb-3">
          ⛔ Không có quyền xem thẻ này hoặc dữ liệu không tồn tại.
        </div>
        <button
          onClick={() => navigate("/login")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Đăng nhập
        </button>
      </div>
    );

  return (
    <div>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-blue-700">
            Chi tiết thẻ RFID: <span className="font-mono">{uid}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Thông tin học sinh & lịch sử quẹt thẻ đầy đủ
          </p>
        </div>
      </div>

      {/* GRID INFO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Thông tin học sinh */}
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-lg text-blue-700 mb-3">
            🧍‍♂️ Thông tin học sinh
          </h3>

          <div className="space-y-2 text-sm text-gray-700">
            <div><strong>Họ tên:</strong> {user.name}</div>
            <div><strong>Giới tính:</strong> {user.gender || "-"}</div>
            <div><strong>Ngày sinh:</strong> {user.dob || "-"}</div>
            <div><strong>Lớp:</strong> {user.class || "-"}</div>
            <div><strong>Địa chỉ:</strong> {user.address || "-"}</div>
            <div><strong>SĐT:</strong> {user.phone || "-"}</div>
            <div><strong>Phụ huynh:</strong> {user.parentName || "-"}</div>
            <div><strong>SĐT phụ huynh:</strong> {user.parentPhone || "-"}</div>
          </div>
        </div>

        {/* RFID status */}
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-lg text-blue-700 mb-3">
            💳 Trạng thái RFID
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <div>
              <strong>Trạng thái hiện tại:</strong>{" "}
              <span className={`px-3 py-1 rounded ${statusColor(rfid?.lastStatus)}`}>
                {rfid?.lastStatus ?? "Không có"}
              </span>
            </div>
            <div><strong>Ngày tạo:</strong> {rfid?.createdAt}</div>
            <div><strong>Tổng lượt quẹt:</strong> {history.length}</div>
          </div>
        </div>
      </div>

      {/* HISTORY */}
      <div className="mt-10">
        <h3 className="font-semibold text-lg mb-4 text-blue-700">
          🕒 Lịch sử quẹt thẻ
        </h3>

        {history.length === 0 ? (
          <div className="text-gray-500 italic">Không có lịch sử quẹt thẻ.</div>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="p-2 text-left">Thời gian</th>
                    <th className="p-2 text-left">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageItems.map((h, idx) => (
                    <tr key={idx} className="border-t hover:bg-blue-50">
                      <td className="p-2">{h.time}</td>
                      <td className="p-2">{h.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600">
                Trang {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
