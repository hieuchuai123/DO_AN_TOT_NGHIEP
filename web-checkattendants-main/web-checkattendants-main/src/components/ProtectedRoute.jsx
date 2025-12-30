import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ roles = [], children }) {
  const raw = localStorage.getItem("rfid_logged_user");
  if (!raw) return <Navigate to="/login" replace />;

  try {
    const logged = JSON.parse(raw);
    const hasAccess =
      roles.length === 0 || roles.includes(logged.role); // roles=[] → public route

    if (hasAccess) return children;
    return <Navigate to="/login" replace />;
  } catch (err) {
    console.error("Invalid user data:", err);
    return <Navigate to="/login" replace />;
  }
}
