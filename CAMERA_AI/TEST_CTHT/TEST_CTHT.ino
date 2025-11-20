#define SWITCH_PIN 3   // Chân nối với công tắc hành trình

void setup() {
  Serial.begin(115200);          // Bật UART để xem kết quả
  pinMode(SWITCH_PIN, INPUT_PULLUP); // Kích hoạt điện trở kéo lên nội
  Serial.println("Bat dau test cong tac hanh trinh...");
}

void loop() {
  int state = digitalRead(SWITCH_PIN); // Đọc trạng thái công tắc
  
  if (state == LOW) {
    Serial.println("Công tắc: ĐANG NHẤN");
  } else {
    Serial.println("Công tắc: NHẢ RA");
  }
  
  delay(500); // Chờ 0.5 giây rồi đọc lại
}
