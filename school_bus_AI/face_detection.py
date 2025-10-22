import cv2
import cvlib as cv
from cvlib.object_detection import draw_bbox

# Mở webcam mặc định (0)
camera = cv2.VideoCapture(0)

# Đặt kích thước khung hình (tuỳ chọn)
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1080)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

cv2.namedWindow("live transmission", cv2.WINDOW_AUTOSIZE)

while True:
    # Đọc frame từ webcam
    ret, frame = camera.read()
    if not ret:
        print("Không thể truy cập webcam.")
        break

    # Phát hiện khuôn mặt
    faces, confidences = cv.detect_face(frame)

    # Vẽ bounding box lên frame
    for face, confidence in zip(faces, confidences):
        x1, y1, x2, y2 = face
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, f'{int(confidence*100)}%', (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

    # Hiển thị video
    cv2.imshow("live transmission", frame)

    # Nhấn 'q' để thoát
    if cv2.waitKey(5) & 0xFF == ord('q'):
        break

# Giải phóng tài nguyên
camera.release()
cv2.destroyAllWindows()
