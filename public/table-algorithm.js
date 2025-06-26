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
        id: 'hall-3-4',
        name: '홀 3-4번 테이블',
        tables: ['hall-3', 'hall-4'],
        minPeople: 5,
        maxPeople: 8
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
        id: 'hall-7-8',
        name: '홀 7-8번 테이블',
        tables: ['hall-7', 'hall-8'],
        minPeople: 5,
        maxPeople: 8
    },
    {
        id: 'hall-3-4-5-6',
        name: '홀 3-4-5-6번 테이블',
        tables: ['hall-3', 'hall-4', 'hall-5', 'hall-6'],
        minPeople: 13,
        maxPeople: 16
    },
    {
        id: 'hall-4-5-6-7',
        name: '홀 4-5-6-7번 테이블',
        tables: ['hall-4', 'hall-5', 'hall-6', 'hall-7'],
        minPeople: 13,
        maxPeople: 16
    },
    {
        id: 'hall-5-6-7-8',
        name: '홀 5-6-7-8번 테이블',
        tables: ['hall-5', 'hall-6', 'hall-7', 'hall-8'],
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

// 홀 테이블 인접 그룹 정의 
const HALL_ADJACENT_GROUPS = [
    ['hall-1', 'hall-2', 'hall-3'],
    ['hall-3', 'hall-4', 'hall-5'],
    ['hall-4', 'hall-5', 'hall-6'],
    ['hall-5', 'hall-6', 'hall-7'],
    ['hall-6', 'hall-7', 'hall-8'],
    ['hall-9', 'hall-10', 'hall-11', 'hall-12'],
    ['hall-13', 'hall-14', 'hall-15', 'hall-16']
];

// 예약불가 테이블 조합
const INVALID_COMBINATIONS = [
    ['room-3', 'room-6'],
    ['room-1', 'room-4'],
    ['room-2', 'room-5'],
    ['room-4', 'room-7'],
    ['room-5', 'room-8'],
    ['room-6', 'room-9']
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
    
    // 홀 단체석 체크를 더 엄격하게 (9~16번은 단체석 불가)
    if (groupRule.tables.some(t => t.startsWith('hall-'))) {
        for (const table of groupRule.tables) {
            const tableNum = parseInt(table.split('-')[1]);
            if (tableNum >= 9 && tableNum <= 16) {
                console.log(`홀 ${tableNum}번은 단체석으로 사용 불가`);
                return false;
            }
        }
    }
    
    // 룸 단체석의 경우 예약불가 조합 확인 (단, 룸 4~9 전체는 예외)
    if (groupRule.tables.some(t => t.startsWith('room-'))) {
        if (hasInvalidCombination(groupRule.tables)) {
            console.log(`단체석 ${groupRule.name}에 예약불가 조합 포함됨`);
            return false;
        }
    }
    
    // 룸 선호 고객 인원수 체크 (36명 초과 불가)
    if (groupRule.tables.some(t => t.startsWith('room-')) && groupRule.maxPeople > 36) {
        console.log(`룸 단체석 ${groupRule.name}은 36명 초과 예약 불가`);
        return false;
    }
    
    return true;
}

// 예약불가 조합 체크 함수 (수정됨 - 룸 4~9 전체는 예외)
function hasInvalidCombination(tables) {
    if (tables.length <= 1) return false;
    
    // 룸 4~9 전체 조합인 경우 예외 처리 (24명까지 수용 가능)
    const room4to9 = ['room-4', 'room-5', 'room-6', 'room-7', 'room-8', 'room-9'];
    if (tables.length === 6 && 
        room4to9.every(t => tables.includes(t)) && 
        tables.every(t => room4to9.includes(t))) {
        console.log(`룸 4~9 전체 조합은 예약불가 조합 예외 처리`);
        return false; // 룸 4~9 전체 조합은 허용
    }
    
    for (const invalidCombo of INVALID_COMBINATIONS) {
        const hasFirstTable = tables.includes(invalidCombo[0]);
        const hasSecondTable = tables.includes(invalidCombo[1]);
        
        if (hasFirstTable && hasSecondTable) {
            console.log(`예약불가 조합 발견: ${invalidCombo.join(', ')}`);
            return true;
        }
    }
    
    return false;
}

// 인접 테이블 확인 함수
function areTablesAdjacent(table1, table2) {
    // 동일한 타입(hall/room)인지 먼저 확인
    const type1 = table1.split('-')[0];
    const type2 = table2.split('-')[0];
    
    if (type1 !== type2) return false;
    
    if (type1 === 'hall') {
        const num1 = parseInt(table1.split('-')[1]);
        const num2 = parseInt(table2.split('-')[1]);
        
        // 홀 테이블의 경우 번호 차이가 1이면 인접
        // 단, 홀 8과 홀 9는 인접하지 않음
        if (Math.abs(num1 - num2) === 1) {
            // 홀 8과 홀 9는 인접하지 않음
            if ((num1 === 8 && num2 === 9) || (num1 === 9 && num2 === 8)) {
                return false;
            }
            // 홀 2과 홀 3은 인접하지 않음
            if ((num1 === 2 && num2 === 3) || (num1 === 3 && num2 === 2)) {
                return false;
            }
            return true;
        }
        return false;
    } else if (type1 === 'room') {
        const num1 = parseInt(table1.split('-')[1]);
        const num2 = parseInt(table2.split('-')[1]);
        
        // 룸 테이블의 경우 번호 차이가 1이고 특정 제외 조합이 아니면 인접
        if (Math.abs(num1 - num2) === 1) {
            // 예약불가 조합 확인
            for (const invalidCombo of INVALID_COMBINATIONS) {
                if ((invalidCombo[0] === table1 && invalidCombo[1] === table2) ||
                    (invalidCombo[0] === table2 && invalidCombo[1] === table1)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    
    return false;
}

// 특정 테이블에 인접한 테이블 찾기
function getAdjacentTables(table) {
    const adjacentTables = [];
    
    const type = table.split('-')[0];
    const num = parseInt(table.split('-')[1]);
    
    if (type === 'hall') {
        // 홀 테이블의 인접 테이블 찾기
        const possibleAdjacent = [num - 1, num + 1];
        
        // 특수 케이스 처리 (홀 8-9, 홀 2-3 사이는 인접하지 않음)
        if (num === 8) {
            possibleAdjacent.splice(possibleAdjacent.indexOf(9), 1);
        } else if (num === 9) {
            possibleAdjacent.splice(possibleAdjacent.indexOf(8), 1);
        } else if (num === 2) {
            possibleAdjacent.splice(possibleAdjacent.indexOf(3), 1);
        } else if (num === 3) {
            possibleAdjacent.splice(possibleAdjacent.indexOf(2), 1);
        }
        
        // 가능한 범위 체크 (1-16)
        for (const adjNum of possibleAdjacent) {
            if (adjNum >= 1 && adjNum <= 16) {
                adjacentTables.push(`hall-${adjNum}`);
            }
        }
    } else if (type === 'room') {
        // 룸 테이블의 인접 테이블 찾기
        const possibleAdjacent = [num - 1, num + 1];
        
        // 가능한 범위 체크 (1-9) 및 예약불가 조합 필터링
        for (const adjNum of possibleAdjacent) {
            if (adjNum >= 1 && adjNum <= 9) {
                const adjTable = `room-${adjNum}`;
                
                // 예약불가 조합인지 확인
                let isInvalid = false;
                for (const invalidCombo of INVALID_COMBINATIONS) {
                    if ((invalidCombo[0] === table && invalidCombo[1] === adjTable) ||
                        (invalidCombo[0] === adjTable && invalidCombo[1] === table)) {
                        isInvalid = true;
                        break;
                    }
                }
                
                if (!isInvalid) {
                    adjacentTables.push(adjTable);
                }
            }
        }
    }
    
    return adjacentTables;
}

// 인접 테이블 그룹 확인
function findAdjacentGroup(tables, targetSize) {
    if (tables.length < targetSize) return [];
    
    // 타입 별로 분류
    const hallTables = tables.filter(t => t.startsWith('hall-'))
        .sort((a, b) => {
            const numA = parseInt(a.split('-')[1]);
            const numB = parseInt(b.split('-')[1]);
            return numA - numB;
        });
    
    const roomTables = tables.filter(t => t.startsWith('room-'))
        .sort((a, b) => {
            const numA = parseInt(a.split('-')[1]);
            const numB = parseInt(b.split('-')[1]);
            return numA - numB;
        });
    
    // 각 테이블 타입에 대해 인접 그룹 찾기
    if (hallTables.length >= targetSize) {
        // 모든 가능한 시작점에 대해 인접 그룹 찾기
        for (let i = 0; i < hallTables.length - targetSize + 1; i++) {
            const potentialGroup = [hallTables[i]];
            
            // 연속된 인접 테이블 찾기
            for (let j = i + 1; j < hallTables.length; j++) {
                const lastTable = potentialGroup[potentialGroup.length - 1];
                if (areTablesAdjacent(lastTable, hallTables[j])) {
                    potentialGroup.push(hallTables[j]);
                    
                    if (potentialGroup.length === targetSize) {
                        return potentialGroup;
                    }
                } else {
                    // 인접하지 않으면 이 시작점에서의 시도 종료
                    break;
                }
            }
        }
    }
    
    if (roomTables.length >= targetSize) {
        // 모든 가능한 시작점에 대해 인접 그룹 찾기
        for (let i = 0; i < roomTables.length - targetSize + 1; i++) {
            const potentialGroup = [roomTables[i]];
            
            // 연속된 인접 테이블 찾기
            for (let j = i + 1; j < roomTables.length; j++) {
                const lastTable = potentialGroup[potentialGroup.length - 1];
                if (areTablesAdjacent(lastTable, roomTables[j])) {
                    potentialGroup.push(roomTables[j]);
                    
                    if (potentialGroup.length === targetSize) {
                        return potentialGroup;
                    }
                } else {
                    // 인접하지 않으면 이 시작점에서의 시도 종료
                    break;
                }
            }
        }
    }
    
    return []; // 적합한 인접 그룹을 찾지 못함
}

// 테이블 이동 가능성 분석
function analyzeTableMovability(conflictingReservations, usedTables) {
    // 각 테이블 별 이동 가능성 분석
    const tableMobility = {};
    
    // 모든 사용 중인 테이블에 대해 이동 가능성 체크
    usedTables.forEach(table => {
        // 이 테이블을 사용하는 예약 찾기
        const reservation = conflictingReservations.find(r => 
            r.tables && r.tables.includes(table)
        );
        
        if (reservation) {
            // 이 고객의 선호도 체크
            const isFlexible = reservation.preference === 'any';
            const preferenceConflict = 
                (table.startsWith('hall-') && reservation.preference === 'room') ||
                (table.startsWith('room-') && reservation.preference === 'hall');
            
            // 이 고객이 사용하는 다른 테이블들
            const otherTables = reservation.tables.filter(t => t !== table);
            
            // 이동 가능성 평가
            tableMobility[table] = {
                tableId: table,
                reservation: reservation,
                isFlexible: isFlexible,
                preferenceConflict: preferenceConflict,
                usesSingleTable: reservation.tables.length === 1,
                otherTables: otherTables,
                // 이동 우선순위: 선호도 없거나 현재와 반대 선호도를 가진 단일 테이블 고객이 가장 이동하기 쉬움
                mobilityScore: (isFlexible ? 2 : 0) + 
                              (preferenceConflict ? 1 : 0) + 
                              (reservation.tables.length === 1 ? 3 : 0)
            };
        }
    });
    
    return tableMobility;
}

// 룸 테이블 배정 시도 (수정됨)
function tryRoomAssignment(people, usedTables) {
    // 좌석선호도 룸인 경우 최대 36명까지만 예약 가능 체크
    if (people > 36) {
        console.log(`룸 예약 인원 초과: ${people}명 (최대 36명까지 가능)`);
        return [];
    }
    
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
    
    // 9~12명: 룸1,2,3 우선 배정 (텍스트 파일 규칙 0번)
    if (people >= 9 && people <= 12) {
        const roomGroup = ['room-1', 'room-2', 'room-3'];
        if (roomGroup.every(t => !usedTables.has(t))) {
            console.log(`9~12명 룸 단체석 우선 배정: 룸1,2,3 (${people}명)`);
            return roomGroup;
        }
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
    
    for (const rule of suitableRules) {
        // 예약불가 조합이 없는지 확인 (수정됨 - 룸 4~9 전체는 예외)
        if (!hasInvalidCombination(rule.tables)) {
            console.log(`룸 단체석 배정 성공: ${rule.name} (${people}명)`);
            return rule.tables;
        }
    }
    
    // 단체석 규칙에 맞지 않지만 5명~8명을 위한 2개 테이블 배정
    if (people <= 8) {
        // 유효한 2개 테이블 조합 시도
        const validPairs = [
            ['room-1', 'room-2'], ['room-2', 'room-3'],
            ['room-4', 'room-5'], ['room-5', 'room-6'],
            ['room-7', 'room-8'], ['room-8', 'room-9']
        ];
        
        for (const pair of validPairs) {
            if (!usedTables.has(pair[0]) && !usedTables.has(pair[1])) {
                return pair;
            }
        }
        
        // 위의 유효한 조합이 없을 경우, 가능한 다른 조합 시도 (하지만 예약불가 조합은 피함)
        const availableRoomTables = [];
        for (let i = 1; i <= 9; i++) {
            const tableId = `room-${i}`;
            if (!usedTables.has(tableId)) {
                availableRoomTables.push(tableId);
                if (availableRoomTables.length === 2) {
                    // 예약불가 조합 체크
                    if (!hasInvalidCombination(availableRoomTables)) {
                        return availableRoomTables;
                    } else {
                        // 예약불가 조합이면 첫 번째 테이블 유지하고 다음 테이블 찾기
                        availableRoomTables.pop();
                    }
                }
            }
        }
    }
    
    return []; // 가능한 테이블 없음
}

// 대체 룸 배정 시도 함수 (수정됨)
function tryAlternativeRoomAssignment(people, usedTables) {
    // 예약불가 조합을 피하는 배정 시도
    
    // 1명~4명: 개별 룸 테이블 배정
    if (people <= 4) {
        // 다른 순서로 테이블 시도 (예: 서로 떨어진 테이블 우선)
        const tryOrder = [1, 4, 7, 2, 5, 8, 3, 6, 9];
        for (const i of tryOrder) {
            const tableId = `room-${i}`;
            if (!usedTables.has(tableId)) {
                return [tableId];
            }
        }
        return [];
    }
    
    // 5명~8명: 유효한 2개 테이블 조합만 시도
    if (people <= 8) {
        const validPairs = [
            ['room-1', 'room-2'], ['room-2', 'room-3'],
            ['room-4', 'room-5'], ['room-5', 'room-6'],
            ['room-7', 'room-8'], ['room-8', 'room-9']
        ];
        
        for (const pair of validPairs) {
            if (!usedTables.has(pair[0]) && !usedTables.has(pair[1])) {
                return pair;
            }
        }
    }
    
    // 9명 이상: 기존 단체석 규칙 사용하되 예약불가 조합 필터링 (수정됨)
    const suitableRules = GROUP_RULES
        .filter(rule => 
            rule.tables.every(t => t.startsWith('room-')) &&
            rule.minPeople <= people && 
            rule.maxPeople >= people && 
            rule.tables.every(table => !usedTables.has(table)) &&
            !hasInvalidCombination(rule.tables) // 룸 4~9 전체는 예외 처리됨
        )
        .sort((a, b) => a.tables.length - b.tables.length);
    
    if (suitableRules.length > 0) {
        console.log(`대체 룸 배정 성공: ${suitableRules[0].name} (${people}명)`);
        return suitableRules[0].tables;
    }
    
    return [];
}

// 홀 테이블 배정 시도 (수정됨)
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
        for (let i = 2; i <= 8; i++) {
            const tableId = `hall-${i}`;
            if (!usedTables.has(tableId)) {
                return [tableId];
            }
        }
        
        // 홀 1번은 5명 전용이므로 4명 이하에게는 마지막에 배정
        if (!usedTables.has('hall-1')) {
            return ['hall-1'];
        }
        
        return []; // 가능한 테이블 없음
    }
    
    // 5명: 홀 1번 테이블 우선 배정
    if (people === 5 && !usedTables.has('hall-1')) {
        return ['hall-1'];
    }
    
    // 9명: 홀 1,2번 테이블 우선 배정 (규칙 c)
    if (people === 9 && !usedTables.has('hall-1') && !usedTables.has('hall-2')) {
        return ['hall-1', 'hall-2'];
    }
    
    // 5명 이상: 단체석 규칙 적용 (홀 9~16번은 단체석 제외)
    const suitableRules = GROUP_RULES
        .filter(rule => 
            rule.tables.every(t => t.startsWith('hall-')) &&
            rule.minPeople <= people && 
            rule.maxPeople >= people && 
            rule.tables.every(table => !usedTables.has(table)) &&
            // 홀 9~16번 테이블을 포함한 단체석은 제외
            !rule.tables.some(t => {
                const num = parseInt(t.split('-')[1]);
                return num >= 9 && num <= 16;
            })
        )
        .sort((a, b) => a.tables.length - b.tables.length); // 최소 테이블 사용
    
    if (suitableRules.length > 0) {
        console.log(`홀 단체석 배정: ${suitableRules[0].name} (${people}명)`);
        return suitableRules[0].tables;
    }
    
    console.log(`홀 단체석 규칙 없음 (${people}명) - 홀 9~16번은 단체석 불가`);
    return []; // 가능한 테이블 없음
}

// 특수 케이스: 홀 3번과 8번이 비어있고, 4-7번이 차있을 때 단체석 확보 (수정됨)
function trySpecialCaseReassignment(people, conflictingReservations, allReservations) {
    // 필요한 테이블 수 확인 (13-16명은 4개 테이블 필요)
    if (people < 5 || people > 24) return []; // 5명 이상 단체석만 처리
    
    console.log(`특수 케이스 재배정 시도: ${people}명 단체석 확보`);
    
    // 현재 사용 중인 테이블
    const usedTables = getUsedTables(conflictingReservations);
    
    // 13-16명 단체석의 특수 케이스: 홀 3,8번 비어있고 4-7번 차있는 경우
    if (people >= 13 && people <= 16) {
        console.log("13-16명 단체석 특수 케이스 시도");
        
        // 홀 3번과 8번이 비어있는지 확인
        if (!usedTables.has('hall-3') && !usedTables.has('hall-8')) {
            console.log("홀 3번과 8번이 비어있음을 확인");
            
            // 홀 4,5,6,7번이 사용 중인지 확인
            const targetTables = ['hall-4', 'hall-5', 'hall-6', 'hall-7'];
            const occupiedTables = targetTables.filter(t => usedTables.has(t));
            
            if (occupiedTables.length >= 3) { // 최소 3개 이상 사용 중이면 시도
                console.log(`홀 4,5,6,7번 중 ${occupiedTables.length}개가 사용 중임을 확인`);
                
                // 시나리오 1 시도: 홀 3,4,5,6 확보
                const scenario1Result = trySecureHallGroup(
                    ['hall-3', 'hall-4', 'hall-5', 'hall-6'], 
                    ['hall-4', 'hall-5', 'hall-6'], 
                    conflictingReservations, 
                    allReservations, 
                    usedTables,
                    "홀 3,4,5,6"
                );
                if (scenario1Result.length > 0) {
                    return scenario1Result;
                }
                
                // 시나리오 2 시도: 홀 5,6,7,8 확보
                const scenario2Result = trySecureHallGroup(
                    ['hall-5', 'hall-6', 'hall-7', 'hall-8'], 
                    ['hall-5', 'hall-6', 'hall-7'], 
                    conflictingReservations, 
                    allReservations, 
                    usedTables,
                    "홀 5,6,7,8"
                );
                if (scenario2Result.length > 0) {
                    return scenario2Result;
                }
            }
        }
    }
    
    // 5-8명 단체석의 특수 케이스들
    if (people >= 5 && people <= 8) {
        console.log("5-8명 단체석 특수 케이스 시도");
        
        // 홀 1,2번 조합 확보 시도
        if (!usedTables.has('hall-1') && usedTables.has('hall-2')) {
            const result = trySecureHallGroup(
                ['hall-1', 'hall-2'], 
                ['hall-2'], 
                conflictingReservations, 
                allReservations, 
                usedTables,
                "홀 1,2"
            );
            if (result.length > 0) return result;
        }
        
        // 홀 3,4번 조합 확보 시도
        if (!usedTables.has('hall-3') && usedTables.has('hall-4')) {
            const result = trySecureHallGroup(
                ['hall-3', 'hall-4'], 
                ['hall-4'], 
                conflictingReservations, 
                allReservations, 
                usedTables,
                "홀 3,4"
            );
            if (result.length > 0) return result;
        }
        
        // 다른 홀 조합들도 시도
        const pairs = [
            { target: ['hall-4', 'hall-5'], toMove: ['hall-4', 'hall-5'] },
            { target: ['hall-6', 'hall-7'], toMove: ['hall-6', 'hall-7'] },
            { target: ['hall-7', 'hall-8'], toMove: ['hall-7', 'hall-8'] }
        ];
        
        for (const pair of pairs) {
            const occupiedInPair = pair.toMove.filter(t => usedTables.has(t));
            if (occupiedInPair.length > 0 && occupiedInPair.length < pair.target.length) {
                const result = trySecureHallGroup(
                    pair.target, 
                    occupiedInPair, 
                    conflictingReservations, 
                    allReservations, 
                    usedTables,
                    `홀 ${pair.target.map(t => t.split('-')[1]).join(',')}`
                );
                if (result.length > 0) return result;
            }
        }
    }
    
    return []; // 특수 케이스 재배정 실패
}

// 홀 그룹 확보 시도 (통합된 함수)
function trySecureHallGroup(targetTables, tablesToFree, conflictingReservations, allReservations, usedTables, groupName) {
    console.log(`${groupName} 확보 시도`);
    
    const movedCustomers = [];
    
    // 이동해야 할 테이블들을 사용하는 예약 찾기
    const reservationsToMove = conflictingReservations.filter(r => 
        r.tables && r.tables.some(t => tablesToFree.includes(t))
    );
    
    if (reservationsToMove.length === 0) {
        console.log("이동할 예약이 없음");
        return targetTables; // 이미 비어있음
    }
    
    console.log(`이동 대상 예약: ${reservationsToMove.map(r => r.name).join(', ')}`);
    
    // 각 고객을 이동시킬 수 있는지 확인
    const remainingReservations = conflictingReservations.filter(r => 
        !reservationsToMove.some(mv => mv.id === r.id)
    );
    
    let currentUsedTables = getUsedTables(remainingReservations);
    // 목표 테이블들 중 비어있는 테이블들은 예약됨으로 표시
    targetTables.forEach(t => {
        if (!tablesToFree.includes(t)) {
            currentUsedTables.add(t);
        }
    });
    
    // 각 고객 이동 시도
    for (const customer of reservationsToMove) {
        console.log(`${customer.name}님(${customer.people}명) 이동 시도`);
        
        // 대체 테이블 찾기
        let alternativeOptions = [];
        
        // 고객 선호도에 따른 대체 테이블 찾기
        if (customer.preference === 'hall' || customer.preference === 'any') {
            // 사용 가능한 홀 테이블 찾기 (9~16번 우선, 단체석 제외)
            alternativeOptions = tryHallAssignment(customer.people, currentUsedTables);
        } else if (customer.preference === 'room') {
            // 룸 테이블 찾기
            alternativeOptions = tryRoomAssignment(customer.people, currentUsedTables);
            
            // 예약불가 조합 체크 (수정됨)
            if (alternativeOptions.length > 0 && hasInvalidCombination(alternativeOptions)) {
                alternativeOptions = tryAlternativeRoomAssignment(customer.people, currentUsedTables);
            }
        }
        
        if (alternativeOptions.length > 0) {
            console.log(`${customer.name}님 이동 가능: ${customer.tables.join(', ')} → ${alternativeOptions.join(', ')}`);
            
            // 실제 예약 데이터 수정
            const index = allReservations.findIndex(r => r.id === customer.id);
            if (index !== -1) {
                // 백업 저장
                const originalTables = [...customer.tables];
                
                allReservations[index].tables = alternativeOptions;
                allReservations[index].reassigned = true;
                allReservations[index].originalTables = originalTables;
                movedCustomers.push(customer);
                
                // 사용 테이블 업데이트
                alternativeOptions.forEach(t => currentUsedTables.add(t));
            }
        } else {
            console.log(`${customer.name}님 이동 불가`);
            
            // 롤백
            rollbackReassignments(allReservations, movedCustomers);
            return [];
        }
    }
    
    if (movedCustomers.length > 0) {
        console.log(`✅ ${groupName} 확보 성공: ${movedCustomers.length}명 이동`);
        return targetTables;
    }
    
    return [];
}

// 재배정 롤백 함수
function rollbackReassignments(allReservations, movedCustomers) {
    console.log(`재배정 롤백 시작: ${movedCustomers.length}명 고객 원상복구`);
    
    movedCustomers.forEach(customer => {
        // 원래 테이블 찾기
        const index = allReservations.findIndex(r => r.id === customer.id);
        if (index !== -1 && allReservations[index].reassigned) {
            // 원래 테이블로 복원
            if (allReservations[index].originalTables) {
                allReservations[index].tables = [...allReservations[index].originalTables];
                delete allReservations[index].originalTables;
            } else {
                // originalTables가 없는 경우, 고객의 원래 테이블 사용
                allReservations[index].tables = [...customer.tables];
            }
            
            delete allReservations[index].reassigned;
            console.log(`${allReservations[index].name}님 테이블 복원 완료`);
        }
    });
    
    console.log('롤백 완료');
}

// 인접 테이블 기반 재배정 전략
function tryAdjacentTableReassignment(people, preference, conflictingReservations, allReservations) {
    console.log(`인접 테이블 기반 재배정 시도 (${people}명, ${preference})`);
    
    // 홀 단체석만 처리 (우선)
    if (preference !== 'hall' && preference !== 'any') return [];
    
    // 현재 사용 중인 테이블
    const usedTables = getUsedTables(conflictingReservations);
    
    // 1. 인접 테이블 그룹 찾기 시도 (2개 테이블이 필요한 경우 가장 간단)
    if (people >= 5 && people <= 8) {
        // 필요한 테이블 수: 2개
        // 가능한 인접 테이블 조합 찾기
        const emptyHallTables = [];
        for (let i = 1; i <= 8; i++) { // 9~16번은 단체석 불가
            const tableId = `hall-${i}`;
            if (!usedTables.has(tableId)) {
                emptyHallTables.push(tableId);
            }
        }
        
        // 빈 테이블 중 인접한 2개 테이블 찾기
        const adjacentEmptyPair = findAdjacentGroup(emptyHallTables, 2);
        if (adjacentEmptyPair.length === 2) {
            console.log(`✅ 인접한 빈 테이블 발견: ${adjacentEmptyPair.join(', ')}`);
            return adjacentEmptyPair;
        }
        
        // 2. 인접한 1개 빈 테이블 + 1개 이동 가능 테이블 찾기
        const tableMobility = analyzeTableMovability(conflictingReservations, usedTables);
        
        // 각 빈 테이블에 대해, 인접한 사용 중인 테이블 중 이동성이 높은 테이블 찾기
        for (const emptyTable of emptyHallTables) {
            const adjacentUsedTables = getAdjacentTables(emptyTable)
                .filter(t => usedTables.has(t) && t.startsWith('hall-')) // 홀 테이블만
                .sort((a, b) => {
                    // 이동성 점수가 높은 순으로 정렬
                    const scoreA = tableMobility[a]?.mobilityScore || 0;
                    const scoreB = tableMobility[b]?.mobilityScore || 0;
                    return scoreB - scoreA;
                });
            
            // 인접한 사용 중인 테이블이 있고, 이동 가능한 경우
            if (adjacentUsedTables.length > 0) {
                const candidateTable = adjacentUsedTables[0];
                const mobility = tableMobility[candidateTable];
                
                if (mobility && mobility.mobilityScore > 0) {
                    console.log(`이동 가능한 인접 테이블 발견: ${candidateTable} (${mobility.reservation.name}님)`);
                    
                    // 이 고객을 다른 테이블로 이동 시도
                    const reservation = mobility.reservation;
                    const otherReservations = conflictingReservations.filter(r => r.id !== reservation.id);
                    const otherUsedTables = getUsedTables(otherReservations);
                    
                    // 이동 대상 고객의 인원수
                    const customerPeople = reservation.people;
                    
                    // 이동 대상 고객의 선호도에 따라 대체 테이블 찾기
                    let alternativeOptions = [];
                    
                    if (reservation.preference === 'hall' || reservation.preference === 'any') {
                        // 다른 홀 테이블 찾기
                        alternativeOptions = tryHallAssignment(customerPeople, otherUsedTables);
                    } else if (reservation.preference === 'room') {
                        // 룸 테이블 찾기
                        alternativeOptions = tryRoomAssignment(customerPeople, otherUsedTables);
                        
                        // 예약불가 조합 확인 (수정됨)
                        if (alternativeOptions.length > 0 && hasInvalidCombination(alternativeOptions)) {
                            alternativeOptions = tryAlternativeRoomAssignment(customerPeople, otherUsedTables);
                        }
                    }
                    
                    // 대체 테이블을 찾았으면 이동 실행
                    if (alternativeOptions.length > 0) {
                        console.log(`✅ ${reservation.name}님을 ${candidateTable}에서 ${alternativeOptions.join(', ')}로 이동`);
                        
                        // 실제 예약 데이터 수정
                        const index = allReservations.findIndex(r => r.id === reservation.id);
                        if (index !== -1) {
                            // 기존 테이블 배열에서 이동할 테이블 제거하고 새 테이블 추가
                            const updatedTables = reservation.tables.filter(t => t !== candidateTable);
                            alternativeOptions.forEach(t => {
                                if (!updatedTables.includes(t)) {
                                    updatedTables.push(t);
                                }
                            });
                            
                            allReservations[index].tables = updatedTables;
                            allReservations[index].reassigned = true;
                        }
                        
                        // 인접 테이블 조합 반환
                        return [emptyTable, candidateTable];
                    }
                }
            }
        }
    }
    
    return []; // 적합한 재배정 방법 찾지 못함
}

// 룸 선호 고객을 위한 적극적인 재배정 시도 함수 (수정됨)
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
            // 예약불가 조합 체크 (수정됨 - 룸 4~9는 예외)
            if (hasInvalidCombination(rule.tables)) {
                console.log(`단체석 규칙 ${rule.name}은 예약불가 조합 포함, 건너뜀`);
                continue;
            }
            
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
    
    console.log(`룸 선호 고객을 위한 적극적인 재배정 실패`);
    return []; // 실패
}

// 유효한 테이블 조합 찾기
function findValidCombination(availableTables, neededCount) {
    if (neededCount === 1 && availableTables.length > 0) {
        return [availableTables[0]];
    }
    
    const combinations = getCombinations(availableTables, neededCount);
    
    for (const combo of combinations) {
        if (!hasInvalidCombination(combo)) {
            return combo;
        }
    }
    
    return [];
}

// 재배정 시도
function tryReassignment(people, preference, conflictingReservations, allReservations, prioritizePreference = false) {
    console.log(`재배정 시도: ${people}명, 선호도: ${preference}, 선호도 우선: ${prioritizePreference}`);
    
    // 선호도 우선일 경우, 선호도 없거나 반대 선호도 가진 고객 먼저 이동 시도
    if (prioritizePreference) {
        if (preference === 'room') {
            // 룸 선호 고객을 위한 재배정 시도
            return tryReassignmentForRoomPreference(people, conflictingReservations, allReservations);
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
                rule.maxPeople >= people &&
                // 홀 9~16번 테이블을 포함한 단체석은 제외
                !rule.tables.some(t => {
                    const num = parseInt(t.split('-')[1]);
                    return num >= 9 && num <= 16;
                })
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
                            
                            if (roomOptions.length > 0 && !hasInvalidCombination(roomOptions)) {
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
                            
                            if (roomGroupOptions.length > 0 && !hasInvalidCombination(roomGroupOptions)) {
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

// 메인 테이블 배정 함수 (수정됨)
function assignTables(people, preference, date, time, allReservations) {
    console.log(`테이블 배정 시작: ${people}명, 선호도: ${preference}, 날짜: ${date}, 시간: ${time}`);
    
    // 룸 선호인 경우 36명 이상이면 예약 불가 (추가된 체크)
    if (preference === 'room' && people > 36) {
        console.log(`룸 선호 예약 불가: ${people}명 (최대 36명까지 가능)`);
        return [];
    }
    
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
    
    // 재배정 제외 조건 체크 (a-g 규칙)
    let skipReassignment = false;
    
    // a. 룸 선호 고객이 9~12명인 경우 (룸1,2,3을 제외한 더 나은 선택지가 없음)
    if (preference === 'room' && people >= 9 && people <= 12) {
        const roomGroup = ['room-1', 'room-2', 'room-3'];
        if (roomGroup.every(t => !usedTables.has(t))) {
            console.log(`룸 선호 ${people}명 고객에게 룸1,2,3 직접 배정 (재배정 제외 조건 a)`);
            return roomGroup;
        }
        skipReassignment = true;
    }
    
    // b. 룸 선호 고객이 17~24명인 경우 (룸 4,5,6,7,8,9를 제외한 선택지가 없음)
    if (preference === 'room' && people >= 17 && people <= 24) {
        const roomGroup = ['room-4', 'room-5', 'room-6', 'room-7', 'room-8', 'room-9'];
        if (roomGroup.every(t => !usedTables.has(t))) {
            console.log(`룸 선호 ${people}명 고객에게 룸4-9 직접 배정 (재배정 제외 조건 b)`);
            return roomGroup;
        }
        skipReassignment = true;
    }
    
    // c. 관계없음, 홀 선호 고객이 5명 또는 9명인 경우
    if ((preference === 'any' || preference === 'hall') && 
        (people === 5 || people === 9)) {
        if (people === 5 && !usedTables.has('hall-1')) {
            console.log(`${preference} 선호 5명 고객에게 홀1 직접 배정 (재배정 제외 조건 c)`);
            return ['hall-1'];
        }
        if (people === 9 && !usedTables.has('hall-1') && !usedTables.has('hall-2')) {
            console.log(`${preference} 선호 9명 고객에게 홀1,2 직접 배정 (재배정 제외 조건 c)`);
            return ['hall-1', 'hall-2'];
        }
    }
    
    // d. 관계없음, 홀 선호 고객이 13~16명인 경우
    if ((preference === 'any' || preference === 'hall') && 
        people >= 13 && people <= 16) {
        // 홀 3,4,5,6 확인
        const group1 = ['hall-3', 'hall-4', 'hall-5', 'hall-6'];
        if (group1.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀3,4,5,6 직접 배정 (재배정 제외 조건 d)`);
            return group1;
        }
        
        // 홀 5,6,7,8 확인
        const group2 = ['hall-5', 'hall-6', 'hall-7', 'hall-8'];
        if (group2.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀5,6,7,8 직접 배정 (재배정 제외 조건 d)`);
            return group2;
        }
        
        skipReassignment = true;
    }
    
    // e. 관계없음, 홀 선호 고객이 5~8명인 경우
    if ((preference === 'any' || preference === 'hall') && 
        people >= 5 && people <= 8) {
        // 홀 3,4 확인
        const group1 = ['hall-3', 'hall-4'];
        if (group1.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀3,4 직접 배정 (재배정 제외 조건 e)`);
            return group1;
        }
        
        // 홀 5,6 확인
        const group2 = ['hall-5', 'hall-6'];
        if (group2.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀5,6 직접 배정 (재배정 제외 조건 e)`);
            return group2;
        }
        
        // 홀 7,8 확인
        const group3 = ['hall-7', 'hall-8'];
        if (group3.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀7,8 직접 배정 (재배정 제외 조건 e)`);
            return group3;
        }
        
        skipReassignment = true;
    }
    
    // f. 관계없음, 홀 선호 고객이 17~20명인 경우
    if ((preference === 'any' || preference === 'hall') && 
        people >= 17 && people <= 20) {
        // 홀 3,4,5,6,7 확인
        const group1 = ['hall-3', 'hall-4', 'hall-5', 'hall-6', 'hall-7'];
        if (group1.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀3,4,5,6,7 직접 배정 (재배정 제외 조건 f)`);
            return group1;
        }
        
        // 홀 4,5,6,7,8 확인
        const group2 = ['hall-4', 'hall-5', 'hall-6', 'hall-7', 'hall-8'];
        if (group2.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀4,5,6,7,8 직접 배정 (재배정 제외 조건 f)`);
            return group2;
        }
        
        skipReassignment = true;
    }
    
    // g. 관계없음, 홀 선호 고객이 21~24명인 경우
    if ((preference === 'any' || preference === 'hall') && 
        people >= 21 && people <= 24) {
        // 홀 3,4,5,6,7,8 확인
        const group = ['hall-3', 'hall-4', 'hall-5', 'hall-6', 'hall-7', 'hall-8'];
        if (group.every(t => !usedTables.has(t))) {
            console.log(`${preference} 선호 ${people}명 고객에게 홀3,4,5,6,7,8 직접 배정 (재배정 제외 조건 g)`);
            return group;
        }
        
        skipReassignment = true;
    }
    
    // 단체석 고객을 위한 인접 테이블 재배정 시도 (재배정 제외 조건에 해당하지 않는 경우만)
    if (!skipReassignment && (preference === 'hall' || preference === 'any') && people >= 5) {
        assignedTables = tryAdjacentTableReassignment(people, preference, conflictingReservations, allReservations);
        
        if (assignedTables.length > 0) {
            console.log(`인접 테이블 재배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    }
    
    // 특수 케이스: 단체석을 위한 재배정 시도 (재배정 제외 조건에 해당하지 않는 경우만)
    if (!skipReassignment && (preference === 'hall' || preference === 'any') && people >= 5) {
        assignedTables = trySpecialCaseReassignment(people, conflictingReservations, allReservations);
        
        if (assignedTables.length > 0) {
            console.log(`특수 케이스 재배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    }

    // 선호도가 있는 고객은 선호하는 테이블 유형 먼저 시도
    if (preference === 'room') {
        // 룸 우선 배정 시도
        assignedTables = tryRoomAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            // 예약불가 조합 체크 (수정됨)
            if (!hasInvalidCombination(assignedTables)) {
                console.log(`룸 배정 성공: ${assignedTables.join(', ')}`);
                return assignedTables;
            } else {
                console.log(`예약불가 조합 발견: ${assignedTables.join(', ')}, 대체 배정 시도`);
                // 대체 룸 배정 시도
                assignedTables = tryAlternativeRoomAssignment(people, usedTables);
                
                if (assignedTables.length > 0) {
                    console.log(`대체 룸 배정 성공: ${assignedTables.join(', ')}`);
                    return assignedTables;
                }
            }
        }
        
        // 룸 선호 고객을 위한 적극적인 재배정 시도 (재배정 제외 조건에 해당하지 않는 경우만)
        if (!skipReassignment) {
            assignedTables = tryReassignmentForRoomPreference(people, conflictingReservations, allReservations);
            
            if (assignedTables.length > 0) {
                // 예약불가 조합 체크 (수정됨)
                if (!hasInvalidCombination(assignedTables)) {
                    console.log(`룸 선호 고객 재배정 성공: ${assignedTables.join(', ')}`);
                    return assignedTables;
                } else {
                    console.log(`재배정으로 예약불가 조합 발견: ${assignedTables.join(', ')}`);
                }
            }
            
            // 마지막으로 일반 재배정 시도
            assignedTables = tryReassignment(people, preference, conflictingReservations, allReservations, true);
            
            if (assignedTables.length > 0) {
                // 예약불가 조합 체크 (수정됨)
                if (!hasInvalidCombination(assignedTables)) {
                    console.log(`재배정 성공 (선호도 고려): ${assignedTables.join(', ')}`);
                    return assignedTables;
                } else {
                    console.log(`재배정으로 예약불가 조합 발견: ${assignedTables.join(', ')}`);
                }
            }
        }
    } 
    else if (preference === 'hall') {
        // 홀 우선 배정 시도
        assignedTables = tryHallAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            console.log(`홀 배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
        
        // 홀 선호 고객을 위한 재배정 시도 (재배정 제외 조건에 해당하지 않는 경우만)
        if (!skipReassignment) {
            assignedTables = tryReassignment(people, preference, conflictingReservations, allReservations, true);
            
            if (assignedTables.length > 0) {
                console.log(`재배정 성공 (선호도 고려): ${assignedTables.join(', ')}`);
                return assignedTables;
            }
        }
    }
    else {
        // 선호도 없는 경우 룸부터 시도 (기본 정책)
        assignedTables = tryRoomAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            // 예약불가 조합 체크 (수정됨)
            if (!hasInvalidCombination(assignedTables)) {
                console.log(`선호도 없음, 룸 배정 성공: ${assignedTables.join(', ')}`);
                return assignedTables;
            } else {
                console.log(`선호도 없음, 예약불가 조합 발견: ${assignedTables.join(', ')}`);
                // 다른 룸 조합 시도
                assignedTables = tryAlternativeRoomAssignment(people, usedTables);
                
                if (assignedTables.length > 0) {
                    console.log(`선호도 없음, 대체 룸 배정 성공: ${assignedTables.join(', ')}`);
                    return assignedTables;
                }
            }
        }
        
        // 홀 배정 시도
        assignedTables = tryHallAssignment(people, usedTables);
        
        if (assignedTables.length > 0) {
            console.log(`선호도 없음, 홀 배정 성공: ${assignedTables.join(', ')}`);
            return assignedTables;
        }
    }
    
    // 직접 배정 실패 시 일반적인 재배정 시도 (재배정 제외 조건에 해당하지 않는 경우만)
    if (assignedTables.length === 0 && !skipReassignment) {
        console.log(`직접 배정 실패, 일반 재배정 시도...`);
        assignedTables = tryReassignment(people, preference, conflictingReservations, allReservations, false);
        
        if (assignedTables.length > 0) {
            // 예약불가 조합 체크 (룸 선호 시만) (수정됨)
            if (preference !== 'room' || !hasInvalidCombination(assignedTables)) {
                console.log(`일반 재배정 성공: ${assignedTables.join(', ')}`);
                return assignedTables;
            } else {
                console.log(`일반 재배정으로 예약불가 조합 발견: ${assignedTables.join(', ')}`);
            }
        }
    }
    
    if (skipReassignment) {
        console.log(`재배정 제외 조건에 해당하여 재배정 시도하지 않음`);
    }
    
    console.log(`모든 배정 시도 실패`);
    return []; // 배정 실패
}