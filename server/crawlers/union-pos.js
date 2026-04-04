const { readJson, writeJson, getAccountingFile, POS_HISTORY_FILE, getKstNow } = require('../utils/data');
const { sendToKakao } = require('../utils/kakao');
const { posLog } = require('../utils/debug');
const { posStatus } = require('../state');

// 유니온포스 POS 크롤링 함수
async function crawlUnionPos(storeCode, userId, password, targetDate, browser) {
    const results = {
        totalSales: 0,
        cashSales: 0,
        cardSales: 0,
        etcSales: 0,
        discount: 0,
        refundTotal: 0,
        voidTotal: 0,
        teamCount: 0,
        rawDataCount: 0,
        error: null
    };

    let page = null;
    try {
        posLog(`[POS] ${storeCode} 크롤링 시작 (${targetDate})`);

        page = await browser.newPage();

        await page.goto('https://asp2.unionpos.co.kr/', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        posLog(`[POS] 로그인 시도...`);
        await page.fill('input[name="userId"]', userId);
        await page.fill('input[name="password"]', password);
        await page.click('button#btnLogin');
        await page.waitForTimeout(3000);

        posLog(`[POS] 매출 조회 메뉴 이동...`);
        await page.click('text=매출 조회');
        await page.waitForTimeout(1000);

        await page.click('text=영수증별 매출(개선)');
        await page.waitForTimeout(2000);

        posLog(`[POS] 날짜 설정: ${targetDate}`);
        await page.evaluate((date) => {
            document.getElementById('startDate').value = date;
            document.getElementById('endDate').value = date;
        }, targetDate);
        await page.waitForTimeout(500);

        await page.click('button#btnSearch');
        await page.waitForTimeout(5000);

        posLog(`[POS] 데이터 추출 중...`);

        let totalPages = 1;
        try {
            const pageInfo = await page.locator('span#list_finalPageNo').textContent();
            if (pageInfo) {
                totalPages = parseInt(pageInfo.trim()) || 1;
            }
        } catch (e) {
            posLog(`[POS] 페이지 정보 없음, 단일 페이지로 처리`);
        }

        posLog(`[POS] 총 ${totalPages} 페이지`);

        let maxReceiptNo = 0;
        let totalCash = 0;
        let totalCard = 0;
        let totalEtc = 0;
        let totalDiscount = 0;
        let refundTotal = 0;
        let voidTotal = 0;
        let rawDataCount = 0;

        function parseAmount(text) {
            try {
                const cleanText = (text || '').replace(/,/g, '').replace(/원/g, '').trim();
                return parseInt(cleanText) || 0;
            } catch (e) {
                return 0;
            }
        }

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            posLog(`[POS] ${pageNum}/${totalPages} 페이지 처리 중...`);

            if (pageNum > 1) {
                await page.evaluate((num) => goPage(num), pageNum);
                await page.waitForTimeout(3000);
            }

            const rows = await page.locator('table#tableList tbody tr').all();

            for (const row of rows) {
                try {
                    const cells = await row.locator('td').all();
                    if (cells.length < 11) continue;

                    const firstCell = (await cells[0].textContent()).trim();
                    if (!/^\d+$/.test(firstCell)) continue;

                    const receiptNo = parseInt((await cells[4].textContent()).trim()) || 0;
                    const total = parseAmount(await cells[5].textContent());
                    const cash = parseAmount(await cells[6].textContent());
                    const card = parseAmount(await cells[7].textContent());
                    const etc = parseAmount(await cells[8].textContent());
                    const discount = parseAmount(await cells[9].textContent());
                    const saleType = (await cells[10].textContent()).trim();

                    maxReceiptNo = Math.max(maxReceiptNo, receiptNo);

                    if (saleType.includes('반품')) {
                        const refundAmount = Math.abs(cash + card + etc);
                        refundTotal += refundAmount;
                    } else if (saleType.includes('판매(반)')) {
                        // 반품된 원래 판매 건 - 매출에서 제외
                    } else if (saleType.includes('전취')) {
                        const voidAmount = Math.abs(total);
                        voidTotal += voidAmount;
                    } else {
                        totalCash += cash;
                        totalCard += card;
                        totalEtc += etc;
                        totalDiscount += discount;
                    }

                    rawDataCount++;
                } catch (e) {
                    posLog(`[POS] 행 파싱 오류: ${e.message}`);
                }
            }

            posLog(`[POS] 페이지 ${pageNum} 처리 완료`);
        }

        results.teamCount = maxReceiptNo;
        results.cashSales = totalCash;
        results.cardSales = totalCard;
        results.etcSales = totalEtc;
        results.discount = totalDiscount;
        results.refundTotal = refundTotal;
        results.voidTotal = voidTotal;
        results.totalSales = totalCash + totalCard + totalEtc - refundTotal;
        results.rawDataCount = rawDataCount;

        posLog(`[POS] ${storeCode} 크롤링 완료:`, true);
        posLog(`  - 순매출: ${results.totalSales.toLocaleString()}원`, true);
        posLog(`  - 현금: ${results.cashSales.toLocaleString()}원`, true);
        posLog(`  - 카드: ${results.cardSales.toLocaleString()}원`, true);
        posLog(`  - 기타: ${results.etcSales.toLocaleString()}원`, true);
        posLog(`  - 반품: ${results.refundTotal.toLocaleString()}원`, true);
        posLog(`  - 전취: ${results.voidTotal.toLocaleString()}원`, true);
        posLog(`  - 팀수: ${results.teamCount}팀 (영수증번호 최대값)`, true);

    } catch (e) {
        console.error(`[POS] ${storeCode} 크롤링 오류:`, e.message);
        results.error = e.message;
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }

    return results;
}

// POS 카카오 메시지 포맷
function formatPosKakaoMessage(results, date) {
    let message = `🧾 [POS 일일매출 자동집계]\n📅 ${date}\n\n`;

    for (const [store, data] of Object.entries(results)) {
        const storeName = store === 'chogazip' ? '초가짚' : '양은이네';

        if (data.error) {
            message += `━━━━━━━━━━━━\n`;
            message += `🏪 ${storeName}\n`;
            message += `❌ 오류: ${data.error}\n`;
        } else {
            message += `━━━━━━━━━━━━\n`;
            message += `🏪 ${storeName}\n`;
            message += `💰 순매출: ${data.totalSales.toLocaleString()}원\n`;
            message += `├ 현금: ${data.cashSales.toLocaleString()}원\n`;
            message += `├ 카드: ${data.cardSales.toLocaleString()}원\n`;
            message += `├ 기타: ${(data.etcSales || 0).toLocaleString()}원\n`;
            message += `├ 반품: -${(data.refundTotal || 0).toLocaleString()}원\n`;
            message += `└ 전취: -${(data.voidTotal || 0).toLocaleString()}원\n`;
            message += `📋 팀 수: ${data.teamCount}팀\n`;
        }
    }

    return message;
}

// Bug #2 수정: POS 크롤러 회계 스키마를 올바른 daily/monthly 구조로 사용
async function runPosCrawler(stores = ['chogazip', 'yangeun'], targetDate = null) {
    if (posStatus.running) {
        console.log('⚠️ POS 크롤러가 이미 실행 중입니다.');
        return { success: false, message: '이미 실행 중' };
    }

    if (!targetDate) {
        // KST 기준 어제 날짜
        const kstNow = getKstNow();
        kstNow.setDate(kstNow.getDate() - 1);
        targetDate = kstNow.toISOString().split('T')[0];
    }

    let browser = null;
    const results = {};

    try {
        posStatus.running = true;
        posStatus.progress = { current: 0, total: stores.length, store: '' };

        console.log(`🧾 [POS] 매출 수집 시작 (${targetDate})`);

        const { chromium } = require('playwright');
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const credentials = {
            chogazip: {
                userId: process.env.UNIONPOS_CHOGAZIP_ID || 'sz64621',
                password: process.env.UNIONPOS_CHOGAZIP_PW || '00874'
            },
            yangeun: {
                userId: process.env.UNIONPOS_YANGEUN_ID || 'sz74696',
                password: process.env.UNIONPOS_YANGEUN_PW || '02150'
            }
        };

        for (let i = 0; i < stores.length; i++) {
            const store = stores[i];
            posStatus.progress.current = i + 1;
            posStatus.progress.store = store === 'chogazip' ? '초가짚' : '양은이네';

            const cred = credentials[store];
            if (!cred) {
                results[store] = { error: '계정 정보 없음' };
                continue;
            }

            results[store] = await crawlUnionPos(store, cred.userId, cred.password, targetDate, browser);

            if (i < stores.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Bug #2 수정: 올바른 스키마 사용 (daily/monthly)
        for (const [store, data] of Object.entries(results)) {
            if (data.error) continue;

            const accFile = getAccountingFile(store);
            const accData = readJson(accFile, { monthly: {}, daily: {} });

            if (!accData.daily) accData.daily = {};
            if (!accData.daily[targetDate]) accData.daily[targetDate] = {};

            const existing = accData.daily[targetDate];

            // 기존 배달매출 보존
            const baemin = existing.baemin || 0;
            const yogiyo = existing.yogiyo || 0;
            const coupang = existing.coupang || 0;

            // 올바른 필드명으로 매핑
            const cardSales = data.cardSales + (data.etcSales || 0);

            let totalSales = 0;
            if (store === 'yangeun') {
                totalSales = cardSales + data.cashSales + baemin + yogiyo + coupang - (data.refundTotal || 0);
            } else {
                totalSales = data.totalSales;
            }

            accData.daily[targetDate] = {
                ...existing,
                sales: totalSales,
                cash: data.cashSales,
                card: cardSales,
                receiptCount: data.teamCount,
                discount: data.discount,
                refund: data.refundTotal || 0,
                void: data.voidTotal || 0,
                crawledAt: new Date().toISOString(),
                source: 'unionpos'
            };

            writeJson(accFile, accData);
            console.log(`✅ [POS] ${store} 매출 데이터 저장 완료`);
        }

        // 이력 저장
        const history = readJson(POS_HISTORY_FILE, []);
        history.unshift({
            date: targetDate,
            crawledAt: new Date().toISOString(),
            results: Object.fromEntries(
                Object.entries(results).map(([store, data]) => [
                    store,
                    data.error ? { error: data.error } : {
                        totalSales: data.totalSales,
                        cashSales: data.cashSales,
                        cardSales: data.cardSales,
                        etcSales: data.etcSales || 0,
                        refundTotal: data.refundTotal || 0,
                        voidTotal: data.voidTotal || 0,
                        teamCount: data.teamCount
                    }
                ])
            )
        });
        if (history.length > 90) history.length = 90;
        writeJson(POS_HISTORY_FILE, history);

        // 카카오톡 알림 발송
        const message = formatPosKakaoMessage(results, targetDate);
        await sendToKakao(message);
        console.log('✅ [POS] 카카오톡 알림 발송 완료');

        posStatus.lastRun = new Date().toISOString();
        posStatus.lastResult = { success: true, date: targetDate, results };

        return { success: true, date: targetDate, results };

    } catch (e) {
        console.error('❌ [POS] 크롤러 실행 오류:', e.message);
        posStatus.lastResult = { success: false, error: e.message };
        return { success: false, error: e.message };
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        posStatus.running = false;
    }
}

module.exports = { crawlUnionPos, formatPosKakaoMessage, runPosCrawler };
