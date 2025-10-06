import requests
import time

# ⚠️ Thay bằng IP của ESP32 in ra trong Serial Monitor
ESP32_IP = "192.168.1.6"
URL = f"http://{ESP32_IP}/send"

def send_message(msg):  
    try:
        response = requests.get(URL, params={"msg": msg}, timeout=3)
        print("📨 Gửi:", msg)
        print("📬 ESP32 phản hồi:", response.text)
    except Exception as e:
        print("❌ Lỗi khi gửi dữ liệu:", e)

if __name__ == "__main__":
    send_message("Hello ESP32 👋")
    time.sleep(1)   # nghỉ 1 giây
    send_message("Drowsiness detected 🚨")
