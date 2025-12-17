import requests
import time
import random

# ⚠️ Thay bằng IP của ESP32 in ra trong Serial Monitor
# ESP32_IP = "172.20.10.7" # iphone
# ESP32_IP = "192.168.175.97" # xiaomi
ESP32_IP = "192.168.0.107" # router nhà
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

    # LED 3
    # send_message("P3:DETECTED")
    # time.sleep(1)
    # send_message("P3:HEALTHY")

    # send_message("P3:UNDETECTED")

    # send_message("P3:DROWSINESS")

    # send_message("P3:UNHEALTHY")

    # LED 4
    # send_message("P4:DETECTED")
    # time.sleep(1)
    # send_message("P4:HEALTHY")

    # send_message("P4:UNDETECTED")

    # send_message("P4:DROWSINESS")

    # send_message("P4:UNHEALTHY")

    # LED 5
    # send_message("P5:DETECTED")
    # time.sleep(1)
    # send_message("P5:HEALTHY")

    # send_message("P5:UNDETECTED")

    # send_message("P5:DROWSINESS")

    # send_message("P5:UNHEALTHY")

    # LED 6
    # send_message("P6:DETECTED")
    # time.sleep(1)
    # send_message("P6:HEALTHY")

    # send_message("P6:UNDETECTED")

    send_message("P6:DROWSINESS")
    # time.sleep(1)
    # send_message("P6:UNHEALTHY")
    # time.sleep(1)
    # send_message("P6:DROWSINESS")


