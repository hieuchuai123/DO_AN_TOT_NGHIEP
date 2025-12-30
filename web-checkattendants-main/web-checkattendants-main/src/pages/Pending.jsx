import { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db } from "../firebase";
import toast from "react-hot-toast";
import ModalApprove from "../components/ModalApprove";

export default function Pending() {
  const [pending, setPending] = useState({});
  const [selectedUID, setSelectedUID] = useState(null);

  useEffect(() => {
    const pendingRef = ref(db, "Pending");
    onValue(pendingRef, (snapshot) => {
      setPending(snapshot.val() || {});
    });
  }, []);

  const deleteUID = async (uid) => {
    await remove(ref(db, "Pending/" + uid));
    toast.success(`Đã xóa UID ${uid}`);
  };

  return (
    <div>
      {/* <h2 className="text-2xl font-bold mb-4">📋 UID Pending Approval</h2> */}
      {Object.keys(pending).length === 0 ? (
        <p>Không có UID nào pending!!!</p>
      ) : (
        <div className="grid gap-3">
          {Object.entries(pending).map(([uid, info]) => (
            <div
              key={uid}
              className="p-4 border rounded-xl bg-white shadow hover:shadow-lg transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-700">UID: {uid}</p>
                  <p className="text-sm text-gray-500">CreatedAt: {info.time}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    onClick={() => setSelectedUID(uid)}
                  >
                    Duyệt
                  </button>
                  <button
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    onClick={() => deleteUID(uid)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUID && (
        <ModalApprove uid={selectedUID} onClose={() => setSelectedUID(null)} />
      )}
    </div>
  );
}
