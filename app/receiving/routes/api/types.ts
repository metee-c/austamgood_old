// API Types for Route Plans
// แยก types สำหรับ API requests/responses

import type { RoutePlan, EditorTrip } from '../types';

// ============ Request Types ============

export interface FetchRoutePlansParams {
  page?: number;
  pageSize?: number;
  warehouseId?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string;
}

export interface CreateRoutePlanRequest {
  plan_code: string;
  plan_name: string;
  plan_date: string;
  warehouse_id: string;
  order_ids: number[];
  settings?: Record<string, any>;
}

export interface UpdateRoutePlanRequest {
  plan_name?: string;
  plan_date?: string;
  status?: string;
  trips?: EditorTrip[];
}

export interface OptimizeRoutePlanRequest {
  plan: {
    plan_code: string;
    plan_name: string;
    plan_date: string;
    warehouse_id: string;
  };
  order_ids: number[];
  settings: Record<string, any>;
}

export interface BatchUpdateRequest {
  trips?: Array<{
    trip_id: string;
    vehicle_id?: string | null;
    driver_id?: string | null;
    trip_index?: number;
  }>;
  stops?: Array<{
    stop_id: string;
    trip_id: string;
    sequence: number;
  }>;
  deletedStopIds?: string[];
  deletedTripIds?: string[];
}

// ============ Response Types ============

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface RoutePlansResponse extends PaginatedResponse<RoutePlan> {}

export interface EditorDataResponse {
  plan: any;
  warehouse: {
    latitude: number;
    longitude: number;
    name?: string | null;
  } | null;
  trips: EditorTrip[];
}

export interface OptimizationResult {
  plan: any;
  trips: any[];
  metrics: {
    totalDistance: number;
    totalDuration: number;
    totalTrips: number;
    totalStops: number;
  };
}

export interface DeleteCheckResponse {
  can_delete: boolean;
  reason?: string;
  plan_code: string;
  picklists_count?: number;
  active_orders?: string[];
  warning?: string;
}

// ============ Error Types ============

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorResponse {
  error: string;
  details?: any;
  status?: number;
}
