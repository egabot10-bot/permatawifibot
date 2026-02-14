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
                length: 4
            });

            // 📡 push ke mikrotik
            const {addUserToMikrotik} = require('../services/mikrotik');
            await addUserToMikrotik({
                username: voucher,
                password: voucher,
                profile: order.profile,
                uptime: order.uptime,
                service: 'hotspot'
            });

            // 💾 simpan ke voucher.json
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
                `🎟 Voucher: *${voucher}*\n` +
                `📦 Paket: *${order.label}*\n` +
                `⚡ Speed: *5 Mbps*`,
                { parse_mode: 'Markdown' }
            );

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
