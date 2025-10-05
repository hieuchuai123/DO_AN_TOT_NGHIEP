import requests

# ⚠️ Thay bằng IP của ESP32 in ra trong Serial Monitor
ESP32_IP = "172.16.0.223"
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
    send_message("Drowsiness detected 🚨")
