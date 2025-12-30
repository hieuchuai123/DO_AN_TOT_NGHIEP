import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster, toast } from "react-hot-toast";
import { signInAnon } from "./firebase"; // bạn đã export hàm này

function Root() {
  useEffect(() => {
    // Gọi đăng nhập ẩn để có auth token (tránh "Permission denied" do rules chặn)
    signInAnon()
      .then(() => {
        console.log("Firebase: signed in anonymously");
        toast.success("✅ Firebase connected (anonymous)");
      })
      .catch((err) => {
        console.error("Firebase anonymous sign-in failed:", err);
        toast.error("❌ Firebase sign-in failed. Check console & rules.");
      });
  }, []);

  return (
    <>
      <App />
      <Toaster position="bottom-right" />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
