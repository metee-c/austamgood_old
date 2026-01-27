import { createClient } from '@/lib/supabase/client'

export type MasterSku = any
export type MasterSkuInsert = any
export type MasterSkuUpdate = any

export interface MasterSkuFilters {
  search?: string
  category?: string
  brand?: string
  status?: 'active' | 'inactive'
  limit?: number
  offset?: number
}

export interface MasterSkuStats {
  totalItems: number
  activeItems: number
  inactiveItems: number
  categoriesCount: number
  brandsCount: number
}

export class MasterSkuService {
  private supabase = createClient()

  async getAllMasterSkus(filters: MasterSkuFilters = {}): Promise<{ data: MasterSku[]; error: string | null }> {
    try {
      let query = this.supabase
        .from('master_sku')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.search) {
        // Escape LIKE wildcards only (% and _)
        // Note: | is NOT a special character in PostgREST filter syntax
        const escapedSearch = filters.search
          .replace(/\\/g, '\\\\')  // Escape backslash first
          .replace(/%/g, '\\%')    // Escape percent (LIKE wildcard)
          .replace(/_/g, '\\_')    // Escape underscore (LIKE single char wildcard)
        query = query.or(`sku_name.ilike.%${escapedSearch}%,sku_id.ilike.%${escapedSearch}%,barcode.ilike.%${escapedSearch}%`)
      }

      if (filters.category) {
        query = query.eq('category', filters.category)
      }

      if (filters.brand) {
        query = query.eq('brand', filters.brand)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching master SKUs:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in getAllMasterSkus:', error)
      return { data: [], error: 'Failed to fetch master SKUs' }
    }
  }

  async getMasterSkuById(skuId: string): Promise<{ data: MasterSku | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_sku')
        .select('*')
        .eq('sku_id', skuId)
        .single()

      if (error) {
        console.error('Error fetching master SKU by ID:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error in getMasterSkuById:', error)
      return { data: null, error: 'Failed to fetch master SKU' }
    }
  }

  async createMasterSku(masterSku: MasterSkuInsert): Promise<{ data: MasterSku | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_sku')
        .insert(masterSku)
        .select()
        .single()

      if (error) {
        console.error('Error creating master SKU:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error in createMasterSku:', error)
      return { data: null, error: 'Failed to create master SKU' }
    }
  }

  async updateMasterSku(skuId: string, updates: MasterSkuUpdate): Promise<{ data: MasterSku | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_sku')
        .update(updates)
        .eq('sku_id', skuId)
        .select()
        .single()

      if (error) {
        console.error('Error updating master SKU:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error in updateMasterSku:', error)
      return { data: null, error: 'Failed to update master SKU' }
    }
  }

  async deleteMasterSku(skuId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase
        .from('master_sku')
        .delete()
        .eq('sku_id', skuId)

      if (error) {
        console.error('Error deleting master SKU:', error)
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      console.error('Error in deleteMasterSku:', error)
      return { error: 'Failed to delete master SKU' }
    }
  }

  async getMasterSkuStats(): Promise<{ data: MasterSkuStats | null; error: string | null }> {
    try {
      // Get total count
      const { count: totalItems, error: totalError } = await this.supabase
        .from('master_sku')
        .select('*', { count: 'exact', head: true })

      if (totalError) {
        return { data: null, error: totalError.message }
      }

      // Get active count
      const { count: activeItems, error: activeError } = await this.supabase
        .from('master_sku')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if (activeError) {
        return { data: null, error: activeError.message }
      }

      // Get distinct categories
      const { data: categories, error: categoriesError } = await this.supabase
        .from('master_sku')
        .select('category')
        .not('category', 'is', null)

      if (categoriesError) {
        return { data: null, error: categoriesError.message }
      }

      // Get distinct brands
      const { data: brands, error: brandsError } = await this.supabase
        .from('master_sku')
        .select('brand')
        .not('brand', 'is', null)

      if (brandsError) {
        return { data: null, error: brandsError.message }
      }

      const uniqueCategories = new Set(categories?.map(c => c.category).filter(Boolean))
      const uniqueBrands = new Set(brands?.map(b => b.brand).filter(Boolean))

      const stats: MasterSkuStats = {
        totalItems: totalItems || 0,
        activeItems: activeItems || 0,
        inactiveItems: (totalItems || 0) - (activeItems || 0),
        categoriesCount: uniqueCategories.size,
        brandsCount: uniqueBrands.size
      }

      return { data: stats, error: null }
    } catch (error) {
      console.error('Error in getMasterSkuStats:', error)
      return { data: null, error: 'Failed to fetch master SKU statistics' }
    }
  }

  async getCategories(): Promise<{ data: string[]; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_sku')
        .select('category')
        .not('category', 'is', null)

      if (error) {
        return { data: [], error: error.message }
      }

      const uniqueCategories = Array.from(new Set(data?.map(item => item.category).filter(Boolean)))
      return { data: uniqueCategories, error: null }
    } catch (error) {
      console.error('Error in getCategories:', error)
      return { data: [], error: 'Failed to fetch categories' }
    }
  }

  async getBrands(): Promise<{ data: string[]; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_sku')
        .select('brand')
        .not('brand', 'is', null)

      if (error) {
        return { data: [], error: error.message }
      }

      const uniqueBrands = Array.from(new Set(data?.map(item => item.brand).filter(Boolean)))
      return { data: uniqueBrands, error: null }
    } catch (error) {
      console.error('Error in getBrands:', error)
      return { data: [], error: 'Failed to fetch brands' }
    }
  }
}

// Export a singleton instance
export const masterSkuService = new MasterSkuService()