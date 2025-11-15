// Re-export warehouse types for compatibility
export type {
  MasterWarehouse,
  LocationWithWarehouse,
  LocationFilters
} from '@/types/database/warehouse'

// Alias for backward compatibility
export type { MasterWarehouse as Warehouse } from '@/types/database/warehouse'