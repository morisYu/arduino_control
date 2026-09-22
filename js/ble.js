/**
 * ble.js
 * Web Bluetooth API를 활용한 아두이노(HM-10) 통신 코어 모듈
 */

window.ArduinoBLE = {
    _device: null,
    _server: null,
    _characteristic: null,
    keepReading: true,
    
    // BLE GATT 서비스 UUID (HM-10)
    SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
    CHAR_UUID:    '0000ffe1-0000-1000-8000-00805f9b34fb',
    
    // 콜백 함수들
    onDataReceived: null,
    onLog: null,
    onDisconnect: null,

    // 명령 큐 (스로틀링용)
    commandQueue: [],
    isWriting: false,
    SEND_THROTTLE_MS: 30, // HM-10 버퍼 오버플로우 방지 (30ms)

    log: function(msg) {
        console.log("[BLE]", msg);
        if (this.onLog) this.onLog(msg);
    },

    /**
     * BLE 장치 연결 요청
     */
    connect: async function(deviceNameFilter = null) {
        if (!navigator.bluetooth) {
            alert('이 브라우저는 Web Bluetooth를 지원하지 않습니다.');
            return false;
        }

        try {
            this.log('기기 검색 중...');
            
            let options = {};
            if (deviceNameFilter && deviceNameFilter.trim() !== '') {
                const input = deviceNameFilter.trim();
                const upper = input.toUpperCase();
                const lower = input.toLowerCase();
                
                // 브라우저 네이티브 팝업은 대소문자를 구분하므로, 
                // 원본, 대문자, 소문자 3가지 버전을 모두 필터에 넣어 대소문자 구분 없이 검색되도록 우회
                let filterArray = [{ namePrefix: input }];
                if (upper !== input) filterArray.push({ namePrefix: upper });
                if (lower !== input && lower !== upper) filterArray.push({ namePrefix: lower });
                
                options.filters = filterArray;
                options.optionalServices = [this.SERVICE_UUID];
            } else {
                options.acceptAllDevices = true;
                options.optionalServices = [this.SERVICE_UUID];
            }

            this._device = await navigator.bluetooth.requestDevice(options);
            
            this.log(`기기 선택됨: ${this._device.name}`);
            
            this._device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
            
            this._server = await this._device.gatt.connect();
            this.log('GATT 서버 연결됨');
            
            const service = await this._server.getPrimaryService(this.SERVICE_UUID);
            
            // RX용 특성 (보통 FFE1) - 센서 데이터 수신용
            this._rxCharacteristic = await service.getCharacteristic(this.CHAR_UUID);
            
            // TX용 특성 (명령 전송용)
            // 정품 HM-10은 FFE1 하나로 송수신을 다 하지만, MLT-BT05 복제 모듈은 FFE2를 TX 전용으로 사용하는 경우가 많음!
            try {
                this._txCharacteristic = await service.getCharacteristic('0000ffe2-0000-1000-8000-00805f9b34fb');
                this.log('MLT-BT05 TX 전용 채널(FFE2) 연결 성공');
            } catch (e) {
                // FFE2가 없으면(정품 HM-10) 기존대로 FFE1을 공용으로 사용
                this._txCharacteristic = this._rxCharacteristic;
                this.log('공용 채널(FFE1) 송수신 모드 활성화');
            }
            
            // 데이터 수신 시작 (Notify)
            await this._rxCharacteristic.startNotifications();
            this._rxCharacteristic.addEventListener('characteristicvaluechanged', this.handleData.bind(this));
            
            this.log('BLE 연결 완료 및 수신 대기 중');
            this.keepReading = true;
            return true;
            
        } catch (error) {
            this.log('연결 실패: ' + error);
            if (this._device && this._device.gatt.connected) {
                this._device.gatt.disconnect();
            }
            return false;
        }
    },

    /**
     * BLE 연결 해제
     */
    disconnect: async function() {
        this.keepReading = false;
        if (this._device && this._device.gatt.connected) {
            this._device.gatt.disconnect();
            this.log('장치 연결 해제됨');
        }
        this.clearQueue();
        if (this.onDisconnect) this.onDisconnect();
    },

    onDisconnected: function(event) {
        this.log('블루투스 연결이 끊어졌습니다.');
        this.keepReading = false;
        this.clearQueue();
        if (this.onDisconnect) this.onDisconnect();
    },

    /**
     * 데이터 수신 처리 (Characteristic Value Changed)
     */
    _receiveBuffer: '',
    handleData: function(event) {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value);
        
        this._receiveBuffer += text;
        
        let lines = this._receiveBuffer.split('\n');
        this._receiveBuffer = lines.pop(); // 마지막 불완전한 라인은 버퍼에 남김
        
        for (let line of lines) {
            line = line.trim();
            if (line) {
                // 센서 데이터(H:, T: 등)가 아닌 일반 문자열이면 디버깅을 위해 로그에 출력
                if (!line.startsWith('H:') && !line.startsWith('T:')) {
                    this.log(`[수신됨] ${line}`);
                }
                
                if (this.onDataReceived) {
                    this.onDataReceived(line);
                }
            }
        }
    },

    /**
     * 명령어 전송 (큐에 추가)
     */
    sendCommand: function(cmd) {
        if (!this._txCharacteristic || !this._device || !this._device.gatt.connected) {
            return;
        }
        
        // 블록코딩 무한루프 등에서 동일한 명령(예: BUZ:1000)이 수백 번 밀려들어와 블루투스 큐가 마비(지연)되는 것을 방지
        // 방금 넣은 명령과 완전히 똑같은 명령이라면 큐에 추가하지 않고 무시함
        if (this.commandQueue.length > 0) {
            const lastCmd = this.commandQueue[this.commandQueue.length - 1];
            if (lastCmd === cmd) {
                return;
            }
        }
        
        // PING 명령어가 이미 큐에 있다면 중복해서 넣지 않음
        if (cmd.startsWith('PING') && this.commandQueue.some(c => c.startsWith('PING'))) {
            return;
        }

        this.commandQueue.push(cmd);
        this.processQueue();
    },

    /**
     * 큐 처리 (스로틀링)
     */
    processQueue: async function() {
        if (this.isWriting || this.commandQueue.length === 0) return;
        
        this.isWriting = true;
        
        while (this.commandQueue.length > 0) {
            if (!this._txCharacteristic || !this._device || !this._device.gatt.connected) break;
            
            let cmd = this.commandQueue.shift();
            
            // 저가형 복제 모듈(MLT-BT05 등)은 \r\n (CRLF)으로 끝나지 않으면 버퍼를 전송하지 않고 씹는 고질병이 있습니다.
            // 따라서 모든 명령어의 끝을 강제로 \r\n으로 교체합니다.
            if (!cmd.endsWith('\r\n')) {
                if (cmd.endsWith('\n')) cmd = cmd.replace(/\n$/, '\r\n');
                else cmd += '\r\n';
            }

            if (!cmd.startsWith('PING')) {
                this.log(`명령어 발송: ${cmd.trim()} (${cmd.length} bytes)`);
            }

            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(cmd);
                
                // BLE MTU 제한(기본 20바이트) 우회를 위해 데이터를 20바이트씩 쪼개서 전송
                const CHUNK_SIZE = 20;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    
                    // MLT-BT05 복제 모듈 + 윈도우 환경에서 writeWithoutResponse가 에러 없이 조용히 무시되는(Silent Drop) 현상 방지
                    // 무조건 응답을 받는(write) 방식을 최우선으로 사용하여 확실히 전송되도록 강제
                    try {
                        if (this._txCharacteristic.properties.writeWithoutResponse) {
                            await this._txCharacteristic.writeValueWithoutResponse(chunk);
                        } else if (this._txCharacteristic.properties.write) {
                            await this._txCharacteristic.writeValueWithResponse(chunk);
                        } else {
                            await this._txCharacteristic.writeValue(chunk);
                        }
                    } catch (err) {
                        // 위 방식이 모두 실패할 경우 구형 폴백 시도
                        await this._txCharacteristic.writeValue(chunk);
                    }
                    
                    // 청크 간 버퍼 오버플로우 방지 딜레이
                    await new Promise(resolve => setTimeout(resolve, this.SEND_THROTTLE_MS));
                }
            } catch (e) {
                this.log('BLE 전송 오류: ' + e);
            }
        }
        
        this.isWriting = false;
    },

    /**
     * 큐 비우기 (리셋 시 호출)
     */
    clearQueue: function() {
        this.commandQueue = [];
        // isWriting을 여기서 강제로 false로 바꾸면 현재 진행 중인 루프와 새로 시작되는 루프가 충돌(GATT in progress)합니다.
        // 큐만 비워두면 기존 루프가 알아서 남은 명령을 처리하거나 종료합니다.
    }
};
