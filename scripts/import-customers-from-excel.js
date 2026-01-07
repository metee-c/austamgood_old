/**
 * Script to import/update customer data from customer.xlsx
 * Usage: node scripts/import-customers-from-excel.js
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Column mapping from Excel to database
const COLUMN_MAP = {
  'รหัสลูกค้า/ผู้ขาย': 'customer_code',
  'รหัสลูกค้าเดิม': 'old_customer_code', // not in DB, skip
  'ชื่อลูกค้า/ผู้ขาย': 'customer_name',
  'ชื่อตามหน้าบัญชี': 'billing_name', // not in DB, use for remarks
  'ชื่อกลุ่มร้านค้า': 'customer_segment',
  'เขตการขาย': 'hub',
  'PIC/พนักงานขายชื่อ': 'contact_person',
  'จังหวัด': 'province',
  'เบอร์โทรศัพท์เจ้าของกิจการ': 'owner_phone', // not in DB, add to remarks
  'ประเภทร้านค้า': 'customer_type_raw',
  'โทรศัพท์': 'phone',
  'การชำระเงิน': 'payment_terms', // not in DB, add to remarks
  'วงเงิน': 'credit_limit', // not in DB, add to remarks
  'เครดิตวัน': 'credit_days', // not in DB, add to remarks
  'ส่วนลดท้ายบิล': 'discount', // not in DB, add to remarks
  'เงื่อนไขพิเศษร้านค้า': 'special_conditions', // not in DB, add to remarks
  'ที่อยู่จัดส่ง': 'shipping_address',
  'เลขประจำตัวผู้เสียภาษีอากรของลูกค้า/ผู้ขาย': 'tax_id',
  'กลุ่มราคาขาย': 'price_group', // not in DB, add to remarks
  'Google Maps': 'google_maps', // not in DB, could extract lat/lng
  'คีย์เวิร์ด': 'keywords', // not in DB, add to remarks
  'Sales Channel?': 'channel_source',
  'ใช้งาน': 'is_active'
};

function mapCustomerType(rawType) {
  if (!rawType) return 'other';
  const type = rawType.toLowerCase();
  if (type.includes('pet shop') || type.includes('petshop')) return 'retail';
  if (type.includes('wholesale') || type.includes('ส่ง')) return 'wholesale';
  if (type.includes('distributor') || type.includes('ตัวแทน')) return 'distributor';
  return 'other';
}

function parseExcelRow(row, headers) {
  const data = {};
  headers.forEach((header, index) => {
    const dbField = COLUMN_MAP[header];
    if (dbField) {
      data[dbField] = row[index] ?? null;
    }
  });
  return data;
}

async function importCustomers() {
  console.log('Reading customer.xlsx...');
  const workbook = XLSX.readFile('customer.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    console.error('Excel file is empty or has no data rows');
    process.exit(1);
  }

  const headers = jsonData[0];
  const dataRows = jsonData.slice(1).filter(row => row[0]); // Filter out empty rows

  console.log(`Found ${dataRows.length} customers in Excel file`);
  console.log('Headers:', headers);

  // Get existing customers (fetch all with pagination)
  const existingByCode = new Map();
  let page = 0;
  const pageSize = 1000;
  let totalFetched = 0;
  
  while (true) {
    const { data: batch, error: fetchError } = await supabase
      .from('master_customer')
      .select('customer_id, customer_code')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (fetchError) {
      console.error('Error fetching existing customers:', fetchError);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;
    
    batch.forEach(c => {
      existingByCode.set(c.customer_code, c.customer_id);
    });
    
    totalFetched += batch.length;
    page++;
    
    if (batch.length < pageSize) break;
  }

  console.log(`Found ${totalFetched} existing customers in database`);

  let insertCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (const row of dataRows) {
    const rawData = parseExcelRow(row, headers);
    
    if (!rawData.customer_code || !rawData.customer_name) {
      console.warn('Skipping row with missing customer_code or customer_name:', row[0]);
      errorCount++;
      continue;
    }

    // Build remarks from extra fields
    const remarksParts = [];
    if (rawData.billing_name && rawData.billing_name !== rawData.customer_name) {
      remarksParts.push(`ชื่อบัญชี: ${rawData.billing_name}`);
    }
    if (rawData.owner_phone) {
      remarksParts.push(`เบอร์เจ้าของ: ${rawData.owner_phone}`);
    }
    if (rawData.payment_terms) {
      remarksParts.push(`การชำระ: ${rawData.payment_terms}`);
    }
    if (rawData.credit_limit) {
      remarksParts.push(`วงเงิน: ${rawData.credit_limit}`);
    }
    if (rawData.credit_days && rawData.credit_days !== '0') {
      remarksParts.push(`เครดิต: ${rawData.credit_days} วัน`);
    }
    if (rawData.discount && rawData.discount !== '0' && rawData.discount !== '-') {
      remarksParts.push(`ส่วนลด: ${rawData.discount}`);
    }
    if (rawData.special_conditions) {
      remarksParts.push(`เงื่อนไขพิเศษ: ${rawData.special_conditions}`);
    }
    if (rawData.keywords) {
      remarksParts.push(`คีย์เวิร์ด: ${rawData.keywords}`);
    }

    const customerData = {
      customer_code: rawData.customer_code,
      customer_name: rawData.customer_name,
      customer_type: mapCustomerType(rawData.customer_type_raw),
      tax_id: rawData.tax_id || null,
      contact_person: rawData.contact_person || null,
      phone: rawData.phone || null,
      shipping_address: rawData.shipping_address || null,
      province: rawData.province || null,
      channel_source: rawData.channel_source || null,
      customer_segment: rawData.customer_segment || null,
      hub: rawData.hub || null,
      status: rawData.is_active === 'YES' ? 'active' : 'inactive',
      remarks: remarksParts.length > 0 ? remarksParts.join(' | ') : null,
    };

    const existingId = existingByCode.get(rawData.customer_code);

    if (existingId) {
      // Update existing customer
      const { error: updateError } = await supabase
        .from('master_customer')
        .update(customerData)
        .eq('customer_id', existingId);

      if (updateError) {
        console.error(`Error updating ${rawData.customer_code}:`, updateError.message);
        errorCount++;
      } else {
        updateCount++;
      }
    } else {
      // Insert new customer
      const newCustomer = {
        ...customerData,
        customer_id: rawData.customer_code, // Use customer_code as ID
        created_by: 'system-import',
      };

      const { error: insertError } = await supabase
        .from('master_customer')
        .insert(newCustomer);

      if (insertError) {
        console.error(`Error inserting ${rawData.customer_code}:`, insertError.message);
        errorCount++;
      } else {
        insertCount++;
      }
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total rows processed: ${dataRows.length}`);
  console.log(`New customers inserted: ${insertCount}`);
  console.log(`Existing customers updated: ${updateCount}`);
  console.log(`Errors: ${errorCount}`);
}

importCustomers().catch(console.error);
