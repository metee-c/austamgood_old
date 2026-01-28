/**
 * Types for Online Packing Module
 *
 * These types are used across the online-packing pages
 */

export interface Order {
  id: string
  order_number: string
  buyer_name: string
  tracking_number?: string | null
  parent_sku?: string | null
  product_name?: string | null
  quantity?: number | null
  fulfillment_status: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
  packing_status?: 'pending' | 'in_progress' | 'completed' | null
  completed_at?: string | null
  packed_at?: string | null
  platform: string
  shipping_provider?: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  // New master_sku columns
  sku_id: string
  sku_name: string
  ecommerce_name?: string | null
  barcode?: string | null
  is_sample?: boolean | null
  // Computed/alias properties for backward compatibility
  id?: string
  parent_sku?: string
  product_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface PackingOrder {
  id: string
  order_number: string
  buyer_name: string
  tracking_number: string
  platform: string
  sample_alert?: string | null
  items: PackingItem[]
}

export interface PackingItem {
  id: string
  parent_sku: string
  product_name: string
  quantity: number
  scanned_quantity: number
  is_completed: boolean
  freebie_display_name?: string | null
  bundle_info?: {
    parent_sku: string
    parent_name: string
    bundle_quantity: number
    item_per_bundle: number
  }
}

export interface DashboardStats {
  total_orders: number
  pending_orders: number
  processing_orders: number
  packed_orders: number
  shipped_orders: number
  delivered_orders: number
  cancelled_orders: number
}

export interface Box {
  id: string
  box_code: string
  box_name: string
  width_cm: number
  length_cm: number
  height_cm: number
  volume: number
  weight_kg: number
  max_weight_kg: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductWeightProfile {
  id: string
  weight_kg: number
  description: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface PackingRule {
  id: string
  product_weight_profile_id: string
  box_id: string
  min_quantity: number
  max_quantity: number
  priority: number
  created_at: string
  updated_at: string
}

export interface BoxStock {
  box_code: string
  stock_quantity: number
  updated_at: string
}

export interface Promotion {
  id: string
  promotion_name: string
  platform: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PromotionFreebie {
  id: string
  promotion_id: string
  freebie_parent_skus: string[]
  freebie_display_name: string
  quantity_per_order: number
  is_random: boolean
  stock_quantity: number
  total_distributed: number
  created_at: string
  updated_at: string
}

export interface ReturnRequest {
  id: string
  order_number: string
  buyer_name: string
  return_reason: string
  return_date: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  notes?: string | null
  image_urls?: string[] | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PackingUser {
  id: string
  user_code?: string | null
  username: string
  full_name: string
  email?: string | null
  role: 'admin' | 'manager' | 'operator'
  is_active: boolean
  last_login?: string | null
  created_at: string
  updated_at: string
}

export interface UserPermission {
  id: string
  user_id: string
  menu_path: string
  can_access: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
  created_at: string
  updated_at: string
}
