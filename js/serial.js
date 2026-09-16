/**
 * serial.js
 * Web Serial API를 활용한 아두이노 통신 코어 모듈
 * 
 * 향후 Blockly 환경에서도 접근 가능하도록 전역 네임스페이스(window.ArduinoSerial)에 등록
 */
window.ArduinoSerialWired = {
    port: null,
    reader: null,
    readableStreamClosed: null,
    keepReading: true,
    
    // 콜백 함수들
    onDataReceived: null,
    onLog: null,
    onDisconnect: null,

    log: function(msg) {
        console.log("[Serial]", msg);
        if (this.onLog) this.onLog(msg);
    },

    /**
     * 시리얼 포트 연결 요청
     */
    connect: async function(existingPort = null) {
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        if (!('serial' in navigator)) {
            if (isAndroid) {
                alert('안드로이드 시리얼 연결 오류:\n\n' +
                    '1. Chrome 브라우저(89 이상)를 사용하세요.\n' +
                    '2. 반드시 HTTPS 또는 localhost로 접속하세요.\n' +
                    '   (file:// 에서는 WebUSB가 차단됩니다)\n' +
                    '3. USB OTG 케이블로 아두이노를 연결하세요.');
            } else {
                alert('Web Serial API를 지원하지 않는 브라우저입니다.\nChrome, Edge 등 Chromium 기반 브라우저를 사용해주세요.');
            }
            return false;
        }

        try {
            if (existingPort) {
                this.port = existingPort;
            } else {
                // 사용자에게 포트 선택 창 표시 (안드로이드 WebUSB 폴리필 호환 필터)
                const filters = [
                    { usbVendorId: 0x2341, usbProductId: 0x0043 }, // 정품 아두이노 Uno
                    { usbVendorId: 0x2341, usbProductId: 0x0042 }, // 정품 아두이노 Mega
                    { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // CH340 호환 보드
                    { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // CP2102 호환 칩셋
                    { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232
                    { usbVendorId: 0x2341 },                       // 기타 아두이노 보드
                    { usbVendorId: 0x1a86 },                       // 기타 CH340 변형
                ];
                
                try {
                    this.port = await navigator.serial.requestPort({ filters });
                } catch (filterError) {
                    // 사용자 취소는 그대로 전달
                    if (filterError.name === 'NotFoundError' || 
                        (filterError.message && filterError.message.toLowerCase().includes('cancel'))) {
                        throw filterError;
                    }
                    // 필터 호환성 문제 시 필터 없이 재시도 (안드로이드 폴리필 호환)
                    this.log('필터 기반 장치 검색 실패, 전체 장치 목록으로 재시도...');
                    this.port = await navigator.serial.requestPort();
                }
            }

            // 안드로이드 커널이 USB 인터페이스 권한을 쥐고 놔주지 않는 현상을 방지하기 위한 세션 초기화(reset)
            if (this.port) {
                const usbDev = this.port.usbDevice_ || this.port._device || this.port.device_;
                if (usbDev && typeof usbDev.reset === 'function') {
                    try {
                        await usbDev.reset();
                        console.log("[Serial] USB Device reset successful.");
                    } catch (resetErr) {
                        console.warn("[Serial] USB Device reset failed (may not be supported or necessary):", resetErr);
                    }
                }
            }

            try {
                await this.port.open({ baudRate: 115200 });
            } catch (openError) {
                // 포트가 이미 열려있는 경우 처리 (안드로이드에서 간헐적 발생)
                if (openError.message && 
                    (openError.message.includes('already open') || 
                     openError.message.includes('already been opened'))) {
                    this.log('포트가 이미 열려있습니다. 기존 연결을 사용합니다.');
                } else {
                    console.error("[Serial] 포트 개방 오류 (Open Error):", openError);
                    throw openError; // UI에 에러를 표시하기 위해 호출자(app.js)로 에러 전달
                }
            }

            this.keepReading = true;
            
            this.log('시리얼 포트 연결 성공!' + (isAndroid ? ' (WebUSB 폴리필)' : ''));
            
            // 물리적 연결 끊김 감지 - Web Serial Polyfill 호환성을 위해 별도 try-catch
            try {
                if (typeof navigator.serial.addEventListener === 'function') {
                    navigator.serial.addEventListener('disconnect', (event) => {
                        if (event.target === this.port) {
                            this.log('장치가 물리적으로 분리되었습니다.');
                            this.handleDisconnect();
                        }
                    });
                } else if (this.port && typeof this.port.addEventListener === 'function') {
                    // 일부 폴리필은 포트 객체에서 disconnect 이벤트를 발생
                    this.port.addEventListener('disconnect', () => {
                        this.log('장치가 물리적으로 분리되었습니다.');
                        this.handleDisconnect();
                    });
                }
            } catch (disconnectErr) {
                // disconnect 이벤트 등록 실패해도 연결 자체는 정상 진행
                console.warn('[Serial] disconnect 이벤트 리스너 등록 실패 (폴리필 호환성):', disconnectErr.message);
            }

            // 비동기로 수신 루프 시작
            this.readLoop();
            return true;

        } catch (error) {
            this.log('연결 실패: ' + error.message);
            throw error; // app.js에서 캐치하여 화면에 띄울 수 있도록 에러 재발생
        }
    },

    /**
     * 수동으로 연결 종료
     */
    disconnect: async function() {
        this.keepReading = false;
        
        // 1. 읽기 스트림 취소 (read 루프 종료 유도)
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch(e) {}
        }
        
        // 2. 스트림 파이프라인이 완전히 닫힐 때까지 대기 (필수!)
        if (this.readableStreamClosed) {
            try {
                await this.readableStreamClosed;
            } catch(e) {}
        }
        
        await this.handleDisconnect();
    },

    /**
     * 내부 연결 해제 처리 로직
     */
    handleDisconnect: async function() {
        if (this.port) {
            try {
                await this.port.close();
            } catch(e) {
                this.log('포트 닫기 오류: ' + e.message);
            }
            this.port = null;
        }
        this.log('시리얼 포트 연결이 해제되었습니다.');
        if (this.onDisconnect) this.onDisconnect();
    },

    commandQueue: [],
    isWriting: false,

    clearQueue: function() {
        this.commandQueue = [];
    },

    /**
     * 아두이노로 명령어 전송 (핵심 전송 함수)
     * @param {string} cmd 전송할 명령어 문자열 (반드시 \n 포함 여부 확인)
     */
    sendCommand: function(cmd) {
        if (!this.port || !this.port.writable) {
            this.log('전송 실패: 포트가 연결되지 않았습니다. (명령: ' + cmd.trim() + ')');
            return;
        }

        // 블록코딩 무한루프 지연 방지: 직전 명령과 완전히 동일하면 큐에 추가 안 함
        if (this.commandQueue.length > 0) {
            if (this.commandQueue[this.commandQueue.length - 1] === cmd) {
                return;
            }
        }
        
        // PING 중복 방지
        if (cmd.startsWith('PING') && this.commandQueue.some(c => c.startsWith('PING'))) {
            return;
        }

        this.commandQueue.push(cmd);
        // 너무 많은 명령어가 쌓여 메모리를 누수하는 것을 방지
        if (this.commandQueue.length > 50) {
            this.commandQueue.shift();
        }

        this.processQueue();
    },

    processQueue: async function() {
        if (this.isWriting) return;
        this.isWriting = true;

        let writer;
        try {
            writer = this.port.writable.getWriter();
            const encoder = new TextEncoder();
            
            while (this.commandQueue.length > 0) {
                const cmd = this.commandQueue.shift();
                try {
                    await writer.write(encoder.encode(cmd));
                    if (!cmd.startsWith('PING')) {
                        this.log('송신: ' + cmd.trim());
                    }
                } catch (error) {
                    this.log('송신 오류: ' + error.message);
                }
            }
        } catch (error) {
            this.log('Writer 획득 오류: ' + error.message);
        } finally {
            if (writer) {
                try { writer.releaseLock(); } catch(e) {}
            }
            this.isWriting = false;
            
            // 만약 writer 정리 중에 큐에 새 명령이 추가되었다면 다시 처리
            if (this.commandQueue.length > 0) {
                this.processQueue();
            }
        }
    },

    /**
     * 수신 루프 (데이터 읽기)
     * - 안드로이드 WebUSB Polyfill 환경에서 스트림이 잠기는 문제를 방지하기 위해
     *   에러 발생 시 스트림을 완전히 정리한 후 재시도하도록 구현
     */
    readLoop: async function() {
        while (this.port && this.keepReading) {
            // port.readable이 잠겨있으면 루프 탈출
            if (!this.port.readable) {
                this.log('[readLoop] port.readable 없음 - 루프 종료');
                break;
            }

            const decoder = new TextDecoderStream();
            this.readableStreamClosed = this.port.readable.pipeTo(decoder.writable);
            this.reader = decoder.readable.getReader();

            let buffer = '';

            try {
                while (this.keepReading) {
                    const { value, done } = await this.reader.read();
                    if (done) {
                        this.log('[readLoop] 스트림 종료(done)');
                        break;
                    }
                    if (value) {
                        buffer += value;
                        // 개행 문자(\n) 기준으로 패킷 분리
                        let lines = buffer.split('\n');
                        // 마지막 요소는 아직 불완전할 수 있으므로 버퍼에 남김
                        buffer = lines.pop();

                        for (let line of lines) {
                            line = line.trim();
                            if (line && this.onDataReceived) {
                                this.onDataReceived(line);
                            }
                        }
                    }
                }
            } catch (error) {
                // keepReading=true 인데 에러 발생 = 안드로이드에서 간헐적 스트림 끊김
                if (this.keepReading) {
                    console.warn('[Serial] readLoop 에러 (재시도 예정):', error.message);
                }
            } finally {
                // 스트림 리소스를 반드시 정리한 후 다음 반복으로
                try {
                    this.reader.releaseLock();
                } catch(e) {}

                // 이전 pipeTo 스트림이 완전히 닫힐 때까지 대기 (잠금 방지 핵심)
                if (this.readableStreamClosed) {
                    try {
                        await this.readableStreamClosed;
                    } catch(e) {}
                    this.readableStreamClosed = null;
                }
            }

            // keepReading=true 이면 잠시 후 자동 재시도 (안드로이드 일시적 끊김 복구)
            if (this.keepReading) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        this.log('[readLoop] 수신 루프 완전 종료');
    }
};


