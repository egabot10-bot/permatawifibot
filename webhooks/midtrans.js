
module.exports = function ({ app, permatabot, generateSafeVoucher }) {

    const pendingOrder = require('../data/pendingOrder');
   

    app.post('/midtrans/webhook', async (req, res) => {
        try {
            const { order_id, transaction_status } = req.body;

            if (!order_id) return res.sendStatus(200);

            if (!['settlement', 'capture'].includes(transaction_status)) {
                return res.sendStatus(200);
            }

            const order = pendingOrder[order_id];
            if (!order) return res.sendStatus(200); // already handled / expired

            // 🔐 generate voucher (safe)
            const voucher = await generateSafeVoucher({
                length: 5
            });

            
            //📡 push ke mikrotik
            const {addUserToMikrotik, ProfileKosong} = require('../services/mikrotik');
            // const readyProfile = await ProfileKosong(order.profile);
            // if(!readyProfile.status){

            // }
            //console.log(`from payment : ${readyProfile.name}`)

            await addUserToMikrotik({
                username: voucher,
                password: voucher,
                profile: order.profile,
                uptime: order.uptime,
                service: 'hotspot'
            });

            //💾 simpan ke voucher.json
            const saveToJson = require('../services/storage');
            saveToJson({
                voucher,
                profile: order.profile,
                duration: order.label,
                price: order.price,
                createdAt: new Date().toISOString()
            });
            // 🤖 kirim Telegram
            await permatabot.sendMessage(
                order.chatId,
                `✅ *Pembayaran Berhasil!*\n\n` +
                `---------------------------------\n`+
                `🎟 Voucher: *${voucher}*\n` +
                `📦 Paket: *${order.label}*\n` +
                `⚡ Speed: *${order.speed}*\n`+
                `---------------------------------`
                ,
                { parse_mode: 'Markdown',reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Kembali', callback_data: 'BACK_MAIN' }]
                    ]
                } }
            );
            await permatabot.sendMessage(
                order.adminId,
                `Pembelian dari @${order.username} telah berhasil\n\n`+
                `Nominal Rp. ${order.price}\nProfile : ${order.profile}\nkode voucher : ${voucher}`+
                `\n\nPesan Sistem.`
            )
            console.log(order);
            if (permatabot.userState?.[order.chatId]) {
                console.log('STATE BEFORE:', permatabot.userState[order.chatId]);

                permatabot.userState[order.chatId].step = null;

                console.log('STATE AFTER:', permatabot.userState[order.chatId]);
            }

            delete pendingOrder[order_id]; // 🧹 cleanup
            res.sendStatus(200);

        } catch (err) {
            console.error('MIDTRANS WEBHOOK ERROR:', err);
            res.sendStatus(200);
        }

    });

    app.get('/', (req, res) => {
        res.send('PermataBot is running');
    });

app.post('/ExpireMonitor', (req, res) => {
    const { decryptData, encryptData } = require('../services/crypto');
    const dataBase = require('../data/lisence.json');

    try {
        // =========================
        // ambil data dari C#
        // format request:
        // {
        //   "data": "encrypted_string"
        // }
        //
        // hasil decrypt:
        // HWID|CURRENT_TIMESTAMP
        // =========================

        const { data } = req.body;

        if (!data) {
            return res.json({
                data: encryptData(JSON.stringify({
                    status: false,
                    message: "No data received"
                }))
            });
        }

        const decrypted = decryptData(data);

        const [requestHwid, currentTimestamp] = decrypted.split('|');

        if (!requestHwid || !currentTimestamp) {
            return res.json({
                data: encryptData(JSON.stringify({
                    status: false,
                    message: "Invalid payload"
                }))
            });
        }

        console.log("Request HWID :", requestHwid);
        console.log("Current TS   :", currentTimestamp);

        // =========================
        // cari HWID di lisence.json
        //
        // format tersimpan:
        // HWID|EXPIRE_TIMESTAMP
        // =========================

        let foundUser = null;

        for (const item of dataBase) {
            try {
                const decryptedLicense = decryptData(item.data);

                const [savedHwid, expireTimestamp] =
                    decryptedLicense.split('|');

                console.log(
                    `Check ${item.user} -> ${savedHwid}`
                );

                if (savedHwid === requestHwid) {
                    foundUser = {
                        user: item.user,
                        hwid: savedHwid,
                        expireTimestamp: Number(expireTimestamp)
                    };

                    break;
                }

            } catch (err) {
                console.log(`Skip broken license: ${item.user}`);
            }
        }

        // =========================
        // kalau HWID tidak ditemukan
        // =========================

        if (!foundUser) {
            return res.json({
                data: encryptData(JSON.stringify({
                    status: false,
                    message: "HWID tidak terdaftar"
                }))
            });
        }

        // =========================
        // compare expire
        // currentTimestamp dari C#
        // vs
        // expireTimestamp dari lisence.json
        // =========================

        const nowTs = Number(currentTimestamp);

        const isExpired =
            nowTs > foundUser.expireTimestamp;

        // =========================
        // response terenkripsi
        // =========================

        if (isExpired) {
            return res.json({
                data: encryptData(JSON.stringify({
                    status: false,
                    expired: true,
                    message: "License expired",
                    user: foundUser.user,
                    expiredAt: foundUser.expireTimestamp
                }))
            });
        }

        return res.json({
            data: encryptData(JSON.stringify({
                status: true,
                expired: false,
                message: "License active",
                user: foundUser.user,
                expiredAt: foundUser.expireTimestamp
            }))
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            data: encryptData(JSON.stringify({
                status: false,
                message: "Server error"
            }))
        });
    }
});
    app.post('/verify', (req, res) => {
    const { decryptData, encryptData } = require('../services/crypto');
    const license = require('../data/lisence.json');

    try {
        const { data } = req.body;
        console.log(data);
        if (!data) return res.json({ status: false });

        const decrypted = decryptData(data);

        const [hwid, timestamp] = decrypted.split('|');

        console.log('HWID:', hwid);
        console.log('Timestamp:', timestamp);

        // contoh validasi simple
        const now = Math.floor(Date.now() / 1000);

        if (now - timestamp > 30) {
            return res.json({ status: false, message: 'Expired' });
        }

        return res.json({
            status: true,
            hwid,
            timestamp
        });

    } catch (err) {
        console.error(err);
        res.json({ status: false });
    }
});

  app.post('/test', (req, res) => {
    try {
        const dataBase = require('../data/lisence.json');
        const { decryptData } = require('../services/crypto');

        // data dari C#
        const { data } = req.body;

        if (!data) {
            return res.json({
                status: false,
                message: 'No data received'
            });
        }

        // decrypt request dari launcher
        const decrypted = decryptData(data);

        // format: HWID|TIMESTAMP
        const [hwid, timestamp] = decrypted.split('|');

        if (!hwid || !timestamp) {
            return res.json({
                status: false,
                message: 'Invalid payload'
            });
        }

        console.log("Request HWID :", hwid);
        console.log("Timestamp    :", timestamp);

        // =========================
        // compare ke lisence.json
        // =========================

        let foundUser = null;

        for (const item of dataBase) {
            try {
                // decrypt data license dari json
                const decryptedLicense = decryptData(item.data);

                // format di json diasumsikan:
                // HWID|TIMESTAMP
                const [savedHwid, savedTimestamp] = decryptedLicense.split('|');

                console.log(
                    `Check ${item.user} -> ${savedHwid}`
                );

                if (savedHwid === hwid) {
                    foundUser = {
                        user: item.user,
                        hwid: savedHwid,
                        createdAt: savedTimestamp
                    };
                    break;
                }

            } catch (err) {
                console.log(`Decrypt gagal untuk ${item.user}`);
            }
        }

        // =========================
        // response
        // =========================

        if (!foundUser) {
            return res.json({
                status: false,
                message: 'HWID tidak terdaftar'
            });
        }

        return res.json({
            status: true,
            message: 'License valid',
            user: foundUser.user,
            hwid: foundUser.hwid,
            registeredAt: foundUser.createdAt
        });

    } catch (err) {
        console.error(err);

        return res.json({
            status: false,
            message: 'Server decrypt error'
        });
    }
});

app.post('/add30D', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');

        const filePath = path.join(__dirname, '../data/lisence.json');

        const { decryptData, encryptData } = require('../services/crypto');

        // =========================
        // request body
        // contoh:
        // {
        //   "user": "Akbar 08xxxxxxxxx",
        //   "data": "encrypted_string"
        // }
        // =========================

        const { user, data } = req.body;

        if (!user || !data) {
            return res.json({
                status: false,
                message: 'user atau data kosong'
            });
        }

        // =========================
        // decrypt request
        // format awal dari client:
        // HWID|TIMESTAMP
        // =========================

        const decrypted = decryptData(data);

        const [hwid, oldTimestamp] = decrypted.split('|');

        if (!hwid || !oldTimestamp) {
            return res.json({
                status: false,
                message: 'format decrypt tidak valid'
            });
        }

        console.log("HWID lama :", hwid);
        console.log("Timestamp awal :", oldTimestamp);

        // =========================
        // tambah 30 hari + 1 jam
        // =========================

        const oldTs = Number(oldTimestamp);

        const addSeconds =
            (30 * 24 * 60 * 60) + // 30 hari
            (1 * 60 * 60);        // + 1 jam

        const newExpireTimestamp = oldTs + addSeconds;

        console.log("Expire Timestamp :", newExpireTimestamp);

        // =========================
        // format baru yang disimpan:
        // HWID|EXPIRE_TIMESTAMP
        // =========================

        const finalRaw = `${hwid}|${newExpireTimestamp}`;

        const encryptedFinal = encryptData(finalRaw);

        // =========================
        // baca lisence.json lama
        // =========================

        let licenses = [];

        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');

            if (raw.trim()) {
                licenses = JSON.parse(raw);
            }
        }

        // =========================
        // optional:
        // cek duplicate HWID
        // =========================

        for (const item of licenses) {
            try {
                const oldDecrypt = decryptData(item.data);
                const [savedHwid] = oldDecrypt.split('|');

                if (savedHwid === hwid) {
                    return res.json({
                        status: false,
                        message: 'HWID sudah terdaftar',
                        user: item.user
                    });
                }

            } catch (err) {
                console.log(`Skip broken item: ${item.user}`);
            }
        }

        // =========================
        // push ke lisence.json
        // =========================

        const newLicense = {
            user,
            data: encryptedFinal
        };

        licenses.push(newLicense);

        fs.writeFileSync(
            filePath,
            JSON.stringify(licenses, null, 4),
            'utf8'
        );

        return res.json({
            status: true,
            message: 'License +30 Hari berhasil ditambahkan',
            user,
            hwid,
            expiredAt: newExpireTimestamp
        });

    } catch (err) {
        console.error(err);

        return res.json({
            status: false,
            message: 'Add30D error'
        });
    }
});

app.post('/add1M', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');

        const filePath = path.join(__dirname, '../data/lisence.json');

        const { decryptData, encryptData } = require('../services/crypto');

        // =========================
        // request body
        // contoh:
        // {
        //   "user": "Akbar 08xxxxxxxxx",
        //   "data": "encrypted_string"
        // }
        // =========================

        const { user, data } = req.body;

        if (!user || !data) {
            return res.json({
                status: false,
                message: 'user atau data kosong'
            });
        }

        // =========================
        // decrypt request
        // format:
        // HWID|TIMESTAMP
        // =========================

        const decrypted = decryptData(data);

        const [hwid, oldTimestamp] = decrypted.split('|');

        if (!hwid || !oldTimestamp) {
            return res.json({
                status: false,
                message: 'format decrypt tidak valid'
            });
        }

        console.log("HWID :", hwid);
        console.log("Timestamp awal :", oldTimestamp);

        // =========================
        // tambah 1 menit
        // =========================

        const oldTs = Number(oldTimestamp);

        const addSeconds = 120; // 1 menit

        const newExpireTimestamp = oldTs + addSeconds;

        console.log("Expire Timestamp :", newExpireTimestamp);

        // =========================
        // format simpan:
        // HWID|EXPIRE_TIMESTAMP
        // =========================

        const finalRaw = `${hwid}|${newExpireTimestamp}`;

        const encryptedFinal = encryptData(finalRaw);

        // =========================
        // baca lisence.json lama
        // =========================

        let licenses = [];

        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');

            if (raw.trim()) {
                licenses = JSON.parse(raw);
            }
        }

        // =========================
        // cek duplicate HWID
        // =========================

        for (const item of licenses) {
            try {
                const oldDecrypt = decryptData(item.data);
                const [savedHwid] = oldDecrypt.split('|');

                if (savedHwid === hwid) {
                    return res.json({
                        status: false,
                        message: 'HWID sudah terdaftar',
                        user: item.user
                    });
                }

            } catch (err) {
                console.log(`Skip broken item: ${item.user}`);
            }
        }

        // =========================
        // push ke lisence.json
        // =========================

        const newLicense = {
            user,
            data: encryptedFinal
        };

        licenses.push(newLicense);

        fs.writeFileSync(
            filePath,
            JSON.stringify(licenses, null, 4),
            'utf8'
        );

        return res.json({
            status: true,
            message: 'License +1 Menit berhasil ditambahkan',
            user,
            hwid,
            expiredAt: newExpireTimestamp
        });

    } catch (err) {
        console.error(err);

        return res.json({
            status: false,
            message: 'Add1M error'
        });
    }
});

};
