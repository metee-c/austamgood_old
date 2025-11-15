import { z } from 'zod';

export const orderItemSchema = z.object({
  line_no: z.number().min(1),
  sku_id: z.string().min(1, 'กรุณาเลือกสินค้า'),
  sku_name: z.string().optional(),
  number_field_additional_1: z.number().optional(),
  order_qty: z.number().min(0.001, 'จำนวนต้องมากกว่า 0'),
  order_weight: z.number().optional(),
  pack_all: z.number().default(0),
  pack_12_bags: z.number().default(0),
  pack_4: z.number().default(0),
  pack_6: z.number().default(0),
  pack_2: z.number().default(0),
  pack_1: z.number().default(0)
});

export const createOrderSchema = z.object({
  order_no: z.string().min(1, 'กรุณาระบุเลขที่ออเดอร์'),
  order_type: z.enum(['blank', 'route_planning', 'express'], {
    required_error: 'กรุณาเลือกประเภทออเดอร์'
  }),
  order_date: z.string().min(1, 'กรุณาเลือกวันที่'),
  sequence_no: z.string().optional(),
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลัง'),
  customer_id: z.string().min(1, 'กรุณาเลือกลูกค้า'),
  shop_name: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
  payment_type: z.enum(['credit', 'cash'], {
    required_error: 'กรุณาเลือกประเภทการชำระเงิน'
  }),
  pickup_datetime: z.string().optional(),
  delivery_date: z.string().optional(),
  text_field_long_1: z.string().optional(),
  text_field_additional_1: z.string().optional(),
  text_field_additional_4: z.string().optional(),
  notes: z.string().optional(),
  notes_additional: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ')
});

export type CreateOrderFormData = z.infer<typeof createOrderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
