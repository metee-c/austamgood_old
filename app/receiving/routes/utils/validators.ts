import { z } from 'zod';

// VRP Settings Schema
export const VRPSettingsSchema = z.object({
  maxStopsPerTrip: z.number().int().min(1).max(50),
  maxWeightPerTrip: z.number().min(0).max(50000),
  maxVolumePerTrip: z.number().min(0).max(1000),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  algorithm: z.enum(['greedy', 'genetic', 'simulated_annealing']),
}).refine(
  (data) => {
    const start = data.startTime.split(':').map(Number);
    const end = data.endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return endMinutes > startMinutes;
  },
  {
    message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น',
    path: ['endTime'],
  }
);

// Route Plan Create Schema
export const CreateRoutePlanSchema = z.object({
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  plan_date: z.string().min(1, 'กรุณาเลือกวันที่'),
  plan_code: z.string().optional(),
  notes: z.string().optional(),
  settings: VRPSettingsSchema.optional(),
});

// Batch Update Schema
export const BatchUpdateSchema = z.object({
  trips: z.array(z.object({
    trip_id: z.string().uuid(),
    vehicle_id: z.string().uuid().nullable().optional(),
    driver_id: z.string().uuid().nullable().optional(),
    trip_index: z.number().int().min(0).optional(),
  })).optional(),
  stops: z.array(z.object({
    stop_id: z.string().uuid(),
    trip_id: z.string().uuid(),
    sequence: z.number().int().min(0),
  })).optional(),
  deletedStopIds: z.array(z.string().uuid()).optional(),
  deletedTripIds: z.array(z.string().uuid()).optional(),
});

// Filter Schema
export const FilterSchema = z.object({
  warehouseId: z.string().nullable(),
  status: z.enum(['draft', 'planned', 'in_progress', 'completed', 'cancelled']).nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  search: z.string(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด',
    path: ['endDate'],
  }
);

// Pagination Schema
export const PaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

// Export types
export type VRPSettingsInput = z.infer<typeof VRPSettingsSchema>;
export type CreateRoutePlanInput = z.infer<typeof CreateRoutePlanSchema>;
export type BatchUpdateInput = z.infer<typeof BatchUpdateSchema>;
export type FilterInput = z.infer<typeof FilterSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
