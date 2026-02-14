const midtransClient = require('midtrans-client');
const pendingOrder = require('../data/pendingOrder');

const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: "SB-Mid-server-VjhgOq7uolnQ8cXKdeJ8AMsu",
});

async function createInvoice(chatId, order) {
    const orderId = `INV-${Date.now()}`;


    pendingOrder[orderId] = {
        chatId,
        username: order.username || null,
        profile: order.profile,
        uptime: order.uptime,
        label: order.label,
        price: order.price,
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
