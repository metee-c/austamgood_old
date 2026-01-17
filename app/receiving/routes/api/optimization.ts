// API functions for VRP Optimization
// Centralize all optimization-related API calls

import type {
  OptimizeRoutePlanRequest,
  OptimizationResult,
  ApiResponse,
} from './types';
import { ApiError } from './types';

// ============ Helper Functions ============

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
 * Optimize route plan using VRP algorithm
 */
export async function optimizeRoutePlan(
  data: OptimizeRoutePlanRequest
): Promise<ApiResponse<OptimizationResult>> {
  const response = await fetch('/api/route-plans/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  return handleResponse<ApiResponse<OptimizationResult>>(response);
}

/**
 * Preview optimization results without saving
 */
export async function previewOptimization(
  data: OptimizeRoutePlanRequest
): Promise<ApiResponse<OptimizationResult>> {
  const response = await fetch('/api/route-plans/optimize/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  return handleResponse<ApiResponse<OptimizationResult>>(response);
}

/**
 * Re-optimize existing plan
 */
export async function reoptimizePlan(
  planId: number | string,
  settings?: Record<string, any>
): Promise<ApiResponse<OptimizationResult>> {
  const response = await fetch(`/api/route-plans/${planId}/reoptimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  
  return handleResponse<ApiResponse<OptimizationResult>>(response);
}

/**
 * Calculate route metrics
 */
export async function calculateRouteMetrics(
  trips: any[]
): Promise<ApiResponse<any>> {
  const response = await fetch('/api/route-plans/calculate-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trips }),
  });
  
  return handleResponse<ApiResponse<any>>(response);
}

/**
 * Validate optimization settings
 */
export async function validateOptimizationSettings(
  settings: Record<string, any>
): Promise<ApiResponse<{ valid: boolean; errors?: string[] }>> {
  const response = await fetch('/api/route-plans/validate-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  
  return handleResponse<ApiResponse<{ valid: boolean; errors?: string[] }>>(response);
}
