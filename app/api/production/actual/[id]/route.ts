/**
 * Production Actual (Receipt) API Route - Single Record Operations
 * API สำหรับแก้ไขข้อมูลการผลิตจริง (production_receipts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

interface BomMaterialInput {
  material_sku_id: string;
  issued_qty: number;
  actual_qty: number;
  uom?: string;
  is_food?: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('production_receipts')
      .select(`
        *,
        production_order:production_orders!production_receipts_production_order_id_fkey(
          production_no,
          quantity,
          produced_qty,
          status,
          sku_id,
          production_date,
          expiry_date
        ),
        product_sku:master_sku!production_receipts_product_sku_id_fkey(sku_id, sku_name),
        producer:master_employee!production_receipts_produced_by_fkey(employee_id, first_name, last_name, nickname),
        materials:production_receipt_materials(
          id,
          material_sku_id,
          issued_qty,
          actual_qty,
          variance_qty,
          variance_type,
          uom
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching production receipt:', error);
      return NextResponse.json(
        { error: 'Failed to fetch production receipt' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Production receipt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in GET /api/production/actual/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResult = await getCurrentSession();
    if (!sessionResult.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const {
      received_qty,
      lot_no,
      batch_no,
      remarks,
      bom_materials
    } = body;

    // Validate required fields
    if (!received_qty || received_qty <= 0) {
      return NextResponse.json(
        { error: 'received_qty must be greater than 0' },
        { status: 400 }
      );
    }

    // Get current receipt to calculate difference
    const { data: currentReceipt, error: fetchError } = await supabase
      .from('production_receipts')
      .select('*, production_order:production_orders!production_receipts_production_order_id_fkey(id, produced_qty, quantity, status)')
      .eq('id', id)
      .single();

    if (fetchError || !currentReceipt) {
      return NextResponse.json(
        { error: 'Production receipt not found' },
        { status: 404 }
      );
    }

    const oldReceivedQty = currentReceipt.received_qty || 0;
    const qtyDifference = received_qty - oldReceivedQty;

    // Update production receipt
    const { data: updatedReceipt, error: updateError } = await supabase
      .from('production_receipts')
      .update({
        received_qty,
        lot_no: lot_no || null,
        batch_no: batch_no || null,
        remarks: remarks || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating production receipt:', updateError);
      return NextResponse.json(
        { error: 'Failed to update production receipt' },
        { status: 500 }
      );
    }

    // Update production_receipt_materials if provided
    let materialsUpdated = 0;
    if (bom_materials && Array.isArray(bom_materials) && bom_materials.length > 0) {
      // Delete existing materials
      await supabase
        .from('production_receipt_materials')
        .delete()
        .eq('receipt_id', id);

      // Insert new materials
      const materialsToInsert = bom_materials
        .filter((m: BomMaterialInput) => m.material_sku_id && m.actual_qty !== undefined)
        .map((m: BomMaterialInput) => ({
          receipt_id: id,
          material_sku_id: m.material_sku_id,
          issued_qty: m.issued_qty || 0,
          actual_qty: m.actual_qty,
          uom: m.uom || null
        }));

      if (materialsToInsert.length > 0) {
        const { data: insertedMaterials, error: materialsError } = await supabase
          .from('production_receipt_materials')
          .insert(materialsToInsert)
          .select();

        if (materialsError) {
          console.error('Error updating production receipt materials:', materialsError);
        } else {
          materialsUpdated = insertedMaterials?.length || 0;
        }
      }
    }

    // Update produced_qty in production_orders if quantity changed
    if (qtyDifference !== 0 && currentReceipt.production_order) {
      const productionOrder = currentReceipt.production_order;
      const newProducedQty = (productionOrder.produced_qty || 0) + qtyDifference;
      
      // เปลี่ยนสถานะเป็น completed ทุกครั้งที่บันทึกผลิตจริง (ไม่ว่าจะผลิตครบหรือไม่)
      const newStatus = 'completed';

      const { error: orderUpdateError } = await supabase
        .from('production_orders')
        .update({
          produced_qty: Math.max(0, newProducedQty),
          status: newStatus,
          actual_completion_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionOrder.id);

      if (orderUpdateError) {
        console.error('Error updating production order:', orderUpdateError);
      }
    }

    return NextResponse.json({
      data: updatedReceipt,
      message: 'แก้ไขข้อมูลสำเร็จ',
      materials_updated: materialsUpdated,
      qty_difference: qtyDifference
    });
  } catch (error: any) {
    console.error('Error in PUT /api/production/actual/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionResult = await getCurrentSession();
    if (!sessionResult.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Get current receipt to update production order
    const { data: currentReceipt, error: fetchError } = await supabase
      .from('production_receipts')
      .select('*, production_order:production_orders!production_receipts_production_order_id_fkey(id, produced_qty, quantity)')
      .eq('id', id)
      .single();

    if (fetchError || !currentReceipt) {
      return NextResponse.json(
        { error: 'Production receipt not found' },
        { status: 404 }
      );
    }

    // Delete materials first (foreign key constraint)
    await supabase
      .from('production_receipt_materials')
      .delete()
      .eq('receipt_id', id);

    // Delete receipt
    const { error: deleteError } = await supabase
      .from('production_receipts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting production receipt:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete production receipt' },
        { status: 500 }
      );
    }

    // Update production order produced_qty
    if (currentReceipt.production_order) {
      const productionOrder = currentReceipt.production_order;
      const newProducedQty = Math.max(0, (productionOrder.produced_qty || 0) - currentReceipt.received_qty);
      
      await supabase
        .from('production_orders')
        .update({
          produced_qty: newProducedQty,
          status: newProducedQty > 0 ? 'in_progress' : 'released',
          actual_completion_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionOrder.id);
    }

    return NextResponse.json({
      message: 'ลบข้อมูลสำเร็จ'
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/production/actual/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
