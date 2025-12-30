import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ref, get, set, update } from "firebase/database";
import { db } from "../firebase";
import toast from "react-hot-toast";

export default function ModalEditStudent({ uid, onClose }) {
  const [form, setForm] = useState(null);
  const [classOptions, setClassOptions] = useState([]);

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

  // Load thông tin học sinh
  useEffect(() => {
    get(ref(db, `USER/${uid}`)).then(snap => {
      setForm(snap.val() || {});
    });
  }, [uid]);

  // Load danh sách lớp
  useEffect(() => {
    const cRef = ref(db, "Class");
    get(cRef).then(snap => {
      const v = snap.val() || {};
      setClassOptions(Object.keys(v));
    });
  }, []);

  if (!form) return null;

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));



const handleSave = async () => {
  try {
    const oldClass = form.class || null;
    const newClass = form.newClass || oldClass;

    const updates = {};

    // 1. Update USER main info
    updates[`USER/${uid}/parentName`] = form.parentName || "";
    updates[`USER/${uid}/phone`] = form.phone || "";
    updates[`USER/${uid}/parentPhone`] = form.parentPhone || "";
    updates[`USER/${uid}/class`] = newClass || null;

    // 1.1 Cập nhật ACCOUNTS.classManaged (nếu có)
    const accountsSnap = await get(ref(db, "ACCOUNTS"));
    const accounts = accountsSnap.val() || {};
    let accountKey = null;
    for (const key in accounts) {
      if (accounts[key]?.uid === uid) {
        accountKey = key;
        break;
      }
    }
    if (accountKey) {
      updates[`ACCOUNTS/${accountKey}/classManaged`] = newClass || null;
    }

    // 2. ĐỔI LỚP (đã có lớp cũ và khác lớp mới)
    if (oldClass && newClass && oldClass !== newClass) {
      const ts = getVNDateTimeString();

      // Lấy full data từ USER
      const userSnap = await get(ref(db, `USER/${uid}`));
      const userData = userSnap.val() || {};

      // Lấy data từ Class/oldClass/students/uid nếu có
      const oldStudentSnap = await get(
        ref(db, `Class/${oldClass}/students/${uid}`)
      );

      let baseData = {};

      if (oldStudentSnap.exists()) {
        // ✅ GIỮ NGUYÊN TOÀN BỘ DATA CŨ CỦA NODE CLASS
        baseData = oldStudentSnap.val() || {};
      } else {
        // Không có node cũ → build lại từ USER
        baseData = {
          uid,
          name: userData.name || form.name || "",
          email: userData.email || form.email || "",
          createdAt: userData.createdAt || ts,
        };
      }

      // Gộp lại: data cũ + movedAt mới
      const newClassStudentNode = {
        ...baseData,
        movedAt: ts,
      };

      // Xoá khỏi lớp cũ
      updates[`Class/${oldClass}/students/${uid}`] = null;

      // Ghi FULL DATA sang lớp mới
      updates[`Class/${newClass}/students/${uid}`] = newClassStudentNode;
    }

    // 3. GÁN LỚP LẦN ĐẦU (chưa có oldClass, giờ chọn newClass)
    if (!oldClass && newClass) {
      const ts = getVNDateTimeString();

      const userSnap = await get(ref(db, `USER/${uid}`));
      const userData = userSnap.val() || {};

      updates[`Class/${newClass}/students/${uid}`] = {
        uid,
        name: userData.name || form.name || "",
        email: userData.email || form.email || "",
        createdAt: userData.createdAt || ts,
      };
    }

    await update(ref(db), updates);

    toast.success(
      "Đã cập nhật thông tin, chuyển đầy đủ dữ liệu lớp cũ sang lớp mới và thêm movedAt."
    );
    onClose();
  } catch (err) {
    console.error(err);
    toast.error("Lỗi lưu thông tin");
  }
};






  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white p-4 sm:p-6 md:p-8 rounded shadow max-w-lg w-full z-10">
        <h3 className="font-semibold mb-3 text-lg md:text-xl">
          Chỉnh sửa học sinh: {form.name}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="parentName"
            value={form.parentName || ""}
            onChange={handleChange}
            className="border p-2 rounded w-full"
            placeholder="Tên phụ huynh"
          />

          {/* --- Dropdown chọn lớp mới --- */}
          {/* <div className="border p-2 rounded w-full"
          >Học lớp: {form.class}</div> */}
          <select
            name="newClass"
            value={form.newClass || form.class || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, newClass: e.target.value }))
            }
            className="border p-2 rounded w-full"
          >
            <option value="">-- Chọn lớp --</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          <input
            name="phone"
            value={form.phone || ""}
            onChange={handleChange}
            className="border p-2 rounded w-full"
            placeholder="SĐT học sinh"
          />
          <input
            name="parentPhone"
            value={form.parentPhone || ""}
            onChange={handleChange}
            className="border p-2 rounded w-full"
            placeholder="SĐT phụ huynh"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-300 rounded w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 text-white rounded w-full sm:w-auto"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
