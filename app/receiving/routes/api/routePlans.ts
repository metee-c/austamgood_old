// API functions for Route Plans
// Centralize all API calls related to route plans

import type {
  FetchRoutePlansParams,
  CreateRoutePlanRequest,
  UpdateRoutePlanRequest,
  BatchUpdateRequest,
  RoutePlansResponse,
  EditorDataResponse,
  DeleteCheckResponse,
  ApiResponse,
} from './types';
import { ApiError } from './types';

// ============ Helper Functions ============

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  
  return searchParams.toString();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || 'เกิดข้อผิดพลาด',
      response.status,
      errorData.details
    );
  }
  
  return response.json();
}

// ============ API Functions ============

/**
 * Fetch route plans with filters and pagination
 */
export async function fetchRoutePlans(
  params: FetchRoutePlansParams = {},
  signal?: AbortSignal
): Promise<RoutePlansResponse> {
  const queryString = buildQueryString({
    page: params.page || 1,
    pageSize: params.pageSize || 20,
    warehouseId: params.warehouseId,
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
  });
  
  const response = await fetch(`/api/route-plans?${queryString}`, { signal });
  return handleResponse<RoutePlansResponse>(response);
}

/**
 * Fetch single route plan by ID
 */
export async function fetchRoutePlanById(
  planId: number | string,
  signal?: AbortSignal
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/route-plans/${planId}`, { signal });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Create new route plan
 */
export async function createRoutePlan(
  data: CreateRoutePlanRequest
): Promise<ApiResponse<any>> {
  const response = await fetch('/api/route-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Update route plan
 */
export async function updateRoutePlan(
  planId: number | string,
  data: UpdateRoutePlanRequest
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/route-plans/${planId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Delete route plan
 */
export async function deleteRoutePlan(
  planId: number | string
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/route-plans/${planId}/delete`, {
    method: 'DELETE',
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Check if route plan can be deleted
 */
export async function checkCanDelete(
  planId: number | string
): Promise<DeleteCheckResponse> {
  const response = await fetch(`/api/route-plans/${planId}/can-delete`);
  return handleResponse<DeleteCheckResponse>(response);
}

/**
 * Fetch editor data for route plan
 */
export async function fetchEditorData(
  planId: number | string,
  signal?: AbortSignal
): Promise<ApiResponse<EditorDataResponse>> {
  const response = await fetch(`/api/route-plans/${planId}/editor`, { signal });
  return handleResponse<ApiResponse<EditorDataResponse>>(response);
}

/**
 * Save editor data (batch update)
 */
export async function saveEditorData(
  planId: number | string,
  data: BatchUpdateRequest
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/route-plans/${planId}/batch-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Fetch draft orders for warehouse
 */
export async function fetchDraftOrders(
  warehouseId: string,
  planDate?: string,
  forEditor?: boolean,
  signal?: AbortSignal
): Promise<ApiResponse<any[]>> {
  const queryString = buildQueryString({
    warehouseId,
    planDate,
    forEditor: forEditor ? 'true' : undefined,
  });
  
  const response = await fetch(`/api/route-plans/draft-orders?${queryString}`, { signal });
  return handleResponse<ApiResponse<any[]>>(response);
}

/**
 * Fetch next plan code
 */
export async function fetchNextPlanCode(
  planDate: string
): Promise<ApiResponse<{ plan_code: string; plan_name: string }>> {
  const response = await fetch(`/api/route-plans/next-code?date=${planDate}`);
  return handleResponse<ApiResponse<{ plan_code: string; plan_name: string }>>(response);
}

/**
 * Fetch trips for a plan
 */
export async function fetchPlanTrips(
  planId: number | string,
  signal?: AbortSignal
): Promise<ApiResponse<any[]>> {
  const response = await fetch(`/api/route-plans/${planId}/trips`, { signal });
  return handleResponse<ApiResponse<any[]>>(response);
}

/**
 * Add order to plan
 */
export async function addOrderToPlan(
  planId: number | string,
  orderId: number
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/route-plans/${planId}/add-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Split stop
 */
export async function splitStop(
  planId: number | string,
  data: any
): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/route-plans/${planId}/split-stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Cross-plan transfer
 */
export async function crossPlanTransfer(
  data: any
): Promise<ApiResponse<any>> {
  const response = await fetch('/api/route-plans/cross-plan-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Fetch trips by supplier
 */
export async function fetchTripsBySupplier(
  supplierName: string,
  signal?: AbortSignal
): Promise<ApiResponse<any[]>> {
  const response = await fetch(
    `/api/route-plans/trips-by-supplier?supplier=${encodeURIComponent(supplierName)}`,
    { signal }
  );
  return handleResponse<ApiResponse<any[]>>(response);
}

/**
 * Fetch all trips
 */
export async function fetchAllTrips(
  signal?: AbortSignal
): Promise<ApiResponse<any[]>> {
  const response = await fetch('/api/route-plans/all-trips', { signal });
  return handleResponse<ApiResponse<any[]>>(response);
}

/**
 * Fetch published plans
 */
export async function fetchPublishedPlans(
  signal?: AbortSignal
): Promise<ApiResponse<any[]>> {
  const response = await fetch('/api/route-plans/published', { signal });
  return handleResponse<ApiResponse<any[]>>(response);
}
