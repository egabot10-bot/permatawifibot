const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/vouchers.json');
const CHARSET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function loadVoucherDB() {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// dummy API checker (nanti ganti fetch axios)
async function checkVoucherFromAPI(voucher) {
    // simulasi delay API
    await new Promise(r => setTimeout(r, 50));

    // anggap API backend kita balikin array voucher
    const apiData = loadVoucherDB(); // dummy: pake json dulu
    return apiData.some(v => v.username === voucher);
}

function randomVoucher(length) {
        let result = '';
    for (let i = 0; i < length; i++) {
        const idx = Math.floor(Math.random() * CHARSET.length);
        result += CHARSET[idx];
    }
    return result;
}

async function generateSafeVoucher({
    length = 6,
    pendingOrder = {}
}) {
    let voucher;
    let isSafe = false;
    let attempt = 0;

    const dbVouchers = loadVoucherDB();
    const pendingVouchers = Object.values(pendingOrder)
        .map(o => o.voucher)
        .filter(Boolean);

    while (!isSafe) {
        attempt++;
        voucher = randomVoucher(length);

        const existInDB = dbVouchers.some(v => v.username === voucher);
        const existInPending = pendingVouchers.includes(voucher);
        const existInAPI = await checkVoucherFromAPI(voucher);

        if (!existInDB && !existInPending && !existInAPI) {
            isSafe = true;
        }

        if (attempt > 20) {
            throw new Error('❌ Gagal generate voucher aman (terlalu banyak tabrakan)');
        }
    }

    console.log(`✅ Voucher aman dibuat: ${voucher} (${attempt}x cek)`);
    return voucher;
}

module.exports = generateSafeVoucher;
