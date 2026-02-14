/* ==============================
// DEPENDENCY
// const QRCode = require('qrcode');
const { RouterOSAPI } = require('node-routeros');
// ==============================*/
const PermataBot = require('./app/PermataBot');
const midtransWebhook = require('./webhooks/midtrans');

const express = require('express');
const dotenv = require('dotenv').config();
const app = express();
app.use(express.json());


const { pendingOrder } = require('./payment');
const { get } = require('http');
// ==============================
// CONFIG
// ==============================
const options ={
    polling: true
};

const token = process.env.TELE_TOKEN;
const adminId = String(process.env.ADMIN_ID);
const userState = {};

const permatabot = new PermataBot(token, options, adminId);
// permatabot.init();
permatabot.getStart();
// (async () => {
//     const generateSafeVoucher = require('./services/generateSafeVoucher');
//     const pendingOrder = require('./data/pendingOrder');

//     const voucher = await generateSafeVoucher({
//         length: 4,
//         pendingOrder
//     });

//     console.log('🎟 Voucher hasil generate:', voucher);
// })();


midtransWebhook({
    app,
    permatabot,
    pendingOrder,
    generateSafeVoucher: require('./services/generateSafeVoucher'),
    addUserToMikrotik: require('./services/mikrotik'),
    saveToJson: require('./services/storage')
});
// app/get('/', (req, res) => {
//     res.send('Midtrans Webhook is alive!');
// });
app.listen(3001, () => {
    console.log('🚀 Midtrans Webhook hidup, bot siap jualan');
});

