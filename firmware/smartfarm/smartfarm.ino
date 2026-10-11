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

// 블루투스 모듈 통신 속도를 SoftwareSerial 권장 속도인 9600bps로 설정
void setupBTBaud() {
  Serial.println(F("----------------------------------------"));
  Serial.println(F("[BT] 블루투스 모듈 속도 점검 중..."));

  // 1. 이미 9600bps인지 확인 (기본 및 권장 속도)
  BTSerial.begin(9600);
  delay(100);
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT\r\n");
  delay(500);
  String res = "";
  while (BTSerial.available()) res += (char)BTSerial.read();
  if (res.indexOf("OK") != -1) {
    Serial.println(F("[BT] >> 통신 속도 9600 bps 정상 확인 완료 (OK)"));
    Serial.println(F("----------------------------------------"));
    return; // 이미 9600bps → 정상
  }

  // 2. 만약 115200bps 등 다른 속도에 걸려있을 경우 9600bps 복구 명령 전송
  Serial.println(F("[BT] 9600bps 미응답 -> 115200에서 9600 복구 시도"));
  BTSerial.begin(115200);
  delay(100);
  BTSerial.print("AT\r\n");
  delay(100);
  BTSerial.print("AT+BAUD0\r\n"); // HM-10 표준 (0 = 9600)
  delay(200);
  BTSerial.print("AT+BAUD4\r\n"); // MLT-BT05 / CC41-A (4 = 9600)
  delay(200);
  BTSerial.print("AT+RESET\r\n"); // 설정 반영 재부팅
  delay(1000);

  // 3. 다시 9600bps로 확인
  BTSerial.begin(9600);
  delay(100);
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT\r\n");
  delay(500);
  res = "";
  while (BTSerial.available()) res += (char)BTSerial.read();
  if (res.indexOf("OK") != -1) {
    Serial.println(F("[BT] >> 9600 bps 복구 성공! (OK)"));
  } else {
    Serial.println(F("[BT] !! 경고: AT 응답 없음"));
    Serial.println(F("     1) 이미 블루투스가 연결(페어링)되어 있거나"));
    Serial.println(F("     2) 아두이노 배선(RX: Pin 2, TX: Pin 5)을 점검하세요."));
  }
  Serial.println(F("----------------------------------------"));
}

void setup() {
  Serial.begin(115200); // PC 시리얼 모니터용 (디버깅)
  delay(500);
  Serial.println(F("========================================"));
  Serial.println(F(">> 링크보드 스마트팜 펌웨어 시작 <<"));
  Serial.println(F("[BT 배선] 아두이노 D2(RX) <-> BT TXD"));
  Serial.println(F("          아두이노 D5(TX) <-> BT RXD"));
  Serial.println(F("[센서 배선] DHT11: D3, 조도: A0, 토양: A1"));
  Serial.println(F("========================================"));

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
    Serial.print(F("[BT 수신] : "));
    Serial.println(cmd);

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
    Serial.println(F("[BT 송신] 센서 데이터 회신 완료"));
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
