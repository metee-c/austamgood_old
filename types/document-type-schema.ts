import { z } from 'zod';

export const DocumentTypeSchema = z.object({
  doc_type_id: z.bigint().optional(),
  doc_type_code: z.string().min(1, "รหัสประเภทเอกสารจำเป็นต้องระบุ"),
  doc_type_name: z.string().min(1, "ชื่อประเภทเอกสารจำเป็นต้องระบุ"),
  description: z.string().nullable().optional(),
  required_case: z.any().nullable().optional(),
  special_customer_ids: z.array(z.string()).nullable().optional(),
  special_customer_names: z.array(z.string()).nullable().optional(),
  return_required: z.boolean().default(true),
  ocr_template_id: z.string().nullable().optional(),
  storage_location: z.string().nullable().optional(),
  retention_period_months: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
  created_by: z.string().min(1, "ผู้สร้างข้อมูลจำเป็นต้องระบุ"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  remarks: z.string().nullable().optional(),
});

export type DocumentType = z.infer<typeof DocumentTypeSchema>;