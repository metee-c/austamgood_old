// Generated TypeScript types for Supabase database tables
// This file contains type definitions for database operations

// Enums
export type SkuStatus = 'active' | 'inactive';
export type PutawayRotationMethod = 'FIFO' | 'LIFO' | 'FEFO' | 'LEFO';

// Master SKU Table Types
export interface MasterSkuRow {
  sku_id: string;
  sku_name: string;
  sku_description: string | null;
  category: string | null;
  sub_category: string | null;
  brand: string | null;
  product_type: string | null;
  uom_base: string;
  qty_per_pack: number | null;
  qty_per_pallet: number | null;
  weight_per_piece_kg: number | null;
  weight_per_pack_kg: number | null;
  weight_per_pallet_kg: number | null;
  dimension_length_cm: number | null;
  dimension_width_cm: number | null;
  dimension_height_cm: number | null;
  barcode: string | null;
  pack_barcode: string | null;
  pallet_barcode: string | null;
  storage_condition: string | null;
  shelf_life_days: number | null;
  lot_tracking_required: boolean | null;
  expiry_date_required: boolean | null;
  reorder_point: number | null;
  safety_stock: number | null;
  default_location: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
  status: SkuStatus | null;
  storage_class: string | null;
  hazard_class: string | null;
  abc_class: string | null;
  putaway_rotation_method: PutawayRotationMethod | null;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  humidity_min_percent: number | null;
  humidity_max_percent: number | null;
  allow_mixed_expiry: boolean | null;
  allow_mixed_lot: boolean | null;
  prefer_full_pallet: boolean | null;
  default_storage_strategy_id: string | null;
  storage_notes: string | null;
}

export interface MasterSkuInsert {
  sku_id: string;
  sku_name: string;
  sku_description?: string | null;
  category?: string | null;
  sub_category?: string | null;
  brand?: string | null;
  product_type?: string | null;
  uom_base: string;
  qty_per_pack?: number | null;
  qty_per_pallet?: number | null;
  weight_per_piece_kg?: number | null;
  weight_per_pack_kg?: number | null;
  weight_per_pallet_kg?: number | null;
  dimension_length_cm?: number | null;
  dimension_width_cm?: number | null;
  dimension_height_cm?: number | null;
  barcode?: string | null;
  pack_barcode?: string | null;
  pallet_barcode?: string | null;
  storage_condition?: string | null;
  shelf_life_days?: number | null;
  lot_tracking_required?: boolean | null;
  expiry_date_required?: boolean | null;
  reorder_point?: number | null;
  safety_stock?: number | null;
  default_location?: string | null;
  created_by: string;
  created_at?: string | null;
  updated_at?: string | null;
  status?: SkuStatus | null;
  storage_class?: string | null;
  hazard_class?: string | null;
  abc_class?: string | null;
  putaway_rotation_method?: PutawayRotationMethod | null;
  temperature_min_c?: number | null;
  temperature_max_c?: number | null;
  humidity_min_percent?: number | null;
  humidity_max_percent?: number | null;
  allow_mixed_expiry?: boolean | null;
  allow_mixed_lot?: boolean | null;
  prefer_full_pallet?: boolean | null;
  default_storage_strategy_id?: string | null;
  storage_notes?: string | null;
}

export interface MasterSkuUpdate {
  sku_id?: string;
  sku_name?: string;
  sku_description?: string | null;
  category?: string | null;
  sub_category?: string | null;
  brand?: string | null;
  product_type?: string | null;
  uom_base?: string;
  qty_per_pack?: number | null;
  qty_per_pallet?: number | null;
  weight_per_piece_kg?: number | null;
  weight_per_pack_kg?: number | null;
  weight_per_pallet_kg?: number | null;
  dimension_length_cm?: number | null;
  dimension_width_cm?: number | null;
  dimension_height_cm?: number | null;
  barcode?: string | null;
  pack_barcode?: string | null;
  pallet_barcode?: string | null;
  storage_condition?: string | null;
  shelf_life_days?: number | null;
  lot_tracking_required?: boolean | null;
  expiry_date_required?: boolean | null;
  reorder_point?: number | null;
  safety_stock?: number | null;
  default_location?: string | null;
  created_by?: string;
  created_at?: string | null;
  updated_at?: string | null;
  status?: SkuStatus | null;
  storage_class?: string | null;
  hazard_class?: string | null;
  abc_class?: string | null;
  putaway_rotation_method?: PutawayRotationMethod | null;
  temperature_min_c?: number | null;
  temperature_max_c?: number | null;
  humidity_min_percent?: number | null;
  humidity_max_percent?: number | null;
  allow_mixed_expiry?: boolean | null;
  allow_mixed_lot?: boolean | null;
  prefer_full_pallet?: boolean | null;
  default_storage_strategy_id?: string | null;
  storage_notes?: string | null;
}
