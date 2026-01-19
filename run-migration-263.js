require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('📦 Applying Migration 263: Fix Face Sheet Package Count...\n');
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in .env.local');
  }
  
  // Read and execute migration
  const migrationPath = 'supabase/migrations/263_fix_face_sheet_create_packages_per_pack.sql';
  const migration = fs.readFileSync(migrationPath, 'utf8');
  
  // Write to temp file
  fs.writeFileSync('temp_migration.sql', migration);
  
  // Execute using psql (if available) or show instructions
  try {
    execSync(`psql "${dbUrl}" -f temp_migration.sql`, { stdio: 'inherit' });
    console.log('\n✅ Migration 263 applied successfully!');
  } catch (psqlError) {
    console.log('\n⚠️  psql not found. Please run the migration manually:');
    console.log('\nOption 1: Using Supabase Dashboard');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste the content from:');
    console.log(`   ${migrationPath}`);
    console.log('5. Click "Run"\n');
    
    console.log('Option 2: Using psql command line');
    console.log(`psql "${dbUrl}" -f ${migrationPath}\n`);
  }
  
  // Cleanup
  if (fs.existsSync('temp_migration.sql')) {
    fs.unlinkSync('temp_migration.sql');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
