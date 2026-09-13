# PROJECT_CONTEXT.md — 링크보드(LinkBoard) 프로젝트 컨텍스트

> **이 문서의 목적:** 모든 AI 코딩 세션 및 개발자가 참조해야 할 절대적인 기준 문서. 코드베이스 스캔 결과와 확정된 아키텍처 규칙을 병합하여 작성되었음. 이 문서와 상충되는 어떤 외부 가정이나 추론도 이 문서를 우선함.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | 링크보드 (LinkBoard) |
| **목적** | 초·중등 교육 현장(스마트팜, 자율주행차, 핸디노 등)에서 사용하는 아두이노 블록코딩 PWA |
| **타겟 디바이스** | 안드로이드 태블릿 Chrome 브라우저 |
| **배포 환경** | GitHub Pages (정적 파일 직접 배포, 빌드 단계 없음) |
| **하드웨어** | 아두이노 우노 / 나노 + HM-10 BLE 모듈 |
| **통신 방식** | ~~Web Serial API (유선 USB)~~ → **Web Bluetooth API (무선 BLE)** [전환 예정] |

---

## 2. 기술 스택 (확정)

> [!IMPORTANT]
> 이 프로젝트는 **Next.js가 아니며**, React 등 어떤 JS 프레임워크도 사용하지 않는다. 모든 AI 세션에서 Next.js 구조나 npm 빌드를 가정하는 답변은 틀린 것임.

```
프론트엔드: 순수 Vanilla HTML5 + JavaScript (ES2020+, ESM 일부 사용)
스타일:     Tailwind CSS v3 (CDN)
블록코딩:   Google Blockly v13.0.0 (CDN, unpkg)
차트:       Chart.js (CDN)
직렬화:     localStorage (블록 자동저장/복구)
빌드:       없음 — index.html 직접 서빙
배포:       GitHub Pages (정적 파일)
```

### 파일 로드 순서 (index.html 기준, 순서 엄수)

```
1.  Tailwind CSS (CDN)
2.  Chart.js (CDN)
3.  Blockly Core / Blocks / JavaScript Generator / 한글 메시지 (CDN)
4.  js/custom_category.js   ← Blockly 초기화 전 카테고리 등록
5.  Web Serial Polyfill (CDN) ← Android WebUSB 호환
6.  js/kit-registry.js      ← 키트 레지스트리 (가장 먼저)
7.  js/kits/smartfarm.js    ← 스마트팜 키트 정의
8.  js/kits/handino.js      ← 핸디노 키트 정의
9.  js/ai.js                ← AI 기능 (TTS, 핸드트래킹)
10. js/blocks.js (defer)    ← 공통 블록 정의 + JS/C 듀얼 제너레이터
11. js/blocks-ai.js (defer) ← AI 전용 블록
12. js/coding.js (module)   ← Blockly 워크스페이스 + 실행 엔진
13. js/serial.js            ← [교체 대상] 유선 통신 모듈
14. js/hardware.js          ← 하드웨어 추상화 계층
15. js/app.js (module)      ← 앱 메인 로직 (키트 전환, UI 이벤트)
```

---

## 3. 프로젝트 디렉토리 구조

```
arduino_control/
├── index.html              # 진입점 (전체 UI 레이아웃, 모달 포함)
├── style.css               # 전역 커스텀 스타일
├── favicon.jpg
├── polyfill.js             # 레거시 폴리필
├── PROJECT_CONTEXT.md      # 이 문서
├── js/
│   ├── serial.js           # ⚠️ [교체 대상] Web Serial API 유선 통신
│   ├── hardware.js         # 하드웨어 추상화 계층 (window.ArduinoHW)
│   ├── coding.js           # Blockly 워크스페이스 + 비동기 실행 엔진
│   ├── blocks.js           # 공통 블록 정의 + JS/C 듀얼 제너레이터
│   ├── blocks-ai.js        # AI 전용 블록 정의
│   ├── custom_category.js  # 커스텀 Blockly 카테고리 (FlyoutCategory)
│   ├── app.js              # 앱 메인 (키트 선택, 탭 전환, 대시보드)
│   ├── ai.js               # AI 기능 (Web Speech TTS, MediaPipe Hand)
│   ├── kit-registry.js     # 키트 등록/조회 레지스트리
│   └── kits/
│       ├── smartfarm.js    # 스마트팜 키트 블록/제너레이터/UI 정의
│       └── handino.js      # 핸디노(손 로봇) 키트 블록/제너레이터/UI 정의
├── firmware/
│   ├── smartfarm/          # 스마트팜 아두이노 펌웨어 소스
│   └── handino/            # 핸디노 아두이노 펌웨어 소스
├── package.json            # avrbro, stk500-esm (펌웨어 플래시용, BLE와 무관)
└── node_modules/           # 펌웨어 플래시 전용 의존성
```

---

## 4. 시스템 아키텍처 및 하드웨어 통신 흐름

### 4-1. 실행 아키텍처 (Tethered 실시간 제어 방식)

> [!NOTE]
> 이 프로젝트는 아두이노에 C++ 코드를 업로드(컴파일)하는 방식이 **아님**. 태블릿 브라우저에서 생성된 JavaScript 코드를 브라우저 자체 엔진으로 실행하며, BLE를 통해 **짧은 제어 텍스트 명령어만 실시간으로 송수신**하는 'Tethered(실시간 제어)' 방식임.

```
┌─────────────────────────────────────────────────────┐
│                 안드로이드 태블릿 Chrome               │
│                                                      │
│  ┌──────────┐    생성된 JS 코드 실행    ┌──────────┐  │
│  │  Blockly │ ─── async/await ──────▶ │ runCode()│  │
│  │  블록 UI  │                         │ (coding  │  │
│  └──────────┘                         │   .js)   │  │
│                                       └────┬─────┘  │
│                                            │ 함수 호출 │
│                                       ┌────▼─────┐  │
│                                       │ArduinoHW │  │
│                                       │(hardware │  │
│                                       │   .js)   │  │
│                                       └────┬─────┘  │
│                                            │ sendCommand()
│                                       ┌────▼──────┐ │
│                              현재 →   │ArduinoSerial│
│                              [유선]   │(serial.js)  │
│                              예정 →   │    또는     │ │
│                              [BLE]    │  (ble.js)  │ │
│                                       └────┬──────┘ │
└────────────────────────────────────────────┼─────────┘
                                             │ 텍스트 명령
                          ┌──────────────────▼──────────────────┐
                          │         아두이노 우노 / 나노           │
                          │  펌웨어: 명령어 파싱 → 핀 직접 제어   │
                          │  ┌─────────────────────────────────┐ │
                          │  │ HM-10 BLE 모듈 (UART 브릿지)    │ │
                          │  │ Service UUID: 0xffe0             │ │
                          │  │ Characteristic UUID: 0xffe1      │ │
                          │  └─────────────────────────────────┘ │
                          └──────────────────────────────────────┘
```

### 4-2. Web Serial → Web Bluetooth 전환 포인트

```
[현재: serial.js]                     [목표: ble.js]
──────────────────────────────────    ──────────────────────────────────────
navigator.serial                   →  navigator.bluetooth
navigator.serial.requestPort()     →  navigator.bluetooth.requestDevice()
port.open({ baudRate: 115200 })    →  server.connect() + getPrimaryService()
port.writable.getWriter()          →  characteristic.writeValueWithoutResponse()
TextDecoderStream + pipeTo()       →  characteristic.startNotifications()
                                      + 'characteristicvaluechanged' 이벤트
port.close()                       →  server.disconnect()
```

---

## 5. 하드웨어 통신 인터페이스 규격 (Drop-in 교체 전략)

### 5-1. 핵심 원칙: `window.ArduinoSerial` 네임스페이스 동결

> [!CAUTION]
> `hardware.js`의 코드는 **절대 수정하지 않는다.** `serial.js`를 `ble.js`로 교체할 때, 아래 인터페이스를 100% 동일하게 구현하는 것이 필수 조건임. 인터페이스가 보존되는 한, `hardware.js`, `blocks.js`, 각 키트 파일은 한 줄도 건드릴 필요가 없음.

### 5-2. `window.ArduinoSerial` 필수 인터페이스 명세

```javascript
window.ArduinoSerial = {
    // ── 상태 속성 ──────────────────────────────────────────────────────
    port: null,              // [serial] SerialPort 객체 / [ble] BluetoothDevice 객체
    keepReading: true,       // 수신 루프 실행 여부 플래그

    // ── 콜백 (app.js / coding.js 에서 주입됨, 반드시 호출해야 함) ────
    onDataReceived: null,    // (line: string) => void  — '\n' 기준 파싱된 수신 데이터
    onLog: null,             // (msg: string) => void   — UI 통신 로그 출력
    onDisconnect: null,      // () => void              — 연결 해제 시 UI 상태 복구

    // ── 핵심 메서드 (모두 필수 구현) ───────────────────────────────────
    connect: async function() { ... },     // 사용자 클릭으로 트리거, 장치 선택 UI 표시
    disconnect: async function() { ... },  // 수동 연결 해제 + 리소스 정리
    sendCommand: function(cmd) { ... },    // 명령어를 commandQueue에 추가 후 processQueue() 호출
    processQueue: async function() { ... },// 큐에서 순차적으로 명령 전송 (동시 전송 방지)
    clearQueue: function() { ... },        // 큐 전체 비우기 (stopCode 시 호출됨)
    log: function(msg) { ... },            // 내부 로그 래퍼 (onLog 콜백 호출)

    // ── 명령 큐 (구조 동결) ─────────────────────────────────────────────
    commandQueue: [],        // 전송 대기 중인 명령어 문자열 배열
    isWriting: false,        // 현재 전송 중 여부 (동시 전송 방지 뮤텍스)
};

// 하위 호환성 별칭 (반드시 유지)
window.SmartFarmSerial = window.ArduinoSerial;
```

### 5-3. BLE 전용 추가 구현 사항 (ble.js에서만 사용)

```javascript
// ble.js 내부에서만 사용되는 BLE 전용 속성
{
    _device: null,           // BluetoothDevice
    _server: null,           // BluetoothRemoteGATTServer
    _characteristic: null,   // BluetoothRemoteGATTCharacteristic (Read/Write/Notify)

    // BLE GATT 서비스 UUID (HM-10 모듈 고정값)
    SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
    CHAR_UUID:    '0000ffe1-0000-1000-8000-00805f9b34fb',

    // Throttle: HM-10 버퍼 오버플로 방지 (연속 전송 간 최소 간격)
    SEND_THROTTLE_MS: 20,    // 권장: 20~50ms (HM-10 안정성 기준)
}
```

---

## 6. 명령어 프로토콜 규격

> [!NOTE]
> 아두이노 펌웨어가 파싱하는 텍스트 프로토콜. BLE 전환 후에도 이 규격은 **변경 없음**. 브라우저 → 아두이노 방향(Tx)과 아두이노 → 브라우저 방향(Rx) 모두 `\n`을 패킷 구분자로 사용함.

### 6-1. Tx (브라우저 → 아두이노) — 제어 명령

| 명령어 형식 | 설명 | 예시 |
|------------|------|------|
| `PUMP:{dir},{pwm}\n` | 워터펌프 제어 (DC모터) | `PUMP:0,200\n` |
| `SRV:{finger},{angle}\n` | 개별 서보모터 각도 | `SRV:thumb,90\n` |
| `SRV:all,{angle}\n` | 전체 서보모터 동시 제어 | `SRV:all,165\n` |
| `RGB:{r},{g},{b}\n` | RGB LED 색상 (PWM) | `RGB:255,0,128\n` |
| `BUZ:{freq}\n` | 부저 주파수 (0=끄기) | `BUZ:1000\n` |
| `CFG:PUMP:{d},{p},RGB:{r},{g},{b},BUZ:{b},DHT:{d},...\n` | 핀 설정 일괄 전송 | (핀 설정 모달 저장 시) |
| `PING\n` | 연결 확인 핑 | `PING\n` |

### 6-2. Rx (아두이노 → 브라우저) — 센서 데이터

| 데이터 형식 | 설명 |
|------------|------|
| `T:{value},H:{value}\n` | 온도/습도 (DHT 센서) |
| `L:{value}\n` | 조도 센서 |
| `S:{value}\n` | 토양 수분 센서 |
| `PONG\n` | PING 응답 |

### 6-3. 명령 큐(Queue) 동작 구조

```
sendCommand("RGB:255,0,0\n")   → commandQueue.push()
                                 → processQueue() 호출
                                    ├─ isWriting 체크 (뮤텍스)
                                    ├─ 큐에서 shift() → 전송
                                    ├─ [BLE] writeValueWithoutResponse()
                                    │         + SEND_THROTTLE_MS 대기
                                    └─ 큐 소진 시 isWriting = false

stopCode() 호출 시:
  → clearQueue()         ← 쌓인 명령 전체 폐기
  → ArduinoHW.turnOff*() ← 안전 정지 명령 즉시 발송
```

---

## 7. Blockly 비동기 실행 엔진 현황

### 7-1. 현재 구현 상태 (coding.js)

> [!TIP]
> 비동기 실행 엔진의 핵심 인프라는 이미 완성되어 있음. Phase 2 개발에서 이 엔진을 새로 만들지 말고, 아래 구조를 그대로 활용할 것.

```javascript
// coding.js 핵심 실행 플로우

// 1. 취소 플래그 (전역)
window.__isBlocklyCancelled = false;

// 2. blocks.js에서 모든 statement 앞에 자동 삽입되는 취소 체크
jsGen.STATEMENT_PREFIX =
    'if (window.__isBlocklyCancelled) throw new Error("Cancelled");\n';

// 3. 딜레이 블록 생성 코드 (취소 가능한 인터벌 기반)
jsGen.forBlock['ard_delay'] = function(block) {
    // → 50ms 간격 인터벌로 window.__isBlocklyCancelled 체크
    // → 취소 시 즉시 resolve()하여 await 탈출
};

// 4. 무한루프 블록 (브라우저 멈춤 방지)
jsGen.forBlock['ard_forever'] = function(block) {
    // → while(!window.__isBlocklyCancelled) + 10ms yield
};

// 5. 실행 진입점 (AsyncFunction 동적 생성)
async function runCode() {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const func = new AsyncFunction(executableCode);
    await func(); // ← 생성된 JS 코드를 async 함수로 직접 실행
}

// 6. 안전 정지
function stopCode() {
    window.__isBlocklyCancelled = true;
    window.ArduinoSerial.clearQueue(); // ← BLE 전환 후에도 동일하게 동작
    window.ArduinoHW.turnOffPump();
    window.ArduinoHW.turnOffRgbLed();
    window.ArduinoHW.turnOffBuzzer();
}
```

### 7-2. 듀얼 코드 제너레이터 (blocks.js)

```
Blockly 블록
    ├── JavaScript Generator (jsGen) → 브라우저 실행용 async JS 코드
    └── C Generator (Blockly.C)      → Arduino IDE용 C++ 미리보기 (업로드 불필요)
```

---

## 8. 키트 시스템 구조

```javascript
// kit-registry.js
KitRegistry.register({
    id: 'smartfarm',
    name: '스마트팜',
    blockDefs: [...],          // Blockly 블록 JSON 정의
    jsGenerators: { ... },     // 블록별 JS 코드 생성 함수
    cGenerators: { ... },      // 블록별 C 코드 생성 함수
    toolboxCategories: [...],  // Toolbox XML 문자열 배열
    // ...대시보드 UI 정의, 핀 설정 정보 등
});

// 키트 추가 시: js/kits/{kitId}.js 파일 생성 + index.html에 script 태그 추가
```

---

## 9. 향후 개발 과제 (To-Do)

### Phase 2: BLE 전환 (우선순위 순)

- [ ] **`js/ble.js` 신규 작성** — `window.ArduinoSerial` 인터페이스를 Web Bluetooth로 재구현
  - `navigator.bluetooth.requestDevice()` 연결 플로우
  - GATT 서비스(`0xffe0`) / 특성(`0xffe1`) 연결
  - `writeValueWithoutResponse()` 기반 Tx
  - `startNotifications()` + `characteristicvaluechanged` 기반 Rx
  - `SEND_THROTTLE_MS` 기반 전송 Throttle (HM-10 버퍼 보호)
  - `server.addEventListener('gattserverdisconnected', ...)` 자동 재연결
- [ ] **`index.html` 수정** — `serial.js` → `ble.js` 교체, 연결 버튼 텍스트 변경 ("시리얼 연결" → "BLE 연결")
- [ ] **BLE 연결 상태 UI 개선** — 신호 강도(RSSI), 재연결 버튼, 연결 중 스피너

### Phase 3: 추가 키트 확장

- [ ] 자율주행차 키트 (`js/kits/car.js`) 추가
- [ ] 모터 제어 블록 (방향, 속도 PWM) 추가

### Phase 4: 안정성 & UX

- [ ] BLE 명령 ACK 체계 (아두이노 → `OK\n` 응답 확인)
- [ ] 오프라인 PWA (Service Worker, `manifest.json`) 추가
- [ ] 블록 공유 기능 (JSON export/import QR 코드)

---

## 10. 개발 시 필수 제약 사항

> [!WARNING]
> 아래 규칙을 위반하는 코드 제안은 즉시 기각됨.

1. **프레임워크 금지:** React, Vue, Next.js, Vite 등 JS 프레임워크/번들러 도입 금지
2. **인터페이스 동결:** `window.ArduinoSerial`의 메서드 시그니처 변경 금지
3. **프로토콜 동결:** 아두이노 펌웨어와 약속된 텍스트 명령어 형식 변경 금지 (펌웨어 재업로드 없이 변경 불가)
4. **실행 엔진 재작성 금지:** `coding.js`의 `runCode()` / `stopCode()` 구조는 유지하고 확장만 허용
5. **CDN 고정:** Blockly는 반드시 `v13.0.0`으로 고정 (버전 업 시 제너레이터 API 파괴적 변경 발생 가능)
6. **`index.html` 스크립트 로드 순서 엄수:** 위 §2의 로드 순서를 반드시 따를 것

---

*문서 작성일: 2026-09-13 | 기반: 코드베이스 직접 스캔 결과*
