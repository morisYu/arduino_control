/**
 * app.js
 * 링크보드(LinkBoard) 메인 애플리케이션 로직
 * 키트 전환, 동적 UI 생성, 시리얼 통신 이벤트 바인딩을 담당합니다.
 */
// avrbro는 펌웨어 업로드 시에만 필요하므로 지연 로드
let avrbro = null;

// --- Web Serial Polyfill 초기화 (안드로이드/비호환 브라우저 지원) ---
const isAndroid = /Android/i.test(navigator.userAgent);
(async () => {
    if (!navigator.serial || isAndroid) {
        if (navigator.usb) {
            try {
                const { serial: polyfillSerial } = await Promise.race([
                    import('https://unpkg.com/web-serial-polyfill@1.0.15/dist/serial.js'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Polyfill 로드 타임아웃 (5초)')), 5000))
                ]);
                
                const patchPort = (port) => {
                    if (port && !port._isPatchedForAndroid) {
                        const originalOpen = port.open.bind(port);
                        port.open = async function(openOptions) {
                            const usbDev = port.usbDevice_ || port._device || port.device_;
                            if (usbDev && typeof usbDev.reset === 'function') {
                                try {
                                    await usbDev.reset();
                                } catch(e) {}
                            }
                            return await originalOpen(openOptions);
                        };
                        port._isPatchedForAndroid = true;
                    }
                    return port;
                };

                const originalRequestPort = polyfillSerial.requestPort.bind(polyfillSerial);
                polyfillSerial.requestPort = async function(options) {
                    return patchPort(await originalRequestPort(options));
                };

                const originalGetPorts = polyfillSerial.getPorts.bind(polyfillSerial);
                polyfillSerial.getPorts = async function() {
                    const ports = await originalGetPorts();
                    return ports.map(patchPort);
                };

                Object.defineProperty(navigator, 'serial', {
                    value: polyfillSerial,
                    writable: true,
                    configurable: true
                });
                console.log("[App] Web Serial Polyfill (WebUSB) 적용 완료.");
            } catch (e) {
                console.error("[App] Web Serial Polyfill 로드 실패:", e);
            }
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // 전역 모듈 가져오기
    const serial = window.ArduinoSerial;
    const hw = window.ArduinoHW;

    // --- 현재 키트 상태 ---
    let currentKitId = localStorage.getItem('arduino_current_kit') || 'smartfarm';
    window.currentKitId = currentKitId;
    let isConnected = false;
    let pumpHeartbeatInterval = null;

    // --- DOM 요소 참조 ---
    const kitSelectorBtn = document.getElementById('kit-selector-btn');
    const kitSelectorMenu = document.getElementById('kit-selector-menu');
    const kitSelectorLabel = document.getElementById('kit-selector-label');
    const btnConnect = document.getElementById('btn-connect');
    const btnConnectBle = document.getElementById('btn-connect-ble');
    const statusEl = document.getElementById('connection-status');
    const logEl = document.getElementById('serial-log');
    const btnClearLog = document.getElementById('btn-clear-log');
    const mainHeader = document.getElementById('main-header');

    // 센서 패널 관련
    const sensorCardsContainer = document.getElementById('sensor-cards-container');
    const noSensorMessage = document.getElementById('no-sensor-message');
    const sensorPanel = document.getElementById('sensor-panel');
    const controlPanel = document.getElementById('control-panel');
    const chartContainer = document.getElementById('chart-container');

    // 액추에이터 패널
    const actuatorCardsContainer = document.getElementById('actuator-cards-container');

    // 핀 설정 관련 UI
    const btnPinConfig = document.getElementById('btn-pin-config');
    const modalPinConfig = document.getElementById('pin-config-modal');
    const pinConfigContent = document.getElementById('pin-config-content');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSavePins = document.getElementById('btn-save-pins');

    // 펌웨어 업로드 관련 UI
    const btnInstallFw = document.getElementById('btn-install-fw');
    const modalFlash = document.getElementById('flash-modal');
    const flashProgressBar = document.getElementById('flash-progress-bar');
    const flashStatusText = document.getElementById('flash-status-text');
    const btnCloseFlash = document.getElementById('btn-close-flash');

    // --- 다크 모드 토글 ---
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const isDarkMode = localStorage.getItem('arduino_theme') === 'dark';
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    }
    
    btnThemeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('arduino_theme', isDark ? 'dark' : 'light');
        updateChartTheme();
    });

    // --- Chart.js 초기화 ---
    const ctx = document.getElementById('sensorChart').getContext('2d');
    const MAX_DATA_POINTS = 30;
    let sensorData = {};
    let activeSensor = null;
    let timeLabels = [];
    let sensorValues = {}; // 실시간 센서 값 저장
    
    // 블록코딩(실행) 시 센서값을 가져오기 위한 전역 함수 등록
    hw.getSensorValue = function(sensorId) {
        return sensorValues[sensorId] !== undefined && sensorValues[sensorId] !== null ? sensorValues[sensorId] : 0;
    };

    let sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [{
                label: '',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { display: false },
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(156, 163, 175, 0.2)' },
                    ticks: { color: '#6b7280' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    function updateChartTheme() {
        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(156, 163, 175, 0.2)';
        const tickColor = isDark ? '#94a3b8' : '#6b7280';
        sensorChart.options.scales.y.grid.color = gridColor;
        sensorChart.options.scales.y.ticks.color = tickColor;
        sensorChart.update();
    }
    updateChartTheme();

    // ============================================================
    // 키트 선택기 초기화
    // ============================================================
    function initKitSelector() {
        if (!kitSelectorMenu || !kitSelectorLabel) return;
        
        kitSelectorMenu.innerHTML = '';
        const kits = window.KitRegistry.getAll();
        
        Object.keys(kits).forEach(kitId => {
            const kit = kits[kitId];
            const btn = document.createElement('button');
            const isSelected = kitId === currentKitId;
            
            btn.className = `w-full text-left px-4 py-2.5 text-sm font-bold transition flex items-center gap-3 ${isSelected ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-700/50' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`;
            btn.innerHTML = `<span class="text-base">${kit.icon}</span> <span>${kit.name}</span>`;
            
            btn.addEventListener('click', () => {
                kitSelectorMenu.classList.add('hidden');
                if (kitId !== currentKitId) {
                    switchKit(kitId);
                    initKitSelector(); // 선택 상태 갱신을 위해 다시 렌더링
                }
            });
            
            kitSelectorMenu.appendChild(btn);
            
            if (isSelected) {
                kitSelectorLabel.innerHTML = `<span class="mr-1">${kit.icon}</span> ${kit.name}`;
            }
        });
    }

    if (kitSelectorBtn && kitSelectorMenu) {
        kitSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            kitSelectorMenu.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!kitSelectorBtn.contains(e.target) && !kitSelectorMenu.contains(e.target)) {
                kitSelectorMenu.classList.add('hidden');
            }
        });
    }

    // ============================================================
    // 키트 전환 핵심 함수
    // ============================================================
    function switchKit(kitId) {
        const kit = window.KitRegistry.get(kitId);
        if (!kit) return;

        currentKitId = kitId;
        window.currentKitId = kitId;
        localStorage.setItem('arduino_current_kit', kitId);
        hw.setCurrentKit(kitId);

        // 헤더 테마 변경
        updateHeaderTheme(kit);

        // 센서 UI 생성
        renderSensorCards(kit);

        // 액추에이터 UI 생성
        renderActuatorPanels(kit);

        // 핀 설정 모달 갱신
        renderPinConfigModal(kit);

        // 차트 초기화
        resetChart(kit);

        // 레이아웃 조정 (센서 없는 키트)
        adjustLayout(kit);

        // Blockly 블록 등록 및 toolbox 갱신
        if (window.registerKitBlocks) {
            window.registerKitBlocks(kit);
        }
        if (window.registerCategoryIcons && kit.categoryIcons) {
            window.registerCategoryIcons(kit.categoryIcons);
        }
        if (window.updateBlocklyToolbox) {
            window.updateBlocklyToolbox(kit);
        }
        if (window.loadBlocksForKit) {
            window.loadBlocksForKit();
        }

        // 키트별 이벤트 바인딩
        if (kit.bindActuatorEvents) {
            kit.bindActuatorEvents({
                hw, serial,
                isConnected: () => isConnected,
                kitId
            });
        }

        console.log(`[App] 키트 전환: ${kit.name} (${kitId})`);
    }

    // ============================================================
    // 헤더 테마 변경
    // ============================================================
    function updateHeaderTheme(kit) {
        // 기존 배경 클래스 제거
        mainHeader.className = mainHeader.className.replace(/bg-\w+-\d+/g, '').trim();
        // 새 배경 클래스 추가
        const colorClass = kit.headerColorClass || 'bg-indigo-50 dark:bg-slate-800';
        colorClass.split(' ').forEach(cls => mainHeader.classList.add(cls));
        // 기본 클래스 보장
        ['text-gray-900', 'dark:text-white', 'h-16', 'flex', 'justify-between', 'items-center', 'px-6', 'shadow-sm', 'flex-shrink-0', 'z-10', 'transition-colors', 'duration-300', 'border-b', 'border-gray-200', 'dark:border-slate-700/50'].forEach(cls => {
            if (!mainHeader.classList.contains(cls)) {
                mainHeader.classList.add(cls);
            }
        });
    }

    // ============================================================
    // 센서 카드 동적 생성
    // ============================================================
    function renderSensorCards(kit) {
        sensorCardsContainer.innerHTML = '';
        sensorData = {};
        sensorValues = {};
        
        if (!kit.sensors || kit.sensors.length === 0) {
            sensorCardsContainer.classList.add('hidden');
            return;
        }
        
        sensorCardsContainer.classList.remove('hidden');
        // 센서 수에 따라 그리드 컬럼 조정
        const cols = Math.min(kit.sensors.length, 4);
        sensorCardsContainer.className = `grid grid-cols-${cols} gap-4 flex-shrink-0`;

        kit.sensors.forEach((sensor, idx) => {
            // 센서 데이터 초기화
            sensorData[sensor.id] = {
                label: sensor.label,
                data: [],
                color: sensor.color,
                borderColor: sensor.color,
                bgColor: sensor.color.startsWith('#') ? sensor.color + '1a' : sensor.color.replace(')', ', 0.1)').replace('rgb', 'rgba')
            };
            sensorValues[sensor.id] = null;

            const card = document.createElement('div');
            card.className = `sensor-card cursor-pointer bg-white dark:bg-slate-800 rounded-xl p-4 flex flex-col items-center justify-center border-2 shadow-sm transition transform hover:-translate-y-1`;
            card.dataset.sensor = sensor.id;
            
            if (idx === 0) {
                card.classList.add('active', 'shadow-md');
                card.style.borderColor = sensor.color;
                activeSensor = sensor.id;
            } else {
                card.classList.add('border-transparent');
            }

            card.innerHTML = `
                <span class="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">${sensor.icon ? sensor.icon + ' ' : ''}${sensor.label}</span>
                <div class="text-3xl font-extrabold" style="color: ${sensor.color}">
                    <span id="sensor-val-${sensor.id}">--</span><span class="text-lg">${sensor.unit || ''}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                // 모든 카드 비활성화
                sensorCardsContainer.querySelectorAll('.sensor-card').forEach(c => {
                    c.classList.remove('active', 'shadow-md');
                    c.classList.add('border-transparent', 'shadow-sm');
                    c.style.borderColor = 'transparent';
                });
                // 클릭된 카드 활성화
                card.classList.add('active', 'shadow-md');
                card.classList.remove('border-transparent', 'shadow-sm');
                card.style.borderColor = sensor.color;

                activeSensor = sensor.id;
                const sData = sensorData[activeSensor];
                if (sData) {
                    sensorChart.data.datasets[0].label = sData.label;
                    sensorChart.data.datasets[0].data = sData.data;
                    sensorChart.data.datasets[0].borderColor = sData.borderColor;
                    sensorChart.data.datasets[0].backgroundColor = sData.bgColor;

                    const chartTitle = document.getElementById('chart-title');
                    if (chartTitle) {
                        chartTitle.innerHTML = `<div class="w-3 h-3 rounded-full" style="background-color:${sData.color}"></div> ${sData.label} 실시간 모니터링`;
                    }
                    sensorChart.update();
                }
            });

            sensorCardsContainer.appendChild(card);
        });
    }

    // ============================================================
    // 레이아웃 조정 (센서 없는 키트)
    // ============================================================
    function adjustLayout(kit) {
        if (!kit.sensors || kit.sensors.length === 0) {
            // 센서가 없으면 센서 패널 숨기고 제어 패널 전체 폭
            sensorPanel.classList.add('hidden');
            controlPanel.classList.remove('w-1/2');
            controlPanel.classList.add('w-full');
            noSensorMessage.classList.remove('hidden');
            chartContainer.classList.add('hidden');
        } else {
            sensorPanel.classList.remove('hidden');
            controlPanel.classList.remove('w-full');
            controlPanel.classList.add('w-1/2');
            noSensorMessage.classList.add('hidden');
            chartContainer.classList.remove('hidden');
        }
    }

    // ============================================================
    // 액추에이터 패널 동적 생성
    // ============================================================
    function renderActuatorPanels(kit) {
        actuatorCardsContainer.innerHTML = '';

        if (!kit.actuators || kit.actuators.length === 0) return;

        kit.actuators.forEach(actuator => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm flex-shrink-0 transition-colors';

            let controlsHtml = '';
            
            // 헤더 (라벨 + 상태)
            let headerHtml = `<div class="flex justify-between items-center mb-3">
                <h3 class="font-bold text-gray-700 dark:text-gray-200 text-base">${actuator.label}</h3>`;
            if (actuator.statusId) {
                headerHtml += `<span id="${actuator.statusId}" class="text-sm px-2 py-1 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded font-bold">OFF</span>`;
            }
            headerHtml += `</div>`;

            // 컨트롤 렌더링
            if (actuator.controls) {
                controlsHtml += '<div class="flex items-center gap-4">';
                actuator.controls.forEach(ctrl => {
                    if (ctrl.type === 'slider') {
                        const suffix = ctrl.displaySuffix || '';
                        controlsHtml += `
                            <div class="flex-1">
                                <label class="text-xs font-bold text-gray-500 dark:text-gray-400 flex justify-between mb-1">
                                    <span>${ctrl.label}</span>
                                    <span id="${ctrl.id}-val">${ctrl.value}${suffix}</span>
                                </label>
                                <input type="range" id="${ctrl.id}" min="${ctrl.min}" max="${ctrl.max}" step="${ctrl.step}" value="${ctrl.value}" class="w-full accent-indigo-500 h-2">
                            </div>`;
                    } else if (ctrl.type === 'color-picker') {
                        controlsHtml += `<input type="color" id="${ctrl.id}" class="w-14 h-10 rounded cursor-pointer border-0 p-0 bg-transparent flex-shrink-0" value="${ctrl.value}">`;
                    } else if (ctrl.type === 'button-group') {
                        controlsHtml += '<div class="flex gap-2">';
                        ctrl.buttons.forEach(btn => {
                            const colorMap = {
                                blue: 'bg-blue-600 text-white hover:bg-blue-700',
                                red: 'bg-red-500 text-white hover:bg-red-600',
                                purple: 'bg-purple-500 text-white hover:bg-purple-600',
                                violet: 'bg-violet-500 text-white hover:bg-violet-600',
                                gray: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600'
                            };
                            const btnClass = colorMap[btn.color] || colorMap.gray;
                            controlsHtml += `<button id="${btn.id}" class="${btnClass} text-sm font-bold px-4 py-3 rounded-lg transition shadow">${btn.label}</button>`;
                        });
                        controlsHtml += '</div>';
                    }
                });
                controlsHtml += '</div>';
            }

            card.innerHTML = headerHtml + controlsHtml;
            
            // 키트별 추가 UI 렌더링 (해당 카드 내부에 렌더링)
            if (kit.renderActuatorExtras) {
                kit.renderActuatorExtras(card, actuator.id);
            }
            
            actuatorCardsContainer.appendChild(card);
        });
    }

    // ============================================================
    // 핀 설정 모달 동적 생성
    // ============================================================
    function renderPinConfigModal(kit) {
        pinConfigContent.innerHTML = '';

        if (!kit.pinConfig || !kit.pinConfig.groups) return;

        // 저장된 핀 설정 로드
        const savedPins = localStorage.getItem('arduino_pins_' + currentKitId);
        let savedConfig = {};
        if (savedPins) {
            try { savedConfig = JSON.parse(savedPins); } catch(e) {}
        }

        kit.pinConfig.groups.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-100 dark:border-slate-700';
            groupDiv.innerHTML = `<h3 class="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 dark:border-slate-600 pb-2">${group.label}</h3>`;
            
            const gridDiv = document.createElement('div');
            gridDiv.className = `grid grid-cols-2 gap-x-6 gap-y-4`;

            group.pins.forEach(pin => {
                const pinDiv = document.createElement('div');
                pinDiv.className = 'flex flex-col';
                const value = savedConfig[pin.id] || pin.default;

                if (pin.type === 'select' && pin.options) {
                    let optionsHtml = pin.options.map(opt => 
                        `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('');
                    pinDiv.innerHTML = `
                        <label class="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">${pin.label}</label>
                        <select id="pin-${pin.id}" class="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors">${optionsHtml}</select>`;
                } else {
                    pinDiv.innerHTML = `
                        <label class="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">${pin.label}</label>
                        <input type="${pin.type}" id="pin-${pin.id}" class="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" value="${value}">`;
                }

                gridDiv.appendChild(pinDiv);
            });

            groupDiv.appendChild(gridDiv);
            pinConfigContent.appendChild(groupDiv);
        });
    }

    // ============================================================
    // 차트 초기화
    // ============================================================
    function resetChart(kit) {
        timeLabels.length = 0;
        Object.keys(sensorData).forEach(key => {
            sensorData[key].data.length = 0;
        });

        if (kit.sensors && kit.sensors.length > 0) {
            const firstSensor = kit.sensors[0];
            activeSensor = firstSensor.id;
            const sData = sensorData[activeSensor];
            if (sData) {
                sensorChart.data.datasets[0].label = sData.label;
                sensorChart.data.datasets[0].data = sData.data;
                sensorChart.data.datasets[0].borderColor = sData.borderColor;
                sensorChart.data.datasets[0].backgroundColor = sData.bgColor;

                const chartTitle = document.getElementById('chart-title');
                if (chartTitle) {
                    chartTitle.innerHTML = `<div class="w-3 h-3 rounded-full" style="background-color:${sData.color}"></div> ${sData.label} 실시간 모니터링`;
                }
            }
        }
        sensorChart.update();
    }

    let sensorPingInterval = null;

    // ============================================================
    // UI 업데이트 함수
    // ============================================================
    function updateConnectionUI(connected, mode = 'wired') {
        isConnected = connected;

        // 센서 자동 갱신(PING) 타이머 관리
        if (sensorPingInterval) {
            clearInterval(sensorPingInterval);
            sensorPingInterval = null;
        }

        if (connected) {
            if (mode === 'wired') {
                btnConnect.textContent = '연결 해제';
                btnConnect.classList.remove('hidden');
                if (btnConnectBle) btnConnectBle.classList.add('hidden');
                statusEl.textContent = '유선 연결됨';
            } else {
                if (btnConnectBle) btnConnectBle.textContent = '연결 해제';
                if (btnConnectBle) btnConnectBle.classList.remove('hidden');
                btnConnect.classList.add('hidden');
                statusEl.textContent = 'BLE 연결됨';
            }
            statusEl.classList.remove('bg-red-500/90', 'border-red-400/50');
            statusEl.classList.add('bg-emerald-500/90', 'border-emerald-400/50');

            // 0.4초마다 센서 데이터 요청 (학생들에게 실시간처럼 느껴지는 최적의 속도)
            sensorPingInterval = setInterval(() => {
                if (isConnected && window.ArduinoSerial) {
                    window.ArduinoSerial.sendCommand('PING\n');
                }
            }, 400);
        } else {
            btnConnect.textContent = '시리얼 연결';
            btnConnect.classList.remove('hidden');
            if (btnConnectBle) btnConnectBle.textContent = '블루투스 연결';
            if (btnConnectBle) btnConnectBle.classList.remove('hidden');
            statusEl.textContent = '연결 끊김';
            statusEl.classList.remove('bg-emerald-500/90', 'border-red-400/50');
            statusEl.classList.add('bg-red-500/90', 'border-red-400/50');
            
            // 센서 값 초기화
            const kit = window.KitRegistry.get(currentKitId);
            if (kit && kit.sensors) {
                kit.sensors.forEach(sensor => {
                    const el = document.getElementById(`sensor-val-${sensor.id}`);
                    if (el) el.textContent = '--';
                });
            }
        }
    }

    // ============================================================
    // 시리얼 통신 콜백 설정
    // ============================================================
    serial.onLog = (msg) => {
        const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        logEl.textContent += `[${time}] ${msg}\n`;
        logEl.scrollTop = logEl.scrollHeight;
    };

    serial.onDisconnect = () => {
        if (pumpHeartbeatInterval) { clearInterval(pumpHeartbeatInterval); pumpHeartbeatInterval = null; }
        if (typeof sensorPingInterval !== 'undefined' && sensorPingInterval) { clearInterval(sensorPingInterval); sensorPingInterval = null; }
        updateConnectionUI(false);
    };

    // 데이터 수신 콜백 - 키트의 parseData에 위임
    serial.onDataReceived = (data) => {
        const kit = window.KitRegistry.get(currentKitId);
        if (!kit || !kit.parseData) return;

        const updated = kit.parseData(data, sensorValues);

        if (updated) {
            // 센서 값 표시 업데이트
            Object.keys(sensorValues).forEach(sensorId => {
                const val = sensorValues[sensorId];
                if (val !== null && val !== undefined) {
                    const el = document.getElementById(`sensor-val-${sensorId}`);
                    if (el) el.textContent = val;

                    // 차트 데이터 추가
                    if (sensorData[sensorId]) {
                        sensorData[sensorId].data.push(val);
                    }
                }
            });

            // 시간 레이블 추가
            timeLabels.push('');
            if (timeLabels.length > MAX_DATA_POINTS) {
                timeLabels.shift();
                Object.keys(sensorData).forEach(key => {
                    if (sensorData[key].data.length > MAX_DATA_POINTS) {
                        sensorData[key].data.shift();
                    }
                });
            }
            sensorChart.update();
        }
    };

    // ============================================================
    // 이벤트 리스너 바인딩
    // ============================================================
    
    // 연결 버튼
    btnConnect.addEventListener('click', async () => {
        if (!isConnected) {
            try {
                window.ArduinoCommManager.setMode('wired');
                // 사용자 제스처 유실 방지를 위해 Proxy 대신 직접 호출
                const success = await window.ArduinoSerialWired.connect();
                if (success) {
                    updateConnectionUI(true, 'wired');
                    
                    // 연결 성공 시 키트별 초기화
                    const kit = window.KitRegistry.get(currentKitId);
                    if (kit && kit.onConnect) {
                        setTimeout(() => {
                            if (isConnected) {
                                kit.onConnect(hw);
                            }
                        }, 2500);
                    }
                }
            } catch (error) {
                console.error("연결 에러 발생:", error);
                serial.log('연결 실패: ' + (error.message || '알 수 없는 에러'));
            }
        } else {
            await serial.disconnect();
        }
    });

    if (btnConnectBle) {
        const bleModal = document.getElementById('ble-name-prompt-modal');
        const bleInput = document.getElementById('ble-name-prompt-input');
        const btnBleOk = document.getElementById('btn-ble-prompt-ok');
        const btnBleCancel = document.getElementById('btn-ble-prompt-cancel');

        btnConnectBle.addEventListener('click', async () => {
            if (!isConnected) {
                bleInput.value = '';
                bleModal.classList.remove('hidden');
                bleInput.focus();
            } else {
                await serial.disconnect();
            }
        });

        btnBleCancel.addEventListener('click', () => {
            bleModal.classList.add('hidden');
        });

        btnBleOk.addEventListener('click', async () => {
            bleModal.classList.add('hidden');
            const deviceName = bleInput.value.trim();
            
            try {
                window.ArduinoCommManager.setMode('ble');
                // 사용자 제스처 유실 방지를 위해 Proxy 대신 직접 호출
                const success = await window.ArduinoBLE.connect(deviceName);
                if (success) {
                    updateConnectionUI(true, 'ble');
                    
                    // 연결 성공 시 키트별 초기화
                    const kit = window.KitRegistry.get(currentKitId);
                    if (kit && kit.onConnect) {
                        setTimeout(() => {
                            if (isConnected) {
                                kit.onConnect(hw);
                            }
                        }, 2500);
                    }
                }
            } catch (error) {
                console.error("BLE 연결 에러 발생:", error);
                serial.log('BLE 연결 실패: ' + (error.message || '알 수 없는 에러'));
            }
        });
    }

    // 로그 지우기
    btnClearLog.addEventListener('click', () => {
        logEl.textContent = '';
    });

    // --- 핀 설정 모달 이벤트 ---
    btnPinConfig.addEventListener('click', () => {
        modalPinConfig.classList.remove('hidden');
    });

    btnCloseModal.addEventListener('click', () => {
        modalPinConfig.classList.add('hidden');
    });

    modalPinConfig.addEventListener('click', (e) => {
        if (e.target === modalPinConfig) {
            modalPinConfig.classList.add('hidden');
        }
    });

    // 핀 설정 저장 및 전송
    btnSavePins.addEventListener('click', () => {
        const kit = window.KitRegistry.get(currentKitId);
        if (!kit || !kit.pinConfig || !kit.pinConfig.groups) return;

        const config = {};
        let hasEmpty = false;

        kit.pinConfig.groups.forEach(group => {
            group.pins.forEach(pin => {
                const el = document.getElementById(`pin-${pin.id}`);
                if (el) {
                    config[pin.id] = el.value.trim();
                    if (pin.type !== 'select' && config[pin.id] === '') {
                        hasEmpty = true;
                    }
                }
            });
        });

        if (hasEmpty) {
            alert('모든 핀 번호를 입력해주세요.');
            return;
        }

        localStorage.setItem('arduino_pins_' + currentKitId, JSON.stringify(config));

        // 블록 코딩 탭의 C 코드 미리보기 강제 갱신
        if (typeof window.updateCodePreview === 'function') {
            window.updateCodePreview({type: 'pin_update'});
        }

        if (isConnected && hw.sendPinConfig) {
            hw.sendPinConfig(config);
            // BLE 환경에서 DHT 센서(2초 간격 30ms 블로킹)와 긴 CFG 문자열 청크가 충돌하여 파싱이 무시되는 확률을 완전히 제거하기 위해
            // 시간차를 두고 2번 더 강제 발송하여 최소 1번은 100% 도달하도록 보장합니다.
            setTimeout(() => { if (isConnected) hw.sendPinConfig(config); }, 800);
            setTimeout(() => { if (isConnected) hw.sendPinConfig(config); }, 1600);
            
            setTimeout(() => {
                alert('핀 설정이 기기에 전송되었습니다.');
            }, 100);
        } else {
            alert('설정이 저장되었습니다. (기기와 연결되면 자동 적용됩니다)');
        }

        modalPinConfig.classList.add('hidden');
    });

    // --- 펌웨어 업로드 로직 ---
    btnInstallFw.addEventListener('click', async () => {
        if (/Android/i.test(navigator.userAgent)) {
            alert('⚠️ 안드로이드에서는 펌웨어 업로드가 지원되지 않습니다.\n\n펌웨어 업로드는 PC의 Chrome 브라우저에서 진행해 주세요.');
            return;
        }

        const kit = window.KitRegistry.get(currentKitId);
        if (!kit || !kit.firmware) {
            alert('이 키트에는 펌웨어가 설정되어 있지 않습니다.');
            return;
        }

        if (isConnected) {
            await serial.disconnect();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        modalFlash.classList.remove('hidden');
        btnCloseFlash.classList.add('hidden');
        flashProgressBar.style.width = '5%';
        flashStatusText.textContent = '펌웨어 파일(.hex) 다운로드 중...';

        try {
            if (!avrbro) {
                flashStatusText.textContent = 'avrbro 라이브러리 로딩 중...';
                try {
                    const module = await import('https://esm.sh/avrbro');
                    avrbro = module.default;
                } catch (loadErr) {
                    throw new Error('펌웨어 업로드 라이브러리(avrbro)를 불러오지 못했습니다.');
                }
            }

            const fwPath = `firmware/${kit.firmware}/${kit.firmware}.ino.hex`;
            const response = await fetch(fwPath + '?t=' + Date.now());
            if (!response.ok) {
                throw new Error(`펌웨어 파일을 찾을 수 없습니다. (${fwPath})`);
            }
            const data = await response.blob();
            
            const fileData = await new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(data);
            });
            const hexText = new TextDecoder("utf-8").decode(fileData);
            
            if (!hexText.trim().startsWith(':')) {
                throw new Error("올바른 아두이노 .hex 파일이 아닙니다.");
            }
            const hexBuffer = avrbro.parseHex(hexText);

            flashProgressBar.style.width = '30%';
            flashStatusText.textContent = '아두이노 포트 선택 창을 열고 있습니다...';

            const avrSerial = await avrbro.openSerial({ baudRate: 115200 });
            if (!avrSerial) {
                throw new Error('사용자가 포트 선택을 취소했습니다.');
            }

            flashProgressBar.style.width = '50%';
            flashStatusText.textContent = '아두이노 리셋 중...';

            await avrbro.reset(avrSerial);

            flashProgressBar.style.width = '70%';
            flashStatusText.textContent = '펌웨어 기록 중... (약 10~20초 소요)';

            const success = await avrbro.flash(avrSerial, hexBuffer, { boardName: 'uno', debug: true });
            
            await avrbro.closeSerial(avrSerial);

            if (success) {
                flashProgressBar.style.width = '100%';
                flashStatusText.textContent = '펌웨어 설치 완료! 자동 연결 중...';
                flashProgressBar.classList.replace('bg-blue-600', 'bg-emerald-500');
                
                await new Promise(r => setTimeout(r, 1500));
                
                window.ArduinoCommManager.setMode('wired');
                const connected = await window.ArduinoSerial.connect(avrSerial.port);
                if (connected) {
                    updateConnectionUI(true, 'wired');
                    flashStatusText.textContent = '펌웨어 설치 및 자동 연결 완료!';
                } else {
                    flashStatusText.textContent = '설치 완료. 수동으로 연결해주세요.';
                }
            } else {
                throw new Error('플래싱 도중 오류가 발생했습니다.');
            }

        } catch (error) {
            flashProgressBar.style.width = '100%';
            flashProgressBar.classList.replace('bg-blue-600', 'bg-red-500');
            flashStatusText.textContent = `업로드 실패: ${error.message}`;
            flashStatusText.classList.add('text-red-600');
        } finally {
            btnCloseFlash.classList.remove('hidden');
        }
    });

    btnCloseFlash.addEventListener('click', () => {
        modalFlash.classList.add('hidden');
        flashProgressBar.style.width = '0%';
        flashProgressBar.classList.replace('bg-emerald-500', 'bg-blue-600');
        flashProgressBar.classList.replace('bg-red-500', 'bg-blue-600');
        flashStatusText.classList.remove('text-red-600');
    });

    // 블록 코딩 실행 상태에 따른 제어 (전역 이벤트)
    window.addEventListener('blockly-run-state-changed', (e) => {
        const running = e.detail;
        
        // 대시보드의 제어부(액추에이터) 비활성화 (충돌 방지)
        const actuatorContainer = document.getElementById('actuator-cards-container');
        if (actuatorContainer) {
            const controls = actuatorContainer.querySelectorAll('button, input');
            controls.forEach(ctrl => {
                ctrl.disabled = running;
                if (running) {
                    ctrl.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    ctrl.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
        }
    });

    // ============================================================
    // 초기 키트 로드
    // ============================================================
    
    // KitRegistry에 등록된 키트가 있는지 확인
    if (!window.KitRegistry.get(currentKitId)) {
        currentKitId = window.KitRegistry.getDefaultId() || 'smartfarm';
    }

    initKitSelector();
    switchKit(currentKitId);
});
