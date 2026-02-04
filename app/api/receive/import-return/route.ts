import { NextRequest, NextResponse } from 'next/server';
import { receiveService, CreateReceivePayload, ReceiveType, ReceiveStatus, PalletScanStatus } from '@/lib/database/receive';
export async function POST(request: NextRequest) {
try {
    const body = await request.json();

    // Validate required fields
    const {
      receive_type,
      reference_doc,
      customer_id,
      warehouse_id,
      receive_date,
      received_by,
      status,
      notes,
      items,
    } = body;

    // Validate receive_type
    const validReceiveTypes: ReceiveType[] = [
      'รับสินค้าปกติ',
      'รับสินค้าชำรุด',
      'รับสินค้าหมดอายุ',
      'รับสินค้าคืน',
      'รับสินค้าคืน (ไม่มีเอกสาร)',
      'รับสินค้าตีกลับ',
      'การผลิต',
    ];

    if (!validReceiveTypes.includes(receive_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid receive_type: ${receive_type}` },
        { status: 400 }
      );
    }

    // Validate required fields for return types
    if (['รับสินค้าตีกลับ', 'รับสินค้าคืน'].includes(receive_type)) {
      if (!customer_id) {
        return NextResponse.json(
          { success: false, error: 'customer_id is required for return types' },
          { status: 400 }
        );
      }
    }

    if (!warehouse_id) {
      return NextResponse.json(
        { success: false, error: 'warehouse_id is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.sku_id) {
        return NextResponse.json(
          { success: false, error: `Item ${i + 1}: sku_id is required` },
          { status: 400 }
        );
      }
      if (item.piece_quantity === undefined || item.piece_quantity === null) {
        return NextResponse.json(
          { success: false, error: `Item ${i + 1}: piece_quantity is required` },
          { status: 400 }
        );
      }
      // expiry_date is optional for return items
      // if (!item.expiry_date) {
      //   return NextResponse.json(
      //     { success: false, error: `Item ${i + 1}: expiry_date is required` },
      //     { status: 400 }
      //   );
      // }
    }

    // Prepare payload for receiveService
    const payload: CreateReceivePayload = {
      receive_type: receive_type as ReceiveType,
      reference_doc: reference_doc || undefined,
      customer_id: customer_id || undefined,
      warehouse_id,
      receive_date: receive_date || new Date().toISOString().split('T')[0],
      received_by: received_by || undefined,
      status: (status as ReceiveStatus) || 'รับเข้าแล้ว',
      notes: notes || undefined,
      pallet_box_option: 'ไม่สร้าง_Pallet_ID',
      pallet_calculation_method: 'ใช้จำนวนจากมาสเตอร์สินค้า',
      created_by: received_by || undefined,
      items: items.map((item: any) => ({
        sku_id: item.sku_id,
        product_name: item.product_name || undefined,
        barcode: item.barcode || undefined,
        production_date: item.production_date || undefined,
        expiry_date: item.expiry_date || undefined,
        pack_quantity: item.pack_quantity || 0,
        piece_quantity: item.piece_quantity,
        weight_kg: item.weight_kg || undefined,
        pallet_id: undefined,
        pallet_color: undefined,
        pallet_scan_status: (item.pallet_scan_status as PalletScanStatus) || 'ไม่จำเป็น',
        location_id: item.location_id || 'Return',
        pallet_id_external: undefined,
        received_date: receive_date || new Date().toISOString().split('T')[0],
      })),
    };

    // Create receive using existing service
    const { data, error } = await receiveService.createReceive(payload);

    if (error) {
      console.error('[Import Return API] Error creating receive:', error);
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        receive_id: data?.receive_id,
        receive_no: data?.receive_no,
      },
    });

  } catch (error) {
    console.error('[Import Return API] Unexpected error:', error);

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
