// ============================================================================
// Stock Import Service
// จัดการการนำเข้าสต็อกจากระบบเก่า
// ============================================================================

import { createClient } from '@/lib/supabase/server';
import type {
  StockImportBatch,
  StockImportStaging,
  StockImportBatchStatus,
  StockImportStagingStatus,
  ValidationSummary,
  ProcessingSummary,
  ErrorSummary,
  ErrorDetail,
  ParsedImportRow,
  ValidationErrorType,
} from '@/types/stock-import';

// ============================================================================
// Stock Import Service Class
// ============================================================================

export class StockImportService {
  /**
   * สร้าง Batch ID ใหม่
   */
  async generateBatchId(): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('generate_stock_import_batch_id');

    if (error) {
      console.error('Error generating batch ID:', error);
      throw new Error('ไม่สามารถสร้าง Batch ID ได้');
    }

    return data as string;
  }

  /**
   * สร้าง Import Batch ใหม่
   */
  async createImportBatch(
    warehouseId: string,
    fileName: string,
    fileSize: number,
    fileType: 'csv' | 'excel',
    totalRows: number,
    userId: number,
    batchName?: string
  ): Promise<StockImportBatch> {
    const supabase = await createClient();

    const batchId = await this.generateBatchId();

    const { data, error } = await supabase
      .from('wms_stock_import_batches')
      .insert({
        batch_id: batchId,
        batch_name: batchName || `นำเข้าสต็อก ${new Date().toLocaleDateString('th-TH')}`,
        warehouse_id: warehouseId,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        total_rows: totalRows,
        status: 'uploading' as StockImportBatchStatus,
        created_by: userId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating import batch:', error);
      throw new Error('ไม่สามารถสร้าง Import Batch ได้');
    }

    return data as StockImportBatch;
  }

  /**
   * บันทึกข้อมูล Staging จาก CSV
   */
  async insertStagingData(
    batchId: string,
    rows: any[],
    warehouseId: string,
    userId: number
  ): Promise<void> {
    const supabase = await createClient();

    const stagingRecords = rows.map((row, index) => ({
      import_batch_id: batchId,
      row_number: index + 2, // +2 เพราะแถว 1 เป็น header และเริ่มนับที่ 1
      warehouse_id: warehouseId,

      // ข้อมูลจากไฟล์
      location_id: row['Location_ID'] || row['location_id'] || null,
      zone: row['Zone'] || row['zone'] || null,
      row_code: row['Row'] || row['row'] || null,
      level_code: row['Level'] || row['level'] || null,
      loc_code: row['Loc'] || row['loc'] || null,
      sku_pick_face: row['SKU Pick Face'] || row['sku_pick_face'] || null,
      max_weight: this.parseNumber(row['Max_Weight'] || row['max_weight']),
      max_pallet: parseInt(row['Max_Pallet'] || row['max_pallet'] || '0'),
      max_high: row['Max_High'] || row['max_high'] || null,
      location_status: row['Status'] || row['status'] || null,

      pallet_id_check: row['Pallet_ID_Check'] || row['pallet_id_check'] || null,
      pallet_id_external: row['Pallet_ID'] || row['pallet_id'] || null,
      last_updated_check: row['Last_Updated_Check'] || row['last_updated_check'] || null,
      last_updated_check_2: row['Last_Updated_Check_2'] || row['last_updated_check_2'] || null,
      last_updated: row['Last_Updated'] || row['last_updated'] || null,

      sku_id: row['SKU'] || row['sku'] || row['sku_id'] || null,
      product_name: row['Product_Name'] || row['product_name'] || null,
      pack_qty: this.parseNumber(row['แพ็ค'] || row['pack_qty']),
      piece_qty: this.parseNumber(row['ชิ้น'] || row['piece_qty']),
      weight_kg: this.parseNumber(row['น้ำหนัก'] || row['weight_kg']),
      lot_no: row['Lot'] || row['lot'] || row['lot_no'] || null,
      received_date: row['Received_Date'] || row['received_date'] || null,
      expiration_date: row['Expiration_Date'] || row['expiration_date'] || null,
      barcode: row['Barcode'] || row['barcode'] || null,
      name_edit: row['Name_edit'] || row['name_edit'] || null,
      stock_status: row['สถานะ'] || row['stock_status'] || 'ปกติ',
      pallet_color: row['สีพาเลท'] || row['pallet_color'] || null,
      remarks: row['หมายเหตุ'] || row['remarks'] || null,

      processing_status: 'pending' as StockImportStagingStatus,
      created_by: userId,
    }));

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < stagingRecords.length; i += batchSize) {
      const batch = stagingRecords.slice(i, i + batchSize);
      const { error } = await supabase
        .from('wms_stock_import_staging')
        .insert(batch);

      if (error) {
        console.error(`Error inserting staging batch ${i / batchSize + 1}:`, error);
        throw new Error(`ไม่สามารถบันทึกข้อมูล staging ได้ (แถวที่ ${i + 1}-${i + batch.length})`);
      }
    }
  }

  /**
   * อัพเดทสถานะ Batch
   */
  async updateBatchStatus(
    batchId: string,
    status: StockImportBatchStatus,
    additionalData?: Partial<StockImportBatch>
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: any = {
      status,
      ...additionalData,
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('wms_stock_import_batches')
      .update(updateData)
      .eq('batch_id', batchId);

    if (error) {
      console.error('Error updating batch status:', error);
      throw new Error('ไม่สามารถอัพเดทสถานะ Batch ได้');
    }
  }

  /**
   * Validate ข้อมูล Staging
   */
  async validateStagingData(batchId: string): Promise<ValidationSummary> {
    const supabase = await createClient();

    // ดึงข้อมูล staging ทั้งหมด
    const { data: stagingRecords, error: fetchError } = await supabase
      .from('wms_stock_import_staging')
      .select('*')
      .eq('import_batch_id', batchId)
      .eq('processing_status', 'pending');

    if (fetchError) {
      throw new Error('ไม่สามารถดึงข้อมูล staging ได้');
    }

    const validationStart = Date.now();
    let validCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    const errorsByType: { [key: string]: number } = {};
    const missingSkus: Set<string> = new Set();
    const newLocations: Set<string> = new Set();

    // ดึงข้อมูล master data เพื่อตรวจสอบ
    const { data: warehouseData } = await supabase
      .from('master_warehouse')
      .select('warehouse_id')
      .eq('warehouse_id', stagingRecords[0]?.warehouse_id || '')
      .single();

    const skuIds = [...new Set(stagingRecords.map(r => r.sku_id).filter(Boolean))];
    const { data: existingSkus } = await supabase
      .from('master_sku')
      .select('sku_id')
      .in('sku_id', skuIds);

    const existingSkuSet = new Set(existingSkus?.map(s => s.sku_id) || []);

    const locationIds = [...new Set(stagingRecords.map(r => r.location_id).filter(Boolean))];
    const { data: existingLocations } = await supabase
      .from('master_location')
      .select('location_id')
      .in('location_id', locationIds);

    const existingLocationSet = new Set(existingLocations?.map(l => l.location_id) || []);

    // Validate แต่ละแถว
    for (const record of stagingRecords) {
      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. ตรวจสอบ warehouse
      if (!warehouseData) {
        errors.push('ไม่พบคลังสินค้าในระบบ');
        this.incrementErrorType(errorsByType, 'warehouse_not_found');
      }

      // 2. ตรวจสอบ location_id
      if (!record.location_id || record.location_id.trim() === '') {
        errors.push('ไม่มีรหัสตำแหน่ง (Location_ID)');
        this.incrementErrorType(errorsByType, 'missing_location_id');
      } else {
        if (!existingLocationSet.has(record.location_id)) {
          newLocations.add(record.location_id);
          warnings.push(`ตำแหน่ง ${record.location_id} จะถูกสร้างใหม่`);
        }
      }

      // 3. ตรวจสอบ SKU (เฉพาะแถวที่มีสินค้า)
      const hasPieceQty = record.piece_qty && record.piece_qty > 0;
      if (hasPieceQty) {
        if (!record.sku_id || record.sku_id.trim() === '') {
          errors.push('ไม่มีรหัส SKU');
          this.incrementErrorType(errorsByType, 'missing_sku');
        } else if (!existingSkuSet.has(record.sku_id)) {
          errors.push(`ไม่พบ SKU: ${record.sku_id} ในระบบ`);
          this.incrementErrorType(errorsByType, 'sku_not_found');
          missingSkus.add(record.sku_id);
        }

        // 4. ตรวจสอบจำนวน
        if (!record.piece_qty || record.piece_qty <= 0) {
          errors.push('จำนวนชิ้นต้องมากกว่า 0');
          this.incrementErrorType(errorsByType, 'invalid_quantity');
        }
      }

      // 5. ตรวจสอบวันที่
      const parsedReceivedDate = this.parseDateString(record.received_date);
      const parsedExpiryDate = this.parseDateString(record.expiration_date);

      if (record.received_date && !parsedReceivedDate) {
        warnings.push('รูปแบบวันที่รับสินค้าไม่ถูกต้อง');
      }

      if (record.expiration_date && !parsedExpiryDate) {
        warnings.push('รูปแบบวันหมดอายุไม่ถูกต้อง');
      }

      if (parsedReceivedDate && parsedExpiryDate && parsedExpiryDate < parsedReceivedDate) {
        warnings.push('วันหมดอายุก่อนวันที่รับสินค้า');
      }

      // บันทึกผลการ validate
      const isValid = errors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }
      if (warnings.length > 0) {
        warningCount++;
      }

      // อัพเดท staging record
      await supabase
        .from('wms_stock_import_staging')
        .update({
          processing_status: isValid ? ('validated' as StockImportStagingStatus) : ('error' as StockImportStagingStatus),
          validation_errors: errors.length > 0 ? errors : null,
          validation_warnings: warnings.length > 0 ? warnings : null,
          parsed_received_date: parsedReceivedDate?.toISOString() || null,
          parsed_expiration_date: parsedExpiryDate?.toISOString() || null,
          parsed_last_updated: this.parseDateString(record.last_updated)?.toISOString() || null,
        })
        .eq('staging_id', record.staging_id);
    }

    const validationTime = (Date.now() - validationStart) / 1000;

    const summary: ValidationSummary = {
      total_checked: stagingRecords.length,
      valid_count: validCount,
      error_count: errorCount,
      warning_count: warningCount,
      errors_by_type: errorsByType,
      missing_skus: Array.from(missingSkus),
      new_locations: Array.from(newLocations),
      validation_time_seconds: validationTime,
    };

    // อัพเดท batch
    await this.updateBatchStatus(batchId, 'validated', {
      validated_rows: validCount,
      error_rows: errorCount,
      validation_summary: summary as any,
    });

    return summary;
  }

  /**
   * ประมวลผลการนำเข้า (Import จริง)
   */
  async processImport(batchId: string, userId: number, skipErrors: boolean = false): Promise<ProcessingSummary> {
    const supabase = await createClient();

    const processStart = Date.now();

    // ดึงข้อมูล staging ที่ validated แล้ว
    const { data: stagingRecords, error: fetchError } = await supabase
      .from('wms_stock_import_staging')
      .select('*')
      .eq('import_batch_id', batchId)
      .eq('processing_status', 'validated');

    if (fetchError) {
      throw new Error('ไม่สามารถดึงข้อมูล staging ได้');
    }

    let successCount = 0;
    let errorCount = 0;
    let locationsCreated = 0;
    let locationsUpdated = 0;
    let balancesCreated = 0;
    let balancesUpdated = 0;
    let ledgerEntriesCreated = 0;
    let totalPieceQtyImported = 0;
    let totalPackQtyImported = 0;
    let totalWeightKgImported = 0;

    // อัพเดทสถานะเป็น processing
    await this.updateBatchStatus(batchId, 'processing');

    // ประมวลผลแต่ละแถว
    for (const record of stagingRecords) {
      try {
        // ข้ามถ้าไม่มีสินค้า
        if (!record.piece_qty || record.piece_qty <= 0) {
          await this.updateStagingStatus(record.staging_id, 'skipped');
          continue;
        }

        // 1. สร้าง/อัพเดท Location
        const locationResult = await this.upsertLocation(record);
        if (locationResult.created) {
          locationsCreated++;
        } else {
          locationsUpdated++;
        }

        // 2. สร้าง/อัพเดท Inventory Balance
        const balanceResult = await this.upsertInventoryBalance(record);
        if (balanceResult.created) {
          balancesCreated++;
        } else {
          balancesUpdated++;
        }

        // 3. สร้าง Inventory Ledger
        const ledgerId = await this.insertInventoryLedger(record, batchId, userId);
        ledgerEntriesCreated++;

        // อัพเดท staging
        await supabase
          .from('wms_stock_import_staging')
          .update({
            processing_status: 'processed' as StockImportStagingStatus,
            processed_at: new Date().toISOString(),
            processed_balance_id: balanceResult.balance_id,
            processed_ledger_id: ledgerId,
          })
          .eq('staging_id', record.staging_id);

        // สะสมปริมาณ
        totalPieceQtyImported += Number(record.piece_qty);
        totalPackQtyImported += Number(record.pack_qty || 0);
        totalWeightKgImported += Number(record.weight_kg || 0);

        successCount++;
      } catch (error: any) {
        console.error(`Error processing staging_id ${record.staging_id}:`, error);
        await supabase
          .from('wms_stock_import_staging')
          .update({
            processing_status: 'error' as StockImportStagingStatus,
            validation_errors: [error.message || 'เกิดข้อผิดพลาดในการประมวลผล'],
          })
          .eq('staging_id', record.staging_id);

        errorCount++;

        if (!skipErrors) {
          throw error;
        }
      }
    }

    const processingTime = (Date.now() - processStart) / 1000;

    const summary: ProcessingSummary = {
      total_processed: stagingRecords.length,
      success_count: successCount,
      error_count: errorCount,
      locations_created: locationsCreated,
      locations_updated: locationsUpdated,
      balances_created: balancesCreated,
      balances_updated: balancesUpdated,
      ledger_entries_created: ledgerEntriesCreated,
      total_piece_qty_imported: totalPieceQtyImported,
      total_pack_qty_imported: totalPackQtyImported,
      total_weight_kg_imported: totalWeightKgImported,
      processing_time_seconds: processingTime,
    };

    // อัพเดท batch
    await this.updateBatchStatus(batchId, errorCount > 0 ? 'completed' : 'completed', {
      processed_rows: successCount,
      processing_summary: summary as any,
    });

    return summary;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async upsertLocation(record: StockImportStaging): Promise<{ created: boolean }> {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('master_location')
      .select('location_id, current_qty, current_weight_kg')
      .eq('location_id', record.location_id!)
      .single();

    if (existing) {
      // อัพเดท
      await supabase
        .from('master_location')
        .update({
          current_qty: (existing.current_qty || 0) + Number(record.piece_qty || 0),
          current_weight_kg: (existing.current_weight_kg || 0) + Number(record.weight_kg || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('location_id', record.location_id!);

      return { created: false };
    } else {
      // สร้างใหม่
      await supabase.from('master_location').insert({
        location_id: record.location_id!,
        warehouse_id: record.warehouse_id!,
        location_code: record.location_id!,
        location_name: record.location_id!,
        location_type: 'rack',
        zone: record.zone,
        aisle: record.row_code,
        shelf: record.level_code,
        bin: record.loc_code,
        max_capacity_weight_kg: record.max_weight,
        current_qty: Number(record.piece_qty || 0),
        current_weight_kg: Number(record.weight_kg || 0),
        active_status: 'active',
        created_by: 'system',
        remarks: record.max_high ? `Max Height: ${record.max_high}mm` : null,
      });

      return { created: true };
    }
  }

  private async upsertInventoryBalance(record: StockImportStaging): Promise<{ created: boolean; balance_id: number }> {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, total_pack_qty, total_piece_qty')
      .eq('warehouse_id', record.warehouse_id!)
      .eq('location_id', record.location_id!)
      .eq('sku_id', record.sku_id!)
      .eq('pallet_id_external', record.pallet_id_external || '')
      .single();

    if (existing) {
      // อัพเดท (เพิ่มจำนวน)
      await supabase
        .from('wms_inventory_balances')
        .update({
          total_pack_qty: Number(existing.total_pack_qty) + Number(record.pack_qty || 0),
          total_piece_qty: Number(existing.total_piece_qty) + Number(record.piece_qty || 0),
          last_movement_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('balance_id', existing.balance_id);

      return { created: false, balance_id: existing.balance_id };
    } else {
      // สร้างใหม่
      const { data: newBalance } = await supabase
        .from('wms_inventory_balances')
        .insert({
          warehouse_id: record.warehouse_id!,
          location_id: record.location_id!,
          sku_id: record.sku_id!,
          pallet_id_external: record.pallet_id_external,
          lot_no: record.lot_no,
          production_date: record.parsed_received_date,
          expiry_date: record.parsed_expiration_date,
          total_pack_qty: Number(record.pack_qty || 0),
          total_piece_qty: Number(record.piece_qty || 0),
          reserved_pack_qty: 0,
          reserved_piece_qty: 0,
          last_movement_at: new Date().toISOString(),
        })
        .select('balance_id')
        .single();

      return { created: true, balance_id: newBalance!.balance_id };
    }
  }

  private async insertInventoryLedger(record: StockImportStaging, batchId: string, userId: number): Promise<number> {
    const supabase = await createClient();

    const { data } = await supabase
      .from('wms_inventory_ledger')
      .insert({
        movement_at: new Date().toISOString(),
        transaction_type: 'import',
        direction: 'in',
        warehouse_id: record.warehouse_id!,
        location_id: record.location_id!,
        sku_id: record.sku_id!,
        pallet_id_external: record.pallet_id_external,
        production_date: record.parsed_received_date,
        expiry_date: record.parsed_expiration_date,
        pack_qty: Number(record.pack_qty || 0),
        piece_qty: Number(record.piece_qty || 0),
        reference_no: batchId,
        remarks: [record.remarks, record.pallet_color ? `สีพาเลท: ${record.pallet_color}` : null, record.name_edit ? `แก้ไขโดย: ${record.name_edit}` : null]
          .filter(Boolean)
          .join(' | '),
        created_by: userId,
      })
      .select('ledger_id')
      .single();

    return data!.ledger_id;
  }

  private async updateStagingStatus(stagingId: number, status: StockImportStagingStatus): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('wms_stock_import_staging')
      .update({ processing_status: status })
      .eq('staging_id', stagingId);
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;

    const cleaned = String(value).replace(/,/g, '');
    const num = parseFloat(cleaned);

    return isNaN(num) ? null : num;
  }

  private parseDateString(dateStr: string | null): Date | null {
    if (!dateStr) return null;

    try {
      // รองรับรูปแบบ: DD/MM/YYYY, DD/MM/YYYY HH:mm:ss
      const patterns = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/,    // YYYY-MM-DD
      ];

      for (const pattern of patterns) {
        const match = dateStr.match(pattern);
        if (match) {
          if (dateStr.includes('/')) {
            // DD/MM/YYYY
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            const year = parseInt(match[3]);
            const date = new Date(year, month, day);

            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
              return date;
            }
          } else {
            // YYYY-MM-DD
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
    }

    return null;
  }

  private incrementErrorType(errorsByType: { [key: string]: number }, errorType: string): void {
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
  }

  /**
   * ดึงรายการ Import Batches
   */
  async getImportBatches(
    warehouseId?: string,
    status?: StockImportBatchStatus,
    limit: number = 50
  ): Promise<StockImportBatch[]> {
    const supabase = await createClient();

    let query = supabase
      .from('wms_stock_import_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching import batches:', error);
      throw new Error('ไม่สามารถดึงรายการ Import Batches ได้');
    }

    return data as StockImportBatch[];
  }

  /**
   * ดึงข้อมูล Batch พร้อม Staging Records
   */
  async getBatchWithStaging(batchId: string) {
    const supabase = await createClient();

    const { data: batch, error: batchError } = await supabase
      .from('wms_stock_import_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (batchError) {
      throw new Error('ไม่พบ Import Batch');
    }

    const { data: staging, error: stagingError } = await supabase
      .from('wms_stock_import_staging')
      .select('*')
      .eq('import_batch_id', batchId)
      .order('row_number', { ascending: true });

    if (stagingError) {
      throw new Error('ไม่สามารถดึงข้อมูล staging ได้');
    }

    return {
      batch: batch as StockImportBatch,
      staging: staging as StockImportStaging[],
    };
  }

  /**
   * ลบ Import Batch (เฉพาะที่ยังไม่ processed)
   */
  async deleteBatch(batchId: string): Promise<void> {
    const supabase = await createClient();

    const { data: batch } = await supabase
      .from('wms_stock_import_batches')
      .select('status, processed_rows')
      .eq('batch_id', batchId)
      .single();

    if (!batch) {
      throw new Error('ไม่พบ Import Batch');
    }

    if (batch.processed_rows > 0) {
      throw new Error('ไม่สามารถลบ Batch ที่มีการประมวลผลแล้วได้');
    }

    const { error } = await supabase
      .from('wms_stock_import_batches')
      .delete()
      .eq('batch_id', batchId);

    if (error) {
      console.error('Error deleting batch:', error);
      throw new Error('ไม่สามารถลบ Import Batch ได้');
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const stockImportService = new StockImportService();
