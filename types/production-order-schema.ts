import { z } from 'zod';

export const productionOrderSchema = z.object({
  production_no: z.string().optional(),
  plan_id: z.string().uuid().optional().nullable(),
  sku_id: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be positive'),
  produced_qty: z.number().min(0).default(0),
  uom: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  actual_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  actual_completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(['planned', 'in_progress', 'completed', 'closed', 'cancelled']).default('planned'),
  priority: z.number().int().min(1).max(99).default(5),
  remarks: z.string().optional().nullable()
}).refine(data => {
  const startDate = new Date(data.start_date);
  const dueDate = new Date(data.due_date);
  return dueDate >= startDate;
}, {
  message: 'Due date must be after or equal to start date',
  path: ['due_date']
});

export const productionOrderItemSchema = z.object({
  production_order_id: z.string().uuid(),
  material_sku_id: z.string().min(1, 'Material is required'),
  required_qty: z.number().positive('Required quantity must be positive'),
  issued_qty: z.number().min(0).default(0),
  uom: z.string().optional(),
  status: z.enum(['pending', 'issued', 'returned']).default('pending'),
  issued_date: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});

export const productionLogSchema = z.object({
  production_order_id: z.string().uuid(),
  action: z.string().min(1, 'Action is required'),
  old_value: z.string().optional().nullable(),
  new_value: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  created_by: z.number().optional().nullable()
});

export const issueMaterialsSchema = z.object({
  production_order_id: z.string().uuid(),
  material_sku_id: z.string().min(1),
  issued_qty: z.number().positive('Issued quantity must be positive'),
  remarks: z.string().optional()
});

export const updateStatusSchema = z.object({
  production_order_id: z.string().uuid(),
  status: z.enum(['planned', 'in_progress', 'completed', 'closed', 'cancelled']),
  actual_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  actual_completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  produced_qty: z.number().min(0).optional(),
  remarks: z.string().optional()
});

export type ProductionOrder = z.infer<typeof productionOrderSchema>;
export type ProductionOrderItem = z.infer<typeof productionOrderItemSchema>;
export type ProductionLog = z.infer<typeof productionLogSchema>;
export type IssueMaterials = z.infer<typeof issueMaterialsSchema>;
export type UpdateStatus = z.infer<typeof updateStatusSchema>;

export type ProductionOrderStatus = 'planned' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
export type ProductionItemStatus = 'pending' | 'issued' | 'returned';
