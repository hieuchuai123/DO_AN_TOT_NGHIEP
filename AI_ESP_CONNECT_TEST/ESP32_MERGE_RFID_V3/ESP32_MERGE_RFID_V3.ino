#include <SPI.h>      // THƯ VIỆN HỖ TRỢ giao tiếp RFID
#include <MFRC522.h>  // THƯ VIỆN để connect với RFID
#include <WiFi.h>
#include <Firebase_ESP_Client.h>  // THƯ VIỆN để connect với
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "time.h"
#include <Wire.h>
#include <LiquidCrystal_I2C.h>  // THƯ VIỆN để giao tiếp I2C với ESP32
#include <WebServer.h>          // THƯ VIỆN Webserver để connect hai hệ thống AI VÀ RFID

unsigned long lastPing = 0;
const unsigned long pingInterval = 60000;  // 1 phút

// KHAI BÁO CHÂN CÔNG TẮC
#define SW1 32
#define SW2 27
#define SW3 13
#define SW4 16
#define SW5 4
#define SW6 3

// KHAI BÁO CHÂN MODULE LED RGB
#define R1 14
// #define G1 13

#define R2 12
// #define G2 27

#define R3 26
// #define G3 32

#define R4 17
// #define G4 16

#define R5 15
// #define G5 4

#define R6 33
// #define G6 33

#define SS_PIN 5
#define RST_PIN 2
#define BUZZER_PIN 25                // buzzer pin
MFRC522 rfid(SS_PIN, RST_PIN);       // setup RFID
LiquidCrystal_I2C lcd(0x27, 16, 2);  // setup LCD

// WiFi
#define WIFI_SSID "hieuchuai"
#define WIFI_PASSWORD "hieuchuai2003"

// Firebase
#define API_KEY "AIzaSyDML_o7tVQOf7wrzdA3NasklY5Wb3cPCjo"
#define DATABASE_URL "https://do-an-tot-nghiep-9ac13-default-rtdb.firebaseio.com/"

// Firebase BACKUP
// #define API_KEY "AIzaSyDbnZmfcWqcn4_2LpNUapnw3LGUHxe8_e0"
// #define DATABASE_URL "https://do-an-tot-nghiep-backup-default-rtdb.firebaseio.com/"

// Firebase BACKUP 2
// #define API_KEY "AIzaSyBX7aJdbHYClq98eyHhDtZOqQXMMc6e-J8"
// #define DATABASE_URL "https://do-an-tot-nghiep-backup-2-default-rtdb.firebaseio.com/"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Tạo web server cổng 80
WebServer server(80);

// NTP config
const char* ntpServer = "time.google.com";
const long gmtOffset_sec = 7 * 3600;  // GMT+7 cho Việt Nam
const int daylightOffset_sec = 0;

// Biến toàn cục của NTP
unsigned long lastNtpSync = 0;
const unsigned long ntpInterval = 30 * 60 * 1000;  // 30 phút (30 * 60 * 1000 ms)

// Biến toàn cục của LCD
unsigned long lastDisplayTime = 0;
bool showingMessage = false;

// --- Lưu trạng thái hiện tại của từng LED ---
String ledState[7];  // P1–P6 (bỏ index 0 cho dễ nhìn)

// Lưu trạng thái cuối cùng mà camera gửi
String lastCameraState[7];

void handleFirebaseError(String reason) {
  Serial.println("🚨 Firebase Error: " + reason);

  if (reason.indexOf("connection") >= 0 || reason.indexOf("disconnected") >= 0 || reason.indexOf("ssl") >= 0 || reason.indexOf("timed out") >= 0 || reason.indexOf("network") >= 0 || reason.indexOf("token") >= 0) {

    Serial.println("🔁 Đang reset WiFi + Firebase...");

    WiFi.disconnect();
    delay(500);
    WiFi.reconnect();
    delay(1000);

    // Reconnect Firebase
    Firebase.reconnectWiFi(true);
    Firebase.begin(&config, &auth);

    delay(2000);
    Serial.println("✅ Đã reset kết nối xong.");
  }
}

// Hàm controlLED
void controlLED(int ledIndex, int pinCtrl, String state) {
  if (ledState[ledIndex] == "UNHEALTHY" && state == "DROWSINESS") {
    return;  // giữ UNHEALTHY
  }

  int swPin;
  switch (ledIndex) {
    case 1: swPin = SW1; break;
    case 2: swPin = SW2; break;
    case 3: swPin = SW3; break;
    case 4: swPin = SW4; break;
    case 5: swPin = SW5; break;
    case 6: swPin = SW6; break;
    default: return;
  }

  // Đọc công tắc
  pinMode(swPin, INPUT_PULLUP);
  bool seatPressed = (digitalRead(swPin) == LOW);  // LOW = có người ngồi

  // Lưu trạng thái camera cuối
  lastCameraState[ledIndex] = state;

  // Nếu ghế trống -> luôn vàng, bỏ qua tín hiệu camera
  if (!seatPressed) {
    ledState[ledIndex] = "UNDETECTED";
    analogWrite(pinCtrl, 200);  // vàng
    return;
  }

  // Nếu đã ngồi, áp dụng quy tắc ưu tiên
  // if (ledState[ledIndex] == "UNHEALTHY" && state == "DROWSINESS") {
  //   return;  // giữ UNHEALTHY
  // }

  // Nếu vào tới đây, cho phép chuyển trạng thái theo camera
  // (UNHEALTHY có thể nhận HEALTHY / UNDETECTED, DROWSINESS có thể bị overriden bởi UNHEALTHY)
  if (state == "DETECTED" || state == "HEALTHY") {
    ledState[ledIndex] = state;
    pinMode(pinCtrl, OUTPUT);
    digitalWrite(pinCtrl, LOW);  // IC đảo -> LED xanh
  } else if (state == "DROWSINESS") {
    ledState[ledIndex] = "DROWSINESS";
    pinMode(pinCtrl, OUTPUT);
    digitalWrite(pinCtrl, HIGH);  // LED đỏ cố định
    beep(100);
    delay(100);
    beep(100);
  } else if (state == "UNHEALTHY") {
    // luôn ưu tiên UNHEALTHY (ghi đè DROWSINESS)
    ledState[ledIndex] = "UNHEALTHY";
    beep(100);
    delay(100);
    beep(300);
    delay(100);
    beep(100);
    // nhấp nháy được xử lý trong updateLEDs()
  } else if (state == "UNDETECTED") {
    // camera không thấy: nếu vẫn ngồi => UNHEALTHY; nếu không => vàng
    if (seatPressed) {
      ledState[ledIndex] = "UNHEALTHY";
      beep(100);
      delay(100);
      beep(300);
      delay(100);
      beep(100);
    } else {
      ledState[ledIndex] = "UNDETECTED";
      analogWrite(pinCtrl, 200);  // vàng
    }
  }
}

void updateLEDs() {
  static unsigned long lastBlink = 0;
  static bool ledOn = false;
  unsigned long now = millis();

  if (now - lastBlink > 500) {
    lastBlink = now;
    ledOn = !ledOn;
  }

  for (int i = 1; i <= 6; i++) {
    int pinCtrl, swPin;
    switch (i) {
      case 1:
        pinCtrl = R1;
        swPin = SW1;
        break;
      case 2:
        pinCtrl = R2;
        swPin = SW2;
        break;
      case 3:
        pinCtrl = R3;
        swPin = SW3;
        break;
      case 4:
        pinCtrl = R4;
        swPin = SW4;
        break;
      case 5:
        pinCtrl = R5;
        swPin = SW5;
        break;
      case 6:
        pinCtrl = R6;
        swPin = SW6;
        break;
    }

    pinMode(swPin, INPUT_PULLUP);
    bool seatPressed = (digitalRead(swPin) == LOW);

    // 🟡 Nếu học sinh rời ghế → vàng
    if (!seatPressed && ledState[i] != "UNDETECTED") {
      ledState[i] = "UNDETECTED";
      analogWrite(pinCtrl, 200);
      beep(300);
      continue;
    }

    // 🟢 Nếu học sinh ngồi lại → khôi phục trạng thái camera cuối cùng
    if (seatPressed && ledState[i] == "UNDETECTED") {
      controlLED(i, pinCtrl, lastCameraState[i]);
      continue;
    }

    // 🔴 Xử lý nhấp nháy cho UNHEALTHY
    if (ledState[i] == "UNHEALTHY") {
      pinMode(pinCtrl, OUTPUT);
      digitalWrite(pinCtrl, ledOn ? HIGH : LOW);
    }
  }
}

// hàm gửi dữ liệu từ ESP32 đến AI SYSTEM
void handleRoot() {
  server.send(200, "text/plain", "ESP32 is online!");
}

void handleSend() {
  if (server.hasArg("msg")) {
    String msg = server.arg("msg");
    Serial.print("📩 Nhận được dữ liệu từ Python: ");
    Serial.println(msg);

    String response = "ESP32 đã nhận được: " + msg;
    String state = msg.substring(3);
    state.trim();

    // --- LED 1 ---
    if (msg.startsWith("P1:")) controlLED(1, R1, state);
    // --- LED 2 ---
    else if (msg.startsWith("P2:")) controlLED(2, R2, state);
    // --- LED 3 ---
    else if (msg.startsWith("P3:")) controlLED(3, R3, state);
    // --- LED 4 ---
    else if (msg.startsWith("P4:")) controlLED(4, R4, state);
    // --- LED 5 ---
    else if (msg.startsWith("P5:")) controlLED(5, R5, state);
    // --- LED 6 ---
    else if (msg.startsWith("P6:")) controlLED(6, R6, state);

    server.send(200, "text/plain", response);
  } else {
    server.send(400, "text/plain", "Thiếu tham số msg!");
  }
}

// hàm của buzzer
void beep(int duration) {
  digitalWrite(BUZZER_PIN, LOW);
  delay(duration);
  digitalWrite(BUZZER_PIN, HIGH);
}

// hàm format thời gians
String getTime() {
  time_t now;
  struct tm timeinfo;
  int retry = 0;

  time(&now);
  localtime_r(&now, &timeinfo);

  while (now < 100000 && retry < 5) {  // nếu chưa có thời gian hợp lệ
    Serial.println("⏳ Chưa lấy được NTP, thử lại...");
    configTime(7 * 3600, 0, "time.google.com");
    delay(2000);  // chờ NTP cập nhật
    time(&now);
    retry++;
  }

  if (now < 100000) {
    return "NTP Error";
  }

  char buf[20];
  strftime(buf, sizeof(buf), "%d-%m-%Y %H:%M:%S", &timeinfo);
  return String(buf);
}

// hàm hiển thị giao diện chờ của LCD
void showDefaultScreen() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Xin moi quet the");
  lcd.setCursor(0, 1);
  lcd.print("----------------");
  showingMessage = false;
}

// hàm hiển thị thông tin thẻ trên LCD
void showMessage(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
  lastDisplayTime = millis();
  showingMessage = true;
}

// hàm chuyển chuỗi từ có dấu sang không dấu
String removeVietnameseTones(String str) {
  str.replace("á", "a");
  str.replace("à", "a");
  str.replace("ả", "a");
  str.replace("ã", "a");
  str.replace("ạ", "a");
  str.replace("ă", "a");
  str.replace("ắ", "a");
  str.replace("ằ", "a");
  str.replace("ẳ", "a");
  str.replace("ẵ", "a");
  str.replace("ặ", "a");
  str.replace("â", "a");
  str.replace("ấ", "a");
  str.replace("ầ", "a");
  str.replace("ẩ", "a");
  str.replace("ẫ", "a");
  str.replace("ậ", "a");

  str.replace("đ", "d");

  str.replace("é", "e");
  str.replace("è", "e");
  str.replace("ẻ", "e");
  str.replace("ẽ", "e");
  str.replace("ẹ", "e");
  str.replace("ê", "e");
  str.replace("ế", "e");
  str.replace("ề", "e");
  str.replace("ể", "e");
  str.replace("ễ", "e");
  str.replace("ệ", "e");

  str.replace("í", "i");
  str.replace("ì", "i");
  str.replace("ỉ", "i");
  str.replace("ĩ", "i");
  str.replace("ị", "i");

  str.replace("ó", "o");
  str.replace("ò", "o");
  str.replace("ỏ", "o");
  str.replace("õ", "o");
  str.replace("ọ", "o");
  str.replace("ô", "o");
  str.replace("ố", "o");
  str.replace("ồ", "o");
  str.replace("ổ", "o");
  str.replace("ỗ", "o");
  str.replace("ộ", "o");
  str.replace("ơ", "o");
  str.replace("ớ", "o");
  str.replace("ờ", "o");
  str.replace("ở", "o");
  str.replace("ỡ", "o");
  str.replace("ợ", "o");

  str.replace("ú", "u");
  str.replace("ù", "u");
  str.replace("ủ", "u");
  str.replace("ũ", "u");
  str.replace("ụ", "u");
  str.replace("ư", "u");
  str.replace("ứ", "u");
  str.replace("ừ", "u");
  str.replace("ử", "u");
  str.replace("ữ", "u");
  str.replace("ự", "u");

  str.replace("ý", "y");
  str.replace("ỳ", "y");
  str.replace("ỷ", "y");
  str.replace("ỹ", "y");
  str.replace("ỵ", "y");

  // Viết hoa
  str.replace("Á", "A");
  str.replace("À", "A");
  str.replace("Ả", "A");
  str.replace("Ã", "A");
  str.replace("Ạ", "A");
  str.replace("Ă", "A");
  str.replace("Ắ", "A");
  str.replace("Ằ", "A");
  str.replace("Ẳ", "A");
  str.replace("Ẵ", "A");
  str.replace("Ặ", "A");
  str.replace("Â", "A");
  str.replace("Ấ", "A");
  str.replace("Ầ", "A");
  str.replace("Ẩ", "A");
  str.replace("Ẫ", "A");
  str.replace("Ậ", "A");

  str.replace("Đ", "D");

  str.replace("É", "E");
  str.replace("È", "E");
  str.replace("Ẻ", "E");
  str.replace("Ẽ", "E");
  str.replace("Ẹ", "E");
  str.replace("Ê", "E");
  str.replace("Ế", "E");
  str.replace("Ề", "E");
  str.replace("Ể", "E");
  str.replace("Ễ", "E");
  str.replace("Ệ", "E");

  str.replace("Í", "I");
  str.replace("Ì", "I");
  str.replace("Ỉ", "I");
  str.replace("Ĩ", "I");
  str.replace("Ị", "I");

  str.replace("Ó", "O");
  str.replace("Ò", "O");
  str.replace("Ỏ", "O");
  str.replace("Õ", "O");
  str.replace("Ọ", "O");
  str.replace("Ô", "O");
  str.replace("Ố", "O");
  str.replace("Ồ", "O");
  str.replace("Ổ", "O");
  str.replace("Ỗ", "O");
  str.replace("Ộ", "O");
  str.replace("Ơ", "O");
  str.replace("Ớ", "O");
  str.replace("Ờ", "O");
  str.replace("Ở", "O");
  str.replace("Ỡ", "O");
  str.replace("Ợ", "O");

  str.replace("Ú", "U");
  str.replace("Ù", "U");
  str.replace("Ủ", "U");
  str.replace("Ũ", "U");
  str.replace("Ụ", "U");
  str.replace("Ư", "U");
  str.replace("Ứ", "U");
  str.replace("Ừ", "U");
  str.replace("Ử", "U");
  str.replace("Ữ", "U");
  str.replace("Ự", "U");

  str.replace("Ý", "Y");
  str.replace("Ỳ", "Y");
  str.replace("Ỷ", "Y");
  str.replace("Ỹ", "Y");
  str.replace("Ỵ", "Y");

  return str;
}

String shortenName(String fullName) {
  fullName.trim();  // loại bỏ khoảng trắng thừa
  int start = 0;
  int idx = fullName.indexOf(' ');
  String parts[10];  // mảng chứa tối đa 10 từ
  int count = 0;

  // Tách tên thành các từ
  while (idx >= 0) {
    parts[count++] = fullName.substring(start, idx);
    start = idx + 1;
    idx = fullName.indexOf(' ', start);
  }
  parts[count++] = fullName.substring(start);  // thêm từ cuối cùng

  // Nếu <= 3 chữ thì đảo lại cho hợp format
  if (count <= 3) {
    String result = parts[count - 1];
    for (int i = 0; i < count - 1; i++) {
      result += " " + parts[i];
    }
    return result;
  }

  // Nếu > 3 chữ → chỉ lấy 3 chữ (Tên + Họ + Đệm đầu)
  String result = parts[count - 1];  // Tên chính (cuối)
  result += " " + parts[0];          // Họ (đầu tiên)
  result += " " + parts[1];          // Đệm (đầu tiên)

  return result;
}

// hàm setup
void setup() {
  Serial.begin(115200);  // khởi tạo Serial Monitor ở tốc độ bau là 115200

  // khởi tạo SPI
  SPI.begin();

  // khởi tạo RFID
  rfid.PCD_Init();

  // khởi tạo LCD
  lcd.init();
  lcd.backlight();

  // khởi tạo buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);

  // khởi tạo wifi và kiểm tra
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\n✅ Đã kết nối WiFi");
  Serial.print("📡 ESP32 IP: ");
  Serial.println(WiFi.localIP());

  // Cấu hình tất cả chân MODULE LED RGB là OUTPUT
  pinMode(R1, OUTPUT);
  analogWrite(R1, 200);
  pinMode(R2, OUTPUT);
  analogWrite(R2, 200);
  pinMode(R3, OUTPUT);
  analogWrite(R3, 200);
  pinMode(R4, OUTPUT);
  analogWrite(R4, 200);
  pinMode(R5, OUTPUT);
  analogWrite(R5, 200);
  pinMode(R6, OUTPUT);
  analogWrite(R6, 200);

  // Cấu hình công tắc
  pinMode(SW1, INPUT_PULLUP);
  pinMode(SW2, INPUT_PULLUP);
  pinMode(SW3, INPUT_PULLUP);
  pinMode(SW4, INPUT_PULLUP);
  pinMode(SW5, INPUT_PULLUP);
  pinMode(SW6, INPUT_PULLUP);

  // khởi tạo WebServer
  server.on("/", handleRoot);
  server.on("/send", handleSend);
  server.begin();
  Serial.println("🌐 Server đã khởi động!");

  // Khởi tạo NTP và kiểm tra (retry cho tới khi sync được)
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.println("❌ Failed to obtain time, retrying...");
    delay(2000);  // đợi 2s rồi thử lại
  }
  Serial.println("✅ Time synced!");

  // Khởi tạo và Đăng nhập FIREBASE dưới dạng Anonymous (chỉ chạy sau khi có time)
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.signUp(&config, &auth, "", "");
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  // ⏱️ Giới hạn thời gian phản hồi từ server Firebase (10 giây)
  config.timeout.serverResponse = 10 * 1000;

  // 🧠 Theo dõi trạng thái token (bắt buộc để tự refresh token)
  config.token_status_callback = tokenStatusCallback;  // cần include "addons/TokenHelper.h"

  Serial.println("✅ Ready to read RFID...");
  showDefaultScreen();
}

// vòng lặp chính
void loop() {
  // chạy server liên tục để bắt sự kiện
  server.handleClient();

  // hiển thị trạng thái chớp tắt khi sức khỏe không ổn
  updateLEDs();

  // Nếu đang hiển thị thông điệp và quá 3 giây thì trả về mặc định
  if (showingMessage && millis() - lastDisplayTime > 3000) {
    showDefaultScreen();
  }

  // 🔄 Sync lại NTP định kỳ
  if (millis() - lastNtpSync > ntpInterval) {
    Serial.println("🔄 Sync lại NTP...");
    configTime(7 * 3600, 0, "time.google.com");  // GMT+7 (VN)
    lastNtpSync = millis();
  }

  // 🧩 Kiểm tra WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi mất kết nối, đang thử reconnect...");
    WiFi.reconnect();
    delay(1000);
  }

  // 🧩 Nếu Firebase chưa sẵn sàng → thử khởi động lại
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase chưa sẵn sàng, khởi động lại kết nối...");
    Firebase.begin(&config, &auth);
    delay(1000);
  }

  // ❤️ Ping giữ kết nối Firebase (2 phút/lần)
  if (millis() - lastPing > pingInterval) {
    lastPing = millis();
    if (Firebase.RTDB.getInt(&fbdo, "/heartbeat")) {
      Serial.println("✅ Ping Firebase thành công, giữ kết nối sống.");
    } else {
      Serial.println("⚠️ Ping Firebase thất bại: " + fbdo.errorReason());
    }
  }

  // Kiểm tra thẻ RFID
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  // Lấy UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  beep(100);

  String timeNow = getTime();
  Serial.println("🔑 UID: " + uid);
  Serial.println("⏰ Time: " + timeNow);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("UID:");
  lcd.print(uid);

  lcd.setCursor(0, 1);
  lcd.print(timeNow);


  // Kiểm tra UID đã có trong DB chưa
  String statusPath = "/RFID/" + uid + "/lastStatus";  // đường dẫn lấy dữ liệu của last status
  String namePath = "/USER/" + uid + "/name";          // đường dẫn lấy dữ liệu name của thẻ nếu có trên hệ thống
  String logBase = "/RFID/" + uid + "/accessLog";
  if (Firebase.RTDB.getString(&fbdo, statusPath)) {
    // UID đã tồn tại → xử lý bình thường
    String lastStatus = fbdo.stringData();

    // ---------------------------------------------
    // 2) LẤY LOG MỚI NHẤT (CHỈ 1 LOG) – KHÔNG BAO GIỜ LỖI SSL
    // ---------------------------------------------
    QueryFilter query;
    query.orderBy("$key");
    query.limitToFirst(1);

    String newestKey = "";
    String lastTime = "";

    if (Firebase.RTDB.getJSON(&fbdo, logBase.c_str(), &query)) {
      FirebaseJson& json = fbdo.jsonObject();

      size_t count = json.iteratorBegin();
      if (count > 0) {
        String key, value;
        int type;
        json.iteratorGet(0, type, key, value);

        newestKey = key;

        // lấy time của log đó
        String timePath = logBase + "/" + newestKey + "/time";
        if (Firebase.RTDB.getString(&fbdo, timePath)) {
          lastTime = fbdo.stringData();
        }
      }
      json.iteratorEnd();
    }

    // ---------------------------------------------
    // 3) XÁC ĐỊNH STATUS MỚI (LEN-XE / XUONG-XE)
    // ---------------------------------------------
    String newStatus;
    String today = timeNow.substring(0, 10);
    String lastDay = lastTime.substring(0, 10);

    if (newestKey == "") {
      // chưa có log trước đó
      newStatus = "Len-xe";
    } else if (today != lastDay) {
      // ngày mới → lần đầu luôn là Lên xe
      newStatus = "Len-xe";
    } else {
      // cùng ngày → đảo trạng thái
      newStatus = (lastStatus == "Len-xe") ? "Xuong-xe" : "Len-xe";
    }

    // ---------------------------------------------
    // 4) GHI LOG MỚI
    // ---------------------------------------------
    time_t now;
    time(&now);
    long negativeKey = -now;

    String logPath = "/RFID/" + uid + "/accessLog/" + String(negativeKey);

    FirebaseJson json;
    json.set("status", newStatus);
    json.set("time", timeNow);

    // Ghi vào accessLog
    if (Firebase.RTDB.setJSON(&fbdo, logPath, &json)) {
      Serial.println("✅ Thêm log: " + newStatus);
    } else {
      Serial.println("❌ Lỗi: " + fbdo.errorReason());
    }

    // Cập nhật lastStatus
    Firebase.RTDB.setString(&fbdo, statusPath, newStatus);

    // Lấy dữ liệu name của USER
    Firebase.RTDB.getString(&fbdo, namePath.c_str());
    String studentName = fbdo.stringData();
    String lcdName = removeVietnameseTones(studentName);
    String lcdFormatName = shortenName(lcdName);

    beep(100);
    delay(100);
    beep(100);  // kêu 2 lần

    // Hiển thị lên LCD
    showMessage("" + lcdFormatName, "Status:" + newStatus);

  } else {
    // ⚠️ Nếu có lỗi mạng thì KHÔNG thêm Pending
    String err = fbdo.errorReason();

    if (err.indexOf("connection") >= 0 || err.indexOf("disconnected") >= 0 || err.indexOf("ssl") >= 0 || err.indexOf("timed out") >= 0 || err.indexOf("network") >= 0 || err.indexOf("token") >= 0) {
      Serial.println("⚠️ Lỗi Firebase mạng hoặc SSL, KHÔNG đưa vào Pending!");
      handleFirebaseError(err);
      return;
    }

    // UID chưa tồn tại → đưa vào Pending
    String pendingPath = "/Pending/" + uid;

    FirebaseJson json;
    json.set("time", timeNow);
    json.set("status", "Chua-duyet");

    if (Firebase.RTDB.setJSON(&fbdo, pendingPath, &json)) {
      Serial.println("⚠️ UID mới, đưa vào Pending chờ duyệt: " + uid);
    } else {
      Serial.println("❌ Lỗi Pending: " + fbdo.errorReason());
    }

    beep(500);  // kêu dài hơn

    // UID mới
    showMessage("UID moi", "Cho duyet...");
  }

  delay(2000);
}
