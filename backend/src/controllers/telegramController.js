// FILE: controllers/telegramController.js

const { query } = require('../config/db');
const { extractTextFromImage } = require('../services/ocrService');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { emitToManagers, emitToHost } = require('../socket/socketServer');
const SOCKET_EVENTS = require('../socket/socketEvents');

// ============================================
// STATE MANAGEMENT
// ============================================
const userStates = new Map();

const setState = (userId, state, data = {}) => {
    userStates.set(userId, { 
        state, 
        data, 
        timestamp: Date.now() 
    });
    console.log(`📝 State set for user ${userId}: ${state}`);
};

const getState = (userId) => {
    const userState = userStates.get(userId);
    if (userState && Date.now() - userState.timestamp > 600000) { // 10 menit expire
        console.log(`⏰ State expired for user ${userId}`);
        userStates.delete(userId);
        return null;
    }
    return userState;
};

const clearState = (userId) => {
    userStates.delete(userId);
    console.log(`🗑️ State cleared for user ${userId}`);
};

// ============================================
// CHECK USER STATUS HELPER
// ============================================
const checkUserStatus = async (telegramUserId) => {
    const userResult = await query(
        'SELECT id, full_name, is_approved, is_active FROM users WHERE telegram_user_id = $1',
        [telegramUserId]
    );

    if (userResult.rows.length === 0) {
        return { exists: false };
    }

    const user = userResult.rows[0];
    
    return {
        exists: true,
        id: user.id,
        full_name: user.full_name,
        is_approved: user.is_approved,
        is_active: user.is_active
    };
};

// ============================================
// ✅ HANDLE START COMMAND (UPDATED)
// ============================================
const handleStartCommand = async (chatId, telegramUserId, username) => {
    clearState(telegramUserId);
    
    const userResult = await query(
        'SELECT id, full_name, email, role, password_hash, is_approved, is_active FROM users WHERE telegram_user_id = $1',
        [telegramUserId]
    );

    if (userResult.rows.length === 0) {
        // ✅ NEW USER - Create with PENDING status
        await query(
            `INSERT INTO users (telegram_user_id, username, full_name, role, is_approved, is_active)
             VALUES ($1, $2, 'PENDING', 'HOST', false, false)`,
            [telegramUserId, username || `user_${telegramUserId}`]
        );
        
        setState(telegramUserId, 'WAITING_FULL_NAME');
        
        await sendTelegramMessage(
            chatId,
            `👋 *Selamat datang di Live Session Reporting Bot!*\n\n` +
            `Untuk melanjutkan registrasi, ikuti langkah berikut:\n\n` +
            `1️⃣ Masukkan *Nama Lengkap* Anda\n` +
            `2️⃣ Masukkan *Email* Anda\n` +
            `3️⃣ Buat *Password* untuk login dashboard\n\n` +
            `Mari kita mulai! Silakan masukkan *nama lengkap* Anda:\n` +
            `Contoh: Budi Santoso`,
            { parse_mode: 'Markdown' }
        );
        console.log('✅ New user started registration:', telegramUserId);
        
    } else {
        const user = userResult.rows[0];
        
        // Check registration progress
        if (user.full_name === 'PENDING') {
            setState(telegramUserId, 'WAITING_FULL_NAME');
            await sendTelegramMessage(
                chatId,
                `Silakan masukkan *nama lengkap* Anda untuk melanjutkan registrasi.`,
                { parse_mode: 'Markdown' }
            );
            
        } else if (!user.email) {
            // ✅ User ada nama, tapi belum email
            setState(telegramUserId, 'WAITING_EMAIL', { full_name: user.full_name });
            await sendTelegramMessage(
                chatId,
                `📧 *Langkah 2: Email*\n\n` +
                `Halo *${user.full_name}*!\n\n` +
                `Silakan masukkan alamat email Anda:\n` +
                `Contoh: budi.santoso@example.com\n\n` +
                `Email ini akan digunakan untuk login ke dashboard.`,
                { parse_mode: 'Markdown' }
            );
            
        } else if (!user.password_hash) {
            // ✅ User ada email, tapi belum password
            setState(telegramUserId, 'WAITING_PASSWORD', { 
                full_name: user.full_name,
                email: user.email 
            });
            await sendTelegramMessage(
                chatId,
                `🔐 *Langkah 3: Password*\n\n` +
                `Halo *${user.full_name}*!\n\n` +
                `Email: ${user.email}\n\n` +
                `Sekarang buat password untuk login ke dashboard:\n\n` +
                `⚠️ Password minimal 6 karakter\n` +
                `💡 Gunakan kombinasi huruf dan angka`,
                { parse_mode: 'Markdown' }
            );
            
        } else if (!user.is_approved) {
            await sendTelegramMessage(
                chatId,
                `⏳ *Akun Anda Belum Disetujui*\n\n` +
                `Halo *${user.full_name}*!\n\n` +
                `📋 *Informasi Login Anda:*\n` +
                `• Email: ${user.email}\n` +
                `• Password: ✅ Sudah diset\n\n` +
                `Pendaftaran Anda sedang menunggu persetujuan dari Manager.\n` +
                `Anda akan mendapat notifikasi setelah akun Anda diaktifkan.`,
                { parse_mode: 'Markdown' }
            );
            
        } else if (!user.is_active) {
            await sendTelegramMessage(
                chatId,
                `❌ *Akun Anda Telah Dinonaktifkan*\n\n` +
                `Halo *${user.full_name}*!\n\n` +
                `Akun Anda saat ini dalam status tidak aktif.\n` +
                `Silakan hubungi Manager untuk informasi lebih lanjut.`,
                { parse_mode: 'Markdown' }
            );
            
        } else {
            // User Active
            await sendTelegramMessage(
                chatId,
                `✅ *Selamat datang kembali, ${user.full_name}!*\n\n` +
                `📋 *Informasi Login Anda:*\n` +
                `• Email: ${user.email}\n` +
                `• Password: ✅ Sudah diset\n\n` +
                `📸 *Cara Menggunakan Bot:*\n` +
                `Kirimkan screenshot hasil LIVE Anda, dan bot akan otomatis memproses GMV dan durasi.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};

// ============================================
// ✅ HANDLE FULL NAME INPUT
// ============================================
const handleFullNameInput = async (chatId, telegramUserId, username, fullName) => {
    if (fullName.length < 3) {
        await sendTelegramMessage(
            chatId,
            '❌ Nama terlalu pendek. Minimal 3 karakter.\n\nSilakan masukkan nama lengkap yang valid:'
        );
        return;
    }
    
    await query(
        `UPDATE users 
         SET full_name = $1, username = $2, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_user_id = $3`,
        [fullName, username || `user_${telegramUserId}`, telegramUserId]
    );
    
    // ✅ LANJUT KE EMAIL INPUT
    setState(telegramUserId, 'WAITING_EMAIL', { full_name: fullName });
    
    await sendTelegramMessage(
        chatId,
        `✅ Nama berhasil disimpan!\n\n` +
        `📧 *Langkah 2: Email*\n\n` +
        `Silakan masukkan alamat email Anda:\n` +
        `Contoh: budi.santoso@example.com\n\n` +
        `Email ini akan digunakan untuk login ke dashboard.`,
        { parse_mode: 'Markdown' }
    );
    
    console.log('✅ Full name saved for:', fullName);
};

// ============================================
// ✅ NEW: HANDLE EMAIL INPUT
// ============================================
const handleEmailInput = async (chatId, telegramUserId, email) => {
    const currentState = getState(telegramUserId);
    
    if (!currentState || currentState.state !== 'WAITING_EMAIL') {
        return false;
    }
    
    // Validasi email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        await sendTelegramMessage(
            chatId,
            '❌ *Format email tidak valid!*\n\n' +
            'Silakan masukkan email yang benar.\n' +
            'Contoh: budi.santoso@example.com',
            { parse_mode: 'Markdown' }
        );
        return true;
    }
    
    // Check if email already exists
    const existingEmail = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND telegram_user_id != $2',
        [email, telegramUserId]
    );
    
    if (existingEmail.rows.length > 0) {
        await sendTelegramMessage(
            chatId,
            '❌ *Email sudah terdaftar!*\n\n' +
            'Email ini sudah digunakan oleh user lain.\n' +
            'Silakan gunakan email yang berbeda.',
            { parse_mode: 'Markdown' }
        );
        return true;
    }
    
    // Save email to database
    await query(
        `UPDATE users 
         SET email = $1, updated_at = CURRENT_TIMESTAMP
         WHERE telegram_user_id = $2`,
        [email.toLowerCase(), telegramUserId]
    );
    
    // ✅ LANJUT KE PASSWORD SETUP
    setState(telegramUserId, 'WAITING_PASSWORD', { 
        full_name: currentState.data.full_name,
        email: email 
    });
    
    await sendTelegramMessage(
        chatId,
        `✅ Email berhasil disimpan!\n\n` +
        `🔐 *Langkah 3: Password*\n\n` +
        `Sekarang buat password untuk login ke dashboard:\n\n` +
        `⚠️ Password minimal 6 karakter\n` +
        `💡 Gunakan kombinasi huruf dan angka untuk keamanan\n\n` +
        `Ketik password Anda sekarang:`,
        { parse_mode: 'Markdown' }
    );
    
    console.log('✅ Email saved for:', email);
    return true;
};

// ============================================
// ✅ HANDLE PASSWORD INPUT
// ============================================
const handlePasswordInput = async (chatId, telegramUserId, password) => {
    const currentState = getState(telegramUserId);
    
    if (!currentState || currentState.state !== 'WAITING_PASSWORD') {
        return false;
    }
    
    if (password.length < 6) {
        await sendTelegramMessage(
            chatId,
            '❌ *Password terlalu pendek!*\n\n' +
            'Password minimal 6 karakter.\n\n' +
            'Silakan masukkan password yang lebih kuat:',
            { parse_mode: 'Markdown' }
        );
        return true;
    }
    
    if (password.length > 50) {
        await sendTelegramMessage(
            chatId,
            '❌ Password terlalu panjang (maksimal 50 karakter).\n\n' +
            'Silakan masukkan password yang lebih pendek:',
            { parse_mode: 'Markdown' }
        );
        return true;
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await query(
        `UPDATE users 
         SET password_hash = $1, 
             is_approved = false,
             is_active = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_user_id = $2`,
        [passwordHash, telegramUserId]
    );
    
    clearState(telegramUserId);
    
    const { full_name, email } = currentState.data;
    
    await sendTelegramMessage(
        chatId,
        `🎉 *Registrasi Selesai!*\n\n` +
        `Terima kasih, *${full_name}*!\n\n` +
        `📋 *Informasi Login Dashboard:*\n` +
        `• Email: ${email}\n` +
        `• Password: ✅ Sudah diset\n\n` +
        `⏳ *Status:* Menunggu persetujuan Manager\n\n` +
        `💡 *Cara Login ke Dashboard:*\n` +
        `1. Buka website dashboard\n` +
        `2. Masukkan Email: ${email}\n` +
        `3. Masukkan Password yang Anda buat\n` +
        `4. Klik Login\n\n` +
        `Anda akan mendapat notifikasi setelah akun diaktifkan oleh Manager.\n\n` +
        `_Simpan Email dan Password Anda dengan aman!_ 🔐`,
        { parse_mode: 'Markdown' }
    );
    
    console.log('✅ Registration completed:', { full_name, email, telegram_user_id: telegramUserId });
    return true;
};

// ============================================
// PHOTO PROCESSING WITH STATUS CHECK
// ============================================

const processPhotoReport = async (message, chatId, telegramUserId, username) => {
    console.log('\n📸 ========== PHOTO PROCESSING START ==========');
    
    const previousState = getState(telegramUserId);
    if (previousState && previousState.state === 'WAITING_CONFIRMATION') {
        console.log('🔄 Overriding previous confirmation with new photo');
        clearState(telegramUserId);
    }
    
    const userStatus = await checkUserStatus(telegramUserId);

    if (!userStatus.exists || userStatus.full_name === 'PENDING') {
        await sendTelegramMessage(
            chatId,
            '❌ Akses Ditolak. Mohon ketik /start terlebih dahulu.'
        );
        return;
    }

    if (!userStatus.is_approved) {
        await sendTelegramMessage(
            chatId,
            '⏳ *Akun Anda Belum Disetujui*\n\n' +
            'Pendaftaran Anda sedang menunggu persetujuan dari Manager.\n' +
            'Anda akan mendapat notifikasi setelah akun Anda diaktifkan.\n\n' +
            '👤 Nama: ' + userStatus.full_name,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (!userStatus.is_active) {
        await sendTelegramMessage(
            chatId,
            '❌ *Akun Anda Telah Dinonaktifkan*\n\n' +
            'Akun Anda saat ini dalam status tidak aktif.\n' +
            'Anda tidak dapat mengirim laporan.\n\n' +
            '👤 Nama: ' + userStatus.full_name + '\n\n' +
            'Silakan hubungi Manager untuk informasi lebih lanjut.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const userId = userStatus.id;
    const photo = message.photo[message.photo.length - 1];
    const fileId = photo.file_id;

    console.log('👤 User:', username);
    console.log('📎 File ID:', fileId);

    await sendTelegramMessage(chatId, '⏳ Memproses screenshot...');

    const downloadResult = await downloadTelegramPhoto(fileId);

    if (!downloadResult || !downloadResult.savePath) {
        await sendTelegramMessage(
            chatId,
            '❌ Gagal mengunduh foto. Coba lagi!'
        );
        return;
    }

    const { savePath, filePath: telegramFilePath } = downloadResult;

    console.log('🔍 Starting OCR process...');
    const ocrResult = await extractTextFromImage(savePath);

    if (fs.existsSync(savePath)) {
        fs.unlinkSync(savePath);
        console.log('🗑️ Temp file deleted');
    }

    if (!ocrResult.success) {
        console.error('❌ OCR failed:', ocrResult.error);
        await sendTelegramMessage(
            chatId,
            '❌ Gagal membaca teks dari screenshot.\n\n' +
            `Error: ${ocrResult.error}\n\n` +
            'Pastikan screenshot jelas dan coba ambil ulang.',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    console.log('✅ OCR Success!');
    console.log('💰 Parsed GMV:', ocrResult.parsedGMV);
    console.log('⏱️ Parsed Duration:', ocrResult.parsedDuration);

    const formattedGMV = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(ocrResult.parsedGMV);

    const screenshotUrl = telegramFilePath
        ? `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFilePath}`
        : `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileId}`;
    
    // ✅ NEW CODE: Handle multiple platforms
    setState(telegramUserId, 'WAITING_CONFIRMATION', {
        userId: userId,
        screenshotUrl: screenshotUrl,
        ocrRawText: ocrResult.rawText,
        platforms: ocrResult.platforms,              // ✅ NEW: Array of platforms
        isDualPlatform: ocrResult.isDualPlatform     // ✅ NEW: Flag
    });

    // ✅ NEW: Build confirmation message
    let confirmationMessage = '✅ *Screenshot Berhasil Diproses!*\n\n';

    if (ocrResult.isDualPlatform) {
        // ✅ DUAL PLATFORM MESSAGE
        confirmationMessage += `🎯 *Terdeteksi ${ocrResult.platforms.length} Platform:*\n\n`;
        
        ocrResult.platforms.forEach((platformData, index) => {
            const emoji = platformData.platform === 'TIKTOK' ? '⚫' : '🟠';
            const name = platformData.platform === 'TIKTOK' ? 'TikTok' : 'Shopee';
            const gmv = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(platformData.parsedGMV);
            
            confirmationMessage += `${index + 1}️⃣ ${emoji} *${name} Live*\n`;
            confirmationMessage += `   📊 GMV: ${gmv}\n`;
            confirmationMessage += `   ⏱️ Durasi: ${platformData.parsedDuration || 'Tidak terdeteksi'}\n\n`;
        });
        
        confirmationMessage += `💡 *Kedua platform akan disimpan!*\n\n`;
        
    } else {
        // ✅ SINGLE PLATFORM MESSAGE
        const platformData = ocrResult.platforms[0];
        const emoji = platformData.platform === 'TIKTOK' ? '⚫' : '🟠';
        const name = platformData.platform === 'TIKTOK' ? 'TikTok' : 'Shopee';
        const gmv = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(platformData.parsedGMV);
        
        confirmationMessage += `${emoji} Platform: *${name} Live*\n`;
        confirmationMessage += `📊 GMV Terdeteksi: ${gmv}\n`;
        confirmationMessage += `⏱️ Durasi LIVE: ${platformData.parsedDuration || 'Tidak terdeteksi'}\n\n`;
    }

    confirmationMessage += `━━━━━━━━━━━━━━━━━━━\n`;
    confirmationMessage += `Apakah data ini sudah benar?\n\n`;
    confirmationMessage += `• Ketik *Y* atau *Ya* untuk Simpan ✅\n`;
    confirmationMessage += `• Ketik *N* atau *Tidak* untuk Batal ❌\n`;
    confirmationMessage += `• Kirim foto baru untuk scan ulang 📸`;

    await sendTelegramMessage(chatId, confirmationMessage, { parse_mode: 'Markdown' });

    console.log('✅ Waiting for user confirmation');
    console.log('========== PHOTO PROCESSING END ==========\n');
};

const handleConfirmation = async (chatId, telegramUserId, textInput) => {
    const currentState = getState(telegramUserId);

    if (!currentState || currentState.state !== 'WAITING_CONFIRMATION') {
        return false;
    }

    const response = textInput.trim().toUpperCase();

    if (response === 'Y' || response === 'YA' || response === 'YES') {
        console.log('✅ User confirmed: YES');
        // ✅ NEW: Extract multi-platform data from state
        const { userId, screenshotUrl, ocrRawText, platforms, isDualPlatform } = currentState.data;

        try {
            // ✅ NEW CODE: Multiple inserts for detected platforms
            let successMessage = '✅ *Laporan Berhasil Disimpan!*\n\n';
            const savedReports = [];

            for (const platformData of platforms) {
                const reportQuery = `
                    INSERT INTO reports (
                        host_id,
                        reported_gmv,
                        screenshot_url,
                        ocr_raw_text,
                        status,
                        live_duration,
                        platform,
                        month,
                        year
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        'PENDING',
                        $5,
                        $6,
                        EXTRACT(MONTH FROM CURRENT_DATE)::INT,
                        EXTRACT(YEAR FROM CURRENT_DATE)::INT
                    )
                    RETURNING id, reported_gmv, live_duration, platform, month, year, created_at
                `;

                const reportResult = await query(reportQuery, [
                    userId,
                    platformData.parsedGMV,
                    screenshotUrl,
                    ocrRawText,
                    platformData.parsedDuration || null,
                    platformData.platform
                ]);

                const report = reportResult.rows[0];
                savedReports.push(report);
                console.log(`✅ Report saved: Platform=${report.platform}, ID=${report.id}, GMV=${report.reported_gmv}`);
            }

            // ✅ NEW: Build success message
            if (isDualPlatform) {
                successMessage += `🎉 *${savedReports.length} Platform Berhasil Disimpan!*\n\n`;
                
                savedReports.forEach((report, index) => {
                    const emoji = report.platform === 'TIKTOK' ? '⚫' : '🟠';
                    const name = report.platform === 'TIKTOK' ? 'TikTok' : 'Shopee';
                    const gmv = new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0
                    }).format(report.reported_gmv);
                    
                    successMessage += `${index + 1}️⃣ ${emoji} *${name} Live*\n`;
                    successMessage += `   🆔 Report ID: #${report.id}\n`;
                    successMessage += `   📊 GMV: ${gmv}\n`;
                    successMessage += `   ⏱️ Durasi: ${report.live_duration || 'Tidak terdeteksi'}\n`;
                    successMessage += `   📅 Waktu: ${new Date(report.created_at).toLocaleString('id-ID')}\n\n`;
                });
                
            } else {
                // Single platform
                const report = savedReports[0];
                const emoji = report.platform === 'TIKTOK' ? '⚫' : '🟠';
                const name = report.platform === 'TIKTOK' ? 'TikTok' : 'Shopee';
                const gmv = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0
                }).format(report.reported_gmv);
                
                successMessage += `${emoji} Platform: *${name} Live*\n`;
                successMessage += `📊 GMV: ${gmv}\n`;
                successMessage += `⏱️ Durasi: ${report.live_duration || 'Tidak terdeteksi'}\n`;
                successMessage += `🆔 Report ID: #${report.id}\n`;
                successMessage += `📅 Waktu: ${new Date(report.created_at).toLocaleString('id-ID')}\n\n`;
            }

            // ✅ EMIT WEBSOCKET — notify managers + host of new report(s)
            savedReports.forEach(report => {
                const payload = {
                    reportId: report.id,
                    hostId: userId,
                    gmv: report.reported_gmv,
                    platform: report.platform,
                    status: 'PENDING',
                    createdAt: report.created_at,
                };
                emitToManagers(SOCKET_EVENTS.REPORT_NEW, payload);
                emitToHost(userId, SOCKET_EVENTS.REPORT_NEW, payload);
            });

            successMessage += `⏳ Status: Menunggu verifikasi manager`;

            clearState(telegramUserId);
            await sendTelegramMessage(chatId, successMessage, { parse_mode: 'Markdown' });
            console.log('✅ Report(s) saved successfully:', savedReports.map(r => r.id).join(', '));
        } catch (error) {
            console.error('❌ Save report error:', error);
            await sendTelegramMessage(
                chatId,
                '❌ Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi.'
            );
            clearState(telegramUserId);
        }

        return true;
    }
    else if (response === 'N' || response === 'NO' || response === 'TIDAK' || response === 'CANCEL') {
        console.log('❌ User confirmed: NO');
        clearState(telegramUserId);
        
        await sendTelegramMessage(
            chatId,
            `❌ *Laporan Dibatalkan*\n\n` +
            `Silakan kirim screenshot GMV yang baru.`,
            { parse_mode: 'Markdown' }
        );

        return true;
    }

    await sendTelegramMessage(
        chatId,
        `⚠️ *Konfirmasi Tidak Valid*\n\n` +
        `Silakan ketik:\n` +
        `• *Y* atau *Ya* untuk Simpan ✅\n` +
        `• *N* atau *Tidak* untuk Batal ❌`,
        { parse_mode: 'Markdown' }
    );

    return true;
};

// ============================================
// ✅ HANDLE TEXT INPUT (UPDATED)
// ============================================

const handleTextInput = async (chatId, telegramUserId, username, textInput) => {
    console.log('💬 Text input received:', textInput);
    
    // Check if waiting for confirmation
    const confirmed = await handleConfirmation(chatId, telegramUserId, textInput);
    if (confirmed) {
        return;
    }

    const currentState = getState(telegramUserId);
    
    // ✅ Check if waiting for email
    if (currentState && currentState.state === 'WAITING_EMAIL') {
        await handleEmailInput(chatId, telegramUserId, textInput);
        return;
    }
    
    // ✅ Check if waiting for password
    if (currentState && currentState.state === 'WAITING_PASSWORD') {
        await handlePasswordInput(chatId, telegramUserId, textInput);
        return;
    }
    
    // Check if waiting for full name
    if (currentState && currentState.state === 'WAITING_FULL_NAME') {
        await handleFullNameInput(chatId, telegramUserId, username, textInput);
        return;
    }

    // Default response
    await sendTelegramMessage(
        chatId,
        'Mohon kirimkan *screenshot laporan GMV* atau ketik /start untuk memulai.',
        { parse_mode: 'Markdown' }
    );
};

// ============================================
// MAIN PROCESSING LOGIC
// ============================================

const processTelegramUpdate = async (update) => {
    if (!update.message) {
        return;
    }

    const message = update.message;
    const chatId = message.chat.id;
    const telegramUserId = message.from.id.toString();
    const username = message.from.username || message.from.first_name;

    try {
        if (message.text) {
            const text = message.text.trim();
            
            if (text === '/start') {
                await handleStartCommand(chatId, telegramUserId, username);
                return; 
            }
            
            await handleTextInput(chatId, telegramUserId, username, text);
            return;
        }

        if (message.photo && message.photo.length > 0) {
            await processPhotoReport(message, chatId, telegramUserId, username);
            return;
        }
        
        await sendTelegramMessage(
            chatId,
            'Mohon kirimkan *screenshot laporan GMV* atau ketik /start untuk memulai.',
            { parse_mode: 'Markdown' }
        );

    } catch (error) {
        console.error('❌ Async Webhook Processing error:', error);
        await sendTelegramMessage(
            chatId,
            '❌ Terjadi kesalahan saat memproses laporan Anda. Silakan coba lagi.'
        );
    }
};

const handleWebhook = async (req, res) => {
    res.status(200).json({ ok: true, message: 'Processing started asynchronously' });

    try {
        const update = req.body;
        if (update.message) {
            processTelegramUpdate(update);
        }
    } catch (error) {
        console.error('❌ Webhook (initial handling) error:', error);
    }
};

// ============================================
// NOTIFICATION FUNCTIONS (UPDATED)
// ============================================

// ✅ UPDATED: Now accepts `email` parameter
const sendAccountApprovedNotification = async (telegramUserId, fullName, email) => {
    try {
        const message = `
🎉 *Akun Anda Telah Diaktifkan!*

Halo *${fullName}*! 

✅ Selamat! Akun Anda telah disetujui oleh Manager.

📋 *Informasi Login Dashboard:*
• Email: ${email}
• Password: ✅ Sudah diset (Gunakan password yang Anda buat)
• Status: Aktif ✅

💻 *Cara Login ke Dashboard:*
1. Buka website dashboard
2. Masukkan Email: ${email}
3. Masukkan Password Anda
4. Klik Login

📸 *Cara Menggunakan Bot:*
1. Kirim screenshot hasil LIVE Anda
2. Bot akan otomatis memproses GMV dan durasi
3. Konfirmasi data dengan ketik *Y* atau *Ya*
4. Laporan tersimpan dan menunggu verifikasi manager

Selamat bekerja! 🚀
        `;

        await sendTelegramMessage(telegramUserId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Notification sent to ${fullName} (${email})`);
    } catch (error) {
        console.error('❌ Send approval notification error:', error.message);
    }
};

const sendAccountRejectedNotification = async (telegramUserId, fullName) => {
    try {
        const message = `
❌ *Pendaftaran Ditolak*

Halo *${fullName}*,

Maaf, pendaftaran Anda tidak dapat disetujui saat ini.

Jika Anda merasa ini adalah kesalahan, silakan hubungi Manager untuk informasi lebih lanjut.

Terima kasih.
        `;

        await sendTelegramMessage(telegramUserId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Rejection notification sent to ${fullName} (${telegramUserId})`);
    } catch (error) {
        console.error('❌ Send rejection notification error:', error.message);
    }
};

const sendReportVerifiedNotification = async (telegramUserId, reportData) => {
    try {
        const formattedGMV = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(reportData.gmv);

        const formattedDate = new Date(reportData.createdAt).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const message = `
✅ *Laporan Diverifikasi!*

📊 *Report ID:* #${reportData.reportId}

💰 *GMV:* ${formattedGMV}
⏱️ *Durasi LIVE:* ${reportData.duration || 'Tidak terdeteksi'}
📅 *Tanggal:* ${formattedDate}

${reportData.notes ? `📝 *Catatan Manager:*\n${reportData.notes}\n\n` : ''}
Status: *VERIFIED* ✅

Selamat! Laporan Anda telah disetujui oleh Manager. 🎉

Terus pertahankan performa Anda! 💪
        `;

        await sendTelegramMessage(telegramUserId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Verification notification sent for report #${reportData.reportId}`);
    } catch (error) {
        console.error('❌ Send verification notification error:', error.message);
    }
};

const sendReportRejectedNotification = async (telegramUserId, reportData) => {
    try {
        const formattedGMV = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(reportData.gmv);

        const formattedDate = new Date(reportData.createdAt).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const message = `
❌ *Laporan Ditolak*

📊 *Report ID:* #${reportData.reportId}

💰 *GMV:* ${formattedGMV}
⏱️ *Durasi LIVE:* ${reportData.duration || 'Tidak terdeteksi'}
📅 *Tanggal:* ${formattedDate}

${reportData.notes ? `📝 *Alasan Penolakan:*\n${reportData.notes}\n\n` : ''}
Status: *REJECTED* ❌

Silakan periksa kembali screenshot Anda dan kirim ulang laporan yang benar.

Jika ada pertanyaan, hubungi Manager Anda.
        `;

        await sendTelegramMessage(telegramUserId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Rejection notification sent for report #${reportData.reportId}`);
    } catch (error) {
        console.error('❌ Send rejection notification error:', error.message);
    }
};

const sendAccountDeactivatedNotification = async (telegramUserId, fullName) => {
    try {
        const message = `
❌ *Akun Anda Telah Dinonaktifkan*

Halo *${fullName}*,

Akun Anda telah dinonaktifkan oleh Manager.

Anda tidak dapat lagi mengirim laporan hingga akun Anda diaktifkan kembali.

Jika ada pertanyaan, silakan hubungi Manager Anda.

Terima kasih.
        `;

        await sendTelegramMessage(telegramUserId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Deactivation notification sent to ${fullName} (${telegramUserId})`);
    } catch (error) {
        console.error('❌ Send deactivation notification error:', error.message);
    }
};

// ✅ UPDATED: Now accepts `email` parameter
const sendAccountReactivatedNotification = async (telegramUserId, fullName, email) => {
    try {
        const message = `
✅ *Akun Anda Telah Diaktifkan Kembali!*

Halo *${fullName}*,

Kabar baik! Akun Anda telah diaktifkan kembali oleh Manager.

📋 *Informasi Login Dashboard:*
• Email: ${email}
• Status: Aktif ✅

Anda sekarang dapat mengirim laporan GMV LIVE session Anda lagi.

Selamat bekerja! 🚀
        `;

        await sendTelegramMessage(telegramUserId, message, { parse_mode: 'Markdown' });
        console.log(`✅ Reactivation notification sent to ${fullName} (${email})`);
    } catch (error) {
        console.error('❌ Send reactivation notification error:', error.message);
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const downloadTelegramPhoto = async (fileId) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        const fileResponse = await axios.get(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        );

        if (!fileResponse.data.ok) {
            throw new Error('Failed to get file info from Telegram');
        }

        const filePath = fileResponse.data.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const fileName = `photo_${Date.now()}.jpg`;
        const savePath = path.join(tempDir, fileName);

        fs.writeFileSync(savePath, response.data);

        console.log('✅ Photo saved to:', savePath);
        return { savePath, filePath };

    } catch (error) {
        console.error('❌ Download photo error:', error.message);
        return null;
    }
};

const sendTelegramMessage = async (chatId, text, options = {}) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        await axios.post(url, {
            chat_id: chatId,
            text: text,
            ...options
        });

        console.log('✅ Message sent to chat:', chatId);

    } catch (error) {
        console.error('❌ Send message error:', error.message);
    }
};

const setupWebhook = async (webhookUrl) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const url = `https://api.telegram.org/bot${botToken}/setWebhook`;

        const response = await axios.post(url, {
            url: webhookUrl,
            allowed_updates: ['message']
        });

        if (response.data.ok) {
            console.log('✅ Webhook set successfully:', webhookUrl);
            return { success: true, message: 'Webhook configured' };
        } else {
            throw new Error(response.data.description);
        }

    } catch (error) {
        console.error('❌ Setup webhook error:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    handleWebhook,
    setupWebhook,
    sendTelegramMessage,
    sendAccountApprovedNotification,
    sendAccountRejectedNotification,
    sendReportVerifiedNotification,
    sendReportRejectedNotification,
    sendAccountDeactivatedNotification,
    sendAccountReactivatedNotification
};