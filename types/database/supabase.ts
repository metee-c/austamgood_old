/**
 * Supabase Database Types
 * Auto-generated types from database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      master_sku: {
        Row: MasterSku
        Insert: MasterSkuInsert
        Update: MasterSkuUpdate
      }
      [key: string]: {
        Row: { [key: string]: any }
        Insert: { [key: string]: any }
        Update: { [key: string]: any }
      }
    }
    Views: {
      [key: string]: {
        Row: { [key: string]: any }
      }
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      [key: string]: string
    }
  }
}

// Master SKU types
export interface MasterSku {
  sku_id: string
  sku_name: string
  barcode?: string
  category?: string
  brand?: string
  uom_base: string
  uom_pack?: string
  qty_per_pack?: number
  qty_per_pallet?: number
  weight_per_piece?: number
  default_location?: string
  min_stock_qty?: number
  max_stock_qty?: number
  status: 'active' | 'inactive'
  created_at?: string
  updated_at?: string
  created_by?: string
  updated_by?: string
}

export interface MasterSkuInsert {
  sku_id: string
  sku_name: string
  barcode?: string
  category?: string
  brand?: string
  uom_base?: string
  uom_pack?: string
  qty_per_pack?: number
  qty_per_pallet?: number
  weight_per_piece?: number
  default_location?: string
  min_stock_qty?: number
  max_stock_qty?: number
  status?: 'active' | 'inactive'
  created_by?: string
}

export interface MasterSkuUpdate {
  sku_name?: string
  barcode?: string
  category?: string
  brand?: string
  uom_base?: string
  uom_pack?: string
  qty_per_pack?: number
  qty_per_pallet?: number
  weight_per_piece?: number
  default_location?: string
  min_stock_qty?: number
  max_stock_qty?: number
  status?: 'active' | 'inactive'
  updated_by?: string
}
