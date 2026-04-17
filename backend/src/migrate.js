/**
 * Database Migration Script for Neon
 * 
 * Usage:
 *   DATABASE_URL="postgresql://...@...neon.tech/live_session_db?sslmode=require" node src/migrate.js
 * 
 * Or if DATABASE_URL is already set in .env:
 *   node src/migrate.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    console.error('   Set it in .env or pass via environment:');
    console.error('   DATABASE_URL="postgresql://..." node src/migrate.js');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function migrate() {
    console.log('🔄 Starting database migration...');
    console.log(`📍 Target: ${DATABASE_URL.replace(/\/\/.*:.*@/, '//<credentials>@')}`);

    try {
        // Test connection
        const client = await pool.connect();
        console.log('✅ Connected to database');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'config', 'database.sql');
        
        if (!fs.existsSync(sqlPath)) {
            console.error(`❌ SQL file not found: ${sqlPath}`);
            client.release();
            process.exit(1);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('📄 SQL file loaded:', sqlPath);

        // Execute SQL
        console.log('⏳ Executing migration...');
        await client.query(sql);
        console.log('✅ Migration completed successfully!');

        // Verify tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log('\n📋 Tables created:');
        tablesResult.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });

        // Verify views
        const viewsResult = await client.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        if (viewsResult.rows.length > 0) {
            console.log('\n📋 Views created:');
            viewsResult.rows.forEach(row => {
                console.log(`   ✅ ${row.table_name}`);
            });
        }

        client.release();
        console.log('\n🎉 Database is ready for production!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
