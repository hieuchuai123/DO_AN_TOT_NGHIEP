import requests
import time
import random

# ⚠️ Thay bằng IP của ESP32 in ra trong Serial Monitor
ESP32_IP = "172.20.10.3"
URL = f"http://{ESP32_IP}/send"

def send_message(msg):  
    try:
        response = requests.get(URL, params={"msg": msg}, timeout=3)
        print("📨 Gửi:", msg)
        print("📬 ESP32 phản hồi:", response.text)
    except Exception as e:
        print("❌ Lỗi khi gửi dữ liệu:", e)

if __name__ == "__main__":
    led_count = 6
    states = ["DETECTED", "UNDETECTED", "DROWSINESS"]

    while True:
        for i in range(1, led_count + 1):
            for state in states:
                msg = f"P{i}:{state}"
                send_message(msg)
                time.sleep(1)  # chờ 1s giữa mỗi lần gửi
    # LED 1
    # send_message("P1:DETECTED")
    # send_message("P1:UNDETECTED")
    # send_message("P1:DROWSINESS")
    # LED 2
    # send_message("P2:DETECTED")
    # send_message("P2:UNDETECTED")
    # send_message("P2:DROWSINESS")
    # LED 3
    # send_message("P3:DETECTED")
    # send_message("P3:UNDETECTED")
    # send_message("P3:DROWSINESS")
    # LED 4
    # send_message("P4:DETECTED")
    # send_message("P4:UNDETECTED")
    # send_message("P4:DROWSINESS")
    # LED 5
    # send_message("P5:DETECTED")
    # send_message("P5:UNDETECTED")
    # send_message("P5:DROWSINESS")
    # LED 6
    # send_message("P6:DETECTED")
    # send_message("P6:UNDETECTED")
    # send_message("P6:DROWSINESS")

