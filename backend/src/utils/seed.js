/**
 * Seed script to create initial admin user with a proper bcrypt hash.
 * Run: node src/utils/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('../config/database');

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create admin user
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash('Admin@123', salt);

    const { data, error } = await supabase
      .from('users')
      .upsert({
        username: 'admin',
        password_hash: hash,
        full_name: 'Administrator',
        role: 'admin',
        is_active: true
      }, { onConflict: 'username' })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create admin user:', error.message);
    } else {
      console.log('✅ Admin user created/updated:', data.username);
      console.log('   Default password: Admin@123');
      console.log('   ⚠️  Change this password after first login!');
    }

    // Ensure default settings exist
    const defaultSettings = [
      { key: 'shop_name', value: 'KRISHNA JEWELLER' },
      { key: 'shop_address', value: 'St. No. 9-10, 6th Crossing Abohar District Fazilka (Punjab) Pin code 152116' },
      { key: 'gstin', value: '03AHZPK1424E1ZI' },
      { key: 'pan', value: 'AHZPK1424E' },
      { key: 'owner_name', value: 'RAJNISH KUMAR' },
      { key: 'phone', value: '98155-01976' },
      { key: 'gold_rate_default', value: '0' },
      { key: 'watermark_url', value: 'https://raw.githubusercontent.com/chander5383/snj/refs/heads/main/KJ%20(2).png' },
      { key: 'cert_prefix', value: 'KJ' }
    ];

    for (const setting of defaultSettings) {
      await supabase
        .from('settings')
        .upsert(setting, { onConflict: 'key' });
    }

    console.log('✅ Default settings seeded');
    console.log('🎉 Seeding complete!');
  } catch (err) {
    console.error('❌ Seed error:', err);
  }

  process.exit(0);
}

seed();
