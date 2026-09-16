/**
 * kits/smartfarm.js
 * 스마트팜 키트 설정 파일
 */

// 음계 주파수 매핑
const noteFreqs = {
    'C4': 262, 'C#4': 277, 'D4': 294, 'D#4': 311, 'E4': 330, 'F4': 349, 'F#4': 370, 'G4': 392, 'G#4': 415, 'A4': 440, 'A#4': 466, 'B4': 494,
    'C5': 523, 'C#5': 554, 'D5': 587, 'D#5': 622, 'E5': 659, 'F5': 698, 'F#5': 740, 'G5': 784, 'G#5': 831, 'A5': 880, 'A#5': 932, 'B5': 988,
    'C6': 1047
};

// 핀 설정 헬퍼
function _getSmartfarmPinConfig() {
    const defaults = {
        dht: '3', light: 'A0', soil: 'A1',
        pumpDir: '7', pumpPwm: '6', buzzer: '4',
        rgbR: '9', rgbG: '10', rgbB: '11',
        rgbType: 'anode', pumpType: 'high', lightType: 'DO'
    };
    try {
        const saved = localStorage.getItem('arduino_pins_smartfarm');
        if (saved) return Object.assign(defaults, JSON.parse(saved));
    } catch(e) {}
    return defaults;
}

window.KitRegistry.register('smartfarm', {
    name: '스마트팜 키트',
    icon: '🌱',
    color: '#10b981',
    headerColorClass: 'bg-emerald-50 dark:bg-slate-800',
    
    sensors: [
        { id: 'temp', label: '온도', unit: '°C', icon: '🌡️', color: '#ef4444' },
        { id: 'humid', label: '습도', unit: '%', icon: '💧', color: '#3b82f6' },
        { id: 'light', label: '조도', unit: '', icon: '☀️', color: '#eab308' },
        { id: 'soil', label: '토양 수분', unit: '', icon: '🌱', color: '#22c55e' }
    ],
    
    actuators: [
        {
            id: 'pump',
            type: 'motor',
            label: '워터 펌프 (DC 모터)',
            statusId: 'status-pump',
            controls: [
                { type: 'slider', id: 'pump-speed', label: '모터 속도 (PWM)', min: 0, max: 255, step: 1, value: 255 },
                { type: 'button-group', buttons: [
                    { id: 'btn-pump-on', label: '가동 (ON)', color: 'blue' },
                    { id: 'btn-pump-off', label: '정지 (OFF)', color: 'gray' }
                ]}
            ]
        },
        {
            id: 'rgb',
            type: 'rgb-led',
            label: 'RGB LED',
            controls: [
                { type: 'color-picker', id: 'color-picker', value: '#ff0000' },
                { type: 'button-group', buttons: [
                    { id: 'btn-color-apply', label: '색상 전송', color: 'purple' },
                    { id: 'btn-color-off', label: 'LED 끄기', color: 'gray' }
                ]}
            ]
        },
        {
            id: 'buzzer',
            type: 'buzzer',
            label: '부저 (Passive Buzzer)',
            statusId: 'status-buzzer',
            controls: [
                { type: 'slider', id: 'buzzer-freq', label: '음 주파수 (Hz)', min: 100, max: 2000, step: 10, value: 1000, displaySuffix: ' Hz' },
                { type: 'button-group', buttons: [
                    { id: 'btn-buzzer-on', label: '경고음 (ON)', color: 'red' },
                    { id: 'btn-buzzer-off', label: '중지 (OFF)', color: 'gray' }
                ]}
            ],
            extras: 'piano'
        }
    ],

    pinConfig: {
        groups: [
            {
                label: '센서 핀 (Sensors)',
                pins: [
                    { id: 'dht', label: '온습도 센서 (DHT11)', type: 'number', default: '3' },
                    { id: 'soil', label: '토양 수분 센서', type: 'text', default: 'A1' },
                    { id: 'light', label: '조도 센서 핀 (LDR)', type: 'text', default: 'A0' },
                    { id: 'lightType', label: '조도 센서 타입', type: 'select', default: 'DO', options: [{value: 'DO', label: '디지털 (DO)'}, {value: 'AO', label: '아날로그 (AO)'}] }
                ]
            },
            {
                label: '액추에이터 핀 (Actuators)',
                pins: [
                    { id: 'pumpDir', label: '펌프 방향 제어 핀', type: 'number', default: '7' },
                    { id: 'pumpPwm', label: '펌프 속도 제어 핀(PWM)', type: 'number', default: '6' },
                    { id: 'pumpType', label: '모터 드라이버 타입', type: 'select', default: 'high', options: [{value: 'high', label: 'High Active (L9110 등)'}, {value: 'low', label: 'Low Active (릴레이 등)'}] },
                    { id: 'buzzer', label: '부저 핀 (PWM)', type: 'number', default: '4' },
                    { id: 'rgbR', label: 'RGB LED (Red)', type: 'number', default: '9' },
                    { id: 'rgbG', label: 'RGB LED (Green)', type: 'number', default: '10' },
                    { id: 'rgbB', label: 'RGB LED (Blue)', type: 'number', default: '11' },
                    { id: 'rgbType', label: 'RGB LED 타입', type: 'select', default: 'anode', options: [{value: 'cathode', label: '공통 음극 (Common Cathode)'}, {value: 'anode', label: '공통 양극 (Common Anode)'}] }
                ]
            }
        ]
    },

    firmware: 'smartfarm',

    blockDefs: [
        {
            "type": "sf_get_temp",
            "message0": "온도 센서 값 읽기",
            "output": "Number",
            "colour": 0,
            "tooltip": "DHT 센서의 온도를 읽어옵니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_get_humid",
            "message0": "습도 센서 값 읽기",
            "output": "Number",
            "colour": 0,
            "tooltip": "DHT 센서의 습도를 읽어옵니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_get_light",
            "message0": "조도 센서 값 읽기",
            "output": "Number",
            "colour": 60,
            "tooltip": "조도 센서의 값을 읽어옵니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_get_soil",
            "message0": "토양 수분 센서 값 읽기",
            "output": "Number",
            "colour": 120,
            "tooltip": "토양 수분 센서의 값을 읽어옵니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_pump_on",
            "message0": "워터 펌프 켜기 (속도: %1)",
            "args0": [{"type": "input_value", "name": "SPEED", "check": "Number"}],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 230,
            "tooltip": "워터 펌프를 지정된 속도(0~255)로 켭니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_pump_off",
            "message0": "워터 펌프 끄기",
            "previousStatement": null,
            "nextStatement": null,
            "colour": 230,
            "tooltip": "워터 펌프를 끕니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_rgb_set",
            "message0": "RGB LED 색상 설정 R: %1 G: %2 B: %3",
            "args0": [
                {"type": "input_value", "name": "R", "check": "Number"},
                {"type": "input_value", "name": "G", "check": "Number"},
                {"type": "input_value", "name": "B", "check": "Number"}
            ],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 280,
            "tooltip": "RGB LED의 색상을 설정합니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_rgb_off",
            "message0": "RGB LED 끄기",
            "previousStatement": null,
            "nextStatement": null,
            "colour": 280,
            "tooltip": "RGB LED를 끕니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_buzzer_on",
            "message0": "부저 소리 켜기 (주파수: %1 Hz)",
            "args0": [{"type": "input_value", "name": "FREQ", "check": "Number"}],
            "previousStatement": null,
            "nextStatement": null,
            "colour": 330,
            "tooltip": "부저에서 지정된 주파수의 소리를 냅니다.",
            "helpUrl": ""
        },
        {
            "type": "sf_buzzer_off",
            "message0": "부저 소리 끄기",
            "previousStatement": null,
            "nextStatement": null,
            "colour": 330,
            "tooltip": "부저 소리를 끕니다.",
            "helpUrl": ""
        }
    ],

    jsGenerators: {
        'sf_get_temp': function(block, generator) { return ['window.ArduinoHW.getSensorValue("temp")', generator.ORDER_ATOMIC]; },
        'sf_get_humid': function(block, generator) { return ['window.ArduinoHW.getSensorValue("humid")', generator.ORDER_ATOMIC]; },
        'sf_get_light': function(block, generator) { return ['window.ArduinoHW.getSensorValue("light")', generator.ORDER_ATOMIC]; },
        'sf_get_soil': function(block, generator) { return ['window.ArduinoHW.getSensorValue("soil")', generator.ORDER_ATOMIC]; },
        'sf_pump_on': function(block, generator) {
            let speed = generator.valueToCode(block, 'SPEED', generator.ORDER_ATOMIC) || '255';
            return `window.ArduinoHW.sendCommand("PUMP_ON", { speed: ${speed} });\n`;
        },
        'sf_pump_off': function(block, generator) {
            return `window.ArduinoHW.sendCommand("PUMP_OFF");\n`;
        },
        'sf_rgb_set': function(block, generator) {
            let r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '0';
            let g = generator.valueToCode(block, 'G', generator.ORDER_ATOMIC) || '0';
            let b = generator.valueToCode(block, 'B', generator.ORDER_ATOMIC) || '0';
            return `window.ArduinoHW.sendCommand("RGB_SET", { r: ${r}, g: ${g}, b: ${b} });\n`;
        },
        'sf_rgb_off': function(block, generator) {
            return `window.ArduinoHW.sendCommand("RGB_OFF");\n`;
        },
        'sf_buzzer_on': function(block, generator) {
            let freq = generator.valueToCode(block, 'FREQ', generator.ORDER_ATOMIC) || '1000';
            return `window.ArduinoHW.sendCommand("BUZZER_ON", { freq: ${freq} });\n`;
        },
        'sf_buzzer_off': function(block, generator) {
            return `window.ArduinoHW.sendCommand("BUZZER_OFF");\n`;
        }
    },

    cGenerators: {
        'sf_get_temp': function(block, generator) {
            generator.definitions_['include_dht'] = '#include <DHT.h>';
            generator.definitions_['define_dht_pin'] = `#define DHTPIN ${_getSmartfarmPinConfig().dht}\n#define DHTTYPE DHT11\nDHT dht(DHTPIN, DHTTYPE);`;
            generator.setups_['setup_dht'] = 'dht.begin();';
            return ['dht.readTemperature()', generator.ORDER_ATOMIC];
        },
        'sf_get_humid': function(block, generator) {
            generator.definitions_['include_dht'] = '#include <DHT.h>';
            generator.definitions_['define_dht_pin'] = `#define DHTPIN ${_getSmartfarmPinConfig().dht}\n#define DHTTYPE DHT11\nDHT dht(DHTPIN, DHTTYPE);`;
            generator.setups_['setup_dht'] = 'dht.begin();';
            return ['dht.readHumidity()', generator.ORDER_ATOMIC];
        },
        'sf_get_light': function(block, generator) {
            const pin = _getSmartfarmPinConfig().light;
            const isAnalog = pin.startsWith('A');
            generator.setups_['setup_light'] = `pinMode(${pin}, INPUT);`;
            return [(isAnalog ? `analogRead(${pin})` : `digitalRead(${pin})`), generator.ORDER_ATOMIC];
        },
        'sf_get_soil': function(block, generator) {
            const pin = _getSmartfarmPinConfig().soil;
            generator.setups_['setup_soil'] = `pinMode(${pin}, INPUT);`;
            return [`analogRead(${pin})`, generator.ORDER_ATOMIC];
        },
        'sf_pump_on': function(block, generator) {
            const speed = generator.valueToCode(block, 'SPEED', generator.ORDER_ATOMIC) || '255';
            const pins = _getSmartfarmPinConfig();
            generator.setups_['setup_pump'] = `pinMode(${pins.pumpDir}, OUTPUT);\npinMode(${pins.pumpPwm}, OUTPUT);`;
            if (pins.pumpType === 'high') {
                return `digitalWrite(${pins.pumpDir}, LOW);\nanalogWrite(${pins.pumpPwm}, ${speed});\n`;
            } else {
                return `digitalWrite(${pins.pumpDir}, HIGH);\nanalogWrite(${pins.pumpPwm}, 255 - (${speed}));\n`;
            }
        },
        'sf_pump_off': function(block, generator) {
            const pins = _getSmartfarmPinConfig();
            generator.setups_['setup_pump'] = `pinMode(${pins.pumpDir}, OUTPUT);\npinMode(${pins.pumpPwm}, OUTPUT);`;
            if (pins.pumpType === 'high') {
                return `digitalWrite(${pins.pumpDir}, LOW);\nanalogWrite(${pins.pumpPwm}, 0);\n`;
            } else {
                return `digitalWrite(${pins.pumpDir}, HIGH);\nanalogWrite(${pins.pumpPwm}, 255);\n`;
            }
        },
        'sf_rgb_set': function(block, generator) {
            const r = generator.valueToCode(block, 'R', generator.ORDER_ATOMIC) || '0';
            const g = generator.valueToCode(block, 'G', generator.ORDER_ATOMIC) || '0';
            const b = generator.valueToCode(block, 'B', generator.ORDER_ATOMIC) || '0';
            const pins = _getSmartfarmPinConfig();
            generator.setups_['setup_rgb'] = `pinMode(${pins.rgbR}, OUTPUT);\npinMode(${pins.rgbG}, OUTPUT);\npinMode(${pins.rgbB}, OUTPUT);`;
            if (pins.rgbType === 'cathode') {
                return `analogWrite(${pins.rgbR}, ${r});\nanalogWrite(${pins.rgbG}, ${g});\nanalogWrite(${pins.rgbB}, ${b});\n`;
            } else {
                return `analogWrite(${pins.rgbR}, 255 - (${r}));\nanalogWrite(${pins.rgbG}, 255 - (${g}));\nanalogWrite(${pins.rgbB}, 255 - (${b}));\n`;
            }
        },
        'sf_rgb_off': function(block, generator) {
            const pins = _getSmartfarmPinConfig();
            generator.setups_['setup_rgb'] = `pinMode(${pins.rgbR}, OUTPUT);\npinMode(${pins.rgbG}, OUTPUT);\npinMode(${pins.rgbB}, OUTPUT);`;
            if (pins.rgbType === 'cathode') {
                return `analogWrite(${pins.rgbR}, 0);\nanalogWrite(${pins.rgbG}, 0);\nanalogWrite(${pins.rgbB}, 0);\n`;
            } else {
                return `analogWrite(${pins.rgbR}, 255);\nanalogWrite(${pins.rgbG}, 255);\nanalogWrite(${pins.rgbB}, 255);\n`;
            }
        },
        'sf_buzzer_on': function(block, generator) {
            const freq = generator.valueToCode(block, 'FREQ', generator.ORDER_ATOMIC) || '1000';
            const pin = _getSmartfarmPinConfig().buzzer;
            generator.setups_['setup_buzzer'] = `pinMode(${pin}, OUTPUT);`;
            return `tone(${pin}, ${freq});\n`;
        },
        'sf_buzzer_off': function(block, generator) {
            const pin = _getSmartfarmPinConfig().buzzer;
            generator.setups_['setup_buzzer'] = `pinMode(${pin}, OUTPUT);`;
            return `noTone(${pin});\n`;
        }
    },

    toolboxCategories: [
        `<category name="스마트팜 센서" colour="210">
            <block type="sf_get_temp"></block>
            <block type="sf_get_humid"></block>
            <block type="sf_get_light"></block>
            <block type="sf_get_soil"></block>
        </category>`,
        `<category name="스마트팜 제어" colour="280">
            <block type="sf_pump_on">
                <value name="SPEED"><shadow type="math_number"><field name="NUM">255</field></shadow></value>
            </block>
            <block type="sf_pump_off"></block>
            <block type="sf_rgb_set">
                <value name="R"><shadow type="math_number"><field name="NUM">255</field></shadow></value>
                <value name="G"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
                <value name="B"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
            </block>
            <block type="sf_rgb_off"></block>
            <block type="sf_buzzer_on">
                <value name="FREQ"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
            </block>
            <block type="sf_buzzer_off"></block>
        </category>`
    ],

    categoryIcons: {
        '스마트팜 센서': createSvgDataUri(`<rect rx="8" width="48" height="48" fill="#22C55E" opacity="0.18"/><path d="M24 36 v-12" stroke="#22C55E" stroke-width="3" stroke-linecap="round"/><path d="M24 28 C18 28 16 22 16 22 C16 22 22 22 24 28 Z" fill="#22C55E"/><path d="M24 24 C30 24 32 18 32 18 C32 18 26 18 24 24 Z" fill="#22C55E"/><circle cx="34" cy="30" r="4" fill="#3B82F6" opacity="0.8"/><circle cx="14" cy="32" r="3" fill="#EAB308" opacity="0.8"/>`),
        '스마트팜 제어': createSvgDataUri(`<rect rx="8" width="48" height="48" fill="#8B5CF6" opacity="0.18"/><rect x="14" y="20" width="20" height="16" rx="2" fill="#8B5CF6"/><circle cx="19" cy="28" r="3" fill="white" opacity="0.5"/><circle cx="29" cy="28" r="3" fill="white" opacity="0.5"/><path d="M24 20 v-8 M20 16 l8 -4" stroke="#8B5CF6" stroke-width="3" stroke-linecap="round"/>`)
    },

    parseData: function(data, sensorValues) {
        const parts = data.split(',');
        let updated = false;
        const keyMap = { 'T': 'temp', 'H': 'humid', 'L': 'light', 'S': 'soil' };
        parts.forEach(part => {
            const [key, val] = part.split(':');
            if (val === undefined) return;
            const sensorId = keyMap[key.trim()];
            if (sensorId) {
                sensorValues[sensorId] = parseFloat(val.trim());
                updated = true;
            }
        });
        return updated;
    },

    onConnect: function(hw) {
        const savedPins = localStorage.getItem('arduino_pins_smartfarm');
        if (savedPins) {
            try {
                const config = JSON.parse(savedPins);
                hw.sendPinConfig(config);
                setTimeout(() => { hw.sendPinConfig(config); }, 800);
                setTimeout(() => { hw.sendPinConfig(config); }, 1600);
            } catch(e) { console.error('핀 설정 로드 오류:', e); }
        }
        
        // 연결 시 LED 초기화 (꺼짐)
        setTimeout(() => {
            hw.turnOffRgbLed();
        }, 500);
    },

    renderActuatorExtras: function(container, actuatorId) {
        if (actuatorId === 'buzzer') {
            const pianoHtml = `
                <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="melody-input" class="flex-grow px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg outline-none focus:border-indigo-500 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200" placeholder="멜로디 입력" value="G4 G4 A4 A4 G4 G4 E4 P G4 G4 E4 E4 D4">
                        <button id="btn-play-melody" class="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-1 shadow-sm whitespace-nowrap">▶ 연주</button>
                    </div>
                    
                    <div class="flex gap-2 mb-2">
                        <div class="flex flex-1 border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden">
                            <button class="beat-btn flex-1 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border-r border-gray-300 dark:border-slate-600 transition-colors" data-beat="2">2박자</button>
                            <button class="beat-btn active flex-1 py-1.5 text-xs font-semibold text-white bg-blue-500 border-r border-gray-300 dark:border-slate-600 transition-colors" data-beat="1">1박자</button>
                            <button class="beat-btn flex-1 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors" data-beat="0.5">0.5박자</button>
                        </div>
                        <button id="btn-rest" class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">쉼표</button>
                        <button id="btn-backspace" class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">지우기 ⌫</button>
                        <button id="btn-clear" class="px-3 py-1.5 text-xs font-semibold text-red-500 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">초기화</button>
                    </div>

                    <div class="flex gap-1 h-16 mt-2">
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="C4">도</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="D4">레</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="E4">미</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="F4">파</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="G4">솔</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="A4">라</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="B4">시</button>
                        <button class="piano-key flex-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm flex items-end justify-center pb-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-200 transition-colors" data-note="C5">도</button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', pianoHtml);
        }
    },

    bindActuatorEvents: function(ctx) {
        const hw = ctx.hw;
        const serial = ctx.serial;
        const isConnectedFn = ctx.isConnected;
        // --- 펌프 ---
        const btnPumpOn = document.getElementById('btn-pump-on');
        const btnPumpOff = document.getElementById('btn-pump-off');
        const sliderPump = document.getElementById('pump-speed');
        
        if (btnPumpOn) btnPumpOn.addEventListener('click', () => {
            if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
            if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다. 직접 제어할 수 없습니다.");
            const speed = sliderPump ? sliderPump.value : 255;
            hw.sendCommand('PUMP_ON', { speed });
        });
        
        if (btnPumpOff) btnPumpOff.addEventListener('click', () => {
            if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
            if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다.");
            hw.sendCommand('PUMP_OFF');
        });
        
        // --- RGB LED ---
        const colorPicker = document.getElementById('color-picker');
        const btnColorApply = document.getElementById('btn-color-apply');
        const btnColorOff = document.getElementById('btn-color-off');
        
        if (btnColorApply) btnColorApply.addEventListener('click', () => {
            if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
            if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다.");
            const hex = colorPicker ? colorPicker.value : '#000000';
            const r = parseInt(hex.substring(1, 3), 16);
            const g = parseInt(hex.substring(3, 5), 16);
            const b = parseInt(hex.substring(5, 7), 16);
            hw.sendCommand('RGB_SET', { r, g, b });
        });
        
        if (btnColorOff) btnColorOff.addEventListener('click', () => {
            if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
            if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다.");
            hw.sendCommand('RGB_OFF');
        });
        
        // --- 부저 ---
        const btnBuzzerOn = document.getElementById('btn-buzzer-on');
        const btnBuzzerOff = document.getElementById('btn-buzzer-off');
        const sliderBuzzer = document.getElementById('buzzer-freq');
        
        if (btnBuzzerOn) btnBuzzerOn.addEventListener('click', () => {
            if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
            if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다.");
            const freq = sliderBuzzer ? sliderBuzzer.value : 1000;
            hw.sendCommand('BUZZER_ON', { freq });
        });
        
        if (btnBuzzerOff) btnBuzzerOff.addEventListener('click', () => {
            if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
            if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다.");
            hw.sendCommand('BUZZER_OFF');
        });
        
        // --- 멜로디 UI 및 재생 ---
        const btnPlayMelody = document.getElementById('btn-play-melody');
        const melodyInput = document.getElementById('melody-input');
        const beatBtns = document.querySelectorAll('.beat-btn');
        const btnRest = document.getElementById('btn-rest');
        const btnBackspace = document.getElementById('btn-backspace');
        const btnClear = document.getElementById('btn-clear');
        const pianoKeys = document.querySelectorAll('.piano-key');
        
        let currentBeat = '1';

        if (beatBtns) {
            beatBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    beatBtns.forEach(b => {
                        b.classList.remove('bg-blue-500', 'text-white');
                        b.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
                    });
                    btn.classList.add('bg-blue-500', 'text-white');
                    btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-600', 'dark:text-gray-300');
                    currentBeat = btn.dataset.beat;
                });
            });
        }

        const appendNote = (note) => {
            if (!melodyInput) return;
            const beatStr = currentBeat === '1' ? '' : `:${currentBeat}`;
            const val = melodyInput.value.trim();
            melodyInput.value = val ? `${val} ${note}${beatStr}` : `${note}${beatStr}`;
        };

        if (btnRest) btnRest.addEventListener('click', () => appendNote('P'));
        if (btnBackspace) btnBackspace.addEventListener('click', () => {
            if (!melodyInput) return;
            const parts = melodyInput.value.trim().split(' ');
            parts.pop();
            melodyInput.value = parts.join(' ');
        });
        if (btnClear) btnClear.addEventListener('click', () => {
            if (melodyInput) melodyInput.value = '';
        });

        if (pianoKeys) {
            pianoKeys.forEach(key => {
                const note = key.dataset.note;
                
                const playDirect = (e) => {
                    e.preventDefault();
                    if (isConnectedFn() && !window.isBlocklyRunning) {
                        hw.sendCommand('BUZZER_ON', { freq: noteFreqs[note] });
                    }
                    key.classList.add('bg-gray-200', 'dark:bg-slate-600');
                };
                
                const stopDirect = (e) => {
                    e.preventDefault();
                    if (isConnectedFn() && !window.isBlocklyRunning) {
                        hw.sendCommand('BUZZER_OFF');
                    }
                    key.classList.remove('bg-gray-200', 'dark:bg-slate-600');
                    appendNote(note);
                };
                
                key.addEventListener('mousedown', playDirect);
                key.addEventListener('mouseup', stopDirect);
                key.addEventListener('mouseleave', (e) => {
                    if (e.buttons === 1) {
                        if (isConnectedFn() && !window.isBlocklyRunning) hw.sendCommand('BUZZER_OFF');
                        key.classList.remove('bg-gray-200', 'dark:bg-slate-600');
                    }
                });
                key.addEventListener('touchstart', playDirect, {passive: false});
                key.addEventListener('touchend', stopDirect, {passive: false});
            });
        }

        if (btnPlayMelody && melodyInput) {
            btnPlayMelody.addEventListener('click', async () => {
                if (!isConnectedFn()) return alert("기기가 연결되지 않았습니다.");
                if (window.isBlocklyRunning) return alert("블록 코딩이 실행 중입니다.");
                
                const melodyStr = melodyInput.value.trim();
                if (!melodyStr) return alert("멜로디를 입력하세요.");
                
                const notes = melodyStr.split(/[\s,]+/).map(n => n.trim().toUpperCase()).filter(n => n);
                btnPlayMelody.disabled = true;
                const originalText = btnPlayMelody.innerText;
                btnPlayMelody.innerText = "재생 중...";
                const baseDuration = 300; 

                for (let n of notes) {
                    let note = n;
                    let beat = 1;
                    if (n.includes(':')) {
                        const parts = n.split(':');
                        note = parts[0];
                        beat = parseFloat(parts[1]) || 1;
                    }
                    
                    const duration = baseDuration * beat;
                    
                    if (note === 'P' || note === 'REST' || note === '0' || !noteFreqs[note]) {
                        hw.sendCommand('BUZZER_OFF');
                        await new Promise(r => setTimeout(r, duration));
                    } else {
                        hw.sendCommand('BUZZER_ON', { freq: noteFreqs[note] });
                        await new Promise(r => setTimeout(r, duration * 0.9));
                        hw.sendCommand('BUZZER_OFF');
                        await new Promise(r => setTimeout(r, duration * 0.1));
                    }
                }
                
                btnPlayMelody.innerText = originalText;
                btnPlayMelody.disabled = false;
            });
        }
    }
});
