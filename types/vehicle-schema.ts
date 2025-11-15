
import { z } from 'zod';

export const vehicleSchema = z.object({
  vehicle_id: z.bigint().optional(),
  vehicle_code: z.string().nonempty({ message: 'กรุณากรอกรหัสรถ' }),
  vehicle_type: z.string().optional(),
  plate_number: z.string().nonempty({ message: 'กรุณากรอกหมายเลขทะเบียน' }),
  brand: z.string().optional(),
  model: z.string().optional(),
  year_of_manufacture: z.number().optional().nullable(),
  capacity_kg: z.number().optional().nullable(),
  capacity_cbm: z.number().optional().nullable(),
  fuel_type: z.string().optional(),
  driver_id: z.bigint().optional().nullable(),
  gps_device_id: z.string().optional().nullable(),
  location_base_id: z.bigint().optional().nullable(),
  registration_expiry_date: z.string().optional().nullable(),
  insurance_expiry_date: z.string().optional().nullable(),
  maintenance_schedule: z.string().optional().nullable(),
  current_status: z.enum(['Active', 'Under Maintenance', 'Inactive']).default('Active'),
  remarks: z.string().optional().nullable(),
  created_by: z.string().nonempty(),
});

export type VehicleFormValues = z.infer<typeof vehicleSchema>;
