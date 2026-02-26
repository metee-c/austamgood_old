#!/usr/bin/env node

/**
 * List all tables in Supabase database
 * Usage: node scripts/list-tables.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function listTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing SUPABASE credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Connecting to Supabase...\n');

  try {
    // Use pg client to query information_schema
    const { Client } = require('pg');

    const client = new Client({
      connectionString: `postgresql://postgres.iwlkslewdgenckuejbit:Austam@567890@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
    });

    await client.connect();

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    await client.end();

    displayResults(result.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('\nℹ️  Falling back to migration file parsing...\n');

    // Fallback: Parse migration files
    const fs = require('fs');
    const path = require('path');

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

    const tables = new Set();
    const regex = /CREATE TABLE[^"]*"public"\."([^"]+)"/g;

    files.forEach(file => {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      let match;
      while ((match = regex.exec(content)) !== null) {
        tables.add(match[1]);
      }
    });

    const sortedTables = Array.from(tables).sort();
    displayResults(sortedTables.map(t => ({ table_name: t })));
  }
}

function displayResults(data) {
  if (!data || data.length === 0) {
    console.log('⚠️  No tables found');
    return;
  }

  console.log(`📊 จำนวนตารางทั้งหมด: ${data.length} ตาราง\n`);
  console.log('รายชื่อตาราง:');
  console.log('─'.repeat(60));

  data.forEach((row, index) => {
    const tableName = row.table_name || row;
    console.log(`${(index + 1).toString().padStart(3)}. ${tableName}`);
  });

  console.log('─'.repeat(60));
  console.log(`\n✅ สำเร็จ! พบ ${data.length} ตาราง\n`);
}

// Run the script
listTables();
