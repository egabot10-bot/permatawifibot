const midtransClient = require('midtrans-client');
const pendingOrder = require('../data/pendingOrder');
require('dotenv').config()

const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.SERVER_KEY,
});

async function createInvoice(chatId, order) {
    const orderId = `INV-${Date.now()}`;
    pendingOrder[orderId] = {
        chatId,
        adminId: order.admin,
        username: order.username || null,
        profile: order.profile,
        uptime: order.uptime,
        label: order.label,
        price: order.price,
        speed : order.actualSpeed,
        createdAt: new Date().toISOString()
    };

    console.log('Pending Orders:', pendingOrder);

    const trx = await snap.createTransaction({
        transaction_details: {
            order_id: orderId,
            gross_amount: order.price
        }
    });

    return {
        orderId,
        redirectUrl: trx.redirect_url
    };
}

module.exports = createInvoice;
