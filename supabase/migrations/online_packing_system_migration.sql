-- =====================================================
-- ONLINE PACKING SYSTEM - COMPLETE MIGRATION SCRIPT
-- =====================================================
-- สคริปต์นี้รวมระบบแพ็คสินค้าออนไลน์ทั้งหมดจาก POS_FULL
-- เข้ากับระบบ WMS ปัจจุบัน
--
-- สร้างโดย: Claude Code Migration Tool
-- วันที่: 2025-11-16
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For better text search performance

-- =====================================================
-- SECTION 1: PRODUCTS & INVENTORY TABLES
-- =====================================================

-- Table: products (สินค้า)
CREATE TABLE IF NOT EXISTS packing_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_sku TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  is_sample BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: product_weight_profiles (โปรไฟล์น้ำหนักสินค้า)
CREATE TABLE IF NOT EXISTS packing_product_weight_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type_code TEXT NOT NULL UNIQUE, -- A, B, C, D, E, F, G, H, I
  weight_kg DECIMAL(10, 2) NOT NULL UNIQUE,
  dimensions_length DECIMAL(10, 2) NOT NULL,
  dimensions_width DECIMAL(10, 2) NOT NULL,
  dimensions_height DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 2: BOXES & PACKING RULES TABLES
-- =====================================================

-- Table: boxes (กล่องแพ็คสินค้า)
CREATE TABLE IF NOT EXISTS packing_boxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  box_code TEXT NOT NULL UNIQUE,
  box_name TEXT NOT NULL,
  dimensions_length DECIMAL(10,2) NOT NULL,
  dimensions_width DECIMAL(10,2) NOT NULL,
  dimensions_height DECIMAL(10,2) NOT NULL,
  max_weight DECIMAL(10,2) NOT NULL,
  volume DECIMAL(15,2) GENERATED ALWAYS AS (dimensions_length * dimensions_width * dimensions_height) STORED,
  cost_per_box DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: packing_rules (กฎการแพ็ค)
CREATE TABLE IF NOT EXISTS packing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  box_code TEXT NOT NULL,
  primary_product_type_code TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  components JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(box_code, primary_product_type_code)
);

-- Table: box_stocks (สต็อกกล่อง)
CREATE TABLE IF NOT EXISTS packing_box_stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  box_id UUID REFERENCES packing_boxes(id) ON DELETE CASCADE,
  current_quantity INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  minimum_quantity INTEGER DEFAULT 10,
  maximum_quantity INTEGER DEFAULT 1000,
  last_restocked_at TIMESTAMPTZ,
  last_restocked_quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(box_id)
);

-- Table: box_stock_history (ประวัติการเปลี่ยนแปลงสต็อกกล่อง)
CREATE TABLE IF NOT EXISTS packing_box_stock_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  box_stock_id UUID REFERENCES packing_box_stocks(id) ON DELETE CASCADE,
  box_id UUID REFERENCES packing_boxes(id) ON DELETE SET NULL,
  box_code TEXT NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('restock', 'use', 'adjustment', 'initial')),
  reason TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 3: ORDERS & PACKING TABLES
-- =====================================================

-- Table: packing_orders (ออเดอร์แพ็คสินค้า)
CREATE TABLE IF NOT EXISTS packing_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  tracking_number TEXT,
  parent_sku TEXT,
  product_name TEXT,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled')),
  completed_at TIMESTAMPTZ,
  platform TEXT NOT NULL,
  shipping_provider TEXT,
  packing_status TEXT CHECK (packing_status IN ('not_started', 'in_progress', 'completed')),
  packed_at TIMESTAMPTZ,
  packed_by TEXT,
  sample_alert TEXT,
  recommended_box_id UUID REFERENCES packing_boxes(id),
  actual_box_id UUID REFERENCES packing_boxes(id),
  box_cost DECIMAL(10,2),
  packaging_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: packing_order_items (รายการสินค้าในออเดอร์)
CREATE TABLE IF NOT EXISTS packing_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES packing_orders(id) ON DELETE CASCADE,
  parent_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  scanned_quantity INTEGER DEFAULT 0 CHECK (scanned_quantity >= 0),
  is_completed BOOLEAN DEFAULT FALSE,
  bundle_info JSONB,
  freebie_display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: backup_orders (ออเดอร์ที่แพ็คเสร็จแล้ว)
CREATE TABLE IF NOT EXISTS packing_backup_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_order_id TEXT,
  order_number TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  tracking_number TEXT,
  parent_sku TEXT,
  product_name TEXT,
  quantity INTEGER,
  fulfillment_status TEXT,
  completed_at TIMESTAMPTZ,
  platform TEXT NOT NULL,
  shipping_provider TEXT,
  packing_status TEXT,
  packed_at TIMESTAMPTZ,
  packed_by TEXT,
  sample_alert TEXT,
  moved_to_backup_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Table: packing_history (ประวัติการแพ็ค)
CREATE TABLE IF NOT EXISTS packing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_number TEXT NOT NULL,
  box_id UUID REFERENCES packing_boxes(id),
  box_code TEXT,
  total_weight DECIMAL(10,3),
  total_volume DECIMAL(15,2),
  items_count INTEGER,
  packed_by TEXT,
  pack_duration INTEGER, -- seconds
  efficiency_score DECIMAL(5,2),
  notes TEXT,
  packed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 4: PROMOTION & FREEBIES TABLES
-- =====================================================

-- Table: promotion_freebies (ของแถม)
CREATE TABLE IF NOT EXISTS packing_promotion_freebies (
  id SERIAL PRIMARY KEY,
  product_barcode TEXT NOT NULL,
  product_name TEXT,
  product_code TEXT,
  freebie_name TEXT NOT NULL,
  freebie_description TEXT,
  display_name TEXT,
  freebie_skus JSONB, -- Array of freebie SKU objects
  random_freebie BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- =====================================================
-- SECTION 5: RETURNS MANAGEMENT TABLES
-- =====================================================

-- Table: packing_returns (สินค้าตีกลับ)
CREATE TABLE IF NOT EXISTS packing_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  parent_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  return_quantity INTEGER NOT NULL,
  return_reason TEXT NOT NULL,
  return_status TEXT DEFAULT 'pending'
    CHECK (return_status IN ('pending', 'approved', 'rejected', 'completed')),
  notes TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  confirmation_images TEXT[], -- Array of image URLs
  image_upload_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 6: USER MANAGEMENT TABLES
-- =====================================================

-- Table: packing_users (ผู้ใช้งานระบบแพ็ค)
CREATE TABLE IF NOT EXISTS packing_users (
  id TEXT PRIMARY KEY,
  user_code TEXT UNIQUE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  phone TEXT,
  department TEXT,
  profile_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: packing_user_permissions (สิทธิ์การใช้งาน)
CREATE TABLE IF NOT EXISTS packing_user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES packing_users(id) ON DELETE CASCADE,
  menu_path TEXT NOT NULL,
  can_access BOOLEAN DEFAULT TRUE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_export BOOLEAN DEFAULT FALSE,
  can_print BOOLEAN DEFAULT FALSE,
  notes TEXT,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, menu_path)
);

-- Table: packing_system_menus (เมนูในระบบ)
CREATE TABLE IF NOT EXISTS packing_system_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_path TEXT NOT NULL UNIQUE,
  menu_name_th TEXT NOT NULL,
  menu_name_en TEXT NOT NULL,
  menu_icon TEXT,
  menu_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 7: INDEXES FOR PERFORMANCE
-- =====================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_packing_products_parent_sku ON packing_products(parent_sku);
CREATE INDEX IF NOT EXISTS idx_packing_products_barcode ON packing_products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_packing_products_name_search ON packing_products USING gin(product_name gin_trgm_ops);

-- Boxes indexes
CREATE INDEX IF NOT EXISTS idx_packing_boxes_active ON packing_boxes(is_active, box_code);
CREATE INDEX IF NOT EXISTS idx_packing_boxes_code ON packing_boxes(box_code);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_packing_orders_order_number ON packing_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_packing_orders_tracking ON packing_orders(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_packing_orders_status ON packing_orders(fulfillment_status, packing_status);
CREATE INDEX IF NOT EXISTS idx_packing_orders_platform ON packing_orders(platform);
CREATE INDEX IF NOT EXISTS idx_packing_orders_created ON packing_orders(created_at DESC);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_packing_order_items_order_id ON packing_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_packing_order_items_parent_sku ON packing_order_items(parent_sku);

-- Backup orders indexes
CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_tracking ON packing_backup_orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_packing_backup_orders_packed_at ON packing_backup_orders(packed_at DESC);

-- Packing history indexes
CREATE INDEX IF NOT EXISTS idx_packing_history_tracking ON packing_history(tracking_number, packed_at DESC);
CREATE INDEX IF NOT EXISTS idx_packing_history_packed_at ON packing_history(packed_at DESC);

-- Promotion freebies indexes
CREATE INDEX IF NOT EXISTS idx_packing_promotion_freebies_barcode ON packing_promotion_freebies(product_barcode);
CREATE INDEX IF NOT EXISTS idx_packing_promotion_freebies_active ON packing_promotion_freebies(is_active);

-- Returns indexes
CREATE INDEX IF NOT EXISTS idx_packing_returns_order_number ON packing_returns(order_number);
CREATE INDEX IF NOT EXISTS idx_packing_returns_status ON packing_returns(return_status);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_packing_users_username ON packing_users(username);
CREATE INDEX IF NOT EXISTS idx_packing_users_active ON packing_users(is_active);

-- User permissions indexes
CREATE INDEX IF NOT EXISTS idx_packing_user_permissions_user_menu ON packing_user_permissions(user_id, menu_path);

-- =====================================================
-- SECTION 8: TRIGGERS & FUNCTIONS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION packing_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER packing_products_updated_at BEFORE UPDATE ON packing_products
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_boxes_updated_at BEFORE UPDATE ON packing_boxes
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_box_stocks_updated_at BEFORE UPDATE ON packing_box_stocks
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_orders_updated_at BEFORE UPDATE ON packing_orders
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_order_items_updated_at BEFORE UPDATE ON packing_order_items
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_promotion_freebies_updated_at BEFORE UPDATE ON packing_promotion_freebies
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_returns_updated_at BEFORE UPDATE ON packing_returns
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_users_updated_at BEFORE UPDATE ON packing_users
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

CREATE TRIGGER packing_user_permissions_updated_at BEFORE UPDATE ON packing_user_permissions
  FOR EACH ROW EXECUTE FUNCTION packing_update_updated_at_column();

-- Function: Get recommended box for SKU
CREATE OR REPLACE FUNCTION packing_recommend_box_for_sku(
  p_parent_sku TEXT,
  p_quantity INTEGER
)
RETURNS TABLE(
  box_id UUID,
  box_code TEXT,
  box_name TEXT,
  confidence_score DECIMAL(5,2)
) AS $$
BEGIN
  -- Simple recommendation based on packing rules
  -- Can be enhanced with more complex logic
  RETURN QUERY
  SELECT
    b.id,
    b.box_code,
    b.box_name,
    80.0::DECIMAL(5,2) as confidence_score
  FROM packing_boxes b
  WHERE b.is_active = TRUE
  ORDER BY b.volume ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Get unique platforms
CREATE OR REPLACE FUNCTION packing_get_unique_platforms()
RETURNS TABLE(platform_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT platform
  FROM packing_orders
  WHERE platform IS NOT NULL
  ORDER BY platform;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 9: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE packing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_product_weight_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_box_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_box_stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_backup_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_promotion_freebies ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_system_menus ENABLE ROW LEVEL SECURITY;

-- Allow all access for authenticated users (can be customized later)
CREATE POLICY "Allow all for authenticated users" ON packing_products FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_product_weight_profiles FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_boxes FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_rules FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_box_stocks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_box_stock_history FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_orders FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_order_items FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_backup_orders FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_history FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_promotion_freebies FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_returns FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_users FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_user_permissions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON packing_system_menus FOR ALL USING (true);

-- =====================================================
-- SECTION 10: INITIAL DATA SETUP
-- =====================================================

-- Insert product weight profiles
INSERT INTO packing_product_weight_profiles (product_type_code, weight_kg, dimensions_length, dimensions_width, dimensions_height) VALUES
('A', 0.8, 9, 9, 8),
('B', 1.0, 11, 9, 8),
('C', 1.2, 11, 9, 8),
('D', 2.5, 14, 14, 10),
('E', 3.0, 24, 22, 10),
('F', 4.0, 25, 25, 13),
('G', 7.0, 36, 53, 10),
('H', 10.0, 38, 55, 10),
('I', 20.0, 0, 0, 0)
ON CONFLICT (product_type_code) DO NOTHING;

-- Insert boxes
INSERT INTO packing_boxes (box_code, box_name, dimensions_length, dimensions_width, dimensions_height, max_weight, cost_per_box) VALUES
('E', 'กล่อง E', 40, 24, 17, 25, 0),
('B', 'กล่อง B', 25, 17, 9, 25, 0),
('C', 'กล่อง C', 30, 20, 11, 25, 0),
('D', 'กล่อง D', 35, 22, 14, 25, 0),
('D+', 'กล่อง D+', 35, 22, 25, 25, 0),
('D+11', 'กล่อง D+11', 35, 22, 25, 25, 0),
('M+', 'กล่อง M+', 45, 35, 25, 25, 0),
('ฉ', 'กล่อง ฉ', 45, 30, 22, 25, 0)
ON CONFLICT (box_code) DO NOTHING;

-- Insert packing rules for Box B
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components) VALUES
('B', 'A', 'A1', '[{"type": "A", "qty": 1}]'),
('B', 'B', 'B1', '[{"type": "B", "qty": 1}]'),
('B', 'C', 'C1', '[{"type": "C", "qty": 1}]'),
('B', 'D', '–', null), ('B', 'E', '–', null), ('B', 'F', '–', null), ('B', 'G', '–', null), ('B', 'H', '–', null), ('B', 'I', '–', null)
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert packing rules for Box C
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components) VALUES
('C', 'A', 'A2', '[{"type": "A", "qty": 2}]'),
('C', 'B', 'B2', '[{"type": "B", "qty": 2}]'),
('C', 'C', 'C2', '[{"type": "C", "qty": 2}]'),
('C', 'D', 'D1', '[{"type": "D", "qty": 1}]'),
('C', 'E', '–', null), ('C', 'F', '–', null), ('C', 'G', '–', null), ('C', 'H', '–', null), ('C', 'I', '–', null)
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert packing rules for Box D
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components) VALUES
('D', 'A', 'A3', '[{"type": "A", "qty": 3}]'),
('D', 'B', 'B3', '[{"type": "B", "qty": 3}]'),
('D', 'C', 'C3', '[{"type": "C", "qty": 3}]'),
('D', 'D', 'D1', '[{"type": "D", "qty": 1}]'),
('D', 'E', 'E1', '[{"type": "E", "qty": 1}]'),
('D', 'F', '–', null), ('D', 'G', '–', null), ('D', 'H', '–', null), ('D', 'I', '–', null)
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert packing rules for Box D+11
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components) VALUES
('D+11', 'A', 'A6', '[{"type": "A", "qty": 6}]'),
('D+11', 'B', 'B6', '[{"type": "B", "qty": 6}]'),
('D+11', 'C', 'C6', '[{"type": "C", "qty": 6}]'),
('D+11', 'D', 'D2', '[{"type": "D", "qty": 2}]'),
('D+11', 'E', 'E2+B1', '[{"type": "E", "qty": 2}, {"type": "B", "qty": 1}]'),
('D+11', 'F', 'F2+B1', '[{"type": "F", "qty": 2}, {"type": "B", "qty": 1}]'),
('D+11', 'G', '–', null), ('D+11', 'H', '–', null), ('D+11', 'I', '–', null)
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert packing rules for Box E
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components) VALUES
('E', 'A', 'A4', '[{"type": "A", "qty": 4}]'),
('E', 'B', 'B3', '[{"type": "B", "qty": 3}]'),
('E', 'C', 'C3', '[{"type": "C", "qty": 3}]'),
('E', 'D', 'D2', '[{"type": "D", "qty": 2}]'),
('E', 'E', 'E2', '[{"type": "E", "qty": 2}]'),
('E', 'F', 'F1', '[{"type": "F", "qty": 1}]'),
('E', 'G', '–', null), ('E', 'H', '–', null), ('E', 'I', '–', null)
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert packing rules for Box ฉ
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components) VALUES
('ฉ', 'A', 'A8', '[{"type": "A", "qty": 8}]'),
('ฉ', 'B', 'B10', '[{"type": "B", "qty": 10}]'),
('ฉ', 'C', 'C8', '[{"type": "C", "qty": 8}]'),
('ฉ', 'D', 'D4', '[{"type": "D", "qty": 4}]'),
('ฉ', 'E', 'E2', '[{"type": "E", "qty": 2}]'),
('ฉ', 'F', 'F2+E1', '[{"type": "F", "qty": 2}, {"type": "E", "qty": 1}]'),
('ฉ', 'G', 'G1', '[{"type": "G", "qty": 1}]'),
('ฉ', 'H', 'H2', '[{"type": "H", "qty": 2}]'),
('ฉ', 'I', '–', null)
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert packing rules for Box M+
INSERT INTO packing_rules (box_code, primary_product_type_code, rule_code, components, notes) VALUES
('M+', 'A', 'A12', '[{"type": "A", "qty": 12}]', null),
('M+', 'B', 'B12', '[{"type": "B", "qty": 12}]', null),
('M+', 'C', 'C8', '[{"type": "C", "qty": 8}]', null),
('M+', 'D', 'D5', '[{"type": "D", "qty": 5}]', null),
('M+', 'E', 'E4', '[{"type": "E", "qty": 4}]', null),
('M+', 'F', 'F4', '[{"type": "F", "qty": 4}]', null),
('M+', 'G', 'G2', '[{"type": "G", "qty": 2}]', null),
('M+', 'H', 'H2', '[{"type": "H", "qty": 2}]', null),
('M+', 'I', 'M+ 2 กล่อง', null, 'ต้องใช้ 2 กล่องใหญ่ประกบกัน')
ON CONFLICT (box_code, primary_product_type_code) DO NOTHING;

-- Insert system menus
INSERT INTO packing_system_menus (menu_path, menu_name_th, menu_name_en, menu_icon, menu_order, description) VALUES
('/online-packing', 'แพ็คสินค้าออนไลน์', 'Online Packing', '📦', 1, 'ระบบสแกนและแพ็คสินค้าออนไลน์'),
('/online-packing/dashboard', 'สรุปรายงานการแพ็ค', 'Packing Dashboard', '📊', 2, 'แดชบอร์ดสรุปข้อมูลการแพ็คสินค้า'),
('/online-packing/import', 'นำเข้าออเดอร์', 'Import Orders', '📥', 3, 'นำเข้าข้อมูลออเดอร์จาก Excel'),
('/online-packing/settings', 'ตั้งค่าระบบแพ็ค', 'Packing Settings', '⚙️', 4, 'ตั้งค่ากล่อง กฎการแพ็ค และสิทธิ์'),
('/online-packing/returns', 'สินค้าตีกลับ', 'Returns Management', '🔄', 5, 'จัดการสินค้าตีกลับ'),
('/online-packing/promotions', 'จัดการของแถม', 'Promotions Management', '🎁', 6, 'จัดการโปรโมชั่นและของแถม')
ON CONFLICT (menu_path) DO NOTHING;

-- Initialize box stocks for all boxes
INSERT INTO packing_box_stocks (box_id, current_quantity, minimum_quantity, maximum_quantity)
SELECT id, 100, 10, 1000
FROM packing_boxes
WHERE id NOT IN (SELECT box_id FROM packing_box_stocks)
ON CONFLICT (box_id) DO NOTHING;

-- =====================================================
-- SECTION 11: VIEWS FOR REPORTING
-- =====================================================

-- View: Box usage statistics
CREATE OR REPLACE VIEW v_packing_box_usage_stats AS
SELECT
  b.box_code,
  b.box_name,
  COUNT(ph.id) as total_uses,
  AVG(ph.efficiency_score) as avg_efficiency,
  SUM(CASE WHEN ph.packed_at >= CURRENT_DATE THEN 1 ELSE 0 END) as uses_today,
  SUM(CASE WHEN ph.packed_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as uses_this_week,
  SUM(CASE WHEN ph.packed_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) as uses_this_month
FROM packing_boxes b
LEFT JOIN packing_history ph ON b.id = ph.box_id
WHERE b.is_active = TRUE
GROUP BY b.id, b.box_code, b.box_name
ORDER BY total_uses DESC;

-- View: Packing performance by user
CREATE OR REPLACE VIEW v_packing_user_performance AS
SELECT
  ph.packed_by,
  COUNT(ph.id) as total_packs,
  AVG(ph.pack_duration) as avg_pack_duration,
  AVG(ph.efficiency_score) as avg_efficiency,
  SUM(CASE WHEN ph.packed_at >= CURRENT_DATE THEN 1 ELSE 0 END) as packs_today,
  MAX(ph.packed_at) as last_pack_time
FROM packing_history ph
WHERE ph.packed_by IS NOT NULL
GROUP BY ph.packed_by
ORDER BY total_packs DESC;

-- View: Active promotion freebies
CREATE OR REPLACE VIEW v_active_promotion_freebies AS
SELECT
  pf.id,
  pf.product_barcode,
  COALESCE(p.product_name, pf.product_name) as product_name,
  pf.freebie_name,
  pf.freebie_description,
  pf.display_name,
  pf.random_freebie,
  pf.freebie_skus,
  pf.created_at,
  pf.updated_at
FROM packing_promotion_freebies pf
LEFT JOIN packing_products p ON p.barcode = pf.product_barcode
WHERE pf.is_active = TRUE
ORDER BY pf.created_at DESC;

-- =====================================================
-- COMPLETED: Migration script finished successfully
-- =====================================================

SELECT 'Online Packing System migration completed successfully!' as status;
SELECT '✅ Tables created: ' || COUNT(*) || ' tables' as summary
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'packing_%';
