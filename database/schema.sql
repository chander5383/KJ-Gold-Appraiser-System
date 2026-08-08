-- =============================================
-- KJ GOLD APPRAISER SYSTEM - DATABASE SCHEMA
-- Supabase PostgreSQL
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS TABLE
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 2. CERTIFICATES TABLE
-- =============================================
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cert_no VARCHAR(50) UNIQUE NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    shop_name VARCHAR(255) NOT NULL DEFAULT 'KRISHNA JEWELLER',
    shop_address TEXT DEFAULT '',
    bank_name VARCHAR(255) DEFAULT '',
    branch VARCHAR(255) DEFAULT '',
    state VARCHAR(100) DEFAULT '',
    account_no VARCHAR(50) DEFAULT '',
    borrower_prefix VARCHAR(10) DEFAULT 'Mr.',
    borrower_name VARCHAR(255) NOT NULL,
    relation_type VARCHAR(10) DEFAULT 'S/O',
    father_name VARCHAR(255) DEFAULT '',
    address TEXT DEFAULT '',
    appraiser_prefix VARCHAR(10) DEFAULT 'Ms.',
    appraiser_name VARCHAR(255) DEFAULT '',
    gold_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cert_date DATE NOT NULL,
    grand_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_pieces INTEGER NOT NULL DEFAULT 0,
    total_gross DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_stone DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_net DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_wt_24ct DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_wt_22ct DECIMAL(10,3) NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for search performance
CREATE INDEX idx_certificates_cert_no ON certificates(cert_no);
CREATE INDEX idx_certificates_financial_year ON certificates(financial_year);
CREATE INDEX idx_certificates_borrower_name ON certificates(borrower_name);
CREATE INDEX idx_certificates_cert_date ON certificates(cert_date);
CREATE INDEX idx_certificates_account_no ON certificates(account_no);
CREATE INDEX idx_certificates_is_deleted ON certificates(is_deleted);

-- =============================================
-- 3. CERTIFICATE ITEMS TABLE
-- =============================================
CREATE TABLE certificate_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    sr_no INTEGER NOT NULL,
    name VARCHAR(255) DEFAULT '',
    pieces INTEGER DEFAULT 0,
    gross DECIMAL(10,3) DEFAULT 0,
    stone DECIMAL(10,3) DEFAULT 0,
    net DECIMAL(10,3) DEFAULT 0,
    carat DECIMAL(5,2) DEFAULT 0,
    wt_24ct DECIMAL(10,3) DEFAULT 0,
    wt_22ct DECIMAL(10,3) DEFAULT 0,
    value DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certificate_items_cert_id ON certificate_items(certificate_id);

-- =============================================
-- 4. ACTIVITY LOGS TABLE
-- =============================================
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) DEFAULT '',
    entity_id VARCHAR(255) DEFAULT '',
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- =============================================
-- 5. SETTINGS TABLE
-- =============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DEFAULT SETTINGS
-- =============================================
INSERT INTO settings (key, value) VALUES
    ('shop_name', 'KRISHNA JEWELLER'),
    ('shop_address', 'St. No. 9-10, 6th Crossing Abohar District Fazilka (Punjab) Pin code 152116'),
    ('gstin', '03AHZPK1424E1ZI'),
    ('pan', 'AHZPK1424E'),
    ('owner_name', 'RAJNISH KUMAR'),
    ('phone', '98155-01976'),
    ('gold_rate_default', '0'),
    ('watermark_url', 'https://raw.githubusercontent.com/chander5383/snj/refs/heads/main/KJ%20(2).png'),
    ('cert_prefix', 'KJ');

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO users (username, password_hash, full_name, role) VALUES
    ('admin', '$2a$12$LJ3a6N5aaF0x4w5h0pVWxOgN9wMn7wKdJ1q7h3VZcLw5J8h0S6Xz6', 'Administrator', 'admin');
