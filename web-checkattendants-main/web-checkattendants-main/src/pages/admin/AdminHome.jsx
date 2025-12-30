import { useEffect, useState } from "react";
import { ref, set, get, onValue, remove, update } from "firebase/database";
import { db } from "../../firebase";
import bcrypt from "bcryptjs";
import toast from "react-hot-toast";
import ModalApprove from "../../components/ModalApprove";
import ModalEditStudent from "../../components/ModalEditStudent";
import { Link } from "react-router-dom";

/**
 * AdminAccounts (updated)
 * - Tạo account Admin / Class
 * - Phần Pending (phê duyệt thẻ) có phân trang (pageSize = 8)
 * - Danh sách học sinh (USER) có phân trang (pageSize = 8)
 * - Dùng ModalApprove để phê duyệt + ModalEditStudent để edit học sinh
 */

const PAGE_SIZE = 8;

function parseVNDateTime(vn) {
  // format expected: "dd-mm-yyyy HH:MM:SS" or similar
  if (!vn) return 0;
  try {
    const [dmy, hm] = vn.split(" ");
    const [d, m, y] = dmy.split("-").map((x) => parseInt(x, 10));
    const [hh = "0", mm = "0", ss = "0"] = (hm || "").split(":");
    return new Date(y, m - 1, d, parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10)).getTime();
  } catch {
    const t = Date.parse(vn);
    return isNaN(t) ? 0 : t;
  }
}

export default function AdminAccounts() {
  // account creation
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("class");
  const [classManaged, setClassManaged] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);

  // class options
  const [classOptions, setClassOptions] = useState([]);

  // Pending data & pagination
  const [pendingArr, setPendingArr] = useState([]); // [{ uid, status, time }]
  const [pendingPage, setPendingPage] = useState(1);

  // Students data & pagination
  const [studentsArr, setStudentsArr] = useState([]); // [{ uid, ...user }]
  const [studentsPage, setStudentsPage] = useState(1);

  // modals
  const [approveUID, setApproveUID] = useState(null);
  const [editUID, setEditUID] = useState(null);

  // load Class options (realtime)
  useEffect(() => {
    const cRef = ref(db, "Class");
    const unsub = onValue(cRef, (snap) => {
      const v = snap.val() || {};
      setClassOptions(Object.keys(v));
    });
    return () => unsub();
  }, []);

  // load Pending list realtime
  useEffect(() => {
    const pRef = ref(db, "Pending");
    const unsub = onValue(pRef, (snap) => {
      const val = snap.val() || {};
      // convert to array of { uid, ... }
      const arr = Object.keys(val).map((uid) => ({
        uid,
        ...(val[uid] || {}),
      }));
      // Sắp xếp theo time mới nhất lên đầu bảng
      arr.sort((a, b) => {
        const ta = parseVNDateTime(a.time);
        const tb = parseVNDateTime(b.time);
        return tb - ta; // Mới nhất lên đầu
      });
      setPendingArr(arr);
      // reset to first page when data changes (Firebase updates asynchronously)
      setPendingPage(1);
    });
    return () => unsub();
  }, []);

  // load USER list realtime
  useEffect(() => {
    const uRef = ref(db, "USER");
    const unsub = onValue(uRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.keys(val).map((uid) => ({ uid, ...(val[uid] || {}) }));
      // Sắp xếp theo createdAt mới nhất lên đầu
      arr.sort((a, b) => {
        const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cb - ca; // Mới nhất lên đầu
      });
      setStudentsArr(arr);
      // reset to first page when user list changes
      setStudentsPage(1);
    });
    return () => unsub();
  }, []);

  // create account function
  const create = async () => {
    if (!username) return toast.error("Bạn hãy thêm username");
    if (role === "class" && !classManaged) return toast.error("Nhập mã lớp");
    setLoadingCreate(true);
    try {
      const snap = await get(ref(db, `ACCOUNTS/${username}`));
      if (snap.exists()) {
        toast.error("Username tồn tại");
        setLoadingCreate(false);
        return;
      }

      const hash = bcrypt.hashSync(username, 10);
      await set(ref(db, `ACCOUNTS/${username}`), {
        uid: null,
        username,
        passwordHash: hash,
        role,
        classManaged: role === "class" ? classManaged : null,
        createdAt: new Date().toISOString(),
      });

      if (role === "class") {
        // Only create class node if not exists - preserve existing students if present
        const classSnap = await get(ref(db, `Class/${classManaged}`));
        if (!classSnap.exists()) {
          await set(ref(db, `Class/${classManaged}`), {
            className: classManaged,
            classAccount: username,
            students: {},
          });
        } else {
          // if exists, just ensure classAccount is set
          await set(ref(db, `Class/${classManaged}/classAccount`), username);
        }
      }

      toast.success("Tạo account thành công. (Mật khẩu = username)");
      setUsername("");
      setClassManaged("");
      setRole("class");
    } catch (err) {
      console.error(err);
      toast.error("Lỗi tạo account");
    } finally {
      setLoadingCreate(false);
    }
  };

// Xử lý xoá học sinh + toàn bộ dữ liệu liên quan
const handleDeleteStudent = async (uid) => {
  if (!window.confirm("Bạn có chắc muốn xoá toàn bộ dữ liệu của học sinh này?")) {
    return;
  }

  try {
    // 1️⃣ Lấy class của học sinh trước khi xoá
    const snap = await get(ref(db, `USER/${uid}`));
    const userData = snap.val();

    const className = userData?.class || null;

    // 2️⃣ Tạo object xoá
    const updates = {};

    updates[`USER/${uid}`] = null;                 // Xoá hồ sơ User
    updates[`RFID/${uid}`] = null;                 // Xoá dữ liệu RFID
    updates[`Notifications/${uid}`] = null;        // Xoá thông báo
    updates[`Pending/${uid}`] = null;              // Xoá pending nếu có

    if (className) {
      updates[`Class/${className}/students/${uid}`] = null; // Xoá khỏi class
    }

    // 3️⃣ Thực hiện xoá một lần
    await update(ref(db), updates);

    toast.success("Đã xoá toàn bộ dữ liệu của học sinh.");
  } catch (err) {
    console.error(err);
    toast.error("Lỗi xoá dữ liệu học sinh.");
  }
};


  // pagination helpers
  const pendingTotalPages = Math.max(1, Math.ceil(pendingArr.length / PAGE_SIZE));
  const studentsTotalPages = Math.max(1, Math.ceil(studentsArr.length / PAGE_SIZE));

  const pendingPageItems = pendingArr.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);
  const studentsPageItems = studentsArr.slice((studentsPage - 1) * PAGE_SIZE, studentsPage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      {/* --- Section 1: Tạo tài khoản --- */}
      <section className="bg-white p-6 rounded-2xl shadow-md border">
        <h3 className="text-xl font-semibold mb-6 text-gray-800">⚙️ Tạo tài khoản Admin / Class</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            placeholder="Nhập username"
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {/* <option value="admin">Admin</option> */}
            <option value="class">Class</option>
          </select>

          {role === "class" ? (
            <select
              value={classManaged}
              onChange={(e) => setClassManaged(e.target.value)}
              className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn hoặc nhập lớp --</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <div className="hidden md:block" />
          )}

          <div className="md:col-span-3 flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={create}
              disabled={loadingCreate}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
            >
              {loadingCreate ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
            <p className="text-sm text-gray-500 self-center">
              *Mật khẩu mặc định = username.
            </p>
          </div>
        </div>
      </section>

      {/* --- Section 2: Pending (Phê duyệt thẻ) with pagination --- */}
      <section className="bg-white p-6 rounded-2xl shadow-md border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-800">📋 Phê duyệt thẻ (Pending)</h4>
          <div className="text-sm text-gray-600">Tổng: {pendingArr.length} | Trang {pendingPage} / {pendingTotalPages}</div>
        </div>

        {pendingArr.length === 0 ? (
          <div className="text-sm text-gray-500">Không có pending nào.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-400">
                  <tr>
                    <th className="p-2 text-left">UID</th>
                    <th className="p-2 text-left">Trạng thái</th>
                    <th className="p-2 text-left">Thời gian</th>
                    <th className="p-2 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPageItems.map((p) => (
                    <tr key={p.uid} className="border-t hover:bg-gray-50">
                      <td className="p-2">{p.uid}</td>
                      <td className="p-2">{p.status || "-"}</td>
                      <td className="p-2">{p.time || "-"}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setApproveUID(p.uid)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-green-500 text-sm"
                          >
                            Duyệt
                          </button>
                          {/* <Link to={`/card/${p.uid}`} className="px-2 py-1 bg-gray-200 rounded text-sm">Xem</Link> */}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination controls */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingPage((s) => Math.max(1, s - 1))}
                  disabled={pendingPage <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPendingPage((s) => Math.min(pendingTotalPages, s + 1))}
                  disabled={pendingPage >= pendingTotalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              <div className="text-sm text-gray-600">
                Trang {pendingPage} / {pendingTotalPages}
              </div>
            </div>
          </>
        )}
      </section>

      {/* --- Section 3: Danh sách học sinh (Toàn bộ) with pagination --- */}
      <section className="bg-white p-6 rounded-2xl shadow-md border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-800">👩‍🎓 Danh sách học sinh (Toàn bộ)</h4>
          <div className="text-sm text-gray-600">Tổng: {studentsArr.length} | Trang {studentsPage} / {studentsTotalPages}</div>
        </div>

        {studentsArr.length === 0 ? (
          <div className="text-sm text-gray-500">Không có học sinh nào.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-400">
                  <tr>
                    <th className="p-2 text-left">UID</th>
                    <th className="p-2 text-left">Họ và tên học sinh</th>
                    <th className="p-2 text-left">Lớp</th>
                    <th className="p-2 text-left">Phụ huynh</th>
                    <th className="p-2 text-left">SĐT Phụ Huynh</th>
                    <th className="p-2 text-left">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsPageItems.map((s) => (
                    <tr key={s.uid} className="border-t hover:bg-gray-50">
                      <td className="p-2">{s.uid}</td>
                      <td className="p-2">{s.name || "-"}</td>
                      <td className="p-2">{s.class || "-"}</td>
                      <td className="p-2">{s.parentName || "-"}</td>
                      <td className="p-2">{s.parentPhone || s.phone || "-"}</td>
                      <td className="p-2 text-center">
                        <div className="flex gap-2">
                          <button onClick={() => setEditUID(s.uid)} className="px-2 py-1 bg-yellow-400 rounded text-sm">✏️</button>
                          <Link to={`/card/${s.uid}`} className="px-2 py-1 bg-gray-200 rounded text-sm">Xem</Link>
                          <button
                            onClick={() => handleDeleteStudent(s.uid)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination controls */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setStudentsPage((s) => Math.max(1, s - 1))}
                  disabled={studentsPage <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setStudentsPage((s) => Math.min(studentsTotalPages, s + 1))}
                  disabled={studentsPage >= studentsTotalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              <div className="text-sm text-gray-600">
                Trang {studentsPage} / {studentsTotalPages}
              </div>
            </div>
          </>
        )}
      </section>

      {/* modals */}
      {approveUID && <ModalApprove uid={approveUID} onClose={() => setApproveUID(null)} />}
      {editUID && <ModalEditStudent uid={editUID} onClose={() => setEditUID(null)} />}
    </div>
  );
}
