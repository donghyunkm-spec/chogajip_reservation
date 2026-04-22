const { readJson, getAccountingFile, getStaffFile, getKstNow } = require('./data');
const { sendToKakao } = require('./kakao');
const { calculateServerStaffCost } = require('./staff-calc');

function extractStoreCosts(accData, staffData, monthStr, storeType, currentDay) {
    let meat = 0, food = 0, etcDaily = 0, sales = 0;

    const today = getKstNow();
    const todayKey = today.toISOString().slice(0, 10);
    let todaySales = 0;

    if (accData.daily) {
        if(accData.daily[todayKey]) {
            const td = accData.daily[todayKey];
            if (storeType === 'yang' || storeType === 'yangeun') {
                 todaySales = Number(td.card||0) + Number(td.cash||0) +
                              Number(td.baemin||0) + Number(td.yogiyo||0) + Number(td.coupang||0);
            } else {
                 todaySales = Number(td.sales || 0);
            }
        }

        Object.keys(accData.daily).forEach(date => {
            if (date.startsWith(monthStr)) {
                const d = accData.daily[date];

                let daySales = 0;

                if (storeType === 'yang' || storeType === 'yangeun') {
                    const card = Number(d.card || 0);
                    const cash = Number(d.cash || 0);
                    const baemin = Number(d.baemin || 0);
                    const yogiyo = Number(d.yogiyo || 0);
                    const coupang = Number(d.coupang || 0);

                    daySales = card + cash + baemin + yogiyo + coupang;
                } else {
                    daySales = Number(d.sales || 0);
                }

                sales += daySales;

                meat += (d.meat || 0);
                food += (d.food || 0);
                etcDaily += (d.etc || 0) + (d.misc || 0);
            }
        });
    }

    const m = (accData.monthly && accData.monthly[monthStr]) ? accData.monthly[monthStr] : {};

    const rent = m.rent || 0;
    const utility = (m.utility||0) + (m.gas||0) + (m.foodWaste||0) + (m.tableOrder||0);
    const etcFixed = (m.businessCard||0) + (m.taxAgent||0) + (m.tax||0) + (m.etc_fixed||0) + (m.disposable||0);
    const insurance = m.insurance || 0;
    const advertising = m.advertising || 0;

    const makgeolli = m.makgeolli || 0;
    const liquor = (m.liquor||0) + (m.beverage||0) + makgeolli;
    const liquorLoan = m.liquorLoan || 0;
    const delivery = m.deliveryFee || 0;

    const staffTotal = calculateServerStaffCost(staffData, monthStr);

    const kstForLastDay = getKstNow();
    const lastDay = new Date(kstForLastDay.getUTCFullYear(), kstForLastDay.getUTCMonth() + 1, 0).getDate();

    let appliedDay = currentDay;
    if (todaySales === 0 && appliedDay > 1) {
        appliedDay = appliedDay - 1;
    }
    const ratio = appliedDay / lastDay;

    const itemsPred = {
        rent: Math.floor(rent * ratio),
        utility: Math.floor(utility * ratio),
        liquor: liquor,
        loan: liquorLoan,
        delivery: delivery,
        staff: Math.floor(staffTotal * ratio),
        insurance: Math.floor(insurance * ratio),
        advertising: Math.floor(advertising * ratio),
        meat: meat,
        food: food,
        etc: etcDaily + Math.floor(etcFixed * ratio)
    };

    const costPred = Object.values(itemsPred).reduce((a,b)=>a+b, 0);
    const profitPred = sales - costPred;

    const costFull = meat + food + etcDaily + rent + utility + liquor + liquorLoan + delivery + etcFixed + staffTotal + insurance + advertising;
    const profitReal = sales - costFull;

    return {
        sales,
        profitPred,
        profitReal,
        costFull,
        items: itemsPred
    };
}

async function generateAndSendBriefing() {
    try {
        const today = getKstNow();
        const monthStr = today.toISOString().slice(0, 7);
        const dayNum = today.getUTCDate();

        const accChoga = readJson(getAccountingFile('chogazip'), { monthly: {}, daily: {} });
        const staffChoga = readJson(getStaffFile('chogazip'), []);
        const accYang = readJson(getAccountingFile('yangeun'), { monthly: {}, daily: {} });
        const staffYang = readJson(getStaffFile('yangeun'), []);

        const choga = extractStoreCosts(accChoga, staffChoga, monthStr, 'choga', dayNum);
        const yang = extractStoreCosts(accYang, staffYang, monthStr, 'yang', dayNum);

        const totalSales = choga.sales + yang.sales;
        const totalProfitPred = choga.profitPred + yang.profitPred;
        const totalProfitReal = choga.profitReal + yang.profitReal;

        const formatMoney = (n) => n.toLocaleString();

        const getProfitText = (val) => {
            if (val > 0) return `📈 흑자: +${formatMoney(val)}원`;
            if (val < 0) return `📉 적자: ${formatMoney(val)}원`;
            return `0원 (본전)`;
        };

        const buildCostMessage = (data, storeName) => {
            const { items, sales } = data;
            let msg = '';

            const costKeys = [
                { key: 'meat', label: storeName === 'chogazip' ? '한강유통' : 'SPC/재료' },
                { key: 'food', label: '삼시세끼' },
                { key: 'liquor', label: '주류' },
                { key: 'loan', label: '주류대출' },
                { key: 'staff', label: '인건비(예상)' },
                { key: 'rent', label: '임대료(일할)' },
                { key: 'insurance', label: '4대보험' },
                { key: 'advertising', label: '광고비' },
                { key: 'delivery', label: '배달수수료' },
                { key: 'utility', label: '관리/공과' }
            ];

            let highValueList = [];
            let smallCostTotal = 0;

            costKeys.forEach(({ key, label }) => {
                const val = items[key] || 0;
                if (val >= 1000000) {
                    highValueList.push({ label, val });
                } else if (val > 0) {
                    smallCostTotal += val;
                }
            });

            const etcVal = items.etc || 0;
            if (etcVal > 0) {
                smallCostTotal += etcVal;
            }

            highValueList.sort((a, b) => b.val - a.val);

            highValueList.forEach(item => {
                const pct = sales > 0 ? `(${(item.val / sales * 100).toFixed(1)}%)` : '';
                msg += `- ${item.label}: ${formatMoney(item.val)} ${pct}\n`;
            });

            if (smallCostTotal > 0) {
                msg += `- 기타운영비(소액): ${formatMoney(smallCostTotal)}\n`;
            }

            return msg;
        };

        const message = `
[📅 ${today.getUTCMonth()+1}월 ${today.getUTCDate()}일 경영 브리핑]

🏠 초가짚 (예상마진 ${(choga.sales>0?(choga.profitPred/choga.sales*100).toFixed(1):0)}%)
■ 매출: ${formatMoney(choga.sales)}원
■ 예상순익: ${formatMoney(choga.profitPred)}원
${buildCostMessage(choga, 'chogazip')}

🥘 양은이네 (예상마진 ${(yang.sales>0?(yang.profitPred/yang.sales*100).toFixed(1):0)}%)
■ 매출: ${formatMoney(yang.sales)}원
■ 예상순익: ${formatMoney(yang.profitPred)}원
${buildCostMessage(yang, 'yangeun')}

💰 통합 요약
■ 합산매출: ${formatMoney(totalSales)}원
■ 예상순익: ${formatMoney(totalProfitPred)}원

📉 월간 현실 점검 (고정비 100% 반영)
■ 초가짚: ${getProfitText(choga.profitReal)}
■ 양은이네: ${getProfitText(yang.profitReal)}
■ 통합손익: ${getProfitText(totalProfitReal)}
`.trim();

        await sendToKakao(message);

    } catch (e) {
        console.error('브리핑 생성 실패:', e);
    }
}

function calculateMonthStats(accountingData, staffData, monthStr, currentDay) {
    let sales = 0;
    let costBreakdown = { meat: 0, food: 0, etc: 0 };
    let variableCostTotal = 0;

    if(accountingData.daily) {
        Object.keys(accountingData.daily).forEach(date => {
            if(date.startsWith(monthStr)) {
                const d = accountingData.daily[date];
                sales += (d.sales || 0);

                costBreakdown.meat += (d.meat || 0);
                costBreakdown.food += (d.food || 0);
                costBreakdown.etc += (d.etc || 0) + (d.misc || 0);
                variableCostTotal += (d.cost || 0);
            }
        });
    }

    const mData = (accountingData.monthly && accountingData.monthly[monthStr]) ? accountingData.monthly[monthStr] : {};

    const totalStaffCost = calculateServerStaffCost(staffData, monthStr);

    const fixedItemsTotal = (mData.rent||0) + (mData.utility||0) + (mData.gas||0) + (mData.makgeolli||0) +
                            (mData.liquor||0) + (mData.beverage||0) + (mData.etc_fixed||0) +
                            (mData.liquorLoan||0) + (mData.deliveryFee||0) + (mData.disposable||0) +
                            (mData.businessCard||0) + (mData.taxAgent||0) + (mData.tax||0) +
                            (mData.foodWaste||0) + (mData.tableOrder||0) +
                            (mData.insurance||0) + (mData.advertising||0);

    const kstMonth = getKstNow();
    const lastDay = new Date(kstMonth.getUTCFullYear(), kstMonth.getUTCMonth() + 1, 0).getDate();
    const ratio = currentDay / lastDay;

    const appliedFixed = Math.floor((fixedItemsTotal + totalStaffCost) * ratio);
    const totalCost = variableCostTotal + appliedFixed;

    const profit = sales - totalCost;
    const margin = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0;

    return {
        sales,
        profit,
        margin,
        costBreakdown,
        fixedRaw: fixedItemsTotal,
        staffRaw: totalStaffCost,
        appliedFixed
    };
}

module.exports = { extractStoreCosts, generateAndSendBriefing, calculateMonthStats };
