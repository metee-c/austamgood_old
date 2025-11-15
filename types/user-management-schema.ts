import { z } from 'zod';

// Schema for master_system_user
export const SystemUserSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  phone_number: z.string().nullable(),
  employee_id: z.number().nullable(),
  password_hash: z.string(),
  last_login_at: z.string().datetime().nullable(),
  is_active: z.boolean(),
  created_by: z.number().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  remarks: z.string().nullable(),
});

export type SystemUser = z.infer<typeof SystemUserSchema>;

// Schema for master_system_role
export const SystemRoleSchema = z.object({
  role_id: z.number(),
  role_name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_by: z.number().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SystemRole = z.infer<typeof SystemRoleSchema>;

// Schema for user_role
export const UserRoleSchema = z.object({
  user_id: z.number(),
  role_id: z.number(),
  created_by: z.number().nullable(),
  created_at: z.string().datetime(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;

// Schema for master_permission_module
export const PermissionModuleSchema = z.object({
  module_id: z.number(),
  module_name: z.string(),
  description: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type PermissionModule = z.infer<typeof PermissionModuleSchema>;

// Schema for role_permission
export const RolePermissionSchema = z.object({
  role_id: z.number(),
  module_id: z.number(),
  can_view: z.boolean(),
  can_create: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  can_approve: z.boolean(),
  created_by: z.number().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type RolePermission = z.infer<typeof RolePermissionSchema>;

// Extended types for UI
export const SystemUserWithRolesSchema = SystemUserSchema.extend({
  roles: z.array(SystemRoleSchema).optional(),
  employee_name: z.string().nullable().optional(),
});

export type SystemUserWithRoles = z.infer<typeof SystemUserWithRolesSchema>;

export const SystemRoleWithPermissionsSchema = SystemRoleSchema.extend({
  permissions: z.array(RolePermissionSchema).optional(),
  user_count: z.number().optional(),
});

export type SystemRoleWithPermissions = z.infer<typeof SystemRoleWithPermissionsSchema>;

// Form schemas for validation
export const CreateUserSchema = z.object({
  username: z.string().min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'),
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
  full_name: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  phone_number: z.string().optional(),
  employee_id: z.number().optional(),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  role_ids: z.array(z.number()).min(1, 'กรุณาเลือกบทบาทอย่างน้อย 1 บทบาท'),
  is_active: z.boolean().default(true),
  remarks: z.string().optional(),
});

export type CreateUserData = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  user_id: z.number(),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร').optional(),
});

export type UpdateUserData = z.infer<typeof UpdateUserSchema>;

export const CreateRoleSchema = z.object({
  role_name: z.string().min(1, 'กรุณากรอกชื่อบทบาท'),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  permissions: z.array(z.object({
    module_id: z.number(),
    can_view: z.boolean().default(false),
    can_create: z.boolean().default(false),
    can_edit: z.boolean().default(false),
    can_delete: z.boolean().default(false),
    can_approve: z.boolean().default(false),
  })).optional(),
});

export type CreateRoleData = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = CreateRoleSchema.partial().extend({
  role_id: z.number(),
});

export type UpdateRoleData = z.infer<typeof UpdateRoleSchema>;

// Filter schemas
export const UserFiltersSchema = z.object({
  search: z.string().optional(),
  role_id: z.number().optional(),
  is_active: z.boolean().optional(),
  employee_id: z.number().optional(),
});

export type UserFilters = z.infer<typeof UserFiltersSchema>;

export const RoleFiltersSchema = z.object({
  search: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type RoleFilters = z.infer<typeof RoleFiltersSchema>;

// Employee schema for dropdown selection
export const EmployeeSchema = z.object({
  employee_id: z.number(),
  employee_name: z.string(),
  employee_code: z.string(),
  position: z.string().nullable(),
  department: z.string().nullable(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
