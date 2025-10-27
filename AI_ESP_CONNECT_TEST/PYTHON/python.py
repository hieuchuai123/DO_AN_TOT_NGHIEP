import requests
import time
import random

# ⚠️ Thay bằng IP của ESP32 in ra trong Serial Monitor
ESP32_IP = "192.168.165.97"
URL = f"http://{ESP32_IP}/send"

def send_message(msg):  
    try:
        response = requests.get(URL, params={"msg": msg}, timeout=3)
        print("📨 Gửi:", msg)
        print("📬 ESP32 phản hồi:", response.text)
    except Exception as e:
        print("❌ Lỗi khi gửi dữ liệu:", e)

if __name__ == "__main__":
    # led_count = 6
    # states = ["DETECTED", "UNDETECTED", "DROWSINESS"]

    # while True:
    #     for i in range(1, led_count + 1):
    #         for state in states:
    #             msg = f"P{i}:{state}"
    #             send_message(msg)
    #             time.sleep(1)  # chờ 1s giữa mỗi lần gửi

    # LED 1
    # send_message("P1:DETECTED")
    # time.sleep(1)
    # send_message("P1:HEALTHY")

    # send_message("P1:UNDETECTED")

    # send_message("P1:DROWSINESS")

    # send_message("P1:UNHEALTHY")
    
    # LED 2
    # send_message("P2:DETECTED")
    # time.sleep(1)
    # send_message("P2:HEALTHY")

    # send_message("P2:UNDETECTED")

    # send_message("P2:DROWSINESS")

    # send_message("P2:UNHEALTHY")


