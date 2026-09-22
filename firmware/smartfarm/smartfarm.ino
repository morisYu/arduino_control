#include <DHT.h>

#include <SoftwareSerial.h>
SoftwareSerial BTSerial(2, 5); // RX: 2, TX: 5 (Hardware Serial 충돌 회피용)

int pinPumpDir = 7;
int pinPumpPwm = 6;
int pinBuzzer = 4;
int pinRgbR = 9;
int pinRgbG = 10;
int pinRgbB = 11;
int pinLight = A0; // DO(디지털 출력) 조도센서 핀 - digitalRead로 읽음
int pinSoil = A1;
int pinDht = 3; // DHT 온습도센서 기본 핀

bool lightDO = true; // true: DO 핀(digitalRead), false: AO 핀(analogRead)

#define DHTTYPE DHT11 // 만약 DHT22를 쓰신다면 DHT22로 변경하세요
DHT* dht = nullptr;

unsigned long lastSensorReadTime = 0;
unsigned long lastDhtReadTime = 0;
float cachedH = 0.0;
float cachedT = 0.0;

// 안전 타이머 및 펌프 상태 변수
unsigned long lastCommandTime = 0;
bool pumpRunning = false;

// 블루투스 모듈 통신 속도 자동 설정 (v6.1 HM-10 호환 모듈 전용)
void setupBTBaud() {
  // 1. 이미 115200인지 확인
  BTSerial.begin(115200);
  delay(100);
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT\r\n");
  delay(500);
  String res = "";
  while (BTSerial.available()) res += (char)BTSerial.read();
  if (res.indexOf("OK") != -1) return; // 이미 115200 → 바로 진행

  // 2. 9600에서 115200으로 변경
  BTSerial.begin(9600);
  delay(100);
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT\r\n");
  delay(500);
  res = "";
  while (BTSerial.available()) res += (char)BTSerial.read();
  if (res.indexOf("OK") != -1) {
    BTSerial.print("AT+BAUD8\r\n"); // v6.1: BAUD8 = 115200
    delay(500);
  }

  // 3. 115200으로 전환
  BTSerial.begin(115200);
  delay(100);
}

void setup() {
  Serial.begin(115200); // PC 시리얼 모니터용 (디버깅)
  setupBTBaud();        // 블루투스 모듈 통신 속도 자동 설정
  dht = new DHT(pinDht, DHTTYPE);
  dht->begin();
  updatePinModes();
}

void loop() {
  // 1. 블루투스(스마트폰/태블릿)로부터 수신된 명령 처리
  if (BTSerial.available() > 0) {
    String cmd = BTSerial.readStringUntil('\n'); 
    cmd.trim(); // \r, \n 등 공백 제거
    
    // PC 시리얼 모니터로 수신된 명령 디버깅 출력
    Serial.println("DEBUG 수신: " + cmd);

    if (cmd.length() > 0) {
      lastCommandTime = millis(); // 명령 수신 시각 갱신
      
      // RGB 색상 제어
      if (cmd.startsWith("RGB:")) {
        int firstComma = cmd.indexOf(',');
        int secondComma = cmd.indexOf(',', firstComma + 1);
        
        if (firstComma != -1 && secondComma != -1) {
          int r = cmd.substring(4, firstComma).toInt();
          int g = cmd.substring(firstComma + 1, secondComma).toInt();
          int b = cmd.substring(secondComma + 1).toInt();
          analogWrite(pinRgbR, r);
          analogWrite(pinRgbG, g);
          analogWrite(pinRgbB, b);
        }
      } 
      // 워터 펌프(DC모터 DIR/PWM) 제어
      else if (cmd.startsWith("PUMP:")) {
        int comma = cmd.indexOf(',');
        if (comma != -1) {
          int dir = cmd.substring(5, comma).toInt();
          int speed = cmd.substring(comma + 1).toInt();
          digitalWrite(pinPumpDir, dir > 0 ? HIGH : LOW);
          analogWrite(pinPumpPwm, speed); // 0 ~ 255 속도 제어
          pumpRunning = (speed > 0);
        }
      }
      // 부저(주파수) 제어
      else if (cmd.startsWith("BUZ:")) {
        int freq = cmd.substring(4).toInt();
        if (freq > 0) tone(pinBuzzer, freq); // 원하는 주파수로 소리 출력
        else noTone(pinBuzzer); // 0이면 끄기
      }
      // 동적 핀 설정 제어
      else if (cmd.startsWith("CFG:")) {
        parseConfigString(cmd);
      }
      // 센서값 요청 (Request-Response 동기화로 SoftwareSerial 충돌 방지)
      else if (cmd.startsWith("PING")) {
        sendSensors(true); // BTSerial로 전송
      }
    }
  }

  // 2. PC(시리얼 모니터)로부터 수신된 명령 처리 (PC에서도 유선으로 조작 가능하게 유지)
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n'); 
    cmd.trim(); 
    if (cmd.length() > 0) {
      lastCommandTime = millis(); 
      if (cmd.startsWith("RGB:")) {
        int firstComma = cmd.indexOf(',');
        int secondComma = cmd.indexOf(',', firstComma + 1);
        if (firstComma != -1 && secondComma != -1) {
          int r = cmd.substring(4, firstComma).toInt();
          int g = cmd.substring(firstComma + 1, secondComma).toInt();
          int b = cmd.substring(secondComma + 1).toInt();
          analogWrite(pinRgbR, r); analogWrite(pinRgbG, g); analogWrite(pinRgbB, b);
        }
      } else if (cmd.startsWith("PUMP:")) {
        int comma = cmd.indexOf(',');
        if (comma != -1) {
          int dir = cmd.substring(5, comma).toInt(); int speed = cmd.substring(comma + 1).toInt();
          digitalWrite(pinPumpDir, dir > 0 ? HIGH : LOW); analogWrite(pinPumpPwm, speed); pumpRunning = (speed > 0);
        }
      } else if (cmd.startsWith("BUZ:")) {
        int freq = cmd.substring(4).toInt();
        if (freq > 0) tone(pinBuzzer, freq); else noTone(pinBuzzer);
      } else if (cmd.startsWith("CFG:")) {
        parseConfigString(cmd);
      } else if (cmd.startsWith("PING")) {
        sendSensors(false); // Serial로 전송
      }
    }
  }

  // DHT11은 측정 속도가 느리므로 2초에 한 번만 읽고 캐싱 (통신 딜레이 방지)
  unsigned long currentMillis = millis();
  if (currentMillis - lastDhtReadTime >= 2000) {
    lastDhtReadTime = currentMillis;
    float readH = dht->readHumidity();
    float readT = dht->readTemperature();
    if (!isnan(readH) && !isnan(readT)) {
      cachedH = readH;
      cachedT = readT;
    }
  }

  // 안전 타임아웃: 펌프 가동 중 3초간 명령 수신이 없으면 자동 정지
  if (pumpRunning && lastCommandTime > 0 && (currentMillis - lastCommandTime > 3000)) {
    analogWrite(pinPumpPwm, 0);
    digitalWrite(pinPumpDir, LOW);
    noTone(pinBuzzer);
    pumpRunning = false;
  }
}

// 센서 데이터를 읽어서 전송하는 함수
void sendSensors(bool isBluetooth) {
  int l;
  if (lightDO) {
    l = digitalRead(pinLight) == LOW ? 1023 : 0;
  } else {
    l = analogRead(pinLight);
  }
  int s = analogRead(pinSoil);
  
  if (isBluetooth) {
    BTSerial.print("H:"); BTSerial.print(cachedH);
    BTSerial.print(",T:"); BTSerial.print(cachedT);
    BTSerial.print(",L:"); BTSerial.print(l);
    BTSerial.print(",S:"); BTSerial.println(s);
  } else {
    Serial.print("H:"); Serial.print(cachedH);
    Serial.print(",T:"); Serial.print(cachedT);
    Serial.print(",L:"); Serial.print(l);
    Serial.print(",S:"); Serial.println(s);
  }
}

// 핀 모드 초기화 및 핀 재설정 시 호출
void updatePinModes() {
  pinMode(pinPumpDir, OUTPUT);
  pinMode(pinPumpPwm, OUTPUT);
  pinMode(pinBuzzer, OUTPUT);
  pinMode(pinRgbR, OUTPUT);
  pinMode(pinRgbG, OUTPUT);
  pinMode(pinRgbB, OUTPUT);
  // lightDO 설정에 따라 핀 모드 결정
  if (lightDO) {
    pinMode(pinLight, INPUT); // DO: 디지털 입력
  }
  // AO일 때는 analogRead가 자동으로 아날로그 입력으로 설정함
  
  digitalWrite(pinPumpDir, LOW);
  analogWrite(pinPumpPwm, 0);
  noTone(pinBuzzer);
  analogWrite(pinRgbR, 0); 
  analogWrite(pinRgbG, 0); 
  analogWrite(pinRgbB, 0);
}

// 아날로그 핀 문자열("A0" 등)을 아두이노 핀 번호로 변환하는 헬퍼
int parseAnalogPin(String pinStr) {
  pinStr.trim();
  if (pinStr.startsWith("A")) {
    return A0 + pinStr.substring(1).toInt();
  }
  return pinStr.toInt();
}

// 웹에서 날아온 핀 설정 명령(CFG:) 파싱
void parseConfigString(String cmd) {
  // 모든 핀 상태 리셋 (핀 번호 변경 시 타이머/출력 충돌 방지)
  noTone(pinBuzzer);
  analogWrite(pinPumpPwm, 0);
  digitalWrite(pinPumpDir, LOW);
  analogWrite(pinRgbR, 0);
  analogWrite(pinRgbG, 0);
  analogWrite(pinRgbB, 0);

  int rgbIdx = cmd.indexOf("RGB:");
  if(rgbIdx != -1) {
    int rComma = cmd.indexOf(',', rgbIdx);
    int gComma = cmd.indexOf(',', rComma + 1);
    int bComma = cmd.indexOf(',', gComma + 1);
    if(rComma != -1 && gComma != -1) {
      int r = cmd.substring(rgbIdx + 4, rComma).toInt();
      int g = cmd.substring(rComma + 1, gComma).toInt();
      int b = (bComma != -1) ? cmd.substring(gComma + 1, bComma).toInt() : cmd.substring(gComma + 1).toInt();
      if(r > 0) pinRgbR = r;
      if(g > 0) pinRgbG = g;
      if(b > 0) pinRgbB = b;
    }
  }
  
  int pumpIdx = cmd.indexOf("PUMP:");
  if(pumpIdx != -1) {
    int comma1 = cmd.indexOf(',', pumpIdx);
    int comma2 = cmd.indexOf(',', comma1 + 1);
    if(comma1 != -1) {
      int dir = cmd.substring(pumpIdx + 5, comma1).toInt();
      int pwm = (comma2 != -1) ? cmd.substring(comma1 + 1, comma2).toInt() : cmd.substring(comma1 + 1).toInt();
      if(dir > 0) pinPumpDir = dir;
      if(pwm > 0) pinPumpPwm = pwm;
    }
  }

  int buzIdx = cmd.indexOf("BUZ:");
  if(buzIdx != -1) {
    int comma = cmd.indexOf(',', buzIdx);
    int buz = (comma != -1) ? cmd.substring(buzIdx + 4, comma).toInt() : cmd.substring(buzIdx + 4).toInt();
    if(buz > 0) pinBuzzer = buz;
  }

  int dhtIdx = cmd.indexOf("DHT:");
  if(dhtIdx != -1) {
    int comma = cmd.indexOf(',', dhtIdx);
    int d = (comma != -1) ? cmd.substring(dhtIdx + 4, comma).toInt() : cmd.substring(dhtIdx + 4).toInt();
    if(d > 0) pinDht = d;
  }

  int ligIdx = cmd.indexOf("LIG:");
  if(ligIdx != -1) {
    int comma = cmd.indexOf(',', ligIdx);
    String pinStr = (comma != -1) ? cmd.substring(ligIdx + 4, comma) : cmd.substring(ligIdx + 4);
    if(pinStr.startsWith("A")) pinLight = A0 + pinStr.substring(1).toInt();
    else { int val = pinStr.toInt(); if(val > 0) pinLight = val; }
  }

  int soilIdx = cmd.indexOf("SOIL:");
  if(soilIdx != -1) {
    int comma = cmd.indexOf(',', soilIdx);
    String pinStr = (comma != -1) ? cmd.substring(soilIdx + 5, comma) : cmd.substring(soilIdx + 5);
    if(pinStr.startsWith("A")) pinSoil = A0 + pinStr.substring(1).toInt();
    else { int val = pinStr.toInt(); if(val > 0) pinSoil = val; }
  }

  int lightTypeIdx = cmd.indexOf("LIGHT_TYPE:");
  if(lightTypeIdx != -1) {
    String t = cmd.substring(lightTypeIdx + 11);
    if(t.startsWith("AO")) lightDO = false;
    else if(t.startsWith("DO")) lightDO = true;
  }

  updatePinModes();
}
