import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type MoveType = 'putaway' | 'transfer' | 'replenishment' | 'adjustment';
export type MoveStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type MoveItemStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type MoveMethod = 'pallet' | 'sku';

export interface MoveHeader {
  move_id: number;
  move_no: string;
  move_type: MoveType;
  status: MoveStatus;
  priority: number;
  source_receive_id?: number | null;
  source_document?: string | null;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  requested_by?: number | null;
  assigned_to?: number | null;
  approved_by?: number | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MoveItem {
  move_item_id: number;
  move_id: number;
  receive_item_id?: number | null;
  sku_id: string;
  pallet_id?: string | null;
  pallet_id_external?: string | null;
  parent_pallet_id?: string | null;  // Original pallet when split during partial move
  new_pallet_id?: string | null;      // New pallet ID generated for partial move
  move_method: MoveMethod;
  status: MoveItemStatus;
  from_location_id?: string | null;
  to_location_id?: string | null;
  requested_pack_qty: number;
  requested_piece_qty: number;
  planned_pack_qty: number;
  planned_piece_qty: number;
  confirmed_pack_qty: number;
  confirmed_piece_qty: number;
  production_date?: string | null;
  expiry_date?: string | null;
  remarks?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MoveRecord extends MoveHeader {
  wms_move_items?: (MoveItem & {
    master_sku?: { sku_name: string | null; barcode: string | null } | null;
    from_location?: { location_name: string | null; location_code: string | null } | null;
    to_location?: { location_name: string | null; location_code: string | null } | null;
    receive_item?: {
      item_id: number;
      pallet_id?: string | null;
      sku_id: string;
      piece_quantity: number;
      pack_quantity: number;
    } | null;
  })[];
  from_warehouse?: { warehouse_name: string | null } | null;
  to_warehouse?: { warehouse_name: string | null } | null;
  requested_by_employee?: { first_name: string | null; last_name: string | null } | null;
  assigned_to_employee?: { first_name: string | null; last_name: string | null } | null;
  approved_by_employee?: { first_name: string | null; last_name: string | null } | null;
}

export interface MoveFilters {
  move_type?: MoveType;
  status?: MoveStatus;
  warehouse_id?: string;
  assigned_to?: number;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateMoveItemInput {
  receive_item_id?: number | null;
  sku_id: string;
  pallet_id?: string | null;
  pallet_id_external?: string | null;
  parent_pallet_id?: string | null;  // Track original pallet for partial moves
  new_pallet_id?: string | null;      // New pallet ID for partial moves
  move_method: MoveMethod;
  from_location_id?: string | null;
  to_location_id?: string | null;
  requested_pack_qty?: number;
  requested_piece_qty: number;
  confirmed_pack_qty?: number;
  confirmed_piece_qty?: number;
  production_date?: string | null;
  expiry_date?: string | null;
  remarks?: string | null;
  created_by?: number | null;
}

export interface CreateMovePayload {
  move_type: MoveType;
  status?: MoveStatus;
  priority?: number;
  source_receive_id?: number | null;
  source_document?: string | null;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  requested_by?: number | null;
  assigned_to?: number | null;
  approved_by?: number | null;
  scheduled_at?: string | null;
  notes?: string | null;
  created_by?: number | null;
  items: CreateMoveItemInput[];
}

const MOVE_SELECT = `
  *,
  wms_move_items (
    *,
    master_sku (sku_name, barcode),
    from_location:master_location!fk_move_items_from_location (location_name, location_code),
    to_location:master_location!fk_move_items_to_location (location_name, location_code),
    receive_item:wms_receive_items!fk_move_items_receive_item (item_id, pallet_id, sku_id, piece_quantity, pack_quantity)
  ),
  from_warehouse:master_warehouse!fk_wms_moves_from_wh (warehouse_name),
  to_warehouse:master_warehouse!fk_wms_moves_to_wh (warehouse_name),
  requested_by_employee:master_employee!fk_wms_moves_requested_by (first_name, last_name),
  assigned_to_employee:master_employee!fk_wms_moves_assigned_to (first_name, last_name),
  approved_by_employee:master_employee!fk_wms_moves_approved_by (first_name, last_name)
`;

class MoveService {
  private supabase = supabase;

  async generateMoveNo(): Promise<{ data: string | null; error: string | null }> {
    try {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = 'MV-' + year + month + '-';
      const pattern = prefix + '%';

      const { data, error } = await this.supabase
        .from('wms_moves')
        .select('move_no')
        .like('move_no', pattern)
        .order('move_no', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[MoveService] Failed to fetch latest move_no', error);
        return { data: null, error: error.message };
      }

      let running = 1;
      if (data && data.length > 0) {
        const last = data[0].move_no;
        const lastDash = last.lastIndexOf('-');
        const suffix = lastDash >= 0 ? last.slice(lastDash + 1) : '';
        const parsed = parseInt(suffix, 10);
        running = Number.isNaN(parsed) ? 1 : parsed + 1;
      }

      const moveNo = prefix + String(running).padStart(4, '0');
      return { data: moveNo, error: null };
    } catch (err) {
      console.error('[MoveService] generateMoveNo error', err);
      return { data: null, error: 'Failed to generate move number' };
    }
  }

  async getMoves(filters?: MoveFilters): Promise<{ data: MoveRecord[] | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('wms_moves')
        .select(MOVE_SELECT)
        .order('created_at', { ascending: false });

      if (filters?.move_type) {
        query = query.eq('move_type', filters.move_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.warehouse_id) {
        const warehouseFilter = 'from_warehouse_id.eq.' + filters.warehouse_id + ',to_warehouse_id.eq.' + filters.warehouse_id;
        query = query.or(warehouseFilter);
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.searchTerm) {
        const term = filters.searchTerm.trim();
        // Check if search term contains special characters that break PostgREST
        const hasSpecialChars = /[|,()\\]/.test(term);
        if (term.length > 0 && !hasSpecialChars) {
          const search = 'move_no.ilike.%' + term + '%,source_document.ilike.%' + term + '%';
          query = query.or(search);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('[MoveService] getMoves error', error);
        return { data: null, error: error.message };
      }

      return { data: data as MoveRecord[], error: null };
    } catch (err) {
      console.error('[MoveService] getMoves unexpected error', err);
      return { data: null, error: 'Failed to fetch move records' };
    }
  }

  async getMoveById(id: number): Promise<{ data: MoveRecord | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_moves')
        .select(MOVE_SELECT)
        .eq('move_id', id)
        .single();

      if (error) {
        console.error('[MoveService] getMoveById error', error);
        return { data: null, error: error.message };
      }

      return { data: data as MoveRecord, error: null };
    } catch (err) {
      console.error('[MoveService] getMoveById unexpected error', err);
      return { data: null, error: 'Failed to fetch move detail' };
    }
  }

  async createMove(payload: CreateMovePayload): Promise<{ data: MoveRecord | null; error: string | null }> {
    try {
      const generated = await this.generateMoveNo();
      if (!generated.data) {
        return { data: null, error: generated.error || 'Cannot generate move number' };
      }

      const moveNo = generated.data;

      // Fetch SKU pack sizes for calculating pack quantities
      const skuIds = [...new Set((payload.items || []).map(item => item.sku_id))];
      const { data: skuData } = await this.supabase
        .from('master_sku')
        .select('sku_id, qty_per_pack')
        .in('sku_id', skuIds);

      const skuPackSizeMap = new Map<string, number>();
      (skuData || []).forEach(sku => {
        skuPackSizeMap.set(sku.sku_id, (sku as any).qty_per_pack || 1);
      });

      const items = (payload.items || []).map((item) => {
        const packSize = skuPackSizeMap.get(item.sku_id) || 1;
        const requestedPieceQty = item.requested_piece_qty ?? 0;
        const plannedPackQty = packSize > 0 ? Math.floor(requestedPieceQty / packSize) : 0;

        return {
          receive_item_id: item.receive_item_id ?? null,
          sku_id: item.sku_id,
          pallet_id: item.pallet_id ?? null,
          pallet_id_external: item.pallet_id_external ?? null,
          parent_pallet_id: item.parent_pallet_id ?? null,
          new_pallet_id: item.new_pallet_id ?? null,
          move_method: item.move_method,
          from_location_id: item.from_location_id && item.from_location_id.trim() !== '' ? item.from_location_id : null,
          to_location_id: item.to_location_id && item.to_location_id.trim() !== '' ? item.to_location_id : null,
          requested_pack_qty: plannedPackQty,
          requested_piece_qty: requestedPieceQty,
          planned_pack_qty: plannedPackQty,
          planned_piece_qty: requestedPieceQty,
          confirmed_pack_qty: item.confirmed_pack_qty ?? 0,
          confirmed_piece_qty: item.confirmed_piece_qty ?? 0,
          production_date: item.production_date ?? null,
          expiry_date: item.expiry_date ?? null,
          remarks: item.remarks ?? null,
          created_by: payload.created_by ?? null,
        };
      });

      if (items.length === 0) {
        return { data: null, error: 'Move document requires at least one item' };
      }

      // Validate destination locations capacity before creating the move
      const locationPieceTotals = new Map<string, number>();
      for (const item of items) {
        const destinationId = item.to_location_id;
        const pieceQty = item.requested_piece_qty ?? 0;
        if (destinationId && pieceQty > 0) {
          locationPieceTotals.set(
            destinationId,
            (locationPieceTotals.get(destinationId) ?? 0) + pieceQty
          );
        }
      }

      for (const [locationId, totalPieceQty] of locationPieceTotals) {
        const validation = await this.validateDestinationLocation(locationId, totalPieceQty);
        if (validation.error) {
          return { data: null, error: validation.error };
        }
      }

      // First, create the move header
      const { data: moveData, error: moveError } = await this.supabase
        .from('wms_moves')
        .insert({
          move_no: moveNo,
          move_type: payload.move_type,
          status: payload.status ?? 'pending',
          priority: payload.priority ?? 50,
          source_receive_id: payload.source_receive_id ?? null,
          source_document: payload.source_document ?? null,
          from_warehouse_id: payload.from_warehouse_id ?? null,
          to_warehouse_id: payload.to_warehouse_id ?? null,
          requested_by: payload.requested_by ?? null,
          assigned_to: payload.assigned_to ?? null,
          approved_by: payload.approved_by ?? null,
          scheduled_at: payload.scheduled_at ?? null,
          notes: payload.notes ?? null,
          created_by: payload.created_by ?? null,
        })
        .select('move_id')
        .single();

      if (moveError) {
        console.error('[MoveService] createMove header error', moveError);
        return { data: null, error: moveError.message };
      }

      // Then, create the move items
      const itemsWithMoveId = items.map(item => ({
        ...item,
        move_id: moveData.move_id,
      }));

      const { error: itemsError } = await this.supabase
        .from('wms_move_items')
        .insert(itemsWithMoveId);

      if (itemsError) {
        console.error('[MoveService] createMove items error', itemsError);
        // Try to rollback the move header
        await this.supabase
          .from('wms_moves')
          .delete()
          .eq('move_id', moveData.move_id);
        return { data: null, error: itemsError.message };
      }

      // Finally, fetch the complete move record with items
      return await this.getMoveById(moveData.move_id);
    } catch (err) {
      console.error('[MoveService] createMove unexpected error', err);
      return { data: null, error: 'Failed to create move document' };
    }
  }

  async updateMove(id: number, payload: Partial<MoveHeader>): Promise<{ data: MoveRecord | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_moves')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('move_id', id)
        .select()
        .single();

      if (error) {
        console.error('[MoveService] updateMove error', error);
        return { data: null, error: error.message };
      }

      return await this.getMoveById(data.move_id);
    } catch (err) {
      console.error('[MoveService] updateMove unexpected error', err);
      return { data: null, error: 'Failed to update move record' };
    }
  }

  async updateMoveStatus(id: number, status: MoveStatus): Promise<{ data: MoveRecord | null; error: string | null }> {
    return this.updateMove(id, { status });
  }

  async updateMoveItemStatus(moveItemId: number, status: MoveItemStatus): Promise<{ data: any | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_move_items')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('move_item_id', moveItemId)
        .select('move_id')
        .single();

      if (error) {
        console.error('[MoveService] updateMoveItemStatus error', error);
        return { data: null, error: error.message };
      }

      // After updating item status, recalculate the header status
      if (data?.move_id) {
        await this.recalculateMoveHeaderStatus(data.move_id);
      }

      return { data, error: null };
    } catch (err) {
      console.error('[MoveService] updateMoveItemStatus unexpected error', err);
      return { data: null, error: 'Failed to update move item status' };
    }
  }

  async recalculateMoveHeaderStatus(moveId: number): Promise<{ data: any | null; error: string | null }> {
    try {
      const { data: items, error: itemsError } = await this.supabase
        .from('wms_move_items')
        .select('status')
        .eq('move_id', moveId);

      if (itemsError) {
        console.error('[MoveService] recalculateMoveHeaderStatus items error', itemsError);
        return { data: null, error: itemsError.message };
      }

      if (!items || items.length === 0) {
        return { data: null, error: 'No items found for this move' };
      }

      const statuses = items.map(item => item.status);
      let headerStatus: MoveStatus;

      if (statuses.every(status => status === 'completed')) {
        headerStatus = 'completed';
      } else if (statuses.some(status => status === 'in_progress')) {
        headerStatus = 'in_progress';
      } else if (statuses.some(status => status === 'assigned')) {
        headerStatus = 'pending';
      } else if (statuses.every(status => status === 'pending')) {
        headerStatus = 'pending';
      } else if (statuses.some(status => status === 'cancelled')) {
        headerStatus = 'pending';
      } else {
        headerStatus = 'pending';
      }

      const { data, error } = await this.supabase
        .from('wms_moves')
        .update({
          status: headerStatus,
          updated_at: new Date().toISOString()
        })
        .eq('move_id', moveId)
        .select()
        .single();

      if (error) {
        console.error('[MoveService] recalculateMoveHeaderStatus update error', error);
        return { data: null, error: error.message };
      }

      if (headerStatus === 'completed' && data?.source_receive_id) {
        await this.checkAndUpdateReceiveStatus(data.source_receive_id);
      }

      return { data, error: null };
    } catch (err) {
      console.error('[MoveService] recalculateMoveHeaderStatus unexpected error', err);
      return { data: null, error: 'Failed to recalculate move header status' };
    }
  }

  async recordInventoryMovement(moveItem: MoveItem, moveHeader: MoveHeader): Promise<{ data: any | null; error: string | null }> {
    try {
      if (moveItem.status !== 'completed') {
        return { data: null, error: 'Move item must be completed before recording inventory' };
      }

      const warehouseId = moveHeader.to_warehouse_id || moveHeader.from_warehouse_id;
      if (!warehouseId) {
        return { data: null, error: 'Warehouse ID is required' };
      }

      const packQty = moveItem.confirmed_pack_qty || moveItem.planned_pack_qty || 0;
      const pieceQty = moveItem.confirmed_piece_qty || moveItem.planned_piece_qty || 0;

      if (packQty === 0 && pieceQty === 0) {
        return { data: null, error: 'Quantity must be greater than zero' };
      }

      // ดึงข้อมูล production_date และ expiry_date จาก balance ต้นทาง (ถ้ามี)
      let productionDate = moveItem.production_date;
      let expiryDate = moveItem.expiry_date;

      // ดึงข้อมูล production_date และ expiry_date จาก balance ต้นทาง
      if (moveItem.from_location_id && !productionDate && !expiryDate) {
        // For partial pallet moves, use parent_pallet_id to find source balance
        const sourcePalletId = (moveItem as any).parent_pallet_id || moveItem.pallet_id;
        
        let query = this.supabase
          .from('wms_inventory_balances')
          .select('production_date, expiry_date, lot_no, pallet_id')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', moveItem.from_location_id)
          .eq('sku_id', moveItem.sku_id);

        // Handle null pallet_id
        if (sourcePalletId === null || sourcePalletId === undefined) {
          query = query.is('pallet_id', null);
        } else {
          query = query.eq('pallet_id', sourcePalletId);
        }

        const { data: sourceBalance } = await query.maybeSingle();

        if (sourceBalance) {
          productionDate = sourceBalance.production_date;
          expiryDate = sourceBalance.expiry_date;
        }
      }

      // ตรวจสอบสถานะโลเคชั่นปลายทางก่อนทำการย้าย
      if (moveItem.to_location_id) {
        const locationCheck = await this.validateDestinationLocation(moveItem.to_location_id, pieceQty);
        if (locationCheck.error) {
          return locationCheck;
        }
      }

      const ledgerRecords = [];

      // For partial pallet moves, use parent_pallet_id for OUT and new pallet_id for IN
      const outPalletId = (moveItem as any).parent_pallet_id || moveItem.pallet_id;
      const inPalletId = moveItem.pallet_id;

      if (moveItem.from_location_id) {
        ledgerRecords.push({
          movement_at: new Date().toISOString(),
          transaction_type: moveHeader.move_type,
          direction: 'out',
          move_item_id: moveItem.move_item_id,
          receive_item_id: moveItem.receive_item_id,
          warehouse_id: warehouseId,
          location_id: moveItem.from_location_id,
          sku_id: moveItem.sku_id,
          pallet_id: outPalletId,
          pallet_id_external: moveItem.pallet_id_external,
          production_date: productionDate,
          expiry_date: expiryDate,
          pack_qty: packQty,
          piece_qty: pieceQty,
          reference_no: moveHeader.move_no,
          remarks: moveItem.remarks,
          created_by: moveItem.created_by
        });
      }

      if (moveItem.to_location_id) {
        ledgerRecords.push({
          movement_at: new Date().toISOString(),
          transaction_type: moveHeader.move_type,
          direction: 'in',
          move_item_id: moveItem.move_item_id,
          receive_item_id: moveItem.receive_item_id,
          warehouse_id: warehouseId,
          location_id: moveItem.to_location_id,
          sku_id: moveItem.sku_id,
          pallet_id: inPalletId,
          pallet_id_external: moveItem.pallet_id_external,
          production_date: productionDate,
          expiry_date: expiryDate,
          pack_qty: packQty,
          piece_qty: pieceQty,
          reference_no: moveHeader.move_no,
          remarks: moveItem.remarks,
          created_by: moveItem.created_by
        });
      }

      if (ledgerRecords.length === 0) {
        return { data: null, error: 'No locations specified for inventory movement' };
      }

      const { error: ledgerError } = await this.supabase
        .from('wms_inventory_ledger')
        .insert(ledgerRecords);

      if (ledgerError) {
        console.error('[MoveService] recordInventoryMovement ledger error', ledgerError);
        return { data: null, error: ledgerError.message };
      }

      // Balance updates are now handled by the database trigger (sync_inventory_ledger_to_balance)
      // which automatically syncs from ledger to balance table
      // Location current_qty is also automatically synced by trigger (sync_location_qty_from_balance)
      // This ensures single source of truth and prevents duplicate updates

      return { data: { success: true }, error: null };
    } catch (err) {
      console.error('[MoveService] recordInventoryMovement unexpected error', err);
      return { data: null, error: 'Failed to record inventory movement' };
    }
  }

  async validateDestinationLocation(locationId: string, additionalPieceQty: number): Promise<{ data: any | null; error: string | null }> {
    try {
      // ตรวจสอบสถานะโลเคชั่น
      const { data: location, error: locationError } = await this.supabase
        .from('master_location')
        .select('*')
        .eq('location_id', locationId)
        .single();

      if (locationError) {
        return { data: null, error: `ไม่พบข้อมูลโลเคชั่น: ${locationError.message}` };
      }

      // ตรวจสอบว่าโลเคชั่น active หรือไม่
      if (location.active_status !== 'active') {
        return { data: null, error: `โลเคชั่น ${location.location_code} ไม่อยู่ในสถานะใช้งาน` };
      }

      // ตรวจสอบความจุจำนวนชิ้น
      const currentQty = location.current_qty || 0;
      const maxCapacityQty = location.max_capacity_qty || 0;
      
      if (maxCapacityQty > 0) {
        const newQty = currentQty + additionalPieceQty;
        if (newQty > maxCapacityQty) {
          return { 
            data: null, 
            error: `โลเคชั่น ${location.location_code} เกินความจุ (จำนวนชิ้น): ความจุ ${maxCapacityQty.toLocaleString()} ชิ้น, ปัจจุบัน ${currentQty.toLocaleString()} ชิ้น, จะเพิ่ม ${additionalPieceQty.toLocaleString()} ชิ้น` 
          };
        }
      }

      // ตรวจสอบความจุน้ำหนัก (ถ้ามีข้อมูลน้ำหนักสินค้า)
      // Note: ในอนาคตควรดึงข้อมูลน้ำหนักสินค้าจากตาราง master_sku เพื่อคำนวณ
      const currentWeight = location.current_weight_kg || 0;
      const maxCapacityWeight = location.max_capacity_weight_kg || 0;
      
      if (maxCapacityWeight > 0) {
        // ประมาณการน้ำหนักเพิ่มเติม (สมมติว่าน้ำหนักเฉลี่ยต่อชิ้นประมาณ 0.5 กก.)
        // ควรปรับปรุงให้ดึงข้อมูลจริงจาก master_sku.weight_kg
        const estimatedAdditionalWeight = additionalPieceQty * 0.5;
        const newWeight = currentWeight + estimatedAdditionalWeight;
        
        if (newWeight > maxCapacityWeight) {
          return { 
            data: null, 
            error: `โลเคชั่น ${location.location_code} เกินความจุ (น้ำหนัก): ความจุ ${maxCapacityWeight.toLocaleString()} กก., ปัจจุบัน ${currentWeight.toLocaleString()} กก., จะเพิ่มประมาณ ${estimatedAdditionalWeight.toLocaleString()} กก.` 
          };
        }
      }

      return { data: { location, isValid: true }, error: null };
    } catch (err) {
      console.error('[MoveService] validateDestinationLocation error', err);
      return { data: null, error: 'Failed to validate destination location' };
    }
  }

  async updateLocationCurrentData(locationId: string, pieceQtyDelta: number, packQtyDelta: number = 0): Promise<{ data: any | null; error: string | null }> {
    try {
      // ดึงข้อมูลปัจจุบันก่อน
      const { data: currentData, error: fetchError } = await this.supabase
        .from('master_location')
        .select('current_qty, current_weight_kg')
        .eq('location_id', locationId)
        .single();

      if (fetchError) {
        return { data: null, error: `Failed to fetch location current data: ${fetchError.message}` };
      }

      const newCurrentQty = Math.max(0, (currentData.current_qty || 0) + pieceQtyDelta);
      
      // ประมาณการน้ำหนักเพิ่มเติม (สมมติว่าน้ำหนักเฉลี่ยต่อชิ้นประมาณ 0.5 กก.)
      // ควรปรับปรุงให้ดึงข้อมูลจริงจาก master_sku.weight_kg
      const estimatedWeightDelta = pieceQtyDelta * 0.5;
      const newCurrentWeight = Math.max(0, (currentData.current_weight_kg || 0) + estimatedWeightDelta);

      const { data, error } = await this.supabase
        .from('master_location')
        .update({
          current_qty: newCurrentQty,
          current_weight_kg: newCurrentWeight,
          updated_at: new Date().toISOString()
        })
        .eq('location_id', locationId)
        .select()
        .single();

      if (error) {
        console.error('[MoveService] updateLocationCurrentData error', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err) {
      console.error('[MoveService] updateLocationCurrentData unexpected error', err);
      return { data: null, error: 'Failed to update location current data' };
    }
  }

  async updateInventoryBalance(
    warehouseId: string,
    locationId: string,
    skuId: string,
    palletId: string | null,
    palletIdExternal: string | null,
    productionDate: string | null,
    expiryDate: string | null,
    packQtyDelta: number,
    pieceQtyDelta: number,
    moveId: number
  ): Promise<{ data: any | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .eq('location_id', locationId)
        .eq('sku_id', skuId);

      if (palletId === null) {
        query = query.is('pallet_id', null);
      } else {
        query = query.eq('pallet_id', palletId);
      }

      if (palletIdExternal === null) {
        query = query.is('pallet_id_external', null);
      } else {
        query = query.eq('pallet_id_external', palletIdExternal);
      }

      const { data: existing, error: selectError } = await query.maybeSingle();

      if (selectError) {
        console.error('[MoveService] updateInventoryBalance select error', selectError);
        return { data: null, error: selectError.message };
      }

      if (existing) {
        const newPackQty = (existing.total_pack_qty || 0) + packQtyDelta;
        const newPieceQty = (existing.total_piece_qty || 0) + pieceQtyDelta;

        if (newPackQty < 0 || newPieceQty < 0) {
          return { data: null, error: 'Insufficient inventory balance' };
        }

        const { error: updateError } = await this.supabase
          .from('wms_inventory_balances')
          .update({
            total_pack_qty: newPackQty,
            total_piece_qty: newPieceQty,
            last_move_id: moveId,
            last_movement_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', existing.balance_id);

        if (updateError) {
          console.error('[MoveService] updateInventoryBalance update error', updateError);
          return { data: null, error: updateError.message };
        }
      } else {
        if (packQtyDelta < 0 || pieceQtyDelta < 0) {
          let nullLocQuery = this.supabase
            .from('wms_inventory_balances')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .is('location_id', null)
            .eq('sku_id', skuId);

          if (palletId === null) {
            nullLocQuery = nullLocQuery.is('pallet_id', null);
          } else {
            nullLocQuery = nullLocQuery.eq('pallet_id', palletId);
          }

          const { data: nullLocBalance } = await nullLocQuery.maybeSingle();

          if (nullLocBalance) {
            const newPackQty = (nullLocBalance.total_pack_qty || 0) + packQtyDelta;
            const newPieceQty = (nullLocBalance.total_piece_qty || 0) + pieceQtyDelta;

            if (newPackQty < 0 || newPieceQty < 0) {
              return { data: null, error: 'Insufficient inventory at null location' };
            }

            if (newPackQty === 0 && newPieceQty === 0) {
              await this.supabase
                .from('wms_inventory_balances')
                .delete()
                .eq('balance_id', nullLocBalance.balance_id);
            } else {
              await this.supabase
                .from('wms_inventory_balances')
                .update({
                  total_pack_qty: newPackQty,
                  total_piece_qty: newPieceQty,
                  last_move_id: moveId,
                  last_movement_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('balance_id', nullLocBalance.balance_id);
            }
            return { data: { success: true }, error: null };
          }

          return { data: null, error: 'Cannot create negative inventory balance' };
        }

        let queryForOldBalance = this.supabase
          .from('wms_inventory_balances')
          .select(`
            *,
            master_location (location_type)
          `)
          .eq('warehouse_id', warehouseId)
          .eq('sku_id', skuId);

        if (palletId) {
          queryForOldBalance = queryForOldBalance.eq('pallet_id', palletId);
        }

        const { data: oldBalances } = await queryForOldBalance;

        if (oldBalances && packQtyDelta > 0) {
          for (const oldBalance of oldBalances) {
            if (!oldBalance.location_id || oldBalance.master_location?.location_type === 'receiving') {
              await this.supabase
                .from('wms_inventory_balances')
                .delete()
                .eq('balance_id', oldBalance.balance_id);
            }
          }
        }

        const { error: insertError } = await this.supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: warehouseId,
            location_id: locationId,
            sku_id: skuId,
            pallet_id: palletId,
            pallet_id_external: palletIdExternal,
            production_date: productionDate,
            expiry_date: expiryDate,
            total_pack_qty: packQtyDelta,
            total_piece_qty: pieceQtyDelta,
            last_move_id: moveId,
            last_movement_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('[MoveService] updateInventoryBalance insert error', insertError);
          return { data: null, error: insertError.message };
        }
      }

      return { data: { success: true }, error: null };
    } catch (err) {
      console.error('[MoveService] updateInventoryBalance unexpected error', err);
      return { data: null, error: 'Failed to update inventory balance' };
    }
  }

  async checkAndUpdateReceiveStatus(receiveId: number): Promise<void> {
    try {
      const { data: receiveItems, error: itemsError } = await this.supabase
        .from('wms_receive_items')
        .select('item_id, pallet_id')
        .eq('receive_id', receiveId);

      if (itemsError || !receiveItems || receiveItems.length === 0) {
        console.error('[MoveService] checkAndUpdateReceiveStatus items error', itemsError);
        return;
      }

      const { data: balances, error: balancesError } = await this.supabase
        .from('wms_inventory_balances')
        .select(`
          *,
          master_location!inner(location_type)
        `)
        .in('pallet_id', receiveItems.map(item => item.pallet_id).filter(Boolean));

      if (balancesError) {
        console.error('[MoveService] checkAndUpdateReceiveStatus balances error', balancesError);
        return;
      }

      const hasItemsInRCV = balances?.some(
        balance => balance.master_location?.location_type === 'receiving' &&
        (balance.total_pack_qty > 0 || balance.total_piece_qty > 0)
      );

      if (!hasItemsInRCV) {
        const { error: updateError } = await this.supabase
          .from('wms_receives')
          .update({
            status: 'สำเร็จ',
            updated_at: new Date().toISOString()
          })
          .eq('receive_id', receiveId)
          .neq('status', 'สำเร็จ');

        if (updateError) {
          console.error('[MoveService] checkAndUpdateReceiveStatus update error', updateError);
        } else {
          console.log(`[MoveService] Updated receive ${receiveId} status to สำเร็จ`);
        }
      }
    } catch (err) {
      console.error('[MoveService] checkAndUpdateReceiveStatus unexpected error', err);
    }
  }
}

export const moveService = new MoveService();
