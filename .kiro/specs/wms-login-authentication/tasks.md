# Implementation Tasks: WMS Login & Authentication System

## Phase 1: Core Authentication Infrastructure

### Task 1: Setup Authentication Utilities
- [ ] 1.1 Create password utilities (`lib/auth/password.ts`)
  - Implement `hashPassword()` with bcrypt cost 12
  - Implement `verifyPassword()` for password comparison
  - Implement `validatePassword()` with requirements check
  - _Requirements: 2.5, 3.5, 13.2_

- [ ] 1.2 Create token generation utilities (`lib/auth/tokens.ts`)
  - Implement `generateSessionToken()` - 128 chars secure random
  - Implement `generateResetToken()` - 64 chars secure random
  - Implement `generateVerificationToken()` - 32 chars secure random
  - _Requirements: 3.6, 3.7_

- [ ] 1.3 Create session management utilities (`lib/auth/session.ts`)
  - Implement `createSession()` - create session record in database
  - Implement `validateSession()` - check expiry, invalidated flag, idle timeout
  - Implement `invalidateSession()` - mark session as invalidated
  - Implement `invalidateAllUserSessions()` - invalidate all user sessions
  - Implement `extendSession()` - extend session expiration
  - Implement `updateSessionActivity()` - update last_activity_at
  - _Requirements: 4.1-4.10, 5.1-5.10_

- [ ] 1.4 Create permission checking utilities (`lib/auth/permissions.ts`)
  - Implement `hasPermission()` - check single permission
  - Implement `hasAnyPermission()` - check multiple with OR logic
  - Implement `hasAllPermissions()` - check multiple with AND logic
  - Implement `filterByPermissions()` - filter items by permissions
  - Implement `loadUserPermissions()` - load from database
  - _Requirements: 10.1-10.10, 14.1-14.10, 15.1-15.18_



### Task 2: Database Helper Functions
- [ ] 2.1 Create user query functions (`lib/database/auth-queries.ts`)
  - Implement `getUserByEmail()` - query master_system_user
  - Implement `getUserById()` - query by user_id
  - Implement `updateUserLoginInfo()` - update last_login_at, failed_attempts
  - Implement `lockUserAccount()` - set locked_until
  - Implement `unlockUserAccount()` - clear locked_until
  - _Requirements: 2.1-2.10_

- [ ] 2.2 Create session query functions
  - Implement `insertSession()` - create session record
  - Implement `getSessionByToken()` - query sessions table
  - Implement `updateSessionActivity()` - update last_activity_at
  - Implement `invalidateSessionById()` - set invalidated flag
  - Implement `invalidateUserSessions()` - invalidate all user sessions
  - Implement `cleanupExpiredSessions()` - delete old sessions
  - _Requirements: 4.1-4.10_

- [ ] 2.3 Create login attempt logging functions
  - Implement `logLoginAttempt()` - insert into login_attempts
  - Implement `getRecentFailedAttempts()` - count failed attempts
  - Implement `checkRateLimit()` - verify rate limiting
  - _Requirements: 11.1-11.9_

- [ ] 2.4 Create password reset token functions
  - Implement `createResetToken()` - insert into password_reset_tokens
  - Implement `validateResetToken()` - check expiry and used_at
  - Implement `useResetToken()` - mark token as used
  - Implement `cleanupExpiredTokens()` - delete old tokens
  - _Requirements: 7.1-7.12_

- [ ] 2.5 Create audit logging functions
  - Implement `logAuditEvent()` - insert into audit_logs
  - Implement `getAuditTrail()` - query audit logs with filters
  - _Requirements: 11.1-11.9, 23.1-23.10_



## Phase 2: API Endpoints

### Task 3: Login API
- [ ] 3.1 Create login endpoint (`app/api/auth/login/route.ts`)
  - Validate request body (email, password required)
  - Validate email format
  - Check rate limiting (10 attempts/hour per IP/email)
  - Query user by email
  - Check is_active flag
  - Check locked_until timestamp
  - Verify password with bcrypt
  - Load user roles from user_role table
  - Load permissions from role_permission table
  - Create session record
  - Set HTTP-only session cookie
  - Log successful login attempt
  - Return user data (exclude password_hash)
  - _Requirements: 1.1-1.9, 2.1-2.10_

- [ ] 3.2 Handle login errors
  - Return 400 for invalid email format
  - Return 401 for invalid credentials
  - Return 423 for locked account
  - Return 403 for inactive account
  - Return 429 for rate limit exceeded
  - Increment failed_login_attempts on failure
  - Lock account after 5 failed attempts
  - Log failed login attempts
  - _Requirements: 1.4, 1.5, 1.9, 2.4, 2.5_

### Task 4: Logout API
- [ ] 4.1 Create logout endpoint (`app/api/auth/logout/route.ts`)
  - Get session token from cookie
  - Invalidate session in database
  - Clear session cookie
  - Log logout event
  - Return success response
  - _Requirements: 4.8_

- [ ] 4.2 Create logout all devices endpoint (`app/api/auth/logout-all/route.ts`)
  - Get current session from cookie
  - Invalidate all user sessions except current
  - Return count of invalidated sessions
  - Log logout all event
  - _Requirements: 12.4, 12.5_

### Task 5: Session Validation API
- [ ] 5.1 Create session validation endpoint (`app/api/auth/session/route.ts`)
  - Get session token from cookie
  - Validate session (expiry, invalidated, idle timeout)
  - Update last_activity_at
  - Return session data with user info
  - Return expiration time remaining
  - _Requirements: 4.3-4.7_

- [ ] 5.2 Create session extension endpoint (`app/api/auth/session/extend/route.ts`)
  - Get session token from cookie
  - Validate current session
  - Extend expired_at by configured duration
  - Return new expiration time
  - _Requirements: 4.10_



### Task 6: Password Reset API
- [ ] 6.1 Create password reset request endpoint (`app/api/auth/reset-password/request/route.ts`)
  - Validate email format
  - Check rate limiting (3 requests/hour per email)
  - Query user by email (don't reveal if exists)
  - Generate reset token
  - Store token in password_reset_tokens with 1-hour expiry
  - Send email with reset link
  - Always return same success message
  - Log reset request
  - _Requirements: 7.1-7.5_

- [ ] 6.2 Create password reset validation endpoint (`app/api/auth/reset-password/validate/route.ts`)
  - Get token from query parameter
  - Query password_reset_tokens
  - Check token exists, not expired, not used
  - Return validity status and email (if valid)
  - _Requirements: 7.6_

- [ ] 6.3 Create password reset completion endpoint (`app/api/auth/reset-password/complete/route.ts`)
  - Validate token
  - Validate new password requirements
  - Hash new password with bcrypt
  - Update master_system_user.password_hash
  - Mark token as used (set used_at)
  - Invalidate all user sessions
  - Log password change event
  - Return success response
  - _Requirements: 7.7-7.12_

### Task 7: Admin Force Logout API
- [ ] 7.1 Create force logout endpoint (`app/api/auth/admin/force-logout/route.ts`)
  - Verify admin has permission (master.users.edit)
  - Get target user_id from request
  - Invalidate all sessions for target user
  - Set invalidated_by to admin user_id
  - Log force logout action in audit_logs
  - Optionally send notification email to user
  - Return count of invalidated sessions
  - _Requirements: 6.1-6.10_

- [ ] 7.2 Create active sessions list endpoint (`app/api/auth/admin/sessions/route.ts`)
  - Verify admin has permission
  - Query active sessions with user info
  - Return list with device info, IP, last activity
  - Support filtering by user_id
  - _Requirements: 6.6_



## Phase 3: Middleware and Guards

### Task 8: Authentication Middleware
- [ ] 8.1 Create Next.js middleware (`middleware.ts`)
  - Get session token from cookie
  - Define public routes (login, reset-password)
  - Skip auth check for public routes
  - Validate session for protected routes
  - Redirect to /login if session invalid
  - Add user data to request headers
  - Handle session expiration gracefully
  - _Requirements: 4.3-4.8_

- [ ] 8.2 Create API middleware helper (`lib/auth/api-middleware.ts`)
  - Implement `requireAuth()` - verify session exists
  - Implement `requirePermission()` - verify specific permission
  - Implement `requireAnyPermission()` - verify any of multiple permissions
  - Implement `requireAllPermissions()` - verify all of multiple permissions
  - Return 401 for missing auth
  - Return 403 for missing permission
  - Log permission denial attempts
  - _Requirements: 18.1-18.10_

### Task 9: Frontend Auth Context
- [ ] 9.1 Create Auth Context (`contexts/AuthContext.tsx`)
  - Provide user data from session
  - Provide permissions array
  - Provide roles array
  - Provide login function
  - Provide logout function
  - Provide session refresh function
  - Handle session expiration
  - Redirect to login on 401
  - _Requirements: 4.3-4.10_

- [ ] 9.2 Create permission hooks (`hooks/usePermission.ts`)
  - Implement `usePermission()` - check single permission
  - Implement `useHasAnyPermission()` - check multiple with OR
  - Implement `useHasAllPermissions()` - check multiple with AND
  - Implement `useHasRole()` - check if user has role
  - _Requirements: 19.1-19.10_

- [ ] 9.3 Create permission guard components (`components/auth/PermissionGuard.tsx`)
  - Implement `<PermissionGuard>` - show children if has permission
  - Implement `<RoleGuard>` - show children if has role
  - Implement `<AnyPermissionGuard>` - show if has any permission
  - Support fallback content for denied access
  - _Requirements: 19.1-19.10_



## Phase 4: User Interface

### Task 10: Login Page
- [ ] 10.1 Create login page (`app/login/page.tsx`)
  - Create centered layout with WMS branding
  - Display logo at top
  - Show login form in card with shadow
  - Include copyright footer
  - Responsive design (desktop, tablet, mobile)
  - Thai language labels
  - Professional color scheme (blue primary, gray secondary)
  - _Requirements: 8.1-8.10_

- [ ] 10.2 Create login form component (`components/auth/LoginForm.tsx`)
  - Email input field with validation
  - Password input field with show/hide toggle
  - Submit button with loading state
  - "ลืมรหัสผ่าน?" link
  - Display error messages in red below fields
  - Disable form during submission
  - Show loading spinner on submit
  - Handle Enter key submission
  - _Requirements: 1.1-1.9, 8.2-8.7_

- [ ] 10.3 Implement login form logic
  - Validate email format before submission
  - Call /api/auth/login endpoint
  - Handle success: redirect to dashboard
  - Handle errors: display appropriate Thai messages
  - Show account locked message with time remaining
  - Show inactive account message
  - Show rate limit exceeded message
  - Clear form on error
  - _Requirements: 1.3-1.9_

### Task 11: Password Reset Pages
- [ ] 11.1 Create password reset request page (`app/reset-password/page.tsx`)
  - Display email input form
  - Submit button
  - Link back to login
  - Show success message after submission
  - Handle rate limiting errors
  - _Requirements: 7.1-7.5_

- [ ] 11.2 Create password reset form page (`app/reset-password/[token]/page.tsx`)
  - Validate token on page load
  - Show error if token invalid/expired
  - Display new password input
  - Display confirm password input
  - Show password requirements
  - Validate passwords match
  - Submit new password
  - Redirect to login on success
  - _Requirements: 7.6-7.12_



### Task 12: User Session Management UI
- [ ] 12.1 Create session management page (`app/account/sessions/page.tsx`)
  - Display list of active sessions
  - Show current session with label
  - Display device info, browser, OS
  - Show IP address and location
  - Display last activity time
  - "ออกจากระบบอุปกรณ์นี้" button per session
  - "ออกจากระบบทุกอุปกรณ์" button
  - "ออกจากระบบทุกอุปกรณ์รวมถึงอุปกรณ์นี้" button
  - Confirm dialog before logout
  - _Requirements: 12.1-12.10_

- [ ] 12.2 Implement session management logic
  - Call /api/auth/session/list to get sessions
  - Call /api/auth/session/invalidate to logout specific session
  - Call /api/auth/logout-all to logout all devices
  - Refresh session list after actions
  - Handle errors gracefully
  - _Requirements: 12.3-12.5_

### Task 13: Admin User Management UI
- [ ] 13.1 Enhance user management page (`app/master-data/users/page.tsx`)
  - Add "Active Sessions" column showing count
  - Add "Force Logout" action button
  - Add "Lock Account" action button
  - Add "Unlock Account" action button
  - Show last login timestamp
  - Show failed login attempts count
  - Filter by active/inactive/locked status
  - _Requirements: 6.1-6.10_

- [ ] 13.2 Create force logout dialog
  - Confirm dialog with reason input
  - Call /api/auth/admin/force-logout
  - Show success message with count
  - Refresh user list
  - Log action in audit trail
  - _Requirements: 6.1-6.7_

- [ ] 13.3 Create active sessions modal
  - Display all sessions for selected user
  - Show device info, IP, last activity
  - Allow admin to invalidate specific sessions
  - Show session creation time
  - _Requirements: 6.6_



## Phase 5: Permission Management

### Task 14: Role Management API
- [ ] 14.1 Create role CRUD endpoints (`app/api/roles/`)
  - GET /api/roles - list all roles
  - GET /api/roles/[id] - get role details with permissions
  - POST /api/roles - create new role
  - PUT /api/roles/[id] - update role
  - DELETE /api/roles/[id] - delete role (check if assigned)
  - Require master.roles permissions
  - _Requirements: 16.1-16.15, 17.1-17.10_

- [ ] 14.2 Create role permission endpoints
  - GET /api/roles/[id]/permissions - get role permissions
  - PUT /api/roles/[id]/permissions - update role permissions
  - POST /api/roles/[id]/permissions/bulk - bulk update permissions
  - Log all permission changes in audit_logs
  - _Requirements: 23.1-23.10_

- [ ] 14.3 Create user role assignment endpoints
  - GET /api/users/[id]/roles - get user roles
  - POST /api/users/[id]/roles - assign role to user
  - DELETE /api/users/[id]/roles/[roleId] - remove role from user
  - Validate role exists and is active
  - _Requirements: 17.1-17.10_

### Task 15: Permission Module Management
- [ ] 15.1 Create permission module endpoints (`app/api/permissions/modules/`)
  - GET /api/permissions/modules - list all modules (hierarchical)
  - GET /api/permissions/modules/tree - get module tree structure
  - GET /api/permissions/modules/[id] - get module details
  - Support filtering by parent_module_id
  - Support filtering by is_active
  - _Requirements: 14.1-14.10_

- [ ] 15.2 Create permission types endpoint
  - GET /api/permissions/types - list all permission types
  - Return: view, create, edit, delete, approve, import, export, print, scan, assign, complete, cancel, rollback, publish, optimize, change_status, manage_coordinates, reset_reservations
  - _Requirements: 15.1-15.18_



### Task 16: Role Management UI
- [ ] 16.1 Create role list page (`app/master-data/roles/page.tsx`)
  - Display table of all roles
  - Show role name, description, user count
  - Mark system roles (cannot delete)
  - "Create Role" button
  - Edit and Delete actions
  - Filter by system/custom roles
  - Search by role name
  - _Requirements: 25.1_

- [ ] 16.2 Create role form dialog (`components/roles/RoleFormDialog.tsx`)
  - Role name input (required, unique)
  - Description textarea
  - Permission selection tree
  - Hierarchical display of modules
  - Checkboxes for each permission type
  - "Check All" / "Uncheck All" for module
  - Save and Cancel buttons
  - Validation: at least one permission required
  - _Requirements: 25.2-25.6_

- [ ] 16.3 Create permission tree component (`components/roles/PermissionTree.tsx`)
  - Display modules in hierarchical tree
  - Show parent-child relationships with indentation
  - Checkbox for each permission type (18 types)
  - Column headers: View, Create, Edit, Delete, Approve, Import, Export, Print, Scan, Assign, Complete, Cancel, Rollback, Publish, Optimize, Change Status, Manage Coordinates, Reset Reservations
  - Check parent checks all children (optional)
  - Show permission count per module
  - Expand/collapse modules
  - _Requirements: 25.3-25.4, 25.9_

- [ ] 16.4 Create role details page (`app/master-data/roles/[id]/page.tsx`)
  - Display role information
  - Show list of users with this role
  - Show summary of granted permissions
  - Edit role button
  - Delete role button (with confirmation)
  - Assign to user button
  - _Requirements: 25.8_

- [ ] 16.5 Create role assignment dialog (`components/roles/RoleAssignmentDialog.tsx`)
  - User search/select interface
  - Multi-select for roles
  - Show current roles for selected user
  - Save button
  - Display success message
  - _Requirements: 25.10_



## Phase 6: Advanced Permission Features

### Task 17: Data-Level Permissions
- [ ] 17.1 Create data permission table migration (if not exists)
  - Create user_data_permissions table
  - Fields: id, user_id, permission_type, entity_id, created_at
  - permission_type: warehouse, customer, supplier, location
  - _Requirements: 20.1-20.2_

- [ ] 17.2 Create data permission query helpers (`lib/auth/data-permissions.ts`)
  - Implement `getUserDataPermissions()` - load user restrictions
  - Implement `filterByWarehouse()` - filter query by allowed warehouses
  - Implement `filterByCustomer()` - filter by allowed customers
  - Implement `filterBySupplier()` - filter by allowed suppliers
  - Implement `filterByLocation()` - filter by allowed locations
  - _Requirements: 20.3-20.10_

- [ ] 17.3 Create data permission API endpoints
  - GET /api/users/[id]/data-permissions - get user data permissions
  - POST /api/users/[id]/data-permissions - assign data permissions
  - DELETE /api/users/[id]/data-permissions/[permissionId] - remove
  - _Requirements: 20.9_

- [ ] 17.4 Create data permission UI (`components/users/DataPermissionDialog.tsx`)
  - Select permission type (warehouse, customer, supplier, location)
  - Multi-select for allowed entities
  - Save button
  - Show current restrictions
  - _Requirements: 20.9_

### Task 18: Field-Level Permissions
- [ ] 18.1 Create field permission table migration (if not exists)
  - Create role_field_permissions table
  - Fields: id, role_id, module_id, field_name, can_view, can_edit
  - _Requirements: 21.1-21.2_

- [ ] 18.2 Create field permission helpers (`lib/auth/field-permissions.ts`)
  - Implement `getFieldPermissions()` - load field permissions for role
  - Implement `canViewField()` - check if field visible
  - Implement `canEditField()` - check if field editable
  - Implement `filterFields()` - filter object fields by permissions
  - _Requirements: 21.3-21.10_

- [ ] 18.3 Create field permission API endpoints
  - GET /api/roles/[id]/field-permissions - get field permissions
  - PUT /api/roles/[id]/field-permissions - update field permissions
  - _Requirements: 21.10_

- [ ] 18.4 Create field permission UI
  - Display fields for each module
  - Checkboxes for can_view and can_edit
  - Save button
  - _Requirements: 21.10_



### Task 19: Permission Groups
- [ ] 19.1 Create permission groups table migration (if not exists)
  - Create permission_groups table
  - Fields: group_id, group_name, group_key, description, permission_keys (array), is_system
  - _Requirements: 24.1-24.2_

- [ ] 19.2 Insert default permission groups
  - Warehouse Full Access
  - Orders Full Access
  - Master Data Full Access
  - Mobile Operations
  - View Only All
  - Reports Access
  - Mark as is_system = true
  - _Requirements: 24.3-24.4_

- [ ] 19.3 Create permission group API endpoints
  - GET /api/permissions/groups - list all groups
  - GET /api/permissions/groups/[id] - get group details
  - POST /api/permissions/groups - create custom group
  - PUT /api/permissions/groups/[id] - update custom group
  - DELETE /api/permissions/groups/[id] - delete custom group (not system)
  - _Requirements: 24.5-24.10_

- [ ] 19.4 Create permission group UI
  - List of permission groups
  - Create group dialog
  - Multi-select permissions
  - Support wildcard expansion (warehouse.*)
  - Show permission count
  - Indicate system vs custom groups
  - _Requirements: 24.6-24.10_

- [ ] 19.5 Integrate groups with role assignment
  - Add "Assign Permission Group" button in role form
  - Select group from dropdown
  - Apply all group permissions to role
  - _Requirements: 24.5_



## Phase 7: Audit and Monitoring

### Task 20: Audit Log UI
- [ ] 20.1 Create audit log page (`app/admin/audit-logs/page.tsx`)
  - Display table of audit logs
  - Columns: timestamp, user, action, entity type, entity ID
  - Filter by user
  - Filter by date range
  - Filter by action type
  - Filter by entity type
  - Pagination (50 records per page)
  - Export to CSV
  - _Requirements: 11.8, 23.5-23.7_

- [ ] 20.2 Create audit log detail modal
  - Show full audit log details
  - Display old_values and new_values (JSON diff)
  - Show IP address, user agent
  - Show session ID
  - _Requirements: 23.4_

- [ ] 20.3 Create permission audit log page (`app/admin/permission-audit/page.tsx`)
  - Display permission changes specifically
  - Show granted/revoked/modified actions
  - Filter by role
  - Filter by permission key
  - Show changed_by user
  - Display reason if provided
  - _Requirements: 23.1-23.10_

### Task 21: Login Attempts Monitoring
- [ ] 21.1 Create login attempts page (`app/admin/login-attempts/page.tsx`)
  - Display table of recent login attempts
  - Columns: timestamp, email, IP, success, failure reason
  - Filter by success/failure
  - Filter by date range
  - Filter by email
  - Filter by IP address
  - Show statistics: total, success rate, unique users
  - _Requirements: 11.1-11.9_

- [ ] 21.2 Create suspicious activity dashboard
  - Show accounts with multiple failed attempts
  - Show IPs with high failure rate
  - Show locked accounts
  - Alert for unusual patterns
  - _Requirements: 11.7_



## Phase 8: System Settings Management

### Task 22: System Settings UI
- [ ] 22.1 Create system settings page (`app/admin/settings/page.tsx`)
  - Display all system settings grouped by module
  - Show setting key, value, type, description
  - Edit button per setting
  - Search/filter settings
  - _Requirements: 5.6-5.7_

- [ ] 22.2 Create setting edit dialog
  - Input field based on setting_type
  - Number input for number type
  - Checkbox for boolean type
  - Textarea for string type
  - JSON editor for json type
  - Validation based on type
  - Save button
  - Show last updated by and timestamp
  - _Requirements: 5.6-5.7_

- [ ] 22.3 Create authentication settings section
  - Group auth.* settings together
  - Show current values
  - Quick edit for common settings:
    - Session duration
    - Max failed attempts
    - Lock duration
    - Idle timeout
    - Password requirements
  - Apply changes immediately
  - _Requirements: 5.6-5.7_

### Task 23: System Settings API
- [ ] 23.1 Create settings endpoints (`app/api/settings/`)
  - GET /api/settings - list all settings
  - GET /api/settings/[key] - get specific setting
  - PUT /api/settings/[key] - update setting
  - Require admin permission
  - Log changes in audit_logs
  - _Requirements: 5.6-5.7_

