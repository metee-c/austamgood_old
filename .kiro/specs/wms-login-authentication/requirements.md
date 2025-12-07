# Requirements Document: WMS Login & Authentication System

## Introduction

ระบบ Login, Authentication และ Permission Management สำหรับระบบจัดการคลังสินค้า (Warehouse Management System - WMS) ที่ทำงานบน Next.js 15.5+ และ Supabase PostgreSQL โดยมีการจัดการผู้ใช้งานผ่านตาราง `master_system_user` ที่มีอยู่แล้ว 

ระบบนี้ครอบคลุม:
- **Authentication**: การเข้าสู่ระบบด้วย email/password, การจัดการ session, การออกจากระบบอัตโนมัติ, การบังคับออกจากระบบโดย admin, การรีเซ็ตรหัสผ่าน
- **Authorization**: ระบบ Role-Based Access Control (RBAC) แบบละเอียด (Granular) ที่ครอบคลุม 260+ permissions, 11 predefined roles, และรองรับ data-level permissions
- **Security**: มาตรการความปลอดภัยพื้นฐานที่เหมาะสมกับระบบภายในองค์กร

ระบบนี้ออกแบบมาเพื่อรองรับผู้ใช้งานประมาณ 20 คน/วัน บน Vercel และ Supabase โดยเน้นประสิทธิภาพและประสบการณ์ผู้ใช้ที่ดี

## Glossary

- **System**: ระบบ WMS Login, Authentication & Permission Management
- **User**: ผู้ใช้งานระบบ WMS ที่มีข้อมูลใน master_system_user
- **Admin**: ผู้ดูแลระบบที่มีสิทธิ์จัดการผู้ใช้งานและสิทธิ์อื่น
- **Session**: เซสชันการเข้าใช้งานของผู้ใช้หลังจาก login สำเร็จ
- **Token**: รหัสสำหรับการยืนยันตัวตน หรือการรีเซ็ตรหัสผ่าน
- **Password Hash**: รหัสผ่านที่เข้ารหัสแล้วด้วย bcrypt
- **Session Timeout**: ระยะเวลาที่ session จะหมดอายุหากไม่มีการใช้งาน
- **Rate Limiting**: การจำกัดจำนวนครั้งของการพยายาม login เพื่อป้องกัน brute-force
- **Role**: บทบาทของผู้ใช้ เช่น Admin, Warehouse Manager, Picker
- **Permission**: สิทธิ์ในการทำงานเฉพาะ เช่น warehouse.inbound.view, orders.create
- **Permission Module**: โมดูลที่กำหนดสิทธิ์ได้ มีโครงสร้างแบบ hierarchical
- **RBAC**: Role-Based Access Control - การควบคุมสิทธิ์ตามบทบาท
- **Granular Permissions**: สิทธิ์ที่ละเอียด แยกตาม action (view, create, edit, delete, etc.)
- **Data-Level Permissions**: สิทธิ์ในการเข้าถึงข้อมูลเฉพาะ เช่น เห็นเฉพาะคลังของตัวเอง
- **Field-Level Permissions**: สิทธิ์ในการดู/แก้ไข fields เฉพาะในฟอร์ม

## Requirements

### Requirement 1: หน้าเข้าสู่ระบบ (Login Page)

**User Story:** As a WMS user, I want to log in to the system using my email and password, so that I can access warehouse management features securely.

#### Acceptance Criteria

1. WHEN a user navigates to the login page THEN the System SHALL display a login form with email input field, password input field, and submit button
2. WHEN a user enters valid email and password and clicks submit THEN the System SHALL authenticate the credentials against master_system_user table
3. WHEN a user enters an invalid email format THEN the System SHALL display an error message "รูปแบบอีเมลไม่ถูกต้อง" before submission
4. WHEN a user enters incorrect email or password THEN the System SHALL display an error message "อีเมลหรือรหัสผ่านไม่ถูกต้อง" and increment failed login attempts
5. WHEN a user's account has is_active = false THEN the System SHALL display an error message "บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ" and prevent login

6. WHEN a user successfully logs in THEN the System SHALL create a new session record and redirect to dashboard
7. WHEN a user clicks "ลืมรหัสผ่าน" link THEN the System SHALL navigate to password reset page
8. WHEN the login page loads THEN the System SHALL display the page in Thai language with professional WMS-appropriate styling
9. WHEN a user has exceeded maximum failed login attempts THEN the System SHALL temporarily lock the account and display "บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ในอีก X นาที"

### Requirement 2: การตรวจสอบสิทธิ์ (Authentication)

**User Story:** As the System, I want to securely authenticate users against the database, so that only authorized users can access the system.

#### Acceptance Criteria

1. WHEN a user submits login credentials THEN the System SHALL query master_system_user table using the provided email
2. WHEN the email exists in master_system_user THEN the System SHALL compare the provided password with password_hash using bcrypt
3. WHEN password verification succeeds THEN the System SHALL retrieve user's role information from user_role and role_permission tables
4. WHEN password verification fails THEN the System SHALL increment failed_login_attempts counter and return authentication failure
5. WHEN a user has failed_login_attempts >= 5 THEN the System SHALL set locked_until to current time + 15 minutes
6. WHEN a user successfully authenticates THEN the System SHALL reset failed_login_attempts to 0 and update last_login_at timestamp
7. WHEN retrieving user data THEN the System SHALL include user_id, username, email, full_name, employee_id, role information, and permissions
8. WHEN a user's is_active is false THEN the System SHALL reject authentication regardless of correct credentials
9. WHEN a user's locked_until is in the future THEN the System SHALL reject authentication and return remaining lock time
10. WHEN authentication succeeds THEN the System SHALL NOT expose password_hash in any response or log

### Requirement 3: โครงสร้างตารางและ Schema

**User Story:** As a developer, I want well-designed database tables for authentication, so that the system can manage users, sessions, and tokens securely and efficiently.

#### Acceptance Criteria

1. WHEN the System initializes THEN master_system_user table SHALL contain fields: user_id (PK), username (unique), email (unique), full_name, phone_number, employee_id (FK), password_hash, last_login_at, is_active, created_by, created_at, updated_at, remarks
2. WHEN the System initializes THEN sessions table SHALL contain fields: session_id (PK), user_id (FK), token (unique), created_at, expired_at, last_activity_at, ip_address, user_agent, device_info, invalidated (boolean), invalidated_at, invalidated_by
3. WHEN the System initializes THEN password_reset_tokens table SHALL contain fields: token_id (PK), user_id (FK), token (unique), created_at, expired_at, used_at, ip_address
4. WHEN the System initializes THEN login_attempts table SHALL contain fields: attempt_id (PK), email, ip_address, user_agent, attempted_at, success (boolean), failure_reason
5. WHEN storing password_hash THEN the System SHALL use bcrypt with cost factor of 12
6. WHEN creating session token THEN the System SHALL generate a cryptographically secure random string of at least 64 characters
7. WHEN creating password reset token THEN the System SHALL generate a cryptographically secure random string of at least 32 characters
8. WHEN defining foreign keys THEN the System SHALL enforce referential integrity with ON DELETE CASCADE for sessions and tokens

### Requirement 4: ระบบ Session Management

**User Story:** As the System, I want to manage user sessions securely, so that authenticated users can access the system without re-logging in for each request.

#### Acceptance Criteria

1. WHEN a user successfully logs in THEN the System SHALL create a new record in sessions table with unique token, user_id, created_at, expired_at (24 hours from creation), last_activity_at, ip_address, user_agent, device_info
2. WHEN creating a session THEN the System SHALL set expired_at to created_at + configurable session duration (default 24 hours)
3. WHEN a user makes an authenticated API request THEN the System SHALL validate the session token from HTTP-only cookie or Authorization header
4. WHEN validating a session THEN the System SHALL check that token exists, expired_at > current time, and invalidated = false
5. WHEN a session is valid THEN the System SHALL update last_activity_at to current timestamp
6. WHEN last_activity_at + idle_timeout < current time THEN the System SHALL consider the session expired and reject the request
7. WHEN a user has multiple active sessions THEN the System SHALL allow all valid sessions to coexist
8. WHEN a session token is invalid or expired THEN the System SHALL return 401 Unauthorized and clear the session cookie
9. WHEN storing session token in cookie THEN the System SHALL set HttpOnly, Secure (in production), SameSite=Strict flags
10. WHEN a user's session is about to expire (within 5 minutes) THEN the System SHALL provide a mechanism to extend the session

### Requirement 5: การออกจากระบบอัตโนมัติ (Auto Logout)

**User Story:** As an admin, I want to configure automatic logout timeouts for users, so that inactive sessions are terminated for security.

#### Acceptance Criteria

1. WHEN the System checks session validity THEN the System SHALL compare current time with expired_at field
2. WHEN current time > expired_at THEN the System SHALL reject the session and return 401 Unauthorized
3. WHEN a user makes any authenticated request THEN the System SHALL update last_activity_at to current timestamp
4. WHEN the System has configurable idle_timeout setting THEN the System SHALL check if (current time - last_activity_at) > idle_timeout
5. WHEN idle timeout is exceeded THEN the System SHALL invalidate the session and require re-login
6. WHEN admin configures session_duration THEN the System SHALL apply this duration to all new sessions created after configuration change
7. WHEN admin configures idle_timeout THEN the System SHALL apply this timeout to all session validation checks
8. WHEN a session expires due to timeout THEN the System SHALL set invalidated = true and invalidated_at = current timestamp
9. WHEN frontend detects session expiration THEN the System SHALL redirect user to login page with message "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"
10. WHEN the System performs session cleanup THEN the System SHALL delete sessions where expired_at < (current time - 7 days)

### Requirement 6: แอดมินสั่งออกจากระบบทันที (Force Logout)

**User Story:** As an admin, I want to force logout specific users immediately, so that I can revoke access in emergency situations or security incidents.

#### Acceptance Criteria

1. WHEN an admin selects a user and clicks "บังคับออกจากระบบ" THEN the System SHALL set invalidated = true for all active sessions of that user
2. WHEN invalidating sessions THEN the System SHALL set invalidated_at to current timestamp and invalidated_by to admin's user_id
3. WHEN a user with invalidated session makes a request THEN the System SHALL check invalidated field and reject with 401 Unauthorized
4. WHEN frontend receives 401 due to invalidated session THEN the System SHALL immediately redirect to login page with message "คุณถูกออกจากระบบโดยผู้ดูแล"
5. WHEN admin force logs out a user THEN the System SHALL invalidate ALL active sessions for that user across all devices
6. WHEN admin views user management page THEN the System SHALL display list of active sessions per user with device info and last activity time
7. WHEN admin force logs out a user THEN the System SHALL log this action in audit trail with admin_id, user_id, timestamp, and reason
8. WHEN a user is force logged out THEN the System SHALL optionally send notification email to the user
9. WHEN frontend polls for session status THEN the System SHALL check invalidated flag every 60 seconds
10. WHEN a session is invalidated THEN the System SHALL clear the session cookie and local storage on next API call

### Requirement 7: ลืมรหัสผ่าน (Reset Password)

**User Story:** As a user, I want to reset my password if I forget it, so that I can regain access to my account securely.

#### Acceptance Criteria

1. WHEN a user clicks "ลืมรหัสผ่าน" THEN the System SHALL display a form requesting email address
2. WHEN a user submits email for password reset THEN the System SHALL check if email exists in master_system_user
3. WHEN email exists THEN the System SHALL generate a unique reset token, store it in password_reset_tokens with expired_at = current time + 1 hour
4. WHEN reset token is created THEN the System SHALL send an email to the user with reset link containing the token
5. WHEN email does not exist THEN the System SHALL display the same success message to prevent email enumeration: "หากอีเมลนี้มีในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่าน"
6. WHEN a user clicks reset link THEN the System SHALL validate token exists, not expired, and not used
7. WHEN token is valid THEN the System SHALL display password reset form with new password and confirm password fields
8. WHEN a user submits new password THEN the System SHALL validate password meets requirements (min 8 characters, contains uppercase, lowercase, number, special character)
9. WHEN new password is valid THEN the System SHALL hash password with bcrypt, update password_hash in master_system_user, set used_at in password_reset_tokens, and invalidate all existing sessions for that user
10. WHEN password reset succeeds THEN the System SHALL redirect to login page with success message "รหัสผ่านถูกเปลี่ยนแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"
11. WHEN a reset token is used THEN the System SHALL mark used_at and prevent reuse
12. WHEN a reset token is expired THEN the System SHALL display error "ลิงก์รีเซ็ตรหัสผ่านหมดอายุแล้ว กรุณาขอลิงก์ใหม่"

### Requirement 8: UX/UI ของหน้า Login

**User Story:** As a user, I want a clean and professional login interface, so that I can easily and confidently access the system.

#### Acceptance Criteria

1. WHEN the login page loads THEN the System SHALL display a centered login form with WMS branding
2. WHEN displaying form fields THEN the System SHALL show clear labels in Thai: "อีเมล", "รหัสผ่าน"
3. WHEN a user types in password field THEN the System SHALL mask the password with bullets and provide a toggle to show/hide
4. WHEN form validation fails THEN the System SHALL display error messages in red text below the relevant field
5. WHEN login is processing THEN the System SHALL disable the submit button and show loading spinner with text "กำลังเข้าสู่ระบบ..."
6. WHEN displaying the login page THEN the System SHALL use responsive design that works on desktop (1920x1080), tablet (768x1024), and mobile (375x667)
7. WHEN a user focuses on input fields THEN the System SHALL provide visual feedback with border color change
8. WHEN displaying links THEN the System SHALL show "ลืมรหัสผ่าน?" link below password field
9. WHEN the page loads THEN the System SHALL use professional color scheme matching WMS brand (primary: blue, secondary: gray, accent: green for success, red for errors)
10. WHEN displaying the form THEN the System SHALL include WMS logo at top, form in center card with shadow, and footer with copyright

### Requirement 9: ความเข้ากันได้กับ Vercel + Supabase

**User Story:** As a system architect, I want the authentication system optimized for Vercel and Supabase deployment, so that it performs well and stays within resource limits.

#### Acceptance Criteria

1. WHEN deploying to Vercel THEN the System SHALL use Next.js API routes for authentication endpoints
2. WHEN handling authentication THEN the System SHALL use Supabase PostgreSQL connection pooling to prevent connection exhaustion
3. WHEN creating database queries THEN the System SHALL use prepared statements to prevent SQL injection and improve performance
4. WHEN storing sessions THEN the System SHALL use database sessions (not in-memory) to support Vercel's serverless architecture
5. WHEN the System handles 20 concurrent users THEN the System SHALL maintain response time under 500ms for login and under 100ms for session validation
6. WHEN using Supabase free tier THEN the System SHALL stay within 500MB database size and 2GB bandwidth per month limits
7. WHEN implementing rate limiting THEN the System SHALL use Vercel Edge Config or Supabase database for distributed rate limit tracking
8. WHEN sending emails THEN the System SHALL use Supabase Edge Functions or external service (SendGrid, AWS SES) to avoid Vercel function timeout
9. WHEN session cleanup runs THEN the System SHALL use Supabase cron jobs or Vercel cron to delete expired sessions daily
10. WHEN monitoring system THEN the System SHALL log authentication events to Supabase for analysis without exceeding storage limits
11. WHEN handling errors THEN the System SHALL use Vercel error tracking and Supabase logs for debugging
12. WHEN scaling to 20 users/day THEN the System SHALL consume approximately 100 database queries/day, 50MB bandwidth/day, and 10MB storage for sessions/tokens

### Requirement 10: การจัดการ Role และ Permission

**User Story:** As the System, I want to load user roles and permissions during authentication, so that access control can be enforced throughout the application.

#### Acceptance Criteria

1. WHEN a user successfully authenticates THEN the System SHALL query user_role table to retrieve all roles assigned to the user
2. WHEN user roles are retrieved THEN the System SHALL query role_permission table to get all permissions for those roles
3. WHEN loading permissions THEN the System SHALL include module_id, can_view, can_create, can_edit, can_delete, can_approve flags
4. WHEN storing session THEN the System SHALL include serialized role and permission data in session for quick access
5. WHEN permissions change THEN the System SHALL require user to re-login to refresh permissions (or implement permission cache invalidation)
6. WHEN a user has multiple roles THEN the System SHALL merge permissions using OR logic (if any role grants permission, user has it)
7. WHEN checking permissions THEN the System SHALL provide helper functions: hasPermission(module, action), hasRole(roleName)
8. WHEN API endpoints are accessed THEN the System SHALL verify user has required permission before processing request
9. WHEN permission check fails THEN the System SHALL return 403 Forbidden with message "คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้"
10. WHEN displaying UI THEN the System SHALL hide/disable features based on user permissions

### Requirement 11: Audit Trail และ Logging

**User Story:** As an admin, I want comprehensive logging of authentication events, so that I can audit security incidents and user activity.

#### Acceptance Criteria

1. WHEN a user attempts login THEN the System SHALL log attempt in login_attempts table with email, ip_address, user_agent, attempted_at, success, failure_reason
2. WHEN a user successfully logs in THEN the System SHALL log with success=true and update last_login_at in master_system_user
3. WHEN a user fails login THEN the System SHALL log with success=false and appropriate failure_reason (invalid_credentials, account_locked, account_inactive, email_not_verified)
4. WHEN a user logs out THEN the System SHALL log logout event with session_id and timestamp
5. WHEN admin force logs out a user THEN the System SHALL log with admin_id, target_user_id, reason, timestamp
6. WHEN password is reset THEN the System SHALL log password_reset event with user_id, ip_address, timestamp
7. WHEN suspicious activity is detected THEN the System SHALL log security_alert with details and notify admin
8. WHEN viewing audit logs THEN admin SHALL be able to filter by user, date range, event type, IP address
9. WHEN audit logs are stored THEN the System SHALL retain logs for minimum 90 days for compliance

### Requirement 12: การจัดการ Session ขั้นสูง

**User Story:** As a user, I want to see and manage my active sessions, so that I can ensure my account security across devices.

#### Acceptance Criteria

1. WHEN a user views account settings THEN the System SHALL display list of all active sessions with device info, location (from IP), last activity time
2. WHEN displaying sessions THEN the System SHALL mark current session with "เซสชันปัจจุบัน" label
3. WHEN a user clicks "ออกจากระบบอุปกรณ์นี้" THEN the System SHALL invalidate that specific session
4. WHEN a user clicks "ออกจากระบบทุกอุปกรณ์" THEN the System SHALL invalidate all sessions except current one
5. WHEN a user clicks "ออกจากระบบทุกอุปกรณ์รวมถึงอุปกรณ์นี้" THEN the System SHALL invalidate all sessions including current and redirect to login
6. WHEN a new session is created from unknown device THEN the System SHALL optionally send email notification to user
7. WHEN displaying session info THEN the System SHALL show browser name, OS, device type, IP address, city/country (from IP geolocation)
8. WHEN a session is older than 30 days THEN the System SHALL automatically invalidate it regardless of activity
9. WHEN user changes password THEN the System SHALL invalidate all sessions except current one and require re-login on other devices
10. WHEN detecting session from suspicious location THEN the System SHALL flag for user review and optionally require additional verification

### Requirement 13: การทดสอบและ Validation

**User Story:** As a developer, I want comprehensive validation and error handling, so that the system behaves predictably and securely.

#### Acceptance Criteria

1. WHEN validating email THEN the System SHALL use regex pattern to ensure valid email format
2. WHEN validating password THEN the System SHALL check minimum length, character requirements, and reject common passwords
3. WHEN processing login THEN the System SHALL validate all required fields are present and non-empty
4. WHEN database query fails THEN the System SHALL log error, return generic error message to user, and not expose database details
5. WHEN external service (email) fails THEN the System SHALL retry up to 3 times with exponential backoff
6. WHEN token generation fails THEN the System SHALL retry with different random seed
7. WHEN session validation fails THEN the System SHALL return consistent error response and clear invalid cookies
8. WHEN input exceeds maximum length THEN the System SHALL truncate or reject with clear error message
9. WHEN special characters are in input THEN the System SHALL properly escape for database and HTML contexts
10. WHEN testing authentication THEN the System SHALL have unit tests for password hashing, token generation, session validation, and integration tests for complete login flow


### Requirement 14: โครงสร้าง Permission แบบ Hierarchical

**User Story:** As a system architect, I want a hierarchical permission structure, so that permissions can be organized logically and managed efficiently.

#### Acceptance Criteria

1. WHEN the System initializes permission modules THEN the System SHALL support hierarchical structure with parent-child relationships
2. WHEN defining permission keys THEN the System SHALL use format {module}.{sub_module}.{action} such as warehouse.inbound.view
3. WHEN a permission module has parent_module_id THEN the System SHALL display it as a child in the permission tree
4. WHEN displaying permissions THEN the System SHALL show them grouped by module with proper indentation
5. WHEN a module is inactive (is_active = false) THEN the System SHALL hide it from permission selection UI
6. WHEN ordering permission modules THEN the System SHALL use display_order field for consistent sorting
7. WHEN storing permission modules THEN the System SHALL include module_key, module_name, description, parent_module_id, display_order, is_active, icon
8. WHEN querying permissions THEN the System SHALL support filtering by module hierarchy
9. WHEN a parent module is deleted THEN the System SHALL handle child modules according to ON DELETE SET NULL constraint
10. WHEN creating new permission modules THEN the System SHALL validate that module_key is unique and follows naming convention

### Requirement 15: Permission Types แบบละเอียด (Granular)

**User Story:** As an admin, I want granular permission types beyond basic CRUD, so that I can control specific actions in the warehouse system.

#### Acceptance Criteria

1. WHEN defining role permissions THEN the System SHALL support 18 permission types: can_view, can_create, can_edit, can_delete, can_approve, can_import, can_export, can_print, can_scan, can_assign, can_complete, can_cancel, can_rollback, can_publish, can_optimize, can_change_status, can_manage_coordinates, can_reset_reservations
2. WHEN a user attempts an action THEN the System SHALL check the corresponding permission type for that action
3. WHEN granting permissions to a role THEN the System SHALL allow independent control of each permission type
4. WHEN a role has can_view = true but can_edit = false THEN the System SHALL allow viewing but prevent editing
5. WHEN checking can_import permission THEN the System SHALL verify before allowing file upload operations
6. WHEN checking can_export permission THEN the System SHALL verify before allowing data export
7. WHEN checking can_print permission THEN the System SHALL verify before generating printable documents
8. WHEN checking can_scan permission THEN the System SHALL verify before allowing barcode/QR scanning operations
9. WHEN checking can_assign permission THEN the System SHALL verify before allowing task assignment to employees
10. WHEN checking can_complete permission THEN the System SHALL verify before allowing task completion
11. WHEN checking can_cancel permission THEN the System SHALL verify before allowing cancellation operations
12. WHEN checking can_rollback permission THEN the System SHALL verify before allowing status rollback
13. WHEN checking can_publish permission THEN the System SHALL verify before publishing route plans
14. WHEN checking can_optimize permission THEN the System SHALL verify before running route optimization
15. WHEN checking can_change_status permission THEN the System SHALL verify before changing order/document status
16. WHEN checking can_manage_coordinates permission THEN the System SHALL verify before updating customer coordinates
17. WHEN checking can_reset_reservations permission THEN the System SHALL verify before resetting stock reservations
18. WHEN multiple permission types are required THEN the System SHALL check all required types using AND logic

### Requirement 16: Predefined Roles

**User Story:** As an admin, I want predefined roles with appropriate permissions, so that I can quickly assign roles to new users without manual configuration.

#### Acceptance Criteria

1. WHEN the System initializes THEN the System SHALL create 11 predefined roles: Super Admin, Warehouse Manager, Warehouse Supervisor, Warehouse Operator, Forklift Driver, Picker, Driver, Checker, Planner, Data Entry, Viewer
2. WHEN Super Admin role is assigned THEN the System SHALL grant all 260+ permissions
3. WHEN Warehouse Manager role is assigned THEN the System SHALL grant full warehouse, orders, routes, picklists, loadlists, stock, reports permissions and view/create/edit (not delete) for master data
4. WHEN Warehouse Supervisor role is assigned THEN the System SHALL grant view/create/edit permissions for warehouse, orders, picklists, stock, and view-only for reports
5. WHEN Warehouse Operator role is assigned THEN the System SHALL grant view/scan permissions for warehouse.inbound, warehouse.transfer, warehouse.balances, all mobile operations, and reports
6. WHEN Forklift Driver role is assigned THEN the System SHALL grant mobile.transfer permissions (view, scan, move, complete) and warehouse.transfer view
7. WHEN Picker role is assigned THEN the System SHALL grant mobile.pick, mobile.face_sheet, mobile.bonus_face_sheet permissions and picklists view
8. WHEN Driver role is assigned THEN the System SHALL grant mobile.loading permissions, loadlists view, and routes view
9. WHEN Checker role is assigned THEN the System SHALL grant mobile.receive permissions, warehouse.inbound view/scan, mobile.pick view, mobile.face_sheet view
10. WHEN Planner role is assigned THEN the System SHALL grant full permissions for orders, routes, picklists, face_sheets, loadlists, and reports view/export
11. WHEN Data Entry role is assigned THEN the System SHALL grant view/create/edit/import permissions for all master data and orders view/create/import
12. WHEN Viewer role is assigned THEN the System SHALL grant view-only permissions for all modules and reports export
13. WHEN predefined roles are created THEN the System SHALL mark them as system roles that cannot be deleted
14. WHEN admin views role list THEN the System SHALL clearly indicate which roles are predefined
15. WHEN admin attempts to delete a predefined role THEN the System SHALL prevent deletion and show error message

### Requirement 17: การกำหนด Role ให้ผู้ใช้

**User Story:** As an admin, I want to assign multiple roles to users, so that users can have combined permissions from different roles.

#### Acceptance Criteria

1. WHEN admin assigns a role to a user THEN the System SHALL create a record in user_role table with user_id and role_id
2. WHEN a user has multiple roles THEN the System SHALL merge permissions using OR logic (if any role grants permission, user has it)
3. WHEN admin views user details THEN the System SHALL display all assigned roles
4. WHEN admin removes a role from a user THEN the System SHALL delete the corresponding user_role record
5. WHEN a user logs in THEN the System SHALL load all assigned roles and their permissions
6. WHEN checking user permission THEN the System SHALL check across all assigned roles
7. WHEN a role's permissions are updated THEN the System SHALL apply changes to all users with that role on next login or session refresh
8. WHEN assigning roles THEN the System SHALL validate that role_id exists and is active
9. WHEN a user has no roles assigned THEN the System SHALL deny all permission checks
10. WHEN displaying role assignment UI THEN the System SHALL show available roles with descriptions and allow multi-select

### Requirement 18: Permission Checking ใน API

**User Story:** As a developer, I want automatic permission checking in API endpoints, so that unauthorized access is prevented consistently.

#### Acceptance Criteria

1. WHEN an API endpoint is called THEN the System SHALL verify user authentication before checking permissions
2. WHEN checking permissions THEN the System SHALL extract user_id from session token
3. WHEN user lacks required permission THEN the System SHALL return 403 Forbidden with message "คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้"
4. WHEN user is not authenticated THEN the System SHALL return 401 Unauthorized before checking permissions
5. WHEN API requires specific permission THEN the System SHALL use middleware to check permission before executing handler
6. WHEN API requires multiple permissions THEN the System SHALL check all required permissions using AND logic
7. WHEN permission check passes THEN the System SHALL proceed to execute API handler
8. WHEN permission check fails THEN the System SHALL log the attempt with user_id, permission_key, timestamp, ip_address
9. WHEN API endpoint has no permission requirement THEN the System SHALL only check authentication
10. WHEN implementing new API endpoints THEN the System SHALL require explicit permission declaration

### Requirement 19: Permission Checking ใน UI

**User Story:** As a user, I want the UI to show only features I have permission to use, so that I don't see disabled or inaccessible options.

#### Acceptance Criteria

1. WHEN user logs in THEN the System SHALL load user's permissions and store in frontend state
2. WHEN rendering navigation menu THEN the System SHALL hide menu items for which user lacks view permission
3. WHEN rendering action buttons THEN the System SHALL hide buttons for which user lacks corresponding permission
4. WHEN user lacks edit permission THEN the System SHALL disable edit buttons and show view-only mode
5. WHEN user lacks delete permission THEN the System SHALL hide delete buttons
6. WHEN user lacks create permission THEN the System SHALL hide "Create New" buttons
7. WHEN rendering data tables THEN the System SHALL hide action columns if user lacks any action permissions
8. WHEN user attempts to access a page without permission THEN the System SHALL redirect to 403 error page
9. WHEN checking permissions in frontend THEN the System SHALL use cached permissions from login to avoid repeated API calls
10. WHEN permissions are updated THEN the System SHALL require user to re-login to refresh cached permissions

### Requirement 20: Data-Level Permissions

**User Story:** As an admin, I want to restrict users to specific data subsets, so that users only see data relevant to their responsibilities.

#### Acceptance Criteria

1. WHEN the System supports data-level permissions THEN the System SHALL use user_data_permissions table to store restrictions
2. WHEN defining data-level permissions THEN the System SHALL support permission_type values: warehouse, customer, supplier, location
3. WHEN a user has warehouse data permission THEN the System SHALL filter queries to show only allowed warehouse_ids
4. WHEN a user has customer data permission THEN the System SHALL filter queries to show only allowed customer_ids
5. WHEN a user has supplier data permission THEN the System SHALL filter queries to show only allowed supplier_ids
6. WHEN a user has location data permission THEN the System SHALL filter queries to show only allowed location_ids
7. WHEN a user has no data-level restrictions THEN the System SHALL show all data (no filtering)
8. WHEN checking data-level permissions THEN the System SHALL apply filters automatically in database queries
9. WHEN admin assigns data-level permissions THEN the System SHALL provide UI to select allowed values
10. WHEN data-level permissions are updated THEN the System SHALL apply changes immediately on next query

### Requirement 21: Field-Level Permissions

**User Story:** As an admin, I want to control which fields users can view or edit, so that sensitive information is protected.

#### Acceptance Criteria

1. WHEN the System supports field-level permissions THEN the System SHALL use role_field_permissions table
2. WHEN defining field-level permissions THEN the System SHALL specify role_id, module_id, field_name, can_view, can_edit
3. WHEN a role has can_view = false for a field THEN the System SHALL hide that field in UI
4. WHEN a role has can_view = true but can_edit = false THEN the System SHALL show field as read-only
5. WHEN rendering forms THEN the System SHALL check field-level permissions for each field
6. WHEN rendering data tables THEN the System SHALL hide columns based on field-level permissions
7. WHEN API returns data THEN the System SHALL filter out fields user cannot view
8. WHEN user attempts to edit restricted field THEN the System SHALL reject the update and return error
9. WHEN no field-level permissions are defined THEN the System SHALL default to showing all fields
10. WHEN admin configures field-level permissions THEN the System SHALL provide UI to select fields and set view/edit flags

### Requirement 22: Permission Caching และ Performance

**User Story:** As a developer, I want efficient permission checking, so that the system remains fast even with complex permission rules.

#### Acceptance Criteria

1. WHEN user logs in THEN the System SHALL load all permissions and cache them in session
2. WHEN checking permissions THEN the System SHALL use cached permissions instead of querying database each time
3. WHEN permissions are cached THEN the System SHALL store them in memory with TTL of session duration
4. WHEN session expires THEN the System SHALL clear cached permissions
5. WHEN admin updates role permissions THEN the System SHALL invalidate cache for users with that role
6. WHEN checking permissions frequently THEN the System SHALL use in-memory cache to achieve < 1ms lookup time
7. WHEN caching permissions THEN the System SHALL include permission_key and boolean value
8. WHEN cache size grows large THEN the System SHALL use efficient data structure (Map or Set) for O(1) lookup
9. WHEN multiple API calls check same permission THEN the System SHALL reuse cached result
10. WHEN implementing caching THEN the System SHALL ensure cache consistency across serverless function instances

### Requirement 23: Permission Audit Log

**User Story:** As an admin, I want to track permission changes, so that I can audit who changed what and when.

#### Acceptance Criteria

1. WHEN permissions are granted to a role THEN the System SHALL log action = 'granted' in permission_audit_log
2. WHEN permissions are revoked from a role THEN the System SHALL log action = 'revoked' in permission_audit_log
3. WHEN permissions are modified THEN the System SHALL log action = 'modified' with old_value and new_value
4. WHEN logging permission changes THEN the System SHALL record user_id, permission_key, role_id, changed_by, changed_at, reason, ip_address
5. WHEN admin views audit log THEN the System SHALL display changes in chronological order with full details
6. WHEN filtering audit log THEN the System SHALL support filters by user, role, date range, action type
7. WHEN audit log grows large THEN the System SHALL implement pagination with 50 records per page
8. WHEN storing audit log THEN the System SHALL retain records for minimum 90 days
9. WHEN audit log is queried THEN the System SHALL use indexed fields for fast retrieval
10. WHEN critical permission changes occur THEN the System SHALL optionally send notification to super admins

### Requirement 24: Permission Groups

**User Story:** As an admin, I want to group related permissions, so that I can assign multiple permissions at once.

#### Acceptance Criteria

1. WHEN the System supports permission groups THEN the System SHALL use permission_groups table
2. WHEN defining a permission group THEN the System SHALL specify group_name, group_key, description, permission_keys array
3. WHEN creating default groups THEN the System SHALL include: Warehouse Full Access, Orders Full Access, Master Data Full Access, Mobile Operations, View Only All, Reports Access
4. WHEN a permission group is system-defined THEN the System SHALL set is_system = true to prevent deletion
5. WHEN admin assigns a permission group to a role THEN the System SHALL grant all permissions in that group
6. WHEN admin creates custom permission group THEN the System SHALL allow selecting multiple permission keys
7. WHEN displaying permission groups THEN the System SHALL show group name, description, and count of included permissions
8. WHEN a permission group is deleted THEN the System SHALL not affect existing role permissions (groups are templates only)
9. WHEN permission keys in a group use wildcards THEN the System SHALL expand wildcards (e.g., warehouse.* includes all warehouse permissions)
10. WHEN admin views permission groups THEN the System SHALL clearly indicate which are system groups vs custom groups

### Requirement 25: หน้าจัดการ Roles และ Permissions

**User Story:** As an admin, I want a user-friendly interface to manage roles and permissions, so that I can configure access control without technical knowledge.

#### Acceptance Criteria

1. WHEN admin navigates to /master-data/roles THEN the System SHALL display list of all roles with name, description, user count
2. WHEN admin clicks "Create Role" THEN the System SHALL show form with role_name, description, and permission selection
3. WHEN admin selects permissions THEN the System SHALL display hierarchical tree with checkboxes for each permission type
4. WHEN admin checks a parent module THEN the System SHALL optionally check all child permissions
5. WHEN admin saves role THEN the System SHALL validate role_name is unique and at least one permission is selected
6. WHEN admin edits role THEN the System SHALL load current permissions and allow modifications
7. WHEN admin attempts to delete role THEN the System SHALL check if role is assigned to any users and warn before deletion
8. WHEN admin views role details THEN the System SHALL show list of users with that role and summary of granted permissions
9. WHEN displaying permission tree THEN the System SHALL group by module and show permission types as columns (view, create, edit, delete, etc.)
10. WHEN admin assigns role to user THEN the System SHALL provide search/select interface for users and multi-select for roles

### Requirement 26: การทดสอบ Permission System

**User Story:** As a developer, I want comprehensive tests for the permission system, so that access control works correctly and securely.

#### Acceptance Criteria

1. WHEN testing permission checking THEN the System SHALL have unit tests for checkPermission function with various scenarios
2. WHEN testing role assignment THEN the System SHALL verify that multiple roles merge permissions correctly using OR logic
3. WHEN testing API middleware THEN the System SHALL verify that unauthorized requests return 403 Forbidden
4. WHEN testing UI permission guards THEN the System SHALL verify that restricted elements are hidden
5. WHEN testing data-level permissions THEN the System SHALL verify that queries are filtered correctly
6. WHEN testing field-level permissions THEN the System SHALL verify that restricted fields are hidden or read-only
7. WHEN testing permission caching THEN the System SHALL verify that cache improves performance and remains consistent
8. WHEN testing audit log THEN the System SHALL verify that all permission changes are logged correctly
9. WHEN testing predefined roles THEN the System SHALL verify that each role has correct permissions
10. WHEN testing permission updates THEN the System SHALL verify that changes apply to users on next login

### Requirement 27: การ Migrate ข้อมูล Permission

**User Story:** As a developer, I want smooth migration of existing permission data, so that current users retain their access after system upgrade.

#### Acceptance Criteria

1. WHEN running migration THEN the System SHALL backup existing role_permission data before making changes
2. WHEN adding new permission columns THEN the System SHALL set default values to false for existing records
3. WHEN creating new permission modules THEN the System SHALL insert 260+ permission records with correct hierarchy
4. WHEN creating predefined roles THEN the System SHALL insert 11 roles with appropriate permissions
5. WHEN existing users have roles THEN the System SHALL preserve user_role assignments
6. WHEN migration completes THEN the System SHALL verify data integrity with validation queries
7. WHEN migration fails THEN the System SHALL rollback changes and restore backup
8. WHEN running migration in production THEN the System SHALL minimize downtime (< 5 minutes)
9. WHEN migration adds indexes THEN the System SHALL create them concurrently to avoid locking tables
10. WHEN migration is complete THEN the System SHALL log summary of changes (tables created, records inserted, etc.)
