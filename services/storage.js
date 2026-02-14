const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/voucher.json');

module.exports = function saveToJson(data) {
    let db = [];

    // 📥 baca file kalau ada
    if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        try {
            db = JSON.parse(raw);
            if (!Array.isArray(db)) db = [];
        } catch (e) {
            db = [];
        }
    }

    // 🧾 push data baru
    db.push({
        ...data,
        id: `V-${Date.now()}`,
    });

    // 💾 simpan ulang
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

    return true;
};
