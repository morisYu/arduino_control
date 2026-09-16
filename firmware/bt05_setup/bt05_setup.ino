#include <SoftwareSerial.h>

// SoftwareSerial(RX, TX)
// 아두이노 Pin 2 <-> BT TXD
// 아두이노 Pin 3 <-> BT RXD
SoftwareSerial BTSerial(2, 3);

// ==========================================
// [설정] 변경할 블루투스 장치명 (영문/숫자 12자 이내)
// ==========================================
const String NEW_DEVICE_NAME = "BT05_01";

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
  Serial.begin(9600);
  BTSerial.begin(9600);

  while (!Serial); // PC 시리얼 모니터 연결 대기
  delay(1000);

  Serial.println("==========================================");
  Serial.println(">>> MLT-BT05 초기화 및 설정 시작 (스마트팜 전용) <<<");
  Serial.println("==========================================");

  // 1. 통신 확인
  Serial.print("[1/5] 통신 테스트 (AT)... ");
  String res = sendAT("AT");
  if (res.indexOf("OK") != -1) {
    Serial.println("성공 (" + res + ")");
  } else {
    Serial.println("실패! 배선과 전원을 점검하세요.");
    return;
  }
  delay(200);

  // 2. 공장 초기화
  Serial.print("[2/5] 공장 초기화 (AT+DEFAULT)... ");
  res = sendAT("AT+DEFAULT");
  Serial.println("완료 (" + res + ")");
  delay(300);

  // 3. 새 이름 설정
  Serial.print("[3/5] 새 이름 등록 (AT+NAME" + NEW_DEVICE_NAME + ")... ");
  res = sendAT("AT+NAME" + NEW_DEVICE_NAME);
  Serial.println("완료 (" + res + ")");
  delay(200);

  // 4. 통신 속도 115200으로 변경 (스마트팜 펌웨어와 통신하기 위해 필수)
  // MLT-BT05는 AT+BAUD8 이 115200 을 의미합니다.
  Serial.print("[4/5] 통신 속도 115200 변경 (AT+BAUD8)... ");
  res = sendAT("AT+BAUD8");
  Serial.println("완료 (" + res + ")");
  delay(200);

  // 5. 모듈 소프트웨어 리셋 (설정 즉시 반영)
  Serial.print("[5/5] 모듈 재부팅 (AT+RESET)... ");
  res = sendAT("AT+RESET");
  Serial.println("완료 (" + res + ")");
  delay(1000);

  Serial.println("------------------------------------------");
  Serial.println("초기 설정이 모두 끝났습니다!");
  Serial.println("※ 주의: 지금부터 블루투스 모듈의 통신 속도가 115200으로 변경되었으므로,");
  Serial.println("이 설정 코드로는 더 이상 블루투스 모듈과 통신할 수 없습니다.");
  Serial.println("");
  Serial.println("[다음 단계]");
  Serial.println("1. 블루투스의 핀을 아두이노의 0번(RX), 1번(TX)으로 옮겨서 교차로 꽂으세요.");
  Serial.println("2. 스마트팜 본 펌웨어(smartfarm.ino)를 업로드하세요.");
  Serial.println("==========================================");
}

void loop() {
  // 속도가 변경되었으므로 loop의 패스스루 기능은 비활성화합니다.
}
