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
                length: 6
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
    }   
);
};
