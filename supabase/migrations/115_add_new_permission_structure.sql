-- ==========================================
-- Migration: Add New Permission Structure
-- Description: เพิ่มโครงสร้าง Permission ใหม่ที่ละเอียดและครบถ้วน
-- Created: 2025-12-07
-- Author: Claude Code
-- ==========================================

-- 1. เพิ่ม columns ใหม่ใน master_permission_module
ALTER TABLE master_permission_module
ADD COLUMN IF NOT EXISTS parent_module_id BIGINT REFERENCES master_permission_module(module_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS module_key VARCHAR(200) UNIQUE,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS icon VARCHAR(100);

-- Add comments
COMMENT ON COLUMN master_permission_module.parent_module_id IS 'Parent module สำหรับ hierarchical structure';
COMMENT ON COLUMN master_permission_module.module_key IS 'Permission key แบบ hierarchical เช่น warehouse.inbound.view';
COMMENT ON COLUMN master_permission_module.display_order IS 'ลำดับการแสดงผล';
COMMENT ON COLUMN master_permission_module.is_active IS 'สถานะการใช้งาน';
COMMENT ON COLUMN master_permission_module.icon IS 'ไอคอนสำหรับแสดงใน UI';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_permission_module_key ON master_permission_module(module_key);
CREATE INDEX IF NOT EXISTS idx_permission_module_parent ON master_permission_module(parent_module_id);

-- 2. เพิ่ม permission types ใหม่ใน role_permission
ALTER TABLE role_permission
ADD COLUMN IF NOT EXISTS can_import BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_export BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_print BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_scan BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_assign BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_cancel BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_rollback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_publish BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_optimize BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_change_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_coordinates BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_reset_reservations BOOLEAN DEFAULT false;

-- Add comments for new permissions
COMMENT ON COLUMN role_permission.can_import IS 'สามารถนำเข้าข้อมูล';
COMMENT ON COLUMN role_permission.can_export IS 'สามารถส่งออกข้อมูล';
COMMENT ON COLUMN role_permission.can_print IS 'สามารถพิมพ์เอกสาร';
COMMENT ON COLUMN role_permission.can_scan IS 'สามารถสแกนบาร์โค้ด/QR';
COMMENT ON COLUMN role_permission.can_assign IS 'สามารถมอบหมายงาน';
COMMENT ON COLUMN role_permission.can_complete IS 'สามารถทำงานให้เสร็จ';
COMMENT ON COLUMN role_permission.can_cancel IS 'สามารถยกเลิก';
COMMENT ON COLUMN role_permission.can_rollback IS 'สามารถย้อนกลับ';
COMMENT ON COLUMN role_permission.can_publish IS 'สามารถเผยแพร่';
COMMENT ON COLUMN role_permission.can_optimize IS 'สามารถ optimize';
COMMENT ON COLUMN role_permission.can_change_status IS 'สามารถเปลี่ยนสถานะ';
COMMENT ON COLUMN role_permission.can_manage_coordinates IS 'สามารถจัดการพิกัด';
COMMENT ON COLUMN role_permission.can_reset_reservations IS 'สามารถรีเซ็ตการจอง';

-- 3. สร้างตาราง user_data_permissions สำหรับ data-level permissions
CREATE TABLE IF NOT EXISTS user_data_permissions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES master_system_user(user_id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL, -- 'warehouse', 'customer', 'supplier', 'location'
  allowed_values TEXT[], -- array of IDs
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT REFERENCES master_system_user(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_data_permissions_user_id ON user_data_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_permissions_type ON user_data_permissions(permission_type);

COMMENT ON TABLE user_data_permissions IS 'Data-level permissions: กำหนดสิทธิ์ในการเข้าถึงข้อมูลเฉพาะ';
COMMENT ON COLUMN user_data_permissions.permission_type IS 'ประเภทข้อมูล เช่น warehouse, customer, supplier';
COMMENT ON COLUMN user_data_permissions.allowed_values IS 'รายการ IDs ที่อนุญาตให้เข้าถึง';

-- 4. สร้างตาราง role_field_permissions สำหรับ field-level permissions
CREATE TABLE IF NOT EXISTS role_field_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES master_system_role(role_id) ON DELETE CASCADE,
  module_id BIGINT NOT NULL REFERENCES master_permission_module(module_id) ON DELETE CASCADE,
  field_name VARCHAR(200) NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_field_permissions_role ON role_field_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_field_permissions_module ON role_field_permissions(module_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_field_unique ON role_field_permissions(role_id, module_id, field_name);

COMMENT ON TABLE role_field_permissions IS 'Field-level permissions: กำหนดว่า role ไหนเห็น/แก้ไข field ไหนได้บ้าง';

-- 5. สร้างตาราง permission_audit_log สำหรับติดตามการเปลี่ยนแปลง
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES master_system_user(user_id),
  action VARCHAR(50) NOT NULL, -- 'granted', 'revoked', 'modified'
  permission_key VARCHAR(200),
  role_id BIGINT REFERENCES master_system_role(role_id),
  old_value JSONB,
  new_value JSONB,
  changed_by BIGINT REFERENCES master_system_user(user_id),
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_role ON permission_audit_log(role_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_changed_at ON permission_audit_log(changed_at DESC);

COMMENT ON TABLE permission_audit_log IS 'Audit log สำหรับติดตามการเปลี่ยนแปลง permissions';

-- 6. สร้างตาราง permission_groups สำหรับจัดกลุ่ม permissions
CREATE TABLE IF NOT EXISTS permission_groups (
  id BIGSERIAL PRIMARY KEY,
  group_name VARCHAR(100) NOT NULL UNIQUE,
  group_key VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permission_keys TEXT[] NOT NULL,
  is_system BOOLEAN DEFAULT false, -- system groups ลบไม่ได้
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT REFERENCES master_system_user(user_id)
);

COMMENT ON TABLE permission_groups IS 'กลุ่มของ permissions เพื่อความสะดวกในการจัดการ';
COMMENT ON COLUMN permission_groups.is_system IS 'ถ้าเป็น true = system group ลบไม่ได้';

-- 7. Insert default permission groups
INSERT INTO permission_groups (group_name, group_key, description, permission_keys, is_system) VALUES
('Warehouse Full Access', 'warehouse_full', 'สิทธิ์เต็มทุกอย่างในโมดูลคลังสินค้า', ARRAY['warehouse.*'], true),
('Orders Full Access', 'orders_full', 'สิทธิ์เต็มทุกอย่างในโมดูลออเดอร์', ARRAY['orders.*', 'routes.*', 'picklists.*', 'loadlists.*'], true),
('Master Data Full Access', 'master_full', 'สิทธิ์เต็มทุกอย่างในข้อมูลหลัก', ARRAY['master.*'], true),
('Mobile Operations', 'mobile_ops', 'สิทธิ์ทั้งหมดสำหรับ Mobile', ARRAY['mobile.*'], true),
('View Only All', 'view_all', 'ดูข้อมูลทั้งหมด (ไม่สามารถแก้ไข)', ARRAY['*.view'], true),
('Reports Access', 'reports', 'เข้าถึงรายงานทั้งหมด', ARRAY['reports.*'], true)
ON CONFLICT (group_key) DO NOTHING;

-- 8. สร้าง Function สำหรับ check permission
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id BIGINT,
  p_permission_key VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
  v_module_id BIGINT;
  v_action VARCHAR;
BEGIN
  -- Get module_id from permission_key
  SELECT module_id INTO v_module_id
  FROM master_permission_module
  WHERE module_key = p_permission_key
    AND is_active = true;

  IF v_module_id IS NULL THEN
    RETURN false;
  END IF;

  -- Extract action from permission key (last part after dot)
  v_action := substring(p_permission_key from '[^.]+$');

  -- Check if user has this permission through any of their roles
  SELECT EXISTS (
    SELECT 1
    FROM user_role ur
    JOIN role_permission rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = p_user_id
      AND rp.module_id = v_module_id
      AND (
        (v_action = 'view' AND rp.can_view = true) OR
        (v_action = 'create' AND rp.can_create = true) OR
        (v_action = 'edit' AND rp.can_edit = true) OR
        (v_action = 'delete' AND rp.can_delete = true) OR
        (v_action = 'approve' AND rp.can_approve = true) OR
        (v_action = 'import' AND rp.can_import = true) OR
        (v_action = 'export' AND rp.can_export = true) OR
        (v_action = 'print' AND rp.can_print = true) OR
        (v_action = 'scan' AND rp.can_scan = true) OR
        (v_action = 'assign' AND rp.can_assign = true) OR
        (v_action = 'complete' AND rp.can_complete = true) OR
        (v_action = 'cancel' AND rp.can_cancel = true) OR
        (v_action = 'rollback' AND rp.can_rollback = true) OR
        (v_action = 'publish' AND rp.can_publish = true) OR
        (v_action = 'optimize' AND rp.can_optimize = true) OR
        (v_action = 'change_status' AND rp.can_change_status = true) OR
        (v_action = 'manage_coordinates' AND rp.can_manage_coordinates = true) OR
        (v_action = 'reset_reservations' AND rp.can_reset_reservations = true)
      )
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_user_permission IS 'ตรวจสอบว่า user มีสิทธิ์ตาม permission key หรือไม่';

-- 9. สร้าง Function สำหรับดึง permissions ทั้งหมดของ user
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id BIGINT)
RETURNS TABLE(permission_key VARCHAR, can_do BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.module_key,
    true as can_do
  FROM user_role ur
  JOIN role_permission rp ON ur.role_id = rp.role_id
  JOIN master_permission_module m ON rp.module_id = m.module_id
  WHERE ur.user_id = p_user_id
    AND m.is_active = true
    AND (
      rp.can_view OR rp.can_create OR rp.can_edit OR rp.can_delete OR
      rp.can_approve OR rp.can_import OR rp.can_export OR rp.can_print OR
      rp.can_scan OR rp.can_assign OR rp.can_complete OR rp.can_cancel OR
      rp.can_rollback OR rp.can_publish OR rp.can_optimize OR
      rp.can_change_status OR rp.can_manage_coordinates OR rp.can_reset_reservations
    )
  GROUP BY m.module_key;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_permissions IS 'ดึง permission keys ทั้งหมดที่ user มี';

-- 10. สร้าง Trigger สำหรับ audit log
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO permission_audit_log (user_id, action, permission_key, role_id, new_value, changed_by)
    VALUES (NULL, 'granted', NULL, NEW.role_id, row_to_json(NEW), current_setting('app.current_user_id', true)::BIGINT);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO permission_audit_log (user_id, action, permission_key, role_id, old_value, new_value, changed_by)
    VALUES (NULL, 'modified', NULL, NEW.role_id, row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id', true)::BIGINT);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO permission_audit_log (user_id, action, permission_key, role_id, old_value, changed_by)
    VALUES (NULL, 'revoked', NULL, OLD.role_id, row_to_json(OLD), current_setting('app.current_user_id', true)::BIGINT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_role_permission_changes ON role_permission;
CREATE TRIGGER audit_role_permission_changes
AFTER INSERT OR UPDATE OR DELETE ON role_permission
FOR EACH ROW EXECUTE FUNCTION log_permission_change();

COMMENT ON TRIGGER audit_role_permission_changes ON role_permission IS 'Audit trail สำหรับ permission changes';

-- สรุปผลการ migration
DO $$
BEGIN
  RAISE NOTICE '=== Permission Structure Migration Completed ===';
  RAISE NOTICE 'Added columns to master_permission_module: parent_module_id, module_key, display_order, is_active, icon';
  RAISE NOTICE 'Added 13 new permission types to role_permission';
  RAISE NOTICE 'Created 4 new tables: user_data_permissions, role_field_permissions, permission_audit_log, permission_groups';
  RAISE NOTICE 'Created 2 functions: check_user_permission(), get_user_permissions()';
  RAISE NOTICE 'Created audit trigger for permission changes';
  RAISE NOTICE 'Inserted 6 default permission groups';
END $$;
