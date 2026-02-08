// Stock Adjustment Service Layer
import { createServiceRoleClient } from '@/lib/supabase/server';
import { executeStockMovements, type StockMovement } from '@/lib/database/inventory-transaction';
import type {
  AdjustmentRecord,
  AdjustmentReason,
  CreateAdjustmentPayload,
  UpdateAdjustmentPayload,
  AdjustmentFilters,
  AdjustmentStatus,
  StockAdjustmentItem,
} from '@/types/stock-adjustment-schema';

// Use service role client for admin operations (bypasses RLS)
// This is intentional for stock adjustment operations that need full access
const supabase = createServiceRoleClient();

const ADJUSTMENT_SELECT = `
  *,
  reason:wms_adjustment_reasons!reason_id (
    reason_id,
    reason_code,
    reason_name_th,
    reason_name_en,
    reason_type,
    requires_approval
  ),
  warehouse:master_warehouse!warehouse_id (warehouse_name),
  created_by_user:master_system_user!created_by (full_name),
  approved_by_user:master_system_user!approved_by (full_name),
  completed_by_user:master_system_user!completed_by (full_name),
  wms_stock_adjustment_items (
    *,
    master_sku!sku_id (sku_name, barcode, qty_per_pack),
    master_location!location_id (location_name, location_code)
  )
`;

class StockAdjustmentService {
  private supabase = supabase;

  /**
   * Generate adjustment number in format: ADJ-YYYYMM-XXXX
   */
  async generateAdjustmentNo(): Promise<{ data: string | null; error: string | null }> {
    try {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = `ADJ-${year}${month}-`;
      const pattern = `${prefix}%`;

      const { data, error } = await this.supabase
        .from('wms_stock_adjustments')
        .select('adjustment_no')
        .like('adjustment_no', pattern)
        .order('adjustment_no', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[StockAdjustmentService] Failed to fetch latest adjustment_no', error);
        return { data: null, error: error.message };
      }

      let running = 1;
      if (data && data.length > 0) {
        const last = data[0].adjustment_no;
        const lastDash = last.lastIndexOf('-');
        const suffix = lastDash >= 0 ? last.slice(lastDash + 1) : '';
        const parsed = parseInt(suffix, 10);
        running = Number.isNaN(parsed) ? 1 : parsed + 1;
      }

      const adjustmentNo = prefix + String(running).padStart(4, '0');
      return { data: adjustmentNo, error: null };
    } catch (err) {
      console.error('[StockAdjustmentService] generateAdjustmentNo error', err);
      return { data: null, error: 'Failed to generate adjustment number' };
    }
  }

  /**
   * Get list of adjustments with optional filters
   */
  async getAdjustments(filters?: AdjustmentFilters): Promise<{ data: AdjustmentRecord[] | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('wms_stock_adjustments')
        .select(ADJUSTMENT_SELECT)
        .order('created_at', { ascending: false });

      if (filters?.adjustment_type) {
        query = query.eq('adjustment_type', filters.adjustment_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id);
      }
      if (filters?.startDate) {
        query = query.gte('adjustment_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('adjustment_date', filters.endDate);
      }
      if (filters?.searchTerm) {
        const term = filters.searchTerm.trim();
        // Check if search term contains special characters that break PostgREST
        const hasSpecialChars = /[|,()\\]/.test(term);
        if (term.length > 0 && !hasSpecialChars) {
          query = query.or(`adjustment_no.ilike.%${term}%,reference_no.ilike.%${term}%`);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('[StockAdjustmentService] getAdjustments error', error);
        return { data: null, error: error.message };
      }

      return { data: data as AdjustmentRecord[], error: null };
    } catch (err) {
      console.error('[StockAdjustmentService] getAdjustments unexpected error', err);
      return { data: null, error: 'Failed to fetch adjustment records' };
    }
  }

  /**
   * Get single adjustment by ID
   */
  async getAdjustmentById(id: number): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_stock_adjustments')
        .select(ADJUSTMENT_SELECT)
        .eq('adjustment_id', id)
        .single();

      if (error) {
        console.error('[StockAdjustmentService] getAdjustmentById error', error);
        return { data: null, error: error.message };
      }

      return { data: data as AdjustmentRecord, error: null };
    } catch (err) {
      console.error('[StockAdjustmentService] getAdjustmentById unexpected error', err);
      return { data: null, error: 'Failed to fetch adjustment detail' };
    }
  }

  /**
   * Create new adjustment (draft status)
   */
  async createAdjustment(payload: CreateAdjustmentPayload): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      // Generate adjustment number
      const generated = await this.generateAdjustmentNo();
      if (!generated.data) {
        return { data: null, error: generated.error || 'Cannot generate adjustment number' };
      }

      const adjustmentNo = generated.data;

      // Validate items
      if (!payload.items || payload.items.length === 0) {
        return { data: null, error: 'At least one item is required' };
      }

      // Fetch SKU pack sizes and current balances
      const skuIds = [...new Set(payload.items.map(item => item.sku_id))];
      const { data: skuData } = await this.supabase
        .from('master_sku')
        .select('sku_id, qty_per_pack')
        .in('sku_id', skuIds);

      const skuPackSizeMap = new Map<string, number>();
      (skuData || []).forEach(sku => {
        skuPackSizeMap.set(sku.sku_id, (sku as any).qty_per_pack || 1);
      });

      // Validate reserved stock for decrease adjustments
      if (payload.adjustment_type === 'decrease') {
        const validation = await this.validateReservedStock(payload.warehouse_id, payload.items as any);
        if (validation.error) {
          return { data: null, error: validation.error };
        }
      }

      // Prepare items with before/after quantities
      const itemsWithQuantities = await Promise.all(
        payload.items.map(async (item, index) => {
          const packSize = skuPackSizeMap.get(item.sku_id) || 1;
          
          // Get current balance - try exact match first
          // Include production_date and expiry_date for sync trigger matching
          let balanceQuery = this.supabase
            .from('wms_inventory_balances')
            .select('total_pack_qty, total_piece_qty, production_date, expiry_date, pallet_id_external')
            .eq('warehouse_id', payload.warehouse_id)
            .eq('location_id', item.location_id)
            .eq('sku_id', item.sku_id);

          if (item.pallet_id) {
            balanceQuery = balanceQuery.eq('pallet_id', item.pallet_id);
          } else {
            balanceQuery = balanceQuery.is('pallet_id', null);
          }

          let { data: balance } = await balanceQuery.maybeSingle();

          // If not found with pallet_id=null, try without pallet filter (for picking locations like PK001)
          if (!balance && !item.pallet_id) {
            const { data: aggregatedBalance } = await this.supabase
              .from('wms_inventory_balances')
              .select('total_pack_qty, total_piece_qty, production_date, expiry_date, pallet_id_external')
              .eq('warehouse_id', payload.warehouse_id)
              .eq('location_id', item.location_id)
              .eq('sku_id', item.sku_id)
              .maybeSingle();
            
            balance = aggregatedBalance;
          }

          const beforePackQty = Number(balance?.total_pack_qty) || 0;
          const beforePieceQty = Number(balance?.total_piece_qty) || 0;

          const adjustmentPieceQty = item.adjustment_piece_qty;
          const adjustmentPackQty = packSize > 0 ? Math.floor(Math.abs(adjustmentPieceQty) / packSize) : 0;

          const afterPieceQty = beforePieceQty + adjustmentPieceQty;
          const afterPackQty = packSize > 0 ? Math.floor(afterPieceQty / packSize) : 0;

          // Use dates from balance if not provided by caller (for sync trigger matching)
          const productionDate = item.production_date || (balance as any)?.production_date || null;
          const expiryDate = item.expiry_date || (balance as any)?.expiry_date || null;
          const palletIdExternal = item.pallet_id_external || (balance as any)?.pallet_id_external || null;

          return {
            line_no: index + 1,
            sku_id: item.sku_id,
            location_id: item.location_id,
            pallet_id: item.pallet_id || null,
            pallet_id_external: palletIdExternal,
            lot_no: item.lot_no || null,
            production_date: productionDate,
            expiry_date: expiryDate,
            before_pack_qty: beforePackQty,
            before_piece_qty: beforePieceQty,
            adjustment_pack_qty: payload.adjustment_type === 'decrease' ? -adjustmentPackQty : adjustmentPackQty,
            adjustment_piece_qty: adjustmentPieceQty,
            after_pack_qty: afterPackQty,
            after_piece_qty: afterPieceQty,
            remarks: item.remarks || null,
          };
        })
      );

      // Create adjustment header
      const { data: adjustmentData, error: adjustmentError } = await this.supabase
        .from('wms_stock_adjustments')
        .insert({
          adjustment_no: adjustmentNo,
          adjustment_type: payload.adjustment_type,
          status: 'draft',
          warehouse_id: payload.warehouse_id,
          reason_id: payload.reason_id,
          adjustment_date: new Date().toISOString(),
          reference_no: payload.reference_no || null,
          remarks: payload.remarks || null,
          created_by: payload.created_by || null,
        })
        .select('adjustment_id')
        .single();

      if (adjustmentError) {
        console.error('[StockAdjustmentService] createAdjustment header error', adjustmentError);
        return { data: null, error: adjustmentError.message };
      }

      // Create adjustment items
      const itemsWithAdjustmentId = itemsWithQuantities.map(item => ({
        ...item,
        adjustment_id: adjustmentData.adjustment_id,
      }));

      const { error: itemsError } = await this.supabase
        .from('wms_stock_adjustment_items')
        .insert(itemsWithAdjustmentId);

      if (itemsError) {
        console.error('[StockAdjustmentService] createAdjustment items error', itemsError);
        // Rollback header
        await this.supabase
          .from('wms_stock_adjustments')
          .delete()
          .eq('adjustment_id', adjustmentData.adjustment_id);
        return { data: null, error: itemsError.message };
      }

      // Fetch complete record
      return await this.getAdjustmentById(adjustmentData.adjustment_id);
    } catch (err) {
      console.error('[StockAdjustmentService] createAdjustment unexpected error', err);
      return { data: null, error: 'Failed to create adjustment' };
    }
  }

  /**
   * Update adjustment (only draft status)
   */
  async updateAdjustment(id: number, payload: UpdateAdjustmentPayload): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      // Check if adjustment is in draft status
      const { data: existing } = await this.getAdjustmentById(id);
      if (!existing) {
        return { data: null, error: 'Adjustment not found' };
      }
      if (existing.status !== 'draft') {
        return { data: null, error: 'Only draft adjustments can be edited' };
      }

      // Update header
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (payload.reason_id !== undefined) updateData.reason_id = payload.reason_id;
      if (payload.reference_no !== undefined) updateData.reference_no = payload.reference_no;
      if (payload.remarks !== undefined) updateData.remarks = payload.remarks;

      const { error: updateError } = await this.supabase
        .from('wms_stock_adjustments')
        .update(updateData)
        .eq('adjustment_id', id);

      if (updateError) {
        console.error('[StockAdjustmentService] updateAdjustment error', updateError);
        return { data: null, error: updateError.message };
      }

      // Update items if provided
      if (payload.items) {
        // Delete existing items
        await this.supabase
          .from('wms_stock_adjustment_items')
          .delete()
          .eq('adjustment_id', id);

        // Re-create items (similar to create logic)
        // ... (implement similar to createAdjustment)
      }

      return await this.getAdjustmentById(id);
    } catch (err) {
      console.error('[StockAdjustmentService] updateAdjustment unexpected error', err);
      return { data: null, error: 'Failed to update adjustment' };
    }
  }

  /**
   * Submit adjustment for approval
   */
  async submitForApproval(id: number, userId: number): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      const { data: existing } = await this.getAdjustmentById(id);
      if (!existing) {
        return { data: null, error: 'Adjustment not found' };
      }
      if (existing.status !== 'draft') {
        return { data: null, error: 'Only draft adjustments can be submitted' };
      }

      const { error } = await this.supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'pending_approval',
          updated_at: new Date().toISOString(),
        })
        .eq('adjustment_id', id);

      if (error) {
        console.error('[StockAdjustmentService] submitForApproval error', error);
        return { data: null, error: error.message };
      }

      return await this.getAdjustmentById(id);
    } catch (err) {
      console.error('[StockAdjustmentService] submitForApproval unexpected error', err);
      return { data: null, error: 'Failed to submit adjustment' };
    }
  }

  /**
   * Approve adjustment
   */
  async approveAdjustment(id: number, userId: number): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      const { data: existing } = await this.getAdjustmentById(id);
      if (!existing) {
        return { data: null, error: 'Adjustment not found' };
      }
      if (existing.status !== 'pending_approval') {
        return { data: null, error: 'Only pending adjustments can be approved' };
      }

      const { error } = await this.supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('adjustment_id', id);

      if (error) {
        console.error('[StockAdjustmentService] approveAdjustment error', error);
        return { data: null, error: error.message };
      }

      return await this.getAdjustmentById(id);
    } catch (err) {
      console.error('[StockAdjustmentService] approveAdjustment unexpected error', err);
      return { data: null, error: 'Failed to approve adjustment' };
    }
  }

  /**
   * Reject adjustment
   */
  async rejectAdjustment(id: number, userId: number, reason: string): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      const { data: existing } = await this.getAdjustmentById(id);
      if (!existing) {
        return { data: null, error: 'Adjustment not found' };
      }
      if (existing.status !== 'pending_approval') {
        return { data: null, error: 'Only pending adjustments can be rejected' };
      }

      const { error } = await this.supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'rejected',
          remarks: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('adjustment_id', id);

      if (error) {
        console.error('[StockAdjustmentService] rejectAdjustment error', error);
        return { data: null, error: error.message };
      }

      return await this.getAdjustmentById(id);
    } catch (err) {
      console.error('[StockAdjustmentService] rejectAdjustment unexpected error', err);
      return { data: null, error: 'Failed to reject adjustment' };
    }
  }

  /**
   * Complete adjustment - record to ledger (single-entry)
   */
  async completeAdjustment(id: number, userId: number): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      const { data: existing } = await this.getAdjustmentById(id);
      if (!existing) {
        return { data: null, error: 'Adjustment not found' };
      }
      if (existing.status !== 'approved') {
        return { data: null, error: 'Only approved adjustments can be completed' };
      }

      // Validate reserved stock again before completion
      if (existing.adjustment_type === 'decrease' && existing.wms_stock_adjustment_items) {
        const validation = await this.validateReservedStock(
          existing.warehouse_id,
          existing.wms_stock_adjustment_items.map(item => ({
            sku_id: item.sku_id,
            location_id: item.location_id,
            pallet_id: item.pallet_id,
            adjustment_piece_qty: item.adjustment_piece_qty,
          }))
        );
        if (validation.error) {
          return { data: null, error: validation.error };
        }
      }

      // Record to ledger (single-entry pattern) - pass userId directly
      const recordResult = await this.recordAdjustmentToLedger(existing, userId);
      if (recordResult.error) {
        return { data: null, error: recordResult.error };
      }

      // Update adjustment status
      const { error } = await this.supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'completed',
          completed_by: userId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('adjustment_id', id);

      if (error) {
        console.error('[StockAdjustmentService] completeAdjustment error', error);
        return { data: null, error: error.message };
      }

      return await this.getAdjustmentById(id);
    } catch (err) {
      console.error('[StockAdjustmentService] completeAdjustment unexpected error', err);
      return { data: null, error: 'Failed to complete adjustment' };
    }
  }

  /**
   * Cancel adjustment
   */
  async cancelAdjustment(id: number, userId: number, reason: string): Promise<{ data: AdjustmentRecord | null; error: string | null }> {
    try {
      const { data: existing } = await this.getAdjustmentById(id);
      if (!existing) {
        return { data: null, error: 'Adjustment not found' };
      }
      if (existing.status === 'completed') {
        return { data: null, error: 'Completed adjustments cannot be cancelled' };
      }

      const { error } = await this.supabase
        .from('wms_stock_adjustments')
        .update({
          status: 'cancelled',
          remarks: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('adjustment_id', id);

      if (error) {
        console.error('[StockAdjustmentService] cancelAdjustment error', error);
        return { data: null, error: error.message };
      }

      return await this.getAdjustmentById(id);
    } catch (err) {
      console.error('[StockAdjustmentService] cancelAdjustment unexpected error', err);
      return { data: null, error: 'Failed to cancel adjustment' };
    }
  }

  /**
   * Validate reserved stock before decrease adjustment
   * For picking locations (like PK001), inventory is aggregated without pallet_id
   */
  async validateReservedStock(
    warehouseId: string,
    items: Array<{ sku_id: string; location_id: string; pallet_id?: string | null; adjustment_piece_qty: number }>
  ): Promise<{ data: any | null; error: string | null }> {
    try {
      for (const item of items) {
        if (item.adjustment_piece_qty >= 0) continue; // Skip increase adjustments

        // First try exact match with pallet_id
        let balanceQuery = this.supabase
          .from('wms_inventory_balances')
          .select('total_piece_qty, reserved_piece_qty')
          .eq('warehouse_id', warehouseId)
          .eq('location_id', item.location_id)
          .eq('sku_id', item.sku_id);

        if (item.pallet_id) {
          balanceQuery = balanceQuery.eq('pallet_id', item.pallet_id);
        } else {
          balanceQuery = balanceQuery.is('pallet_id', null);
        }

        let { data: balance } = await balanceQuery.maybeSingle();

        // If not found with pallet_id=null, try without pallet filter (for picking locations)
        if (!balance && !item.pallet_id) {
          const { data: aggregatedBalance } = await this.supabase
            .from('wms_inventory_balances')
            .select('total_piece_qty, reserved_piece_qty')
            .eq('warehouse_id', warehouseId)
            .eq('location_id', item.location_id)
            .eq('sku_id', item.sku_id)
            .maybeSingle();
          
          balance = aggregatedBalance;
        }

        if (!balance) {
          return {
            data: null,
            error: `No inventory found for SKU ${item.sku_id} at location ${item.location_id}`,
          };
        }

        const totalQty = Number(balance.total_piece_qty) || 0;
        const reservedQty = Number(balance.reserved_piece_qty) || 0;
        const availableQty = totalQty - reservedQty;
        const requestedQty = Math.abs(item.adjustment_piece_qty);

        if (requestedQty > availableQty) {
          return {
            data: null,
            error: `Cannot adjust SKU ${item.sku_id}: Requested ${requestedQty} pieces but only ${availableQty} available (${reservedQty} reserved)`,
          };
        }
      }

      return { data: { valid: true }, error: null };
    } catch (err) {
      console.error('[StockAdjustmentService] validateReservedStock unexpected error', err);
      return { data: null, error: 'Failed to validate reserved stock' };
    }
  }

  /**
   * Record adjustment to inventory ledger (double-entry pattern for decrease)
   * - Decrease: OUT from source location + IN to ADJ-LOSS
   * - Increase: IN to target location (single entry)
   * @param adjustment - The adjustment record
   * @param userId - The user ID who is completing the adjustment (used for created_by)
   */
  async recordAdjustmentToLedger(adjustment: AdjustmentRecord, userId: number): Promise<{ data: any | null; error: string | null }> {
    try {
      if (!adjustment.wms_stock_adjustment_items || adjustment.wms_stock_adjustment_items.length === 0) {
        return { data: null, error: 'No items to record' };
      }

      const ADJ_LOSS_LOCATION = 'LOC-ADJ-LOSS-001'; // Virtual location for stock loss/adjustment
      const ledgerRecords: any[] = [];

      adjustment.wms_stock_adjustment_items.forEach(item => {
        const packQty = Math.abs(item.adjustment_pack_qty);
        const pieceQty = Math.abs(item.adjustment_piece_qty);
        const movementAt = new Date().toISOString();

        if (adjustment.adjustment_type === 'increase') {
          // Increase: Single entry - IN to target location
          ledgerRecords.push({
            movement_at: movementAt,
            transaction_type: 'adjustment',
            direction: 'in',
            warehouse_id: adjustment.warehouse_id,
            location_id: item.location_id,
            sku_id: item.sku_id,
            pallet_id: item.pallet_id,
            pallet_id_external: item.pallet_id_external,
            production_date: item.production_date,
            expiry_date: item.expiry_date,
            pack_qty: packQty,
            piece_qty: pieceQty,
            reference_no: adjustment.adjustment_no,
            reference_doc_type: 'adjustment',
            reference_doc_id: adjustment.adjustment_id,
            remarks: item.remarks || adjustment.remarks,
            created_by: userId,
          });
        } else {
          // Decrease: Double entry
          // 1. OUT from source location
          ledgerRecords.push({
            movement_at: movementAt,
            transaction_type: 'adjustment',
            direction: 'out',
            warehouse_id: adjustment.warehouse_id,
            location_id: item.location_id,
            sku_id: item.sku_id,
            pallet_id: item.pallet_id,
            pallet_id_external: item.pallet_id_external,
            production_date: item.production_date,
            expiry_date: item.expiry_date,
            pack_qty: packQty,
            piece_qty: pieceQty,
            reference_no: adjustment.adjustment_no,
            reference_doc_type: 'adjustment',
            reference_doc_id: adjustment.adjustment_id,
            remarks: `ลดสต็อกจาก ${item.location_id}: ${item.remarks || adjustment.remarks || ''}`.trim(),
            created_by: userId,
          });

          // 2. IN to ADJ-LOSS location (virtual location for tracking losses)
          ledgerRecords.push({
            movement_at: movementAt,
            transaction_type: 'adjustment',
            direction: 'in',
            warehouse_id: adjustment.warehouse_id,
            location_id: ADJ_LOSS_LOCATION,
            sku_id: item.sku_id,
            pallet_id: null, // No pallet for ADJ-LOSS
            pallet_id_external: null,
            production_date: item.production_date,
            expiry_date: item.expiry_date,
            pack_qty: packQty,
            piece_qty: pieceQty,
            reference_no: adjustment.adjustment_no,
            reference_doc_type: 'adjustment',
            reference_doc_id: adjustment.adjustment_id,
            remarks: `รับจาก ${item.location_id}: ${item.remarks || adjustment.remarks || ''}`.trim(),
            created_by: userId,
          });
        }
      });

      // Atomic: Insert ledger entries + update balances via RPC (no trigger dependency)
      const movements: StockMovement[] = ledgerRecords.map(r => ({
        ...r,
        reference_doc_id: r.reference_doc_id,
      }));

      const result = await executeStockMovements(movements);

      if (!result.success) {
        console.error('[StockAdjustmentService] recordAdjustmentToLedger RPC error', result.error);
        return { data: null, error: result.error || 'Failed to record adjustment' };
      }

      // Update adjustment items with ledger_id (use first ledger entry for each item)
      if (result.entries && result.entries.length > 0) {
        const items = adjustment.wms_stock_adjustment_items;
        for (let i = 0; i < items.length; i++) {
          // For decrease, we have 2 entries per item, so index is i*2
          // For increase, we have 1 entry per item, so index is i
          const ledgerIndex = adjustment.adjustment_type === 'decrease' ? i * 2 : i;
          const ledgerId = result.entries[ledgerIndex]?.ledger_id;
          const itemId = items[i].adjustment_item_id;

          if (ledgerId) {
            await this.supabase
              .from('wms_stock_adjustment_items')
              .update({ ledger_id: ledgerId })
              .eq('adjustment_item_id', itemId);
          }
        }
      }

      return { data: { success: true }, error: null };
    } catch (err) {
      console.error('[StockAdjustmentService] recordAdjustmentToLedger unexpected error', err);
      return { data: null, error: 'Failed to record adjustment to ledger' };
    }
  }

  /**
   * Get adjustment reasons
   */
  async getAdjustmentReasons(activeOnly: boolean = true): Promise<{ data: AdjustmentReason[] | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('wms_adjustment_reasons')
        .select('*')
        .order('display_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('active_status', 'active');
      }

      const { data, error } = await query;

      if (error) {
        console.error('[StockAdjustmentService] getAdjustmentReasons error', error);
        return { data: null, error: error.message };
      }

      return { data: data as AdjustmentReason[], error: null };
    } catch (err) {
      console.error('[StockAdjustmentService] getAdjustmentReasons unexpected error', err);
      return { data: null, error: 'Failed to fetch adjustment reasons' };
    }
  }
}

export const stockAdjustmentService = new StockAdjustmentService();
