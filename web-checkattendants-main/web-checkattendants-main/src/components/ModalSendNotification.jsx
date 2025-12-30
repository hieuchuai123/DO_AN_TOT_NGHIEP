// src/components/ModalSendNotification.jsx
import { useState } from "react";
import { createPortal } from "react-dom";
import { ref, push } from "firebase/database";
import { db } from "../firebase";
import toast from "react-hot-toast";

export default function ModalSendNotification({ studentUID, classManaged, onClose }) {
  const [type, setType] = useState("sleepy");
  const [message, setMessage] = useState("");

  const logged = JSON.parse(localStorage.getItem("rfid_logged_user") || "{}");

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Vui lòng nhập nội dung thông báo");
      return;
    }

    try {
      await push(ref(db, `Notifications/${studentUID}`), {
        message,
        type,
        class: classManaged,
        sentBy: logged.username || "unknown",
        sentByUID: logged.uid || null,
        time: new Date().toISOString(),
        status: "unread",
      });

      toast.success("Đã gửi thông báo!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi gửi thông báo");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative bg-white w-full max-w-md p-6 rounded shadow-lg z-10">
        <h2 className="text-xl font-semibold mb-4">Gửi thông báo</h2>

        {/* Select type */}
        <label className="text-sm font-medium">Loại thông báo</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border p-2 rounded mt-1 mb-4"
        >
          <option value="sleepy">Buồn ngủ / Ngủ gật</option>
          <option value="health">Sức khoẻ không tốt</option>
          {/* <option value="focus">Thiếu tập trung</option> */}
          <option value="custom">Tuỳ chỉnh</option>
        </select>

        {/* Message */}
        <label className="text-sm font-medium">Nội dung</label>
        <textarea
          className="w-full border p-2 rounded mt-1 h-28"
          placeholder="Nhập nội dung thông báo..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        ></textarea>

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-4 py-2 bg-gray-300 rounded"
            onClick={onClose}
          >
            Hủy
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleSend}
          >
            Gửi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
