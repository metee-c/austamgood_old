import { z } from 'zod';

export const freightRateSchema = z.object({
  freight_rate_id: z.number().optional(),
  carrier_id: z.number().min(1, 'ผู้ให้บริการขนส่งไม่สามารถเว้นว่างได้'),
  route_name: z.string().min(1, 'ชื่อสายขนส่งไม่สามารถเว้นว่างได้'),
  origin_province: z.string().min(1, 'จังหวัดต้นทางไม่สามารถเว้นว่างได้').refine((val) => THAI_PROVINCES.includes(val), {
    message: 'กรุณาเลือกจังหวัดต้นทางที่ถูกต้อง',
  }),
  origin_district: z.string().optional().nullable(),
  destination_province: z.string().min(1, 'จังหวัดปลายทางไม่สามารถเว้นว่างได้').refine((val) => THAI_PROVINCES.includes(val), {
    message: 'กรุณาเลือกจังหวัดปลายทางที่ถูกต้อง',
  }),
  destination_district: z.string().optional().nullable(),
  total_distance_km: z.number().positive('ระยะทางต้องมากกว่า 0'),
  pricing_mode: z.enum(['flat', 'formula']).default('flat'),
  base_price: z.number().positive('ราคาหลักต้องมากกว่า 0'),
  extra_drop_price: z.number().min(0, 'ค่าจุดส่งเพิ่มต้องไม่ติดลบ').optional().nullable(),
  helper_price: z.number().min(0, 'ค่าเด็กติดรถต้องไม่ติดลบ').optional().nullable(),
  price_unit: z.enum(['trip', 'kg', 'pallet', 'other']).default('trip'),
  effective_start_date: z.string().min(1, 'วันที่เริ่มใช้ราคาไม่สามารถเว้นว่างได้'),
  effective_end_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  created_by: z.string().min(1, 'ผู้สร้างข้อมูลไม่สามารถเว้นว่างได้'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  // Additional fields for display
  carrier_name: z.string().optional(),
  is_active: z.boolean().optional(),
}).refine((data) => {
  // Validate that end date is after start date if provided
  if (data.effective_end_date && data.effective_start_date) {
    return new Date(data.effective_end_date) >= new Date(data.effective_start_date);
  }
  return true;
}, {
  message: 'วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น',
  path: ['effective_end_date'],
});

export type FreightRateFormValues = z.infer<typeof freightRateSchema>;

export const PRICING_MODES = [
  { value: 'flat', label: 'แบบเหมา (ใส่ราคาเดียวจบ)' },
  { value: 'formula', label: 'แบบคำนวณ (ราคาเริ่มต้น + ค่าเด็ก + ค่าจุดเพิ่ม)' }
];

export const PRICE_UNITS = [
  { value: 'trip', label: 'ต่อเที่ยว' },
  { value: 'kg', label: 'ต่อกิโลกรัม' },
  { value: 'pallet', label: 'ต่อพาเลท' },
  { value: 'other', label: 'อื่นๆ' }
];

export const THAI_PROVINCES = [
  'กรุงเทพมหานคร',
  'กระบี่',
  'กาญจนบุรี',
  'กาฬสินธุ์',
  'กำแพงเพชร',
  'ขอนแก่น',
  'จันทบุรี',
  'ฉะเชิงเทรา',
  'ชลบุรี',
  'ชัยนาท',
  'ชัยภูมิ',
  'ชุมพร',
  'เชียงราย',
  'เชียงใหม่',
  'ตรัง',
  'ตราด',
  'ตาก',
  'นครนายก',
  'นครปฐม',
  'นครพนม',
  'นครราชสีมา',
  'นครศรีธรรมราช',
  'นครสวรรค์',
  'นนทบุรี',
  'นราธิวาส',
  'น่าน',
  'บึงกาฬ',
  'บุรีรัมย์',
  'ปทุมธานี',
  'ประจวบคีรีขันธ์',
  'ปราจีนบุรี',
  'ปัตตานี',
  'พระนครศรีอยุธยา',
  'พะเยา',
  'พังงา',
  'พัทลุง',
  'พิจิตร',
  'พิษณุโลก',
  'เพชรบุรี',
  'เพชรบูรณ์',
  'แพร่',
  'ภูเก็ต',
  'มหาสารคาม',
  'มุกดาหาร',
  'แม่ฮ่องสอน',
  'ยโสธร',
  'ยะลา',
  'ร้อยเอ็ด',
  'ระนอง',
  'ระยอง',
  'ราชบุรี',
  'ลพบุรี',
  'ลำปาง',
  'ลำพูน',
  'เลย',
  'ศรีสะเกษ',
  'สกลนคร',
  'สงขลา',
  'สตูล',
  'สมุทรปราการ',
  'สมุทรสงคราม',
  'สมุทรสาคร',
  'สระแก้ว',
  'สระบุรี',
  'สิงห์บุรี',
  'สุโขทัย',
  'สุพรรณบุรี',
  'สุราษฎร์ธานี',
  'สุรินทร์',
  'หนองคาย',
  'หนองบัวลำภู',
  'อ่างทอง',
  'อำนาจเจริญ',
  'อุดรธานี',
  'อุตรดิตถ์',
  'อุทัยธานี',
  'อุบลราชธานี'
];

// Mock carriers data - replace with real data from API
export const MOCK_CARRIERS = [
  { carrier_id: 1, carrier_name: 'บริษัท ขนส่งไทย จำกัด' },
  { carrier_id: 2, carrier_name: 'บริษัท ขนส่งรวดเร็ว จำกัด' },
  { carrier_id: 3, carrier_name: 'บริษัท ขนส่งปลอดภัย จำกัด' }
];

// Helper function to format price with currency symbol
export const formatPrice = (price: number | null | undefined): string => {
  if (price == null) return '-';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
};

// Helper function to format price without currency symbol (for table display)
export const formatPriceNumber = (price: number | null | undefined): string => {
  if (price == null) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

// Helper function to format distance
export const formatDistance = (distance: number | null | undefined): string => {
  if (distance == null) return '-';
  return `${distance.toLocaleString('th-TH')} กม.`;
};

// Helper function to get price unit label
export const getPriceUnitLabel = (unit: string): string => {
  const unitObj = PRICE_UNITS.find(u => u.value === unit);
  return unitObj?.label || unit;
};