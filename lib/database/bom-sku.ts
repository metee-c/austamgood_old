'use client';

import { supabase } from '@/lib/supabase/client';
import { BomSku, BomSkuWithDetails, BomSkuFilters, CreateBomSkuData, UpdateBomSkuData } from '@/types/database/bom-sku';

export class BomSkuService {
  // Get all BOM records with optional filters
  static async getAllBomSkus(filters: BomSkuFilters = {}) {
    try {
      let query = supabase
        .from('bom_sku')
        .select(`
          *,
          finished_sku:master_sku!fk_finished_sku(sku_id, sku_name, uom_base),
          material_sku:master_sku!fk_material_sku(sku_id, sku_name, uom_base)
        `)
        .order('bom_id', { ascending: true })
        .order('step_order', { ascending: true });

      // Apply non-search filters first
      if (filters.bom_id) {
        query = query.eq('bom_id', filters.bom_id);
      }

      if (filters.finished_sku_id) {
        query = query.eq('finished_sku_id', filters.finished_sku_id);
      }

      if (filters.material_sku_id) {
        query = query.eq('material_sku_id', filters.material_sku_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching BOM records:', error);
        return { data: [], error: error.message };
      }

      // Apply search filter on client-side to include SKU names
      let filteredData = data as BomSkuWithDetails[];
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(record => {
          // Search in bom_id
          if (record.bom_id?.toLowerCase().includes(searchLower)) return true;
          // Search in step_name
          if (record.step_name?.toLowerCase().includes(searchLower)) return true;
          // Search in finished_sku_id
          if (record.finished_sku_id?.toLowerCase().includes(searchLower)) return true;
          // Search in finished_sku name
          if (record.finished_sku?.sku_name?.toLowerCase().includes(searchLower)) return true;
          // Search in material_sku_id
          if (record.material_sku_id?.toLowerCase().includes(searchLower)) return true;
          // Search in material_sku name
          if (record.material_sku?.sku_name?.toLowerCase().includes(searchLower)) return true;
          return false;
        });
      }

      return { data: filteredData, error: null };
    } catch (err) {
      console.error('Error in getAllBomSkus:', err);
      return { data: [], error: 'เกิดข้อผิดพลาดในการดึงข้อมูล BOM' };
    }
  }

  // Get BOM record by ID
  static async getBomSkuById(id: number) {
    try {
      const { data, error } = await supabase
        .from('bom_sku')
        .select(`
          *,
          finished_sku:master_sku!fk_finished_sku(sku_id, sku_name, uom_base),
          material_sku:master_sku!fk_material_sku(sku_id, sku_name, uom_base)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching BOM record:', error);
        return { data: null, error: error.message };
      }

      return { data: data as BomSkuWithDetails, error: null };
    } catch (err) {
      console.error('Error in getBomSkuById:', err);
      return { data: null, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล BOM' };
    }
  }

  // Create new BOM record
  static async createBomSku(bomData: CreateBomSkuData) {
    try {
      const { data, error } = await supabase
        .from('bom_sku')
        .insert([bomData])
        .select()
        .single();

      if (error) {
        console.error('Error creating BOM record:', error);
        return { data: null, error: error.message };
      }

      return { data: data as BomSku, error: null };
    } catch (err) {
      console.error('Error in createBomSku:', err);
      return { data: null, error: 'เกิดข้อผิดพลาดในการสร้างข้อมูล BOM' };
    }
  }

  // Update BOM record
  static async updateBomSku(updateData: UpdateBomSkuData) {
    try {
      const { id, ...dataToUpdate } = updateData;
      
      const { data, error } = await supabase
        .from('bom_sku')
        .update(dataToUpdate)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating BOM record:', error);
        return { data: null, error: error.message };
      }

      return { data: data as BomSku, error: null };
    } catch (err) {
      console.error('Error in updateBomSku:', err);
      return { data: null, error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล BOM' };
    }
  }

  // Delete BOM record
  static async deleteBomSku(id: number) {
    try {
      const { error } = await supabase
        .from('bom_sku')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting BOM record:', error);
        return { error: error.message };
      }

      return { error: null };
    } catch (err) {
      console.error('Error in deleteBomSku:', err);
      return { error: 'เกิดข้อผิดพลาดในการลบข้อมูล BOM' };
    }
  }

  // Get unique BOM IDs for filtering
  static async getBomIds() {
    try {
      const { data, error } = await supabase
        .from('bom_sku')
        .select('bom_id')
        .order('bom_id');

      if (error) {
        console.error('Error fetching BOM IDs:', error);
        return { data: [], error: error.message };
      }

      // Get unique BOM IDs
      const uniqueBomIds = [...new Set(data.map(item => item.bom_id))];
      return { data: uniqueBomIds, error: null };
    } catch (err) {
      console.error('Error in getBomIds:', err);
      return { data: [], error: 'เกิดข้อผิดพลาดในการดึงรายการ BOM ID' };
    }
  }

  // Get BOM records by BOM ID
  static async getBomSkusByBomId(bomId: string) {
    try {
      const { data, error } = await supabase
        .from('bom_sku')
        .select(`
          *,
          finished_sku:master_sku!fk_finished_sku(sku_id, sku_name, uom_base),
          material_sku:master_sku!fk_material_sku(sku_id, sku_name, uom_base)
        `)
        .eq('bom_id', bomId)
        .order('step_order', { ascending: true });

      if (error) {
        console.error('Error fetching BOM records by BOM ID:', error);
        return { data: [], error: error.message };
      }

      return { data: data as BomSkuWithDetails[], error: null };
    } catch (err) {
      console.error('Error in getBomSkusByBomId:', err);
      return { data: [], error: 'เกิดข้อผิดพลาดในการดึงข้อมูล BOM' };
    }
  }
}

export const bomSkuService = BomSkuService;