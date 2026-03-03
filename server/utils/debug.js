// 마케팅 디버그 로그 (로컬에서만 상세 출력)
const MARKETING_DEBUG = !process.env.RAILWAY_VOLUME_MOUNT_PATH;
function mktLog(msg, force = false) {
    if (force || MARKETING_DEBUG) console.log(msg);
}

// POS 디버그 로그
const POS_DEBUG = !process.env.RAILWAY_VOLUME_MOUNT_PATH;
function posLog(msg, force = false) {
    if (force || POS_DEBUG) console.log(msg);
}

module.exports = { MARKETING_DEBUG, mktLog, POS_DEBUG, posLog };
