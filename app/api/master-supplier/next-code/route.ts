import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const supplierType = searchParams.get('type') || 'vendor';

    // Determine prefix based on supplier type
    const prefix = supplierType === 'vendor' ? 'VND' :
                   supplierType === 'service_provider' ? 'SVC' : 'BTH';

    // Get the latest supplier code with this prefix
    const { data: suppliers, error } = await supabase
      .from('master_supplier')
      .select('supplier_code')
      .ilike('supplier_code', `${prefix}%`)
      .order('supplier_code', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching suppliers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch suppliers' },
        { status: 500 }
      );
    }

    let nextNumber = 1;

    if (suppliers && suppliers.length > 0) {
      // Extract the number from the last code (e.g., "VND001" -> 1)
      const lastCode = suppliers[0].supplier_code;
      const match = lastCode.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0]) + 1;
      }
    }

    // Format the next code with leading zeros (e.g., VND001, VND002, ..., VND999)
    const nextCode = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    return NextResponse.json({
      nextCode,
      prefix,
      number: nextNumber
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withShadowLog(_GET);
