// src/pages/students/CheckAttendance.jsx
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase";

/**
 * CheckAttendance
 * - Hiển thị lịch sử quẹt thẻ của học sinh (RFID access log)
 * - Dùng realtime onValue() để lắng nghe thay đổi
 * - Giới hạn hiển thị tối đa 30 bản ghi mới nhất
 */
export default function CheckAttendance({ uid }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!uid) return;

    const rRef = ref(db, `RFID/${uid}`);
    const unsub = onValue(rRef, (snap) => {
      if (!snap.exists()) {
        setHistory([]);
        return;
      }

      const data = snap.val();
      const accessLogObj = data.accessLog || data.accessLogs || null;

      if (accessLogObj) {
        let arr = Object.values(accessLogObj).map((item) => ({
          time: item.time ?? "-",
          status: item.status ?? item.state ?? JSON.stringify(item),
        }));

        // sắp xếp theo thời gian mới nhất
        arr.sort(
          (a, b) =>
            (b.time ? new Date(b.time).getTime() : 0) -
            (a.time ? new Date(a.time).getTime() : 0)
        );

        setHistory(arr.slice(0, 30));
      } else {
        setHistory([]);
      }
    });

    return () => unsub();
  }, [uid]);

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h4 className="font-semibold mb-2">Lịch sử quẹt thẻ (mới nhất)</h4>
      {history.length === 0 ? (
        <div className="text-sm text-gray-500">Không có lịch sử</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Thời gian</th>
                <th className="p-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="p-2">{h.time ?? "-"}</td>
                  <td className="p-2">{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
