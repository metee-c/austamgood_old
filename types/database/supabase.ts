// Stub Database type for build compatibility
export interface Database {
  public: {
    Tables: {
      master_sku: {
        Row: MasterSku;
        Insert: MasterSkuInsert;
        Update: MasterSkuUpdate;
      };
      [key: string]: any;
    };
    Views: {
      [key: string]: any;
    };
    Functions: {
      [key: string]: any;
    };
    Enums: {
      [key: string]: any;
    };
  };
}

export interface MasterSku {
  sku_id: string;
  sku_name: string;
  sku_description?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  product_type?: string;
  uom_base: string;
  qty_per_pack: number;
  qty_per_pallet?: number;
  weight_per_piece_kg?: number;
  weight_per_pack_kg?: number;
  weight_per_pallet_kg?: number;
  dimension_length_cm?: number;
  dimension_width_cm?: number;
  dimension_height_cm?: number;
  barcode?: string;
  pack_barcode?: string;
  pallet_barcode?: string;
  storage_condition?: string;
  shelf_life_days?: number;
  lot_tracking_required: boolean;
  expiry_date_required: boolean;
  reorder_point: number;
  safety_stock: number;
  default_location?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
}

export interface MasterSkuInsert {
  sku_id: string;
  sku_name: string;
  sku_description?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  product_type?: string;
  uom_base: string;
  qty_per_pack?: number;
  qty_per_pallet?: number;
  weight_per_piece_kg?: number;
  weight_per_pack_kg?: number;
  weight_per_pallet_kg?: number;
  dimension_length_cm?: number;
  dimension_width_cm?: number;
  dimension_height_cm?: number;
  barcode?: string;
  pack_barcode?: string;
  pallet_barcode?: string;
  storage_condition?: string;
  shelf_life_days?: number;
  lot_tracking_required?: boolean;
  expiry_date_required?: boolean;
  reorder_point?: number;
  safety_stock?: number;
  default_location?: string;
  created_by: string;
  status?: 'active' | 'inactive';
}

export interface MasterSkuUpdate {
  sku_name?: string;
  sku_description?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  product_type?: string;
  uom_base?: string;
  qty_per_pack?: number;
  qty_per_pallet?: number;
  weight_per_piece_kg?: number;
  weight_per_pack_kg?: number;
  weight_per_pallet_kg?: number;
  dimension_length_cm?: number;
  dimension_width_cm?: number;
  dimension_height_cm?: number;
  barcode?: string;
  pack_barcode?: string;
  pallet_barcode?: string;
  storage_condition?: string;
  shelf_life_days?: number;
  lot_tracking_required?: boolean;
  expiry_date_required?: boolean;
  reorder_point?: number;
  safety_stock?: number;
  default_location?: string;
  status?: 'active' | 'inactive';
}