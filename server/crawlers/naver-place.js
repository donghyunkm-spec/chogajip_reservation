const fs = require('fs');
const { readJson, writeJson, MARKETING_FILE, getKstNow } = require('../utils/data');
const { sendToKakao } = require('../utils/kakao');
const { MARKETING_DEBUG, mktLog } = require('../utils/debug');
const { marketingStatus } = require('../state');

// 마케팅 데이터 초기화
function initMarketingData() {
    if (!fs.existsSync(MARKETING_FILE)) {
        const defaultData = {
            config: {
                stores: [
                    { name: '초가짚', is_mine: true, keywords: ['오창 맛집', '오창 삼겹살', '오창 고기집'] },
                    { name: '양은이네', is_mine: true, keywords: ['오창 맛집', '오창 동태탕', '오창 보쌈'] }
                ],
                settings: {
                    headless: true,
                    max_items_to_check: 50,
                    notify_on_change: true
                }
            },
            stores: {},
            history: [],
            last_updated: null
        };
        writeJson(MARKETING_FILE, defaultData);
    }
}

// 네이버 플레이스 검색 함수
async function searchNaverPlace(page, keyword, storeNames, maxItems = 50) {
    const results = {};
    storeNames.forEach(name => {
        results[name] = { rank: null, found: false };
    });

    try {
        const url = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`;
        mktLog(`  [검색] URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);

        try {
            await page.waitForSelector('iframe#searchIframe', { timeout: 10000 });
            mktLog('  [OK] searchIframe 발견');
        } catch (e) {
            mktLog('  [WARN] searchIframe을 찾을 수 없음', true);
            return results;
        }

        const iframe = page.frameLocator('iframe#searchIframe');
        await page.waitForTimeout(2000);

        if (MARKETING_DEBUG) {
            try {
                const iframeEl = await page.locator('iframe#searchIframe').elementHandle();
                const frame = await iframeEl.contentFrame();
                const bodyHTML = await frame.evaluate(() => document.body.innerHTML.substring(0, 3000));
                console.log('  [DEBUG] iframe 내부 HTML (처음 3000자):');
                console.log(bodyHTML);
            } catch (e) {
                console.log('  [DEBUG] HTML 추출 실패:', e.message);
            }
        }

        const listSelectors = ['ul.Ryr1F', 'div.Ryr1F', 'ul[class*="list"]', 'div[class*="search"]'];
        let listFound = false;

        for (const sel of listSelectors) {
            try {
                await iframe.locator(sel).first().waitFor({ timeout: 3000 });
                mktLog(`  [OK] 검색 결과 리스트 발견 (${sel})`);
                listFound = true;
                break;
            } catch (e) {
                mktLog(`  [TRY] ${sel} - 없음`);
            }
        }

        if (!listFound) {
            mktLog('  [WARN] 검색 결과 리스트를 찾을 수 없음', true);
            return results;
        }

        mktLog('  [INFO] 스크롤 중...');
        let prevItemCount = 0;
        let noChangeCount = 0;
        const maxScrollAttempts = 25;

        for (let i = 0; i < maxScrollAttempts; i++) {
            try {
                const scrollInfo = await iframe.locator('div.Ryr1F').evaluate(el => {
                    const before = el.scrollTop;
                    el.scrollTop += 1200;
                    return {
                        before,
                        after: el.scrollTop,
                        max: el.scrollHeight - el.clientHeight
                    };
                });

                await page.waitForTimeout(2000);

                const currentItemCount = await iframe.locator('li.UEzoS').count();
                const atBottom = scrollInfo.after >= scrollInfo.max - 10;

                if (currentItemCount === prevItemCount) {
                    noChangeCount++;
                    mktLog(`  [INFO] 스크롤 ${i + 1}회 - 항목 ${currentItemCount}개 (변화 없음 ${noChangeCount}/5) [스크롤: ${scrollInfo.after}/${scrollInfo.max}]`);
                    if (noChangeCount >= 5 || atBottom) {
                        mktLog(`  [INFO] 스크롤 완료 - 총 ${currentItemCount}개 ${atBottom ? '(끝 도달)' : '(새 항목 없음)'}`);
                        break;
                    }
                } else {
                    noChangeCount = 0;
                    mktLog(`  [INFO] 스크롤 ${i + 1}회 - 항목 ${prevItemCount} → ${currentItemCount}개 [스크롤: ${scrollInfo.after}/${scrollInfo.max}]`);
                }
                prevItemCount = currentItemCount;

            } catch (e) {
                mktLog(`  [WARN] 스크롤 오류: ${e.message}`);
                break;
            }
        }
        await page.waitForTimeout(1000);

        const items = await iframe.locator('li.UEzoS').all();
        mktLog(`  [INFO] 검색 결과 ${items.length}개 발견`);

        let rank = 0;

        for (let i = 0; i < Math.min(items.length, maxItems); i++) {
            const item = items[i];

            let isAd = false;
            try {
                const adLink = await item.locator('a[href*="help.naver.com/support/alias/NSP"]').count();
                if (adLink > 0) isAd = true;

                if (!isAd) {
                    const adText = await item.locator('span.place_blind').filter({ hasText: '광고' }).count();
                    if (adText > 0) isAd = true;
                }
            } catch (e) {}

            if (isAd) {
                mktLog(`    [${i + 1}] 광고 - 스킵`);
                continue;
            }

            rank++;

            let storeName = '';
            const nameSelectors = [
                'span.place_bluelink.TYaxT',
                'span.place_bluelink',
                'a.place_bluelink span',
                'span.TYaxT',
            ];

            for (const selector of nameSelectors) {
                try {
                    const nameEl = item.locator(selector).first();
                    const count = await nameEl.count();
                    if (count > 0) {
                        storeName = await nameEl.innerText();
                        storeName = storeName.trim();
                        if (storeName) break;
                    }
                } catch (e) {}
            }

            mktLog(`    [${rank}위] ${storeName || '(이름 추출 실패)'}`);

            for (const targetName of storeNames) {
                if (storeName && storeName.includes(targetName)) {
                    if (!results[targetName].found) {
                        mktLog(`    *** ${targetName} 발견! ${rank}위 ***`);
                        results[targetName] = { rank, found: true };
                    }
                }
            }
        }

        mktLog(`  [완료] 총 ${rank}개 업체 확인`);

    } catch (e) {
        console.error(`  [ERROR] 검색 오류 (${keyword}):`, e.message);
    }

    return results;
}

// 순위 체크 실행 함수
async function runNaverPlaceCheck() {
    if (marketingStatus.running) {
        console.log('⚠️ 마케팅 크롤러가 이미 실행 중입니다.');
        return { success: false, message: '이미 실행 중' };
    }

    let browser = null;

    try {
        marketingStatus.running = true;
        marketingStatus.progress = { current: 0, total: 0, keyword: '' };

        const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {}, settings: {} }, stores: {} });
        const { stores, categories, settings } = data.config;

        if (!stores || stores.length === 0) {
            throw new Error('모니터링할 가게가 설정되지 않았습니다.');
        }

        const keywordToStores = {};
        Object.keys(categories || {}).forEach(cat => {
            const catKeywords = categories[cat].keywords || [];
            const catStores = stores.filter(s => s.category === cat).map(s => s.name);

            catKeywords.forEach(kw => {
                if (!keywordToStores[kw]) keywordToStores[kw] = [];
                catStores.forEach(storeName => {
                    if (!keywordToStores[kw].includes(storeName)) {
                        keywordToStores[kw].push(storeName);
                    }
                });
            });
        });

        const allKeywords = Object.keys(keywordToStores);
        if (allKeywords.length === 0) {
            throw new Error('검색 키워드가 설정되지 않았습니다.');
        }

        marketingStatus.progress.total = allKeywords.length;

        console.log(`🚀 [마케팅] 순위 체크 시작 - ${allKeywords.length}개 키워드`);
        mktLog('========================================');
        Object.keys(categories || {}).forEach(cat => {
            const catKeywords = (categories[cat].keywords || []).join(', ');
            const catStores = stores.filter(s => s.category === cat).map(s => s.name).join(', ');
            mktLog(`📍 ${cat}: [${catKeywords}] → 가게: ${catStores}`);
        });
        mktLog('========================================');

        const { chromium } = require('playwright');
        browser = await chromium.launch({
            headless: settings.headless !== false,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'ko-KR'
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const page = await context.newPage();

        const today = getKstNow().toISOString().split('T')[0];
        const changedRanks = [];

        for (let i = 0; i < allKeywords.length; i++) {
            const keyword = allKeywords[i];
            const targetStores = keywordToStores[keyword];

            marketingStatus.progress.current = i + 1;
            marketingStatus.progress.keyword = keyword;

            mktLog(`🔍 검색 중: "${keyword}" (${i + 1}/${allKeywords.length}) - 대상: ${targetStores.join(', ')}`);

            const results = await searchNaverPlace(page, keyword, targetStores, settings.max_items_to_check || 50);

            mktLog(`  [결과] "${keyword}" 검색 결과:`);
            for (const storeName of targetStores) {
                if (!data.stores[storeName]) {
                    data.stores[storeName] = { keywords: {} };
                }
                if (!data.stores[storeName].keywords[keyword]) {
                    data.stores[storeName].keywords[keyword] = [];
                }

                const result = results[storeName];
                const prevRecords = data.stores[storeName].keywords[keyword];
                const prevRank = prevRecords.length > 0 ? prevRecords[prevRecords.length - 1].rank : null;

                if (result.found) {
                    mktLog(`    - ${storeName}: ${result.rank}위`);
                } else {
                    mktLog(`    - ${storeName}: 순위권 밖`);
                }

                data.stores[storeName].keywords[keyword].push({
                    date: today,
                    rank: result.found ? result.rank : null,
                    found: result.found
                });

                if (result.found && prevRank !== null && prevRank !== result.rank) {
                    const change = prevRank - result.rank;
                    changedRanks.push({
                        store: storeName,
                        keyword,
                        prev: prevRank,
                        current: result.rank,
                        change: change > 0 ? `+${change}` : `${change}`
                    });
                }
            }

            const delay = 3000 + Math.random() * 2000;
            await page.waitForTimeout(delay);
        }

        data.last_updated = new Date().toISOString();
        writeJson(MARKETING_FILE, data);

        // 순위 체크 결과 알림 (현재 순위 + 주간 추이 + 변동)
        {
            let msg = `📊 [네이버 플레이스 순위] ${today}\n`;
            msg += `━━━━━━━━━━━━━━━━━━\n\n`;

            // 카테고리별로 그룹핑
            const { stores: storeConfigs, categories: catConfig } = data.config;
            const categoryGroups = {
                chogazip: { name: '🥩 초가짚', stores: [] },
                yangeun: { name: '🍲 양은이네', stores: [] }
            };

            const myStores = (storeConfigs || []).filter(s => s.is_mine);
            myStores.forEach(store => {
                const cat = store.category || 'chogazip';
                if (categoryGroups[cat]) {
                    categoryGroups[cat].stores.push(store);
                }
            });

            let hasData = false;

            for (const [catKey, catInfo] of Object.entries(categoryGroups)) {
                if (catInfo.stores.length === 0) continue;

                const keywords = (catConfig && catConfig[catKey] && catConfig[catKey].keywords) || [];
                if (keywords.length === 0) continue;

                msg += `${catInfo.name}\n`;
                msg += `──────────────\n`;

                catInfo.stores.forEach(store => {
                    const storeName = store.name;
                    const storeData = data.stores[storeName];

                    keywords.forEach(keyword => {
                        const records = (storeData && storeData.keywords && storeData.keywords[keyword]) || [];
                        if (records.length === 0) return;

                        hasData = true;
                        const latest = records[records.length - 1];
                        const rankDisplay = latest.rank ? `${latest.rank}위` : '순위권 밖';

                        // 전일 대비 변동
                        let trendMsg = '';
                        if (records.length >= 2) {
                            const prev = records[records.length - 2];
                            if (latest.rank && prev.rank) {
                                const diff = prev.rank - latest.rank;
                                if (diff > 0) trendMsg = ` (▲${diff})`;
                                else if (diff < 0) trendMsg = ` (▼${Math.abs(diff)})`;
                                else trendMsg = ' (-)';
                            }
                        }

                        // 7일 추이 (숫자 나열)
                        const recent7 = records.slice(-7);
                        let weeklyTrend = '';
                        if (recent7.length >= 2) {
                            weeklyTrend = recent7.map(r => r.rank ? r.rank : '-').join('→');
                        }

                        msg += `"${keyword}": ${rankDisplay}${trendMsg}\n`;
                        if (weeklyTrend) {
                            msg += `  추이: ${weeklyTrend}\n`;
                        }
                    });
                });

                msg += `\n`;
            }

            // 변동 하이라이트
            if (changedRanks.length > 0) {
                msg += `🔔 변동 항목\n`;
                msg += `──────────────\n`;
                changedRanks.forEach(c => {
                    const emoji = c.change.startsWith('+') ? '📈' : '📉';
                    msg += `${emoji} ${c.store} "${c.keyword}": ${c.prev}위→${c.current}위 (${c.change})\n`;
                });
            } else {
                msg += `✅ 전일 대비 변동 없음`;
            }

            if (hasData) {
                await sendToKakao(msg);
            }
        }

        marketingStatus.lastRun = new Date().toISOString();
        marketingStatus.lastResult = { success: true, checked: allKeywords.length, changes: changedRanks.length };

        console.log(`✅ 마케팅 순위 체크 완료: ${allKeywords.length}개 키워드, ${changedRanks.length}개 변동`);
        return { success: true, data };

    } catch (e) {
        console.error('❌ 마케팅 크롤러 오류:', e.message);
        marketingStatus.lastResult = { success: false, error: e.message };
        return { success: false, error: e.message };
    } finally {
        if (browser) await browser.close();
        marketingStatus.running = false;
    }
}

// 마케팅 브리핑 생성 및 전송
async function generateMarketingBriefing() {
    try {
        const data = readJson(MARKETING_FILE, { config: { stores: [], categories: {} }, stores: {} });
        const { stores: storeConfigs, categories: catConfig } = data.config;

        if (!storeConfigs || storeConfigs.length === 0) {
            console.log('⚠️ 마케팅 브리핑 스킵: 등록된 가게 없음');
            return;
        }

        const myStores = storeConfigs.filter(s => s.is_mine);
        if (myStores.length === 0) {
            console.log('⚠️ 마케팅 브리핑 스킵: 내 가게 등록 없음');
            return;
        }

        const today = getKstNow();
        const dateStr = `${today.getUTCMonth() + 1}/${today.getUTCDate()}`;

        let message = `📊 [마케팅 브리핑] ${dateStr}\n`;
        message += `━━━━━━━━━━━━━━━━━━\n\n`;

        const categoryGroups = {
            chogazip: { name: '🥩 초가짚', stores: [] },
            yangeun: { name: '🍲 양은이네', stores: [] }
        };

        myStores.forEach(store => {
            const cat = store.category || 'chogazip';
            if (categoryGroups[cat]) {
                categoryGroups[cat].stores.push(store);
            }
        });

        let hasData = false;

        for (const [catKey, catInfo] of Object.entries(categoryGroups)) {
            if (catInfo.stores.length === 0) continue;

            const keywords = (catConfig && catConfig[catKey] && catConfig[catKey].keywords) || [];

            message += `${catInfo.name}\n`;
            message += `──────────────\n`;

            if (keywords.length === 0) {
                message += `키워드 미등록\n`;
                continue;
            }

            catInfo.stores.forEach(store => {
                const storeName = store.name;
                const storeData = data.stores[storeName];

                keywords.forEach(keyword => {
                    const records = (storeData && storeData.keywords && storeData.keywords[keyword]) || [];

                    if (records.length === 0) {
                        return;
                    }

                    hasData = true;
                    const latest = records[records.length - 1];
                    const rankDisplay = latest.rank ? `${latest.rank}위` : '순위권 밖';

                    let trendMsg = '';
                    if (records.length >= 2) {
                        const prev = records[records.length - 2];
                        if (latest.rank && prev.rank) {
                            const diff = prev.rank - latest.rank;
                            if (diff > 0) trendMsg = ` (▲${diff})`;
                            else if (diff < 0) trendMsg = ` (▼${Math.abs(diff)})`;
                            else trendMsg = ' (-)';
                        }
                    }

                    const recent7 = records.slice(-7).filter(r => r.rank);
                    let avgMsg = '';
                    if (recent7.length >= 3) {
                        const avg = recent7.reduce((sum, r) => sum + r.rank, 0) / recent7.length;
                        avgMsg = ` [7일평균: ${avg.toFixed(1)}위]`;
                    }

                    message += `${storeName} "${keyword}": ${rankDisplay}${trendMsg}${avgMsg}\n`;
                });
            });

            message += `\n`;
        }

        if (!hasData) {
            console.log('⚠️ 마케팅 브리핑 스킵: 순위 데이터 없음');
            return;
        }

        const allKeywords = new Set();
        Object.values(catConfig || {}).forEach(cat => {
            (cat.keywords || []).forEach(k => allKeywords.add(k));
        });

        if (allKeywords.size > 0) {
            message += `📈 경쟁 현황 (TOP 3)\n`;
            message += `──────────────\n`;

            allKeywords.forEach(keyword => {
                const rankings = [];
                storeConfigs.forEach(store => {
                    const cat = store.category || 'chogazip';
                    const catKeywords = (catConfig && catConfig[cat] && catConfig[cat].keywords) || [];
                    if (!catKeywords.includes(keyword)) return;

                    const storeData = data.stores[store.name];
                    const records = (storeData && storeData.keywords && storeData.keywords[keyword]) || [];
                    if (records.length > 0) {
                        const latest = records[records.length - 1];
                        if (latest.rank) {
                            rankings.push({
                                name: store.name,
                                rank: latest.rank,
                                isMine: store.is_mine
                            });
                        }
                    }
                });

                if (rankings.length > 0) {
                    rankings.sort((a, b) => a.rank - b.rank);
                    const top3 = rankings.slice(0, 3);
                    const top3Str = top3.map((r, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                        const mine = r.isMine ? '⭐' : '';
                        return `${medal}${r.name}${mine}`;
                    }).join(' ');
                    message += `"${keyword}": ${top3Str}\n`;
                }
            });
        }

        message += `\n💡 상세 분석은 관리자 페이지에서 확인하세요.`;

        await sendToKakao(message);
        console.log('✅ 마케팅 브리핑 전송 완료');

    } catch (e) {
        console.error('❌ 마케팅 브리핑 생성 실패:', e);
    }
}

module.exports = { initMarketingData, searchNaverPlace, runNaverPlaceCheck, generateMarketingBriefing };
