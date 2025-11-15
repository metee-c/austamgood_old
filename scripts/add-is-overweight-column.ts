import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addIsOverweightColumn() {
  console.log('Adding is_overweight column to receiving_route_trips table...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE "public"."receiving_route_trips"
      ADD COLUMN IF NOT EXISTS "is_overweight" boolean DEFAULT false;

      COMMENT ON COLUMN "public"."receiving_route_trips"."is_overweight" 
      IS 'แฟล็กบ่งชี้ว่าเที่ยวนี้มีน้ำหนักเกินความจุรถ (เกิดจากการบังคับจำนวนรถสูงสุด)';
    `
  });

  if (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  }

  console.log('✅ Successfully added is_overweight column');
}

addIsOverweightColumn();
