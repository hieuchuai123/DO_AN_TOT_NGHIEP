#include <WiFi.h>
#include <WebServer.h>

// KHAI BÁO CHÂN MODULE LED RGB
#define R1 14
#define G1 13

#define R2 12
#define G2 27

#define R3 26
#define G3 32

const char* ssid = "TRAM 247 STUDY CAFE & WORKSPACE";  // 🔹 Nhập Wi-Fi của bạn
const char* password = "tramloveyou";

WebServer server(80);  // Tạo web server cổng 80

void handleRoot() {
  server.send(200, "text/plain", "ESP32 is online!");
}

void handleSend() {
  if (server.hasArg("msg")) {
    String msg = server.arg("msg");
    Serial.print("📩 Nhận được dữ liệu từ Python: ");
    Serial.println(msg);
    String response = "ESP32 đã nhận được: " + msg;
    // LED 1 - màu ngẫu nhiên
    analogWrite(G1, random(0, 1023));

    // LED 2 - màu ngẫu nhiên
    analogWrite(G2, random(0, 1023));

    // LED 3 - màu ngẫu nhiên
    analogWrite(G3, random(0, 1023));

    server.send(200, "text/plain", response);
  } else {
    server.send(400, "text/plain", "Thiếu tham số msg!");
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  Serial.println("\nĐang kết nối Wi-Fi...");

  // Cấu hình tất cả chân là OUTPUT
  pinMode(R1, OUTPUT);
  pinMode(G1, OUTPUT);
  pinMode(R2, OUTPUT);
  pinMode(G2, OUTPUT);
  pinMode(R3, OUTPUT);
  pinMode(G3, OUTPUT);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ Kết nối Wi-Fi thành công!");
  Serial.print("📡 ESP32 IP: ");
  Serial.println(WiFi.localIP());

  server.on("/", handleRoot);
  server.on("/send", handleSend);
  server.begin();
  Serial.println("🌐 Server đã khởi động!");
}

void loop() {
  server.handleClient();
}
