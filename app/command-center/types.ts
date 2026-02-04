// app/command-center/types.ts
// Type definitions for Command Center

export interface CommandCenterActivity {
  log_id: number;
  transaction_id: string | null;
  activity_type: string;
  activity_status: 'success' | 'failed' | 'partial';
  entity_type: string | null;
  entity_id: string | null;
  entity_no: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  sku_id: string | null;
  pallet_id: string | null;
  qty_before: number | null;
  qty_after: number | null;
  qty_delta: number | null;
  reserved_before: number | null;
  reserved_after: number | null;
  duration_ms: number | null;
  logged_at: string;
  remarks: string | null;
  metadata: any;
  operation_type: string | null;
  operation_subtype: string | null;
  request_path: string | null;
  request_method: string | null;
  request_body: any;
  transaction_status: string | null;
  user_id: number | null;
  ip_address: string | null;
  username: string | null;
  user_full_name: string | null;
  error_message: string | null;
  error_code: string | null;
  total_count: number;
}

export interface CommandCenterFilters {
  search?: string;
  activity_type?: string;
  status?: string;
  entity_type?: string;
  user_id?: string;
  request_method?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface CommandCenterFilterOptions {
  activity_types: string[];
  entity_types: string[];
  operation_types: string[];
  request_methods: string[];
  users: { user_id: number; username: string; full_name: string }[];
}

export interface CommandCenterError {
  error_id: number;
  transaction_id: string | null;
  error_code: string | null;
  error_message: string;
  error_stack: string | null;
  operation_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  user_id: number | null;
  request_path: string | null;
  request_body: any;
  occurred_at: string;
  metadata: any;
  username?: string;
  user_full_name?: string;
}

export type TabType = 'activities' | 'errors' | 'health' | 'stock';
