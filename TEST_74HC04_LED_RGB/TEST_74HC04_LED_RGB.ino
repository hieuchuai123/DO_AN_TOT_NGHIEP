#define R4 17

void setup() {
  // put your setup code here, to run once:
  pinMode(R4, OUTPUT);
}

void loop() {
  // put your main code here, to run repeatedly:
  analogWrite(R4, 0); // RED off GREEN on
  delay(1000);
  analogWrite(R4, 1023); // RED on GREEN off
  delay(1000);
}
