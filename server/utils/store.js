const STORE_NAMES = {
    chogazip: '초가짚',
    yangeun: '양은이네'
};

function mapStoreKrToCode(storeKr) {
    if (storeKr === '양은이네') return 'yangeun';
    if (storeKr === '초가짚') return 'chogazip';
    return null;
}

module.exports = { STORE_NAMES, mapStoreKrToCode };
