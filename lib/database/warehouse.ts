import { createClient } from '@/lib/supabase/client'

export interface LocationFilters {
  search?: string
  warehouse_id?: string
  zone?: string
  location_type?: 'rack' | 'floor' | 'bulk' | 'other'
  limit?: number
  offset?: number
}

export interface LocationWithWarehouse {
  location_id: string
  location_code: string
  location_name?: string
  warehouse_id: string
  warehouse_name?: string
  warehouse?: {
    warehouse_name: string
  }
  location_type: 'rack' | 'floor' | 'bulk' | 'other'
  zone?: string
  max_capacity_qty?: number
  max_capacity_weight_kg?: number
  current_qty?: number
  current_weight_kg?: number
  putaway_strategy?: string
  aisle?: string
  rack?: string
  shelf?: string
  bin?: string
  temperature_controlled?: boolean
  humidity_controlled?: boolean
  active_status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  remarks?: string
}

export interface MasterWarehouse {
  warehouse_id: string
  warehouse_name: string
  warehouse_type: 'central' | 'branch' | 'crossdock' | 'other'
  address?: string
  contact_person?: string
  phone?: string
  email?: string
  capacity_qty: number
  capacity_weight_kg?: number
  active_status: 'active' | 'inactive'
  created_by: string
  created_at: string
  updated_at: string
  remarks?: string
}

export interface CreateLocationData {
  location_id: string
  warehouse_id: string
  warehouse_name?: string
  location_code: string
  location_name?: string
  location_type?: 'rack' | 'floor' | 'bulk' | 'other'
  max_capacity_qty?: number
  max_capacity_weight_kg?: number
  current_qty?: number
  current_weight_kg?: number
  putaway_strategy?: string
  zone?: string
  aisle?: string
  rack?: string
  shelf?: string
  bin?: string
  temperature_controlled?: boolean
  humidity_controlled?: boolean
  active_status?: 'active' | 'inactive'
  created_by: string
  remarks?: string
}

export interface UpdateLocationData {
  location_id?: string
  warehouse_id?: string
  warehouse_name?: string
  location_code?: string
  location_name?: string
  location_type?: 'rack' | 'floor' | 'bulk' | 'other'
  max_capacity_qty?: number
  max_capacity_weight_kg?: number
  current_qty?: number
  current_weight_kg?: number
  putaway_strategy?: string
  zone?: string
  aisle?: string
  rack?: string
  shelf?: string
  bin?: string
  temperature_controlled?: boolean
  humidity_controlled?: boolean
  active_status?: 'active' | 'inactive'
  remarks?: string
}

export class LocationService {
  private supabase = createClient()

  async getAllLocations(filters: LocationFilters = {}): Promise<{ data: LocationWithWarehouse[]; error: string | null }> {
    try {
      let query = this.supabase
        .from('master_location')
        .select(`
          *,
          warehouse:master_warehouse(warehouse_name)
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.search) {
        query = query.or(`location_code.ilike.%${filters.search}%,location_name.ilike.%${filters.search}%`)
      }

      if (filters.warehouse_id) {
        query = query.eq('warehouse_id', filters.warehouse_id)
      }

      if (filters.zone) {
        query = query.eq('zone', filters.zone)
      }

      if (filters.location_type) {
        query = query.eq('location_type', filters.location_type)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching locations:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in getAllLocations:', error)
      return { data: [], error: 'Failed to fetch locations' }
    }
  }

  async getZones(): Promise<{ data: string[]; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_location')
        .select('zone')
        .not('zone', 'is', null)

      if (error) {
        return { data: [], error: error.message }
      }

      const uniqueZones = Array.from(new Set(data?.map(item => item.zone).filter(Boolean)))
      return { data: uniqueZones, error: null }
    } catch (error) {
      console.error('Error in getZones:', error)
      return { data: [], error: 'Failed to fetch zones' }
    }
  }

  async createLocation(locationData: CreateLocationData): Promise<{ data: LocationWithWarehouse | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_location')
        .insert(locationData)
        .select('*')
        .single()

      if (error) {
        console.error('Error creating location:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error in createLocation:', error)
      return { data: null, error: 'Failed to create location' }
    }
  }

  async updateLocation(updateData: UpdateLocationData): Promise<{ data: LocationWithWarehouse | null; error: string | null }> {
    try {
      const { location_id, ...dataToUpdate } = updateData;
      
      if (!location_id) {
        return { data: null, error: 'Location ID is required for update' };
      }

      const { data, error } = await this.supabase
        .from('master_location')
        .update(dataToUpdate)
        .eq('location_id', location_id)
        .select('*')
        .single()

      if (error) {
        console.error('Error updating location:', error)
        return { data: null, error: error.message }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error in updateLocation:', error)
      return { data: null, error: 'Failed to update location' }
    }
  }

  async deleteLocation(locationId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await this.supabase
        .from('master_location')
        .delete()
        .eq('location_id', locationId)

      if (error) {
        console.error('Error deleting location:', error)
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      console.error('Error in deleteLocation:', error)
      return { error: 'Failed to delete location' }
    }
  }
}

export class WarehouseService {
  private supabase = createClient()

  async getAllWarehouses(): Promise<{ data: MasterWarehouse[]; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('master_warehouse')
        .select('*')
        .order('warehouse_name')

      if (error) {
        console.error('Error fetching warehouses:', error)
        return { data: [], error: error.message }
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in getAllWarehouses:', error)
      return { data: [], error: 'Failed to fetch warehouses' }
    }
  }
}

// Export singleton instances
export const locationService = new LocationService()
export const warehouseService = new WarehouseService()