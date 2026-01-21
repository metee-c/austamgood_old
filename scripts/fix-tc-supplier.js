
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixContractSupplier() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const planId = 267; // RP-20260122-001
    const oldSupplierId = 'unknown';
    const newSupplierId = 'SVC001';
    const newSupplierName = 'บริษัทขนส่งหลัก (SVC001)'; // เปลี่ยนตามชื่อจริงถ้าทราบ หรือจะดึงจาก master

    console.log(`Checking contract for plan ${planId} and supplier ${oldSupplierId}...`);

    // 1. Fetch correct supplier name from master if possible
    const { data: supplierData } = await supabase
        .from('suppliers')
        .select('supplier_name')
        .eq('supplier_id', newSupplierId)
        .single();

    const finalName = supplierData?.supplier_name || newSupplierName;

    // 2. Update the contract
    const { data, error } = await supabase
        .from('transport_contracts')
        .update({
            supplier_id: newSupplierId,
            supplier_name: finalName
        })
        .eq('plan_id', planId)
        .eq('supplier_id', oldSupplierId)
        .select();

    if (error) {
        console.error('Error updating contract:', error);
    } else if (data && data.length > 0) {
        console.log('Successfully updated contract:', data[0]);
    } else {
        console.log('No contract found to update or already updated.');
    }
}

fixContractSupplier();
