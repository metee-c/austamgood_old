-- ============================================================================
-- Migration: Create System User for Fallback
-- Description: สร้าง system user (user_id=1) สำหรับใช้เป็น fallback เมื่อไม่สามารถระบุ user ได้
-- ============================================================================

-- สร้าง system user ด้วย user_id = 1
INSERT INTO master_system_user (
  user_id,
  username,
  email,
  password_hash,
  full_name,
  is_active,
  remarks,
  created_at,
  updated_at
) VALUES (
  1,
  'system',
  'system@wms.local',
  '$2a$10$dummyhashforSystemUserThatCannotBeUsedForLogin123456789',
  'System User',
  true,
  'System user for fallback when user context cannot be determined',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- อัพเดท sequence ให้เริ่มจาก 10 เพื่อไม่ให้ซ้ำกับ user ที่มีอยู่
SELECT setval('master_system_user_user_id_seq', 10, false);

-- เพิ่ม comment
COMMENT ON TABLE master_system_user IS 'ตาราง System User - user_id=1 เป็น system user สำหรับ fallback';
