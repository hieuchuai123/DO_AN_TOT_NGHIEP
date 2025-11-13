#define LIMIT_SWITCH_PIN 32  // chân OUT nối vào GPIO23

void setup() {
  Serial.begin(115200);
  pinMode(LIMIT_SWITCH_PIN, INPUT_PULLUP);  // hoặc INPUT_PULLUP nếu muốn dùng trở kéo lên
}

void loop() {
  int state = digitalRead(LIMIT_SWITCH_PIN);
  if (state == LOW) {
    Serial.println("Công tắc bị NHẤN");
  } else {
    Serial.println("Công tắc THẢ");
  }
  delay(300);
}