-- ============================================================================
-- Migration: 252_create_virtual_pallet_location.sql
-- Description: สร้าง VIRTUAL-PALLET location สำหรับ Virtual Pallet system
-- 
-- ปัญหา: Foreign key constraint ไม่ผ่านเพราะ location_id = 'VIRTUAL-PALLET' ไม่มีอยู่
-- 
-- แก้ไข: สร้าง location VIRTUAL-PALLET ใน master_location table
-- ============================================================================

-- ตรวจสอบว่ามี location VIRTUAL-PALLET อยู่แล้วหรือไม่
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM master_location 
    WHERE location_id = 'VIRTUAL-PALLET'
  ) THEN
    -- สร้าง location VIRTUAL-PALLET
    INSERT INTO master_location (
      location_id,
      warehouse_id,
      warehouse_name,
      location_code,
      location_name,
      location_type,
      zone,
      aisle,
      rack,
      shelf,
      bin,
      max_capacity_qty,
      max_capacity_weight_kg,
      current_qty,
      current_weight_kg,
      active_status,
      is_system_location,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      'VIRTUAL-PALLET',
      'WH001',
      'คลังสินค้าหลัก',
      'VIRTUAL-PALLET',
      'Virtual Pallet Location',
      'other',  -- ใช้ 'other' เพราะ CHECK constraint ไม่มี 'virtual'
      'VIRTUAL',
      'VIRTUAL',
      'VIRTUAL',
      'VIRTUAL',
      'VIRTUAL',
      999999,  -- ความจุไม่จำกัด
      999999.99,
      0,
      0,
      'active',
      true,  -- เป็น system location
      'System',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    
    RAISE NOTICE '✅ Created VIRTUAL-PALLET location';
  ELSE
    RAISE NOTICE 'ℹ️ VIRTUAL-PALLET location already exists';
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
