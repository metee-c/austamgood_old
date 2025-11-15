import { z } from 'zod';

export const RECEIPT_TYPES = ['ซื้อ', 'ผลิต', 'ส่งคืน', 'โอน', 'ปรับ'] as const;

export type ReceiptType = typeof RECEIPT_TYPES[number];

export const createReceiptSchema = z.object({
  receipt_no: z.string().min(1, 'กรุณากรอกเลขที่ใบรับสินค้า'),
  receipt_date: z.string().min(1, 'กรุณาเลือกวันที่รับสินค้า'),
  receipt_type: z.enum(RECEIPT_TYPES),
  warehouse_id: z.string().min(1, 'กรุณาเลือกคลังสินค้า'),
  supplier_id: z.string().optional(),
  po_no: z.string().optional(),
  invoice_no: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(z.object({
    sku_id: z.string().min(1, 'กรุณาเลือก SKU'),
    quantity: z.number().min(0.01, 'กรุณากรอกจำนวนที่ถูกต้อง'),
    unit_cost: z.number().min(0, 'กรุณากรอกต้นทุนที่ถูกต้อง').optional(),
    location_id: z.string().optional(),
    lot_no: z.string().optional(),
    expiry_date: z.string().optional(),
    remarks: z.string().optional(),
  })).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

export type CreateReceiptFormData = z.infer<typeof createReceiptSchema>;

export interface CreateReceiptRequest {
  receipt_no: string;
  receipt_date: string;
  receipt_type: ReceiptType;
  warehouse_id: string;
  supplier_id?: string;
  received_by?: number;
  po_no?: string;
  invoice_no?: string;
  remarks?: string;
  items: CreateReceiptLineRequest[];
}

export interface CreateReceiptLineRequest {
  sku_id: string;
  quantity: number;
  unit_cost?: number;
  location_id?: string;
  lot_no?: string;
  expiry_date?: string;
  remarks?: string;
}

export const validateCreateReceipt = (data: any): CreateReceiptFormData => {
  return createReceiptSchema.parse(data);
};