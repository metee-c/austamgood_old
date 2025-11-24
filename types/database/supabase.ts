// Temporary placeholder types until database types can be regenerated
// Run `npm run db:generate-types` when Supabase access is available

export type MasterSku = {
  sku_id: string
  sku_name: string
  sku_description?: string
  barcode?: string
  category?: string
  sub_category?: string
  brand?: string
  uom?: string
  weight_kg?: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
  supplier_id?: string
  reorder_level?: number
  storage_strategy_id?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export type MasterSkuInsert = Omit<MasterSku, 'created_at' | 'updated_at'>
export type MasterSkuUpdate = Partial<MasterSkuInsert>

export type Database = {
  public: {
    Tables: {
      master_sku: {
        Row: MasterSku
        Insert: MasterSkuInsert
        Update: MasterSkuUpdate
      }
      [key: string]: any
    }
  }
}
