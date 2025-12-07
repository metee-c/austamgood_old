-- Migration: Import Employee Data
-- Description: นำเข้าข้อมูลพนักงานทั้งหมด 44 คน
-- Created: 2024-12-07

-- ใช้ ON CONFLICT เพื่ออัปเดตข้อมูลที่มีอยู่แล้ว
-- ไม่ต้องลบข้อมูลเดิมเพราะมี foreign key constraint

-- นำเข้าข้อมูลพนักงาน
INSERT INTO master_employee (
  employee_code,
  first_name,
  last_name,
  nickname,
  employment_type,
  department,
  position,
  wms_role,
  created_at,
  updated_at
) VALUES
-- 1. ผู้จัดการและที่ปรึกษา
('1234', 'เมธี', 'เจริญสุข', 'โย', 'permanent', 'คลังสินค้าและขนส่ง', 'ผู้จัดการ', 'supervisor', NOW(), NOW()),
('0029', 'อรุณ', 'โพธกัณฑ์', 'พี่เติ่ง', 'permanent', 'คลังสินค้า', 'ที่ปรึกษา', 'supervisor', NOW(), NOW()),

-- 2. หัวหน้าแผนก
('0005', 'ศักดิ์สิทธิ์', 'บุตรลี', 'พี่ศัก', 'permanent', 'คลังสินค้า', 'หัวหน้าคลังสินค้า', 'supervisor', NOW(), NOW()),
('0012', 'ต้น', 'ศรีเรือน', 'ต้น', 'permanent', 'คลังสินค้า', 'หัวหน้าขนส่งภายใน', 'supervisor', NOW(), NOW()),
('0010', 'มาลัย', 'สีมา', 'แดง', 'permanent', 'ผลิต', 'หัวหน้าผลิตสินค้า', 'supervisor', NOW(), NOW()),

-- 3. พนักงานขับรถ
('0013', 'พัฒนพล', 'ศรีชัย', 'ทีม', 'permanent', 'ขนส่ง', 'พนักงานขับรถ', 'driver', NOW(), NOW()),
('0028', 'ครรชนะ', 'ชาปัด', 'ฮอต', 'permanent', 'ขนส่ง', 'พนักงานขับรถ', 'driver', NOW(), NOW()),
('0030', 'โจโจ้', 'โนนพิมาย', 'โจโจ้', 'permanent', 'ขนส่ง', 'พนักงานขับรถ', 'driver', NOW(), NOW()),
('0098', 'อัษฎาวุธ', 'ทอนเสาร์', 'เก้า', 'permanent', 'ขนส่ง', 'พนักงานขับรถ', 'driver', NOW(), NOW()),

-- 4. พนักงานติดรถ
('0016', 'วินัย', 'เสนาวุฒิ', 'อาร์ม', 'permanent', 'ขนส่ง', 'พนักงานติดรถ', 'other', NOW(), NOW()),

-- 5. พนักงานเช็คเกอร์
('0050', 'สุทธิพันธุ์', 'หมอเมือง', 'น็อต', 'permanent', 'คลังสินค้า', 'พนักงานเช็คเกอร์', 'operator', NOW(), NOW()),
('0008', 'มน', 'รัตนา', 'มน', 'permanent', 'คลังสินค้า', 'พนักงานเช็คเกอร์', 'operator', NOW(), NOW()),
('0011', 'รัชพล', 'คนสุภาพ', 'อ้น', 'permanent', 'คลังสินค้า', 'พนักงานเช็คเกอร์', 'operator', NOW(), NOW()),
('0018', 'เอกพงศ์', 'วงษ์สุวรรณ์', 'บอย', 'permanent', 'คลังสินค้า', 'พนักงานเช็คเกอร์', 'operator', NOW(), NOW()),

-- 6. พนักงานขับรถยกสูง
('0003', 'ไกรศร', 'สีดี', 'หนึ่ง', 'permanent', 'คลังสินค้า', 'พนักงานขับรถยกสูง', 'forklift', NOW(), NOW()),
('0014', 'กิตตินันท์', 'มั่นจิต', 'โก๋', 'permanent', 'คลังสินค้า', 'พนักงานขับรถยกสูง', 'forklift', NOW(), NOW()),
('0060', 'มาโนช', 'มั่นศักดิ', 'เค้ก', 'permanent', 'คลังสินค้า', 'พนักงานขับรถยกสูง', 'forklift', NOW(), NOW()),

-- 7. เจ้าหน้าที่คลังสินค้า
('0034', 'สุจิตรา', 'ทามาศ', 'เฟรินส์', 'permanent', 'คลังสินค้า', 'เจ้าหน้าที่ประสานงานขนส่ง', 'operator', NOW(), NOW()),
('0041', 'ธัญญรัตน์', 'ภูจอมนิล', 'ชาร์ป', 'permanent', 'คลังสินค้า', 'เจ้าหน้าที่คลังสินค้า', 'operator', NOW(), NOW()),
('0099', 'ธันวา', 'ลาภานิกรณ์', 'วาวี', 'permanent', 'คลังสินค้า', 'เจ้าหน้าที่คลังสินค้าและระบบ', 'operator', NOW(), NOW()),

-- 8. พนักงานจัดสินค้า (รายเดือน)
('0033', 'อุกฤษฎ์', 'ปาปะกัง', 'โม', 'permanent', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),

-- 9. แม่บ้าน
('0040', 'Nang mon sein', '-', 'จิน', 'part-time', 'คลังสินค้า', 'แม่บ้าน', 'other', NOW(), NOW()),

-- 10. พนักงานจัดสินค้า (รายวัน)
('0045', 'วราวัศน์', 'จันต๊ะเทพ', 'ตี๋', 'part-time', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),
('0046', 'ศิริวัฒน์', 'สุดลาโชคมีชัย', 'ฟลุ๊ค', 'part-time', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),
('0047', 'ภูวินัย', 'มุงคุณ', 'เขด', 'part-time', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),
('0048', 'นพรัตน์', 'จำปา', 'กั๊ง', 'part-time', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),
('0064', 'ลักษณ์คณาวรรณ', 'โพธ', 'เด่น', 'part-time', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),
('0067', 'พงศกร', 'พะนิจรัมย', 'ต่อน', 'part-time', 'คลังสินค้า', 'พนักงานจัดสินค้า', 'picker', NOW(), NOW()),

-- 11. พนักงานผลิต (รายเดือน)
('0007', 'Zin Min Aung', '-', 'เซน', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0015', 'ปี้', '-', 'ปี้', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0019', 'วศิน', 'โทล่า', 'มาร์ค', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0020', 'Nan Shwe Myint', '-', 'วาวา', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0021', 'Saweb Maum Maua', '-', 'แอร์', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0022', 'Saw Kgaw Phang Shar', '-', 'กี', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0023', 'Maung Aung Htay', '-', 'กาแกร', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0024', 'Thein Zae', '-', 'ซอ', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0025', 'Sai Jom', '-', 'แดง', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0026', 'Aung Phyo Thein', '-', 'เมา', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0032', 'Naing Htet Lin', '-', 'นาย', 'permanent', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),

-- 12. พนักงานผลิต (รายวัน)
('0065', 'เส๊ะพอ', '-', 'พอล', 'part-time', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0055', 'Ye Htet Aung', '-', 'เย', 'part-time', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0058', 'Kyaw Zin Oo', '-', 'จอ', 'part-time', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0057', 'Thit tun kyaw', '-', 'ทุน', 'part-time', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW()),
('0056', 'Kyaw Zin Win', '-', 'วิน', 'part-time', 'ผลิต', 'พนักงานผลิต', 'operator', NOW(), NOW())

ON CONFLICT (employee_code) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  nickname = EXCLUDED.nickname,
  employment_type = EXCLUDED.employment_type,
  department = EXCLUDED.department,
  position = EXCLUDED.position,
  wms_role = EXCLUDED.wms_role,
  updated_at = NOW();

-- แสดงสรุปข้อมูล
DO $$
DECLARE
  total_count INTEGER;
  monthly_count INTEGER;
  daily_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO total_count FROM master_employee;
  SELECT COUNT(*) INTO monthly_count FROM master_employee WHERE employment_type = 'permanent';
  SELECT COUNT(*) INTO daily_count FROM master_employee WHERE employment_type = 'part-time';
  
  RAISE NOTICE '=== สรุปการนำเข้าข้อมูลพนักงาน ===';
  RAISE NOTICE 'จำนวนพนักงานทั้งหมด: % คน', total_count;
  RAISE NOTICE 'พนักงานประจำ: % คน', monthly_count;
  RAISE NOTICE 'พนักงานพาร์ทไทม์: % คน', daily_count;
  RAISE NOTICE '';
  RAISE NOTICE 'แยกตามแผนก:';
  
  FOR rec IN 
    SELECT department, COUNT(*) as dept_count 
    FROM master_employee 
    GROUP BY department 
    ORDER BY dept_count DESC
  LOOP
    RAISE NOTICE '  - %: % คน', rec.department, rec.dept_count;
  END LOOP;
END $$;
