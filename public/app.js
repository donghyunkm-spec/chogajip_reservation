// 초가집 예약 시스템 UI 로직
// public/app.js - 온라인 전용 버전

// 전역 변수
let reservations = [];
let soundEnabled = true;
let lastNotificationTime = 0;
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // 기본값 설정
    const dateInput = document.getElementById('date');
    const statusDateInput = document.getElementById('statusDate');
    
    if (dateInput) dateInput.value = getCurrentDate();
    if (statusDateInput) statusDateInput.value = getCurrentDate();
    
    // 소리 설정 로드
    const savedSoundSetting = localStorage.getItem('soundEnabled');
    if (savedSoundSetting !== null) {
        soundEnabled = savedSoundSetting === 'true';
        updateSoundButtonUI();
    }
    
    // 데이터 로드
    await loadReservations();
    
    // 15분 전 알림 체크 시작
    setInterval(checkUpcomingReservations, 60000); // 1분마다 체크
    
    // 연결 상태 주기적 확인
    setInterval(checkConnectionStatus, 30000);
    
    // 새 예약 주기적 확인
    setInterval(checkForNewReservations, 100000); // 100초마다
    
    // 초기 UI 업데이트
    updateStatus();
    
    console.log('🔔 초가짚 예약 시스템이 초기화되었습니다.');
});

// 알림 함수들
function playNotificationSound() {
    if (!soundEnabled) return;
    
    try {
        // 알림 소리 생성 (간단한 비프음)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.6);
    } catch (error) {
        console.log('알림음 재생 실패:', error);
    }
}

function showNotification(message, type = 'success') {
    // 중복 알림 방지 (1초 내)
    const now = Date.now();
    if (now - lastNotificationTime < 1000) return;
    lastNotificationTime = now;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 소리 재생
    playNotificationSound();
    
    // 5초 후 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    updateSoundButtonUI();
    localStorage.setItem('soundEnabled', soundEnabled);
}

function updateSoundButtonUI() {
    const btn = document.getElementById('soundToggle');
    if (btn) {
        btn.textContent = soundEnabled ? '🔊 알림음' : '🔇 음소거';
        btn.className = soundEnabled ? 'sound-btn' : 'sound-btn muted';
    }
}

// 15분 전 알림 체크
function checkUpcomingReservations() {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    
    const todayReservations = reservations.filter(r => 
        r.status === 'active' && 
        r.date === currentDate
    );
    
    todayReservations.forEach(reservation => {
        const reservationTime = new Date(`${reservation.date}T${reservation.time}:00`);
        const timeDiff = reservationTime.getTime() - now.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));
        
        // 15분 전 알림 (14~16분 사이로 여유 있게)
        if (minutesDiff >= 14 && minutesDiff <= 16) {
            const key = `reminder_${reservation.id}_15min`;
            if (!localStorage.getItem(key)) {
                showNotification(
                    `⏰ 15분 후 예약: ${reservation.name}님 ${reservation.people}명 (${reservation.tables?.join(', ')})`,
                    'warning'
                );
                localStorage.setItem(key, 'shown');
            }
        }
        
        // 예약 시간 알림
        if (minutesDiff >= -1 && minutesDiff <= 1) {
            const key = `arrival_${reservation.id}_now`;
            if (!localStorage.getItem(key)) {
                showNotification(
                    `🎉 예약 시간: ${reservation.name}님 도착 예정 (${reservation.tables?.join(', ')})`,
                    'success'
                );
                localStorage.setItem(key, 'shown');
            }
        }
    });
}

// 연결 상태 주기적 확인
async function checkConnectionStatus() {
    try {
        await apiCall('ping');
        updateConnectionStatus(true);
    } catch (error) {
        updateConnectionStatus(false);
        showAlert('서버 연결이 끊어졌습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
}

// 새 예약 확인
async function checkForNewReservations() {
    try {
        const response = await apiCall('reservations');
        const newReservations = response.data || [];
        
        // 새 예약이 있으면 알림
        if (newReservations.length > reservations.length) {
            const newCount = newReservations.length - reservations.length;
            const latestReservation = newReservations[newReservations.length - 1];
            
            showNotification(
                `🎉 새 예약: ${latestReservation.name}님 ${latestReservation.people}명 (${latestReservation.time})`
            );
            
            reservations = newReservations;
            updateStatus(); // 화면 업데이트
        }
    } catch (error) {
        // 오류는 무시 (이미 연결 상태 체크에서 처리됨)
    }
}

// 유틸리티 함수들
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

// 연결 상태 업데이트
function updateConnectionStatus(isOnline) {
    const status = document.getElementById('connectionStatus');
    if (status) {
        if (isOnline) {
            status.textContent = '🟢 서버 연결됨';
            status.className = 'connection-status online';
        } else {
            status.textContent = '🔴 서버 연결 끊김';
            status.className = 'connection-status offline';
        }
    }
}

// 알림 표시
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = message;
        
        alertContainer.innerHTML = '';
        alertContainer.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
}

// API 호출 함수
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}/api/${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API 호출 실패 (${endpoint}):`, error);
        updateConnectionStatus(false);
        throw error;
    }
}

// 데이터 로드
async function loadReservations() {
    try {
        showLoading(true);
        console.log('서버에서 예약 데이터 로드 시도...');
        const response = await apiCall('reservations');
        const newReservations = response.data || [];
        
        console.log(`서버에서 받은 예약 데이터: ${newReservations.length}건`, newReservations);
        
        // 새 예약 알림 체크
        if (reservations.length > 0 && newReservations.length > reservations.length) {
            const newCount = newReservations.length - reservations.length;
            showNotification(`🎉 새 예약 ${newCount}건이 등록되었습니다!`);
        }
        
        reservations = newReservations;
        updateConnectionStatus(true);
        
        console.log('서버에서 예약 데이터 로드 완료:', reservations.length, '건');
        
        // 예약 데이터 상태 확인
        checkReservationStatus();
    } catch (error) {
        console.error('서버 데이터 로드 실패:', error);
        showAlert('서버 연결에 실패했습니다. 네트워크 연결을 확인해주세요.', 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

// 예약 데이터 상태 검사 함수 추가
function checkReservationStatus() {
    if (reservations.length === 0) {
        console.log('⚠️ 예약 데이터가 없습니다.');
        showAlert('현재 예약 데이터가 없습니다. 새 예약을 등록해보세요.', 'info');
    } else {
        // 활성 예약 수 확인
        const activeReservations = reservations.filter(r => r.status === 'active');
        console.log(`활성 예약: ${activeReservations.length}/${reservations.length}건`);
        
        if (activeReservations.length === 0 && reservations.length > 0) {
            console.log('⚠️ 활성 상태의 예약이 없습니다.');
            showAlert('활성 상태의 예약이 없습니다. 모든 예약이 취소되었거나 상태가 변경되었습니다.', 'warning');
        }
        
        // 오늘 예약 확인
        const today = getCurrentDate();
        const todayReservations = activeReservations.filter(r => r.date === today);
        console.log(`오늘(${today}) 예약: ${todayReservations.length}건`);
    }
}

// 데이터 저장
async function saveReservation(reservation) {
    try {
        const response = await apiCall('reservations', {
            method: 'POST',
            body: JSON.stringify(reservation)
        });
        // 서버에서 저장된 예약 정보를 추가
        reservations.push(response.data || reservation);
        
        // 새 예약 등록 알림
        showNotification(`🎉 새 예약: ${reservation.name}님 ${reservation.people}명`);
        
        return response;
    } catch (error) {
        showAlert('서버 저장에 실패했습니다. 네트워크 연결을 확인해주세요.', 'error');
        throw error;
    }
}

// 로딩 표시
function showLoading(show) {
    const loading = document.getElementById('loading');
    const tabs = document.querySelector('.tabs');
    const content = document.querySelectorAll('.tab-content');
    
    if (loading) {
        if (show) {
            loading.style.display = 'block';
            if (tabs) tabs.style.display = 'none';
            content.forEach(c => c.style.display = 'none');
        } else {
            loading.style.display = 'none';
            if (tabs) tabs.style.display = 'flex';
            const activeContent = document.querySelector('.tab-content.active');
            if (activeContent) activeContent.style.display = 'block';
        }
    }
}

// 탭 전환 함수들
function showReservationTab() {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const reservationTab = document.querySelector('.tab:first-child');
    const reservationContent = document.getElementById('reservation-content');
    
    if (reservationTab) reservationTab.classList.add('active');
    if (reservationContent) {
        reservationContent.classList.add('active');
        reservationContent.style.display = 'block';
    }
}

function showStatusTab() {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const statusTab = document.querySelector('.tab:last-child');
    const statusContent = document.getElementById('status-content');
    
    if (statusTab) statusTab.classList.add('active');
    if (statusContent) {
        statusContent.classList.add('active');
        statusContent.style.display = 'block';
    }
    
    updateStatus();
}

// 모바일 UI 관련 함수
function decrementValue(id) {
    const input = document.getElementById(id);
    const min = parseInt(input.min) || 1;
    const currentValue = parseInt(input.value) || 0;
    if (currentValue > min) {
        input.value = currentValue - 1;
    }
}

function incrementValue(id) {
    const input = document.getElementById(id);
    const max = parseInt(input.max) || 50;
    const currentValue = parseInt(input.value) || 0;
    if (currentValue < max) {
        input.value = currentValue + 1;
    }
}

function selectPreference(value) {
    document.getElementById('preference').value = value;
    
    const options = ['any', 'room', 'hall'];
    options.forEach(opt => {
        const element = document.getElementById(`pref-${opt}`);
        if (element) {
            if (opt === value) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        }
    });
}

// 예약방법 선택 함수
function selectMethod(value) {
    document.getElementById('reservationMethod').value = value;
    
    const options = ['none', 'phone', 'naver'];
    options.forEach(opt => {
        const element = document.getElementById(`method-${opt}`);
        if (element) {
            if (opt === value) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        }
    });
}

// 예약 등록 처리
async function handleReservation(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '처리 중...';
    }
    
    try {
        const people = parseInt(document.getElementById('people').value);
        const preference = document.getElementById('preference').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value || '';
        const reservationMethod = document.getElementById('reservationMethod')?.value || 'none';
        
        // 스마트 테이블 배정
        const assignedTables = assignTables(people, preference, date, time, reservations);
        
        if (assignedTables.length > 0) {
            const newReservation = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                name: name,
                people: people,
                preference: preference,
                date: date,
                time: time,
                phone: phone,
                reservationMethod: reservationMethod,
                tables: assignedTables,
                timestamp: new Date().toISOString(),
                status: 'active'
            };
            
            await saveReservation(newReservation);
            
            const successMessage = `예약이 완료되었습니다!\n${name}님 - ${people}명 - ${time}\n배정 테이블: ${assignedTables.join(', ')}`;
            showAlert(successMessage, 'success');
			
			showReservationSuccessModal('예약이 완료되었습니다!', newReservation);
			
            // 폼 초기화
            event.target.reset();
            const dateInput = document.getElementById('date');
            if (dateInput) dateInput.value = getCurrentDate();
            document.getElementById('people').value = 4;
            selectPreference('any');
            if (document.getElementById('reservationMethod')) {
                selectMethod('none');
            }
            
            // 예약 현황 업데이트
            updateStatus();
        } else {
            // 예약 불가 시 대안 제시
            showReservationFailureModal(people, preference, date, time, name, phone, reservationMethod);
        }
    } catch (error) {
        showAlert('예약 등록 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
        console.error('예약 등록 오류:', error);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '예약 등록';
        }
    }
}

// 예약 실패 시 대안 제시 모달
function showReservationFailureModal(people, preference, date, time, name, phone, reservationMethod) {
    const activeReservations = reservations.filter(r => r.status === 'active');
    const conflictingReservations = activeReservations.filter(r => 
        r.date === date && isTimeOverlap(r.time, time)
    );
    const usedTables = getUsedTables(conflictingReservations);
    
    // 대안 가능성 체크
    let alternatives = [];
    
    if (preference === 'room') {
        // 룸 선호인데 룸이 불가능한 경우
        const hallPossible = tryHallAssignment(people, usedTables);
        if (hallPossible.length > 0) {
            alternatives.push({
                type: '홀',
                tables: hallPossible,
                message: `룸이 만석이지만 홀에 자리가 있습니다.\n홀 ${hallPossible.join(', ')}번 테이블 이용 가능합니다.`
            });
        }
    } else if (preference === 'hall') {
        // 홀 선호인데 홀이 불가능한 경우
        const roomPossible = tryRoomAssignment(people, usedTables);
        if (roomPossible.length > 0) {
            alternatives.push({
                type: '룸',
                tables: roomPossible,
                message: `홀이 만석이지만 룸에 자리가 있습니다.\n룸 ${roomPossible.join(', ')}번 테이블 이용 가능합니다.`
            });
        }
    }
    
    // 모달 생성
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
    `;
    
    let modalContent = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            <h3 style="color: #f44336; margin-bottom: 20px;">⚠️ 예약이 어려운 상황입니다</h3>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                <strong>${escapeHtml(name)}님 ${people}명</strong><br>
                <span style="color: #856404;">📅 ${date} ${time} (${getPreferenceText(preference)})</span>
            </div>
    `;
    
    if (alternatives.length > 0) {
        modalContent += `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #28a745; margin-bottom: 15px;">💡 대안이 있습니다!</h4>
        `;
        
        alternatives.forEach((alt, index) => {
            modalContent += `
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #28a745;">
                    <p style="margin: 0; color: #155724; line-height: 1.5;">${alt.message}</p>
                    <button onclick="acceptAlternative('${alt.type}', '${alt.tables.join(',')}', '${name}', ${people}, '${preference}', '${date}', '${time}', '${phone}', '${reservationMethod}')" 
                            style="background: #28a745; color: white; padding: 8px 15px; border: none; border-radius: 5px; margin-top: 10px; cursor: pointer; font-weight: bold;">
                        ${alt.type} 예약하기
                    </button>
                </div>
            `;
        });
        
        modalContent += `</div>`;
    } else {
        modalContent += `
            <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
                <p style="margin: 0; color: #721c24;">현재 시간대에는 ${people}명이 앉을 수 있는 자리가 없습니다.</p>
            </div>
        `;
    }
    
    modalContent += `
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="checkCurrentStatus('${date}', '${time}')" 
                        style="background: #007bff; color: white; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                    📊 현재 현황 확인
                </button>
                <button onclick="this.closest('.failure-modal').remove()" 
                        style="background: #6c757d; color: white; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                    닫기
                </button>
            </div>
        </div>
    `;
    
    modal.innerHTML = modalContent;
    modal.className = 'failure-modal';
    document.body.appendChild(modal);
    
    // 모달 바깥 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 대안 예약 수락
async function acceptAlternative(altType, tablesStr, name, people, originalPreference, date, time, phone, reservationMethod) {
    try {
        const tables = tablesStr.split(',');
        const newReservation = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: name,
            people: people,
            preference: originalPreference,
            date: date,
            time: time,
            phone: phone,
            reservationMethod: reservationMethod,
            tables: tables,
            timestamp: new Date().toISOString(),
            status: 'active',
            alternative: true, // 대안 예약 표시
            alternativeType: altType
        };
        
        await saveReservation(newReservation);
        
        // 모달 닫기
        document.querySelector('.failure-modal').remove();
        
        const successMessage = `대안 예약이 완료되었습니다!\n${name}님 - ${people}명 - ${time}\n${altType} ${tables.join(', ')}번 테이블`;
        showAlert(successMessage, 'success');
        showNotification(`✅ 대안 예약: ${name}님 ${altType} ${tables.join(', ')}`);
        
        // 폼 초기화
        document.querySelector('form').reset();
        const dateInput = document.getElementById('date');
        if (dateInput) dateInput.value = getCurrentDate();
        document.getElementById('people').value = 4;
        selectPreference('any');
        if (document.getElementById('reservationMethod')) {
            selectMethod('none');
        }
        
        // 예약 현황 업데이트
        updateStatus();
    } catch (error) {
        console.error('대안 예약 오류:', error);
        showAlert('대안 예약 등록 중 오류가 발생했습니다.', 'error');
    }
}

// 현재 현황 확인 (예약 현황 탭으로 이동)
function checkCurrentStatus(date, time) {
    // 모달 닫기
    document.querySelector('.failure-modal').remove();
    
    // 예약 현황 탭으로 전환
    showStatusTab();
    
    // 해당 날짜와 시간으로 필터 설정
    const statusDateInput = document.getElementById('statusDate');
    const timeFilterSelect = document.getElementById('timeFilter');
    
    if (statusDateInput) statusDateInput.value = date;
    if (timeFilterSelect) timeFilterSelect.value = time;
    
    // 현황 업데이트
    updateStatus();
    
    // 해당 시간대 하이라이트 효과
    setTimeout(() => {
        const statusContainer = document.querySelector('.status-container');
        if (statusContainer) {
            statusContainer.style.border = '3px solid #007bff';
            statusContainer.style.animation = 'pulse 2s ease-in-out 3';
            
            setTimeout(() => {
                statusContainer.style.border = 'none';
                statusContainer.style.animation = 'none';
            }, 6000);
        }
    }, 500);
    
    showNotification(`📊 ${date} ${time} 시간대 현황을 확인하세요`, 'info');
}

// 예약 현황 업데이트
function updateStatus() {
    const selectedDate = document.getElementById('statusDate')?.value || getCurrentDate();
    const selectedTime = document.getElementById('timeFilter')?.value || 'all';
    
    console.log(`예약 현황 업데이트: 날짜=${selectedDate}, 시간=${selectedTime}`);
    
    // 먼저 전체 예약 확인
    console.log(`전체 예약 수: ${reservations.length}건`);
    
    // 활성 예약만 필터링
    let activeReservations = reservations.filter(r => r.status === 'active' || !r.status);
    console.log(`활성 예약 수: ${activeReservations.length}건`);
    
    // 선택한 날짜의 예약만 필터링
    let dayReservations = activeReservations.filter(r => r.date === selectedDate);
    console.log(`선택 날짜(${selectedDate}) 예약 수: ${dayReservations.length}건`);
    
    // 선택한 시간대 필터링 (선택된 경우)
    if (selectedTime !== 'all') {
        const filteredByTime = dayReservations.filter(r => 
            isTimeOverlap(r.time, selectedTime)
        );
        console.log(`선택 시간대(${selectedTime}) 예약 수: ${filteredByTime.length}건`);
        dayReservations = filteredByTime;
    }
    
    // 예약이 없는 경우 메시지 표시
    if (dayReservations.length === 0) {
        const reservationsDiv = document.getElementById('reservations');
        if (reservationsDiv) {
            reservationsDiv.innerHTML = `
                <div class="empty-state">
                    <p>선택한 날짜(${selectedDate})${selectedTime !== 'all' ? `, 시간(${selectedTime})` : ''}에 예약이 없습니다.</p>
                    <button onclick="refreshData()" class="refresh-btn">새로고침</button>
                </div>
            `;
        }
    }
    
    // 총 예약 수 표시 업데이트
    const totalCountElement = document.getElementById('totalReservationCount');
    if (totalCountElement) {
        totalCountElement.textContent = activeReservations.length;
    }
    
    // 예약 테이블 그룹화
    const { individual: groupedReservations, groups: groupReservations } = groupReservationsByTables(dayReservations);
    
    // UI 업데이트
    renderHallTables(groupedReservations, groupReservations);
    renderRoomTables(groupedReservations, groupReservations);
    updateGroupStatus(selectedDate, selectedTime);
    updateReservationList(dayReservations);
    
    // 데이터 저장 위치 표시
    updateDataStorageStatus();
}

// 데이터 저장 위치 상태 표시 함수 추가
function updateDataStorageStatus() {
    const statusElement = document.getElementById('dataStorageStatus');
    if (statusElement) {
        statusElement.textContent = '☁️ Railway 볼륨 저장 모드';
        statusElement.className = 'data-status online';
    }
}

// 예약 그룹핑
function groupReservationsByTables(reservations) {
    const grouped = {};
    const groupReservations = {};
    
    reservations.forEach(r => {
        if (r.tables && r.tables.length > 1) {
            const key = r.tables.sort().join(',');
            grouped[key] = r;
            groupReservations[key] = r;
        } else if (r.tables && r.tables.length === 1) {
            grouped[r.tables[0]] = r;
        }
    });
    
    return { individual: grouped, groups: groupReservations };
}

// app.js 파일에서 홀 테이블 렌더링 함수 수정
function renderHallTables(dayReservations) {
    const hallDiv = document.getElementById('hall-tables');
    if (!hallDiv) return;
    
    const hallLayout = [
        [1, '', 3, 4, 5, 6, 7, 8],
        [2, '', '', '', '', '', '', ''],
        ['', '', 9, 10, 11, 12, '', ''],
        ['', '', 13, 14, 15, 16, '', '']
    ];
    
    const usedTables = new Set();
    const tableReservations = new Map();
    
    dayReservations.forEach(r => {
        if (r.tables) {
            r.tables.forEach(t => {
                if (t.startsWith('hall-')) {
                    usedTables.add(t);
                    tableReservations.set(t, r);
                }
            });
        }
    });
    
    let html = '';
    hallLayout.forEach(row => {
        html += '<div class="hall-row">';
        row.forEach(tableNum => {
            if (tableNum === '') {
                html += '<div class="table-cell empty-cell"></div>';
            } else {
                const tableId = `hall-${tableNum}`;
                const isReserved = usedTables.has(tableId);
                const reservation = tableReservations.get(tableId);
                
                if (isReserved && reservation) {
                    // 예약 ID를 기반으로 색깔 인덱스 생성 (1-8 순환)
                    const colorIndex = (reservation.id % 8) + 1;
                    html += `<div class="table-cell reserved-color-${colorIndex}" onclick="showReservationModal('${reservation.id}')">
                        <div>T${tableNum}</div>
                        <div class="table-info">${escapeHtml(reservation.name)}</div>
                        <div class="table-info">${reservation.people}명</div>
                        <div class="table-info">${reservation.time}</div>
                    </div>`;
                } else {
                    const capacity = tableNum == 1 ? 5 : 4;
                    html += `<div class="table-cell available">
                        <div>T${tableNum}</div>
                        <div class="table-info">${capacity}석</div>
                    </div>`;
                }
            }
        });
        html += '</div>';
    });
    
    hallDiv.innerHTML = html;
}

// app.js 파일에서 룸 테이블 렌더링 함수 수정
function renderRoomTables(dayReservations) {
    const roomDiv = document.getElementById('room-tables');
    if (!roomDiv) return;
    
    const roomLayout = [
        [7, 8, 9],
        [4, 5, 6],
        [1, 2, 3]
    ];
    
    const usedTables = new Set();
    const tableReservations = new Map();
    
    dayReservations.forEach(r => {
        if (r.tables) {
            r.tables.forEach(t => {
                if (t.startsWith('room-')) {
                    usedTables.add(t);
                    tableReservations.set(t, r);
                }
            });
        }
    });
    
    let html = '';
    roomLayout.forEach(row => {
        html += '<div class="room-row">';
        row.forEach(tableNum => {
            const tableId = `room-${tableNum}`;
            const isReserved = usedTables.has(tableId);
            const reservation = tableReservations.get(tableId);
            
            if (isReserved && reservation) {
                // 예약 ID를 기반으로 색깔 인덱스 생성 (1-8 순환)
                const colorIndex = (reservation.id % 8) + 1;
                html += `<div class="table-cell reserved-color-${colorIndex}" onclick="showReservationModal('${reservation.id}')">
                    <div>R${tableNum}</div>
                    <div class="table-info">${escapeHtml(reservation.name)}</div>
                    <div class="table-info">${reservation.people}명</div>
                    <div class="table-info">${reservation.time}</div>
                </div>`;
            } else {
                html += `<div class="table-cell available">
                    <div>R${tableNum}</div>
                    <div class="table-info">4석</div>
                </div>`;
            }
        });
        html += '</div>';
    });
    
    roomDiv.innerHTML = html;
}

// 단체 예약 현황 업데이트
function updateGroupStatus(selectedDate = getCurrentDate(), selectedTime = 'all') {
    const groupDiv = document.getElementById('group-status');
    if (!groupDiv) return;
    
    let activeReservations = reservations.filter(r => r.status === 'active');
    let dayReservations = activeReservations.filter(r => r.date === selectedDate);
    
    if (selectedTime !== 'all') {
        dayReservations = dayReservations.filter(r => 
            isTimeOverlap(r.time, selectedTime)
        );
    }
    
    const availableGroups = GROUP_RULES.filter(rule => {
        return checkGroupAvailability(rule, dayReservations);
    });
    
    let html = '<div style="text-align: center;">';
    
    // 예약 가능한 단체석만 표시
    html += '<h4 style="color: #4CAF50; margin-bottom: 15px;">🟢 예약 가능한 단체석</h4>';
    if (availableGroups.length > 0) {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">';
        html += availableGroups
            .sort((a, b) => a.maxPeople - b.maxPeople)
            .map(rule => `
                <div class="group-item available" style="margin-bottom: 8px; padding: 10px; background: #e8f5e8; border-radius: 8px; text-align: center;">
                    <strong>${rule.name}</strong><br>
                    <small>${rule.minPeople || rule.maxPeople}~${rule.maxPeople}명</small>
                </div>
            `).join('');
        html += '</div>';
    } else {
        html += '<div style="color: #666; font-style: italic; padding: 20px;">현재 예약 가능한 단체석이 없습니다.</div>';
    }
    
    // 간단한 요약
    html += `<div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <strong>단체석 현황: 예약가능 ${availableGroups.length}개 / 전체 ${GROUP_RULES.length}개</strong>
             </div>`;
    
    html += '</div>';
    
    groupDiv.innerHTML = html;
}

// 예약 목록 업데이트
function updateReservationList(dayReservations) {
    const reservationsDiv = document.getElementById('reservations');
    if (!reservationsDiv) return;
    
    console.log(`예약 목록 UI 업데이트: ${dayReservations.length}건`);
    
    if (dayReservations.length === 0) {
        reservationsDiv.innerHTML = '<div class="empty-state"><p>해당 조건에 예약이 없습니다.</p></div>';
    } else {
        const sortedReservations = dayReservations.sort((a, b) => a.time.localeCompare(b.time));
        
        let html = '';
        sortedReservations.forEach(r => {
            const isAlternative = r.alternative ? 'alternative-highlight' : '';
            const alternativeTag = r.alternative ? 
                `<span class="badge alternative-badge">대안예약</span> ` : '';
                
            const phone = r.phone ? `<br><span class="reservation-detail">📞 연락처: ${escapeHtml(r.phone)}</span>` : '';
            const method = r.reservationMethod && r.reservationMethod !== 'none' ? 
                `<br><span class="reservation-detail">📝 예약방법: ${getMethodText(r.reservationMethod)}</span>` : '';
            
            html += `
                <div class="reservation-item ${isAlternative}">
                    <div class="reservation-content">
                        <div class="reservation-info">
                            ${alternativeTag}<strong class="customer-name">${escapeHtml(r.name)}</strong>
                            <span class="reservation-time">${r.time}~${addHours(r.time, 3)}</span>
                            <span class="reservation-people">${r.people}명</span>
                            <div class="reservation-tables">테이블: ${r.tables ? r.tables.join(', ') : '미배정'}</div>
                            <div class="reservation-preference">선호: ${getPreferenceText(r.preference)}${r.alternative ? ` → ${r.alternativeType || '대안'} 예약` : ''}</div>
                            ${phone}
                            ${method}
                        </div>
                        <div class="reservation-actions">
                            <button class="edit-btn" onclick="editReservation(${r.id})">수정</button>
                            <button class="delete-btn" onclick="cancelReservation(${r.id})">취소</button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        reservationsDiv.innerHTML = html;
    }
}

// 예약 취소 함수
async function cancelReservation(reservationId) {
    if (!confirm('정말로 이 예약을 취소하시겠습니까?')) {
        return;
    }
    
    try {
        await apiCall(`reservations/${reservationId}`, {
            method: 'DELETE'
        });
        
        const index = reservations.findIndex(r => r.id === reservationId);
        if (index !== -1) {
            reservations.splice(index, 1);
        }
        
        showAlert('예약이 취소되었습니다.', 'success');
        updateStatus();
    } catch (error) {
        console.error('예약 취소 오류:', error);
        showAlert('예약 취소 중 오류가 발생했습니다.', 'error');
    }
}

// 예약 수정 함수
// 예약 수정 함수 (app.js에서 수정)
function editReservation(reservationId) {
    const reservation = reservations.find(r => r.id === reservationId);
    if (!reservation) {
        showAlert('예약을 찾을 수 없습니다.', 'error');
        return;
    }
    
    // 수정 폼 생성
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        overflow-y: auto;
        padding: 20px 10px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 15px; width: 100%; max-width: 500px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            <h3 style="margin-bottom: 20px; color: #333; text-align: center;">예약 수정</h3>
            <form id="editForm">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">성함</label>
                    <input type="text" id="editName" value="${escapeHtml(reservation.name)}" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box;" required>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">인원수</label>
                    <input type="number" id="editPeople" value="${reservation.people}" min="1" max="36" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box;" required onchange="updateEditTableAvailability()">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">좌석 선호도</label>
                    <select id="editPreference" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box;" required onchange="updateEditTableAvailability()">
                        <option value="any" ${reservation.preference === 'any' ? 'selected' : ''}>관계없음</option>
                        <option value="room" ${reservation.preference === 'room' ? 'selected' : ''}>룸 선호</option>
                        <option value="hall" ${reservation.preference === 'hall' ? 'selected' : ''}>홀 선호</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">예약 날짜</label>
                    <input type="date" id="editDate" value="${reservation.date}" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box;" required onchange="updateEditTableAvailability()">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">예약 시간</label>
                    <select id="editTime" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box;" required onchange="updateEditTableAvailability()">
                        <option value="14:00" ${reservation.time === '14:00' ? 'selected' : ''}>오후 2:00</option>
                        <option value="14:30" ${reservation.time === '14:30' ? 'selected' : ''}>오후 2:30</option>
                        <option value="15:00" ${reservation.time === '15:00' ? 'selected' : ''}>오후 3:00</option>
                        <option value="15:30" ${reservation.time === '15:30' ? 'selected' : ''}>오후 3:30</option>
                        <option value="16:00" ${reservation.time === '16:00' ? 'selected' : ''}>오후 4:00</option>
                        <option value="16:30" ${reservation.time === '16:30' ? 'selected' : ''}>오후 4:30</option>
                        <option value="17:00" ${reservation.time === '17:00' ? 'selected' : ''}>오후 5:00</option>
                        <option value="17:30" ${reservation.time === '17:30' ? 'selected' : ''}>오후 5:30</option>
                        <option value="18:00" ${reservation.time === '18:00' ? 'selected' : ''}>오후 6:00</option>
                        <option value="18:30" ${reservation.time === '18:30' ? 'selected' : ''}>오후 6:30</option>
                        <option value="19:00" ${reservation.time === '19:00' ? 'selected' : ''}>오후 7:00</option>
                        <option value="19:30" ${reservation.time === '19:30' ? 'selected' : ''}>오후 7:30</option>
                        <option value="20:00" ${reservation.time === '20:00' ? 'selected' : ''}>오후 8:00</option>
                        <option value="20:30" ${reservation.time === '20:30' ? 'selected' : ''}>오후 8:30</option>
                        <option value="21:00" ${reservation.time === '21:00' ? 'selected' : ''}>오후 9:00</option>
                        <option value="21:30" ${reservation.time === '21:30' ? 'selected' : ''}>오후 9:30</option>
                        <option value="22:00" ${reservation.time === '22:00' ? 'selected' : ''}>오후 10:00</option>
                        <option value="22:30" ${reservation.time === '22:30' ? 'selected' : ''}>오후 10:30</option>
                        <option value="23:00" ${reservation.time === '23:00' ? 'selected' : ''}>오후 11:00</option>
                        <option value="23:30" ${reservation.time === '23:30' ? 'selected' : ''}>오후 11:30</option>
                    </select>
                </div>
                
                <!-- 테이블 선택 UI (컴팩트하게) -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">테이블 선택</label>
                    <div class="table-selection" style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
                        <div style="font-weight: bold; margin-bottom: 8px; color: #333; font-size: 12px; text-align: center;">홀 테이블 (T1~T16)</div>
                        <div class="hall-table-layout" id="edit-hall-table-selection" style="margin-bottom: 10px;">
                            <!-- 홀 테이블 버튼들이 생성됩니다 -->
                        </div>
                        
                        <div style="font-weight: bold; margin-bottom: 8px; color: #333; font-size: 12px; text-align: center;">룸 테이블 (R1~R9)</div>
                        <div class="room-table-layout" id="edit-room-table-selection" style="margin-bottom: 8px;">
                            <!-- 룸 테이블 버튼들이 생성됩니다 -->
                        </div>
                        
                        <div style="font-size: 10px; color: #666; text-align: center;">
                            <span style="color: #f44336;">■</span> 예약불가 &nbsp;
                            <span style="color: #4CAF50;">■</span> 선택됨 &nbsp;
                            <span style="color: #ddd;">■</span> 선택가능
                        </div>
                    </div>
                    <input type="hidden" id="editSelectedTables" required>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">전화번호</label>
                    <input type="tel" id="editPhone" value="${reservation.phone || ''}" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; box-sizing: border-box;" placeholder="연락 가능한 전화번호">
                </div>
                
                <!-- 버튼을 항상 보이도록 고정 -->
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; position: sticky; bottom: 0; background: white;">
                    <button type="submit" style="flex: 1; background: #4CAF50; color: white; padding: 14px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
                        수정 완료
                    </button>
                    <button type="button" onclick="this.closest('.edit-modal').remove()" style="flex: 1; background: #666; color: white; padding: 14px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
                        취소
                    </button>
                </div>
            </form>
        </div>
    `;
    
    modal.className = 'edit-modal';
    document.body.appendChild(modal);
    
    // 수정용 테이블 선택 변수 초기화
    let editSelectedTables = new Set(reservation.tables || []);
    
    // 수정용 테이블 선택 UI 초기화
    initializeEditTableSelection(editSelectedTables);
    
    // 초기 테이블 가용성 업데이트
    setTimeout(() => {
        updateEditTableAvailability();
    }, 100);
    
    // 폼 제출 처리
    setTimeout(() => {
        const editForm = document.getElementById('editForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (editSelectedTables.size === 0) {
                    showAlert('테이블을 선택해주세요.', 'error');
                    return;
                }
                
                const submitBtn = e.target.querySelector('button[type="submit"]');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = '처리 중...';
                
                const updatedData = {
                    name: document.getElementById('editName').value,
                    people: parseInt(document.getElementById('editPeople').value),
                    preference: document.getElementById('editPreference').value,
                    date: document.getElementById('editDate').value,
                    time: document.getElementById('editTime').value,
                    phone: document.getElementById('editPhone').value || '',
                    tables: Array.from(editSelectedTables)
                };
                
                try {
                    await apiCall(`reservations/${reservationId}`, {
                        method: 'PUT',
                        body: JSON.stringify(updatedData)
                    });
                    
                    const index = reservations.findIndex(r => r.id === reservationId);
                    if (index !== -1) {
                        reservations[index] = { ...reservations[index], ...updatedData };
                    }
                    
                    modal.remove();
                    showAlert('예약이 수정되었습니다.', 'success');
                    updateStatus();
                } catch (error) {
                    console.error('예약 수정 오류:', error);
                    showAlert('예약 수정 중 오류가 발생했습니다.', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            });
        }
    }, 100);
    
    // 수정용 테이블 선택/해제 함수
    window.toggleEditTableSelection = function(tableId) {
        const tableBtn = document.querySelector(`#edit-hall-table-selection [data-table="${tableId}"], #edit-room-table-selection [data-table="${tableId}"]`);
        
        if (tableBtn && tableBtn.classList.contains('disabled')) {
            return;
        }

        if (editSelectedTables.has(tableId)) {
            editSelectedTables.delete(tableId);
            if (tableBtn) tableBtn.classList.remove('selected');
        } else {
            editSelectedTables.add(tableId);
            if (tableBtn) tableBtn.classList.add('selected');
        }

        document.getElementById('editSelectedTables').value = Array.from(editSelectedTables).join(',');
    };
    
    // 수정용 테이블 가용성 업데이트 함수
    window.updateEditTableAvailability = function() {
        const date = document.getElementById('editDate').value;
        const time = document.getElementById('editTime').value;

        if (!date || !time) {
            document.querySelectorAll('#edit-hall-table-selection .table-selection-item, #edit-room-table-selection .table-selection-item').forEach(btn => {
                btn.classList.remove('disabled');
            });
            return;
        }

        // 현재 수정 중인 예약을 제외한 예약들 확인
        const otherReservations = reservations.filter(r => 
            r.status === 'active' && 
            r.id !== reservationId &&
            r.date === date && 
            isTimeOverlap(r.time, time)
        );

        const usedTables = new Set();
        otherReservations.forEach(r => {
            if (r.tables) {
                r.tables.forEach(t => usedTables.add(t));
            }
        });

        // 모든 테이블 버튼 상태 업데이트
        document.querySelectorAll('#edit-hall-table-selection .table-selection-item, #edit-room-table-selection .table-selection-item').forEach(btn => {
            const tableId = btn.getAttribute('data-table');
            if (tableId && usedTables.has(tableId)) {
                btn.classList.add('disabled');
                btn.classList.remove('selected');
                editSelectedTables.delete(tableId);
            } else if (tableId) {
                btn.classList.remove('disabled');
            }
        });

        document.getElementById('editSelectedTables').value = Array.from(editSelectedTables).join(',');
    };
    
    // 모달 바깥 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 수정용 테이블 선택 UI 초기화
function initializeEditTableSelection(selectedTables) {
    // 홀 테이블 배치
    const hallLayout = [
        [1, '', 3, 4, 5, 6, 7, 8],
        [2, '', '', '', '', '', '', ''],
        ['', '', 9, 10, 11, 12, '', ''],
        ['', '', 13, 14, 15, 16, '', '']
    ];
    
    const hallContainer = document.getElementById('edit-hall-table-selection');
    hallContainer.innerHTML = '';
    
    hallLayout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hall-row';
        
        row.forEach(tableNum => {
            const tableBtn = document.createElement('div');
            tableBtn.className = 'table-selection-item';
            
            if (tableNum === '') {
                tableBtn.classList.add('empty');
            } else {
                const tableId = `hall-${tableNum}`;
                tableBtn.setAttribute('data-table', tableId);
                tableBtn.textContent = `T${tableNum}`;
                tableBtn.onclick = () => toggleEditTableSelection(tableId);
                
                if (selectedTables.has(tableId)) {
                    tableBtn.classList.add('selected');
                }
            }
            
            rowDiv.appendChild(tableBtn);
        });
        
        hallContainer.appendChild(rowDiv);
    });

    // 룸 테이블 배치
    const roomLayout = [
        [7, 8, 9],
        [4, 5, 6],
        [1, 2, 3]
    ];
    
    const roomContainer = document.getElementById('edit-room-table-selection');
    roomContainer.innerHTML = '';
    
    roomLayout.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'room-row';
        
        row.forEach(tableNum => {
            const tableBtn = document.createElement('div');
            tableBtn.className = 'table-selection-item';
            const tableId = `room-${tableNum}`;
            tableBtn.setAttribute('data-table', tableId);
            tableBtn.textContent = `R${tableNum}`;
            tableBtn.onclick = () => toggleEditTableSelection(tableId);
            
            if (selectedTables.has(tableId)) {
                tableBtn.classList.add('selected');
            }
            
            rowDiv.appendChild(tableBtn);
        });
        
        roomContainer.appendChild(rowDiv);
    });
}


// 데이터 새로고침
async function refreshData() {
    try {
        showLoading(true);
        showAlert('데이터를 새로고침 중입니다...', 'info');
        
        await loadReservations();
        updateStatus();
        showAlert('데이터가 새로고침되었습니다.', 'success');
    } catch (error) {
        console.error('데이터 새로고침 실패:', error);
        showAlert('데이터 새로고침 실패. 네트워크 연결을 확인해주세요.', 'error');
    } finally {
        showLoading(false);
    }
}

// CSV 다운로드
function downloadReservations() {
    if (reservations.length === 0) {
        showAlert('다운로드할 예약 데이터가 없습니다.', 'info');
        return;
    }
    
    let csv = '\uFEFF날짜,시간,이용종료시간,성명,인원,선호도,배정테이블,전화번호,예약방법,상태,등록시간\n';
    
    reservations
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .forEach(r => {
            const endTime = addHours(r.time, 3);
            const status = r.status === 'active' ? '활성' : '취소';
            const phone = r.phone || '';
            const method = r.reservationMethod ? getMethodText(r.reservationMethod) : '';
            csv += `${r.date},${r.time},${endTime},${r.name},${r.people},${getPreferenceText(r.preference)},"${r.tables ? r.tables.join(' + ') : '미배정'}",${phone},${method},${status},${new Date(r.timestamp).toLocaleString('ko-KR')}\n`;
        });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `초가짚_예약_${getCurrentDate()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 선호도 텍스트 변환
function getPreferenceText(preference) {
    switch(preference) {
        case 'room': return '룸 선호';
        case 'hall': return '홀 선호';
        default: return '관계없음';
    }
}

// 예약방법 텍스트 변환
function getMethodText(method) {
    switch(method) {
        case 'phone': return '전화';
        case 'naver': return '네이버';
        default: return '선택안함';
    }
}

// 예약 성공 모달 (기존 함수 있으면 교체)
function showReservationSuccessModal(message, reservationData) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
    `;
    
    const displayTables = reservationData.tables ? reservationData.tables.map(t => {
        if (t.startsWith('hall-')) {
            return 'T' + t.split('-')[1];
        } else if (t.startsWith('room-')) {
            return 'R' + t.split('-')[1];
        }
        return t;
    }).join(', ') : '미배정';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            <h3 style="color: #4CAF50; margin-bottom: 20px;">🎉 예약 완료!</h3>
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #4CAF50;">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">${escapeHtml(reservationData.name)}님</div>
                <div style="margin-bottom: 5px;">👥 ${reservationData.people}명</div>
                <div style="margin-bottom: 5px;">📅 ${reservationData.date} ${reservationData.time}</div>
                <div style="margin-bottom: 5px;">🪑 배정 테이블: ${displayTables}</div>
                <div style="font-size: 14px; color: #666;">좌석선호: ${getPreferenceText(reservationData.preference)}</div>
            </div>
            <button onclick="this.closest('.success-modal').remove()" 
                    style="background: #4CAF50; color: white; padding: 12px 30px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%;">
                확인
            </button>
        </div>
    `;
    
    modal.className = 'success-modal';
    document.body.appendChild(modal);
    
    // 모달 바깥 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}