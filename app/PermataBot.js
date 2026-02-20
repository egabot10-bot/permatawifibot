const TelegramBot = require('node-telegram-bot-api');
const commands = require('../libs/commands');
const fs = require('fs');
const path = require('path');
const createInvoice = require('../data/createInvoice');
const { uptime } = require('process');
const { text } = require('stream/consumers');
const { profile } = require('console');
const DB_FILE = path.join(__dirname, '../services/voucher.json');

class PermataBot extends TelegramBot {
    constructor(token, options, adminId){
        super(token, options);
        this.adminId = adminId;
        this.lastMessage = {};
        this.userState= {};
        this.monitorExpiredVouchers();
        this.on('message', (msg) => {
            if(this.userState[msg.chat.id]?.step === "WAITING_VOUCHER"){
            console.log(`waiting voucher`)
           }
           const isInCommand = Object.values(commands).some((commands) => commands.test(msg.text));
           if(!isInCommand){
               this.sendMessage(msg.chat.id, "Perintah tidak dikenal. Silakan gunakan perintah yang tersedia.");
               this.mainMenu(msg.chat.id);
           }
        //    if(this.userState[msg.chat.id]?.step === "WAITING_VOUCHER"){
        //     console.log(`waiting voucher`)
        //    }
        
    });
        this.onText(/kode(.+)/, (data, after) => {
        const chatId = data.chat.id;
        const clearCode = after[1].replace(/\s+/g, '');

        // init state kalau belum ada
        if (!this.userState[chatId]) {
            this.userState[chatId] = {
                tryCheck: 0,
                timeout: null
            };
        }

        this.userState[chatId].tryCheck++;

        if (this.userState[chatId].tryCheck > 5) {
            this.sendMessage(chatId, '❌ Kuota Cek Habis Hanya 5x dalam 1 jam, coba lagi 1 jam kedepan ⏳');
            return;
        }

        // set auto reset (cooldown)
        if (!this.userState[chatId].timeout) {
            this.userState[chatId].timeout = setTimeout(() => {
                delete this.userState[chatId];
            }, 3_600_000); // 1 menit
        }

        this.handleCekVoucher(chatId, clearCode);
    });

        this.on('callback_query', (callbackQuery) => {
             if (this.userState[callbackQuery.message.chat.id]?.step === 'WAITING_PAYMENT') {
                    return this.answerCallbackQuery(callbackQuery.id, {
                        text: '⚠️ Selesaikan pembayaran dulu ya 🙂',
                        show_alert: true
                    });
                }
            // if(this.userState[callbackQuery.message.chat.id]?.step ==='WAITING_VOUCHER'){
            //     return this.answerCallbackQuery(callbackQuery.id,{
            //         text:`Silahkan input voucher dulu`,
            //         show_alert : true
            //     })
            // }
            console.log(`Executing callback query... by ${callbackQuery.from.username} akses : ${callbackQuery.data}`);
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
                this.sendMessage(msg.chat.id, 'Mohon tunggu sebentar, bot sedang konfigurasi...');
                this.handleInfrastructureHotspot(msg.chat.id);
                break;
            // Client
            case 'CekVoucher' :
                //this.handleCekVoucher(msg.chat.id);
                this.userState[msg.chat.id] = {step:'WAITING_STATUS'};
                this.sendMessage(msg.chat.id, `🎟️ Masukkan kode voucher kamu seperti contoh : \n\n/kode ( kode kamu ) || /kode 79SF`);
                break;
            case 'MenuPaketInternet':
                this.PilihPaketInternet(msg.chat.id);
                break;

            case 'MENU_STATUS':
                this.sendMessage(msg.chat.id, '📊 Status fitur ini segera 🚧');
                break;

            case 'BACK_MAIN':
                this.mainMenu(msg.chat.id);
                break;

            case 'BACK_PAKET':
                this.PilihPaketInternet(msg.chat.id);
                break;
            case 'GOLD':
                this.handleRumah(msg, 'GOLD');
                break;
            case 'SILVER':
                this.handleRumah(msg, 'SILVER');
                break;
            case 'BRONZE':
                this.handleRumah(msg, 'BRONZE');
                break;
            case 'Single':
                this.MenuSingle(msg.chat.id);
                break;
            
            case 'SINGLE_1D':
                this.sendMessage(msg.chat.id, 'Anda memilih Paket Single Device untuk 1 Hari.');
                this.handleSingle(msg.chat.id, 'SINGLE_1D');
                break;
            case 'SINGLE_3D':
                this.sendMessage(msg.chat.id, 'Anda memilih Paket Single Device untuk 3 Hari.');
                this.handleSingle(msg.chat.id, 'SINGLE_3D');
                break;
            case 'SINGLE_7D':
                this.sendMessage(msg.chat.id, 'Anda memilih Paket Single Device untuk 7 Hari.');
                this.handleSingle(msg.chat.id, 'SINGLE_1D');
                break;
            case 'SINGLE_3D':
                this.sendMessage(msg.chat.id, 'Anda memilih Paket Single Device untuk 30 Hari.');
                this.handleSingle(msg.chat.id, 'SINGLE_1D');
                break;
        }
        });
    //this.on('callback_query', this.handleCallback.bind(this));
    }

    // Next ip firewall mangle add chain=postrouting action=change-ttl new-ttl=set:1 out-interface=PermataWifiBridg
    getStart(){
        this.onText(commands.start, (msg) => {
            this.mainMenu(msg.chat.id);
        });
    }
    
    mainMenu(chatId){
        const keyboard = [
            [{ text: '🛒 Beli Paket Internet', callback_data: 'MenuPaketInternet' }],
            [{ text: '📊 Cek Status Paket', callback_data: 'CekVoucher' }],
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
        
                `🏆 *Gold* • *Rp. 125.000*\n` +
                `• Speed hingga *20 Mbps*\n` +
                `• Maks *14 Device*\n` +
                `• *Unlimited*\n\n` +
        
                `🥈 *Silver* • *Rp. 100.000*\n` +
                `• Speed hingga *15 Mbps*\n` +
                `• Maks *14 Device*\n` +
                `• *Unlimited*\n\n` +
        
                `🥉 *Bronze* • *Rp. 80.000*\n` +
                `• Speed hingga *10 Mbps*\n` +
                `• Maks *14 Device*\n` +
                `• *Unlimited*\n\n` +
        
                `📱 *Paket 1 Device*\n` +
                `Cocok untuk pribadi / HP saja`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🏆  Gold', callback_data: 'GOLD' },
                                { text: '🥈  Silver', callback_data: 'SILVER' }
                            ],
                            [
                                { text: '🥉  Bronze', callback_data: 'BRONZE' },
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
        this.userState[chatId] = { step: 'CHOOSING_DURATION' };
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


    async handleRumah(msg, packageType) {
    const chatId = msg.chat.id;
    const uname = msg.chat.username;
    this.userState[chatId] = { step: 'WAITING_PAYMENT' };

    const { ProfileKosong } = require('../services/mikrotik');

    const RumahMap = {
        GOLD   : { username : uname,name:'Rumah Gold 14 Device',   uptime:'30d',label:'30 Hari',price : 125000, actualSpeed:"20 Mbps" },
        SILVER : { username : uname,name:'Rumah Silver 14 Device', uptime:'30d',label:'30 Hari',price : 100000, actualSpeed:"15 Mbps"  },
        BRONZE : {  username : uname, name:'Rumah Bronze 14 Device', uptime:'30d',label: '30 Hari', price : 80000, actualSpeed:"10 Mbps"  }
    };

    const paket = RumahMap[packageType];
    if (!paket) {
        return this.sendMessage(chatId, '❌ Paket tidak valid');
    }

    const readyProfile = await ProfileKosong(packageType);
    if (!readyProfile.status) {
    this.sendMessage(
        chatId,
        `🚫 Slot * ${packageType} * sudah penuh.\nSilakan pilih paket lain atau coba hubungi admin 🙏`
    );
    return this.mainMenu(chatId);
    }
    // // this.sendMessage(
    // //     chatId,
    // //     `🏠 Paket: ${pkg.name}\n` +
    // //     `📡 Profile: ${profile.name}\n` +
    // //     `👥 Jumlah user: ${profile.totalUser}\n`+
    // //     `Yang Di cari : ${packageType}` 
    // // );
    const pkg = {
    ...paket,
    //profile: readyProfile.name
    profile: readyProfile.name
    };
    try {
        const { orderId, redirectUrl } = await createInvoice(chatId, pkg);

        this.sendMessage(
            chatId,
            `💳 *Pembayaran Paket ${pkg.name}*\n\n` +
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
        delete this.userState[chatId];
        this.sendMessage(chatId, '❌ Gagal membuat invoice, coba lagi ya.');
    }

    // next step:
    // - create hotspot user
    // - set profile = profile.name
    }


    async handleSingle(chatId, packageType) {

    this.userState[chatId] = { step: 'WAITING_PAYMENT' };

    const SINGLE_MAP = {
        SINGLE_1D: { username: chatId.username, profile: 'Single', uptime: '1d', label: '1 Hari', price: 5000, actualSpeed : "5 Mbps" },
        SINGLE_3D: { username: chatId.username, profile: 'Single3D', uptime: '3d', label: '3 Hari', price: 10000, actualSpeed : "5 Mbps" },
        SINGLE_7D: { username: chatId.username, profile: 'Single7D', uptime: '7d', label: '7 Hari', price: 25000, actualSpeed : "5 Mbps"  },
        SINGLE_30D:{ username: chatId.username, profile: 'Single30D', uptime: '30d',label: '30 Hari',price: 40000, actualSpeed : "5 Mbps" },
    };

    const pkg = SINGLE_MAP[packageType];

    if (!pkg) {
        delete this.userState[chatId];
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
        delete this.userState[chatId];
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

    async handleCekVoucher(chatId, kode) {
    const cleanKode = (kode || '').trim();
    console.log(`🎫 Handler cek voucher: "${cleanKode}"`);

    const { cekPaket } = require('../services/mikrotik');

    try {
        const result = await cekPaket({ voucher: cleanKode });
        
        this.sendMessage(
            chatId,
            result.found
                ? `✅ Voucher valid!\n\n${
                    result.text
                        ? `Sisa waktu voucher kamu:\n⏳ ${result.text}\nTanggal kadaluarsa pada : \n${result.expireAt}\n`
                        : result.message
                }\n\n🎫 Kode: ${result.data}`
                : `❌ Voucher tidak ditemukan`,
                {
                    parse_mode : 'Markdown',
                    reply_markup:{
                    inline_keyboard:[[
                        { text: '⬅️ Kembali', callback_data: 'BACK_MAIN' }
                    ]]
                    }
                }
        );



    } catch (err) {
        console.error('🔥 Error handleCekVoucher:', err);

        this.sendMessage(
            chatId,
            '⚠️ Terjadi kesalahan saat cek voucher, coba lagi ya.'
        );
    }
}

monitorExpiredVouchers() {
    console.log('🕒 Voucher monitor aktif (1 menit sekali)');

    setInterval(async () => {
        try {
            const { monitorExpire } = require('../services/mikrotik');
            await monitorExpire();
        } catch (err) {
            console.error('MONITOR ERROR:', err.message);
        }
    }, 600_000);
}



}


module.exports = PermataBot;