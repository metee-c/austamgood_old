import { SupabaseClient } from '@supabase/supabase-js';

/**
 * ตรวจสอบว่า SKU สามารถย้ายไป Location นี้ได้หรือไม่
 * - ถ้า Location ไม่ใช่ Prep Area → อนุญาตเสมอ
 * - ถ้า Location เป็น Prep Area → ต้องมี mapping ใน sku_preparation_area_mapping
 */
export async function canTransferToLocation(
  supabase: SupabaseClient,
  skuId: string,
  destinationLocationId: string
): Promise<{ allowed: boolean; message?: string }> {
  // Step 1: เช็คว่า destination เป็น Prep Area หรือไม่
  // ใช้ area_code match กับ location_id
  const { data: prepArea, error: prepAreaError } = await supabase
    .from('preparation_area')
    .select('area_id, area_name, area_code')
    .eq('area_code', destinationLocationId)
    .maybeSingle();

  if (prepAreaError) {
    console.error('Error checking prep area:', prepAreaError);
    // ถ้า error ให้อนุญาตไปก่อน (fail open)
    return { allowed: true };
  }

  // ถ้าไม่ใช่ Prep Area → อนุญาตเสมอ
  if (!prepArea) {
    return { allowed: true };
  }

  // Step 2: ถ้าเป็น Prep Area → เช็คว่า SKU มี mapping หรือไม่
  const { data: mapping, error: mappingError } = await supabase
    .from('sku_preparation_area_mapping')
    .select('mapping_id')
    .eq('sku_id', skuId)
    .eq('preparation_area_id', prepArea.area_id)
    .maybeSingle();

  if (mappingError) {
    console.error('Error checking SKU mapping:', mappingError);
    // ถ้า error ให้อนุญาตไปก่อน (fail open)
    return { allowed: true };
  }

  if (!mapping) {
    // ไม่มี mapping → ไม่อนุญาต
    // หา Prep Area ที่ SKU ควรไป
    const { data: correctMapping } = await supabase
      .from('sku_preparation_area_mapping')
      .select(`
        preparation_area_id,
        preparation_area:preparation_area_id (area_name, area_code)
      `)
      .eq('sku_id', skuId)
      .eq('is_primary', true)
      .maybeSingle();

    const correctArea = (correctMapping?.preparation_area as any)?.area_code || 'ไม่ได้กำหนด';
    const correctAreaName = (correctMapping?.preparation_area as any)?.area_name || '';

    return {
      allowed: false,
      message: `❌ SKU นี้ไม่ได้กำหนดให้เติมที่บ้านหยิบ ${prepArea.area_code} (${prepArea.area_name})\n\n✅ บ้านหยิบที่ถูกต้อง: ${correctArea}${correctAreaName ? ` (${correctAreaName})` : ''}`
    };
  }

  // มี mapping → อนุญาต
  return { allowed: true };
}

/**
 * ตรวจสอบว่า Location เป็น Preparation Area หรือไม่
 */
export async function isPreparationArea(
  supabase: SupabaseClient,
  locationId: string
): Promise<boolean> {
  const { data: prepArea } = await supabase
    .from('preparation_area')
    .select('area_id')
    .eq('area_code', locationId)
    .maybeSingle();

  return !!prepArea;
}

/**
 * หา Prep Area ที่ถูกต้องสำหรับ SKU
 */
export async function getCorrectPrepAreaForSku(
  supabase: SupabaseClient,
  skuId: string
): Promise<{ area_code: string; area_name: string } | null> {
  const { data: mapping } = await supabase
    .from('sku_preparation_area_mapping')
    .select(`
      preparation_area:preparation_area_id (area_code, area_name)
    `)
    .eq('sku_id', skuId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!mapping?.preparation_area) {
    return null;
  }

  const prepArea = mapping.preparation_area as unknown as { area_code: string; area_name: string };
  return prepArea;
}
