# API Reference - Route Planning System

> **Module:** Receiving Routes  
> **Version:** 2.0  
> **Last Updated:** January 18, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Route Plans API](#route-plans-api)
4. [Optimization API](#optimization-api)
5. [Editor API](#editor-api)
6. [Types](#types)
7. [Error Codes](#error-codes)
8. [Examples](#examples)

---

## Overview

### Base URL

```
Production: https://your-wms.com/api
Staging: https://staging.your-wms.com/api
Development: http://localhost:3000/api
```

### Request Format

All requests should use:
- **Content-Type:** `application/json`
- **Accept:** `application/json`

### Response Format

All responses follow this structure:

```typescript
{
  data: T | null,           // Response data
  error: string | null,     // Error message
  meta?: {                  // Optional metadata
    page?: number,
    pageSize?: number,
    total?: number,
    totalPages?: number
  }
}
```

---

## Authentication

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Getting Token

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## Route Plans API

### List Route Plans

**Endpoint:** `GET /api/route-plans`

**Description:** Fetch route plans with filters and pagination

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| pageSize | number | No | Items per page (default: 20) |
| warehouseId | string | No | Filter by warehouse |
| status | string | No | Filter by status |
| startDate | string | No | Filter by start date (YYYY-MM-DD) |
| endDate | string | No | Filter by end date (YYYY-MM-DD) |
| search | string | No | Search by plan code or daily number |

**Example Request:**

```http
GET /api/route-plans?page=1&pageSize=20&status=active&warehouseId=123
```

**Example Response:**

```json
{
  "data": [
    {
      "plan_id": "uuid-1",
      "plan_code": "RP-001",
      "plan_date": "2026-01-18",
      "status": "active",
      "warehouse_id": "uuid-warehouse",
      "trips": [
        {
          "trip_id": "uuid-trip-1",
          "trip_index": 0,
          "vehicle_id": "uuid-vehicle",
          "driver_id": "uuid-driver",
          "stops": [
            {
              "stop_id": "uuid-stop-1",
              "sequence": 0,
              "customer_id": "uuid-customer",
              "customer_name": "Customer A",
              "latitude": 13.7563,
              "longitude": 100.5018,
              "items": [...]
            }
          ]
        }
      ],
      "metrics": {
        "total_distance": 120.5,
        "total_duration": 480,
        "total_stops": 47
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Invalid parameters
- `401` - Unauthorized
- `500` - Server error

---

### Get Route Plan by ID

**Endpoint:** `GET /api/route-plans/:id`

**Description:** Fetch single route plan with full details

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Plan ID (UUID) |

**Example Request:**

```http
GET /api/route-plans/uuid-1
```

**Example Response:**

```json
{
  "data": {
    "plan_id": "uuid-1",
    "plan_code": "RP-001",
    "plan_date": "2026-01-18",
    "status": "active",
    "warehouse_id": "uuid-warehouse",
    "trips": [...],
    "metrics": {...},
    "created_at": "2026-01-18T10:00:00Z",
    "updated_at": "2026-01-18T10:30:00Z"
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - Plan not found
- `401` - Unauthorized
- `500` - Server error

---

### Create Route Plan

**Endpoint:** `POST /api/route-plans`

**Description:** Create new route plan

**Request Body:**

```typescript
{
  warehouse_id: string;      // Required
  plan_date: string;         // Required (YYYY-MM-DD)
  plan_code?: string;        // Optional (auto-generated if not provided)
  daily_trip_number?: string;// Optional
  status?: string;           // Optional (default: 'draft')
}
```

**Example Request:**

```http
POST /api/route-plans
Content-Type: application/json

{
  "warehouse_id": "uuid-warehouse",
  "plan_date": "2026-01-18",
  "status": "draft"
}
```

**Example Response:**

```json
{
  "data": {
    "plan_id": "uuid-new",
    "plan_code": "RP-002",
    "plan_date": "2026-01-18",
    "status": "draft",
    "warehouse_id": "uuid-warehouse",
    "trips": [],
    "created_at": "2026-01-18T11:00:00Z"
  }
}
```

**Status Codes:**

- `201` - Created
- `400` - Invalid input
- `401` - Unauthorized
- `500` - Server error

---

### Update Route Plan

**Endpoint:** `PATCH /api/route-plans/:id`

**Description:** Update route plan details

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Plan ID (UUID) |

**Request Body:**

```typescript
{
  plan_date?: string;
  status?: string;
  daily_trip_number?: string;
}
```

**Example Request:**

```http
PATCH /api/route-plans/uuid-1
Content-Type: application/json

{
  "status": "active"
}
```

**Example Response:**

```json
{
  "data": {
    "plan_id": "uuid-1",
    "status": "active",
    "updated_at": "2026-01-18T11:30:00Z"
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Invalid input
- `404` - Plan not found
- `401` - Unauthorized
- `500` - Server error

---

### Delete Route Plan

**Endpoint:** `DELETE /api/route-plans/:id`

**Description:** Delete route plan (only if status is 'draft')

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Plan ID (UUID) |

**Example Request:**

```http
DELETE /api/route-plans/uuid-1
```

**Example Response:**

```json
{
  "data": {
    "success": true,
    "message": "Plan deleted successfully"
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Cannot delete (not draft status)
- `404` - Plan not found
- `401` - Unauthorized
- `500` - Server error

---

### Check Can Delete

**Endpoint:** `GET /api/route-plans/:id/can-delete`

**Description:** Check if plan can be deleted

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Plan ID (UUID) |

**Example Request:**

```http
GET /api/route-plans/uuid-1/can-delete
```

**Example Response:**

```json
{
  "data": {
    "canDelete": false,
    "reason": "Plan has active picklists",
    "details": {
      "picklistCount": 3,
      "loadlistCount": 0
    }
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - Plan not found
- `401` - Unauthorized
- `500` - Server error

---

## Optimization API

### Optimize Route Plan

**Endpoint:** `POST /api/route-plans/optimize`

**Description:** Optimize route plan using VRP algorithm

**Request Body:**

```typescript
{
  orders: string[];          // Required - Array of order IDs
  settings: {
    maxStopsPerTrip: number; // Required
    maxWeightPerTrip: number;// Required
    maxVolumePerTrip: number;// Required
    startTime: string;       // Required (HH:mm)
    endTime: string;         // Required (HH:mm)
    algorithm: 'greedy' | 'genetic' | 'simulated_annealing';
  };
}
```

**Example Request:**

```http
POST /api/route-plans/optimize
Content-Type: application/json

{
  "orders": ["uuid-order-1", "uuid-order-2", "uuid-order-3"],
  "settings": {
    "maxStopsPerTrip": 10,
    "maxWeightPerTrip": 1000,
    "maxVolumePerTrip": 10,
    "startTime": "08:00",
    "endTime": "18:00",
    "algorithm": "genetic"
  }
}
```

**Example Response:**

```json
{
  "data": {
    "trips": [
      {
        "trip_index": 0,
        "stops": [
          {
            "sequence": 0,
            "order_id": "uuid-order-1",
            "customer_id": "uuid-customer-1",
            "customer_name": "Customer A",
            "latitude": 13.7563,
            "longitude": 100.5018,
            "distance_from_prev": 0,
            "duration_from_prev": 0
          }
        ],
        "total_distance": 45.2,
        "total_duration": 180,
        "total_weight": 500,
        "total_volume": 5
      }
    ],
    "metrics": {
      "total_trips": 3,
      "total_stops": 47,
      "total_distance": 245.8,
      "total_duration": 480,
      "optimization_time": 45.2,
      "savings_percent": 35
    }
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Invalid input
- `408` - Timeout (optimization took too long)
- `401` - Unauthorized
- `500` - Server error

**Timeout:** 5 minutes

---

## Editor API

### Get Editor Data

**Endpoint:** `GET /api/route-plans/:id/editor`

**Description:** Fetch all data needed for editor

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Plan ID (UUID) |

**Example Request:**

```http
GET /api/route-plans/uuid-1/editor
```

**Example Response:**

```json
{
  "data": {
    "plan": {...},
    "warehouse": {...},
    "trips": [...],
    "draftOrders": [...]
  }
}
```

**Status Codes:**

- `200` - Success
- `404` - Plan not found
- `401` - Unauthorized
- `500` - Server error

---

### Save Editor Changes

**Endpoint:** `POST /api/route-plans/:id/batch-update`

**Description:** Save all editor changes in a transaction

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Plan ID (UUID) |

**Request Body:**

```typescript
{
  trips?: Array<{
    trip_id: string;
    vehicle_id?: string;
    driver_id?: string;
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
```

**Example Request:**

```http
POST /api/route-plans/uuid-1/batch-update
Content-Type: application/json

{
  "trips": [
    {
      "trip_id": "uuid-trip-1",
      "vehicle_id": "uuid-vehicle-1"
    }
  ],
  "stops": [
    {
      "stop_id": "uuid-stop-1",
      "trip_id": "uuid-trip-1",
      "sequence": 0
    }
  ],
  "deletedStopIds": ["uuid-stop-2"],
  "deletedTripIds": []
}
```

**Example Response:**

```json
{
  "data": {
    "success": true,
    "trips_updated": 1,
    "stops_updated": 1,
    "stops_deleted": 1,
    "trips_deleted": 0
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Invalid input
- `404` - Plan not found
- `401` - Unauthorized
- `500` - Server error (transaction rolled back)

---

## Types

### RoutePlan

```typescript
interface RoutePlan {
  plan_id: string;
  plan_code: string;
  plan_date: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  warehouse_id: string;
  daily_trip_number: string | null;
  trips: Trip[];
  metrics: PlanMetrics;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}
```

### Trip

```typescript
interface Trip {
  trip_id: string;
  plan_id: string;
  trip_index: number;
  vehicle_id: string | null;
  driver_id: string | null;
  stops: Stop[];
  total_distance: number;
  total_duration: number;
  total_weight: number;
  total_volume: number;
}
```

### Stop

```typescript
interface Stop {
  stop_id: string;
  trip_id: string;
  sequence: number;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  distance_from_prev: number;
  duration_from_prev: number;
  items: OrderItem[];
}
```

### OrderItem

```typescript
interface OrderItem {
  item_id: string;
  order_id: string;
  sku_id: string;
  sku_name: string;
  quantity: number;
  weight: number;
  volume: number;
}
```

### VRPSettings

```typescript
interface VRPSettings {
  maxStopsPerTrip: number;
  maxWeightPerTrip: number;
  maxVolumePerTrip: number;
  startTime: string;
  endTime: string;
  algorithm: 'greedy' | 'genetic' | 'simulated_annealing';
}
```

### PlanMetrics

```typescript
interface PlanMetrics {
  total_trips: number;
  total_stops: number;
  total_distance: number;
  total_duration: number;
  total_weight: number;
  total_volume: number;
  optimization_time: number;
  savings_percent: number;
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 408 | Request Timeout |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

### Application Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Input validation failed |
| NOT_FOUND | Resource not found |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Insufficient permissions |
| TIMEOUT | Operation timed out |
| CONFLICT | Resource conflict |
| INTERNAL_ERROR | Server error |

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "error details"
  }
}
```

---

## Examples

### Example 1: Create and Optimize Plan

```typescript
// Step 1: Create plan
const createResponse = await fetch('/api/route-plans', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    warehouse_id: 'uuid-warehouse',
    plan_date: '2026-01-18',
  }),
});

const { data: plan } = await createResponse.json();

// Step 2: Optimize
const optimizeResponse = await fetch('/api/route-plans/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orders: ['uuid-1', 'uuid-2', 'uuid-3'],
    settings: {
      maxStopsPerTrip: 10,
      maxWeightPerTrip: 1000,
      maxVolumePerTrip: 10,
      startTime: '08:00',
      endTime: '18:00',
      algorithm: 'genetic',
    },
  }),
});

const { data: result } = await optimizeResponse.json();

console.log('Optimization complete:', result.metrics);
```

### Example 2: Fetch Plans with Filters

```typescript
const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
  status: 'active',
  warehouseId: 'uuid-warehouse',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

const response = await fetch(`/api/route-plans?${params}`);
const { data: plans, meta } = await response.json();

console.log(`Found ${meta.total} plans`);
```

### Example 3: Update Plan in Editor

```typescript
// Fetch editor data
const editorResponse = await fetch('/api/route-plans/uuid-1/editor');
const { data: editorData } = await editorResponse.json();

// Make changes
const updatedStops = editorData.trips[0].stops.map((stop, index) => ({
  ...stop,
  sequence: index, // Reorder
}));

// Save changes
const saveResponse = await fetch('/api/route-plans/uuid-1/batch-update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    stops: updatedStops,
  }),
});

const { data: result } = await saveResponse.json();
console.log('Saved:', result);
```

### Example 4: Error Handling

```typescript
try {
  const response = await fetch('/api/route-plans/uuid-1');
  
  if (!response.ok) {
    const { error, code } = await response.json();
    
    switch (code) {
      case 'NOT_FOUND':
        console.error('Plan not found');
        break;
      case 'UNAUTHORIZED':
        console.error('Please login');
        break;
      default:
        console.error('Error:', error);
    }
    
    return;
  }
  
  const { data } = await response.json();
  console.log('Plan:', data);
  
} catch (error) {
  console.error('Network error:', error);
}
```

---

## Rate Limiting

- **Limit:** 100 requests per minute per user
- **Header:** `X-RateLimit-Remaining`
- **Reset:** `X-RateLimit-Reset`

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "reset": "2026-01-18T12:00:00Z"
  }
}
```

---

## Changelog

### Version 2.0 (2026-01-18)

- Added batch update endpoint
- Added can-delete check endpoint
- Improved error responses
- Added rate limiting
- Added timeout for optimization

### Version 1.0 (2025-12-01)

- Initial release

---

**Created by:** Kiro AI  
**Date:** January 18, 2026  
**Version:** 2.0
