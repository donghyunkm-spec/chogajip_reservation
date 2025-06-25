// 테이블 정보 (테이블별 수용 인원)
const TABLE_INFO = {
    hall: {
        1: { capacity: 5 },  // 홀 1번 테이블은 5명까지
        2: { capacity: 4 },
        3: { capacity: 4 },
        4: { capacity: 4 },
        5: { capacity: 4 },
        6: { capacity: 4 },
        7: { capacity: 4 },
        8: { capacity: 4 },
        9: { capacity: 4 },
        10: { capacity: 4 },
        11: { capacity: 4 },
        12: { capacity: 4 },
        13: { capacity: 4 },
        14: { capacity: 4 },
        15: { capacity: 4 },
        16: { capacity: 4 }
    },
    room: {
        1: { capacity: 4 },  // 룸 1번 테이블은 4명까지
        2: { capacity: 4 },
        3: { capacity: 4 },
        4: { capacity: 4 },
        5: { capacity: 4 },
        6: { capacity: 4 },
        7: { capacity: 4 },
        8: { capacity: 4 },
        9: { capacity: 4 }
    }
};

// 단체석 규칙 정의
const GROUP_RULES = [
    {
        id: 'hall-1',
        name: '홀 1번 테이블',
        tables: ['hall-1'],
        maxPeople: 5,
        minPeople: 5
    },
    {
        id: 'hall-1-2',
        name: '홀 1-2번 테이블',
        tables: ['hall-1', 'hall-2'],
        minPeople: 6,
        maxPeople: 9
    },
    {
        id: 'hall-4-5',
        name: '홀 4-5번 테이블',
        tables: ['hall-4', 'hall-5'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'hall-6-7',
        name: '홀 6-7번 테이블',
        tables: ['hall-6', 'hall-7'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'hall-4-5-6-7',
        name: '홀 4-5-6-7번 테이블',
        tables: ['hall-4', 'hall-5', 'hall-6', 'hall-7'],
        minPeople: 13,
        maxPeople: 16
    },
    {
        id: 'hall-3-4-5-6-7',
        name: '홀 3-4-5-6-7번 테이블',
        tables: ['hall-3', 'hall-4', 'hall-5', 'hall-6', 'hall-7'],
        minPeople: 17,
        maxPeople: 20
    },
    {
        id: 'hall-4-5-6-7-8',
        name: '홀 4-5-6-7-8번 테이블',
        tables: ['hall-4', 'hall-5', 'hall-6', 'hall-7', 'hall-8'],
        minPeople: 17,
        maxPeople: 20
    },
    {
        id: 'hall-3-4-5-6-7-8',
        name: '홀 3-4-5-6-7-8번 테이블',
        tables: ['hall-3', 'hall-4', 'hall-5', 'hall-6', 'hall-7', 'hall-8'],
        minPeople: 21,
        maxPeople: 24
    },
    {
        id: 'room-1-2-3',
        name: '룸 1-2-3번',
        tables: ['room-1', 'room-2', 'room-3'],
        minPeople: 9,
        maxPeople: 12
    },
    {
        id: 'room-4-5-6',
        name: '룸 4-5-6번',
        tables: ['room-4', 'room-5', 'room-6'],
        minPeople: 9,
        maxPeople: 12
    },
    {
        id: 'room-7-8-9',
        name: '룸 7-8-9번',
        tables: ['room-7', 'room-8', 'room-9'],
        minPeople: 9,
        maxPeople: 12
    },
    {
        id: 'room-4-9',
        name: '룸 4-9번',
        tables: ['room-4', 'room-5', 'room-6', 'room-7', 'room-8', 'room-9'],
        minPeople: 13,
        maxPeople: 24
    },
    {
        id: 'room-1-2',
        name: '룸 1-2번',
        tables: ['room-1', 'room-2'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'room-2-3',
        name: '룸 2-3번',
        tables: ['room-2', 'room-3'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'room-4-5',
        name: '룸 4-5번',
        tables: ['room-4', 'room-5'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'room-5-6',
        name: '룸 5-6번',
        tables: ['room-5', 'room-6'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'room-7-8',
        name: '룸 7-8번',
        tables: ['room-7', 'room-8'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'room-8-9',
        name: '룸 8-9번',
        tables: ['room-8', 'room-9'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'room-4-5-7-8',
        name: '룸 4-5-7-8번',
        tables: ['room-4', 'room-5', 'room-7', 'room-8'],
        minPeople: 13,
        maxPeople: 16
    },
    {
        id: 'room-5-6-8-9',
        name: '룸 5-6-8-9번',
        tables: ['room-5', 'room-6', 'room-8', 'room-9'],
        minPeople: 13,
        maxPeople: 16
    },
    {
        id: 'room-all',
        name: '룸 전체',
        tables: ['room-1', 'room-2', 'room-3', 'room-4', 'room-5', 'room-6', 'room-7', 'room-8', 'room-9'],
        minPeople: 25,
        maxPeople: 36
    }
];

// 시간 겹침 확인 함수
function isTimeOverlap(time1, time2) {
    // 같은 시간이면 겹침
    if (time1 === time2) return true;
    
    // 3시간 이용 기준으로 계산
    const [hour1, minute1] = time1.split(':').map(Number);
    const [hour2, minute2] = time2.split(':').map(Number);
    
    const startTime1 = hour1 * 60 + minute1;
    const endTime1 = startTime1 + 180; // 3시간 이용
    
    const startTime2 = hour2 * 60 + minute2;
    const endTime2 = startTime2 + 180; // 3시간 이용
    
    // 시간 범위가 겹치는지 확인
    return (startTime1 < endTime2 && startTime2 < endTime1);
}

// 시간에 시간 추가하는 함수
function addHours(timeStr, hours) {
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    
    hour = (hour + hours) % 24;
    
    return `${hour.toString().padStart(2, '0')}:${minuteStr}`;
}

// 사용 중인 테이블 목록 가져오기
function getUsedTables(reservations) {
    const usedTables = new Set();
    
    reservations.forEach(reservation => {
        if (reservation.tables && reservation.tables.length > 0) {
            reservation.tables.forEach(table => usedTables.add(table));
        }
    });
    
    return usedTables;
}

// 단체석 가용 여부 확인
function checkGroupAvailability(groupRule, reservations) {
    const usedTables = getUsedTables(reservations);
    
    // 이 단체석의 테이블 중 하나라도 사용 중이면 불가능
    for (const table of groupRule.tables) {
        if (usedTables.has(table)) {
            return false;
        }
    }
    
    return true;
}

// 룸 테이블 배정 시도
function tryRoomAssignment(people, usedTables) {
    // 1명~4명: 기본 룸 테이블 배정
    if (people <= 4) {
        // 비어있는 룸 테이블 찾기
        for (let i = 1; i <= 9; i++) {
            const tableId = `room-${i}`;
            if (!usedTables.has(tableId)) {
                return [tableId];
            }
        }
        return []; // 가능한 테이블 없음
    }
    
    // 5명 이상: 단체석 규칙 적용
    const suitableRules = GROUP_RULES
        .filter(rule => 
            rule.tables.every(t => t.startsWith('room-')) &&
            rule.minPeople <= people && 
            rule.maxPeople >= people && 
            rule.tables.every(table => !usedTables.has(table))
        )
        .sort((a, b) => a.tables.length - b.tables.length); // 최소 테이블 사용
    
    if (suitableRules.length > 0) {
        return suitableRules[0].tables;
    }
    
    // 단체석 규칙에 맞지 않지만 5명~8명을 위한 2개 테이블 배정
    if (people <= 8) {
        const availableRoomTables = [];
        for (let i = 1; i <= 9; i++) {
            const tableId = `room-${i}`;
            if (!usedTables.has(tableId)) {
                availableRoomTables.push(tableId);
                if (availableRoomTables.length === 2) {
                    return availableRoomTables;
                }
            }
        }
    }
    
    return []; // 가능한 테이블 없음
}

// 홀 테이블 배정 시도
function tryHallAssignment(people, usedTables) {
    // 1명~4명: 기본 홀 테이블 배정 (9~16번 테이블 우선)
    if (people <= 4) {
        // 비어있는 홀 테이블 찾기 (9~16번 우선)
        for (let i = 9; i <= 16; i++) {
            const tableId = `hall-${i}`;
            if (!usedTables.has(tableId)) {
                return [tableId];
            }
        }
        
        // 1~8번 테이블 확인
        for (let i = 1; i <= 8; i++) {
            // 홀 1번은 5명 전용이므로 4명 이하에게는 마지막에 배정
            if (i === 1 && people < 5) continue;
            
            const tableId = `hall-${i}`;
            if (!usedTables.has(tableId)) {
                return [tableId];
            }
        }
        
        // 홀 1번이 마지막 선택지 (인원이 5명 미만이더라도)
        if (people < 5 && !usedTables.has('hall-1')) {
            return ['hall-1'];
        }
        
        return []; // 가능한 테이블 없음
    }
    
    // 5명: 홀 1번 테이블 우선 배정
    if (people === 5 && !usedTables.has('hall-1')) {
        return ['hall-1'];
    }
    
    // 5명 이상: 단체석 규칙 적용
    const suitableRules = GROUP_RULES
        .filter(rule => 
            rule.tables.every(t => t.startsWith('hall-')) &&
            rule.minPeople <= people && 
            rule.maxPeople >= people && 
            rule.tables.every(table => !usedTables.has(table))
        )
        .sort((a, b) => a.tables.length - b.tables.length); // 최소 테이블 사용
    
    if (suitableRules.length > 0) {
        return suitableRules[0].tables;
    }
    
    return []; // 가능한 테이블 없음
}

// 메인 테이블 배정 함수
function assignTables(people, preference, date, time, allReservations) {
    console.log(`테이블 배정 시작: ${people}명, 선호도: ${preference}, 날짜: ${date}, 시간: ${time}`);
    
    // 같은 날짜/시간대 예약 필터링
    const activeReservations = allReservations.filter(r => r.status === 'active');
    const conflictingReservations = activeReservations.filter(r => 
        r.date === date && isTimeOverlap(r.time, time)
    );
    
    // 이미 사용 중인 테이블 파악
    const usedTables = getUsedTables(conflictingReservations);
    console.log(`사용 중인 테이블: ${Array.from(usedTables).join(', ')}`);
    
    // 선호도에 따른 테이블 배정 시도
    let assignedTables = [];
    
    // 선호도 우선순위 조정: 선호도가 명확한 고객 먼저 처리
    const hasClearPreference = preference !== 'any';

    // 선호도가 있는 고객은 선호하는 테이블 유형 먼저 시도
    if (preference === 'room') {
        // 룸 우선 배정 시도
        assignedTables = tryRoomAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            console.log(`룸 배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
        
        // 룸 선호 고객을 위한 적극적인 재배정 시도
        assignedTables = tryReassignmentForRoomPreference(people, conflictingReservations, allReservations);
        
        if (assignedTables.length > 0) {
            console.log(`룸 선호 고객 재배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
        
        // 마지막으로 일반 재배정 시도
        assignedTables = tryReassignment(people, preference, conflictingReservations, allReservations, true);
        
        if (assignedTables.length > 0) {
            console.log(`재배정 성공 (선호도 고려): ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    } 
    else if (preference === 'hall') {
        // 홀 우선 배정 시도
        assignedTables = tryHallAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            console.log(`홀 배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
        
        // 홀 선호 고객을 위한 재배정 시도
        assignedTables = tryReassignment(people, preference, conflictingReservations, allReservations, true);
        
        if (assignedTables.length > 0) {
            console.log(`재배정 성공 (선호도 고려): ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    }
    else {
        // 선호도 없는 경우 룸부터 시도 (기본 정책)
        assignedTables = tryRoomAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            console.log(`선호도 없음, 룸 배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
        
        // 홀 배정 시도
        assignedTables = tryHallAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            console.log(`선호도 없음, 홀 배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    }
    
    // 직접 배정 실패 시 일반적인 재배정 시도
    if (assignedTables.length === 0) {
        console.log(`직접 배정 실패, 일반 재배정 시도...`);
        assignedTables = tryReassignment(people, preference, conflictingReservations, allReservations, false);
        
        if (assignedTables.length > 0) {
            console.log(`일반 재배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    }
    
    console.log(`모든 배정 시도 실패`);
    return []; // 배정 실패
}

// 룸 선호 고객을 위한 적극적인 재배정 시도 함수 (신규 함수)
function tryReassignmentForRoomPreference(people, conflictingReservations, allReservations) {
    console.log(`룸 선호 고객을 위한 적극적인 재배정 시도 (${people}명)`);
    
    // 1. 관계없음 선호도를 가진 고객들 중 룸에 있는 고객 전체 찾기
    const flexibleInRoom = conflictingReservations.filter(r => 
        r.preference === 'any' && 
        r.tables && 
        r.tables.some(t => t.startsWith('room-'))
    );
    
    console.log(`룸에 있는 '관계없음' 선호도 고객: ${flexibleInRoom.length}명`);
    
    // 2. 룸 선호 고객에게 필요한 테이블 수 추정
    const roomTablesNeeded = people <= 4 ? 1 : Math.ceil(people / 4);
    console.log(`필요한 룸 테이블 수: ${roomTablesNeeded}개`);
    
    // 3. 관계없음 선호도 고객이 현재 사용 중인 룸 테이블 확인
    const roomTablesUsedByFlexible = new Set();
    flexibleInRoom.forEach(r => {
        r.tables.forEach(t => {
            if (t.startsWith('room-')) {
                roomTablesUsedByFlexible.add(t);
            }
        });
    });
    
    console.log(`관계없음 선호도 고객이 사용 중인 룸 테이블: ${Array.from(roomTablesUsedByFlexible).join(', ')}`);
    
    // 필요한 테이블 수가 관계없음 고객이 사용 중인 테이블 수보다 많으면 실패
    if (roomTablesNeeded > roomTablesUsedByFlexible.size) {
        console.log(`필요한 테이블 수(${roomTablesNeeded})가 관계없음 고객이 사용 중인 테이블 수(${roomTablesUsedByFlexible.size})보다 많음, 재배정 실패`);
        return [];
    }
    
    // 4. 단일 테이블 필요 시 (1-4명) 간단하게 처리
    if (roomTablesNeeded === 1) {
        // 단일 테이블만 사용하는 관계없음 고객 찾기
        const singleTableUsers = flexibleInRoom.filter(r => r.tables.length === 1);
        
        for (const customer of singleTableUsers) {
            const roomTable = customer.tables[0]; // 현재 사용 중인 룸 테이블
            console.log(`단일 테이블 사용 고객 발견: ${customer.name}님 (${roomTable})`);
            
            // 이 고객 외 다른 예약
            const otherReservations = conflictingReservations.filter(r => r.id !== customer.id);
            const usedTablesWithoutCustomer = getUsedTables(otherReservations);
            
            // 홀로 이동 가능한지 시도
            const hallOptions = tryHallAssignment(customer.people, usedTablesWithoutCustomer);
            
            if (hallOptions.length > 0) {
                console.log(`✅ ${customer.name}님을 홀로 이동 가능: ${hallOptions.join(', ')}`);
                
                // 실제 예약 데이터 수정
                const index = allReservations.findIndex(r => r.id === customer.id);
                if (index !== -1) {
                    console.log(`${customer.name}님의 테이블을 ${roomTable}에서 ${hallOptions.join(', ')}로 변경`);
                    allReservations[index].tables = hallOptions;
                    allReservations[index].reassigned = true;
                }
                
                return [roomTable]; // 비워진 룸 테이블 반환
            }
        }
    }
    
    // 5. 여러 테이블 필요 시 (5명 이상) 단체석 규칙 확인
    if (roomTablesNeeded > 1) {
        // 목표 인원에 맞는 룸 단체석 규칙 찾기
        const suitableRules = GROUP_RULES
            .filter(rule => 
                rule.tables.every(t => t.startsWith('room-')) &&
                rule.minPeople <= people && 
                rule.maxPeople >= people
            )
            .sort((a, b) => a.tables.length - b.tables.length); // 최소 테이블 규칙 우선
        
        // 각 단체석 규칙에 대해 시도
        for (const rule of suitableRules) {
            console.log(`단체석 규칙 시도: ${rule.name} (${rule.tables.join(', ')})`);
            
            // 이 단체석의 테이블 중 현재 관계없음 고객이 사용 중인 테이블 확인
            const flexibleCustomersUsingTheseRoomTables = flexibleInRoom.filter(r => 
                r.tables.some(t => rule.tables.includes(t))
            );
            
            // 이 단체석에 관계없음 고객이 없으면 다음 규칙 시도
            if (flexibleCustomersUsingTheseRoomTables.length === 0) {
                console.log(`${rule.name}에 '관계없음' 선호도 고객이 없음, 다음 규칙 시도`);
                continue;
            }
            
            console.log(`${rule.name}에 '관계없음' 선호도 고객 ${flexibleCustomersUsingTheseRoomTables.length}명 발견`);
            
            // 관계없음 고객이 사용 중인 테이블만 포함하는 룸 테이블
            const roomTablesUsedByThisRule = new Set();
            flexibleCustomersUsingTheseRoomTables.forEach(r => {
                r.tables.forEach(t => {
                    if (rule.tables.includes(t)) {
                        roomTablesUsedByThisRule.add(t);
                    }
                });
            });
            
            // 모든 필요 테이블이 관계없음 고객에 의해 사용 중인지 확인
            const allTablesUsedByFlexible = rule.tables.every(t => 
                roomTablesUsedByThisRule.has(t)
            );
            
            if (!allTablesUsedByFlexible) {
                console.log(`${rule.name}의 일부 테이블이 관계없음 외 고객에 의해 사용 중, 다음 규칙 시도`);
                continue;
            }
            
            // 모든 관계없음 고객을 홀로 이동 시도
            let allCanMove = true;
            const customersToMove = [];
            const newAssignments = [];
            
            // 이 고객들 외 다른 예약
            const otherReservations = conflictingReservations.filter(r => 
                !flexibleCustomersUsingTheseRoomTables.some(c => c.id === r.id)
            );
            let currentUsedTables = getUsedTables(otherReservations);
            
            // 각 고객에 대해 홀 이동 시도
            for (const customer of flexibleCustomersUsingTheseRoomTables) {
                console.log(`${customer.name}님(${customer.people}명) 홀 이동 시도...`);
                
                const hallOptions = tryHallAssignment(customer.people, currentUsedTables);
                
                if (hallOptions.length > 0) {
                    console.log(`${customer.name}님 홀 이동 가능: ${hallOptions.join(', ')}`);
                    customersToMove.push(customer);
                    newAssignments.push({
                        customer: customer,
                        newTables: hallOptions
                    });
                    
                    // 사용 테이블 업데이트
                    hallOptions.forEach(t => currentUsedTables.add(t));
                } else {
                    console.log(`${customer.name}님 홀 이동 불가`);
                    allCanMove = false;
                    break;
                }
            }
            
            if (allCanMove && customersToMove.length > 0) {
                console.log(`✅ 모든 고객 홀 이동 가능, 재배정 성공!`);
                
                // 실제 예약 데이터 수정
                newAssignments.forEach(moved => {
                    const index = allReservations.findIndex(r => r.id === moved.customer.id);
                    if (index !== -1) {
                        console.log(`${moved.customer.name}님의 테이블을 ${moved.customer.tables.join(', ')}에서 ${moved.newTables.join(', ')}로 변경`);
                        allReservations[index].tables = moved.newTables;
                        allReservations[index].reassigned = true;
                    }
                });
                
                return rule.tables; // 비워진 룸 테이블 반환
            }
        }
    }
    
    // 6. 더 복잡한 경우: 여러 관계없음 고객의 조합 시도
    if (roomTablesNeeded > 1 && flexibleInRoom.length >= 2) {
        console.log(`복잡한 조합 시도: ${flexibleInRoom.length}명의 관계없음 고객 중 ${roomTablesNeeded}개 테이블 확보 시도`);
        
        // 모든 가능한 조합 생성 (최대 4명까지만 시도)
        const maxCustomers = Math.min(4, flexibleInRoom.length);
        
        for (let count = 2; count <= maxCustomers; count++) {
            const combinations = getCombinations(flexibleInRoom, count);
            
            for (const combo of combinations) {
                // 이 조합의 고객들이 사용하는 룸 테이블 확인
                const roomTablesUsedByCombo = new Set();
                combo.forEach(c => {
                    c.tables.forEach(t => {
                        if (t.startsWith('room-')) {
                            roomTablesUsedByCombo.add(t);
                        }
                    });
                });
                
                // 필요한 테이블 수를 확보할 수 있는지 확인
                if (roomTablesUsedByCombo.size >= roomTablesNeeded) {
                    console.log(`가능한 조합 발견: ${combo.map(c => c.name).join(', ')} (${Array.from(roomTablesUsedByCombo).join(', ')})`);
                    
                    // 이 조합의 모든 고객을 홀로 이동할 수 있는지 확인
                    let allCanMove = true;
                    const newAssignments = [];
                    
                    // 이 고객들 외 다른 예약
                    const otherReservations = conflictingReservations.filter(r => 
                        !combo.some(c => c.id === r.id)
                    );
                    let currentUsedTables = getUsedTables(otherReservations);
                    
                    // 각 고객에 대해 홀 이동 시도
                    for (const customer of combo) {
                        const hallOptions = tryHallAssignment(customer.people, currentUsedTables);
                        
                        if (hallOptions.length > 0) {
                            newAssignments.push({
                                customer: customer,
                                newTables: hallOptions
                            });
                            
                            // 사용 테이블 업데이트
                            hallOptions.forEach(t => currentUsedTables.add(t));
                        } else {
                            allCanMove = false;
                            break;
                        }
                    }
                    
                    if (allCanMove && newAssignments.length > 0) {
                        console.log(`✅ 조합 재배정 성공!`);
                        
                        // 실제 예약 데이터 수정
                        newAssignments.forEach(moved => {
                            const index = allReservations.findIndex(r => r.id === moved.customer.id);
                            if (index !== -1) {
                                console.log(`${moved.customer.name}님의 테이블을 ${moved.customer.tables.join(', ')}에서 ${moved.newTables.join(', ')}로 변경`);
                                allReservations[index].tables = moved.newTables;
                                allReservations[index].reassigned = true;
                            }
                        });
                        
                        // 단체석 규칙 확인
                        if (people > 4) {
                            const possibleRules = GROUP_RULES.filter(rule => 
                                rule.tables.every(t => t.startsWith('room-')) &&
                                rule.minPeople <= people && 
                                rule.maxPeople >= people &&
                                rule.tables.every(t => roomTablesUsedByCombo.has(t))
                            );
                            
                            if (possibleRules.length > 0) {
                                // 가장 테이블 수가 적은 규칙 선택
                                const bestRule = possibleRules.sort((a, b) => a.tables.length - b.tables.length)[0];
                                return bestRule.tables;
                            }
                        }
                        
                        // 규칙 없으면 필요한 수만큼 테이블 반환
                        return Array.from(roomTablesUsedByCombo).slice(0, roomTablesNeeded);
                    }
                }
            }
        }
    }
    
    // 7. 마지막 시도: 관계없음 고객 중 가장 인원수가 적은 고객부터 이동
    if (flexibleInRoom.length > 0) {
        console.log(`마지막 시도: 인원수가 적은 관계없음 고객부터 이동`);
        
        // 인원수 적은 순으로 정렬
        const sortedFlexible = [...flexibleInRoom].sort((a, b) => a.people - b.people);
        
        for (const customer of sortedFlexible) {
            console.log(`${customer.name}님(${customer.people}명) 홀 이동 시도...`);
            
            // 이 고객 외 다른 예약
            const otherReservations = conflictingReservations.filter(r => r.id !== customer.id);
            const usedTablesWithoutCustomer = getUsedTables(otherReservations);
            
            // 홀로 이동 가능한지 시도
            const hallOptions = tryHallAssignment(customer.people, usedTablesWithoutCustomer);
            
            if (hallOptions.length > 0) {
                console.log(`✅ ${customer.name}님을 홀로 이동 가능: ${hallOptions.join(', ')}`);
                
                // 이동 후 신규 예약을 위한 룸 테이블 확인
                const roomTablesFreed = customer.tables.filter(t => t.startsWith('room-'));
                
                if (roomTablesFreed.length > 0) {
                    // 실제 예약 데이터 수정
                    const index = allReservations.findIndex(r => r.id === customer.id);
                    if (index !== -1) {
                        console.log(`${customer.name}님의 테이블을 ${customer.tables.join(', ')}에서 ${hallOptions.join(', ')}로 변경`);
                        allReservations[index].tables = hallOptions;
                        allReservations[index].reassigned = true;
                    }
                    
                    // 단일 테이블이면 바로 반환
                    if (roomTablesNeeded === 1 && roomTablesFreed.length >= 1) {
                        return [roomTablesFreed[0]];
                    }
                    
                    // 여러 테이블 필요한 경우 계속 시도
                    if (roomTablesNeeded > 1) {
                        // 다른 고객도 이동 시도
                        const remainingReservations = conflictingReservations.filter(r => 
                            r.id !== customer.id && 
                            r.preference === 'any' && 
                            r.tables.some(t => t.startsWith('room-'))
                        );
                        
                        // 단계적으로 누적된 사용 테이블
                        let currentUsedTables = getUsedTables(otherReservations);
                        hallOptions.forEach(t => currentUsedTables.add(t));
                        
                        const freedTables = [roomTablesFreed[0]]; // 첫번째 테이블은 이미 확보
                        const movedCustomers = [customer]; // 이미 이동된 고객
                        
                        // 추가 고객 이동 시도
                        for (const nextCustomer of remainingReservations) {
                            if (freedTables.length >= roomTablesNeeded) break; // 필요한 테이블 확보 완료
                            
                            // 다른 고객 홀 이동 시도
                            const nextHallOptions = tryHallAssignment(nextCustomer.people, currentUsedTables);
                            
                            if (nextHallOptions.length > 0) {
                                console.log(`${nextCustomer.name}님도 홀로 이동 가능: ${nextHallOptions.join(', ')}`);
                                
                                // 이동 후 추가 룸 테이블 확인
                                const nextRoomTablesFreed = nextCustomer.tables.filter(t => t.startsWith('room-'));
                                
                                if (nextRoomTablesFreed.length > 0) {
                                    // 실제 예약 데이터 수정
                                    const index = allReservations.findIndex(r => r.id === nextCustomer.id);
                                    if (index !== -1) {
                                        console.log(`${nextCustomer.name}님의 테이블을 ${nextCustomer.tables.join(', ')}에서 ${nextHallOptions.join(', ')}로 변경`);
                                        allReservations[index].tables = nextHallOptions;
                                        allReservations[index].reassigned = true;
                                    }
                                    
                                    // 확보된 테이블 추가
                                    freedTables.push(nextRoomTablesFreed[0]);
                                    movedCustomers.push(nextCustomer);
                                    
                                    // 사용 테이블 업데이트
                                    nextHallOptions.forEach(t => currentUsedTables.add(t));
                                }
                            }
                        }
                        
                        // 필요한 테이블 수를 확보했는지 확인
                        if (freedTables.length >= roomTablesNeeded) {
                            console.log(`✅ 연속 재배정 성공! ${movedCustomers.length}명 이동으로 ${freedTables.length}개 테이블 확보`);
                            return freedTables.slice(0, roomTablesNeeded); // 필요한 만큼만 반환
                        }
                    }
                }
            }
        }
    }
    
    console.log(`룸 선호 고객을 위한 적극적인 재배정 실패`);
    return []; // 실패
}

// 재배정 시도 (기존 함수)
function tryReassignment(people, preference, conflictingReservations, allReservations, prioritizePreference = false) {
    console.log(`재배정 시도: ${people}명, 선호도: ${preference}, 선호도 우선: ${prioritizePreference}`);
    
    // 선호도 우선일 경우, 선호도 없거나 반대 선호도 가진 고객 먼저 이동 시도
    if (prioritizePreference) {
        if (preference === 'room') {
            // 룸 선호 고객을 위해 더 적극적으로 재배정 시도
            // 1. 현재 룸에 있지만 선호도가 '관계없음'이거나 '홀 선호'인 모든 고객 찾기
            const flexibleInRoom = conflictingReservations.filter(r => 
                (r.preference === 'any' || r.preference === 'hall') && 
                r.tables && 
                r.tables.some(t => t.startsWith('room-'))
            );
            
            // 타겟 테이블 찾기 - 이 고객들이 차지하고 있는 룸 테이블 중
            // 새 예약의 인원수와 적합한 테이블 조합 찾기
            const roomGroupRules = GROUP_RULES.filter(rule => 
                rule.tables.every(t => t.startsWith('room-')) && 
                rule.minPeople <= people && 
                rule.maxPeople >= people
            ).sort((a, b) => a.tables.length - b.tables.length);
            
            for (const rule of roomGroupRules) {
                // 이 룸 조합이 적합한지 확인
                const tablesUsedByFlexible = flexibleInRoom
                    .filter(r => r.tables.some(t => rule.tables.includes(t)))
                    .flatMap(r => r.tables.filter(t => t.startsWith('room-')));
                
                const uniqueTablesUsed = [...new Set(tablesUsedByFlexible)];
                
                // 이 룸 조합의 모든 테이블이 선호도 없는 고객에 의해 사용되고 있는지 확인
                const allTablesUsedByFlexible = rule.tables.every(table => 
                    uniqueTablesUsed.includes(table)
                );
                
                if (allTablesUsedByFlexible) {
                    console.log(`적합한 룸 조합 발견: ${rule.name}`);
                    
                    // 이 테이블을 사용중인 선호도 없는 고객들 찾기
                    const customersToMove = flexibleInRoom.filter(r => 
                        r.tables.some(t => rule.tables.includes(t))
                    );
                    
                    console.log(`이동 대상 고객: ${customersToMove.map(c => c.name).join(', ')}`);
                    
                    // 모든 고객을 홀로 이동시킬 수 있는지 확인
                    let allCanMove = true;
                    const movedCustomers = [];
                    const alternativeAssignments = [];
                    
                    // 이동 대상이 없는 테이블만 추려내기
                    const remainingReservations = conflictingReservations.filter(r => 
                        !customersToMove.some(c => c.id === r.id)
                    );
                    
                    // 단계적으로 고객 이동 시도
                    let currentUsedTables = getUsedTables(remainingReservations);
                    
                    for (const customer of customersToMove) {
                        // 홀 테이블로 이동 시도
                        const hallOptions = tryHallAssignment(customer.people, currentUsedTables);
                        
                        if (hallOptions.length > 0) {
                            console.log(`${customer.name}님(${customer.people}명) 홀로 이동 가능: ${hallOptions.join(', ')}`);
                            
                            // 이동 성공 기록
                            movedCustomers.push(customer);
                            alternativeAssignments.push({
                                customer: customer,
                                newTables: hallOptions
                            });
                            
                            // 사용 테이블 업데이트
                            hallOptions.forEach(table => currentUsedTables.add(table));
                        } else {
                            allCanMove = false;
                            console.log(`${customer.name}님 이동 불가`);
                            break;
                        }
                    }
                    
                    if (allCanMove && movedCustomers.length > 0) {
                        // 모든 고객 이동 가능!
                        console.log(`✅ 선호도 기반 재배정 성공: ${movedCustomers.length}명 이동`);
                        
                        // 실제 예약 데이터 수정
                        alternativeAssignments.forEach(moved => {
                            const index = allReservations.findIndex(r => r.id === moved.customer.id);
                            if (index !== -1) {
                                allReservations[index].tables = moved.newTables;
                                allReservations[index].reassigned = true;
                            }
                        });
                        
                        // 새 예약을 위한 룸 테이블 반환
                        return rule.tables;
                    }
                }
            }
            
            // 5-8명 그룹에 대한 룸 1-2, 룸 2-3 등의 특별 처리
            if (people >= 5 && people <= 8) {
                const smallRoomGroups = [
                    { name: '룸 1-2', tables: ['room-1', 'room-2'] },
                    { name: '룸 2-3', tables: ['room-2', 'room-3'] },
                    { name: '룸 4-5', tables: ['room-4', 'room-5'] },
                    { name: '룸 5-6', tables: ['room-5', 'room-6'] },
                    { name: '룸 7-8', tables: ['room-7', 'room-8'] },
                    { name: '룸 8-9', tables: ['room-8', 'room-9'] }
                ];
                
                for (const group of smallRoomGroups) {
                    // 이 룸 그룹의 모든 테이블이 선호도 없는 고객들에 의해 사용되고 있는지 확인
                    const customersUsingTheseTables = flexibleInRoom.filter(r => 
                        r.tables.some(t => group.tables.includes(t))
                    );
                    
                    // 이 그룹의 모든 테이블이 사용중인지 확인
                    const allTablesUsed = group.tables.every(table => 
                        customersUsingTheseTables.some(c => c.tables.includes(table))
                    );
                    
                    if (allTablesUsed) {
                        console.log(`적합한 소규모 룸 그룹 발견: ${group.name}`);
                        
                        // 이 테이블들의 고객을 모두 이동시킬 수 있는지 확인
                        let allCanMove = true;
                        const movedCustomers = [];
                        const alternativeAssignments = [];
                        
                        // 이동 대상이 없는 테이블만 추려내기
                        const remainingReservations = conflictingReservations.filter(r => 
                            !customersUsingTheseTables.some(c => c.id === r.id)
                        );
                        
                        // 단계적으로 고객 이동 시도
                        let currentUsedTables = getUsedTables(remainingReservations);
                        
                        for (const customer of customersUsingTheseTables) {
                            // 홀 테이블로 이동 시도
                            const hallOptions = tryHallAssignment(customer.people, currentUsedTables);
                            
                            if (hallOptions.length > 0) {
                                console.log(`${customer.name}님(${customer.people}명) 홀로 이동 가능: ${hallOptions.join(', ')}`);
                                
                                // 이동 성공 기록
                                movedCustomers.push(customer);
                                alternativeAssignments.push({
                                    customer: customer,
                                    newTables: hallOptions
                                });
                                
                                // 사용 테이블 업데이트
                                hallOptions.forEach(table => currentUsedTables.add(table));
                            } else {
                                allCanMove = false;
                                console.log(`${customer.name}님 이동 불가`);
                                break;
                            }
                        }
                        
                        if (allCanMove && movedCustomers.length > 0) {
                            // 모든 고객 이동 가능!
                            console.log(`✅ 소규모 룸 그룹 재배정 성공: ${group.name}`);
                            
                            // 실제 예약 데이터 수정
                            alternativeAssignments.forEach(moved => {
                                const index = allReservations.findIndex(r => r.id === moved.customer.id);
                                if (index !== -1) {
                                    allReservations[index].tables = moved.newTables;
                                    allReservations[index].reassigned = true;
                                }
                            });
                            
                            // 새 예약을 위한 룸 테이블 반환
                            return group.tables;
                        }
                    }
                }
            }
            
            // 개별 룸 고객들을 대상으로 시도
            if (people <= 4) {
                // 1명~4명 고객의 경우 단일 룸 찾기
                for (const flexibleCustomer of flexibleInRoom) {
                    if (flexibleCustomer.tables.length === 1) {
                        const roomTable = flexibleCustomer.tables[0];
                        console.log(`단일 룸 고객 발견: ${flexibleCustomer.name}님 (${roomTable})`);
                        
                        // 이 고객을 제외한 나머지 예약
                        const remainingReservations = conflictingReservations.filter(r => r.id !== flexibleCustomer.id);
                        const usedTablesWithoutCustomer = getUsedTables(remainingReservations);
                        
                        // 홀 테이블로 이동 시도
                        const hallOptions = tryHallAssignment(flexibleCustomer.people, usedTablesWithoutCustomer);
                        
                        if (hallOptions.length > 0) {
                            console.log(`${flexibleCustomer.name}님 홀로 이동 가능: ${hallOptions.join(', ')}`);
                            
                            // 실제 예약 데이터 수정
                            const index = allReservations.findIndex(r => r.id === flexibleCustomer.id);
                            if (index !== -1) {
                                allReservations[index].tables = hallOptions;
                                allReservations[index].reassigned = true;
                            }
                            
                            // 새 예약을 위한 룸 테이블 반환
                            return [roomTable];
                        }
                    }
                }
            }
        } 
        else if (preference === 'hall') {
            // 홀 선호 고객을 위한 재배정 시도
            // 1. 현재 홀에 있지만 선호도가 '관계없음'이거나 '룸 선호'인 고객 찾기
            const flexibleInHall = conflictingReservations.filter(r => 
                (r.preference === 'any' || r.preference === 'room') && 
                r.tables && 
                r.tables.some(t => t.startsWith('hall-'))
            );
            
            // 홀 단체석 찾기
            const hallGroupRules = GROUP_RULES.filter(rule => 
                rule.tables.every(t => t.startsWith('hall-')) && 
                rule.minPeople <= people && 
                rule.maxPeople >= people
            ).sort((a, b) => a.tables.length - b.tables.length);
            
            for (const rule of hallGroupRules) {
                // 이 홀 조합이 적합한지 확인
                const tablesUsedByFlexible = flexibleInHall
                    .filter(r => r.tables.some(t => rule.tables.includes(t)))
                    .flatMap(r => r.tables.filter(t => t.startsWith('hall-')));
                
                const uniqueTablesUsed = [...new Set(tablesUsedByFlexible)];
                
                // 이 홀 조합의 모든 테이블이 선호도 없는 고객에 의해 사용되고 있는지 확인
                const allTablesUsedByFlexible = rule.tables.every(table => 
                    uniqueTablesUsed.includes(table)
                );
                
                if (allTablesUsedByFlexible) {
                    console.log(`적합한 홀 조합 발견: ${rule.name}`);
                    
                    // 이 테이블을 사용중인 선호도 없는 고객들 찾기
                    const customersToMove = flexibleInHall.filter(r => 
                        r.tables.some(t => rule.tables.includes(t))
                    );
                    
                    console.log(`이동 대상 고객: ${customersToMove.map(c => c.name).join(', ')}`);
                    
                    // 모든 고객을 룸으로 이동시킬 수 있는지 확인
                    let allCanMove = true;
                    const movedCustomers = [];
                    const alternativeAssignments = [];
                    
                    // 이동 대상이 없는 테이블만 추려내기
                    const remainingReservations = conflictingReservations.filter(r => 
                        !customersToMove.some(c => c.id === r.id)
                    );
                    
                    // 단계적으로 고객 이동 시도
                    let currentUsedTables = getUsedTables(remainingReservations);
                    
                    for (const customer of customersToMove) {
                        // 4명 이하인 고객만 개별 룸으로 이동 가능
                        if (customer.people <= 4) {
                            // 룸 테이블로 이동 시도
                            const roomOptions = tryRoomAssignment(customer.people, currentUsedTables);
                            
                            if (roomOptions.length > 0) {
                                console.log(`${customer.name}님(${customer.people}명) 룸으로 이동 가능: ${roomOptions.join(', ')}`);
                                
                                // 이동 성공 기록
                                movedCustomers.push(customer);
                                alternativeAssignments.push({
                                    customer: customer,
                                    newTables: roomOptions
                                });
                                
                                // 사용 테이블 업데이트
                                roomOptions.forEach(table => currentUsedTables.add(table));
                            } else {
                                allCanMove = false;
                                console.log(`${customer.name}님 이동 불가`);
                                break;
                            }
                        } else {
                            // 4명 초과 고객은 룸 단체석 확인
                            const roomGroupOptions = tryRoomAssignment(customer.people, currentUsedTables);
                            
                            if (roomGroupOptions.length > 0) {
                                console.log(`${customer.name}님(${customer.people}명) 룸으로 이동 가능: ${roomGroupOptions.join(', ')}`);
                                
                                // 이동 성공 기록
                                movedCustomers.push(customer);
                                alternativeAssignments.push({
                                    customer: customer,
                                    newTables: roomGroupOptions
                                });
                                
                                // 사용 테이블 업데이트
                                roomGroupOptions.forEach(table => currentUsedTables.add(table));
                            } else {
                                allCanMove = false;
                                console.log(`${customer.name}님 이동 불가`);
                                break;
                            }
                        }
                    }
                    
                    if (allCanMove && movedCustomers.length > 0) {
                        // 모든 고객 이동 가능!
                        console.log(`✅ 선호도 기반 재배정 성공: ${movedCustomers.length}명 이동`);
                        
                        // 실제 예약 데이터 수정
                        alternativeAssignments.forEach(moved => {
                            const index = allReservations.findIndex(r => r.id === moved.customer.id);
                            if (index !== -1) {
                                allReservations[index].tables = moved.newTables;
                                allReservations[index].reassigned = true;
                            }
                        });
                        
                        // 새 예약을 위한 홀 테이블 반환
                        return rule.tables;
                    }
                }
            }
            
            // 단일 홀 5명석 (홀1) 특별 처리
            if (people === 5) {
                const hall1Reservation = conflictingReservations.find(r => 
                    r.tables && r.tables.includes('hall-1') && 
                    (r.preference === 'any' || r.preference === 'room')
                );
                
                if (hall1Reservation) {
                    console.log(`홀1번 사용 중인 선호도 없는 고객 발견: ${hall1Reservation.name}`);
                    
                    // 이 고객을 제외한 나머지 예약
                    const remainingReservations = conflictingReservations.filter(r => r.id !== hall1Reservation.id);
                    const usedTablesWithoutHall1 = getUsedTables(remainingReservations);
                    
                    // 룸 테이블로 이동 시도
                    const roomOptions = tryRoomAssignment(hall1Reservation.people, usedTablesWithoutHall1);
                    
                    if (roomOptions.length > 0) {
                        console.log(`${hall1Reservation.name}님 룸으로 이동 가능: ${roomOptions.join(', ')}`);
                        
                        // 실제 예약 데이터 수정
                        const index = allReservations.findIndex(r => r.id === hall1Reservation.id);
                        if (index !== -1) {
                            allReservations[index].tables = roomOptions;
                            allReservations[index].reassigned = true;
                        }
                        
                        // 새 예약을 위한 홀1 반환
                        return ['hall-1'];
                    }
                    
                    // 룸 안되면 다른 홀 테이블 시도
                    const otherHallOptions = tryHallAssignment(hall1Reservation.people, usedTablesWithoutHall1);
                    
                    if (otherHallOptions.length > 0 && !otherHallOptions.includes('hall-1')) {
                        console.log(`${hall1Reservation.name}님 다른 홀로 이동 가능: ${otherHallOptions.join(', ')}`);
                        
                        // 실제 예약 데이터 수정
                        const index = allReservations.findIndex(r => r.id === hall1Reservation.id);
                        if (index !== -1) {
                            allReservations[index].tables = otherHallOptions;
                            allReservations[index].reassigned = true;
                        }
                        
                        // 새 예약을 위한 홀1 반환
                        return ['hall-1'];
                    }
                }
            }
            
            // 개별 홀 테이블들을 대상으로 시도
            if (people <= 4) {
                // 1명~4명 고객의 경우 단일 홀 찾기
                for (const flexibleCustomer of flexibleInHall) {
                    if (flexibleCustomer.people <= 4 && flexibleCustomer.tables.length === 1) {
                        const hallTable = flexibleCustomer.tables[0];
                        console.log(`단일 홀 고객 발견: ${flexibleCustomer.name}님 (${hallTable})`);
                        
                        // 이 고객을 제외한 나머지 예약
                        const remainingReservations = conflictingReservations.filter(r => r.id !== flexibleCustomer.id);
                        const usedTablesWithoutCustomer = getUsedTables(remainingReservations);
                        
                        // 룸 테이블로 이동 시도
                        const roomOptions = tryRoomAssignment(flexibleCustomer.people, usedTablesWithoutCustomer);
                        
                        if (roomOptions.length > 0) {
                            console.log(`${flexibleCustomer.name}님 룸으로 이동 가능: ${roomOptions.join(', ')}`);
                            
                            // 실제 예약 데이터 수정
                            const index = allReservations.findIndex(r => r.id === flexibleCustomer.id);
                            if (index !== -1) {
                                allReservations[index].tables = roomOptions;
                                allReservations[index].reassigned = true;
                            }
                            
                            // 새 예약을 위한 홀 테이블 반환
                            return [hallTable];
                        }
                    }
                }
            }
        }
    }
    
    // 일반적인 재배정 로직 (기존 코드)
    // 단체석 대응을 위한 특별 로직 (17명 이상 대규모 단체)
    if (people >= 17 && preference === 'room') {
        console.log(`대규모 단체(${people}명) 재배정 특별 로직 시작`);
        
        // 단체석 규칙 찾기
        const largeGroupRules = GROUP_RULES.filter(rule => 
            rule.tables.every(t => t.startsWith('room-')) && 
            rule.maxPeople >= people &&
            rule.minPeople <= people
        ).sort((a, b) => a.maxPeople - b.maxPeople);
        
        if (largeGroupRules.length > 0) {
            const targetRule = largeGroupRules[0]; // 가장 적합한 단체석 규칙
            console.log(`목표 단체석: ${targetRule.name} (${targetRule.minPeople}~${targetRule.maxPeople}명)`);
            
            // 이 단체석에 있는 테이블들을 사용중인 고객들 찾기
            const reservationsToMove = conflictingReservations.filter(r => 
                r.tables && r.tables.some(t => targetRule.tables.includes(t))
            );
            
            // 선호도가 '관계없음'인 고객들 먼저 이동 시도
            const flexibleCustomers = reservationsToMove.filter(r => r.preference === 'any');
            const roomPreferCustomers = reservationsToMove.filter(r => r.preference === 'room');
            
            // 정렬된 이동 대상 (선호도 없는 고객 우선, 그 다음 룸 선호 고객)
            const sortedCustomers = [...flexibleCustomers, ...roomPreferCustomers];
            
            if (sortedCustomers.length === 0) {
                console.log(`해당 단체석에 이동 가능한 고객이 없음`);
            } else {
                console.log(`${sortedCustomers.length}명의 고객 이동 시도`);
                
                // 각 고객을 이동시킬 수 있는지 확인
                const movedCustomers = [];
                const failedCustomers = [];
                
                // 이동 과정에서 점진적으로 사용된 테이블 추적
                let currentUsedTables = getUsedTables(conflictingReservations);
                
                // 각 고객을 순차적으로 이동 시도
                for (const customer of sortedCustomers) {
                    // 이미 이동된 고객들과 현재 고객을 제외한 나머지 예약
                    const remainingReservations = conflictingReservations.filter(r => 
                        !movedCustomers.includes(r) && r.id !== customer.id
                    );
                    
                    // 업데이트된 사용중 테이블 (이동된 고객들 제외)
                    const updatedUsedTables = getUsedTables(remainingReservations);
                    
                    // 홀 테이블로 이동 시도
                    const hallOptions = tryHallAssignment(customer.people, updatedUsedTables);
                    
                    if (hallOptions.length > 0) {
                        console.log(`${customer.name}님(${customer.people}명) 홀로 이동 가능: ${hallOptions.join(', ')}`);
                        
                        // 이동 성공, 사용 테이블 업데이트
                        movedCustomers.push(customer);
                        hallOptions.forEach(table => currentUsedTables.add(table));
                        
                        // 고객의 테이블 예약 업데이트
                        const index = allReservations.findIndex(r => r.id === customer.id);
                        if (index !== -1) {
                            allReservations[index].tables = hallOptions;
                            allReservations[index].reassigned = true;
                        }
                    } else {
                        // 이동 실패한 고객 기록
                        failedCustomers.push(customer);
                    }
                }
                
                console.log(`${movedCustomers.length}명 이동 성공, ${failedCustomers.length}명 이동 실패`);
                
                // 모든 필요 테이블이 비워졌는지 확인
                const stillOccupiedTables = targetRule.tables.filter(table => 
                    failedCustomers.some(r => r.tables && r.tables.includes(table))
                );
                
                if (stillOccupiedTables.length === 0) {
                    // 모든 테이블 확보 성공!
                    console.log(`✅ 단체석 확보 성공: ${targetRule.name}`);
                    return targetRule.tables;
                } else {
                    console.log(`단체석 확보 실패: ${stillOccupiedTables.length}개 테이블 여전히 사용중`);
                    
                    // 부분적으로 이동한 고객들 롤백
                    movedCustomers.forEach(customer => {
                        const index = allReservations.findIndex(r => r.id === customer.id);
                        if (index !== -1) {
                            // 원래 테이블로 복원
                            const originalTables = conflictingReservations.find(r => r.id === customer.id)?.tables || [];
                            allReservations[index].tables = [...originalTables];
                            delete allReservations[index].reassigned;
                        }
                    });
                }
            }
        }
    }
    
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
        
        // 3. 더 복잡한 재배정: 여러 고객 동시 이동 시도 (단체 고객 수용을 위해)
        if (people >= 8) {
            console.log(`${people}명 단체 고객 수용을 위한 다중 재배정 시도...`);
            
            // 필요한 테이블 개수 추정 (대략적으로 인원수/4)
            const tablesNeeded = Math.ceil(people / 4);
            
            // 선호도 없는 고객들 중에서 룸에 있는 고객들
            const flexibleCustomers = conflictingReservations.filter(r => 
                r.preference === 'any' && 
                r.tables && 
                r.tables.some(t => t.startsWith('room-'))
            );
            
            // 이동 가능한 조합을 시도 (최대 3명까지 동시 이동 시도)
            for (let count = 1; count <= Math.min(3, flexibleCustomers.length); count++) {
                // 가능한 모든 조합 생성
                const combinations = getCombinations(flexibleCustomers, count);
                
                for (const combo of combinations) {
                    // 이 조합의 고객들이 사용하는 테이블 목록
                    const tablesUsedByCombo = [];
                    combo.forEach(customer => {
                        if (customer.tables) {
                            customer.tables.forEach(table => {
                                if (table.startsWith('room-')) {
                                    tablesUsedByCombo.push(table);
                                }
                            });
                        }
                    });
                    
                    // 이 조합이 충분한 테이블을 제공하는지 확인
                    if (tablesUsedByCombo.length >= tablesNeeded) {
                        console.log(`가능한 조합 발견: ${combo.map(c => c.name).join(', ')} (${tablesUsedByCombo.length}개 테이블)`);
                        
                        // 이 조합의 모든 고객을 홀로 이동할 수 있는지 확인
                        let allCanMove = true;
                        const movedCustomers = [];
                        
                        // 이 조합의 고객들을 제외한 나머지 예약
                        const remainingReservations = conflictingReservations.filter(r => 
                            !combo.some(c => c.id === r.id)
                        );
                        
                        // 단계적으로 고객 이동 시도
                        let currentUsedTables = getUsedTables(remainingReservations);
                        
                        for (const customer of combo) {
                            const hallOptions = tryHallAssignment(customer.people, currentUsedTables);
                            
                            if (hallOptions.length > 0) {
                                // 이 고객은 이동 가능
                                movedCustomers.push({
                                    customer: customer,
                                    newTables: hallOptions
                                });
                                
                                // 사용 테이블 업데이트
                                hallOptions.forEach(table => currentUsedTables.add(table));
                            } else {
                                allCanMove = false;
                                break;
                            }
                        }
                        
                        if (allCanMove) {
                            // 모든 고객 이동 가능!
                            console.log(`✅ 다중 재배정 성공: ${movedCustomers.length}명 이동`);
                            
                            // 실제 예약 데이터 수정
                            movedCustomers.forEach(moved => {
                                const index = allReservations.findIndex(r => r.id === moved.customer.id);
                                if (index !== -1) {
                                    allReservations[index].tables = moved.newTables;
                                    allReservations[index].reassigned = true;
                                }
                            });
                            
                            // 새 예약을 위한 룸 테이블 준비
                            const roomAssignment = tryRoomAssignment(people, currentUsedTables);
                            if (roomAssignment.length > 0) {
                                return roomAssignment;
                            } else {
                                // 충분한 테이블을 확보했지만 단체석 규칙에 맞지 않는 경우
                                // 개별 테이블 반환
                                const availableRoomTables = [];
                                for (let i = 1; i <= 9; i++) {
                                    const tableId = `room-${i}`;
                                    if (!currentUsedTables.has(tableId)) {
                                        availableRoomTables.push(tableId);
                                    }
                                }
                                
                                // 필요한 개수만큼 반환
                                return availableRoomTables.slice(0, tablesNeeded);
                            }
                        } else {
                            console.log(`조합 이동 실패: 일부 고객 이동 불가`);
                        }
                    }
                }
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

// 배열에서 n개 요소 조합 생성 함수
function getCombinations(arr, n) {
    const result = [];
    
    function combine(start, current) {
        if (current.length === n) {
            result.push([...current]);
            return;
        }
        
        for (let i = start; i < arr.length; i++) {
            current.push(arr[i]);
            combine(i + 1, current);
            current.pop();
        }
    }
    
    combine(0, []);
    return result;
}