const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket/socketServer');
const { setupWebhook } = require('./controllers/telegramController');
const {
    PORT,
    NODE_ENV,
    TELEGRAM_BOT_TOKEN,
    BACKEND_URL,
    AUTO_SET_TELEGRAM_WEBHOOK,
} = require('./config/env');

// Buat HTTP server dari Express app
const server = http.createServer(app);

// Pasang Socket.io ke HTTP server yang sama
initSocket(server);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`🔒 Environment: ${NODE_ENV}`);
    console.log(`\n📋 Available Routes:`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/me`);
    console.log(`   POST   /api/webhook/telegram`);
    console.log(`   GET    /api/users/pending (Manager)`);
    console.log(`   PUT    /api/users/:userId/approve (Manager)`);
    console.log(`   DELETE /api/users/:userId/reject (Manager)`);
    console.log(`   GET    /api/hosts (Manager)`);
    console.log(`   POST   /api/hosts (Manager)`);
    console.log(`   PUT    /api/hosts/:id (Manager)`);
    console.log(`   DELETE /api/hosts/:id (Manager)`);
    console.log(`   PATCH  /api/hosts/:id/toggle-status (Manager)`);
    console.log(`   GET    /api/reports (Manager)`);
    console.log(`   GET    /api/reports/statistics (Manager)`);
    console.log(`   GET    /api/reports/my-reports (Host)`);
    console.log(`   GET    /api/reports/:id`);
    console.log(`   PUT    /api/reports/:id/status (Manager)`);
    console.log(`\n🔌 WebSocket: Socket.io ready on ws://localhost:${PORT}`);

    const normalizedBackendUrl = BACKEND_URL ? BACKEND_URL.replace(/\/+$/, '') : '';
    if (AUTO_SET_TELEGRAM_WEBHOOK && TELEGRAM_BOT_TOKEN && normalizedBackendUrl) {
        const webhookUrl = `${normalizedBackendUrl}/api/webhook/telegram`;
        setupWebhook(webhookUrl)
            .then((result) => {
                if (!result.success) {
                    console.error(`❌ Telegram webhook setup failed: ${result.error}`);
                }
            })
            .catch((error) => {
                console.error(`❌ Telegram webhook setup exception: ${error.message}`);
            });
    } else {
        console.log(
            'ℹ️  Auto webhook setup skipped (set AUTO_SET_TELEGRAM_WEBHOOK=true and BACKEND_URL)'
        );
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, closing server gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});