#include <SoftwareSerial.h>

SoftwareSerial BTSerial(2, 5); // RX: 2, TX: 5

// 응답 읽기 (공통)
String readResponse(unsigned long timeout = 600) {
  unsigned long start = millis();
  String res = "";
  while (millis() - start < timeout) {
    if (BTSerial.available()) {
      res += (char)BTSerial.read();
    }
  }
  res.trim();
  return res;
}

// 방식 1: AT + CR LF (HM-10, BT05, HC-05)
String tryCRLF() {
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT\r\n");
  return readResponse();
}

// 방식 2: AT만 (HC-06 등 줄바꿈 불필요 모듈)
String tryRaw() {
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT");
  return readResponse(1200); // HC-06은 응답이 느림
}

// 방식 3: AT + CR만 (일부 클론)
String tryCR() {
  while (BTSerial.available()) BTSerial.read();
  BTSerial.print("AT\r");
  return readResponse();
}

void setup() {
  Serial.begin(9600);
  while (!Serial);
  delay(1000);

  Serial.println(F("======================================"));
  Serial.println(F(">>> BT Module Diagnostic Tool v2 <<<"));
  Serial.println(F("======================================"));
  Serial.println();

  long baudRates[] = {9600, 38400, 115200, 57600, 19200, 4800, 2400, 1200};
  int baudCount = 8;
  long detectedBaud = 0;
  int detectedMode = 0; // 1=CRLF, 2=RAW, 3=CR

  Serial.println(F("[Step 1] Scanning..."));

  for (int i = 0; i < baudCount; i++) {
    BTSerial.begin(baudRates[i]);
    delay(100);

    Serial.print(F("  "));
    Serial.print(baudRates[i]);

    // 방식 1: CRLF
    String res = tryCRLF();
    if (res.length() > 0) {
      Serial.print(F(" CRLF=\""));
      Serial.print(res);
      Serial.println(F("\""));
      if (detectedBaud == 0) { detectedBaud = baudRates[i]; detectedMode = 1; }
      continue;
    }

    // 방식 2: RAW (줄바꿈 없음)
    res = tryRaw();
    if (res.length() > 0) {
      Serial.print(F(" RAW=\""));
      Serial.print(res);
      Serial.println(F("\""));
      if (detectedBaud == 0) { detectedBaud = baudRates[i]; detectedMode = 2; }
      continue;
    }

    // 방식 3: CR만
    res = tryCR();
    if (res.length() > 0) {
      Serial.print(F(" CR=\""));
      Serial.print(res);
      Serial.println(F("\""));
      if (detectedBaud == 0) { detectedBaud = baudRates[i]; detectedMode = 3; }
      continue;
    }

    Serial.println(F(" -"));
  }

  Serial.println();

  if (detectedBaud == 0) {
    Serial.println(F("!! No response from any method."));
    Serial.println(F("!! Possible causes:"));
    Serial.println(F("!!  - HC-05: hold button while power on"));
    Serial.println(F("!!  - Module is connected to a device"));
    Serial.println(F("!!  - Wrong wiring or dead module"));
    return;
  }

  Serial.print(F(">> Baud: "));
  Serial.print(detectedBaud);
  Serial.print(F(" / Mode: "));
  if (detectedMode == 1) Serial.println(F("CRLF"));
  else if (detectedMode == 2) Serial.println(F("RAW"));
  else Serial.println(F("CR"));
  Serial.println();

  // 2. 모듈 정보 조회
  Serial.println(F("[Step 2] Module Info"));
  BTSerial.begin(detectedBaud);
  delay(200);

  // 모드에 따라 명령어 전송 방식 결정
  auto sendCmd = [&](const char* cmd) -> String {
    while (BTSerial.available()) BTSerial.read();
    if (detectedMode == 1) {
      BTSerial.print(cmd); BTSerial.print("\r\n");
      return readResponse();
    } else if (detectedMode == 2) {
      BTSerial.print(cmd);
      return readResponse(1200);
    } else {
      BTSerial.print(cmd); BTSerial.print("\r");
      return readResponse();
    }
  };

  Serial.print(F("  VERSION : "));
  String verRes = sendCmd("AT+VERSION");
  Serial.println(verRes);
  delay(200);

  Serial.print(F("  NAME    : "));
  Serial.println(sendCmd("AT+NAME"));
  delay(200);

  Serial.print(F("  ROLE    : "));
  String roleRes = sendCmd("AT+ROLE");
  Serial.println(roleRes);
  delay(200);

  Serial.print(F("  BAUD    : "));
  Serial.println(sendCmd("AT+BAUD"));
  delay(200);

  Serial.print(F("  TYPE    : "));
  Serial.println(sendCmd("AT+TYPE"));
  delay(200);

  Serial.print(F("  ADDR    : "));
  Serial.println(sendCmd("AT+LADDR"));
  delay(200);

  // 3. 모듈 종류 판별
  Serial.println();
  Serial.println(F("[Step 3] Module Type"));

  if (verRes.indexOf("v6.") != -1 || verRes.indexOf("V6.") != -1) {
    Serial.println(F("  >> HM-10 Clone (CC2541) v6.x"));
    Serial.println(F("  Name: AT+NAMExxxx"));
    Serial.println(F("  Baud: AT+BAUD8 = 115200"));
  }
  else if (verRes.indexOf("BT05") != -1 || verRes.indexOf("V4.") != -1) {
    Serial.println(F("  >> MLT-BT05 (Beken)"));
    Serial.println(F("  Name: AT+NAME=xxxx"));
    Serial.println(F("  Baud: AT+BAUD8 = 115200"));
  }
  else if (verRes.indexOf("HMSoft") != -1) {
    Serial.println(F("  >> HM-10 Original"));
    Serial.println(F("  Name: AT+NAMExxxx"));
    Serial.println(F("  Baud: AT+BAUD4 = 115200"));
  }
  else if (verRes.indexOf("hc01") != -1 || verRes.indexOf("HC-05") != -1) {
    Serial.println(F("  >> HC-05 (Classic BT)"));
    Serial.println(F("  Baud: AT+UART=115200,0,0"));
    Serial.println(F("  Note: NOT BLE! Cannot use Web BT"));
  }
  else if (verRes.indexOf("linvor") != -1 || detectedMode == 2) {
    Serial.println(F("  >> HC-06 (Classic BT)"));
    Serial.println(F("  Baud: AT+BAUD8 = 115200"));
    Serial.println(F("  Note: NOT BLE! Cannot use Web BT"));
  }
  else if (verRes.indexOf("JDY") != -1) {
    Serial.println(F("  >> JDY Series"));
    Serial.println(F("  Baud: AT+BAUD8 = 115200"));
  }
  else {
    Serial.println(F("  >> Unknown module"));
    Serial.print(F("  Ver: "));
    Serial.println(verRes);
  }

  if (roleRes.indexOf("0") != -1)
    Serial.println(F("  Role: Slave (OK)"));
  else if (roleRes.indexOf("1") != -1)
    Serial.println(F("  Role: Master (change needed!)"));

  Serial.println();
  Serial.println(F("======================================"));
  Serial.println(F("Done!"));
}

void loop() {}
