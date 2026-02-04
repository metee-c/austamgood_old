import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/master-sku/[id]
 * อัพเดทข้อมูลมาสเตอร์ SKU (เฉพาะฟิลด์ที่ส่งมา)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
try {
    const { id: skuId } = await params;
    const body = await request.json();
    
    const supabase = await createClient();

    // Validate sku_id
    if (!skuId) {
      return NextResponse.json({ error: 'SKU ID is required' }, { status: 400 });
    }

    // Check if SKU exists
    const { data: existingSku, error: fetchError } = await supabase
      .from('master_sku')
      .select('sku_id')
      .eq('sku_id', skuId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching SKU:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch SKU' }, { status: 500 });
    }

    if (!existingSku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    // Update only provided fields
    const updateData: any = {};
    
    if (body.qty_per_pallet !== undefined) {
      updateData.qty_per_pallet = Number(body.qty_per_pallet);
      
      // Validate qty_per_pallet
      if (isNaN(updateData.qty_per_pallet) || updateData.qty_per_pallet <= 0) {
        return NextResponse.json({ 
          error: 'จำนวนชิ้นต่อพาเลทต้องเป็นตัวเลขที่มากกว่า 0' 
        }, { status: 400 });
      }
    }

    if (body.qty_per_pack !== undefined) {
      updateData.qty_per_pack = Number(body.qty_per_pack);
    }

    if (body.weight_per_piece_kg !== undefined) {
      updateData.weight_per_piece_kg = Number(body.weight_per_piece_kg);
    }

    if (body.sku_name !== undefined) {
      updateData.sku_name = body.sku_name;
    }

    if (body.barcode !== undefined) {
      updateData.barcode = body.barcode;
    }

    if (body.category !== undefined) {
      updateData.category = body.category;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // Perform update
    const { data, error } = await supabase
      .from('master_sku')
      .update(updateData)
      .eq('sku_id', skuId)
      .select()
      .single();

    if (error) {
      console.error('Error updating SKU:', error);
      return NextResponse.json({ 
        error: 'Failed to update SKU', 
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'อัพเดทข้อมูลสำเร็จ',
      data 
    });

  } catch (error: any) {
    console.error('Error in PATCH /api/master-sku/[id]:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * GET /api/master-sku/[id]
 * ดึงข้อมูลมาสเตอร์ SKU ตาม ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: skuId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('master_sku')
      .select('*')
      .eq('sku_id', skuId)
      .single();

    if (error) {
      console.error('Error fetching SKU:', error);
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }
    return NextResponse.json({ data });

  } catch (error: any) {
    console.error('Error in GET /api/master-sku/[id]:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
