from tkinter import W
import cv2
import mediapipe as mp
import numpy as np
import time
import threading
import requests
import tensorflow as tf
from queue import Queue, Empty
from collections import deque
from pathlib import Path
import os

# ========== EMOTION RUNTIME ==========
EMO_MODE = os.environ.get("EMO_MODE", "ON").upper()
print(f"[BOOT] EMO_MODE = {EMO_MODE}")

# ========== MODEL PATH RESOLUTION ==========
BASE_DIR = Path(__file__).resolve().parent
MODEL_Candidates = [ # Fixed typo: Candidates
    BASE_DIR / "emotion_model.h5",
    BASE_DIR / "emotion_model.keras",
    BASE_DIR / "emotion_model",
    BASE_DIR / "models" / "emotion_model.h5",
    BASE_DIR / "models" / "emotion_model.keras",
    BASE_DIR / "models" / "emotion_model",
]
def find_model_path():
    for p in MODEL_Candidates: # Fixed typo
        if p.exists(): return str(p)
    return None
MODEL_PATH = find_model_path()

# ========== EMOTION SERVICE ==========
class EmotionService:
    def __init__(self, model_path=MODEL_PATH, input_size=(48, 48), labels=None, custom_objects=None):
        self.path = model_path
        self.input_size = input_size
        self.labels = labels or ['Angry','Disgust','Fear','Happy','Neutral','Sad','Surprise']
        self.custom_objects = custom_objects or {}
        self.model = None
        self.ready = False
        self.error = None
        threading.Thread(target=self._load, daemon=True).start()

    def _load(self):
        try:
            print("[EMOTION] resolved model path:", self.path)
            if not self.path:
                raise FileNotFoundError("Emotion model not found at candidates.")
            # Added compile=False for potentially faster loading if optimizer state isn't needed
            self.model = tf.keras.models.load_model(self.path, compile=False, custom_objects=self.custom_objects)
            self.ready = True
            print("[EMOTION] model loaded OK")
        except Exception as e:
            self.error = repr(e)
            self.ready = False
            print("[EMOTION] load failed:", self.error)

    def predict(self, face_roi):
        if not self.ready or self.model is None or face_roi is None or face_roi.size == 0: # Added self.model check
            return None
        try:
            gray = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            resized = cv2.resize(gray, self.input_size, interpolation=cv2.INTER_AREA)
            # Ensure float32 and correct shape
            x = (resized / 255.0).astype(np.float32)
            x = np.reshape(x, (1, self.input_size[0], self.input_size[1], 1))
            pred = self.model.predict(x, verbose=0)
            return self.labels[int(np.argmax(pred))]
        except Exception as e:
            print(f"[EMOTION Predict Error] {e}") # Log prediction errors
            return None

# ========== CONFIG ==========
URL_SNAPSHOT      = "http://172.20.10.5/cam-mid.jpg"
CONNECT_TIMEOUT   = 3.0
READ_TIMEOUT      = 6.0
TARGET_FETCH_FPS  = 6
ESP32_IP = "172.20.10.3" # Hoặc IP ESP32 thật / IP server giả lập
URL_SEND = f"http://{ESP32_IP}/send"
PROCESS_WIDTH     = 416
DISPLAY_WIDTH     = 1000
DISPLAY_FPS       = 30
SHOW_WINDOW       = True
DRAW_OVERLAY      = True

# --- TỰ ĐỘNG CHIA 3 VÙNG BẰNG NHAU (Tỉ lệ 5:4) ---
PROC_HEIGHT_APPROX = 333
Y_TOP = 0; Y_BOTTOM = PROC_HEIGHT_APPROX
WIDTH_THIRD = PROCESS_WIDTH // 3
X1_P1 = 0; X2_P1 = WIDTH_THIRD; X1_P2 = WIDTH_THIRD; X2_P2 = 2 * WIDTH_THIRD; X1_P3 = 2 * WIDTH_THIRD; X2_P3 = PROCESS_WIDTH
Y1_ROI = Y_TOP; Y2_ROI = Y_BOTTOM
SEAT_ROIS = {
    1: (X1_P1, Y1_ROI, X2_P1, Y2_ROI), 2: (X1_P2, Y1_ROI, X2_P2, Y2_ROI), 3: (X1_P3, Y1_ROI, X2_P3, Y2_ROI),
}
print("[CONFIG] SEAT_ROIS calculated (Equal Thirds 5:4):")
for seat_id, roi in SEAT_ROIS.items(): print(f"  P{seat_id}: {roi}")
# ------------------------------------

MAX_SEATS         = 3 # Đổi tên từ MAX_TRACKS
MESH_MIN_INTERVAL = 0.12

# --- Ngưỡng/logic (Giữ nguyên hoặc điều chỉnh như bạn đã làm) ---
# (Các giá trị EAR_..., MAR_YAWN, TILT_..., WAKE_..., etc.)
EAR_SLEEP_ABS     = 0.21; EAR_DROWSY_ABS    = 0.27; CLOSED_EYES_TIME  = 1.8
EAR_SLEEP_RATIO   = 0.60; EAR_DROWSY_RATIO  = 0.80; BASELINE_MIN      = 0.22
BASELINE_MAX      = 0.40; BASELINE_ALPHA    = 0.05; MAR_YAWN          = 0.28
DROWSY_HOLD_SEC   = 1.0 ; YAWN_HOLD_SEC     = 0.6 ; TILT_DEG_SLEEP    = 22.0
TILT_HOLD_SEC     = 1.0 ; ROLL_VEL_MAX      = 120.0; WAKE_EAR          = 0.27
WAKE_TILT_DEG     = 8.0 ; WAKE_HOLD_SEC     = 0.4 ; EMOTION_CHECK_INTERVAL = 0.5
TILT_NEEDS_EYE_CLOSED = True; WAKE_EAR_MARGIN   = 0.01; UNSLEEP_GRACE_SEC   = 0.6
STUCK_CLEAR_SEC   = 1.2 ; BLINK_REFRACT_SEC = 0.7

# ========== STATUS BUS: điều độ HTTP tới ESP32 ==========
class StatusBus:
    def __init__(self, url_send, aggregate=False, period=0.60, tx_gap_ms=250):
        self.url = url_send
        self.AGGREGATE = aggregate # Giữ để tương thích, code này tập trung vào else
        self.PERIOD = float(period)
        self.TX_GAP = tx_gap_ms / 1000.0
        self._lock = threading.Lock()
        self._stop = False
        self.state = {} # Dùng dict {key: label} để lưu cả sleep (1,2,3) và health (11,12,13)
        self._last_sent_state = {} # Lưu trạng thái đã gửi thành công cho từng key {key: label}
        self._t = threading.Thread(target=self._run, daemon=True)
        self._t.start()
        print("[StatusBus] Initialized (Multi-message mode)") # Thêm log

    def set_state(self, key, label):
        # Key hợp lệ: 1, 2, 3 (sleep) hoặc 11, 12, 13 (health)
        if key not in range(1, MAX_SEATS + 1) and key not in range(11, 11 + MAX_SEATS): return
        with self._lock:
            # Chỉ cập nhật nếu trạng thái thực sự thay đổi
            if self.state.get(key) != label:
                 self.state[key] = label
                 # print(f"[StatusBus] State queued: Key {key} = {label}") # Debug log

    def close(self):
        self._stop = True
        try: self._t.join(timeout=1.0)
        except: pass

    def _safe_get(self, params):
        # Hàm này giữ nguyên như code của bạn (retry 3 lần, timeout, ...)
        for attempt in range(3):
            try:
                r = requests.get(
                    self.url,
                    params=params,
                    timeout=(1.5, 3.0),
                    headers={"Connection": "close"},
                    allow_redirects=False
                )
                print("→ TX", r.url, "| HTTP", r.status_code, "| RX:", getattr(r, "text", "")[:120])
                # Chỉ coi là OK nếu status_code là 2xx
                if 200 <= r.status_code < 300:
                    return True, getattr(r, "text", "")
                else:
                    print(f"❌ TX attempt {attempt+1} received non-2xx status: {r.status_code}")
                    # Không cần retry nếu lỗi là do server (4xx, 5xx), trừ khi là lỗi tạm thời
                    if r.status_code < 500 or r.status_code in [501, 505]: # Bad Request, Not Implemented etc. -> No retry
                         return False, getattr(r, "text", "")
                    time.sleep(0.25 * (attempt + 1)) # Backoff nhẹ cho lỗi server tạm thời
            except Exception as e:
                print(f"❌ TX attempt {attempt+1} connection/timeout error:", e)
                time.sleep(0.25 * (attempt + 1))
        return False, None

    # Hàm _build_snapshot không cần thiết nếu aggregate=False, có thể xóa hoặc giữ lại
    # def _build_snapshot(self): ...

    def _run(self):
        backoff = 0.0
        while not self._stop:
            t0 = time.time()

            if self.AGGREGATE:
                # Logic aggregate=True nếu bạn muốn dùng
                # ... (Cần sửa hàm _build_snapshot nếu dùng)
                pass # Bỏ qua phần này vì bạn dùng aggregate=False
            else:
                #  LOGIC GỬI NHIỀU TIN NHẮN (KHÔNG ƯU TIÊN, CHỐNG LẶP)
                messages_to_send_info = [] # List các dict {"key": k, "label": l, "text": t}

                with self._lock:
                    # Duyệt qua tất cả trạng thái hiện có trong self.state
                    for key, current_label in list(self.state.items()):
                        last_sent_label = self._last_sent_state.get(key)

                        # Chỉ thêm vào danh sách gửi nếu trạng thái hiện tại khác trạng thái đã gửi lần trước
                        if current_label != last_sent_label:
                            text_to_send = None
                            person_id_display = -1 # ID để hiển thị (1, 2, 3)

                            # Định dạng tin nhắn dựa trên key
                            if 1 <= key <= MAX_SEATS: # Trạng thái ngủ gật (P1, P2, P3)
                                person_id_display = key
                                # Chỉ gửi đi nếu không phải HEALTHY
                                if current_label != "HEALTHY":
                                    # text_to_send = f"P{person_id_display}: {current_label}"
                                     text_to_send = f"P{person_id_display + 3}: {current_label}"
                            elif 11 <= key <= 10 +MAX_SEATS: # Trạng thái sức khỏe (P1, P2, P3)
                                 person_id_display = key - 10
                                 # Gửi cả UNHEALTHY và HEALTHY
                                 if current_label == "UNHEALTHY" or current_label == "HEALTHY":
                                    #  text_to_send = f"P{person_id_display}: {current_label}"
                                      text_to_send = f"P{person_id_display +3}: {current_label}"
                                 # Nếu là HEALTHY -> không gửi gì, nhưng vẫn cập nhật last_sent_state

                            # Nếu có tin nhắn hợp lệ cần gửi
                            if text_to_send:
                                messages_to_send_info.append({
                                    "key": key,
                                    "label": current_label, # Lưu label hiện tại để cập nhật _last_sent_state
                                    "text": text_to_send
                                })
                            elif current_label == "HEALTHY" and last_sent_label == "UNHEALTHY":
                                # Nếu chuyển từ UNHEALTHY về HEALTHY, cập nhật last_sent nhưng không gửi
                                messages_to_send_info.append({
                                    "key": key,
                                    "label": current_label,
                                    "text": None # Đánh dấu không gửi
                                })


                # Gửi các tin nhắn đã lọc (có khoảng nghỉ)
                any_error_occurred = False
                sent_keys_this_cycle = set() # Theo dõi key đã gửi thành công trong chu kỳ này

                if messages_to_send_info:
                    print(f"[StatusBus] Changes detected for keys: {[m['key'] for m in messages_to_send_info]}. Sending necessary messages...") # Debug
                for msg_info in messages_to_send_info:
                    if msg_info["text"]: # Chỉ gửi nếu có nội dung tin nhắn
                        time.sleep(0.5) #delay 0.5 s
                        print(f"[StatusBus] Attempting to send: {msg_info['text']}") # Debug
                        ok, _ = self._safe_get({"msg": msg_info["text"]})
                        if ok:
                            # Ghi nhận key đã gửi thành công
                            sent_keys_this_cycle.add(msg_info["key"])
                        else:
                            any_error_occurred = True
                            # Lỗi -> không cập nhật _last_sent_state, sẽ thử lại ở chu kỳ sau
                        time.sleep(self.TX_GAP) # Giữ khoảng nghỉ
                    else:
                         # Nếu text=None (ví dụ: chuyển về HEALTHY), vẫn ghi nhận là đã xử lý
                         sent_keys_this_cycle.add(msg_info["key"])

                # Cập nhật _last_sent_state cho những key đã được xử lý thành công trong chu kỳ này
                with self._lock:
                    for msg_info in messages_to_send_info:
                         if msg_info["key"] in sent_keys_this_cycle:
                              self._last_sent_state[msg_info["key"]] = msg_info["label"]


                # Xử lý backoff nếu có lỗi xảy ra
                if any_error_occurred:
                     backoff = min(1.0, max(0.2, backoff + 0.2))
                else:
                     backoff = 0.0 # Reset backoff
                #  KẾT THÚC LOGIC MỚI

            dt = time.time() - t0
            time.sleep(max(0.0, self.PERIOD + backoff - dt))

# ========== FETCHER (snapshot, chống cache) ==========
class SnapshotFetcher:
    def __init__(self, url, target_fps=6, connect_to=3.0, read_to=6.0):
        self.base_url = url
        self.min_dt = 1.0 / max(1, int(target_fps))
        self.connect_to = connect_to
        self.read_to    = read_to
        self._lock = threading.Lock()
        self._frame = None
        self._stop = False
        self._t = threading.Thread(target=self._run, daemon=True)
        self._t.start()
        print("[FETCHER] started")

    def _url(self):
        return f"{self.base_url}?t={int(time.time()*1000)}"  # cache-buster

    def _run(self):
        last = 0.0
        while not self._stop:
            dt = time.time() - last
            if dt < self.min_dt:
                time.sleep(self.min_dt - dt)
            try:
                r = requests.get(self._url(),
                                 timeout=(self.connect_to, self.read_to),
                                 headers={
                                     "Accept": "image/jpeg",
                                     "Cache-Control": "no-cache, no-store, must-revalidate",
                                     "Pragma": "no-cache",
                                     "Connection": "close",
                                     "User-Agent": "opencv-python"
                                 })
                if r.status_code != 200:
                    print(f"[FETCHER] HTTP {r.status_code}")
                    time.sleep(0.2); continue
                arr = np.frombuffer(r.content, dtype=np.uint8)
                frm = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if frm is None:
                    print(f"[FETCHER] imdecode failed (len={len(r.content)})")
                    time.sleep(0.2); continue
                with self._lock:
                    self._frame = frm
                last = time.time()
            except requests.Timeout:
                print("[FETCHER] timeout -> check IP/endpoint"); time.sleep(0.2)
            except requests.ConnectionError as e:
                print("[FETCHER] conn error:", e); time.sleep(0.5)
            except Exception as e:
                print("[FETCHER] error:", repr(e)); time.sleep(0.2)

    def read(self):
        with self._lock:
            return None if self._frame is None else self._frame.copy()

    def close(self):
        self._stop = True
        try: self._t.join(timeout=1.0)
        except: pass

# ========== MEDIAPIPE ==========
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=MAX_SEATS,
    refine_landmarks=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

LEFT_EYE  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [263, 387, 385, 362, 380, 373]
MOUTH_TOP, MOUTH_BOTTOM, MOUTH_LEFT, MOUTH_RIGHT = 13, 14, 61, 291
EYE_OUTER_LEFT_IDX  = 33
EYE_OUTER_RIGHT_IDX = 263

def eye_aspect_ratio(landmarks, eye_idx, W, H):
    pts = [(landmarks[i].x * W, landmarks[i].y * H) for i in eye_idx]
    p1, p2, p3, p4, p5, p6 = [np.array(p) for p in pts]
    A = np.linalg.norm(p2 - p6)
    B = np.linalg.norm(p3 - p5)
    C = np.linalg.norm(p1 - p4) + 1e-6
    return (A + B) / (2.0 * C)

def mouth_aspect_ratio(landmarks, W, H):
    top = np.array([landmarks[MOUTH_TOP].x * W, landmarks[MOUTH_TOP].y * H])
    bot = np.array([landmarks[MOUTH_BOTTOM].x * W, landmarks[MOUTH_BOTTOM].y * H])
    left = np.array([landmarks[MOUTH_LEFT].x * W, landmarks[MOUTH_LEFT].y * H])
    right = np.array([landmarks[MOUTH_RIGHT].x * W, landmarks[MOUTH_RIGHT].y * H])
    return np.linalg.norm(top - bot) / (np.linalg.norm(left - right) + 1e-6)

def head_roll_deg(landmarks, W, H):
    pL = np.array([landmarks[EYE_OUTER_LEFT_IDX].x * W,  landmarks[EYE_OUTER_LEFT_IDX].y * H])
    pR = np.array([landmarks[EYE_OUTER_RIGHT_IDX].x * W, landmarks[EYE_OUTER_RIGHT_IDX].y * H])
    dy = pR[1] - pL[1]
    dx = (pR[0] - pL[0]) + 1e-6
    return float(np.degrees(np.arctan2(dy, dx)))

def seconds_since(t0):
    return 0.0 if t0 is None else (time.time() - t0)

# ========== GHÉP TRACK ỔN ĐỊNH ==========
def bbox_iou(b1, b2):
    if b1 is None or b2 is None:
        return 0.0
    x11, y11, x12, y12 = b1
    x21, y21, x22, y22 = b2
    xi1, yi1 = max(x11, x21), max(y11, y21)
    xi2, yi2 = min(x12, x22), min(y12, y22)
    iw, ih = max(0, xi2 - xi1), max(0, yi2 - yi1)
    inter = iw * ih
    a1 = max(0, x12 - x11) * max(0, y12 - y11)
    a2 = max(0, x22 - x21) * max(0, y22 - y21)
    union = a1 + a2 - inter + 1e-6
    return float(inter / union)

# ========== STATE MANAGEMENT (THEO GHẾ) ==========
seat_states = {
    seat_id: {
        "present_in_frame": False, "status": "UNDETECTED",
        "t_eye_closed_start": None, "t_tilt_start": None, "t_wake_start": None,
        "_t_last_sleep_cue": None, "_blink_start": None, "_t_last_blink": 0.0,
        "t_yawn_start": None,
        "ear_filt": None, "roll_filt": None, "roll_vel_filt": 0.0,
        "ear_open_baseline": None, "last_logic_ts": None,
        "EAR_last": None, "MAR_last": None, "ROLL_last": None,
        "emotion_status": "Unknown", "t_last_emotion_check": 0.0,
        "health_status": "On", "S_disp_value": 85.0,
    } for seat_id in range(1, MAX_SEATS + 1)
}

# Helper reset state khi ghế trống
def reset_seat_state_on_empty(seat_id, worker_instance): # Thêm worker_instance để reset cả deque
    if seat_id not in seat_states: return
    state = seat_states[seat_id]
    state.update({
        "present_in_frame": False, "status": "UNDETECTED",
        "t_eye_closed_start": None, "t_tilt_start": None, "t_wake_start": None,
        "_t_last_sleep_cue": None, "_blink_start": None, "_t_last_blink": 0.0,
        "t_yawn_start": None,
        "ear_filt": None, "roll_filt": None, "roll_vel_filt": 0.0,
        # Giữ lại baseline? Có thể reset nếu muốn: "ear_open_baseline": None,
        "last_logic_ts": None,
        "EAR_last": None, "MAR_last": None, "ROLL_last": None,
        # Reset emotion? "emotion_status": "Unknown", "t_last_emotion_check": 0.0,
        # Reset health? "health_status": "On", "S_disp_value": 85.0,
    })
    # Reset deques trong worker
    worker_instance.smooth_ear[seat_id].clear()
    worker_instance.smooth_mar[seat_id].clear()
    worker_instance.samples[seat_id].clear()
    worker_instance.events[seat_id]["blinks"].clear()
    worker_instance.events[seat_id]["yawns"].clear()
    worker_instance.closed_flag[seat_id] = False
    print(f"[State] Reset state for empty seat {seat_id}")

# ========== WORKER ==========
class FaceMeshWorker:
    def __init__(self, process_width=416, mesh_min_interval=0.12):
        self.q = Queue(maxsize=1)
        self.result = None
        self.r_lock = threading.Lock()
        self.stop = False
        self.process_width = process_width
        self.mesh_min_interval = mesh_min_interval
        self.last_mesh_ts = 0.0
        # State theo seat_id
        self.smooth_ear = {sid: deque(maxlen=5) for sid in range(1, MAX_SEATS + 1)}
        self.smooth_mar = {sid: deque(maxlen=5) for sid in range(1, MAX_SEATS + 1)}
        self.samples = {sid: deque() for sid in range(1, MAX_SEATS + 1)}
        self.events  = {sid: {"blinks": deque(), "yawns": deque()} for sid in range(1, MAX_SEATS + 1)}
        self.closed_flag = {sid: False for sid in range(1, MAX_SEATS + 1)}
        # Khởi tạo Emotion Service
        if EMO_MODE == "ON": self.emotion = EmotionService(MODEL_PATH)
        elif EMO_MODE == "SAFE": # Proxy giữ nguyên
            class EmotionSafeProxy: # (...)
                pass
            self.emotion = EmotionSafeProxy(MODEL_PATH)
        else: self.emotion = type("Off", ...)() # Dummy giữ nguyên
        self.win_sec = 30.0 # Cửa sổ tính health
        self.t = threading.Thread(target=self._run, daemon=True); self.t.start()
    def submit(self, frame):
        try:
            if self.q.full(): self.q.get_nowait()
            self.q.put_nowait(frame)
        except Exception:
            pass

    def get_result(self):
        with self.r_lock:
            return None if self.result is None else self.result.copy()

    def close(self):
        self.stop = True
        try: self.t.join(timeout=1.0)
        except: pass

    def compute_window_metrics(self, seat_id, ear_sleep_thr): # Sửa tid -> seat_id
        dq = self.samples[seat_id]
        if len(dq) < 2: return {"perclos": 0.0, "blink_rpm": 0.0, "yawn_rpm": 0.0, "stable_pct": 1.0}
        ts0 = dq[0][0]; ts1 = dq[-1][0]; dur = max(1e-3, ts1 - ts0)
        low_time = 0.0; stable_time = 0.0
        for i in range(1, len(dq)):
            t0, EAR0, _, R0 = dq[i-1]; t1, EAR1, _, R1 = dq[i]
            dt = t1 - t0
            if min(EAR0, EAR1) < ear_sleep_thr: low_time += dt
            if abs((R0 + R1)/2.0) < 12.0: stable_time += dt
        perclos = low_time / dur; stable_pct = stable_time / dur
        # Sửa tid -> seat_id
        blink_rpm = len(self.events[seat_id]["blinks"]) * (60.0 / self.win_sec)
        yawn_rpm  = len(self.events[seat_id]["yawns"])  * (60.0 / self.win_sec)
        return {"perclos": perclos, "blink_rpm": blink_rpm, "yawn_rpm": yawn_rpm, "stable_pct": stable_pct}

    def health_score_from_metrics(self, seat_id, metrics, emotion): # Sửa tid -> seat_id
        S_raw = 85.0
        # ... (Công thức tính S_raw giữ nguyên như bạn đã sửa) ...
        S_raw -= min(25.0, 30.0 * max(0.0, metrics["perclos"] - 0.15))
        br = metrics["blink_rpm"]
        if br < 12:  S_raw -= (12 - br) * 0.5
        if br > 21:  S_raw -= (br - 21) * 0.8
        S_raw -= min(25.0, metrics["yawn_rpm"] * 10.0)
        S_raw -= max(0.0, (0.8 - metrics["stable_pct"]) * 3.0)
        emo_pen = {"Sad":10, "Fear":8, "Angry":6, "Surprise":0, "Neutral":0, "Happy":0, "Emotion:OFF":0}
        S_raw -= emo_pen.get(emotion, 0)
        S_raw = float(max(0.0, min(100.0, S_raw)))

        # Lấy S_disp cũ từ state và cập nhật (Sửa tid -> seat_id)
        S_disp_old = seat_states[seat_id].get("S_disp_value", 85.0)
        S_disp_new = 0.3 * S_raw + 0.7 * S_disp_old # Làm mượt chậm
        seat_states[seat_id]["S_disp_value"] = S_disp_new # Lưu lại

        # Phân loại health (Sửa tid -> seat_id)
        if S_disp_new >= 70: health = "Tot"
        elif S_disp_new >= 50: health = "On"
        elif S_disp_new >= 35: health = "Met moi"
        else: health = "Khong tot"
        seat_states[seat_id]["health_status"] = health # Lưu lại

        return S_disp_new, health

    # safety_risk_level giữ nguyên
    def safety_risk_level(self, state_status): # Sửa state -> state_status để rõ ràng
        return 3 if state_status == "Ngu gat" else 0

    def _run(self):
        while not self.stop:
            try: frame = self.q.get(timeout=0.2)
            except Empty: continue

            # Resize ảnh proc (giữ nguyên)
            H0, W0 = frame.shape[:2]
            if W0 > self.process_width:
                new_h = int(H0 * self.process_width / W0)
                proc = cv2.resize(frame, (self.process_width, new_h), interpolation=cv2.INTER_AREA)
            else: proc = frame
            H, W = proc.shape[:2]
            now_ts = time.time()

            if (now_ts - self.last_mesh_ts) < self.mesh_min_interval: continue

            rgb = cv2.cvtColor(proc, cv2.COLOR_BGR2RGB)
            res = face_mesh.process(rgb)
            self.last_mesh_ts = now_ts # Cập nhật thời gian xử lý mesh

            # --- Xử lý theo ghế ---
            detected_faces_by_seat = {seat_id: None for seat_id in SEAT_ROIS.keys()}
            faces_in_frame = []

            if res and res.multi_face_landmarks:
                # print(f"[Worker Debug] MediaPipe detected {len(res.multi_face_landmarks)} faces.") # Debug
                for face_idx, face_landmarks in enumerate(res.multi_face_landmarks):
                    lm = face_landmarks.landmark
                    try:
                        # Tính EAR, MAR, ROLL, bbox, cx, cy
                        left_ear  = eye_aspect_ratio(lm, LEFT_EYE,  W, H)
                        right_ear = eye_aspect_ratio(lm, RIGHT_EYE, W, H)
                        EAR  = float((left_ear + right_ear) / 2.0)
                        MAR  = float(mouth_aspect_ratio(lm, W, H))
                        ROLL = float(head_roll_deg(lm, W, H))
                        xs = [p.x * W for p in lm]; ys = [p.y * H for p in lm]
                        x1, y1 = int(max(min(xs), 0)), int(max(min(ys), 0))
                        x2, y2 = int(min(max(xs), W - 1)), int(min(max(ys), H - 1))
                        # Đảm bảo bbox hợp lệ
                        if x2 <= x1 or y2 <= y1: continue
                        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                        area = (x2 - x1) * (y2 - y1)

                        # Xác định ghế
                        current_seat = None
                        for seat_id, roi in SEAT_ROIS.items():
                            x1_roi, y1_roi, x2_roi, y2_roi = roi
                            if x1_roi <= cx < x2_roi and y1_roi <= cy < y2_roi:
                                current_seat = seat_id
                                break
                        # print(f"  [Face {face_idx+1}] Center ({cx},{cy}) -> Seat: {current_seat}") # Debug

                        if current_seat is not None:
                             faces_in_frame.append({
                                 "seat_id": current_seat, "EAR": EAR, "MAR": MAR, "ROLL": ROLL,
                                 "bbox": (x1, y1, x2, y2), "cx": cx, "cy": cy, "area": area,
                             })
                    except Exception as e:
                        print(f"[Worker Error] Face metric calc failed: {e}")
                        continue

            # Giải quyết xung đột ROI
            for seat_id in SEAT_ROIS.keys():
                 candidates = [f for f in faces_in_frame if f["seat_id"] == seat_id]
                 if candidates:
                      best_face = max(candidates, key=lambda f: f["area"])
                      detected_faces_by_seat[seat_id] = best_face
                      # print(f"  [Seat {seat_id}] Assigned best face with area {best_face['area']}") # Debug

            overlay_data = []
            # Lặp qua từng ghế để cập nhật trạng thái
            for seat_id in SEAT_ROIS.keys():
                face_data = detected_faces_by_seat[seat_id]
                state = seat_states[seat_id] # Lấy state của ghế này

                if face_data: # CÓ NGƯỜI
                    state["present_in_frame"] = True
                    EAR, MAR, ROLL = face_data["EAR"], face_data["MAR"], face_data["ROLL"]
                    x1, y1, x2, y2 = face_data["bbox"]

                    # --- Áp dụng logic ---
                    dt = now_ts - state["last_logic_ts"] if state["last_logic_ts"] else (1.0/TARGET_FETCH_FPS) # Ước tính dt ban đầu
                    dt = max(0.05, min(0.5, dt))

                    # Lọc mềm EAR/ROLL
                    a_ear, a_roll, a_vel = 0.4, 0.5, 0.6
                    state["ear_filt"]  = EAR  if state["ear_filt"]  is None else (a_ear*EAR  + (1-a_ear)*state["ear_filt"])
                    state["roll_filt"] = ROLL if state["roll_filt"] is None else (a_roll*ROLL + (1-a_roll)*state["roll_filt"])
                    roll_last = state["ROLL_last"] if state["ROLL_last"] is not None else state["roll_filt"]
                    roll_vel_inst = (state["roll_filt"] - roll_last) / dt
                    state["roll_vel_filt"] = a_vel*roll_vel_inst + (1-a_vel)*state["roll_vel_filt"]
                    EARf, ROLLf, VROLL = state["ear_filt"], state["roll_filt"], abs(state["roll_vel_filt"])

                    # Baseline mắt mở
                    if state["status"] != "Ngu gat" and EARf is not None and abs(ROLLf) < 12.0:
                        if state["ear_open_baseline"] is None and EARf > 0.24: state["ear_open_baseline"] = EARf
                        elif state["ear_open_baseline"] is not None and EARf > 0.22:
                            state["ear_open_baseline"] = (1-BASELINE_ALPHA)*state["ear_open_baseline"] + BASELINE_ALPHA*EARf
                            state["ear_open_baseline"] = max(BASELINE_MIN, min(BASELINE_MAX, state["ear_open_baseline"]))

                    # Ngưỡng EAR động
                    ear_sleep_thr, ear_drowsy_thr = EAR_SLEEP_ABS, EAR_DROWSY_ABS
                    if state["ear_open_baseline"] is not None:
                        ear_sleep_thr  = max(EAR_SLEEP_ABS,  state["ear_open_baseline"]*EAR_SLEEP_RATIO)
                        ear_drowsy_thr = max(EAR_DROWSY_ABS, state["ear_open_baseline"]*EAR_DROWSY_RATIO)

                    # Logic ngủ gật (Trục A)
                    eyes_closed_filt = (EARf < ear_sleep_thr)
                    tilt_big = (abs(ROLLf) >= TILT_DEG_SLEEP)
                    tilt_ok  = (tilt_big and (not TILT_NEEDS_EYE_CLOSED or eyes_closed_filt)) # Dùng eyes_closed_filt
                    t_last_blink = state.get("_t_last_blink", 0.0)
                    blink_refract_ok = (now_ts - t_last_blink) >= BLINK_REFRACT_SEC

                    if eyes_closed_filt and blink_refract_ok:
                        if state["t_eye_closed_start"] is None: state["t_eye_closed_start"] = now_ts
                    else: state["t_eye_closed_start"] = None
                    if tilt_ok:
                        if state["t_tilt_start"] is None: state["t_tilt_start"] = now_ts
                    else: state["t_tilt_start"] = None

                    sleep_by_eye  = (seconds_since(state["t_eye_closed_start"]) >= CLOSED_EYES_TIME) if state["t_eye_closed_start"] else False
                    sleep_by_tilt = (seconds_since(state["t_tilt_start"])       >= TILT_HOLD_SEC)    if state["t_tilt_start"]    else False

                    previous_status = state["status"] # Lưu lại để kiểm tra thay đổi
                    if sleep_by_eye or sleep_by_tilt:
                        state["status"] = "Ngu gat"; state["_t_last_sleep_cue"] = now_ts; state["t_wake_start"] = None
                    else:
                        wake_thr = max(WAKE_EAR, ear_sleep_thr + WAKE_EAR_MARGIN)
                        wake_pose_ok = (abs(ROLLf) <= WAKE_TILT_DEG)
                        wake_eye_ok  = (EARf >= wake_thr)
                        if state["status"] == "Ngu gat":
                            if wake_eye_ok and wake_pose_ok:
                                if state["t_wake_start"] is None: state["t_wake_start"] = now_ts
                                if seconds_since(state["t_wake_start"]) >= max(WAKE_HOLD_SEC, UNSLEEP_GRACE_SEC):
                                    state["status"] = "Binh thuong"; state["t_wake_start"] = None
                            else: state["t_wake_start"] = None
                            no_more_cue = (not eyes_closed_filt) and (not tilt_big)
                            t_last_cue  = state.get("_t_last_sleep_cue", now_ts)
                            if no_more_cue and (now_ts - t_last_cue) > STUCK_CLEAR_SEC:
                                state["status"] = "Binh thuong"; state["t_wake_start"] = None
                        else: # Trạng thái không phải "Ngu gat"
                             state["status"] = "Binh thuong" # Nếu có người thì là Binh thuong (hoặc Ngu gat)

                    # --- Gửi trạng thái ngủ gật ---
                    sleep_label = "UNDETECTED"
                    if state["status"] == "Ngu gat": sleep_label = "DROWSINESS"
                    elif state["status"] == "Binh thuong": sleep_label = "DETECTED"
                    status_bus.set_state(seat_id, sleep_label)

                    # Sự kiện Yawn/Blink (dùng state và self.events/closed_flag)
                    if MAR > MAR_YAWN:
                        if state["t_yawn_start"] is None: state["t_yawn_start"] = now_ts
                    else:
                        if state["t_yawn_start"] is not None and seconds_since(state["t_yawn_start"]) >= YAWN_HOLD_SEC:
                            self.events[seat_id]["yawns"].append(now_ts)
                        state["t_yawn_start"] = None
                    # Blink logic
                    ear_thr_blink = max(ear_sleep_thr, 0.75*ear_drowsy_thr)
                    if state["ear_filt"] < ear_thr_blink and not self.closed_flag[seat_id]:
                        self.closed_flag[seat_id] = True; state["_blink_start"] = now_ts
                    elif state["ear_filt"] >= ear_thr_blink and self.closed_flag[seat_id]:
                        dur = now_ts - state.get("_blink_start", now_ts)
                        if 0.05 <= dur <= 0.47:
                            self.events[seat_id]["blinks"].append(now_ts); state["_t_last_blink"] = now_ts
                        self.closed_flag[seat_id] = False
                    # Dọn dẹp events cũ
                    for key_ev in ("blinks", "yawns"):
                        dq = self.events[seat_id][key_ev]
                        while dq and now_ts - dq[0] > self.win_sec: dq.popleft()

                    # Emotion
                    emotion = state.get("emotion_status", "Unknown")
                    if (now_ts - state.get("t_last_emotion_check", 0.0)) > EMOTION_CHECK_INTERVAL:
                        label = None
                        if getattr(self.emotion, "ready", False):
                             x1c=max(0,x1); x2c=min(W,x2); y1c=max(0,y1); y2c=min(H,y2)
                             if x2c > x1c and y2c > y1c:
                                 face_roi = proc[y1c:y2c, x1c:x2c]
                                 label = self.emotion.predict(face_roi)
                        elif getattr(self.emotion, "error", None): label = f"Emotion:{self.emotion.error[:10]}" # Hiển thị lỗi ngắn gọn
                        if label: emotion = label; state["emotion_status"] = emotion
                        state["t_last_emotion_check"] = now_ts

                    # Metrics & Health
                    self.samples[seat_id].append((now_ts, state["ear_filt"], MAR, state["roll_filt"]))
                    while self.samples[seat_id] and now_ts - self.samples[seat_id][0][0] > self.win_sec:
                        self.samples[seat_id].popleft()
                    metrics = self.compute_window_metrics(seat_id, ear_sleep_thr)
                    S_disp, health = self.health_score_from_metrics(seat_id, metrics, emotion)
                    health_label = None
                    if health == "Met moi" or health == "Khong tot": health_label = "UNHEALTHY"
                    elif health == "Tot" or health == "On": health_label = "HEALTHY"
                    if health_label is not None:
                        status_bus.set_state(seat_id + 10, health_label) # Gửi trạng thái sức khỏe

                    # Lưu state cuối
                    state["last_logic_ts"] = now_ts
                    state["EAR_last"] = EAR; state["MAR_last"] = MAR; state["ROLL_last"] = state["roll_filt"]

                    # Chuẩn bị overlay
                    self.smooth_ear[seat_id].append(EAR); self.smooth_mar[seat_id].append(MAR)
                    ear_show = float(np.mean(self.smooth_ear[seat_id])) if self.smooth_ear[seat_id] else EAR # Handle empty deque
                    mar_show = float(np.mean(self.smooth_mar[seat_id])) if self.smooth_mar[seat_id] else MAR # Handle empty deque
                    overlay_data.append({
                        "seat_id": seat_id, "bbox": (x1, y1, x2, y2),
                        "status": state["status"], "EAR": ear_show, "MAR": mar_show,
                        "emotion": emotion, "S": S_disp, "health": health,
                    })

                else: # KHÔNG CÓ NGƯỜI
                    if state["present_in_frame"]: # Nếu frame trước có người
                         print(f"[Worker] Seat {seat_id} is now empty.")
                         reset_seat_state_on_empty(seat_id, self) # Truyền self vào để reset deque
                         status_bus.set_state(seat_id, "UNDETECTED")
                         status_bus.set_state(seat_id + 10, "HEALTHY")
                    state["present_in_frame"] = False


            # Gửi kết quả lên Main Loop
            with self.r_lock:
                self.result = {"ts": now_ts, "proc_size": (W, H), "overlay": overlay_data}
# ========== MAIN LOOP ==========
cv2.setUseOptimized(True)

fetcher = SnapshotFetcher(URL_SNAPSHOT, target_fps=TARGET_FETCH_FPS,
                          connect_to=CONNECT_TIMEOUT, read_to=READ_TIMEOUT)
worker  = FaceMeshWorker(process_width=PROCESS_WIDTH, mesh_min_interval=MESH_MIN_INTERVAL)

# BUS gửi trạng thái: dùng định dạng "P#: LABEL" (firmware cũ)
status_bus = StatusBus(URL_SEND, aggregate=False, period=0.60, tx_gap_ms=250)

if SHOW_WINDOW:
    cv2.namedWindow("Driver State (snapshot, 3-person, robust)", cv2.WINDOW_AUTOSIZE)

last_disp = 0.0

try:
    while True:
        frame = fetcher.read()
        if frame is None:
            if SHOW_WINDOW:
                blank = np.zeros((240, 320, 3), np.uint8)
                cv2.putText(blank, "No frame - check snapshot URL", (12, 24),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,0), 2)
                cv2.putText(blank, time.strftime("%H:%M:%S"), (12, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
                cv2.imshow("Driver State (snapshot, 3-person, robust)", blank)
                cv2.waitKey(1)
            continue

        worker.submit(frame)

        now = time.time()
        if SHOW_WINDOW and (now - last_disp) >= (1.0 / DISPLAY_FPS):
            last_disp = now
            # Lấy ảnh gốc MỚI NHẤT từ fetcher để hiển thị (tránh ảnh cũ bị trễ)
            display_frame = fetcher.read()
            if display_frame is None: continue # Bỏ qua nếu không có ảnh mới

            # Resize ảnh để hiển thị (giữ nguyên)
            H0, W0 = display_frame.shape[:2]
            if W0 != DISPLAY_WIDTH:
                disp_h = int(H0 * DISPLAY_WIDTH / W0)
                display = cv2.resize(display_frame, (DISPLAY_WIDTH, disp_h), interpolation=cv2.INTER_LINEAR)
            else: display = display_frame.copy()
            dispH, dispW = display.shape[:2]

            # Lấy kết quả xử lý từ worker
            res = worker.get_result()
            if res and DRAW_OVERLAY:
                try:
                    Wp, Hp = res["proc_size"]
                    # Kiểm tra Wp, Hp hợp lệ
                    if Wp <= 0 or Hp <= 0: continue
                    sx, sy = (dispW / float(Wp)), (dispH / float(Hp))

                    # Vẽ overlay dựa trên kết quả từ worker
                    for item in res["overlay"]:
                        x1, y1, x2, y2 = item["bbox"]
                        # Clip bbox vào kích thước ảnh xử lý (Wp, Hp)
                        x1=max(0,x1); y1=max(0,y1); x2=min(Wp-1,x2); y2=min(Hp-1,y2)
                        if x2 <= x1 or y2 <= y1: continue # Bỏ qua bbox không hợp lệ
                        # Chuyển đổi sang tọa độ hiển thị
                        X1, Y1, X2, Y2 = int(x1 * sx), int(y1 * sy), int(x2 * sx), int(y2 * sy)

                        seat_id = int(item.get("seat_id", 0))
                        st = item.get("status","Trống")
                        emotion = item.get("emotion","")
                        S_disp = int(round(item.get("S", 85.0)))
                        health = item.get("health","On")
                        # Xác định màu dựa trên trạng thái ngủ gật
                        color = (0,0,255) if st == "Ngu gat" else (0,200,0) if st=="Binh thuong" else (150,150,150)

                        # Vẽ bbox và text
                        cv2.rectangle(display, (X1, Y1), (X2, Y2), color, 2)
                        # cv2.putText(display, f"P{seat_id} {st}", (X1, max(24, Y1 - 10)),
                        #             cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                        cv2.putText(display, f"P{seat_id + 3} {st}", (X1, max(24, Y1 - 10)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2) 
                        if emotion and emotion != "Emotion:OFF" and not emotion.startswith("Emotion:"): # Chỉ hiển thị emotion hợp lệ
                            cv2.putText(display, emotion, (X1, Y2 + 18),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,0), 2)
                        cv2.putText(display, f"S:{S_disp} {health}",
                                    (X1, Y2 + 38), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)

                    # Vẽ thời gian (giữ nguyên)
                    cv2.putText(display, time.strftime("%H:%M:%S"), (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2)

                except ZeroDivisionError:
                     print("[DRAW] error: proc_size width or height is zero.")
                except Exception as e:
                    print("[DRAW] error:", repr(e))

            cv2.imshow("Driver State (snapshot, 3-person, robust)", display)
            if cv2.waitKey(1) & 0xFF == ord('q'): break

except KeyboardInterrupt: pass
finally:
    worker.close()
    fetcher.close()
    try: face_mesh.close()
    except: pass
    try: status_bus.close()
    except: pass
    if SHOW_WINDOW:
        cv2.destroyAllWindows()
