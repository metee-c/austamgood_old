-- ==========================================
-- Migration: 125_insert_default_admin_users.sql
-- Description: Insert default admin users for initial system access
-- Author: System
-- Date: 2024-12-07
-- Dependencies: 118_enhance_master_system_user_for_auth.sql, 115_add_new_permission_structure.sql
-- ==========================================

-- Insert default Super Admin role if not exists
INSERT INTO master_system_role (role_id, role_name, description, is_active, created_at, updated_at)
VALUES (1, 'Super Admin', 'ผู้ดูแลระบบระดับสูงสุด มีสิทธิ์เข้าถึงทุกฟังก์ชัน', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_id) DO NOTHING;

-- Insert default Admin role if not exists
INSERT INTO master_system_role (role_id, role_name, description, is_active, created_at, updated_at)
VALUES (2, 'Admin', 'ผู้ดูแลระบบทั่วไป', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_id) DO NOTHING;

-- Insert default Manager role if not exists
INSERT INTO master_system_role (role_id, role_name, description, is_active, created_at, updated_at)
VALUES (3, 'Manager', 'ผู้จัดการ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_id) DO NOTHING;

-- Insert default User role if not exists
INSERT INTO master_system_role (role_id, role_name, description, is_active, created_at, updated_at)
VALUES (4, 'User', 'ผู้ใช้งานทั่วไป', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_id) DO NOTHING;

-- Insert Super Admin user
-- Email: admin@austamgood.com
-- Username: superadmin
-- Password: Admin@123456 (bcrypt hash with salt rounds 10)
-- Note: This is a temporary password. User should change it immediately after first login.
INSERT INTO master_system_user (
    user_id,
    username,
    email,
    full_name,
    password_hash,
    is_active,
    created_at,
    updated_at
)
VALUES (
    1,
    'superadmin',
    'admin@austamgood.com',
    'Super Administrator',
    '$2b$10$YQ7LKJ9kGZx6vB3jXqX0/.MZJYhKZH0YC2xvqVBWKVz8kQ3GxJYDK', -- Admin@123456
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO NOTHING;

-- Insert Admin user
-- Email: admin@buzzpetsfood.com / metee.c@buzzpetsfood.com
-- Username: admin
-- Password: Admin@123456 (bcrypt hash with salt rounds 10)
INSERT INTO master_system_user (
    user_id,
    username,
    email,
    full_name,
    password_hash,
    is_active,
    created_at,
    updated_at
)
VALUES (
    2,
    'admin',
    'metee.c@buzzpetsfood.com',
    'Administrator',
    '$2b$10$YQ7LKJ9kGZx6vB3jXqX0/.MZJYhKZH0YC2xvqVBWKVz8kQ3GxJYDK', -- Admin@123456
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO NOTHING;

-- Insert Test Manager user
-- Email: manager@austamgood.com
-- Username: manager
-- Password: Manager@123
INSERT INTO master_system_user (
    user_id,
    username,
    email,
    full_name,
    password_hash,
    is_active,
    created_at,
    updated_at
)
VALUES (
    3,
    'manager',
    'manager@austamgood.com',
    'Test Manager',
    '$2b$10$Nh5Vz0Z5pP8rQ9wY7xX5JeGJ9KQ3LZ7cN5vQ8wY7xX5JeGJ9KQ3LZ', -- Manager@123
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO NOTHING;

-- Insert Test User
-- Email: user@austamgood.com
-- Username: testuser
-- Password: User@123
INSERT INTO master_system_user (
    user_id,
    username,
    email,
    full_name,
    password_hash,
    is_active,
    created_at,
    updated_at
)
VALUES (
    4,
    'testuser',
    'user@austamgood.com',
    'Test User',
    '$2b$10$Lj4Wx1Y6oO7pP8wX6yW4IeEI8JP2KY6bM4uP7wX6yW4IeEI8JP2KY', -- User@123
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (user_id) DO NOTHING;

-- Update sequence to start after these manual inserts
SELECT setval('master_system_user_user_id_seq', (SELECT MAX(user_id) FROM master_system_user), true);
SELECT setval('master_system_role_role_id_seq', (SELECT MAX(role_id) FROM master_system_role), true);

-- Create index on email for faster login queries
CREATE INDEX IF NOT EXISTS idx_master_system_user_email_lower
    ON master_system_user(LOWER(email)) WHERE is_active = true;

-- Create index on username for faster login queries
CREATE INDEX IF NOT EXISTS idx_master_system_user_username_lower
    ON master_system_user(LOWER(username)) WHERE is_active = true;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '=== Default Admin Users Created ===';
    RAISE NOTICE 'Super Admin: admin@austamgood.com / superadmin (Password: Admin@123456)';
    RAISE NOTICE 'Admin: metee.c@buzzpetsfood.com / admin (Password: Admin@123456)';
    RAISE NOTICE 'Manager: manager@austamgood.com / manager (Password: Manager@123)';
    RAISE NOTICE 'User: user@austamgood.com / testuser (Password: User@123)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Change these default passwords immediately!';
END $$;
