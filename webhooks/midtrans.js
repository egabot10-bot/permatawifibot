
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
                `Pembelian dari ${order.username} telah berhasil\n\n`+
                `Nominal Rp. ${order.price}\nProfile : ${order.name}\nkode voucher : ${voucher}`+
                `\n\nPesan Sistem.`
            )
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
    try {
        const decrypted = decryptData(req.body.data);
        const payload = JSON.parse(decrypted);

        const { hwid, ts } = payload;

        // validasi contoh
        if (hwid === "123456789") {
            return res.json({
                data: encryptData(JSON.stringify({ status: true }))
            });
        }

        return res.json({
            data: encryptData(JSON.stringify({ status: false }))
        });

    } catch (err) {
        return res.status(500).json({
            data: encryptData(JSON.stringify({ status: false }))
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
app.post('/test',(req,res)=>{
const {decryptData} = require('../services/crypto');
return decryptData(req.body);
}) 

};
