import { z } from 'zod';

export const productionPlanSchema = z.object({
  plan_no: z.string().min(1, 'Plan number is required'),
  plan_name: z.string().min(1, 'Plan name is required'),
  plan_description: z.string().optional(),
  plan_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  plan_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  warehouse_id: z.string().optional(),
  production_area_id: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(99).default(5),
  status: z.enum(['draft', 'approved', 'in_production', 'completed', 'cancelled']).default('draft'),
  items: z.array(z.object({
    sku_id: z.string().min(1, 'SKU is required'),
    required_qty: z.number().positive('Quantity must be positive')
  })).min(1, 'At least one item is required')
}).refine(data => {
  const startDate = new Date(data.plan_start_date);
  const endDate = new Date(data.plan_end_date);
  return endDate >= startDate;
}, {
  message: 'End date must be after or equal to start date',
  path: ['plan_end_date']
});

export const productionPlanItemSchema = z.object({
  sku_id: z.string().min(1, 'SKU is required'),
  required_qty: z.number().positive('Quantity must be positive'),
  current_stock_qty: z.number().nonnegative().default(0),
  safety_stock_qty: z.number().nonnegative().default(0),
  scheduled_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduled_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['planned', 'released', 'in_progress', 'completed', 'on_hold', 'cancelled']).default('planned'),
  notes: z.string().optional().nullable()
});

export const materialRequirementUpdateSchema = z.object({
  status: z.enum(['needed', 'ordered', 'received', 'issued', 'cancelled']),
  po_no: z.string().optional(),
  po_qty: z.number().positive().optional(),
  po_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplier_id: z.string().optional()
});

export type ProductionPlan = z.infer<typeof productionPlanSchema>;
export type ProductionPlanItem = z.infer<typeof productionPlanItemSchema>;
export type MaterialRequirementUpdate = z.infer<typeof materialRequirementUpdateSchema>;
