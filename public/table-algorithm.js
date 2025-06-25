// 재배정 시도 (주요 로직)
function tryReassignment(people, preference, conflictingReservations, allReservations) {
    console.log(`재배정 시도: ${people}명, 선호도: ${preference}`);
    
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