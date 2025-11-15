import { z } from 'zod';

export const materialIssueSchema = z.object({
  production_order_id: z.string().uuid(),
  material_sku_id: z.string().min(1, 'Material SKU is required'),
  issued_qty: z.number().positive('Issued quantity must be positive'),
  issue_location_id: z.string().uuid().optional().nullable(),
  issued_by: z.number().int().optional().nullable(),
  status: z.enum(['issued', 'returned']).default('issued'),
  remarks: z.string().optional().nullable()
});

export const materialReturnSchema = z.object({
  material_issue_id: z.string().uuid(),
  return_qty: z.number().positive('Return quantity must be positive'),
  return_location_id: z.string().uuid().optional().nullable(),
  remarks: z.string().optional().nullable()
});

export const productionReceiptSchema = z.object({
  production_order_id: z.string().uuid(),
  product_sku_id: z.string().min(1, 'Product SKU is required'),
  received_qty: z.number().positive('Received quantity must be positive'),
  receive_location_id: z.string().uuid().optional().nullable(),
  lot_no: z.string().optional().nullable(),
  batch_no: z.string().optional().nullable(),
  produced_by: z.number().int().optional().nullable(),
  remarks: z.string().optional().nullable()
});

export const productionCompletionSchema = z.object({
  production_order_id: z.string().uuid(),
  received_qty: z.number().positive('Received quantity must be positive'),
  receive_location_id: z.string().uuid('Location is required'),
  remarks: z.string().optional().nullable()
});

export type MaterialIssue = z.infer<typeof materialIssueSchema>;
export type MaterialReturn = z.infer<typeof materialReturnSchema>;
export type ProductionReceipt = z.infer<typeof productionReceiptSchema>;
export type ProductionCompletion = z.infer<typeof productionCompletionSchema>;
export type MaterialIssueStatus = 'issued' | 'returned';
