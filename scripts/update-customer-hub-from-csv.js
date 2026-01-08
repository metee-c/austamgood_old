/**
 * Script to update master_customer.hub from customer_template.csv
 * This restores the correct Hub values that were overwritten by the Excel import
 * Usage: node scripts/update-customer-hub-from-csv.js
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function updateCustomerHubs() {
  console.log('Reading customer_template.csv...');
  const csvContent = fs.readFileSync('customer_template.csv', 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  const headers = parseCSVLine(lines[0]);
  const customerIdIndex = headers.findIndex(h => h === 'customer_id' || h === 'customer_code');
  const hubIndex = headers.findIndex(h => h === 'hub');
  
  console.log('Headers found:', headers.length);
  console.log('customer_id index:', customerIdIndex);
  console.log('hub index:', hubIndex);
  
  if (customerIdIndex === -1 || hubIndex === -1) {
    console.error('Could not find customer_id or hub column');
    process.exit(1);
  }
  
  // Build customer_id -> hub mapping
  const hubMapping = new Map();
  
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const customerId = cols[customerIdIndex];
    let hub = cols[hubIndex];
    
    if (customerId && hub) {
      // Clean up hub value (remove extra spaces, quotes)
      hub = hub.replace(/^"|"$/g, '').trim();
      if (hub) {
        hubMapping.set(customerId, hub);
      }
    }
  }
  
  console.log(`Found ${hubMapping.size} customers with hub data in CSV`);
  
  // Show sample mappings
  console.log('\nSample hub mappings:');
  let count = 0;
  for (const [customerId, hub] of hubMapping) {
    if (count++ < 10) {
      console.log(`  ${customerId} -> ${hub}`);
    }
  }
  
  // Update master_customer in batches
  console.log('\nUpdating master_customer.hub...');
  
  let updateCount = 0;
  let errorCount = 0;
  
  for (const [customerId, hub] of hubMapping) {
    const { error } = await supabase
      .from('master_customer')
      .update({ hub })
      .eq('customer_id', customerId);
    
    if (error) {
      console.error(`Error updating ${customerId}:`, error.message);
      errorCount++;
    } else {
      updateCount++;
    }
    
    // Progress indicator
    if (updateCount % 100 === 0) {
      console.log(`  Updated ${updateCount} customers...`);
    }
  }
  
  console.log('\n=== Update Summary ===');
  console.log(`Total customers in CSV: ${hubMapping.size}`);
  console.log(`Successfully updated: ${updateCount}`);
  console.log(`Errors: ${errorCount}`);
  
  // Verify by checking a few customers
  console.log('\nVerifying updates...');
  const sampleIds = Array.from(hubMapping.keys()).slice(0, 5);
  const { data: verifyData } = await supabase
    .from('master_customer')
    .select('customer_id, hub')
    .in('customer_id', sampleIds);
  
  if (verifyData) {
    console.log('Sample verification:');
    verifyData.forEach(c => {
      const expectedHub = hubMapping.get(c.customer_id);
      const match = c.hub === expectedHub ? '✅' : '❌';
      console.log(`  ${match} ${c.customer_id}: ${c.hub} (expected: ${expectedHub})`);
    });
  }
}

updateCustomerHubs().catch(console.error);
