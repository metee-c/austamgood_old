/**
 * Script to assign suppliers to vehicles
 * This helps populate the supplier_id field in master_vehicle table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Vehicle-Supplier Assignment Tool ===\n');
  console.log('Supabase URL:', supabaseUrl ? 'โœ… Set' : 'โŒ Missing');
  console.log('Service Key:', supabaseKey ? 'โœ… Set' : 'โŒ Missing');
  console.log('');

  // Step 1: Get all transport suppliers
  console.log('Step 1: Fetching transport suppliers...');
  const { data: suppliers, error: suppliersError } = await supabase
    .from('master_supplier')
    .select('supplier_id, supplier_code, supplier_name, supplier_type, service_category')
    .or('supplier_type.eq.ขนส่ง,service_category.like.%ขนส่ง%');

  if (suppliersError) {
    console.error('Error fetching suppliers:', suppliersError);
    return;
  }

  if (!suppliers || suppliers.length === 0) {
    console.log('โš ๏ธ  No transport suppliers found!');
    console.log('Please add a transport supplier first in master_supplier table.');
    return;
  }

  console.log(`\nFound ${suppliers.length} transport supplier(s):\n`);
  suppliers.forEach((s, i) => {
    console.log(`${i + 1}. ${s.supplier_code} - ${s.supplier_name}`);
    console.log(`   ID: ${s.supplier_id}`);
    console.log(`   Type: ${s.supplier_type || 'N/A'}`);
    console.log(`   Category: ${s.service_category || 'N/A'}\n`);
  });

  // Step 2: Get all vehicles
  console.log('Step 2: Fetching vehicles...');
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('master_vehicle')
    .select('vehicle_id, vehicle_code, plate_number, supplier_id, current_status')
    .eq('current_status', 'Active')
    .order('vehicle_code');

  if (vehiclesError) {
    console.error('Error fetching vehicles:', vehiclesError);
    return;
  }

  if (!vehicles || vehicles.length === 0) {
    console.log('โš ๏ธ  No active vehicles found!');
    return;
  }

  console.log(`\nFound ${vehicles.length} active vehicle(s):\n`);
  const unassignedVehicles = vehicles.filter(v => !v.supplier_id);
  const assignedVehicles = vehicles.filter(v => v.supplier_id);

  console.log(`โœ… Assigned: ${assignedVehicles.length}`);
  console.log(`โŒ Unassigned: ${unassignedVehicles.length}\n`);

  if (assignedVehicles.length > 0) {
    console.log('Already assigned vehicles:');
    assignedVehicles.forEach(v => {
      console.log(`  - ${v.vehicle_code} (${v.plate_number}) โ†' ${v.supplier_id}`);
    });
    console.log('');
  }

  if (unassignedVehicles.length > 0) {
    console.log('Unassigned vehicles:');
    unassignedVehicles.forEach(v => {
      console.log(`  - ${v.vehicle_code} (${v.plate_number})`);
    });
    console.log('');
  }

  // Step 3: Auto-assign if only one supplier
  if (suppliers.length === 1 && unassignedVehicles.length > 0) {
    const supplier = suppliers[0];
    console.log(`\n๐Ÿ"„ Auto-assigning all unassigned vehicles to: ${supplier.supplier_name}`);
    
    const vehicleIds = unassignedVehicles.map(v => v.vehicle_id);
    
    const { data: updated, error: updateError } = await supabase
      .from('master_vehicle')
      .update({ supplier_id: supplier.supplier_id })
      .in('vehicle_id', vehicleIds)
      .select();

    if (updateError) {
      console.error('โŒ Error updating vehicles:', updateError);
      return;
    }

    console.log(`\nโœ… Successfully assigned ${updated.length} vehicle(s) to ${supplier.supplier_name}!`);
    console.log('\nUpdated vehicles:');
    updated.forEach(v => {
      console.log(`  - ${v.vehicle_code} (${v.plate_number}) โ†' ${supplier.supplier_id}`);
    });
  } else if (suppliers.length > 1 && unassignedVehicles.length > 0) {
    console.log('\n๐Ÿ"Œ Multiple suppliers found. Please manually assign vehicles:');
    console.log('\nOption 1: Use SQL in Supabase Studio');
    console.log('UPDATE master_vehicle SET supplier_id = \'SVC001\' WHERE vehicle_id IN (1, 2, 3);');
    console.log('\nOption 2: Edit migration 138 and uncomment the UPDATE statement');
  } else if (unassignedVehicles.length === 0) {
    console.log('\nโœ… All vehicles are already assigned to suppliers!');
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
