#include <SoftwareSerial.h>

// SoftwareSerial(RX, TX)
// 아두이노 Pin 2 <-> BT TXD
// 아두이노 Pin 5 <-> BT RXD
SoftwareSerial BTSerial(2, 5);

const int ledPin = 13; // 아두이노 내장 LED (테스트용)

// ==========================================
// [설정] 변경할 블루투스 장치명 (영문/숫자 12자 이내)
// ==========================================
const String NEW_DEVICE_NAME = "BT05_00";

// MLT-BT05 전용 AT 명령어 전송 함수 (\r\n 필수)
String sendAT(String cmd, unsigned long timeout = 1000) {
  while (BTSerial.available()) BTSerial.read(); // 버퍼 비우기

  BTSerial.print(cmd + "\r\n"); // MLT-BT05는 Both NL & CR 방식 요구
  
  unsigned long start = millis();
  String response = "";
  while (millis() - start < timeout) {
    if (BTSerial.available()) {
      response += (char)BTSerial.read();
    }
  }
  response.trim();
  return response;
}

void setup() {
  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW); // 기본 상태: 꺼짐

  Serial.begin(9600);
  BTSerial.begin(9600);

  while (!Serial); // PC 시리얼 모니터 연결 대기
  delay(1000);

  Serial.println("==========================================");
  Serial.println(">>> MLT-BT05 진단 + 설정 + 테스트 <<<");
  Serial.println("==========================================");

  // 1. 통신 확인
  Serial.print("[1/4] 통신 테스트 (AT)... ");
  String res = sendAT("AT");
  if (res.indexOf("OK") != -1) {
    Serial.println("성공 (" + res + ")");
  } else {
    Serial.println("실패! 배선과 전원을 점검하세요.");
    return;
  }
  delay(500);

  // 2. 모듈 정보 조회
  Serial.println("[2/4] 모듈 정보 조회 중...");
  
  Serial.print("  VERSION : ");
  Serial.println(sendAT("AT+VERSION"));
  delay(200);
  
  Serial.print("  ROLE    : ");
  Serial.println(sendAT("AT+ROLE"));
  delay(200);
  
  Serial.print("  BAUD    : ");
  Serial.println(sendAT("AT+BAUD"));
  delay(200);
  
  Serial.print("  TYPE    : ");
  Serial.println(sendAT("AT+TYPE"));
  delay(200);

  // 3. 새 이름 설정 (이 모듈은 등호 없이 AT+NAME 뒤에 바로 이름을 붙여야 함)
  Serial.print("[3/4] 새 이름 등록 (AT+NAME" + NEW_DEVICE_NAME + ")... ");
  res = sendAT("AT+NAME" + NEW_DEVICE_NAME, 1500);
  Serial.println("응답: (" + res + ")");
  delay(500);

  // 4. 모듈 재부팅 (이름 반영용, 9600 유지이므로 안전)
  Serial.print("[4/4] 모듈 재부팅 (AT+RESET)... ");
  res = sendAT("AT+RESET", 1500);
  Serial.println("완료 (" + res + ")");
  delay(2000); // 재부팅 완료 대기

  // 재부팅 후 이름이 잘 바뀌었는지 확인
  Serial.print("  이름 확인: ");
  Serial.println(sendAT("AT+NAME", 1500));
  delay(200);
  
  Serial.print("  Baud 확인: ");
  Serial.println(sendAT("AT+BAUD", 1500));
  delay(200);

  Serial.println("------------------------------------------");
  Serial.println("설정이 끝났습니다! (통신 속도: 9600 bps 유지)");
  Serial.println("");
  Serial.println("[테스트 안내]");
  Serial.println("bt05_test.html 웹사이트를 열어 블루투스 동작 테스트를 진행하세요.");
  Serial.println("웹에서 1(켜기) 또는 0(끄기) 버튼을 누르면 아두이노의 내장 LED(13번)가 반응합니다.");
  Serial.println("==========================================");
}

void loop() {
  // 1. 웹 브라우저로부터 BLE 데이터 수신
  if (BTSerial.available()) {
    char command = BTSerial.read();

    // PC 시리얼 모니터에 디버그 로그 출력
    Serial.print("[수신] : ");
    Serial.println(command);

    if (command == '1') {
      digitalWrite(ledPin, HIGH);
      BTSerial.println("LED ON"); // 웹사이트 실시간 콘솔로 알림 회신
      Serial.println(">> 상태: LED 켜짐 (HIGH)");
    } 
    else if (command == '0') {
      digitalWrite(ledPin, LOW);
      BTSerial.println("LED OFF"); // 웹사이트 실시간 콘솔로 알림 회신
      Serial.println(">> 상태: LED 꺼짐 (LOW)");
    }
  }

  // 2. PC 시리얼 모니터에서 웹으로 임의 문자열 전송 테스트
  if (Serial.available()) {
    BTSerial.write(Serial.read());
  }
}
