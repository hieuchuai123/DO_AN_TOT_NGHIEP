// src/pages/admin/AdminListStudents.jsx
import StudentList from "../../pages/StudentList";

export default function AdminListStudents() {
  // StudentList đã có logic role => admin sẽ thấy toàn bộ
  return (
    <div className="mt-4">
      <StudentList />
    </div>
  );
}
