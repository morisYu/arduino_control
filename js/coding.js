/**
 * coding.js
 * 블록 코딩 페이지의 UI 로직 및 코드 실행을 담당합니다.
 * 키트별 toolbox 카테고리는 동적으로 생성됩니다.
 */

// --- 1. Blockly Toolbox (도구상자) 정의 ---
/**
 * 현재 키트에 맞는 toolbox XML을 생성합니다.
 * @param {Object} kit - KitRegistry에서 가져온 키트 설정 객체 (null이면 공통 카테고리만)
 * @returns {string} toolbox XML 문자열
 */
function buildToolbox(kit) {
    // 공통 카테고리 (모든 키트에서 공유)
    let xml = `
<xml id="toolbox" style="display: none">
    <category name="이벤트" colour="#FFBF00">
        <block type="ard_start"></block>
    </category>
    <category name="논리" categorystyle="logic_category">
        <block type="controls_if"></block>
        <block type="logic_compare"></block>
        <block type="logic_operation"></block>
        <block type="logic_negate"></block>
        <block type="logic_boolean"></block>
    </category>
    <category name="반복" categorystyle="loop_category">
        <block type="ard_forever"></block>
        <block type="controls_repeat_ext">
            <value name="TIMES">
                <shadow type="math_number"><field name="NUM">10</field></shadow>
            </value>
        </block>
        <block type="controls_whileUntil"></block>
        <block type="ard_delay">
            <value name="SEC"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
        </block>
    </category>
    <category name="수학" categorystyle="math_category">
        <block type="math_number"></block>
        <block type="math_arithmetic">
            <value name="A"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <value name="B"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
        </block>
        <block type="math_single">
            <value name="NUM"><shadow type="math_number"><field name="NUM">9</field></shadow></value>
        </block>
        <block type="math_trig">
            <value name="NUM"><shadow type="math_number"><field name="NUM">45</field></shadow></value>
        </block>
        <block type="math_constant"></block>
        <block type="math_number_property">
            <value name="NUMBER_TO_CHECK"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        </block>
        <block type="math_round">
            <value name="NUM"><shadow type="math_number"><field name="NUM">3.1</field></shadow></value>
        </block>
        <block type="math_on_list"></block>
        <block type="math_modulo">
            <value name="DIVIDEND"><shadow type="math_number"><field name="NUM">64</field></shadow></value>
            <value name="DIVISOR"><shadow type="math_number"><field name="NUM">10</field></shadow></value>
        </block>
        <block type="math_constrain">
            <value name="VALUE"><shadow type="math_number"><field name="NUM">50</field></shadow></value>
            <value name="LOW"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <value name="HIGH"><shadow type="math_number"><field name="NUM">100</field></shadow></value>
        </block>
        <block type="math_random_int">
            <value name="FROM"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
            <value name="TO"><shadow type="math_number"><field name="NUM">100</field></shadow></value>
        </block>
        <block type="math_random_float"></block>
    </category>
    <category name="문자열" categorystyle="text_category">
        <block type="text"></block>
        <block type="text_join"></block>
        <block type="text_append">
            <value name="TEXT"><shadow type="text"></shadow></value>
        </block>
        <block type="text_length">
            <value name="VALUE"><shadow type="text"><field name="TEXT">abc</field></shadow></value>
        </block>
        <block type="text_isEmpty">
            <value name="VALUE"><shadow type="text"><field name="TEXT"></field></shadow></value>
        </block>
        <block type="text_indexOf">
            <value name="VALUE"><block type="variables_get"><field name="VAR">text</field></block></value>
            <value name="FIND"><shadow type="text"><field name="TEXT">abc</field></shadow></value>
        </block>
        <block type="text_charAt">
            <value name="VALUE"><block type="variables_get"><field name="VAR">text</field></block></value>
        </block>
        <block type="text_getSubstring">
            <value name="STRING"><block type="variables_get"><field name="VAR">text</field></block></value>
        </block>
        <block type="text_changeCase">
            <value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow></value>
        </block>
        <block type="text_trim">
            <value name="TEXT"><shadow type="text"><field name="TEXT">abc</field></shadow></value>
        </block>
    </category>
    <category name="리스트" categorystyle="list_category">
        <block type="lists_create_with"><mutation items="0"></mutation></block>
        <block type="lists_create_with"></block>
        <block type="lists_repeat">
            <value name="NUM"><shadow type="math_number"><field name="NUM">5</field></shadow></value>
        </block>
        <block type="lists_length"></block>
        <block type="lists_isEmpty"></block>
        <block type="lists_indexOf">
            <value name="VALUE"><block type="variables_get"><field name="VAR">list</field></block></value>
        </block>
        <block type="lists_getIndex">
            <value name="VALUE"><block type="variables_get"><field name="VAR">list</field></block></value>
        </block>
        <block type="lists_setIndex">
            <value name="LIST"><block type="variables_get"><field name="VAR">list</field></block></value>
        </block>
        <block type="lists_getSublist">
            <value name="LIST"><block type="variables_get"><field name="VAR">list</field></block></value>
        </block>
        <block type="lists_split">
            <value name="DELIM"><shadow type="text"><field name="TEXT">,</field></shadow></value>
        </block>
        <block type="lists_sort"></block>
    </category>
    <category name="변수" categorystyle="variable_category" custom="VARIABLE"></category>
    <category name="함수" categorystyle="procedure_category" custom="PROCEDURE"></category>`;

    // 키트 전용 카테고리 추가
    if (kit && kit.toolboxCategories) {
        kit.toolboxCategories.forEach(catXml => {
            xml += '\n    ' + catXml;
        });
    }

    // 인공지능(AI) 카테고리 추가
    xml += `
    <category name="인공지능(AI)" colour="#e83e8c">
        <block type="ai_tts_setup"></block>
        <block type="ai_tts">
            <value name="TEXT">
                <shadow type="text">
                    <field name="TEXT">안녕하세요</field>
                </shadow>
            </value>
        </block>
        <block type="ai_hand_start"></block>
        <block type="ai_hand_stop"></block>
        <block type="ai_hand_recognize"></block>
        <block type="ai_hand_is_gesture"></block>
        <block type="ai_hand_is_folded"></block>
        <block type="ai_hand_get_angle"></block>
    </category>`;
    xml += `
    <category name="빈칸"></category>
</xml>`;

    // 태블릿 환경(내비게이션 바 등)을 위해 블록 목록의 가장 하단에 여백 추가
    // custom 속성이 있는 카테고리(변수, 함수 등)와 빈칸 카테고리는 제외
    xml = xml.replace(/(<category[^>]*>)([\s\S]*?)<\/category>/gi, function(match, openTag, content) {
        if (openTag.includes('custom=') || openTag.includes('name="빈칸"')) {
            return match;
        }
        return openTag + content + '        <sep gap="96"></sep>\n    </category>';
    });

    return xml;
}
// --- 2. 초기화 및 이벤트 리스너 ---
let workspace;
let isRunning = false;
let executionAbortController = null;

function getBlockStorageKey() {
    const kitId = localStorage.getItem('arduino_current_kit') || 'smartfarm';
    return 'arduino_blocks_' + kitId;
}

document.addEventListener('DOMContentLoaded', () => {
    
    // 코드 미리보기 토글 로직
    const btnTogglePreview = document.getElementById('btn-toggle-preview');
    const previewSection = document.getElementById('preview-section');
    const previewResizer = document.getElementById('preview-resizer');
    
    if (btnTogglePreview && previewSection) {
        btnTogglePreview.addEventListener('click', () => {
            previewSection.classList.toggle('hidden');
            if (previewResizer) previewResizer.classList.toggle('hidden');
            
            if (previewSection.classList.contains('hidden')) {
                btnTogglePreview.classList.add('bg-gray-200', 'dark:bg-slate-700');
                btnTogglePreview.classList.remove('bg-white', 'dark:bg-slate-800');
            } else {
                btnTogglePreview.classList.remove('bg-gray-200', 'dark:bg-slate-700');
                btnTogglePreview.classList.add('bg-white', 'dark:bg-slate-800');
            }
            if (workspace) {
                setTimeout(() => Blockly.svgResize(workspace), 50);
            }
        });
    }

    // 미리보기 창 리사이즈 (드래그) 로직
    if (previewResizer && previewSection) {
        let isResizing = false;
        
        previewResizer.style.touchAction = 'none'; // 태블릿 등에서 스크롤 간섭 방지

        previewResizer.addEventListener('pointerdown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            previewSection.style.transition = 'none'; // 드래그 중 부드러운 전환 끄기
            previewResizer.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        document.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            // 윈도우 우측 끝에서 마우스 X 좌표까지의 거리를 계산 (패딩 및 갭 고려)
            const newWidth = document.body.clientWidth - e.clientX - 16;
            if (newWidth > 150 && newWidth < document.body.clientWidth * 0.7) {
                previewSection.style.width = newWidth + 'px';
                if (workspace) Blockly.svgResize(workspace);
            }
        });

        const stopResize = (e) => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                previewSection.style.transition = ''; // Tailwind transition 클래스 복구
                if (e.pointerId) {
                    try { previewResizer.releasePointerCapture(e.pointerId); } catch(err){}
                }
            }
        };

        document.addEventListener('pointerup', stopResize);
        document.addEventListener('pointercancel', stopResize);
    }

    // 탭 전환 로직
    const tabDashboard = document.getElementById('tab-dashboard');
    const tabCoding = document.getElementById('tab-coding');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCoding = document.getElementById('view-coding');
    
    // 모바일/태블릿용 뷰 전환 버튼
    const btnViewToggle = document.getElementById('btn-view-toggle');
    const iconDash = document.getElementById('icon-view-dashboard');
    const textDash = document.getElementById('text-view-dashboard');
    const iconCode = document.getElementById('icon-view-coding');
    const textCode = document.getElementById('text-view-coding');

    if (btnViewToggle) {
        btnViewToggle.addEventListener('click', () => {
            if (!viewDashboard.classList.contains('hidden')) {
                tabCoding.click();
            } else {
                tabDashboard.click();
            }
        });
    }
    
    tabDashboard.addEventListener('click', () => {
        // 스타일 토글
        tabDashboard.className = 'text-sm font-bold px-6 py-2 rounded-full shadow-sm transition backdrop-blur-sm bg-white/80 dark:bg-white/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-white';
        tabCoding.className = 'text-sm font-bold px-6 py-2 rounded-full transition bg-transparent text-gray-500 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent';
        
        // 뷰 토글
        viewDashboard.classList.remove('hidden');
        viewCoding.classList.add('hidden');
        viewCoding.classList.remove('flex');
        
        // 토글 버튼 UI 갱신
        if (btnViewToggle) {
            iconDash.classList.remove('hidden'); iconDash.classList.add('block');
            textDash.classList.remove('hidden'); textDash.classList.add('block');
            iconCode.classList.remove('block'); iconCode.classList.add('hidden');
            textCode.classList.remove('block'); textCode.classList.add('hidden');
        }
    });

    tabCoding.addEventListener('click', () => {
        // 스타일 토글
        tabCoding.className = 'text-sm font-bold px-6 py-2 rounded-full shadow-sm transition backdrop-blur-sm bg-white/80 dark:bg-white/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-white';
        tabDashboard.className = 'text-sm font-bold px-6 py-2 rounded-full transition bg-transparent text-gray-500 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10 border border-transparent';
        
        // 뷰 토글
        viewDashboard.classList.add('hidden');
        viewCoding.classList.remove('hidden');
        viewCoding.classList.add('flex');
        
        // 토글 버튼 UI 갱신
        if (btnViewToggle) {
            iconDash.classList.remove('block'); iconDash.classList.add('hidden');
            textDash.classList.remove('block'); textDash.classList.add('hidden');
            iconCode.classList.remove('hidden'); iconCode.classList.add('block');
            textCode.classList.remove('hidden'); textCode.classList.add('block');
        }
        
        // Blockly 창 리사이즈 (숨겨져 있다가 나타날 때 크기 재계산 필요)
        if (workspace) {
            Blockly.svgResize(workspace);
        }
    });

    // --- Blockly 기본 문구(우클릭 메뉴) 커스터마이징 ---
    if (Blockly.Msg) {
        Blockly.Msg['DUPLICATE_BLOCK'] = '복제';
        Blockly.Msg['DELETE_BLOCK'] = '블록 삭제';
        Blockly.Msg['DELETE_X_BLOCKS'] = '블록 삭제';
    }

    // "복제" 시 하위 블록(연결된 다음 블록들)까지 모두 포함하도록 기본 동작 덮어쓰기
    const duplicateItem = Blockly.ContextMenuRegistry.registry.getItem('blockDuplicate');
    if (duplicateItem) {
        duplicateItem.callback = function(scope) {
            if (scope.block) {
                // 직렬화 옵션을 통해 하위 블록(next)까지 포함하여 저장
                const state = Blockly.serialization.blocks.save(scope.block, {
                    addCoordinates: true,
                    addNextBlocks: true // 핵심: 하위 블록까지 복제
                });
                
                // 위치 이동 (기존 복제 동작과 유사하게 살짝 우측 하단으로)
                if (state.y !== undefined && state.x !== undefined) {
                    state.x += 40;
                    state.y += 40;
                } else {
                    // 자식 블록을 우클릭해서 복제하는 경우 좌표가 누락될 수 있으므로 절대 좌표 계산
                    const coords = scope.block.getRelativeToSurfaceXY();
                    state.x = coords.x + 40;
                    state.y = coords.y + 40;
                }
                
                // 실행 취소(Undo) 시 한 번에 취소되도록 그룹화
                Blockly.Events.setGroup(true);
                const newBlock = Blockly.serialization.blocks.append(state, scope.block.workspace);
                newBlock.select();
                Blockly.Events.setGroup(false);
            }
        };
    }

    // --- "이미지로 다운로드" 우클릭 메뉴 추가 ---
    const downloadImageItem = {
        displayText: '이미지로 다운로드 (PNG)',
        preconditionFn: function(scope) {
            return 'enabled'; // 항상 활성화
        },
        callback: function(scope) {
            downloadBlockAsImage(scope.block);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'downloadBlockImage',
        weight: 100, // 메뉴의 맨 아래쪽에 배치
    };
    // 기존에 등록된 것이 있다면 해제 후 재등록
    if (Blockly.ContextMenuRegistry.registry.getItem('downloadBlockImage')) {
        Blockly.ContextMenuRegistry.registry.unregister('downloadBlockImage');
    }
    Blockly.ContextMenuRegistry.registry.register(downloadImageItem);

    // Blockly 주입 (Injection) - 렌더러는 기본으로 두어 크기를 줄이고, 테마는 Zelos로 설정해 밝은 색상 유지
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: buildToolbox(null),
        theme: Blockly.Themes ? Blockly.Themes.Zelos : undefined,
        grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
        trashcan: true,
        move: {
            scrollbars: true,
            drag: true,
            wheel: true
        },
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
        }
    });

    /**
     * 키트 변경 시 Blockly toolbox를 업데이트합니다.
     * @param {Object} kit - 키트 설정 객체
     */
    window.updateBlocklyToolbox = function(kit) {
        if (workspace) {
            workspace.updateToolbox(buildToolbox(kit));
        }
    };

    /**
     * Blockly 워크스페이스를 초기화합니다 (키트 전환 시).
     */
    window.clearBlocklyWorkspace = function() {
        if (workspace) {
            workspace.clear();
        }
    };

    /**
     * 키트별로 저장된 블록을 로드합니다.
     */
    window.loadBlocksForKit = function() {
        if (!workspace) return;
        workspace.clear();
        const saved = localStorage.getItem(getBlockStorageKey());
        if (saved) {
            try {
                Blockly.serialization.workspaces.load(JSON.parse(saved), workspace);
            } catch(e) {
                console.error('저장된 블록 로드 실패:', e);
            }
        }
    };

    // --- 자동 저장 & 복구 시스템 ---
    const indicator = document.getElementById('auto-save-indicator');
    let saveTimeout = null;

    // 1. 초기 로드 (자동 복구)
    window.loadBlocksForKit();

    // 실시간 코드 변환 이벤트 연결 및 디바운싱 자동 저장
    workspace.addChangeListener((e) => {
        // 기존 아두이노 코드 변환 업데이트
        updateCodePreview(e);

        // UI 이벤트(선택, 클릭 등)는 저장 감지에서 제외
        if (e.isUiEvent) return;

        // 상태 표시: 저장 중...
        if (indicator) {
            indicator.textContent = '저장 중...';
            indicator.classList.remove('opacity-0');
            indicator.classList.replace('text-gray-500', 'text-amber-500');
            indicator.classList.replace('dark:text-gray-300', 'dark:text-amber-400');
        }

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            try {
                const state = Blockly.serialization.workspaces.save(workspace);
                localStorage.setItem(getBlockStorageKey(), JSON.stringify(state));
                
                // 상태 표시: 저장 완료
                if (indicator) {
                    indicator.textContent = '✔️ 자동 저장됨';
                    indicator.classList.replace('text-amber-500', 'text-gray-500');
                    indicator.classList.replace('dark:text-amber-400', 'dark:text-gray-300');
                    
                    // 3초 후 인디케이터 서서히 숨김
                    setTimeout(() => {
                        indicator.classList.add('opacity-0');
                    }, 3000);
                }
            } catch (err) {
                console.error("자동 저장 실패:", err);
            }
        }, 1500); // 1.5초 디바운싱
    });
    
    // 초기 렌더링을 위해 수동 호출
    updateCodePreview({type: 'init'});

    // --- 브라우저 이탈 방지 안전장치 ---
    window.addEventListener('beforeunload', (event) => {
        // 워크스페이스에 사용자 블록이 1개라도 존재하는 경우
        if (workspace.getAllBlocks(false).length > 0) {
            event.preventDefault();
            event.returnValue = ''; // 표준 방식: 시스템 확인 팝업 발생
        }
    });

    // [버그 픽스] 플라이아웃이 숨겨질 때 남아있는 스크롤바 강제 숨김
    setInterval(() => {
        const flyout = document.querySelector('.blocklyFlyout');
        let scrollbars = document.querySelectorAll('.blocklyFlyoutScrollbar');
        if (scrollbars.length === 0) {
            const allVerticals = document.querySelectorAll('.blocklyScrollbarVertical');
            if (allVerticals.length > 1) {
                // 첫번째는 메인 워크스페이스, 두번째(마지막)가 플라이아웃 스크롤바
                scrollbars = [allVerticals[allVerticals.length - 1]];
            }
        }
        if (flyout && scrollbars.length > 0) {
            const isHidden = window.getComputedStyle(flyout).display === 'none';
            scrollbars.forEach(sb => { sb.style.display = isHidden ? 'none' : ''; });
        }
    }, 100);

    // --- 커스텀 Blockly 프롬프트 모달 (변수/함수 이름 입력) ---
    Blockly.dialog.setPrompt(function(message, defaultValue, callback) {
        const modal = document.getElementById('blockly-prompt-modal');
        const messageEl = document.getElementById('blockly-prompt-message');
        const inputEl = document.getElementById('blockly-prompt-input');
        const btnOk = document.getElementById('btn-prompt-ok');
        const btnCancel = document.getElementById('btn-prompt-cancel');

        // 모달 텍스트 및 기본값 설정
        // Blockly가 보내는 메시지(예: "새 변수 이름:")에서 불필요한 부분 다듬기
        messageEl.textContent = message.replace(':', '');
        inputEl.value = defaultValue;
        
        // 모달 표시
        modal.classList.remove('hidden');
        inputEl.focus();
        inputEl.select();

        // 이벤트 리스너 정리 함수
        const cleanup = () => {
            modal.classList.add('hidden');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            inputEl.removeEventListener('keydown', onKeydown);
        };

        // 확인 액션
        const onOk = () => {
            cleanup();
            callback(inputEl.value);
        };

        // 취소 액션
        const onCancel = () => {
            cleanup();
            callback(null);
        };

        // 키보드 지원 (엔터/ESC)
        const onKeydown = (e) => {
            if (e.key === 'Enter') onOk();
            if (e.key === 'Escape') onCancel();
        };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        inputEl.addEventListener('keydown', onKeydown);
    });

    // 실행 / 중지 버튼
    const btnRun = document.getElementById('btn-run-code');
    const btnStop = document.getElementById('btn-stop-code');

    btnRun.addEventListener('click', runCode);
    btnStop.addEventListener('click', stopCode);
});

// --- 3. 실시간 코드 업데이트 ---
function updateCodePreview(event) {
    if (event && event.type == Blockly.Events.UI) return; // UI 이벤트는 무시
    
    try {
        // 시작 블록 찾기 (전체 블록 중에서 검색)
        const startBlocks = workspace.getAllBlocks().filter(b => b.type === 'ard_start');
        
        let jsCode = '';
        let cCode = '';
        
        if (startBlocks.length > 0) {
            // 시작 블록이 있으면, 시작 블록에 연결된 코드만 생성
            Blockly.JavaScript.init(workspace);
            Blockly.C.init(workspace);
            
            // 함수 정의 블록들을 찾아 미리 변환(definitions_에 추가되도록 함)
            const topBlocks = workspace.getTopBlocks(true);
            topBlocks.forEach(block => {
                if (block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn') {
                    Blockly.JavaScript.blockToCode(block);
                    Blockly.C.blockToCode(block);
                }
            });

            let rawJsCode = Blockly.JavaScript.blockToCode(startBlocks[0]);
            jsCode = Blockly.JavaScript.finish(rawJsCode);
            
            let innerCode = Blockly.C.blockToCode(startBlocks[0]) || '';
            
            let defs = '';
            if (Blockly.C.definitions_) {
                for (let name in Blockly.C.definitions_) {
                    defs += Blockly.C.definitions_[name] + '\n\n';
                }
            }
            
            let setups = '';
            if (Blockly.C.setups_) {
                for (let name in Blockly.C.setups_) {
                    setups += '  ' + Blockly.C.setups_[name] + '\n';
                }
            }
            
            cCode = defs + `void setup() {\n  Serial.begin(115200);\n${setups}}\n\nvoid loop() {\n${innerCode.trim() ? innerCode.split('\\n').map(line => '  ' + line).join('\\n') : '  // 코드를 조립하세요'}\n}\n`;
        } else {
            // 없으면 경고 메시지 출력
            jsCode = "// '▶ 시작하기' 블록을 먼저 추가해주세요.\\n";
            cCode = `void setup() {\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  // '▶ 시작하기' 블록을 먼저 추가해주세요.\n}\n`;
        }

        const jsPreview = document.getElementById('code-preview-js');
        if (jsPreview) jsPreview.textContent = jsCode;
        
        document.getElementById('code-preview-c').textContent = cCode;
    } catch (e) {
        console.error("코드 생성 오류:", e);
        document.getElementById('code-preview-c').textContent = "오류 발생: " + e.message + "\n\nStack:\n" + e.stack;
    }
}

// --- 4. JS 코드 실행 (비동기 래핑) ---
async function runCode() {
    if (isRunning) return;
    
    const startBlocks = workspace.getAllBlocks().filter(b => b.type === 'ard_start');
    if (startBlocks.length === 0) {
        alert("작업 공간에 '▶ 시작하기' 블록이 없습니다. 먼저 추가해주세요!");
        return;
    }

    Blockly.JavaScript.init(workspace);

    // 함수 정의 블록들을 찾아 미리 변환
    const topBlocks = workspace.getTopBlocks(true);
    topBlocks.forEach(block => {
        if (block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn') {
            Blockly.JavaScript.blockToCode(block);
        }
    });

    const rawJsCode = Blockly.JavaScript.blockToCode(startBlocks[0]);
    const jsCode = Blockly.JavaScript.finish(rawJsCode);
    if (!jsCode || !jsCode.trim()) {
        alert("시작하기 블록에 연결된 로직이 없습니다.");
        return;
    }

    if (!window.ArduinoHW) {
        alert("하드웨어 모듈(ArduinoHW)을 찾을 수 없습니다.");
        return;
    }

    const btnRun = document.getElementById('btn-run-code');
    const btnStop = document.getElementById('btn-stop-code');
    
    isRunning = true;
    window.isBlocklyRunning = true;
    window.dispatchEvent(new CustomEvent('blockly-run-state-changed', { detail: true }));
    btnRun.classList.add('hidden');
    btnStop.classList.remove('hidden');

    // 비동기 실행 취소를 위한 전역 플래그
    window.__isBlocklyCancelled = false;
    
    // stopCode 함수가 안전하게 취소할 수 있도록 접근점 제공
    window.__cancelBlocklyRun = () => { window.__isBlocklyCancelled = true; };

    // 안전한 비동기 함수로 래핑
    // 사용자 코드에 delay(await)가 있으므로 AsyncFunction 생성자를 사용합니다.
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    
    try {
        // 무한 루프 등 방지를 위해 코드를 실행하지만, 근본적인 무한 루프 제어는 JS Generator 단에서 
        // yield나 abort 체크 로직을 넣는 것이 좋지만, 현재는 간단한 구현을 위해 순수 코드를 사용합니다.
        // 실행 도중 isCancelled를 주기적으로 체크할 수 있도록, 
        // Blockly 루프 제너레이터를 수정하지 않은 한 while(true)에 빠지면 브라우저가 멈출 수 있습니다.
        // 이 점을 주의하여, 딜레이 블록을 루프에 넣도록 안내해야 합니다.
        
        const executableCode = `
            try {
                ${jsCode}
            } catch(e) {
                console.error("블록 실행 중 오류:", e);
                if (e.message !== 'Cancelled') {
                    alert("코드 실행 중 오류가 발생했습니다: " + e.message);
                }
            }
        `;
        
        const func = new AsyncFunction(executableCode);
        await func();

    } catch(e) {
        console.error("비동기 함수 생성 오류:", e);
        alert("코드를 파싱하는 중 오류가 발생했습니다.");
    } finally {
        isRunning = false;
        window.isBlocklyRunning = false;
        window.dispatchEvent(new CustomEvent('blockly-run-state-changed', { detail: false }));
        btnRun.classList.remove('hidden');
        btnStop.classList.add('hidden');
        window.__isBlocklyCancelled = true;
        
        // 실행 종료 시 모든 액추에이터 끄기 (안전)
        window.ArduinoHW.turnOffPump();
        window.ArduinoHW.turnOffRgbLed();
        window.ArduinoHW.turnOffBuzzer();
    }
}

function stopCode() {
    if (!isRunning) return;
    
    if (window.__cancelBlocklyRun) {
        window.__cancelBlocklyRun();
    }
    
    // 시리얼 전송 대기열을 완전히 비워 이전에 쌓인 명령들 취소 (인터럽트)
    if (window.ArduinoSerial && window.ArduinoSerial.clearQueue) {
        window.ArduinoSerial.clearQueue();
    }
    
    // 현재 실행 중인 딜레이나 작업들을 강제 종료하기 위해 하드웨어를 즉시 멈춤
    window.ArduinoHW.turnOffPump();
    window.ArduinoHW.turnOffRgbLed();
    window.ArduinoHW.turnOffBuzzer();
    
    // AI 관련 리소스 즉시 종료
    if (window.AI) {
        window.AI.stopSpeech();
        window.AI.stopHandTracking();
    }
    
    // 핸드이노 모드일 경우 블록코딩 중지 시 모든 손가락 펴기 (165도)
    if (window.currentKitId === 'handino' && window.ArduinoHW.setAllServos) {
        window.ArduinoHW.setAllServos(165);
    }
    
    isRunning = false;
    window.isBlocklyRunning = false;
    window.dispatchEvent(new CustomEvent('blockly-run-state-changed', { detail: false }));
    document.getElementById('btn-run-code').classList.remove('hidden');
    document.getElementById('btn-stop-code').classList.add('hidden');
}

// --- 블록을 이미지(PNG)로 다운로드하는 함수 ---
function downloadBlockAsImage(block) {
    const svgRoot = block.getSvgRoot();
    const bBox = svgRoot.getBBox();
    const padding = 15; // 상하좌우 여백
    const width = bBox.width + padding * 2;
    const height = bBox.height + padding * 2;

    const clone = svgRoot.cloneNode(true);
    // 화면에 배치된 절대 위치 transform 제거
    clone.removeAttribute('transform');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `${bBox.x - padding} ${bBox.y - padding} ${width} ${height}`);
    
    // 브라우저에서 화면에 렌더링된 실제 폰트 크기/종류/굵기를 가져와 다운로드 이미지에 똑같이 적용 (글자 겹침 방지)
    let fontSize = '11pt';
    let fontFamily = '"Helvetica Neue", Helvetica, sans-serif';
    let fontWeight = 'normal';
    if (workspace && workspace.getParentSvg()) {
        const sampleText = workspace.getParentSvg().querySelector('text.blocklyText') || workspace.getParentSvg().querySelector('text');
        if (sampleText) {
            const computed = window.getComputedStyle(sampleText);
            if (computed.fontSize) fontSize = computed.fontSize;
            if (computed.fontFamily) fontFamily = computed.fontFamily;
            if (computed.fontWeight) fontWeight = computed.fontWeight;
        }
    }

    // Blockly의 기본 폰트 및 아이콘 등에 대한 최소한의 대비책 스타일
    const fallbackStyle = document.createElement('style');
    fallbackStyle.textContent = `
        text, .blocklyText { 
            font-family: ${fontFamily} !important; 
            font-size: ${fontSize} !important; 
            font-weight: ${fontWeight} !important; 
        }
        .blocklyText { fill: #fff; }
        .blocklyNonEditableText>rect, .blocklyEditableText>rect, .blocklyFieldRect, .blocklyDropdownRect {
            fill: #fff !important;
            fill-opacity: 0.6;
            stroke: none;
        }
        .blocklyNonEditableText>text, .blocklyEditableText>text, .blocklyFieldText {
            fill: #000 !important;
        }
        .blocklyIconGroup { fill: #00f; stroke: #fff; }
        .blocklyIconShield { fill: #00c; stroke: #ccc; stroke-width: 1px; }
        .blocklyIconMark { fill: #fff; font-family: sans-serif; font-size: 9pt; font-weight: bold; }
        .blocklyMutatorBackground { fill: #fff; stroke: #ddd; stroke-width: 1; }
    `;
    svg.appendChild(fallbackStyle);

    // [핵심] 현재 문서(head 포함)에 주입된 모든 Blockly 관련 스타일 태그(테마, 공통 스타일)를 복사하여 SVG 내부에 삽입
    // 이렇게 해야 숫자 블록의 입력창이나 설정 버튼 등 테마 전용 스타일이 이미지에 그대로 유지됩니다.
    const allStyles = document.querySelectorAll('style');
    allStyles.forEach(s => {
        if ((s.id && s.id.toLowerCase().includes('blockly')) || (s.textContent && s.textContent.includes('.blockly'))) {
            svg.appendChild(s.cloneNode(true));
        }
    });

    svg.appendChild(clone);

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svg);
    
    const img = new Image();
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = function() {
        const canvas = document.createElement('canvas');
        // 고해상도(레티나) 지원을 위해 2배 크기로 캔버스 생성
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // 배경은 투명하게 두고 이미지만 그리기
        ctx.drawImage(img, 0, 0, width, height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `block_${block.type}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    };
    
    img.onerror = function(err) {
        console.error("이미지 변환 실패:", err);
        alert("이미지로 변환하는 중 오류가 발생했습니다.");
    };
    
    img.src = url;
}

// --- 블록 일부만 쓰레기통에 닿아도 삭제되도록 패치 ---
if (typeof Blockly !== 'undefined' && Blockly.Trashcan) {
    const origGetClientRect = Blockly.Trashcan.prototype.getClientRect;
    Blockly.Trashcan.prototype.getClientRect = function() {
        let rect = origGetClientRect.call(this);
        if (!rect) return null;

        // 드래그 대상(블록)의 크기만큼 쓰레기통의 히트 영역을 좌측/상단으로 확장합니다.
        // Blockly는 드래그 타겟을 확인할 때 항상 블록의 좌측 상단 좌표를 기준으로 검사하므로,
        // 쓰레기통 영역을 블록의 크기만큼 미리 늘려두면 블록의 어떤 부분이든 쓰레기통에 닿았을 때 교차(Intersection)로 인식됩니다.
        const selected = Blockly.common ? Blockly.common.getSelected() : Blockly.selected;
        if (selected && typeof selected.getHeightWidth === 'function') {
            const size = selected.getHeightWidth();
            const scale = this.workspace_ ? this.workspace_.scale : 1;
            
            const blockWidthPx = size.width * scale;
            const blockHeightPx = size.height * scale;
            
            const margin = 20; // 살짝만 닿아도 삭제되도록 마진 추가
            
            rect.top -= (blockHeightPx + margin);
            rect.left -= (blockWidthPx + margin);
            rect.bottom += margin;
            rect.right += margin;
        }
        
        return rect;
    };
}

