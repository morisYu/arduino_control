/**
 * comm_manager.js
 * 유선(Web Serial)과 무선(Web Bluetooth) 통신 방식을 통합 관리하는 매니저
 */

window.ArduinoCommManager = {
    mode: 'wired', // 'wired' 또는 'ble'
    setMode: function(newMode) {
        this.mode = newMode;
        
        // 모드 전환 시 공통 이벤트 핸들러 동기화
        const active = this.mode === 'ble' ? window.ArduinoBLE : window.ArduinoSerialWired;
        const inactive = this.mode === 'ble' ? window.ArduinoSerialWired : window.ArduinoBLE;
        
        if (inactive && active) {
            if (inactive.onDataReceived) active.onDataReceived = inactive.onDataReceived;
            if (inactive.onLog) active.onLog = inactive.onLog;
            if (inactive.onDisconnect) active.onDisconnect = inactive.onDisconnect;
        }
    }
};

window.ArduinoSerial = new Proxy({}, {
    get: function(target, prop) {
        if (prop === 'then') return undefined; // Promise chain 방해 방지
        const provider = window.ArduinoCommManager.mode === 'ble' ? window.ArduinoBLE : window.ArduinoSerialWired;
        if (!provider) return undefined;
        
        const value = provider[prop];
        if (typeof value === 'function') {
            return value.bind(provider);
        }
        return value;
    },
    set: function(target, prop, value) {
        if (['onDataReceived', 'onLog', 'onDisconnect'].includes(prop)) {
            if (window.ArduinoSerialWired) window.ArduinoSerialWired[prop] = value;
            if (window.ArduinoBLE) window.ArduinoBLE[prop] = value;
        } else {
            const provider = window.ArduinoCommManager.mode === 'ble' ? window.ArduinoBLE : window.ArduinoSerialWired;
            if (provider) provider[prop] = value;
        }
        return true;
    }
});

// 기존 하위 호환성 유지
window.SmartFarmSerial = window.ArduinoSerial;
