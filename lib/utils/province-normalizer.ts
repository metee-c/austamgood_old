/**
 * Province Name Normalizer
 * แปลงชื่อจังหวัดให้เป็นรูปแบบมาตรฐานตามที่ใช้ในฐานข้อมูล
 */

// Mapping ชื่อย่อ/ชื่อไม่เป็นทางการ ไปยังชื่อเต็มมาตรฐาน
const PROVINCE_ALIASES: Record<string, string> = {
  // กรุงเทพ
  'กทม': 'กรุงเทพมหานคร',
  'กทม.': 'กรุงเทพมหานคร',
  'กรุงเทพ': 'กรุงเทพมหานคร',
  'กรุงเทพฯ': 'กรุงเทพมหานคร',
  'bangkok': 'กรุงเทพมหานคร',
  'bkk': 'กรุงเทพมหานคร',

  // อยุธยา
  'อยุธยา': 'พระนครศรีอยุธยา',
  'พระนครศรีอยุทยา': 'พระนครศรีอยุธยา',
  'ayutthaya': 'พระนครศรีอยุธยา',

  // สมุทรปราการ
  'สป.': 'สมุทรปราการ',
  'ปราการ': 'สมุทรปราการ',
  'samut prakan': 'สมุทรปราการ',

  // สมุทรสาคร
  'สค.': 'สมุทรสาคร',
  'สาคร': 'สมุทรสาคร',
  'samut sakhon': 'สมุทรสาคร',

  // สมุทรสงคราม
  'สส.': 'สมุทรสงคราม',
  'สงคราม': 'สมุทรสงคราม',
  'samut songkhram': 'สมุทรสงคราม',

  // นนทบุรี
  'นนท์': 'นนทบุรี',
  'นนท.': 'นนทบุรี',
  'nonthaburi': 'นนทบุรี',

  // ปทุมธานี
  'ปทุม': 'ปทุมธานี',
  'pathum thani': 'ปทุมธานี',

  // นครปฐม
  'นฐ.': 'นครปฐม',
  'nakhon pathom': 'นครปฐม',

  // ชลบุรี
  'ชบ.': 'ชลบุรี',
  'chonburi': 'ชลบุรี',

  // ระยอง
  'rayong': 'ระยอง',

  // เชียงใหม่
  'เชียงใหม': 'เชียงใหม่',
  'chiangmai': 'เชียงใหม่',
  'chiang mai': 'เชียงใหม่',

  // ภูเก็ต
  'phuket': 'ภูเก็ต',

  // สุราษฎร์ธานี
  'สุราษฎร์': 'สุราษฎร์ธานี',
  'สุราษ': 'สุราษฎร์ธานี',
  'surat thani': 'สุราษฎร์ธานี',

  // นครราชสีมา
  'โคราช': 'นครราชสีมา',
  'korat': 'นครราชสีมา',
  'nakhon ratchasima': 'นครราชสีมา',

  // ขอนแก่น
  'ขก.': 'ขอนแก่น',
  'khon kaen': 'ขอนแก่น',

  // อุดรธานี
  'อด.': 'อุดรธานี',
  'udon thani': 'อุดรธานี',

  // เพิ่มเติมตามความจำเป็น...
};

/**
 * Normalize province name to standard form
 * @param province ชื่อจังหวัดที่ต้องการแปลง (รองรับชื่อย่อหรือชื่อไม่เป็นทางการ)
 * @returns ชื่อจังหวัดมาตรฐานตามที่ใช้ในฐานข้อมูล
 */
export function normalizeProvinceName(province: string | null | undefined): string {
  if (!province) return '';

  // ลบช่องว่างหน้าหลัง และแปลงเป็นตัวพิมพ์เล็ก (สำหรับเปรียบเทียบ)
  const trimmed = province.trim();
  const lower = trimmed.toLowerCase();

  // หาจาก mapping ก่อน
  if (PROVINCE_ALIASES[trimmed]) {
    return PROVINCE_ALIASES[trimmed];
  }

  if (PROVINCE_ALIASES[lower]) {
    return PROVINCE_ALIASES[lower];
  }

  // ถ้าไม่เจอใน mapping ให้ใช้ชื่อเดิม (อาจเป็นชื่อมาตรฐานอยู่แล้ว)
  return trimmed;
}

/**
 * Get multiple possible province names for flexible matching
 * @param province ชื่อจังหวัดต้นฉบับ
 * @returns Array ของชื่อจังหวัดที่เป็นไปได้ทั้งหมด
 */
export function getProvinceVariants(province: string | null | undefined): string[] {
  if (!province) return [];

  const normalized = normalizeProvinceName(province);
  const variants = new Set<string>();

  // เพิ่มชื่อมาตรฐาน
  variants.add(normalized);

  // เพิ่มชื่อต้นฉบับ
  variants.add(province.trim());

  // เพิ่ม aliases ทั้งหมดที่ชี้ไปยังชื่อมาตรฐานเดียวกัน
  Object.entries(PROVINCE_ALIASES).forEach(([alias, standard]) => {
    if (standard === normalized) {
      variants.add(alias);
    }
  });

  return Array.from(variants);
}
