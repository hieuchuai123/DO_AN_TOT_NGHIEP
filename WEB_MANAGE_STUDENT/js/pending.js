// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ✅ Config Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDML_o7tVQOf7wrzdA3NasklY5Wb3cPCjo",
    authDomain: "do-an-tot-nghiep-9ac13.firebaseapp.com",
    databaseURL: "https://do-an-tot-nghiep-9ac13-default-rtdb.firebaseio.com",
    projectId: "do-an-tot-nghiep-9ac13",
    storageBucket: "do-an-tot-nghiep-9ac13.firebasestorage.app",
    messagingSenderId: "730219064422",
    appId: "1:730219064422:web:cc34bf274e9cbb5fda11a7",
    measurementId: "G-B8T2P01SNJ"
};

// ✅ Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ✅ formatDate
function formatDateVN(dateStr) {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

// ✅ Load danh sách UID Pending
function loadPending() {
    const pendingRef = ref(db, "Pending");
    onValue(pendingRef, (snapshot) => {
        const container = $("#pendingList");
        container.empty();

        const data = snapshot.val();
        if (!data) {
            container.html("<p>Không có UID nào pending ✅</p>");
            return;
        }

        $.each(data, function (uid, info) {
            const div = $(`
                <div class="uid-item">
                    UID: ${uid} - CreatedAt: ${info.time}
                    <button class="approve-btn" data-uid="${uid}">Duyệt</button>
                    <button class="reject-btn" data-uid="${uid}">Xóa</button>
                </div>
            `);
            container.append(div);
        });
    });
}

// Load danh sách Student List
function loadStudentList() {
    const studentRef = ref(db, "USER");
    onValue(studentRef, (snapshot) => {
        const data = snapshot.val();
        console.log("📌 Dữ liệu lấy từ Firebase USER:", data);

        const container = $("#studentList");
        container.empty();

        if (!data) {
            container.append(`
                <tr><td colspan="8" class="text-center">Không có học sinh nào ❌</td></tr>
            `);
            return;
        }

        // ✅ Duyệt qua từng học sinh và hiển thị
        $.each(data, function (uid, info) {
            console.log(`✅ UID: ${uid}`, info);

            const row = $(`
                <tr>
                    <td>${uid}</td>
                    <td>${info.name || ""}</td>
                    <td>${info.class || ""}</td>
                    <td>${info.parentPhone || ""}</td>
                    <td>${info.phone || ""}</td>
                    <td>${info.address || ""}</td>
                    <td>${info.gender || ""}</td>
                    <td>${info.dob || ""}</td>
                    <td>
                        <button class="btn btn-warning btn-sm edit-btn" data-uid="${uid}">✏️ Sửa</button>
                        <button class="btn btn-danger btn-sm delete-btn" data-uid="${uid}">🗑️ Xóa</button>
                        <button class="btn btn-success btn-sm view-info-btn" data-uid="${uid}">ℹ️ Thông tin</button>
                        <button class="btn btn-primary btn-sm view-history-btn" data-uid="${uid}">📜 Lịch sử</button>
                </tr>
            `);

            container.append(row);
        });
    });
}

// Load lịch sử quẹt thẻ của USER
function loadStudentRFIDHistory(uid) {
    const historyRef = ref(db, "RFID/" + uid + "/accessLog");
    onValue(historyRef, (snapshot) => {
        // lấy dữ liệu 
        const historyData = snapshot.val();
        console.log("History User:", historyData);

        // truy xuất vào phần để hiển thị dữ liệu
        const historyContainer = $("#historyList");
        historyContainer.empty();

        // kiểm tra xem có dữ liệu hay không, nếu không có sẽ in ra là không có dữ liệu
        if (!historyData) {
            historyContainer.append(`
                <tr><td colspan="8" class="text-center">Không có lịch sử quét thẻ</td></tr>
            `);
            return;
        }

        // 🔹 Chuyển object thành mảng để dễ xử lý
        let records = Object.values(historyData);

        // 🔹 Lấy 10 bản ghi gần nhất
        records.slice(0, 10).forEach(info => {
            const row = $(`
                <tr>
                    <td>${info.time || ""}</td>
                    <td>${info.status || ""}</td>
                </tr>
            `);
            historyContainer.append(row);
        });
    }, { onlyOnce: true });
}


// ✅ Hàm xử lý phê duyệt user
async function approveUser(uid) {
    // Lấy dữ liệu từ form trong modal
    const userData = {
        name: $("#name").val().trim(),
        role: $("#role").val().trim(),
        class: $("#class").val().trim(),
        parentPhone: $("#parentPhone").val().trim(),
        phone: $("#phone").val().trim(),
        address: $("#address").val().trim(),
        gender: $("#gender").val(),
        dob: $("#dob").val(),
    };

    // 🔍 Validate dữ liệu
    for (const [key, value] of Object.entries(userData)) {
        if (!value) {
            toastr.error(`Trường ${key} không được để trống`, "Lỗi nhập liệu");
            return;
        }
    }

    // Nếu hợp lệ → lưu Firebase
    try {
        // 1️⃣ Lưu thông tin user
        await set(ref(db, "USER/" + uid), userData);

        // 2️⃣ Lưu thông tin RFID
        await set(ref(db, "RFID/" + uid), {
            lastStatus: "Len-xe",
            createdAt: formatDateVN(new Date())
        });

        // 3️⃣ Xóa Pending
        await remove(ref(db, "Pending/" + uid));

        toastr.success("✅ Duyệt user thành công!", "Duyệt USER")
        $("#modal-pending").modal("hide");

    } catch (error) {
        console.error("❌ Lỗi phê duyệt:", error);
        toastr.error("Có lỗi khi phê duyệt user!", "Lỗi duyệt USER")
    }
}

// ✅ Xóa UID
async function rejectUID(uid) {
    const pendingRef = ref(db, "Pending/" + uid);
    await remove(pendingRef);
    toastr.success(`Đã xóa UID: ${uid}`, "Xóa USER");
}

// đổi Section khi nhấn nút chuyển TAB
function showSection(sectionId) {
    $(".content-section").removeClass("active");
    $(".tab-button").removeClass("active");

    $("#" + sectionId).addClass("active");
    $(".tab-button[data-section='" + sectionId + "']").addClass("active");
}

// ✅ Hàm xóa học sinh + dữ liệu RFID
function deleteStudent(uid) {
    if (confirm("Bạn có chắc muốn xóa học sinh này không?")) {
        const updates = {};
        updates["USER/" + uid] = null; // xóa ở Students
        updates["RFID/" + uid] = null;     // xóa ở RFID

        update(ref(db), updates)
            .then(() => {
                alert("✅ Đã xóa học sinh và dữ liệu RFID thành công!");
                loadStudentList(); // reload lại danh sách
            })
            .catch((error) => {
                console.error("❌ Lỗi khi xóa học sinh:", error);
                alert("Không thể xóa học sinh. Vui lòng thử lại.");
            });
    }
}

function openEditModal(uid) {
    const userRef = ref(db, "USER/" + uid);

    // Lưu UID vào hidden input trong modal
    $("#editUid").val(uid);

    // Hiện modal
    $("#modal-edit-student-list").modal("show");

    // Lấy dữ liệu từ Firebase và đổ vào form
    onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            $("#student-name").val(data.name || "");
            $("#student-role").val(data.role || "");
            $("#student-class").val(data.class || "");
            $("#student-parentPhone").val(data.parentPhone || "");
            $("#student-phone").val(data.phone || "");
            $("#student-address").val(data.address || "");
            $("#student-gender").val(data.gender || "");
            $("#student-dob").val(data.dob || "");
        }
    }, { onlyOnce: true });
}

// hàm xác nhận EDIT thông tin học sinh
function updateStudent(uid, updatedData) {
    const userRef = ref(db, "USER/" + uid);

    // Cập nhật dữ liệu
    update(userRef, updatedData)
        .then(() => {
            toastr.success("✅ Cập nhật thông tin thành công!");
            $("#modal-edit-student-list").modal("hide"); // đóng modal sau khi update
        })
        .catch((error) => {
            console.error("❌ Lỗi khi cập nhật:", error);
            toastr.error("Lỗi khi cập nhật dữ liệu!");
        });
}

// hàm hiển thị thông tin chi tiết của USER khi nhấn nút view info
function showStudentInfo(uid) {
    const userRef = ref(db, "USER/" + uid);

    // Hiện modal 
    $("#viewInfoModal").modal("show");

    onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            $("#view-uid").text(uid || "");
            $("#view-Name").text(data.name || "");
            $("#view-Role").text(data.role || "");
            $("#view-Class").text(data.class || "");
            $("#view-PhonePH").text(data.parentPhone || "");
            $("#view-PhoneHS").text(data.phone || "");
            $("#view-Address").text(data.address || "");
            $("#view-Gender").text(data.gender || "");
            $("#view-Birthday").text(data.dob || "");
        }
    }, { onlyOnce: true });
}



// ✅ Chỉ gắn sự kiện trong $(document).ready
$(document).ready(function () {

    // khi nhấn nút chuyển tab
    $('.tab-button').on('click', function () {
        const sectionId = $(this).data('section');
        showSection(sectionId, this);
        console.log(sectionId);
        if (sectionId === "student-list") {
            loadStudentList(); // ✅ load khi nhấn Student List
        } else if (sectionId === "pendingSection") {
            loadPending();
        }
    });

    // Gắn sự kiện nút duyệt trong modal
    $(document).on("click", "#confirm-approve", function () {
        const uid = $(this).data("uid");  // lấy uid gắn vào nút
        approveUser(uid);
    });

    // sự kiện khi nhấn nút edit trong Student List
    $(document).on("click", ".edit-btn", function () {
        // lấy uid của USER
        const uid = $(this).data("uid");
        console.log(uid);

        // hiện dữ liệu của USER lên form
        openEditModal(uid);
    })

    // khi nhấn nút cancel trong modal
    $(document).on("click", "#cancel-approve", function () {
        // đóng modal
        $("#modal-pending").modal("hide");
        $("#modal-edit-student-list").modal("hide");
        $("#viewInfoModal").modal("hide");
        $("#viewHistoryModal").modal("hide");
    })

    // Xóa UID trong danh sách Pending
    $(document).on("click", ".reject-btn", function () {
        const uid = $(this).data("uid");
        console.log(uid);
        rejectUID(uid);
    });

    // sự kiện khi nhấn nút Xóa USER trong Student List
    $(document).on("click", ".delete-btn", function () {
        const uid = $(this).data("uid");
        deleteStudent(uid);
    });

    // Khi nhấn duyệt trong danh sách Pending
    $(document).on("click", ".approve-btn", function () {
        const uid = $(this).data("uid");
        console.log("👉 UID khi bấm duyệt:", uid);

        // Reset form
        $("#modal-pending input").val("");
        $("#gender").val("Nam");

        // Gắn uid vào nút submit trong modal
        $("#confirm-approve").data("uid", uid);

        // Mở modal
        $("#modal-pending").modal("show");
    });

    // sự kiện khi nhấn nút lưu thay đổi trong  Student List Edỉt
    $("#student-save-edit").on("click", function () {
        const uid = $("#editUid").val();

        // Lấy dữ liệu mới từ form
        const updatedData = {
            name: $("#student-name").val(),
            class: $("#student-class").val(),
            phoneParent: $("#student-parentPhone").val(),
            phone: $("#student-phone").val(),
            address: $("#student-address").val(),
            gender: $("#student-gender").val(),
            dob: $("#student-dob").val()
        };

        // Gọi hàm update
        updateStudent(uid, updatedData);
    });

    // Gắn sự kiện click cho nút View Info
    $(document).on("click", ".view-info-btn", function () {
        const uid = $(this).data("uid");
        showStudentInfo(uid);
    });

    // Khi bấm nút View History
    $(document).on("click", ".view-history-btn", function () {
        const uid = $(this).data("uid");
        console.log("Xem lịch sử UID:", uid);

        // Reset nội dung cũ
        $("#historyList").html("<tr><td colspan='2'>Đang tải dữ liệu...</td></tr>");

        // Hiện modal
        $("#viewHistoryModal").modal("show");

        // 🚀 Bước này sau sẽ load dữ liệu từ Firebase
        loadStudentRFIDHistory(uid);
    });

    // Đăng nhập ẩn danh Firebase
    signInAnonymously(auth).then(() => {
        console.log("✅ Anonymous signed in");
        loadPending();
    }).catch((error) => {
        console.error("❌ Lỗi đăng nhập:", error);
    });
});
