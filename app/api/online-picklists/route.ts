import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

// Platform abbreviations for document numbers
const PLATFORM_ABBREVIATIONS: Record<string, string> = {
  'Shopee': 'SH',
  'Lazada': 'LZ',
  'TikTok': 'TK',
  'TikTok Shop': 'TK',
  'Line': 'LN',
  'Line Shopping': 'LN',
  'Facebook': 'FB',
  'Website': 'WB',
  'Other': 'OT'
};

function getPlatformAbbreviation(platform: string): string {
  return PLATFORM_ABBREVIATIONS[platform] || platform.substring(0, 2).toUpperCase();
}

// Generate picklist code: {PLATFORM}-YYYYMMDD-XXX
async function generatePicklistCode(supabase: any, platform: string): Promise<string> {
  const abbr = getPlatformAbbreviation(platform);
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Count existing online picklists for this platform today
  const { count } = await supabase
    .from('online_picklists')
    .select('*', { count: 'exact', head: true })
    .like('picklist_code', `${abbr}-${dateStr}-%`);
  
  const seqNum = String((count || 0) + 1).padStart(3, '0');
  return `${abbr}-${dateStr}-${seqNum}`;
}

export async function POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { platform, items, notes, created_by, picklist_type } = body;
    
    if (!platform || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Platform and items are required' },
        { status: 400 }
      );
    }
    
    // Generate picklist code
    const picklistCode = await generatePicklistCode(supabase, platform);
    
    // Calculate totals
    const totalLines = items.length;
    const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    
    // Create online picklist
    const { data: picklist, error: picklistError } = await supabase
      .from('online_picklists')
      .insert({
        picklist_code: picklistCode,
        platform: platform,
        picklist_type: picklist_type || 'product',
        status: 'pending',
        total_lines: totalLines,
        total_quantity: totalQuantity,
        notes: notes || `ใบหยิบสินค้าออนไลน์ - ${platform}`,
        created_by: created_by || null
      })
      .select()
      .single();
    
    if (picklistError) {
      console.error('Error creating online picklist:', picklistError);
      return NextResponse.json(
        { error: picklistError.message },
        { status: 500 }
      );
    }
    
    // Create online picklist items
    const picklistItems = items.map((item: any) => ({
      picklist_id: picklist.id,
      sku_id: item.sku_id || item.barcode,
      sku_name: item.sku_name || item.erpProductName,
      quantity_to_pick: item.quantity || item.totalQuantity,
      quantity_picked: 0,
      source_location_id: null,
      status: 'pending',
      notes: item.notes || null
    }));
    
    const { error: itemsError } = await supabase
      .from('online_picklist_items')
      .insert(picklistItems);
    
    if (itemsError) {
      console.error('Error creating online picklist items:', itemsError);
      // Rollback picklist
      await supabase.from('online_picklists').delete().eq('id', picklist.id);
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: picklist.id,
        picklist_code: picklistCode,
        platform,
        total_lines: totalLines,
        total_quantity: totalQuantity
      }
    });
    
  } catch (error: any) {
    console.error('Error in online-picklists API:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const searchTerm = searchParams.get('searchTerm');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let query = supabase
      .from('online_picklists')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (platform && platform !== 'all') {
      query = query.eq('platform', platform);
    }
    
    if (searchTerm) {
      query = query.ilike('picklist_code', `%${searchTerm}%`);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching online picklists:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
    
  } catch (error: any) {
    console.error('Error in online-picklists GET:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
