
import { z } from 'zod';

export const customerSchema = z.object({
  customer_id: z.string().nonempty({ message: 'กรุณากรอกรหัสลูกค้า' }),
  customer_code: z.string().nonempty({ message: 'กรุณากรอกโค้ดลูกค้า' }),
  customer_name: z.string().nonempty({ message: 'กรุณากรอกชื่อลูกค้า' }),
  customer_type: z.enum(['retail', 'wholesale', 'distributor', 'other']).default('retail'),
  business_reg_no: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  contact_person: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }).optional().nullable().or(z.literal('')),
  line_id: z.string().optional().nullable(),
  website: z.string().url({ message: 'รูปแบบ URL ไม่ถูกต้อง' }).optional().nullable().or(z.literal('')),
  billing_address: z.string().optional().nullable(),
  shipping_address: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  subdistrict: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  delivery_instructions: z.string().optional().nullable(),
  preferred_delivery_time: z.string().optional().nullable(),
  channel_source: z.string().optional().nullable(),
  customer_segment: z.string().optional().nullable(),
  hub: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
  created_by: z.string().nonempty(),
  remarks: z.string().optional().nullable(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
