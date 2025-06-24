// 테이블 배정 알고리즘
// public/table-algorithm.js

// 테이블 정보
const TABLE_INFO = {
    hall: {
        1: { capacity: 5 }, 2: { capacity: 4 }, 3: { capacity: 4 }, 4: { capacity: 4 },
        5: { capacity: 4 }, 6: { capacity: 4 }, 7: { capacity: 4 }, 8: { capacity: 4 },
        9: { capacity: 4 }, 10: { capacity: 4 }, 11: { capacity: 4 }, 12: { capacity: 4 },
        13: { capacity: 4 }, 14: { capacity: 4 }, 15: { capacity: 4 }, 16: { capacity: 4 }
    },
    room: {
        1: { capacity: 4 }, 2: { capacity: 4 }, 3: { capacity: 4 }, 4: { capacity: 4 },
        5: { capacity: 4 }, 6: { capacity: 4 }, 7: { capacity: 4 }, 8: { capacity: 4 }, 9: { capacity: 4 }
    }
};

// 단체석 규칙 (테이블_인원정보.txt 정확히 반영)
const GROUP_RULES = [
    // 홀 단체석 규칙
    { name: '홀 1,2번', tables: ['hall-1', 'hall-2'], maxPeople: 9, minPeople: 6 },
    { name: '홀 4,5번', tables: ['hall-4', 'hall-5'], maxPeople: 8, minPeople: 5 },
    { name: '홀 6,7번', tables: ['hall-6', 'hall-7'], maxPeople: 8, minPeople: 5 },
    { name: '홀 4,5,6,7번', tables: ['hall-4', 'hall-5', 'hall-6', 'hall-7'], maxPeople: 16, minPeople: 13 },
    { name: '홀 3,4,5,6,7번', tables: ['hall-3', 'hall-4', 'hall-5', 'hall-6', 'hall-7'], maxPeople: 20, minPeople: 17 },
    { name: '홀 4,5,6,7,8번', tables: ['hall-4', 'hall-5', 'hall-6', 'hall-7', 'hall-8'], maxPeople: 20, minPeople: 17 },
    { name: '홀 3,4,5,6,7,8번', tables: ['hall-3', 'hall-4', 'hall-5', 'hall-6', 'hall-7', 'hall-8'], maxPeople: 24, minPeople: 21 },
    
    // 룸 단체석 규칙
    { name: '룸 1,2번', tables: ['room-1', 'room-2'], maxPeople: 8, minPeople: 5 },
    { name: '룸 2,3번', tables: ['room-2', 'room-3'], maxPeople: 8, minPeople: 5 },
    { name: '룸 4,5번', tables: ['room-4', 'room-5'], maxPeople: 8, minPeople: 5 },
    { name: '룸 5,6번', tables: ['room-5', 'room-6'], maxPeople: 8, minPeople: 5 },
    { name: '룸 7,8번', tables: ['room-7', 'room-8'], maxPeople: 8, minPeople: 5 },
    { name: '룸 8,9번', tables: ['room-8', 'room-9'], maxPeople: 8, minPeople: 5 },
    { name: '룸 1,2,3번', tables: ['room-1', 'room-2', 'room-3'], maxPeople: 12, minPeople: 9 },
    { name: '룸 4,5,6번', tables: ['room-4', 'room-5', 'room-6'], maxPeople: 12, minPeople: 9 },
    { name: '룸 7,8,9번', tables: ['room-7', 'room-8', 'room-9'], maxPeople: 12, minPeople: 9 },
    { name: '룸 4,5,7,8번', tables: ['room-4', 'room-5', 'room-7', 'room-8'], maxPeople: 16, minPeople: 13 },
    { name: '룸 5,6,8,9번', tables: ['room-5', 'room-6', 'room-8', 'room-9'], maxPeople: 16, minPeople: 13 },
    { name: '룸 4~9번', tables: ['room-4', 'room-5', 'room-6', 'room-7', 'room-8', 'room-9'], maxPeople: 24, minPeople: 17 },
    { name: '룸 전체', tables: ['room-1', 'room-2', 'room-3', 'room-4', 'room-5', 'room-6', 'room-7', 'room-8', 'room-9'], maxPeople: 36, minPeople: 25 }
];

// 테이블 배정 메인 함수
function assignTables(people, preference, date, time, allReservations) {
    // 현재 활성 예약 중 시간이 겹치는 예약만 필터링
    const activeReservations = allReservations.filter(r => r.status === 'active');
    const conflictingReservations = activeReservations.filter(r => 
        r.date === date && isTimeOverlap(r.time, time)
    );
    
    console.log(`테이블 배정: ${people}명, 선호도: ${preference}, 날짜: ${date}, 시간: ${time}`);
    console.log(`기존 예약: ${conflictingReservations.length}건`);
    
    // 1단계: 직접 배정 시도
    let result = tryDirectAssignment(people, preference, conflictingReservations);
    if (result.length > 0) {
        console.log(`직접 배정 성공: ${result.join(', ')}`);
        return result;
    }
    
    // 2단계: 재배정을 통한 배정
    result = tryReassignment(people, preference, conflictingReservations, allReservations);
    if (result.length > 0) {
        console.log(`재배정 후 배정 성공: ${result.join(', ')}`);
        return result;
    }
    
    console.log('배정 실패: 수용 불가');
    return [];
}

// 직접 배정 시도
function tryDirectAssignment(people, preference, conflictingReservations) {
    const usedTables = getUsedTables(conflictingReservations);
    
    if (preference === 'room') {
        // 룸 선호는 룸만 시도
        return tryRoomAssignment(people, usedTables);
    } else if (preference === 'hall') {
        // 홀 선호는 홀만 시도
        return tryHallAssignment(people, usedTables);
    } else if (preference === 'any') {
        // 관계없음은 룸 우선, 그 다음 홀
        const roomResult = tryRoomAssignment(people, usedTables);
        if (roomResult.length > 0) {
            return roomResult;
        }
        return tryHallAssignment(people, usedTables);
    }
    
    return [];
}

// 사용 중인 테이블 가져오기
function getUsedTables(conflictingReservations) {
    const usedTables = new Set();
    conflictingReservations.forEach(r => {
        if (r.tables) {
            r.tables.forEach(table => usedTables.add(table));
        }
    });
    return usedTables;
}

// 룸 배정 시도
function tryRoomAssignment(people, usedTables) {
    // 개별 룸 테이블 (4명 이하)
    if (people <= 4) {
        for (let i = 1; i <= 9; i++) {
            const tableId = `room-${i}`;
            if (!usedTables.has(tableId)) {
                console.log(`룸 개별 테이블 배정: ${tableId} (${people}명)`);
                return [tableId];
            }
        }
        console.log(`룸 개별 테이블 불가: 사용 가능한 테이블 없음`);
    }
    
    // 단체석 시도 (5명 이상)
    if (people >= 5) {
        // 1. 정확히 맞는 단체석 규칙 적용
        const roomGroupRules = GROUP_RULES.filter(rule => 
            rule.tables.every(t => t.startsWith('room-')) && 
            rule.maxPeople >= people &&
            rule.minPeople <= people
        ).sort((a, b) => a.maxPeople - b.maxPeople); // 작은 단체석부터
        
        for (const rule of roomGroupRules) {
            if (rule.tables.every(table => !usedTables.has(table))) {
                console.log(`룸 단체석 배정: ${rule.name} (${people}명)`);
                return rule.tables;
            }
        }
        
        // 2. 최소 인원 조건 완화 시도
        const potentialRules = GROUP_RULES.filter(rule => 
            rule.tables.every(t => t.startsWith('room-')) && 
            rule.maxPeople >= people
        ).sort((a, b) => a.maxPeople - b.maxPeople);
        
        for (const rule of potentialRules) {
            if (rule.tables.every(table => !usedTables.has(table))) {
                console.log(`룸 단체석 배정(최소 인원 미달): ${rule.name} (${people}명)`);
                return rule.tables;
            }
        }
        
        // 3. 인접 테이블 조합 시도 (8명까지)
        if (people <= 8) {
            const adjacentPairs = [
                ['room-1', 'room-2'], 
                ['room-2', 'room-3'],
                ['room-4', 'room-5'],
                ['room-5', 'room-6'],
                ['room-7', 'room-8'],
                ['room-8', 'room-9']
            ];
            
            for (const pair of adjacentPairs) {
                if (pair.every(table => !usedTables.has(table))) {
                    console.log(`룸 인접 테이블 배정: ${pair.join(', ')} (${people}명)`);
                    return pair;
                }
            }
            
            // 4. 비인접 테이블도 시도
            const availableTables = [];
            for (let i = 1; i <= 9; i++) {
                const tableId = `room-${i}`;
                if (!usedTables.has(tableId)) {
                    availableTables.push(tableId);
                }
            }
            
            if (availableTables.length >= 2) {
                console.log(`룸 개별 테이블 2개 배정: ${availableTables.slice(0, 2).join(', ')} (${people}명)`);
                return availableTables.slice(0, 2);
            }
        }
        
        console.log(`룸 단체석 불가: ${people}명 (사용 가능한 단체석 없음)`);
    }
    
    return [];
}

// 홀 배정 시도
function tryHallAssignment(people, usedTables) {
    // 5명이고 홀 1번 테이블 사용 가능한 경우 (1번 테이블은 5명까지 수용)
    if (people === 5 && !usedTables.has('hall-1')) {
        console.log(`홀 1번 테이블 배정 (5명 전용)`);
        return ['hall-1'];
    }
    
    // 4명 이하 개별 테이블 배정
    if (people <= 4) {
        // 홀 1번은 5명 테이블이지만 4명 이하도 앉을 수 있음
        for (let i = 1; i <= 16; i++) {
            const tableId = `hall-${i}`;
            if (!usedTables.has(tableId)) {
                console.log(`홀 개별 테이블 배정: ${tableId} (${people}명)`);
                return [tableId];
            }
        }
        console.log(`홀 개별 테이블 불가: 사용 가능한 테이블 없음`);
        return [];
    }
    
    // 단체석 시도 (5명 이상)
    if (people >= 5) {
        // 1. 정확히 맞는 단체석 규칙 적용
        const hallGroupRules = GROUP_RULES.filter(rule => 
            rule.tables.every(t => t.startsWith('hall-')) && 
            rule.maxPeople >= people &&
            rule.minPeople <= people
        ).sort((a, b) => a.maxPeople - b.maxPeople);
        
        for (const rule of hallGroupRules) {
            if (rule.tables.every(table => !usedTables.has(table))) {
                console.log(`홀 단체석 배정: ${rule.name} (${people}명)`);
                return rule.tables;
            }
        }
        
        // 2. 최소 인원 조건 완화 시도
        const potentialRules = GROUP_RULES.filter(rule => 
            rule.tables.every(t => t.startsWith('hall-')) && 
            rule.maxPeople >= people
        ).sort((a, b) => a.maxPeople - b.maxPeople);
        
        for (const rule of potentialRules) {
            if (rule.tables.every(table => !usedTables.has(table))) {
                console.log(`홀 단체석 배정(최소 인원 미달): ${rule.name} (${people}명)`);
                return rule.tables;
            }
        }
        
        // 3. 홀 1번 테이블 특별 케이스 (6~9명)
        if (people >= 6 && people <= 9 && !usedTables.has('hall-1') && !usedTables.has('hall-2')) {
            console.log(`홀 1,2번 테이블 배정 (6-9명)`);
            return ['hall-1', 'hall-2'];
        }
        
        // 4. 인접 테이블 조합 시도 (8명까지) - 9번 이후 테이블은 단체 불가
        if (people <= 8) {
            const adjacentPairs = [
                ['hall-3', 'hall-4'],
                ['hall-4', 'hall-5'],
                ['hall-5', 'hall-6'],
                ['hall-6', 'hall-7'],
                ['hall-7', 'hall-8']
            ];
            
            for (const pair of adjacentPairs) {
                if (pair.every(table => !usedTables.has(table))) {
                    console.log(`홀 인접 테이블 배정: ${pair.join(', ')} (${people}명)`);
                    return pair;
                }
            }
            
            // 5. 비인접 테이블도 시도 - 단, 9번 이후 테이블은 단체 불가
            const availableTables = [];
            for (let i = 1; i <= 8; i++) { // 1~8번만 고려
                const tableId = `hall-${i}`;
                if (!usedTables.has(tableId)) {
                    availableTables.push(tableId);
                }
            }
            
            if (availableTables.length >= 2) {
                console.log(`홀 개별 테이블 2개 배정: ${availableTables.slice(0, 2).join(', ')} (${people}명)`);
                return availableTables.slice(0, 2);
            }
        }
        
        console.log(`홀 단체석 불가: ${people}명 (사용 가능한 단체석 없음)`);
    }
    
    return [];
}

// 재배정 시도 (주요 로직)
function tryReassignment(people, preference, conflictingReservations, allReservations) {
    console.log(`재배정 시도: ${people}명, 선호도: ${preference}`);
    
    // 룸 선호 고객을 위한 재배정
    if (preference === 'room' || preference === 'any') {
        // 1. 현재 룸에 있지만 '관계없음' 또는 '홀 선호' 고객 찾기
        const flexibleInRoom = conflictingReservations.filter(r => 
            (r.preference === 'any' || r.preference === 'hall') && 
            r.tables && 
            r.tables.some(t => t.startsWith('room-'))
        );
        
        console.log(`룸에 있는 유연한 고객 ${flexibleInRoom.length}명 발견`);
        
        // 2. 각 유연한 고객을 홀로 이동 시도
        for (const flexibleReservation of flexibleInRoom) {
            console.log(`${flexibleReservation.name}님(${flexibleReservation.people}명) 홀 이동 시도...`);
            
            // 이 고객을 제외한 나머지 예약
            const otherReservations = conflictingReservations.filter(r => r.id !== flexibleReservation.id);
            const usedTablesWithoutFlexible = getUsedTables(otherReservations);
            
            // 홀로 이동 가능한지 확인
            const hallOptions = tryHallAssignment(flexibleReservation.people, usedTablesWithoutFlexible);
            
            if (hallOptions.length > 0) {
                console.log(`${flexibleReservation.name}님 홀 이동 가능: ${hallOptions.join(', ')}`);
                
                // 홀로 이동 후 남은 테이블에서 룸 예약 가능한지 확인
                const finalUsedTables = new Set(usedTablesWithoutFlexible);
                hallOptions.forEach(table => finalUsedTables.add(table));
                
                const roomForNewCustomer = tryRoomAssignment(people, finalUsedTables);
                
                if (roomForNewCustomer.length > 0) {
                    // 실제로 재배정 실행 (이 예약의 테이블 수정)
                    console.log(`✅ 재배정 성공: ${flexibleReservation.name}님을 룸 ${flexibleReservation.tables.join(', ')}에서 홀 ${hallOptions.join(', ')}로 이동`);
                    
                    // 실제 예약 데이터 수정
                    const reservationIndex = allReservations.findIndex(r => r.id === flexibleReservation.id);
                    if (reservationIndex !== -1) {
                        allReservations[reservationIndex].tables = hallOptions;
                        allReservations[reservationIndex].reassigned = true;
                    }
                    
                    return roomForNewCustomer;
                }
            } else {
                console.log(`${flexibleReservation.name}님 홀 이동 불가`);
            }
        }
    }
    
    // 홀 선호 고객을 위한 재배정
    if (preference === 'hall' || preference === 'any') {
        // 특별한 경우: 5명이 홀 1번 테이블 필요
        if (people === 5) {
            const flexibleInHall1 = conflictingReservations.find(r => 
                r.preference === 'any' && 
                r.tables && 
                r.tables.includes('hall-1')
            );
            
            if (flexibleInHall1) {
                console.log(`홀 1번에 ${flexibleInHall1.name}님(관계없음) 발견, 이동 시도`);
                
                const otherReservations = conflictingReservations.filter(r => r.id !== flexibleInHall1.id);
                const usedTablesWithoutFlexible = getUsedTables(otherReservations);
                
                // 룸 우선 시도
                let alternativeOptions = tryRoomAssignment(flexibleInHall1.people, usedTablesWithoutFlexible);
                if (alternativeOptions.length === 0) {
                    // 다른 홀 테이블 시도
                    alternativeOptions = tryHallAssignment(flexibleInHall1.people, usedTablesWithoutFlexible);
                }
                
                if (alternativeOptions.length > 0) {
                    console.log(`✅ 홀1번 재배정 성공: ${flexibleInHall1.name}님을 ${alternativeOptions.join(', ')}로 이동`);
                    
                    // 실제 예약 데이터 수정
                    const reservationIndex = allReservations.findIndex(r => r.id === flexibleInHall1.id);
                    if (reservationIndex !== -1) {
                        allReservations[reservationIndex].tables = alternativeOptions;
                        allReservations[reservationIndex].reassigned = true;
                    }
                    
                    return ['hall-1'];
                }
            }
        }

        // 1. 현재 홀에 있지만 '관계없음' 또는 '룸 선호' 고객 찾기
        const flexibleInHall = conflictingReservations.filter(r => 
            (r.preference === 'any' || r.preference === 'room') && 
            r.tables && 
            r.tables.some(t => t.startsWith('hall-'))
        );
        
        console.log(`홀에 있는 유연한 고객 ${flexibleInHall.length}명 발견`);
        
        // 2. 각 유연한 고객을 룸으로 이동 시도
        for (const flexibleReservation of flexibleInHall) {
            // 인원이 4명 이하인 고객만 룸으로 이동 가능 (4명 초과는 개별 룸 테이블 불가)
            if (flexibleReservation.people <= 4) {
                console.log(`${flexibleReservation.name}님(${flexibleReservation.people}명) 룸 이동 시도...`);
                
                // 이 고객을 제외한 나머지 예약
                const otherReservations = conflictingReservations.filter(r => r.id !== flexibleReservation.id);
                const usedTablesWithoutFlexible = getUsedTables(otherReservations);
                
                // 룸으로 이동 가능한지 확인
                const roomOptions = tryRoomAssignment(flexibleReservation.people, usedTablesWithoutFlexible);
                
                if (roomOptions.length > 0) {
                    console.log(`${flexibleReservation.name}님 룸 이동 가능: ${roomOptions.join(', ')}`);
                    
                    // 룸으로 이동 후 남은 테이블에서 홀 예약 가능한지 확인
                    const finalUsedTables = new Set(usedTablesWithoutFlexible);
                    roomOptions.forEach(table => finalUsedTables.add(table));
                    
                    const hallForNewCustomer = tryHallAssignment(people, finalUsedTables);
                    
                    if (hallForNewCustomer.length > 0) {
                        // 실제로 재배정 실행
                        console.log(`✅ 재배정 성공: ${flexibleReservation.name}님을 홀 ${flexibleReservation.tables.join(', ')}에서 룸 ${roomOptions.join(', ')}로 이동`);
                        
                        // 실제 예약 데이터 수정
                        const reservationIndex = allReservations.findIndex(r => r.id === flexibleReservation.id);
                        if (reservationIndex !== -1) {
                            allReservations[reservationIndex].tables = roomOptions;
                            allReservations[reservationIndex].reassigned = true;
                        }
                        
                        return hallForNewCustomer;
                    }
                } else {
                    console.log(`${flexibleReservation.name}님 룸 이동 불가`);
                }
            }
        }
    }
    
    console.log('재배정 실패: 가능한 시나리오 없음');
    return [];
}

// 단체석 사용 가능 여부 체크 함수
function checkGroupAvailability(rule, dayReservations) {
    const usedTables = new Set();
    dayReservations.forEach(r => {
        if (r.tables) {
            r.tables.forEach(table => usedTables.add(table));
        }
    });
    return rule.tables.every(table => !usedTables.has(table));
}

// 시간 겹침 체크
function isTimeOverlap(time1, time2) {
    if (time2 === 'all') return true;
    
    const start1 = time1;
    const end1 = addHours(time1, 3);
    const start2 = time2;
    const end2 = addHours(time2, 3);
    return !(end1 <= start2 || end2 <= start1);
}

// 시간에 시간 더하기
function addHours(timeStr, hours) {
    const [hour, minute] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hour + hours, minute);
    return date.toTimeString().slice(0, 5);
}

// 테이블 세트가 동일한지 확인하는 유틸리티 함수
function isEqualTableSet(tables1, tables2) {
    if (tables1.length !== tables2.length) return false;
    
    const set1 = new Set(tables1);
    return tables2.every(t => set1.has(t));
}