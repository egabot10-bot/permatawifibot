const midtransClient = require('midtrans-client');

const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.SERVER_KEY,
});

const pendingOrder = {};

async function createInvoice(chatId, order) {
    const orderId = `INV-${Date.now()}`;

    pendingOrder[orderId] = {
        chatId,
        ...order
    };

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

module.exports = {
    pendingOrder,
    createInvoice
};
