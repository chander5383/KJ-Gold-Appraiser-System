/**
 * Database Setup Script
 * Creates all tables in Supabase by executing schema SQL via REST API.
 * Run: node src/utils/setup-db.js
 */
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const SCHEMA_SQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (order matters due to foreign keys)
DROP TABLE IF EXISTS certificate_items CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE
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

-- 2. CERTIFICATES TABLE
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

CREATE INDEX idx_certificates_cert_no ON certificates(cert_no);
CREATE INDEX idx_certificates_financial_year ON certificates(financial_year);
CREATE INDEX idx_certificates_borrower_name ON certificates(borrower_name);
CREATE INDEX idx_certificates_cert_date ON certificates(cert_date);
CREATE INDEX idx_certificates_account_no ON certificates(account_no);
CREATE INDEX idx_certificates_is_deleted ON certificates(is_deleted);

-- 3. CERTIFICATE ITEMS TABLE
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

-- 4. ACTIVITY LOGS TABLE
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

-- 5. SETTINGS TABLE
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UPDATED_AT TRIGGERS
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
`;

async function setupDatabase() {
  console.log('🔧 Setting up database schema...\n');

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({})
    });

    // The REST API can't run DDL, so we use the SQL endpoint instead
    const sqlResponse = await fetch(`${SUPABASE_URL}/pg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: SCHEMA_SQL })
    });

    if (!sqlResponse.ok) {
      // Try the alternative SQL execution endpoint
      const altResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql: SCHEMA_SQL })
      });

      if (!altResponse.ok) {
        console.log('⚠️  Cannot run SQL directly via REST API.');
        console.log('');
        console.log('📋 Please run the schema manually:');
        console.log('   1. Go to your Supabase Dashboard:');
        console.log(`      ${SUPABASE_URL.replace('.supabase.co', '')}`);
        console.log('   2. Click "SQL Editor" in the left sidebar');
        console.log('   3. Click "New Query"');
        console.log('   4. Copy and paste the contents of: database/schema.sql');
        console.log('   5. Click "Run"');
        console.log('');
        console.log('   Then run: npm run seed');
        process.exit(1);
      }
    }

    console.log('✅ Database schema created successfully!');
    console.log('');
    console.log('Now run: npm run seed');
  } catch (err) {
    console.error('❌ Setup error:', err.message);
    console.log('');
    console.log('📋 Please run the schema manually in Supabase SQL Editor.');
    console.log(`   Dashboard: ${SUPABASE_URL}`);
    console.log('   File to paste: database/schema.sql');
    process.exit(1);
  }
}

setupDatabase();
