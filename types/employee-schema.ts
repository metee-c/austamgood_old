import { z } from 'zod';

export const EmployeeSchema = z.object({
  employee_id: z.bigint().optional(),
  employee_code: z.string().min(1, "Employee code is required"),
  prefix: z.enum(['Mr', 'Mrs', 'Ms', 'อื่นๆ']),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  nickname: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  date_of_birth: z.string().nullable().optional(),
  national_id: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  hire_date: z.string().optional(),
  employment_type: z.enum(['permanent', 'contract', 'part-time', 'temporary']).optional(),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  profile_photo_url: z.string().url().nullable().optional(),
  wms_role: z.enum(['supervisor', 'operator', 'picker', 'driver', 'forklift', 'other']).optional(),
  allowed_warehouses: z.any().nullable().optional(), // Assuming JSON will be handled as 'any'
  rf_device_id: z.string().nullable().optional(),
  barcode_id: z.string().nullable().optional(),
  shift_type: z.enum(['day', 'night', 'rotating']).optional(),
  training_certifications: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  remarks: z.string().nullable().optional(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
