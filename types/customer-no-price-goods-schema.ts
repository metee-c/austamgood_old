import { z } from 'zod';

export const CustomerNoPriceGoodsSchema = z.object({
  record_id: z.bigint().optional(),
  customer_id: z.string().min(1, "รหัสลูกค้าจำเป็นต้องระบุ"),
  customer_name: z.string().min(1, "ชื่อลูกค้าจำเป็นต้องระบุ"),
  reason: z.string().nullable().optional(),
  note_for_picking: z.string().nullable().optional(),
  effective_start_date: z.string().nullable().optional(),
  effective_end_date: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: z.string().min(1, "ผู้สร้างข้อมูลจำเป็นต้องระบุ"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type CustomerNoPriceGoods = z.infer<typeof CustomerNoPriceGoodsSchema>;