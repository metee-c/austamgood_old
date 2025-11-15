import { z } from 'zod';

export const assetSchema = z.object({
  asset_id: z.number().optional(),
  asset_code: z.string().min(1, 'รหัสทรัพย์สินไม่สามารถเว้นว่างได้'),
  asset_name: z.string().min(1, 'ชื่อทรัพย์สินไม่สามารถเว้นว่างได้'),
  asset_type: z.string().min(1, 'ประเภททรัพย์สินไม่สามารถเว้นว่างได้'),
  description: z.string().optional(),
  warehouse_id: z.number().optional().nullable(),
  location_id: z.number().optional().nullable(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  purchase_date: z.string().optional().nullable(),
  warranty_expiry_date: z.string().optional().nullable(),
  maintenance_schedule: z.string().optional(),
  last_maintenance_date: z.string().optional().nullable(),
  status: z.enum(['Active', 'Under Maintenance', 'Out of Service', 'Retired']).default('Active'),
  capacity_spec: z.string().optional(),
  assigned_person_id: z.number().optional().nullable(),
  safety_certificate_expiry: z.string().optional().nullable(),
  remarks: z.string().optional(),
  created_by: z.string().min(1, 'ผู้สร้างข้อมูลไม่สามารถเว้นว่างได้'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type AssetFormValues = z.infer<typeof assetSchema>;

export const ASSET_TYPES = [
  { value: 'Forklift', label: 'รถยก' },
  { value: 'Rack', label: 'ชั้นวาง' },
  { value: 'Hand Pallet', label: 'รถเข็นมือ' },
  { value: 'Barcode Scanner', label: 'เครื่องสแกน' },
  { value: 'Weighing Scale', label: 'เครื่องชั่ง' },
  { value: 'Conveyor', label: 'สายพาน' },
  { value: 'Other', label: 'อื่นๆ' }
];

export const ASSET_STATUS = [
  { value: 'Active', label: 'ใช้งาน' },
  { value: 'Under Maintenance', label: 'ซ่อมบำรุง' },
  { value: 'Out of Service', label: 'เสื่อมสภาพ' },
  { value: 'Retired', label: 'เลิกใช้งาน' }
];

export const FUEL_TYPES = [
  { value: 'Gasoline', label: 'เบนซิน' },
  { value: 'Diesel', label: 'ดีเซล' },
  { value: 'LPG', label: 'แก๊ส LPG' },
  { value: 'NGV', label: 'แก๊ส NGV' },
  { value: 'Electric', label: 'ไฟฟ้า' },
  { value: 'Manual', label: 'แรงคน' },
  { value: 'Other', label: 'อื่นๆ' }
];