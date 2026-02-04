import { createServiceRoleClient } from '@/lib/supabase/server';

// Use service role client for admin operations (bypasses RLS)
// This is intentional for database service layer operations
const supabase = createServiceRoleClient();

// --- ENUM Types ---
export type ReceiveType = 
  | 'รับสินค้าปกติ'
  | 'รับสินค้าชำรุด'
  | 'รับสินค้าหมดอายุ'
  | 'รับสินค้าคืน'
  | 'รับสินค้าคืน (ไม่มีเอกสาร)'
  | 'รับสินค้าตีกลับ'
  | 'การผลิต';

export type PalletScanStatus = 'ไม่จำเป็น' | 'สแกนแล้ว' | 'รอดำเนินการ';

export type ReceiveStatus = 'รอรับเข้า' | 'รับเข้าแล้ว' | 'กำลังตรวจสอบ' | 'สำเร็จ';

// --- Interface for Receive Header (wms_receives) ---
export interface ReceiveHeader {
  receive_id: number;
  receive_no: string;
  receive_type: ReceiveType;
  reference_doc?: string;
  supplier_id?: string;
  customer_id?: string;
  warehouse_id: string;
  receive_date: string;
  received_by?: number;
  status: ReceiveStatus;
  notes?: string;
  receive_images?: string[];
  receive_image_names?: string[];
  receive_image_count?: number;
  pallet_box_option?: string;
  pallet_calculation_method?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// --- Interface for Material Traceability Info ---
export interface MaterialTraceabilityInfo {
  material_sku_id: string;
  material_name: string;
  production_date?: string;
  expiry_date?: string;
  qty_used?: number;
}

// --- Interface for Receive Line Items (wms_receive_items) ---
export interface ReceiveItem {
  item_id: number;
  receive_id: number;
  sku_id: string;
  product_name?: string;
  barcode?: string;
  production_date?: string;
  expiry_date?: string;
  pack_quantity: number;
  piece_quantity: number;
  weight_kg?: number;
  pallet_id?: string;
  pallet_color?: string;
  pallet_scan_status: PalletScanStatus;
  location_id?: string;
  pallet_id_external?: string;
  received_date?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  // Production traceability fields
  production_order_id?: string;
  source_materials_info?: MaterialTraceabilityInfo[];
}

// --- Interface for the data payload to create a new receive document ---
export interface CreateReceivePayload {
  // Header data
  receive_type: ReceiveType;
  reference_doc?: string;
  supplier_id?: string;
  customer_id?: string;
  warehouse_id: string;
  receive_date: string;
  received_by?: number;
  status: ReceiveStatus;
  notes?: string;
  receive_images?: string[];
  receive_image_names?: string[];
  pallet_box_option?: string;
  pallet_calculation_method?: string;
  created_by?: number;

  // Line items data
  items: Omit<ReceiveItem, 'item_id' | 'receive_id' | 'created_at' | 'updated_at'>[];
}

// --- Additional types for hooks and components ---
export type ReceiveRecord = ReceiveHeader & {
  wms_receive_items?: ReceiveItem[];
  master_supplier?: { supplier_name: string };
  master_customer?: { customer_name: string };
  master_warehouse?: { warehouse_name: string };
  master_employee?: { first_name: string; last_name: string };
};

export type CreateReceiveRecord = CreateReceivePayload;

export interface ReceiveFilters {
  receive_type?: ReceiveType;
  status?: ReceiveStatus;
  warehouse_id?: string;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}


export class ReceiveService {
  private supabase = supabase;

  // Generate receive_no in format GR-{YYYY}{MM}-{4digitRunningNo}
  async generateReceiveNo(): Promise<{ data: string | null; error: string | null }> {
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prefix = `GR-${yearMonth}-`;

      // Get the latest receive_no for this month from the new table
      const { data: latestRecord, error } = await this.supabase
        .from('wms_receives')
        .select('receive_no')
        .like('receive_no', `${prefix}%`)
        .order('receive_no', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error getting latest receive_no:', error);
        return { data: null, error: error.message };
      }

      let runningNo = 1;
      if (latestRecord && latestRecord.length > 0) {
        const lastNo = latestRecord[0].receive_no;
        const lastRunningNo = parseInt(lastNo.substring(lastNo.lastIndexOf('-') + 1));
        runningNo = lastRunningNo + 1;
      }

      const receiveNo = `${prefix}${String(runningNo).padStart(4, '0')}`;
      return { data: receiveNo, error: null };
    } catch (err) {
      console.error('Error generating receive_no:', err);
      return { data: null, error: 'Error generating receive number' };
    }
  }

  // Generate unique pallet_id in format ATG{YYYY}{MM}{DD}{3-digit-running-number}
  // Example: ATG20260128001
  // IMPORTANT: Checks both wms_receive_items AND wms_move_items.new_pallet_id to prevent duplicates
  async generatePalletId(): Promise<{ data: string | null; error: string | null }> {
    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `ATG${year}${month}${day}`;

      // Get the latest pallet_id from BOTH receive_items AND move_items (new_pallet_id)
      // to prevent duplicate pallet IDs between receives and partial moves
      const { data: latestFromReceive } = await this.supabase
        .from('wms_receive_items')
        .select('pallet_id')
        .like('pallet_id', `${datePrefix}%`)
        .order('pallet_id', { ascending: false })
        .limit(1);

      const { data: latestFromMove } = await this.supabase
        .from('wms_move_items')
        .select('new_pallet_id')
        .like('new_pallet_id', `${datePrefix}%`)
        .order('new_pallet_id', { ascending: false })
        .limit(1);

      let runningNo = 1;
      
      // Find the max running number from both sources
      const receivePalletId = latestFromReceive?.[0]?.pallet_id;
      const movePalletId = latestFromMove?.[0]?.new_pallet_id;
      
      if (receivePalletId) {
        const receiveRunningNo = parseInt(receivePalletId.substring(datePrefix.length));
        if (!isNaN(receiveRunningNo) && receiveRunningNo >= runningNo) {
          runningNo = receiveRunningNo + 1;
        }
      }
      
      if (movePalletId) {
        const moveRunningNo = parseInt(movePalletId.substring(datePrefix.length));
        if (!isNaN(moveRunningNo) && moveRunningNo >= runningNo) {
          runningNo = moveRunningNo + 1;
        }
      }

      const palletId = `${datePrefix}${String(runningNo).padStart(3, '0')}`;
      return { data: palletId, error: null };
    } catch (err) {
      console.error('Error generating pallet_id:', err);
      return { data: null, error: 'Error generating pallet ID' };
    }
  }

  // Generate split pallet ID in format: ORIGINAL_PALLET_ID-01, -02, -03, etc.
  // Used when doing partial/split pallet moves for traceability
  async generateSplitPalletId(parentPalletId: string): Promise<{ data: string | null; error: string | null }> {
    try {
      // Strip any existing suffix if parent already has one (e.g., ATG2500014400-01 → ATG2500014400)
      const baseId = parentPalletId.replace(/-\d+$/, '');

      // Query existing split pallet IDs from multiple sources
      const [fromReceive, fromMoveNew, fromMovePallet, fromBalance] = await Promise.all([
        this.supabase
          .from('wms_receive_items')
          .select('pallet_id')
          .like('pallet_id', `${baseId}-%`)
          .order('pallet_id', { ascending: false })
          .limit(10),
        this.supabase
          .from('wms_move_items')
          .select('new_pallet_id')
          .like('new_pallet_id', `${baseId}-%`)
          .order('new_pallet_id', { ascending: false })
          .limit(10),
        this.supabase
          .from('wms_move_items')
          .select('pallet_id')
          .like('pallet_id', `${baseId}-%`)
          .order('pallet_id', { ascending: false })
          .limit(10),
        this.supabase
          .from('wms_inventory_balances')
          .select('pallet_id')
          .like('pallet_id', `${baseId}-%`)
          .order('pallet_id', { ascending: false })
          .limit(10),
      ]);

      // Collect all existing suffixes
      let maxSuffix = 0;
      const allIds = [
        ...(fromReceive.data || []).map(r => r.pallet_id),
        ...(fromMoveNew.data || []).map(r => r.new_pallet_id),
        ...(fromMovePallet.data || []).map(r => r.pallet_id),
        ...(fromBalance.data || []).map(r => r.pallet_id),
      ].filter(Boolean);

      for (const id of allIds) {
        const match = id.match(new RegExp(`^${baseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
        if (match) {
          const suffix = parseInt(match[1], 10);
          if (suffix > maxSuffix) {
            maxSuffix = suffix;
          }
        }
      }

      const nextSuffix = String(maxSuffix + 1).padStart(2, '0');
      const splitPalletId = `${baseId}-${nextSuffix}`;

      return { data: splitPalletId, error: null };
    } catch (err) {
      console.error('Error generating split pallet_id:', err);
      return { data: null, error: 'Error generating split pallet ID' };
    }
  }

  // Generate multiple unique pallet_ids in batch (optimized version)
  // Example: ATG20260128001, ATG20260128002, ...
  // IMPORTANT: Checks both wms_receive_items AND wms_move_items.new_pallet_id to prevent duplicates
  async generateMultiplePalletIds(count: number): Promise<{ data: string[] | null; error: string | null }> {
    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `ATG${year}${month}${day}`;

      // Get the latest pallet_id from BOTH receive_items AND move_items (new_pallet_id)
      const { data: latestFromReceive } = await this.supabase
        .from('wms_receive_items')
        .select('pallet_id')
        .like('pallet_id', `${datePrefix}%`)
        .order('pallet_id', { ascending: false })
        .limit(1);

      const { data: latestFromMove } = await this.supabase
        .from('wms_move_items')
        .select('new_pallet_id')
        .like('new_pallet_id', `${datePrefix}%`)
        .order('new_pallet_id', { ascending: false })
        .limit(1);

      let runningNo = 1;
      
      // Find the max running number from both sources
      const receivePalletId = latestFromReceive?.[0]?.pallet_id;
      const movePalletId = latestFromMove?.[0]?.new_pallet_id;
      
      if (receivePalletId) {
        const receiveRunningNo = parseInt(receivePalletId.substring(datePrefix.length));
        if (!isNaN(receiveRunningNo) && receiveRunningNo >= runningNo) {
          runningNo = receiveRunningNo + 1;
        }
      }
      
      if (movePalletId) {
        const moveRunningNo = parseInt(movePalletId.substring(datePrefix.length));
        if (!isNaN(moveRunningNo) && moveRunningNo >= runningNo) {
          runningNo = moveRunningNo + 1;
        }
      }

      const palletIds = [];
      for (let i = 0; i < count; i++) {
        const palletId = `${datePrefix}${String(runningNo + i).padStart(3, '0')}`;
        palletIds.push(palletId);
      }

      return { data: palletIds, error: null };
    } catch (err) {
      console.error('Error generating multiple pallet_ids:', err);
      return { data: null, error: 'Error generating pallet IDs' };
    }
  }

  // Get the latest pallet_id for reference
  async getLatestPalletId(): Promise<{ data: string | null; error: string | null }> {
    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `ATG${year}${month}${day}`;

      // Get the latest pallet_id for this date from the items table
      const { data: latestRecord, error } = await this.supabase
        .from('wms_receive_items')
        .select('pallet_id')
        .like('pallet_id', `${datePrefix}%`)
        .order('pallet_id', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error getting latest pallet_id:', error);
        return { data: null, error: error.message };
      }

      if (latestRecord && latestRecord.length > 0 && latestRecord[0].pallet_id) {
        return { data: latestRecord[0].pallet_id, error: null };
      }

      // If no pallet exists for today, return the first pallet ID that would be generated
      const firstPalletId = `${datePrefix}${String(1).padStart(9, '0')}`;
      return { data: firstPalletId, error: null };
    } catch (err) {
      console.error('Error getting latest pallet_id:', err);
      return { data: null, error: 'Error getting latest pallet ID' };
    }
  }

  // Create new receive document with multiple items
  async createReceive(payload: CreateReceivePayload): Promise<{ data: ReceiveHeader | null; error: string | null }> {
    // Step 1: Insert the header record
    const { data: header, error: headerError } = await this.supabase
      .from('wms_receives')
      .insert({
        receive_no: await this.generateReceiveNo().then(r => r.data || 'ERROR'), // Generate number
        receive_type: payload.receive_type,
        reference_doc: payload.reference_doc,
        supplier_id: payload.supplier_id,
        customer_id: payload.customer_id,
        warehouse_id: payload.warehouse_id,
        receive_date: payload.receive_date,
        received_by: payload.received_by,
        status: payload.status,
        notes: payload.notes,
        receive_images: payload.receive_images,
        receive_image_names: payload.receive_image_names,
        pallet_box_option: payload.pallet_box_option,
        pallet_calculation_method: payload.pallet_calculation_method,
        created_by: payload.created_by,
      })
      .select()
      .single();

    if (headerError) {
      console.error('Error creating receive header:', headerError);
      console.error('Header error details:', JSON.stringify(headerError, null, 2)); // Add detailed error logging
      return { data: null, error: `Failed to create receive header: ${headerError.message}` };
    }

    if (!header) {
        console.error('Failed to create receive header: No data returned.'); // Add logging
        return { data: null, error: 'Failed to create receive header: No data returned.' };
    }

    // Step 2: Generate Pallet IDs if needed
    let itemsToInsert = payload.items.map(item => {
      // Extract only valid database columns, excluding UI-only fields
      const {
        original_quantity,
        return_quantity,
        generate_pallet,
        ...validItem
      } = item as any;
      
      return {
        ...validItem,
        receive_id: header.receive_id, // Link to the new header
        created_by: payload.created_by, // Add created_by to items
        // Convert empty strings to null for date fields (PostgreSQL requires null, not empty string)
        production_date: validItem.production_date && validItem.production_date.trim() !== '' ? validItem.production_date : null,
        expiry_date: validItem.expiry_date && validItem.expiry_date.trim() !== '' ? validItem.expiry_date : null,
        received_date: validItem.received_date && validItem.received_date.trim() !== '' ? validItem.received_date : null,
      };
    });

    // Auto-generate Pallet IDs based on pallet_box_option
    if (payload.pallet_box_option === 'สร้าง_Pallet_ID' || payload.pallet_box_option === 'สร้าง_Pallet_ID_รวม') {
      const palletIdsNeeded = payload.pallet_box_option === 'สร้าง_Pallet_ID'
        ? itemsToInsert.length // แยก Pallet แต่ละ SKU
        : 1; // รวม Pallet ทุก SKU

      const { data: palletIds, error: palletError } = await this.generateMultiplePalletIds(palletIdsNeeded);

      if (palletError || !palletIds) {
        console.error('Error generating pallet IDs:', palletError);
        await this.supabase.from('wms_receives').delete().eq('receive_id', header.receive_id);
        return { data: null, error: `Failed to generate pallet IDs: ${palletError}` };
      }

      // Assign pallet IDs to items
      itemsToInsert = itemsToInsert.map((item, index) => ({
        ...item,
        pallet_id: payload.pallet_box_option === 'สร้าง_Pallet_ID'
          ? palletIds[index] // แต่ละ item ได้ pallet แยก
          : palletIds[0], // ทุก item ใช้ pallet เดียวกัน
        pallet_scan_status: 'ไม่จำเป็น' // สร้างอัตโนมัติแล้ว ไม่ต้องสแกน
      }));
    }

    const { error: itemsError } = await this.supabase
      .from('wms_receive_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating receive items:', itemsError);
      console.error('Items error details:', JSON.stringify(itemsError, null, 2)); // Add detailed error logging
      // Attempt to roll back the header insertion for cleaner data
      await this.supabase.from('wms_receives').delete().eq('receive_id', header.receive_id);
      return { data: null, error: `Failed to create receive items: ${itemsError.message}. The receive document was rolled back.` };
    }

    // Step 3: Return the created header data
    return { data: header, error: null };
  }

  async getAllReceives(filters?: any): Promise<{ data: any[] | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('wms_receives')
        .select(`
          *,
          wms_receive_items(*, master_sku(sku_name, barcode), master_location(location_code, location_name)),
          master_supplier(supplier_name),
          master_customer(customer_name),
          master_warehouse(warehouse_name),
          received_by_employee:master_employee!fk_receives_employee(first_name, last_name),
          created_by_user:master_system_user!fk_receives_created_by(full_name, username)
        `)
        .order('receive_date', { ascending: false });

      // Apply filters from the original implementation if they are relevant
      if (filters?.receive_type) query = query.eq('receive_type', filters.receive_type);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.warehouse_id) query = query.eq('warehouse_id', filters.warehouse_id);
      if (filters?.startDate) query = query.gte('receive_date', filters.startDate);
      if (filters?.endDate) query = query.lte('receive_date', filters.endDate);

      // Comprehensive search across all columns
      if (filters?.searchTerm) {
        // Check if search term contains special characters that break PostgREST
        const hasSpecialChars = /[|,()\\]/.test(filters.searchTerm);
        if (!hasSpecialChars) {
          const searchNum = Number(filters.searchTerm);
          const isNumber = !isNaN(searchNum);

          const conditions = [
            // Text fields only (exclude enum fields: receive_type, status)
            `receive_no.ilike.%${filters.searchTerm}%`,
            `reference_doc.ilike.%${filters.searchTerm}%`,
            `warehouse_id.ilike.%${filters.searchTerm}%`,
            `notes.ilike.%${filters.searchTerm}%`,
            `supplier_id.ilike.%${filters.searchTerm}%`,
            `customer_id.ilike.%${filters.searchTerm}%`,
          ];

          // Date fields - only search if input looks like a date
          const datePattern = /^\d{4}-\d{2}-\d{2}$/;
          if (datePattern.test(filters.searchTerm)) {
            conditions.push(`receive_date.eq.${filters.searchTerm}`);
          }

          if (isNumber) {
            conditions.push(
              `receive_id.eq.${searchNum}`,
              `created_by.eq.${searchNum}`,
              `received_by.eq.${searchNum}`
            );
          }

          query = query.or(conditions.join(','));
        }
      }

      let { data, error } = await query;

      // Client-side filtering for item-level search (SKU, product name, barcode)
      if (filters?.searchTerm && data) {
        const searchLower = filters.searchTerm.toLowerCase();
        data = data.filter((receive: any) => {
          // Check if already matched by header search
          const headerMatch = 
            receive.receive_no?.toLowerCase().includes(searchLower) ||
            receive.reference_doc?.toLowerCase().includes(searchLower) ||
            receive.warehouse_id?.toLowerCase().includes(searchLower) ||
            receive.receive_type?.toLowerCase().includes(searchLower) ||
            receive.status?.toLowerCase().includes(searchLower) ||
            receive.supplier_id?.toLowerCase().includes(searchLower) ||
            receive.customer_id?.toLowerCase().includes(searchLower);

          if (headerMatch) return true;

          // Check items for SKU, product name, or barcode match
          if (receive.wms_receive_items && receive.wms_receive_items.length > 0) {
            return receive.wms_receive_items.some((item: any) => {
              return (
                item.sku_id?.toLowerCase().includes(searchLower) ||
                item.product_name?.toLowerCase().includes(searchLower) ||
                item.barcode?.toLowerCase().includes(searchLower) ||
                item.master_sku?.sku_name?.toLowerCase().includes(searchLower) ||
                item.master_sku?.barcode?.toLowerCase().includes(searchLower)
              );
            });
          }

          return false;
        });
      }

      if (error) {
        console.error('Error fetching receive records:', error);
        return { data: null, error: error.message };
      }

      // Fetch destination locations from move_items for all pallet_ids
      if (data && data.length > 0) {
        // Collect all pallet_ids from all items
        const allPalletIds: string[] = [];
        data.forEach((receive: any) => {
          if (receive.wms_receive_items) {
            receive.wms_receive_items.forEach((item: any) => {
              if (item.pallet_id) {
                allPalletIds.push(item.pallet_id);
              }
            });
          }
        });

        if (allPalletIds.length > 0) {
          // Fetch latest move destination for each pallet from wms_move_items
          // Split into batches to avoid headers overflow error
          const batchSize = 50;
          const allMoveData: any[] = [];
          
          for (let i = 0; i < allPalletIds.length; i += batchSize) {
            const batch = allPalletIds.slice(i, i + batchSize);
            const { data: batchData, error: batchError } = await this.supabase
              .from('wms_move_items')
              .select('pallet_id, to_location_id, completed_at')
              .in('pallet_id', batch)
              .eq('status', 'completed')
              .order('completed_at', { ascending: false });
            
            if (batchError) {
              console.error('[Receive Service] Error fetching move data batch:', batchError);
            } else if (batchData) {
              allMoveData.push(...batchData);
            }
          }

          if (allMoveData.length > 0) {
            console.log('[Receive Service] Move data fetched:', allMoveData.length, 'records');
            
            // Create a map of pallet_id -> latest to_location_id
            const palletDestinationMap = new Map<string, string>();
            allMoveData.forEach((move: any) => {
              // Only set if not already set (since we ordered by completed_at desc, first one is latest)
              if (!palletDestinationMap.has(move.pallet_id) && move.to_location_id) {
                palletDestinationMap.set(move.pallet_id, move.to_location_id);
              }
            });

            console.log('[Receive Service] Pallet destination map size:', palletDestinationMap.size);

            // Fetch location codes for all unique destination locations
            const uniqueDestinations = [...new Set(Array.from(palletDestinationMap.values()))];
            const { data: locationData } = await this.supabase
              .from('master_location')
              .select('location_id, location_code')
              .in('location_id', uniqueDestinations);

            const locationCodeMap = new Map<string, string>();
            if (locationData) {
              locationData.forEach((loc: any) => {
                locationCodeMap.set(loc.location_id, loc.location_code);
              });
            }

            console.log('[Receive Service] Location code map size:', locationCodeMap.size);

            // Add destination location to each item
            let updatedCount = 0;
            data.forEach((receive: any) => {
              if (receive.wms_receive_items) {
                receive.wms_receive_items.forEach((item: any) => {
                  if (item.pallet_id) {
                    const destinationLocationId = palletDestinationMap.get(item.pallet_id);
                    if (destinationLocationId) {
                      item.current_location_id = destinationLocationId;
                      item.current_location_code = locationCodeMap.get(destinationLocationId) || destinationLocationId;
                      updatedCount++;
                    }
                  }
                });
              }
            });
            console.log('[Receive Service] Updated', updatedCount, 'items with destination location');
          }
        }
      }

      return { data, error: null };
    } catch (err) {
      console.error('Error fetching receive records:', err);
      return { data: null, error: 'Failed to fetch receive records' };
    }
  }

  // Update receive record
  async updateReceive(id: number, updates: Partial<ReceiveHeader>): Promise<{ data: ReceiveHeader | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_receives')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('receive_id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating receive:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err) {
      console.error('Error updating receive:', err);
      return { data: null, error: 'Failed to update receive' };
    }
  }

  // Update receive items - delete existing items and insert new ones
  async updateReceiveItems(receiveId: number, items: Omit<ReceiveItem, 'item_id' | 'receive_id' | 'created_at' | 'updated_at'>[]): Promise<{ data: ReceiveItem[] | null; error: string | null }> {
    try {
      // Delete existing items for this receive
      const { error: deleteError } = await this.supabase
        .from('wms_receive_items')
        .delete()
        .eq('receive_id', receiveId);

      if (deleteError) {
        console.error('Error deleting existing receive items:', deleteError);
        return { data: null, error: deleteError.message };
      }

      // Insert new items
      const itemsWithReceiveId = items.map(item => ({
        ...item,
        receive_id: receiveId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error: insertError } = await this.supabase
        .from('wms_receive_items')
        .insert(itemsWithReceiveId)
        .select();

      if (insertError) {
        console.error('Error inserting receive items:', insertError);
        return { data: null, error: insertError.message };
      }

      return { data, error: null };
    } catch (err) {
      console.error('Error updating receive items:', err);
      return { data: null, error: 'Failed to update receive items' };
    }
  }

  // Get receive by ID
  async getReceiveById(id: number): Promise<{ data: ReceiveRecord | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_receives')
        .select(`
          *,
          wms_receive_items (
            *,
            master_sku (sku_name, barcode),
            master_location (location_code, location_name)
          ),
          master_supplier (supplier_name),
          master_customer (customer_name),
          master_warehouse (warehouse_name),
          received_by_employee:master_employee!fk_receives_employee (first_name, last_name)
        `)
        .eq('receive_id', id)
        .single();

      if (error) {
        console.error('Error fetching receive by ID:', error);
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err) {
      console.error('Error fetching receive by ID:', err);
      return { data: null, error: 'Failed to fetch receive' };
    }
  }

  async getDashboardStats(): Promise<{ data: any | null; error: string | null }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('wms_receives')
        .select('receive_type, status, receive_date');

      if (error) {
        console.error('Error fetching dashboard stats:', error);
        return { data: null, error: error.message };
      }

      const todayRecords = data.filter(record => record.receive_date?.startsWith(today));

      const byType = data.reduce((acc, record) => {
        acc[record.receive_type as ReceiveType] = (acc[record.receive_type as ReceiveType] || 0) + 1;
        return acc;
      }, {} as Record<ReceiveType, number>);

      const byStatus = data.reduce((acc, record) => {
        acc[record.status as ReceiveStatus] = (acc[record.status as ReceiveStatus] || 0) + 1;
        return acc;
      }, {} as Record<ReceiveStatus, number>);

      return {
        data: {
          totalToday: todayRecords.length,
          byType,
          byStatus,
        },
        error: null
      };
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      return { data: null, error: 'Failed to fetch dashboard stats' };
    }
  }

  // Validate pallet scan
  async validatePalletScan(palletId: string): Promise<{ data: boolean | null; error: string | null }> {
    try {
      // Check if pallet ID exists in receive items
      const { data, error } = await this.supabase
        .from('wms_receive_items')
        .select('pallet_id, pallet_scan_status')
        .eq('pallet_id', palletId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return { data: false, error: 'Pallet ID not found' };
        }
        console.error('Error validating pallet scan:', error);
        return { data: null, error: error.message };
      }

      // Check if pallet is already scanned
      if (data.pallet_scan_status === 'สแกนแล้ว') {
        return { data: false, error: 'Pallet already scanned' };
      }

      // Update pallet scan status to scanned
      const { error: updateError } = await this.supabase
        .from('wms_receive_items')
        .update({ pallet_scan_status: 'สแกนแล้ว' })
        .eq('pallet_id', palletId);

      if (updateError) {
        console.error('Error updating pallet scan status:', updateError);
        return { data: null, error: updateError.message };
      }

      return { data: true, error: null };
    } catch (err) {
      console.error('Error validating pallet scan:', err);
      return { data: null, error: 'Failed to validate pallet scan' };
    }
  }
}

// Export singleton instance
export const receiveService = new ReceiveService();