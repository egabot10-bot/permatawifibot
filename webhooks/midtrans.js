module.exports = function ({ app, permatabot, generateSafeVoucher, sendStatus }) {

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

            //📡 push ke mikrotik
            const {addUserToMikrotik} = require('../services/mikrotik');
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
            /*
            {
  "transaction_time": "2023-11-15 18:45:13",
  "transaction_status": "settlement",
  "transaction_id": "513f1f01-c9da-474c-9fc9-d5c64364b709",
  "status_message": "midtrans payment notification",
  "status_code": "200",
  "signature_key": "238477c0f76a6f85d360693bf4f00974cab58bdfcb503f1a891733c3c971cfe8c46db35361dd827df232d5f08a370b5a7adb1fc3cd41f95dd3b30d93f3404e54",
  "settlement_time": "2023-11-15 22:45:13",
  "payment_type": "gopay",
  "order_id": "payment_notif_test_G137154999_6e3216b6-9001-4fd4-86ab-678b2ffc73a6",
  "merchant_id": "G137154999",
  "gross_amount": "105000.00",
  "fraud_status": "accept",
  "currency": "IDR"
}
            */

            // 🤖 kirim Telegram
            await permatabot.sendMessage(
                order.chatId,
                `✅ *Pembayaran Berhasil!*\n\n` +
                `🎟 Voucher: *${voucher}*\n` +
                `📦 Paket: *${order.label}*\n` +
                `⚡ Speed: *5 Mbps*`,
                { parse_mode: 'Markdown' }
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
