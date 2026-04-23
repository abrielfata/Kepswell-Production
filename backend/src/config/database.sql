-- ============================================
-- DATABASE: live_session_db
-- DESCRIPTION: Schema untuk Live Session Reporting System
-- VERSION: 2.0 (synced with application code)
-- ============================================

-- Hapus tabel dan view jika sudah ada (untuk development/fresh migration)
DROP VIEW IF EXISTS v_monthly_host_stats CASCADE;
DROP VIEW IF EXISTS v_reports_with_host CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- TABLE: users
-- DESCRIPTION: Menyimpan data user (Manager & Host)
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_user_id VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(100),
    full_name VARCHAR(200),
    email VARCHAR(200),
    role VARCHAR(20) NOT NULL CHECK (role IN ('MANAGER', 'HOST')),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk performa query
CREATE INDEX idx_users_telegram_id ON users(telegram_user_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_approved ON users(is_approved);

-- ============================================
-- TABLE: reports
-- DESCRIPTION: Menyimpan laporan live session dari host
-- ============================================
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_gmv DECIMAL(15, 2) NOT NULL DEFAULT 0,
    screenshot_url TEXT,
    ocr_raw_text TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    live_duration VARCHAR(50),
    platform VARCHAR(20) CHECK (platform IN ('TIKTOK', 'SHOPEE')),
    month INTEGER,
    year INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk performa query
CREATE INDEX idx_reports_host_id ON reports(host_id);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_month_year ON reports(month, year);
CREATE INDEX idx_reports_platform ON reports(platform);

-- ============================================
-- VIEW: Laporan dengan Info Host
-- ============================================
CREATE OR REPLACE VIEW v_reports_with_host AS
SELECT 
    r.id,
    r.reported_gmv,
    r.screenshot_url,
    r.ocr_raw_text,
    r.status,
    r.live_duration,
    r.platform,
    COALESCE(r.month, EXTRACT(MONTH FROM r.created_at)::INT) AS month,
    COALESCE(r.year, EXTRACT(YEAR FROM r.created_at)::INT) AS year,
    r.notes,
    r.created_at,
    r.updated_at,
    u.id AS host_id,
    u.telegram_user_id,
    u.username AS host_username,
    u.full_name AS host_full_name
FROM reports r
JOIN users u ON r.host_id = u.id
ORDER BY r.created_at DESC;

-- ============================================
-- VIEW: Statistik Bulanan per Host
-- Digunakan oleh endpoint /api/reports/monthly-host-stats
-- ============================================
CREATE OR REPLACE VIEW v_monthly_host_stats AS
SELECT
    u.id AS host_id,
    u.full_name AS host_name,
    u.username,
    COALESCE(r.month, EXTRACT(MONTH FROM r.created_at)::INT) AS month,
    COALESCE(r.year, EXTRACT(YEAR FROM r.created_at)::INT) AS year,
    COUNT(r.id) AS total_reports,
    COUNT(CASE WHEN r.status = 'VERIFIED' THEN 1 END) AS verified_reports,
    COALESCE(SUM(CASE WHEN r.status = 'VERIFIED' THEN r.reported_gmv ELSE 0 END), 0) AS total_gmv,
    COALESCE(
        SUM(
            CASE WHEN r.status = 'VERIFIED' AND r.live_duration IS NOT NULL THEN
                -- Parse durasi format "Xh Ym" atau "X jam Y menit" menjadi jam
                CASE
                    WHEN r.live_duration ~ '^\d+h'
                        THEN CAST(SUBSTRING(r.live_duration FROM '(\d+)h') AS DECIMAL)
                           + COALESCE(CAST(NULLIF(SUBSTRING(r.live_duration FROM '(\d+)m'), '') AS DECIMAL), 0) / 60.0
                    WHEN r.live_duration ~ '^\d+:\d+'
                        THEN CAST(SPLIT_PART(r.live_duration, ':', 1) AS DECIMAL)
                           + CAST(SPLIT_PART(r.live_duration, ':', 2) AS DECIMAL) / 60.0
                    ELSE 0
                END
            ELSE 0
            END
        ), 0
    ) AS total_live_hours
FROM users u
LEFT JOIN reports r ON u.id = r.host_id
WHERE u.role = 'HOST'
GROUP BY u.id, u.full_name, u.username,
         COALESCE(r.month, EXTRACT(MONTH FROM r.created_at)::INT),
         COALESCE(r.year, EXTRACT(YEAR FROM r.created_at)::INT);

-- ============================================
-- FUNCTION: Update timestamp otomatis
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk auto-update timestamp
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS (sesuaikan dengan user DB Anda)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_db_user;