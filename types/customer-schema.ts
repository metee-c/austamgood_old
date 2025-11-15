
import { z } from 'zod';

export const customerSchema = z.object({
  customer_id: z.string().nonempty({ message: 'กรุณากรอกรหัสลูกค้า' }),
  customer_code: z.string().nonempty({ message: 'กรุณากรอกโค้ดลูกค้า' }),
  customer_name: z.string().nonempty({ message: 'กรุณากรอกชื่อลูกค้า' }),
  customer_type: z.enum(['retail', 'wholesale', 'distributor', 'other']).default('retail'),
  business_reg_no: z.string().optional(),
  tax_id: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: 'รูปแบบอีเมลไม่ถูกต้อง' }).optional(),
  line_id: z.string().optional(),
  website: z.string().url({ message: 'รูปแบบ URL ไม่ถูกต้อง' }).optional(),
  billing_address: z.string().optional(),
  shipping_address: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  subdistrict: z.string().optional(),
  postal_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  delivery_instructions: z.string().optional(),
  preferred_delivery_time: z.string().optional(),
  channel_source: z.string().optional(),
  customer_segment: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  created_by: z.string().nonempty(),
  remarks: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
