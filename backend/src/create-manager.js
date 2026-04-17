/**
 * Create Manager Account Script
 * 
 * Usage: node src/create-manager.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function createManager() {
    // ============================================
    // EDIT DATA MANAGER DI SINI
    // ============================================
    const password = 'manager123';
    const fullName = 'Manager Kepswell';
    const username = 'manager_kepswell';
    const telegramUserId = '100000001';
    // ============================================

    console.log('🔧 Creating Manager Account...\n');

    try {
        // Check actual table columns first
        const colResult = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' ORDER BY ordinal_position
        `);
        const columns = colResult.rows.map(r => r.column_name);
        console.log('📋 Kolom tabel users:', columns.join(', '));

        const passwordHash = await bcrypt.hash(password, 10);

        // Delete old dummy manager
        await pool.query("DELETE FROM users WHERE telegram_user_id = '123456789' AND password_hash = '$2a$10$dummyhash'");

        // Check if manager already exists
        const existing = await pool.query(
            "SELECT id FROM users WHERE telegram_user_id = $1", [telegramUserId]
        );

        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE users SET password_hash = $1, full_name = $2, is_active = true WHERE telegram_user_id = $3',
                [passwordHash, fullName, telegramUserId]
            );
            console.log('✅ Manager account updated!\n');
        } else {
            // Build INSERT based on available columns
            if (columns.includes('email')) {
                await pool.query(
                    `INSERT INTO users (telegram_user_id, username, full_name, role, password_hash, email, status, is_approved, is_active)
                     VALUES ($1, $2, $3, 'MANAGER', $4, 'manager@kepswell.com', 'ACTIVE', true, true)`,
                    [telegramUserId, username, fullName, passwordHash]
                );
            } else {
                await pool.query(
                    `INSERT INTO users (telegram_user_id, username, full_name, role, password_hash, is_active)
                     VALUES ($1, $2, $3, 'MANAGER', $4, true)`,
                    [telegramUserId, username, fullName, passwordHash]
                );
            }
            console.log('✅ Manager account created!\n');
        }

        console.log('📋 Login Credentials:');
        console.log(`   Username     : ${username}`);
        console.log(`   Telegram ID  : ${telegramUserId}`);
        console.log(`   Password     : ${password}`);
        console.log(`   Role         : MANAGER`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

createManager();
