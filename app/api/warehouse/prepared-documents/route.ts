import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface PreparedDocument {
  document_type: 'picklist' | 'face_sheet' | 'bonus_face_sheet';
  document_id: number;
  document_no: string;
  status: string;
  total_items: number;
  total_quantity: number;
  created_at: string;
  items: Array<{
    balance_id?: number;
    sku_id: string;
    sku_name: string;
    quantity: number;
    location_id: string;
    pallet_id?: string;
    pallet_id_external?: string;
    lot_no?: string;
    production_date?: string;
    expiry_date?: string;
    total_pack_qty?: number;
    total_piece_qty?: number;
    reserved_pack_qty?: number;
    reserved_piece_qty?: number;
    warehouse_id?: string;
    last_movement_at?: string;
    updated_at?: string;
  }>;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouse_id') || 'WH01';

    const documents: PreparedDocument[] = [];

    // 1. ดึงข้อมูล Picklists ที่จัดเสร็จแล้ว พร้อมข้อมูล inventory balances
    const { data: picklists, error: picklistError } = await supabase
      .from('picklists')
      .select(`
        id,
        picklist_code,
        status,
        total_lines,
        total_quantity,
        created_at,
        picklist_items (
          id,
          sku_id,
          sku_name,
          quantity_to_pick,
          source_location_id
        )
      `)
      .in('status', ['picking', 'completed'])
      .order('created_at', { ascending: false });

    if (!picklistError && picklists) {
      for (const pl of picklists) {
        const items = [];
        
        for (const item of (pl.picklist_items || [])) {
          // ดึงข้อมูล balance จาก location และ sku
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select(`
              balance_id,
              pallet_id,
              pallet_id_external,
              lot_no,
              production_date,
              expiry_date,
              total_pack_qty,
              total_piece_qty,
              reserved_pack_qty,
              reserved_piece_qty,
              warehouse_id,
              last_movement_at,
              updated_at
            `)
            .eq('location_id', item.source_location_id)
            .eq('sku_id', item.sku_id)
            .limit(1)
            .single();

          items.push({
            balance_id: balances?.balance_id,
            sku_id: item.sku_id,
            sku_name: item.sku_name || item.sku_id,
            quantity: item.quantity_to_pick || 0,
            location_id: item.source_location_id || '-',
            pallet_id: balances?.pallet_id,
            pallet_id_external: balances?.pallet_id_external,
            lot_no: balances?.lot_no,
            production_date: balances?.production_date,
            expiry_date: balances?.expiry_date,
            total_pack_qty: balances?.total_pack_qty,
            total_piece_qty: balances?.total_piece_qty,
            reserved_pack_qty: balances?.reserved_pack_qty,
            reserved_piece_qty: balances?.reserved_piece_qty,
            warehouse_id: balances?.warehouse_id,
            last_movement_at: balances?.last_movement_at,
            updated_at: balances?.updated_at
          });
        }

        documents.push({
          document_type: 'picklist',
          document_id: pl.id,
          document_no: pl.picklist_code,
          status: pl.status,
          total_items: pl.total_lines || 0,
          total_quantity: pl.total_quantity || 0,
          created_at: pl.created_at,
          items
        });
      }
    }

    // 2. ดึงข้อมูล Face Sheets ที่จัดเสร็จแล้ว พร้อมข้อมูล inventory balances
    const { data: faceSheets, error: faceSheetError } = await supabase
      .from('face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        total_items,
        total_packages,
        created_at,
        face_sheet_items (
          id,
          sku_id,
          product_name,
          quantity_to_pick,
          source_location_id
        )
      `)
      .in('status', ['picking', 'completed', 'generated'])
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    if (!faceSheetError && faceSheets) {
      for (const fs of faceSheets) {
        const items = [];
        const totalQty = (fs.face_sheet_items || []).reduce((sum: number, item: any) => 
          sum + (item.quantity_to_pick || 0), 0
        );
        
        for (const item of (fs.face_sheet_items || [])) {
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select(`
              balance_id,
              pallet_id,
              pallet_id_external,
              lot_no,
              production_date,
              expiry_date,
              total_pack_qty,
              total_piece_qty,
              reserved_pack_qty,
              reserved_piece_qty,
              warehouse_id,
              last_movement_at,
              updated_at
            `)
            .eq('location_id', item.source_location_id)
            .eq('sku_id', item.sku_id)
            .limit(1)
            .single();

          items.push({
            balance_id: balances?.balance_id,
            sku_id: item.sku_id || '-',
            sku_name: item.product_name || item.sku_id || '-',
            quantity: item.quantity_to_pick || 0,
            location_id: item.source_location_id || '-',
            pallet_id: balances?.pallet_id,
            pallet_id_external: balances?.pallet_id_external,
            lot_no: balances?.lot_no,
            production_date: balances?.production_date,
            expiry_date: balances?.expiry_date,
            total_pack_qty: balances?.total_pack_qty,
            total_piece_qty: balances?.total_piece_qty,
            reserved_pack_qty: balances?.reserved_pack_qty,
            reserved_piece_qty: balances?.reserved_piece_qty,
            warehouse_id: balances?.warehouse_id,
            last_movement_at: balances?.last_movement_at,
            updated_at: balances?.updated_at
          });
        }
        
        documents.push({
          document_type: 'face_sheet',
          document_id: fs.id,
          document_no: fs.face_sheet_no,
          status: fs.status,
          total_items: fs.total_items || 0,
          total_quantity: totalQty,
          created_at: fs.created_at,
          items
        });
      }
    }

    // 3. ดึงข้อมูล Bonus Face Sheets ที่จัดเสร็จแล้ว พร้อมข้อมูล inventory balances
    const { data: bonusFaceSheets, error: bonusFaceSheetError } = await supabase
      .from('bonus_face_sheets')
      .select(`
        id,
        face_sheet_no,
        status,
        total_items,
        total_packages,
        created_at,
        bonus_face_sheet_items (
          id,
          sku_id,
          product_name,
          quantity_to_pick,
          source_location_id
        )
      `)
      .in('status', ['picking', 'completed', 'generated'])
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    if (!bonusFaceSheetError && bonusFaceSheets) {
      for (const bfs of bonusFaceSheets) {
        const items = [];
        const totalQty = (bfs.bonus_face_sheet_items || []).reduce((sum: number, item: any) => 
          sum + (item.quantity_to_pick || 0), 0
        );
        
        for (const item of (bfs.bonus_face_sheet_items || [])) {
          const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select(`
              balance_id,
              pallet_id,
              pallet_id_external,
              lot_no,
              production_date,
              expiry_date,
              total_pack_qty,
              total_piece_qty,
              reserved_pack_qty,
              reserved_piece_qty,
              warehouse_id,
              last_movement_at,
              updated_at
            `)
            .eq('location_id', item.source_location_id)
            .eq('sku_id', item.sku_id)
            .limit(1)
            .single();

          items.push({
            balance_id: balances?.balance_id,
            sku_id: item.sku_id || '-',
            sku_name: item.product_name || item.sku_id || '-',
            quantity: item.quantity_to_pick || 0,
            location_id: item.source_location_id || '-',
            pallet_id: balances?.pallet_id,
            pallet_id_external: balances?.pallet_id_external,
            lot_no: balances?.lot_no,
            production_date: balances?.production_date,
            expiry_date: balances?.expiry_date,
            total_pack_qty: balances?.total_pack_qty,
            total_piece_qty: balances?.total_piece_qty,
            reserved_pack_qty: balances?.reserved_pack_qty,
            reserved_piece_qty: balances?.reserved_piece_qty,
            warehouse_id: balances?.warehouse_id,
            last_movement_at: balances?.last_movement_at,
            updated_at: balances?.updated_at
          });
        }
        
        documents.push({
          document_type: 'bonus_face_sheet',
          document_id: bfs.id,
          document_no: bfs.face_sheet_no,
          status: bfs.status,
          total_items: bfs.total_items || 0,
          total_quantity: totalQty,
          created_at: bfs.created_at,
          items
        });
      }
    }

    // เรียงตามวันที่สร้างล่าสุด
    documents.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      data: documents,
      total: documents.length
    });

  } catch (error: any) {
    console.error('Error fetching prepared documents:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
