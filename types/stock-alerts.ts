/**
 * Stock Replenishment Alerts Types
 * สำหรับระบบแจ้งเตือนการเติมสต็อกในพื้นที่หยิบสินค้า
 */

export type StockAlertStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface SuggestedSource {
  location_id: string;
  location_code: string;
  available_qty: number;
  expiry_date?: string;
  production_date?: string;
  pallet_id?: string;
}

export interface StockReplenishmentAlert {
  alert_id: string;
  warehouse_id: string;
  sku_id: string;
  pick_location_id: string;

  // Stock information
  required_qty: number;
  current_qty: number;
  shortage_qty: number;
  pallets_needed: number;

  // Replenishment rules
  min_stock_qty?: number;
  max_stock_qty?: number;
  replen_qty?: number;

  // Source recommendations (FEFO search results)
  suggested_sources?: SuggestedSource[];

  // Alert metadata
  alert_reason: string;
  picklist_id?: number;  // bigint from database
  priority: number;
  status: StockAlertStatus;

  // Audit fields
  created_at: string;
  created_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  notes?: string;
}

export interface ActiveStockAlert extends StockReplenishmentAlert {
  // Additional fields from view
  warehouse_name: string;
  sku_name: string;
  sku_code: string;
  uom_base: string;
  qty_per_pallet: number;
  pick_location_code: string;
  pick_location_name: string;
  picklist_code?: string;
  hours_since_alert: number;
}

export interface AlertCheckResult {
  alert_created: boolean;
  alert_id?: string;
  shortage_qty: number;
  message: string;
}
