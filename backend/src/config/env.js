const dotenv = require('dotenv');

// Load environment variables once
dotenv.config();

// Tambahkan variabel vital lainnya ke sini agar dicek saat start
const requiredEnv = ['JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'OCRSPACE_API_KEY'];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
    console.warn(`⚠️  Missing required env vars: ${missing.join(', ')}`);
    // Opsional: Uncomment baris di bawah jika ingin aplikasi stop kalau key tidak ada
    // process.exit(1); 
}

module.exports = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    OCRSPACE_API_KEY: process.env.OCRSPACE_API_KEY,
};