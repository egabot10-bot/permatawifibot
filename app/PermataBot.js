const TelegramBot = require('node-telegram-bot-api');
const commands = require('../libs/commands');
const fs = require('fs');
const path = require('path');
const createInvoice = require('../data/createInvoice');
const { uptime } = require('process');
const { text } = require('stream/consumers');
const DB_FILE = path.join(__dirname, '../services/voucher.json');
const userState = {};

class PermataBot extends TelegramBot {
    constructor(token, options, adminId){
        super(token, options);
        this.adminId = adminId;
        this.on('message', (msg) => {
           const isInCommand = Object.values(commands).some((commands) => commands.test(msg.text));
           if(!isInCommand){
               this.sendMessage(msg.chat.id, "Perintah tidak dikenal. Silakan gunakan perintah yang tersedia.");
               this.mainMenu(msg.chat.id);
           }
        });
        this.on('callback_query', (callbackQuery) => {
             if (userState[callbackQuery.message.chat.id]?.step === 'WAITING_PAYMENT') {
                    return this.answerCallbackQuery(callbackQuery.id, {
                        text: '⚠️ Selesaikan pembayaran dulu ya 🙂',
                        show_alert: true
                    });
                }
            console.log(`Executing callback query... by ${callbackQuery.from.username}`);
            const data = callbackQuery.data;
            const msg = callbackQuery.message;
            switch (data) { 

            case 'MENU_ADMIN_PANEL':
                //this.cekAdmin();
                this.MainMenuAdmin(msg.chat.id);
                break;
                
            case 'Setup_Internet':
                this.setupMikrotikInternet(msg.chat.id);
                break;
            case 'STATIC_IP':
                this.handleMikrotikStaticIP(msg.chat.id);
                break;
                    
            case 'DHCP':
                this.handleMikrotikDHCP(msg.chat.id);
                break;
            // Setup Hotspot
            case 'Setup_Hotspot':
                this.handleInfrastructureHotspot(msg.chat.id);
                break;
            // Client
            
            case 'MenuPaketInternet':
                this.PilihPaketInternet(msg.chat.id);
                break;

            case 'MENU_STATUS':
                this.sendMessage(msg.chat.id, '📊 Status fitur ini segera hadir 🚧');
                break;

            case 'BACK_MAIN':
                this.mainMenu(msg.chat.id);
                break;

            case 'BACK_PAKET':
                this.PilihPaketInternet(msg.chat.id);
                break;

            case 'Single':
                this.MenuSingle(msg.chat.id);
                break;
            
            case 'SINGLE_1D':
                this.sendMessage(msg.chat.id, 'Anda memilih Paket Single Device untuk 1 Hari.');
                this.handleSingle(msg.chat.id, 'SINGLE_1D');
                break;
        }
        });
    }

    getStart(){
        this.onText(commands.start, (msg) => {
            this.mainMenu(msg.chat.id);
        });
    }
    
    mainMenu(chatId){
        const keyboard = [
            [{ text: '🛒 Beli Paket Internet', callback_data: 'MenuPaketInternet' }],
            [{ text: '📊 Cek Status', callback_data: 'MENU_STATUS' }],
            [{ text: '☎️ Hubungi Admin', callback_data: 'MENU_CONTACT' }]
        ];
        if(chatId == this.adminId){
            keyboard.push([{ text: '⚙️ Admin Panel', callback_data: 'MENU_ADMIN_PANEL' }]);
         }
        const message = `👋 Selamat datang di *Permata Wifi!*\n\n` +
        `Internet murah, stabil, dan siap tempur 🚀\n\n` +
        `✨ Fitur unggulan:\n` +
        `• Internet stabil untuk harian\n` +
        `• Bisa dipakai banyak perangkat\n` +
        `• Aktivasi cepat, langsung online`;
        this.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    }

    PilihPaketInternet(chatId){
        this.sendMessage(
                chatId,
                `🌐 *Pilih Paket Internet*\n\n` +
        
                `🏠 *Rumahan (14 Device)* — *30 Hari*\n` +
                `Cocok untuk keluarga / rame-rame\n\n` +
        
                `🏆 *Gold*\n` +
                `• Speed hingga *20 Mbps*\n` +
                `• Maks *14 Device*\n` +
                `• *Unlimited*\n\n` +
        
                `🥈 *Silver*\n` +
                `• Speed hingga *10 Mbps*\n` +
                `• Maks *14 Device*\n` +
                `• *Unlimited*\n\n` +
        
                `🥉 *Bronze*\n` +
                `• Speed hingga *5 Mbps*\n` +
                `• Maks *14 Device*\n` +
                `• *Unlimited*\n\n` +
        
                `📱 *Paket 1 Device*\n` +
                `Cocok untuk pribadi / HP saja`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🏆  Gold', callback_data: 'Rumah_Gold' },
                                { text: '🥈  Silver', callback_data: 'Rumah_Silver' }
                            ],
                            [
                                { text: '🥉  Bronze', callback_data: 'Rumah_Bronze' },
                                { text: '📱 1 Device', callback_data: 'Single' }
                            ],
                            [
                                { text: '⬅️  Kembali', callback_data: 'BACK_MAIN' }
                            ]
                        ]
                    }
                }
            );
    }

    MenuSingle(chatId){
        userState[chatId] = { step: 'CHOOSING_DURATION' };
            this.sendMessage(
                chatId,
                `📱 *Paket Single Device*\n\n` +
                `• Speed hingga *5 Mbps*\n` +
                `• *1 Device*\n` +
                `• *Unlimited*\n\n` +
                `• *1 Hari  : Rp 5000*\n` +
                `• *3 Hari  : Rp 10000*\n` +
                `• *7 Hari  : Rp 25000*\n` +
                `• *30 Hari : Rp 40000*\n\n` +
                `Silakan pilih durasi penggunaan:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '1 Hari', callback_data: 'SINGLE_1D' },
                                { text: '3 Hari', callback_data: 'SINGLE_3D' }
                            ],
                            [
                                { text: '7 Hari', callback_data: 'SINGLE_7D' },
                                { text: '30 Hari', callback_data: 'SINGLE_30D' }
                            ],
                            [
                                { text: '⬅️ Kembali', callback_data: 'BACK_PAKET' }
                            ]
                        ]
                    }
                });
    }



    handleRumahGold(chatId){

    }


    async handleSingle(chatId, packageType) {

    userState[chatId] = { step: 'WAITING_PAYMENT' };

    const SINGLE_MAP = {
        SINGLE_1D: { username: chatId.username,profile: 'Single', uptime: '1d', label: '1 Hari', price: 5000 },
        SINGLE_3D: { username: chatId.username,profile: 'Single', uptime: '3d', label: '3 Hari', price: 10000 },
        SINGLE_7D: { username: chatId.username,profile: 'Single', uptime: '7d', label: '7 Hari', price: 25000 },
        SINGLE_30D:{ username: chatId.username,profile: 'Single', uptime: '30d',label: '30 Hari',price: 40000 },
    };

    const pkg = SINGLE_MAP[packageType];

    if (!pkg) {
        delete userState[chatId];
        return this.sendMessage(chatId, '❌ Paket tidak valid.');
    }

    try {
        const { orderId, redirectUrl } = await createInvoice(chatId, pkg);

        this.sendMessage(
            chatId,
            `💳 *Pembayaran Paket Single*\n\n` +
            `📦 Paket: *${pkg.label}*\n` +
            `🧾 Invoice: *${orderId}*\n` +
            `💰 Harga: *Rp ${pkg.price.toLocaleString('id-ID')}*\n\n` +
            `Klik tombol di bawah untuk lanjut pembayaran 👇`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💰 Bayar Sekarang', url: redirectUrl }],
                        [{ text: '⬅️ Kembali', callback_data: 'BACK_PAKET' }]
                    ]
                }
            }
        );
    } catch (err) {
        console.error(err);
        delete userState[chatId];
        this.sendMessage(chatId, '❌ Gagal membuat invoice, coba lagi ya.');
    }

    //Admin Panel
    }

    MainMenuAdmin(chatId){
        const keyboard = [
            //[{text: 'Setup Mikrotik', callback_data: 'Setup_Mikrotik' }],
            [{ text: 'Internet Setup', callback_data: 'Setup_Internet' }],
            [{ text: 'Install Infrastruktur Hotspot', callback_data: 'Setup_Hotspot' }],
            [{ text: 'Install Infrastruktur PPPoE', callback_data: 'Setup_PPPoE' }],
            [{text: '⬅️ Kembali', callback_data: 'BACK_MAIN' }]
        ];
        const message = `Admin Panel\n\n` +
        `• Internet Setup\n` +
        `• Install Infrastruktur Hotspot\n` +
        `• Cek`;

        this.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    }

    setupMikrotikInternet(chatId){
        this.sendMessage(
                chatId,
                `📱 *Pilih Koneksi Internet*\n\n` +
                `• Setup Koneksi *DHCP*\n` +
                `• Setup Koneksi *PPPoE*\n` +
                `• Setup Koneksi *STATIC*\n\n` +
                `Pastikan Koneksi ISP ke Ether 1:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'DHCP', callback_data: 'DHCP' },
                                { text: 'PPPoE', callback_data: 'PPPoE' }
                            ],
                            [
                                { text: 'Static IP', callback_data: 'STATIC_IP' }
                            ],
                            [{ text: '⬅️ Kembali', callback_data: 'MENU_ADMIN_PANEL' }]
                        ]
                    }
                });
    }
    handleMikrotikDHCP(chatId){
        const {setupMikrotikInternetDHCP} = require('../services/mikrotik');
        setupMikrotikInternetDHCP({
            ethernetInterface: 'ether1',
            type: 'dhcp'
        }).then(() => {
            this.sendMessage(chatId, '✅ Setup Mikrotik ke DHCP berhasil!');
        }).catch((err) => {
            console.error('Error setting up Mikrotik DHCP:', err);
            this.sendMessage(chatId, '❌ Gagal setup Mikrotik ke DHCP. Coba lagi ya.');
        });
    }

    handleMikrotikPPPoEClient(chatId){
        this.sendMessage(chatId, 'Fitur ini segera hadir 🚧');
    }
    handleMikrotikStaticIP(chatId){
        this.sendMessage(chatId, 'Fitur ini segera hadir 🚧');
    }

    handleInfrastructureHotspot(chatId){
        const { infrastrukturHotspot } = require('../services/mikrotik');
        infrastrukturHotspot({
            name: 'PermataWifi'
        }).then(() => {
            this.sendMessage(chatId, '✅ Infrastruktur Hotspot berhasil diinstal!');
        }).catch((err) => {
            console.error('Error setting up Mikrotik Infrastruktur Hotspot:', err);
            this.sendMessage(chatId, '❌ Gagal setup Infrastruktur Hotspot. Coba lagi ya.');
        });
    }

}


module.exports = PermataBot;