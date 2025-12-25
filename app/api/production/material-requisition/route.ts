/**
 * Material Requisition API Route
 * API สำหรับดึงรายการวัตถุดิบที่ต้องเบิกจากใบสั่งผลิต
 * รวมข้อมูลจาก:
 * 1. replenishment_queue (trigger_source='production_order') - สำหรับวัตถุดิบอาหาร
 * 2. production_order_items - สำหรับ packaging ที่ไม่มี replenishment task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');

    // 1. Fetch replenishment tasks for food materials (trigger_source='production_order')
    let replenishmentQuery = supabase
      .from('replenishment_queue')
      .select(`
        queue_id,
        warehouse_id,
        sku_id,
        from_location_id,
        to_location_id,
        requested_qty,
        confirmed_qty,
        priority,
        status,
        trigger_source,
        trigger_reference,
        assigned_to,
        assigned_at,
        started_at,
        completed_at,
        notes,
        created_at,
        pallet_id,
        expiry_date,
        master_sku:sku_id (sku_id, sku_name, uom_base, qty_per_pack, category, sub_category),
        from_location:from_location_id (location_id, zone, location_type),
        to_location:to_location_id (location_id, zone, location_type),
        assigned_user:assigned_to (user_id, username, full_name)
      `)
      .eq('trigger_source', 'production_order')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      replenishmentQuery = replenishmentQuery.eq('status', status);
    }

    if (search) {
      replenishmentQuery = replenishmentQuery.or(
        `sku_id.ilike.%${search}%,trigger_reference.ilike.%${search}%,pallet_id.ilike.%${search}%`
      );
    }

    const { data: replenishmentData, error: replenishmentError } = await replenishmentQuery;

    if (replenishmentError) {
      console.error('Error fetching replenishment tasks:', replenishmentError);
      return NextResponse.json({ error: replenishmentError.message }, { status: 500 });
    }

    // Fetch production_date from inventory_balances for pallets in replenishment_queue
    const palletIds = (replenishmentData || [])
      .map((r: any) => r.pallet_id)
      .filter((p: string | null) => p);
    
    let palletDatesMap: Record<string, string | null> = {};
    if (palletIds.length > 0) {
      const { data: balanceData } = await supabase
        .from('wms_inventory_balances')
        .select('pallet_id, production_date')
        .in('pallet_id', palletIds);
      
      (balanceData || []).forEach((b: any) => {
        if (b.pallet_id && b.production_date) {
          palletDatesMap[b.pallet_id] = b.production_date;
        }
      });
    }

    // 2. Fetch production_order_items for packaging (items without replenishment tasks)
    // Get all production_order_items and filter out those that have replenishment tasks
    let itemsQuery = supabase
      .from('production_order_items')
      .select(`
        id,
        production_order_id,
        material_sku_id,
        required_qty,
        issued_qty,
        remaining_qty,
        uom,
        status,
        issued_date,
        remarks,
        created_at,
        updated_at,
        production_order:production_orders!production_order_items_production_order_id_fkey(
          id,
          production_no,
          status
        ),
        material_sku:master_sku!production_order_items_material_sku_id_fkey(
          sku_id,
          sku_name,
          uom_base,
          category,
          sub_category
        )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      itemsQuery = itemsQuery.eq('status', status);
    }

    if (search) {
      itemsQuery = itemsQuery.or(
        `material_sku_id.ilike.%${search}%`
      );
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;

    if (itemsError) {
      console.error('Error fetching production order items:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // ไม่กรอง production_order_items - แสดงทั้งหมดเพื่อให้เห็นประวัติการเบิก
    // replenishment_queue จะแสดงเป็นแถวแยกสำหรับ variance ที่ต้องเบิกเพิ่ม
    const packagingItems = itemsData || [];

    // Transform replenishment data (food materials)
    // ตรวจสอบ category/sub_category เพื่อกำหนด type ที่ถูกต้อง
    // - อาหาร: category='วัตถุดิบ' และ sub_category มีคำว่า 'อาหาร'
    // - packaging: category='ถุงบรรจุภัณฑ์' หรือไม่ใช่อาหาร
    const foodMaterials = (replenishmentData || []).map((task: any) => {
      const category = task.master_sku?.category || '';
      const subCategory = task.master_sku?.sub_category || '';
      const isFood = category === 'วัตถุดิบ' && subCategory.includes('อาหาร');
      
      return {
        type: isFood ? 'food' : 'packaging', // กำหนด type ตาม category จริง
        source: 'replenishment_queue', // ระบุแหล่งข้อมูล
        queue_id: task.queue_id,
        sku_id: task.sku_id,
        sku_name: task.master_sku?.sku_name || task.sku_id,
        uom: task.master_sku?.uom_base || 'ชิ้น',
        requested_qty: task.requested_qty,
        confirmed_qty: task.confirmed_qty || 0,
        from_location_id: task.from_location_id,
        from_location_zone: task.from_location?.zone || '',
        to_location_id: task.to_location_id || 'Repack',
        to_location_zone: task.to_location?.zone || 'Zone Repack',
        pallet_id: task.pallet_id,
        expiry_date: task.expiry_date,
        production_date: task.pallet_id ? palletDatesMap[task.pallet_id] || null : null,
        priority: task.priority,
        status: task.status,
        trigger_reference: task.trigger_reference,
        assigned_to: task.assigned_to,
        assigned_user: task.assigned_user,
        assigned_at: task.assigned_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        created_at: task.created_at,
        notes: task.notes,
      };
    });

    // Get unique packaging SKU IDs to fetch their stock locations
    const packagingSkuIds = [...new Set(packagingItems.map((item: any) => item.material_sku_id))];
    
    // Fetch stock locations for packaging materials
    let stockLocationsMap: Record<string, { location_id: string; zone: string; qty: number }[]> = {};
    
    if (packagingSkuIds.length > 0) {
      const { data: stockData } = await supabase
        .from('wms_inventory_balances')
        .select(`
          sku_id,
          location_id,
          total_piece_qty,
          reserved_piece_qty,
          master_location:location_id (location_id, zone, location_type)
        `)
        .in('sku_id', packagingSkuIds)
        .gt('total_piece_qty', 0)
        .not('location_id', 'in', '(Repack,Dispatch,Delivery-In-Progress,RCV,SHIP)')
        .order('total_piece_qty', { ascending: false });
      
      // Group by SKU
      (stockData || []).forEach((stock: any) => {
        const availableQty = Number(stock.total_piece_qty) - Number(stock.reserved_piece_qty || 0);
        if (availableQty > 0) {
          if (!stockLocationsMap[stock.sku_id]) {
            stockLocationsMap[stock.sku_id] = [];
          }
          stockLocationsMap[stock.sku_id].push({
            location_id: stock.location_id,
            zone: stock.master_location?.zone || '',
            qty: availableQty,
          });
        }
      });
    }

    // Transform packaging items - แสดงประวัติการเบิกทั้งหมด
    const packagingMaterials = packagingItems.map((item: any) => {
      // Get best stock location for this SKU (highest qty first)
      const stockLocations = stockLocationsMap[item.material_sku_id] || [];
      const bestLocation = stockLocations[0] || null;
      const issuedQty = Number(item.issued_qty) || 0;
      const requiredQty = Number(item.required_qty) || 0;
      const remainingQty = Number(item.remaining_qty) || requiredQty - issuedQty || 0;
      
      // กำหนด status ตามจำนวนที่เบิกไปแล้ว
      let displayStatus = item.status;
      if (issuedQty > 0 && remainingQty === 0) {
        displayStatus = 'completed'; // เบิกครบแล้ว
      } else if (issuedQty > 0 && remainingQty > 0) {
        displayStatus = 'partial'; // เบิกบางส่วน (ยังต้องเบิกเพิ่ม)
      }
      
      // กำหนด type ตาม category จริงของ SKU
      // - อาหาร: category='วัตถุดิบ' และ sub_category มีคำว่า 'อาหาร'
      // - packaging: category='ถุงบรรจุภัณฑ์' หรือไม่ใช่อาหาร
      const category = item.material_sku?.category || '';
      const subCategory = item.material_sku?.sub_category || '';
      const isFood = category === 'วัตถุดิบ' && (subCategory.includes('อาหาร') || subCategory.includes('แมว') || subCategory.includes('สุนัข'));
      
      return {
        type: isFood ? 'food' : 'packaging', // กำหนด type ตาม category จริง
        source: 'production_order_items', // ระบุแหล่งข้อมูล
        item_id: item.id,
        production_order_id: item.production_order_id,
        sku_id: item.material_sku_id,
        sku_name: item.material_sku?.sku_name || item.material_sku_id,
        uom: item.uom || item.material_sku?.uom_base || '',
        // แสดง issued_qty เป็นจำนวนที่เบิกไปแล้ว (สำหรับประวัติ)
        requested_qty: issuedQty, // จำนวนที่เบิกไปแล้ว
        total_required_qty: requiredQty, // จำนวนที่ต้องการทั้งหมด (สำหรับ reference)
        confirmed_qty: issuedQty, // จำนวนที่เบิกไปแล้ว
        remaining_qty: remainingQty, // จำนวนที่ยังต้องเบิกเพิ่ม
        from_location_id: bestLocation?.location_id || null,
        from_location_zone: bestLocation?.zone || '',
        available_stock_locations: stockLocations, // รายการโลเคชั่นทั้งหมดที่มีสต็อก
        to_location_id: 'Repack',
        to_location_zone: 'Zone Repack',
        pallet_id: null,
        expiry_date: null,
        priority: 5, // default priority
        status: displayStatus,
        trigger_reference: item.production_order?.production_no || '',
        assigned_to: null,
        assigned_user: null,
        assigned_at: null,
        started_at: null,
        completed_at: item.issued_date,
        created_at: item.created_at,
        notes: item.remarks,
      };
    });

    // Combine and sort by created_at
    const allMaterials = [...foodMaterials, ...packagingMaterials].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Apply pagination
    const totalCount = allMaterials.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedData = allMaterials.slice(from, to);

    // Calculate summary
    const summary = {
      total: allMaterials.length,
      pending: allMaterials.filter((m) => m.status === 'pending').length,
      assigned: allMaterials.filter((m) => m.status === 'assigned').length,
      in_progress: allMaterials.filter((m) => m.status === 'in_progress').length,
      completed: allMaterials.filter((m) => m.status === 'completed').length,
      partial: allMaterials.filter((m) => m.status === 'partial').length,
      cancelled: allMaterials.filter((m) => m.status === 'cancelled').length,
    };

    return NextResponse.json({
      data: paginatedData,
      totalCount,
      summary,
    });
  } catch (error: any) {
    console.error('Error in GET /api/production/material-requisition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch material requisition' },
      { status: 500 }
    );
  }
}
