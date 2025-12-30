// src/pages/students/StudentHome.jsx
import { useEffect, useState } from "react";
import { ref, get, onValue } from "firebase/database";
import { db } from "../../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * Parse chuỗi thời gian "DD-MM-YYYY HH:mm:ss" thành Date
 * Ví dụ: "06-12-2025 00:50:58"
 */
function parseVNDateTime(str) {
  if (!str) return null;
  const [datePart, timePart] = str.split(" ");
  if (!datePart) return null;

  const [dd, mm, yyyy] = datePart.split("-").map(Number);
  if (!dd || !mm || !yyyy) return null;

  let hh = 0,
    mi = 0,
    ss = 0;
  if (timePart) {
    const t = timePart.split(":").map(Number);
    hh = t[0] || 0;
    mi = t[1] || 0;
    ss = t[2] || 0;
  }

  return new Date(yyyy, mm - 1, dd, hh, mi, ss);
}

/**
 * Format nhãn trục X (ngày) thành dạng dd/MM
 */
const formatDateTick = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
};

/**
 * Tooltip custom cho biểu đồ cột
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const d = new Date(label);
  const fullDate = isNaN(d)
    ? label
    : d.toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });

  const lenxe = payload.find((p) => p.dataKey === "lenxe")?.value ?? 0;
  const xuongxe = payload.find((p) => p.dataKey === "xuongxe")?.value ?? 0;

  return (
    <div className="bg-white p-2 border rounded text-xs shadow">
      <p className="font-semibold mb-1">{fullDate}</p>
      <p>Lên xe: {lenxe}</p>
      <p>Xuống xe: {xuongxe}</p>
    </div>
  );
};

/**
 * StudentHome
 */
export default function StudentHome() {
  const [user, setUser] = useState(null);
  const [rfid, setRfid] = useState(null);
  const [attendance, setAttendance] = useState({
    daysPresent: 0,
    daysAbsent: 0,
    totalScans: 0,
    lastScanTime: "-",
  });
  const [chartData, setChartData] = useState([]);

  const loggedRaw = localStorage.getItem("rfid_logged_user");
  const logged = loggedRaw ? JSON.parse(loggedRaw) : null;
  const uid = logged?.uid || null;

  useEffect(() => {
    if (!uid) return;

    // 🧍 USER info
    get(ref(db, `USER/${uid}`)).then((snap) => {
      if (snap.exists()) setUser(snap.val());
    });

    // 🎯 RFID realtime info
    const rRef = ref(db, `RFID/${uid}`);
    const unsub = onValue(rRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.val();
      setRfid(data);

      // ===============================
      // XỬ LÝ accessLog -> BIỂU ĐỒ CỘT
      // ===============================
      const rawLogs = data.accessLog ? Object.values(data.accessLog) : [];
      const logs = rawLogs.filter((l) => l && l.time);

      const grouped = {};
      const fmt = new Intl.DateTimeFormat("en-CA"); // -> YYYY-MM-DD

      logs.forEach((l) => {
        const d = parseVNDateTime(l.time); // dùng parser custom
        if (!d || isNaN(d)) return;

        const dateKey = fmt.format(d); // ví dụ "2025-12-06"

        if (!grouped[dateKey]) {
          grouped[dateKey] = { date: dateKey, lenxe: 0, xuongxe: 0 };
        }

        const status = (l.status || "").toLowerCase();

        // Firebase lưu: "Len-xe", "Xuong-xe"
        if (status.startsWith("len")) {
          grouped[dateKey].lenxe++;
        } else if (status.startsWith("xuong")) {
          grouped[dateKey].xuongxe++;
        }
      });

      // Tạo mảng 7 ngày gần nhất tính đến hôm nay (kể cả ngày 0 lần quẹt)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateKey = fmt.format(d);

        last7Days.push(
          grouped[dateKey] || {
            date: dateKey,
            lenxe: 0,
            xuongxe: 0,
          }
        );
      }

      setChartData(last7Days);

      // ===============================
      // THỐNG KÊ TỔNG QUÁT ĐIỂM DANH (7 ngày gần nhất)
      // ===============================
      const totalScans = logs.length; // tổng log (toàn bộ)
      const daysPresent = last7Days.filter((d) => d.lenxe > 0).length; // có ít nhất 1 lần Len-xe
      const daysAbsent = last7Days.length - daysPresent; // còn lại là vắng

      const lastScanTime =
        logs.length > 0
          ? logs
              .slice()
              .sort(
                (a, b) =>
                  parseVNDateTime(b.time) - parseVNDateTime(a.time)
              )[0].time
          : "-";

      setAttendance({ daysPresent, daysAbsent, totalScans, lastScanTime });
    });

    return () => unsub();
  }, [uid]);

  if (!user)
    return (
      <div className="p-6 text-center text-gray-500">Đang tải thông tin...</div>
    );

  return (
    <div className="p-4">
      {/* Header */}
      <div className="bg-blue-800 text-white rounded-t-xl p-4 mb-6">
        <h1 className="text-2xl font-bold uppercase">
          Primary School
        </h1>
      </div>

      {/* Section title */}
      <div className="bg-white p-3 rounded-t-lg shadow inline-block mb-4">
        <h2 className="text-lg font-semibold text-blue-700">
          THÔNG TIN HỌC SINH
        </h2>
      </div>

      {/* GRID MAIN INFO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Cột 1: Thông tin HS */}
        <div className="bg-white shadow rounded-xl p-4 text-sm">
          <h3 className="font-semibold text-gray-800 mb-2">
            Thông tin học sinh
          </h3>
          <table className="w-full border text-sm">
            <tbody>
              <tr>
                <td className="border p-2 w-1/3 font-medium">Họ tên</td>
                <td className="border p-2">{user.name}</td>
              </tr>
              <tr>
                <td className="border p-2">Ngày sinh</td>
                <td className="border p-2">{user.dob}</td>
              </tr>
              <tr>
                <td className="border p-2">Lớp</td>
                <td className="border p-2">{user.class}</td>
              </tr>
              <tr>
                <td className="border p-2">Giới tính</td>
                <td className="border p-2">{user.gender || "-"}</td>
              </tr>
              <tr>
                <td className="border p-2">Địa chỉ</td>
                <td className="border p-2">{user.address || "-"}</td>
              </tr>
              <tr>
                <td className="border p-2">SĐT</td>
                <td className="border p-2">{user.phone}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cột 2: Biểu đồ cột */}
        <div className="bg-white shadow rounded-xl p-4">
          <h3 className="text-center font-semibold text-sm mb-2 text-gray-700">
            Biểu đồ số lần lên - xuống xe (7 ngày gần nhất)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="lenxe" fill="#165dfc" name="Lên xe" />
              <Bar dataKey="xuongxe" fill="#52a1ff" name="Xuống xe" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cột 3: Biểu đồ tròn (chưa đổi logic, sẽ chỉnh sau nếu cần) */}
        <div className="bg-white shadow rounded-xl p-4">
          <h3 className="text-center font-semibold text-sm mb-2 text-gray-700">
            Số ngày đã đi học trong một tuần
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Đi học", value: attendance.daysPresent },
                  { name: "Vắng", value: Math.max(attendance.daysAbsent, 0) },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label
              >
                <Cell fill="#165dfc" />
                <Cell fill="#52a1ff" />
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GRID BOTTOM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Thông tin người liên hệ */}
        <div className="bg-white shadow rounded-xl p-4 text-sm">
          <h3 className="font-semibold mb-2 text-gray-800">
            Thông tin người liên hệ
          </h3>
          <table className="w-full border text-sm">
            <tbody>
              <tr>
                <td className="border p-2 w-1/3 font-medium">
                  Họ tên phụ huynh
                </td>
                <td className="border p-2">{user.parentName || "Null"}</td>
              </tr>
              <tr>
                <td className="border p-2">Địa chỉ liên hệ</td>
                <td className="border p-2">{user.address || "Null"}</td>
              </tr>
              <tr>
                <td className="border p-2">Điện thoại phụ huynh</td>
                <td className="border p-2">{user.parentPhone || "Null"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tổng quan điểm danh */}
        <div className="bg-white shadow rounded-xl p-4 text-sm">
          <h3 className="font-semibold mb-2 text-gray-800">
            Tổng quan điểm danh
          </h3>
          <table className="w-full border text-sm">
            <tbody>
              <tr>
                <td className="border p-2 w-1/2 font-medium">
                  Tổng số lượt quẹt
                </td>
                <td className="border p-2">{attendance.totalScans}</td>
              </tr>
              <tr>
                <td className="border p-2">Số ngày đi học 7 ngày gần nhất</td>
                <td className="border p-2">{attendance.daysPresent}</td>
              </tr>
              <tr>
                <td className="border p-2">Số ngày vắng 7 ngày gần nhất</td>
                <td className="border p-2">{attendance.daysAbsent}</td>
              </tr>
              <tr>
                <td className="border p-2">Lần quẹt gần nhất</td>
                <td className="border p-2">{attendance.lastScanTime}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
