const { RouterOSAPI } = require('node-routeros');

async function addUserToMikrotik({
    username,
    password,
    profile,
    uptime,
    service = 'hotspot'
}) {
    const conn = new RouterOSAPI({
        host: String(process.env.MIKROTIK_HOST),
        user: String(process.env.MIKROTIK_USER),
        password: String(process.env.MIKROTIK_PASSWORD || ''),
        port: parseInt(process.env.MIKROTIK_PORT) || 8728,
        timeout: 5000
    });
    console.log(username, password, profile, uptime, service);
    console.log('Connecting to Mikrotik... Use :'+process.env.MIKROTIK_HOST+', user: '+process.env.MIKROTIK_USER+', port: '+process.env.MIKROTIK_PORT);
    // try{
    //     await conn.connect();
    // }catch(err){
    //     console.error('Mikrotik connection error:', err.message);
    //     throw err;
    // }
    // return;
    try {
        await conn.connect();
        // 🔍 cek user existing
        const existing =
            service === 'pppoe'
                ? await conn.write('/ppp/secret/print', [
                      `?name=${username}`
                  ])
                : await conn.write('/ip/hotspot/user/print', [
                      `?name=${username}`
                  ]);

        if (existing.length > 0) {
            throw new Error('USER_ALREADY_EXISTS');
        }

        // ➕ add user
        if (service === 'pppoe') {
            await conn.write('/ppp/secret/add', [
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profile}`,
                `=service=pppoe`,
                `=limit-uptime=${uptime}`
            ]);
        } else {
            await conn.write('/ip/hotspot/user/add', [
                `=name=${username}`,
                `=password=${password}`,
                `=profile=${profile}`,
                `=limit-uptime=${uptime}`,
                `=comment=vc-inactive-${uptime}`
            ]);
        }

        // 🔌 disconnect active session (kalau ada)
        if (service === 'hotspot') {
            const active = await conn.write('/ip/hotspot/active/print', [
                `?user=${username}`
            ]);
            if (active.length > 0) {
                await conn.write('/ip/hotspot/active/remove', [
                    `=.id=${active[0]['.id']}`
                ]);
            }
        }
        // return true;
    } catch (err) {
        await conn.close();
        console.error('MIKROTIK ERROR:', err.message);
        throw err;
    }finally{
        console.log('tutup koneksi')
        await conn.close();
    }

};

async function setupMikrotikInternetDHCP({
    ethernetInterface = 'ether1',
    type = 'dhcp', // dhcp / static
    name = 'ISP Connection',
}){
    //code setup mikrotik internet
    const conn = new RouterOSAPI({
        host: String(process.env.MIKROTIK_HOST),
        user: String(process.env.MIKROTIK_USER),
        password: String(process.env.MIKROTIK_PASSWORD || ''),
        port: parseInt(process.env.MIKROTIK_PORT) || 8728,
        timeout: 5000
    });

    console.log('Connecting to Mikrotik for Internet Setup...' + ':'+process.env.MIKROTIK_HOST+', user: '+process.env.MIKROTIK_USER+', port: '+process.env.MIKROTIK_PORT);

    try {
        await conn.connect();
        console.log('✅ Mikrotik connected');
        switch(type){
            case 'dhcp':
            await conn.write('/ip/dhcp-client/add', [
            `=interface=${ethernetInterface}`,
            `=disabled=no`,
            `=comment=${name}`
            ]);
        const eth = await conn.write('/interface/ethernet/print', ['?name=ether1']);

        await conn.write('/interface/ethernet/set', [
            `=.id=${eth[0]['.id']}`,
            '=name=1. ISP Connection'
        ]);
        console.log(`✅ DHCP Client added on ${ethernetInterface}`);
                ;
        }
    } catch (err) {
        console.error('❌ Mikrotik connection error:', err.message);
    }finally{
        await conn.close();
    }
}

async function infrastrukturHotspot({
    name = 'PermataWifi',
    defaultip = '172.16.0.1',
    mask = '21'
}){
    //code setup mikrotik internet
    const conn = new RouterOSAPI({
        host: String(process.env.MIKROTIK_HOST),
        user: String(process.env.MIKROTIK_USER),
        password: String(process.env.MIKROTIK_PASSWORD || ''),
        port: parseInt(process.env.MIKROTIK_PORT) || 8728,
        timeout: 5000
    });
    // console.log('Connecting to Mikrotik for Hotspot Infrastructure Setup...' + ':'+process.env.MIKROTIK_HOST+', user: '+process.env.MIKROTIK_USER+ 'pw : ' + process.env.MIKROTIK_PASSWORD +', port: '+process.env.MIKROTIK_PORT);
    try{
        const bridgeName = `${name}Bridge`;
        const hotspotServerName = `${name}-Server`;
        const hotspotProfileName = `${name}-Profile`;
        const poolPublicName = `${name}-PoolPublic`;
        const dhcp_hostspot_name = `${name}-Hotspot-DHCP`;
        await conn.connect();

        // await conn.write('/interface/bridge/add', [
        //     `=name=${bridgeName}`
        // ]);

        // await conn.write('/interface/bridge/port/add', [
        //     `=bridge=${bridgeName}`,
        //     `=interface=ether3`
        // ]);
        // await conn.write('/interface/bridge/port/add', [
        //     `=bridge=${bridgeName}`,
        //     `=interface=ether4`
        // ]);
        // await conn.write('/interface/bridge/port/add', [
        //     `=bridge=${bridgeName}`,
        //     `=interface=ether5`
        // ]);
        const ipexist = await conn.write('/ip/address/print', [
            `?address=${defaultip}/${mask}`
        ]);

        if (ipexist.length === 0) {
            await conn.write('/ip/address/add', [
                `=address=${defaultip}/${mask}`,
                `=interface=${bridgeName}`
            ]);
        }

        const hotspotExist = await conn.write('/ip/hotspot/profile/print', [
            `?name=${hotspotProfileName}`
        ]);
        if (hotspotExist.length === 0) {
            await conn.write('/ip/hotspot/profile/add', [
            `=name=${hotspotProfileName}`,
            `=dns-name=permata.wifi`,
            `=hotspot-address=${defaultip}`,
            `=html-directory=flash/hotspot/PM`,
            `=login-by=http-chap,http-pap`,
            ]);
        }
            const poolExist = await conn.write('/ip/pool/print', [
                `?name=${poolPublicName}`
            ]);
            if (poolExist.length === 0) {
                await conn.write('/ip/pool/add', [
                    `=name=${poolPublicName}`,
                    `=ranges=172.16.6.1-172.16.7.254`
                ]);
            }
        const dhcpExist = await conn.write('/ip/dhcp-server/print', [
            `?name=${dhcp_hostspot_name}`
        ]);
        if (dhcpExist.length === 0) {
            const changeNetwork = defaultip.split('.');
            changeNetwork[3] = '0';
            const networkAddress = changeNetwork.join('.');
            await conn.write('/ip/dhcp-server/add', [
                `=name=${dhcp_hostspot_name}`,
                `=interface=${bridgeName}`,
                `=address-pool=${poolPublicName}`,
                `=disabled=no`
            ]);
            await conn.write('/ip/dhcp-server/network/add', [
                `=address=${networkAddress}/${mask}`,
                `=gateway=${defaultip}`,
                `=dns-server=8.8.8.8,8.8.4.4`
            ]);
        }

        const hotspotServerExist = await conn.write('/ip/hotspot/print', [
            `?name=${hotspotServerName}`
        ]);
            if (hotspotServerExist.length === 0) {
                await conn.write('/ip/hotspot/add', [
                `=name=${hotspotServerName}`,
                `=interface=${bridgeName}`,
                `=profile=${hotspotProfileName}`,
                `=address-pool=${poolPublicName}`,
                '=disabled=no'
            ])
        }
        const poolConfig = require('../data/pool.json');
        const existingPools = await conn.write('/ip/pool/print');
        const existingNames = new Set(existingPools.map(p => p.name));

        for (const [tier, data] of Object.entries(poolConfig)) {
            console.log(`🚀 Setup ${tier.toUpperCase()} (${data.subnet})`);
              // ⛔ skip yang ga punya pools (GLOBAL)
            if (!Array.isArray(data.pools)) {
                console.log(`⏭ SKIP ${tier} (no pools)`);
                continue;
            }

            for (const pool of data.pools) {
                const poolName = pool.name;

                if (existingNames.has(poolName)) {
                    console.log(`⏭ SKIP ${poolName} (sudah ada)`);
                    continue;
                }

                await conn.write('/ip/pool/add', [
                    `=name=${poolName}`,
                    `=ranges=${pool.ranges}`
                ]);

                console.log(`✅ Pool ${poolName} dibuat`);
            }
        }

        ////========================= Queue =========================////
        const existGloblalQueue = await conn.write('/queue/simple/print', [
        `?name=${name}-Global`
        ]);
        const globalName = `${name}-Global`;

        if (existGloblalQueue.length === 0) {
            try {

                // 1️⃣ Global parent
                await conn.write('/queue/simple/add', [
                    `=name=${globalName}`,
                    `=target=${poolConfig[`${globalName}`].subnet}`,
                    `=max-limit=${poolConfig[`${globalName}`].speed}`,
                    `=queue=${poolConfig[`${globalName}`].type}`,
                    `=total-queue=${poolConfig[`${globalName}`].total}`,
                    `=comment=Global-Limit`
                ]);

                console.log('✅ Global Queue created');
            } catch (err) {
                console.error('❌ Queue Creation Error:', err.message);
            }
        }

        // 2️⃣ Child queues
        const tiers = [
            { key: 'Gold',   order: 1 },
            { key: 'Silver', order: 2 },
            { key: 'Bronze', order: 3 },
            { key: 'Single', order: 4 }
        ];
        // for (const { key, order } of tiers) {
        //     const queueName = `${order}. ${name}-${key}`;
        //     const cfg = poolConfig[`${name}-${key}`];
        //     const existQueue = await conn.write('/queue/simple/print', [
        //         `?name=${queueName}`
        //     ]);
        //     if (existQueue.length > 0) {
        //         console.log(`⏭️ ${queueName} already exists, skip`);
        //         continue;
        //     }
        //     await conn.write('/queue/simple/add', [
        //         `=name=${queueName}`,
        //         `=target=${cfg.subnet}`,
        //         `=max-limit=${cfg.speed}`,
        //         `=queue=${cfg.type}`,
        //         `=total-queue=${cfg.total}`,
        //         `=comment=${name}-${key}`,
        //         `=parent=${globalName}`
        //     ]);
        // }
    for (const { key, order } of tiers) {
    const tierKey = `${name}-${key}`;
    const cfg = poolConfig[tierKey];
    if (!cfg) continue;

    const parentQueueName = `${order}. ${tierKey}`;

    // =========================
    // CHILD KE-2 (TIER)
    // =========================
    const existParent = await conn.write('/queue/simple/print', [
        `?name=${parentQueueName}`
    ]);

    if (existParent.length === 0) {
        await conn.write('/queue/simple/add', [
            `=name=${parentQueueName}`,
            `=target=${cfg.subnet}`,
            `=max-limit=${cfg.speed}`,
            `=queue=${cfg.type}`,
            `=total-queue=${cfg.total}`,
            `=comment=${tierKey}`,
            `=parent=${globalName}`
        ]);

        console.log(`✅ Created ${parentQueueName}`);
    } else {
        console.log(`⏭️ ${parentQueueName} exists`);
    }

    // =========================
    // CHILD KE-3 (POOLS)
    // =========================
    if (!cfg.pools || !Array.isArray(cfg.pools)) continue;

    for (let i = 0; i < cfg.pools.length; i++) {
        if(parentQueueName.toLocaleLowerCase().includes('single')) continue;
        const pool = cfg.pools[i];
        const poolQueueName = `${order}.${i + 1} ${tierKey}-${pool.name}`;
        console.log(`Pool Queue name : ${poolQueueName}`)
        const existPool = await conn.write('/queue/simple/print', [
            `?name=${pool.name}`
        ]);

        if (existPool.length > 0) {
            console.log(`⏭️ ${poolQueueName} already exists`);
            continue;
        }

        await conn.write('/queue/simple/add', [
            `=name=${pool.name}`,
            `=target=${pool.network}`,
            `=max-limit=${pool.speed}`,
            `=limit-at=${pool.limit}`,
            `=queue=${pool.type}`,
            `=total-queue=${pool.total}`,
            //`=comment=${tierKey}-${pool.name}`,
            `=parent=${parentQueueName}`
        ]);

        console.log(`🔥 Created ${poolQueueName}`);
    }
}
     
    console.log('✅ Infrastruktur Hotspot setup completed');
    }catch(err){
        console.error('❌ Mikrotik connection error:', err.message);

    }finally{
        await conn.close();
    }

    

}

async function cekPaket({ voucher = '' }) {
    const cleanVoucher = voucher.trim();

    const conn = new RouterOSAPI({
        host: process.env.MIKROTIK_HOST,
        user: process.env.MIKROTIK_USER,
        password: process.env.MIKROTIK_PASSWORD || '',
        port: Number(process.env.MIKROTIK_PORT) || 8728,
        timeout: 5000
    });

    console.log(`🔍 Cek paket voucher: "${cleanVoucher}"`);

    try {
        await conn.connect();

        const result = await conn.write('/ip/hotspot/user/print', [
            `?name=${cleanVoucher}`
        ]);

        if (result.length === 0) {
            return {
                found: false,
                data: cleanVoucher,
                message: '❌ Voucher tidak ditemukan'
            };
        }

        const user = result[0];

        const cleanDateStr = (user.comment || '').replace(/\sX$/, '');
        if(cleanDateStr.includes('inactive')){
            console.log('inactive')
            return {
                found : true,
                data: cleanVoucher,
                message:'Kode voucher belum pernah dipakai, silahkan login ke jaringan terlebih dahulu'
            }
        }
        const expireDate = new Date(cleanDateStr);
        const expireAtIndo = new Intl.DateTimeFormat('id-ID', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Jakarta'
        }).format(expireDate);

        if (isNaN(expireDate)) {
            return {
                found: false,
                data: cleanVoucher,
                message: '⚠️ Format tanggal voucher tidak valid'
            };
        }

        const diffMs = expireDate - new Date();
        const remaining = msToRemainingTime(diffMs);

        if (!remaining.valid) {
            return {
                found: false,
                data: cleanVoucher,
                message: '⛔ Voucher sudah expired'
            };
        }

        return {
            found: true,
            data: cleanVoucher,
            profile: user.profile || '-',
            uptime: user.uptime || '0s',
            expireAt: expireAtIndo,
            text: remaining.text
        };

    } catch (err) {
        console.error('🔥 Error cekPaket:', err);

        return {
            found: false,
            data: cleanVoucher,
            message: '⚠️ Terjadi kesalahan saat cek voucher'
        };

    } finally {
        await conn.close();
        console.log('🔌 Koneksi Mikrotik ditutup');
    }
}
function msToRemainingTime(ms) {
    if (ms <= 0) {
        return {
            valid: false,
            text: '⛔ Waktu sudah habis'
        };
    }

    const totalSeconds = Math.floor(ms / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days} Hari`);
    if (hours > 0) parts.push(`${hours} Jam`);
    if (minutes > 0) parts.push(`${minutes} Menit`);

    return {
        valid: true,
        days,
        hours,
        minutes,
        text: parts.length ? parts.join(', ') : 'kurang dari 1 menit'
    };
}

async function monitorExpire() {
    const conn = new RouterOSAPI({
        host: String(process.env.MIKROTIK_HOST),
        user: String(process.env.MIKROTIK_USER),
        password: String(process.env.MIKROTIK_PASSWORD || ''),
        port: parseInt(process.env.MIKROTIK_PORT) || 8728,
        timeout: 5000
    });

    try {
        await conn.connect();
        console.log('TESTED FROM Monitor')
        const users = await conn.write('/ip/hotspot/user/print');
        const now = Date.now();

        for (const user of users) {
            const comment = user.comment.replace(/\sX$/, '').trim();

            // 🎯 hanya voucher
            // if (!comment.startsWith('vc-')) continue;
            if (comment.includes('inactive')) continue;

            // contoh:
            // vc-79SF feb/17/2026 20:12:51
            const parts = comment.split(' ');
            const dateStr = parts.slice(-2).join(' ');
            const expireAt = mikrotikDateToTimestamp(dateStr);
            if (!expireAt) continue;
            console.log(`comment : ${comment} || fix : ${expireAt}s`)

            if (now >= expireAt) {
                console.log(`⛔ EXPIRED: ${user.name} ${user['.id']}` );

                const activeList = await conn.write('/ip/hotspot/active/print');

                for (const active of activeList) {
                    if (user.name === active.user) {
                        console.log(`🔥 ACTIVE MATCH: ${active.user} id : ${active['.id']}`);
                            await conn.write('/ip/hotspot/active/remove', [
                                `=numbers=${active['.id']}`
                            ]);
                    }
                }

                await conn.write('/ip/hotspot/user/remove', [
                    `=numbers=${user['.id']}`
                ]);

            }
        }

    } catch (err) {
        console.error('MIKROTIK MONITOR ERROR:', err.message);
    } finally {
        conn.close();
    }
}



function mikrotikDateToTimestamp(mikrotikDate) {
    // feb/17/2026 20:12:51
    const [datePart, timePart] = mikrotikDate.split(' ');
    if (!datePart || !timePart) return null;

    const [mon, day, year] = datePart.split('/');

    const monthMap = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    if (!(mon in monthMap)) return null;

    return new Date(
        Number(year),
        monthMap[mon.toLowerCase()],
        Number(day),
        ...timePart.split(':').map(Number)
    ).getTime();
}




module.exports = { addUserToMikrotik, setupMikrotikInternetDHCP, infrastrukturHotspot, cekPaket, monitorExpire };
