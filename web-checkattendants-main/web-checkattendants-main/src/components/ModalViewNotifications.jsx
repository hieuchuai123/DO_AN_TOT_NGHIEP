// src/components/ModalViewNotifications.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase";
import toast from "react-hot-toast";

export default function ModalViewNotifications({ studentUID, onClose }) {
  const [notifications, setNotifications] = useState([]);

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

      setNotifications(arr);
    });

    return () => unsub();
  }, [studentUID]);

  const markAsRead = async (notifID) => {
    try {
      await update(ref(db, `Notifications/${studentUID}/${notifID}`), {
        status: "read",
      });
      toast.success("Đã đánh dấu đã đọc");
    } catch {
      toast.error("Không đánh dấu được");
    }
  };

  const fmt = (d) => {
    if (!d) return "-";
    try {
      const dt = new Date(d);
      return dt.toLocaleString();
    } catch {
      return d;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white w-full max-w-lg p-6 rounded shadow-lg z-10 max-h-[90vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Lịch sử thông báo</h2>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-gray-500 text-center py-6">
              Chưa có thông báo nào
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`border p-3 rounded ${
                  n.status === "unread" ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <div className="flex justify-between">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      n.type === "sleepy"
                        ? "bg-yellow-200"
                        : n.type === "health"
                        ? "bg-red-200"
                        : n.type === "focus"
                        ? "bg-green-200"
                        : "bg-gray-200"
                    }`}
                  >
                    {n.type}
                  </span>

                  <span className="text-xs text-gray-500">{fmt(n.time)}</span>
                </div>

                <div className="mt-2 text-sm">{n.message}</div>

                <div className="mt-1 text-xs text-gray-600">
                  Gửi bởi: {n.sentBy || "-"}
                </div>

                {n.status === "unread" && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t mt-4">
          <button
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
