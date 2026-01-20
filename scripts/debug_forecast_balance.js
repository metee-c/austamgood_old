
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually
function loadEnv() {
    const envFiles = ['.env', '.env.local'];
    for (const file of envFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            console.log(`Loading env from ${file}`);
            const content = fs.readFileSync(filePath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
        }
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE environment variables. Please check .env or .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalances() {
    const targetSku = 'R-NET-C-PRC-010'; // SKU ที่เห็นปัญหาในภาพ

    console.log(`Checking balances for SKU: ${targetSku}...`);

    const { data: balances, error } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('sku_id', targetSku);

    if (error) {
        console.error('Error fetching balances:', error);
        return;
    }

    console.log(`Found ${balances.length} balance records.`);

    let totalQty = 0;
    let totalReserved = 0;
    let negBalances = [];

    balances.forEach(b => {
        const total = b.total_piece_qty || 0;
        const reserved = b.reserved_piece_qty || 0;

        if (total < 0) {
            negBalances.push(b);
        }

        console.log(`- Loc: ${b.location_id}, ID: ${b.balance_id}, Total: ${total}, Reserved: ${reserved}`);
        totalQty += total;
        totalReserved += reserved;
    });

    console.log('-----------------------------------');
    console.log(`Sum Total Qty (Physical Stock): ${totalQty}`);
    console.log(`Sum Reserved Qty: ${totalReserved}`);
    console.log(`Available (Total - Reserved): ${totalQty - totalReserved}`);

    if (negBalances.length > 0) {
        console.log('\nWARNING: Found negative balance records:');
        negBalances.forEach(b => console.log(JSON.stringify(b)));
    }
}

checkBalances();
