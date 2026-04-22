const crypto = require('crypto');

const SECRET_KEY = Buffer.from("egun-secret-keys".padEnd(32));

 function decryptData(base64) {
    const data = Buffer.from(base64, 'base64');

    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);

    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        SECRET_KEY,
        iv
    );

    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
    }

function encryptData(text) {
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        SECRET_KEY,
        iv
    );

    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return Buffer.concat([iv, encrypted]).toString('base64');
}

module.exports = {
    decryptData,
    encryptData
};