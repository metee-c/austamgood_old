import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeProvinceName, getProvinceVariants } from '@/lib/utils/province-normalizer';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/freight-rates/by-province?province=ปทุมธานี&supplier_id=SVC001
 * ดึงราคาค่าขนส่งตามจังหวัดปลายทางและผู้ให้บริการ
 * รองรับชื่อจังหวัดทั้งชื่อย่อและชื่อเต็ม (เช่น กทม, กรุงเทพ, กรุงเทพมหานคร)
 */
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const province = searchParams.get('province');
    const supplier_id = searchParams.get('supplier_id');

    if (!province) {
      return NextResponse.json(
        { data: null, error: 'Province parameter is required' },
        { status: 400 }
      );
    }

    // Normalize province name และหา variants ทั้งหมด
    const normalizedProvince = normalizeProvinceName(province);
    const provinceVariants = getProvinceVariants(province);

    console.log('🔍 [Freight Rate Lookup]', {
      original: province,
      normalized: normalizedProvince,
      variants: provinceVariants,
      supplier_id
    });

    // Query freight rates โดยค้นหาจากชื่อมาตรฐานก่อน
    let query = supabase
      .from('master_freight_rate')
      .select('*')
      .eq('destination_province', normalizedProvince)
      .order('created_at', { ascending: false });

    // Filter by supplier if provided
    if (supplier_id) {
      query = query.eq('carrier_id', supplier_id);
    }

    let { data, error } = await query;

    // ถ้าไม่เจอด้วยชื่อมาตรฐาน ลองค้นหาจาก variants อื่นๆ
    if ((!data || data.length === 0) && provinceVariants.length > 1) {
      console.log('⚠️ Not found with normalized name, trying variants...');

      let variantQuery = supabase
        .from('master_freight_rate')
        .select('*')
        .in('destination_province', provinceVariants)
        .order('created_at', { ascending: false });

      if (supplier_id) {
        variantQuery = variantQuery.eq('carrier_id', supplier_id);
      }

      const variantResult = await variantQuery;
      data = variantResult.data;
      error = variantResult.error;
    }

    if (error) {
      console.error('❌ Error fetching freight rates by province:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Return the most recent rate if multiple found
    const rate = data && data.length > 0 ? data[0] : null;

    if (rate) {
      console.log('✅ Found freight rate:', {
        route_name: rate.route_name,
        base_price: rate.base_price,
        destination_province: rate.destination_province
      });
    } else {
      console.log('❌ No freight rate found for:', {
        province,
        normalizedProvince,
        supplier_id
      });
    }

    return NextResponse.json({ data: rate, error: null });
  } catch (error: any) {
    console.error('❌ Error in freight-rates/by-province:', error);
    return NextResponse.json(
      { data: null, error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
