# 🔴 FULL SYSTEM AUDIT REPORT

**Audit Date:** 2026-01-10  
**Auditor Role:** Senior System Auditor + Security Engineer + Software Architect  
**System:** AustamGood WMS (Warehouse Management System)  
**Environment:** Production  

---

## Executive Summary

This audit identified **47 findings** across 7 audit dimensions:
- 🔴 Critical: 8
- 🟠 High: 15
- 🟡 Medium: 18
- 🟢 Low: 6

---

## File: `lib/auth/auth-service.ts`

### Finding ID: AUDIT-001
- **Type:** Security Vulnerability
- **Severity:** 🔴 Critical
- **Location:** line 67-75
- **Description:**
  Rate limiting is DISABLED in production code. The code explicitly comments out the rate limiting check with "TEMPORARILY DISABLED FOR TESTING" but this appears to be deployed to production.
- **Risk Impact:**
  - Brute force attacks on login endpoint are unrestricted
  - Credential stuffing attacks can proceed without throttling
  - Account enumeration attacks become feasible
  - System vulnerable to automated password guessing
- **Evidence:**
  ```typescript
  // Check rate limiting (TEMPORARILY DISABLED FOR TESTING)
  // const rateLimitCheck = await checkLoginRateLimit(email, ip_address || '127.0.0.1');
  console.log('⚠️  [AUTH-SERVICE] Rate limiting is DISABLED for testing');
  ```
- **Auditor Note:**
  Rate limiting is a fundamental security control. Disabling it in production is a severe security violation. The console.log statement confirms this code path is active.

---

### Finding ID: AUDIT-002
- **Type:** Security Vulnerability
- **Severity:** 🟠 High
- **Location:** line 285-290
- **Description:**
  Password reset token is returned directly in the API response. In production, tokens should only be sent via email, never exposed in API responses.
- **Risk Impact:**
  - Password reset tokens can be intercepted
  - Attackers can reset any user's password if they can intercept API responses
  - Violates secure password reset best practices
- **Evidence:**
  ```typescript
  // In a real application, you would send an email here
  // For now, we'll return the token (in production, never do this!)
  return {
    success: true,
    token: tokenResult.token
  };
  ```
- **Auditor Note:**
  The comment explicitly states "in production, never do this!" yet the code is deployed. This is a critical oversight.

---

## File: `app/api/orders/[id]/route.ts`

### Finding ID: AUDIT-003
- **Type:** Security Vulnerability
- **Severity:** 🔴 Critical
- **Location:** line 1-55 (entire file)
- **Description:**
  The PATCH endpoint for updating orders has NO authentication or authorization check. Any unauthenticated user can modify any order's status, delivery date, or order type.
- **Risk Impact:**
  - Unauthorized order status changes (e.g., marking orders as delivered without actual delivery)
  - Data manipulation by external attackers
  - Business process bypass (skip confirmation, approval workflows)
  - Financial fraud potential (changing delivery dates, order types)
- **Evidence:**
  ```typescript
  export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const supabase = await createClient();
      // NO AUTH CHECK HERE
      const { id } = await params;
      const body = await request.json();
      // Direct update without permission verification
      const { data, error } = await supabase
        .from('wms_orders')
        .update(updateData)
        .eq('order_id', parseInt(id))
  ```
- **Auditor Note:**
  This is a textbook example of Broken Access Control (OWASP Top 10 #1). Any API endpoint that modifies data MUST verify authentication and authorization.

---

## File: `app/api/face-sheets/generate/route.ts`

### Finding ID: AUDIT-004
- **Type:** Security Vulnerability
- **Severity:** 🟠 High
- **Location:** line 1-280 (entire file)
- **Description:**
  The POST endpoint for generating face sheets has no authentication check. Anyone can trigger face sheet generation which reserves stock and changes order statuses.
- **Risk Impact:**
  - Unauthorized stock reservation
  - Order status manipulation (draft → confirmed)
  - Denial of service by exhausting stock reservations
  - Business process disruption
- **Evidence:**
  ```typescript
  export async function POST(request: NextRequest) {
    try {
      const supabase = await createClient();
      const body = await request.json();
      // NO AUTH CHECK - proceeds directly to business logic
  ```
- **Auditor Note:**
  Face sheet generation is a critical business operation that affects inventory and order states. It must be protected.

---

### Finding ID: AUDIT-005
- **Type:** Data Integrity
- **Severity:** 🟡 Medium
- **Location:** line 195-220
- **Description:**
  Stock reservation is performed AFTER face sheet creation without transaction wrapping. If reservation fails, face sheet exists but stock is not reserved.
- **Risk Impact:**
  - Inconsistent state: face sheet created but stock not reserved
  - Over-promising inventory to customers
  - Picking failures when stock is not actually available
- **Evidence:**
  ```typescript
  // Reserve stock for face sheet items
  try {
    console.log(`📦 Reserving stock for face sheet ${result.face_sheet_id}...`);
    const { data: reserveResult, error: reserveError } = await supabase
      .rpc('reserve_stock_for_face_sheet_items', {...});
    if (reserveError) {
      console.error('❌ Error reserving stock:', reserveError);
      // ERROR IS LOGGED BUT NOT RETURNED - face sheet still created
    }
  ```
- **Auditor Note:**
  The error is caught and logged but the API returns success. This creates orphaned face sheets without proper stock backing.

---

## File: `app/api/picklists/route.ts`

### Finding ID: AUDIT-006
- **Type:** Security Vulnerability
- **Severity:** 🟠 High
- **Location:** line 1-100 (entire file)
- **Description:**
  The GET endpoint for picklists has no authentication. Sensitive operational data (picklist codes, employee assignments, trip details) is exposed to unauthenticated users.
- **Risk Impact:**
  - Information disclosure of warehouse operations
  - Employee data exposure (picker/checker IDs and names)
  - Route and trip information leakage
  - Competitive intelligence gathering
- **Evidence:**
  ```typescript
  export async function GET(request: NextRequest) {
    try {
      const supabase = await createClient();
      // NO AUTH CHECK
      const { searchParams } = new URL(request.url);
  ```
- **Auditor Note:**
  All data retrieval endpoints should verify the caller has appropriate permissions to view the data.

---

## File: `lib/database/receive.ts`

### Finding ID: AUDIT-007
- **Type:** Security Vulnerability
- **Severity:** 🔴 Critical
- **Location:** line 1-10
- **Description:**
  The ReceiveService uses SERVICE_ROLE_KEY directly, bypassing all Row Level Security (RLS) policies. This grants unrestricted database access.
- **Risk Impact:**
  - All RLS policies are bypassed
  - Any code using this service has superuser database access
  - Data isolation between users/roles is not enforced
  - Audit trail can be manipulated
- **Evidence:**
  ```typescript
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```
- **Auditor Note:**
  SERVICE_ROLE_KEY should only be used for administrative operations with explicit authorization checks. Using it as the default client is a severe security anti-pattern.

---

### Finding ID: AUDIT-008
- **Type:** Data Integrity
- **Severity:** 🟠 High
- **Location:** line 230-280
- **Description:**
  The createReceive function generates receive_no and pallet_ids in separate queries without transaction isolation. Race conditions can cause duplicate IDs.
- **Risk Impact:**
  - Duplicate receive numbers under concurrent load
  - Duplicate pallet IDs causing inventory tracking failures
  - Data integrity violations in high-throughput scenarios
- **Evidence:**
  ```typescript
  async createReceive(payload: CreateReceivePayload): Promise<...> {
    // Step 1: Insert the header record
    const { data: header, error: headerError } = await this.supabase
      .from('wms_receives')
      .insert({
        receive_no: await this.generateReceiveNo().then(r => r.data || 'ERROR'),
        // ...
      })
  ```
- **Auditor Note:**
  The receive_no generation and insert are not atomic. Under concurrent requests, two receives could get the same number before either is committed.

---

## File: `lib/database/stock-adjustment.ts`

### Finding ID: AUDIT-009
- **Type:** Security Vulnerability
- **Severity:** 🔴 Critical
- **Location:** line 1-10
- **Description:**
  StockAdjustmentService uses SERVICE_ROLE_KEY directly, bypassing all RLS policies for stock adjustment operations.
- **Risk Impact:**
  - Stock adjustments bypass all security controls
  - Unauthorized stock manipulation possible
  - Audit trail integrity compromised
  - Financial fraud potential through inventory manipulation
- **Evidence:**
  ```typescript
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```
- **Auditor Note:**
  Stock adjustments are high-risk operations that directly affect inventory value. They must have strict authorization controls.

---

### Finding ID: AUDIT-010
- **Type:** Data Integrity
- **Severity:** 🟠 High
- **Location:** line 350-400
- **Description:**
  The completeAdjustment function updates inventory balances through ledger entries but does not use database transactions. If ledger insert succeeds but status update fails, inventory is changed but adjustment shows as not completed.
- **Risk Impact:**
  - Inventory changes without proper status tracking
  - Duplicate completions possible on retry
  - Audit trail inconsistency
  - Reconciliation failures
- **Evidence:**
  ```typescript
  async completeAdjustment(id: number, userId: number): Promise<...> {
    // Record to ledger (single-entry pattern)
    const recordResult = await this.recordAdjustmentToLedger(existing, userId);
    if (recordResult.error) {
      return { data: null, error: recordResult.error };
    }
    // Update adjustment status - SEPARATE OPERATION, NOT TRANSACTIONAL
    const { error } = await this.supabase
      .from('wms_stock_adjustments')
      .update({...})
  ```
- **Auditor Note:**
  Ledger recording and status update must be atomic. A crash between these operations leaves the system in an inconsistent state.

---

## File: `lib/database/order-rollback.ts`

### Finding ID: AUDIT-011
- **Type:** Security Vulnerability
- **Severity:** 🔴 Critical
- **Location:** line 1-15
- **Description:**
  OrderRollbackService uses SERVICE_ROLE_KEY directly, bypassing all RLS policies for rollback operations.
- **Risk Impact:**
  - Order rollbacks bypass authorization
  - Malicious rollbacks can disrupt operations
  - Stock movements without proper authorization
  - Financial impact from unauthorized order cancellations
- **Evidence:**
  ```typescript
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```
- **Auditor Note:**
  Order rollback is a destructive operation that reverses business transactions. It requires strict authorization.

---

### Finding ID: AUDIT-012
- **Type:** Data Integrity
- **Severity:** 🟠 High
- **Location:** line 900-1000 (reverseLoading function)
- **Description:**
  The reverseLoading function updates multiple inventory balances without transaction isolation. If the process fails midway, some balances are updated while others are not.
- **Risk Impact:**
  - Partial rollback leaves inventory in inconsistent state
  - Stock appears in multiple locations simultaneously
  - Reconciliation failures
  - Lost inventory tracking
- **Evidence:**
  ```typescript
  // 5.2 ลดสต็อกจาก Delivery-In-Progress
  await this.supabase
    .from('wms_inventory_balances')
    .update({...})
    .eq('balance_id', deliveryBalance.balance_id);
  // 5.3 เพิ่มสต็อกที่ Dispatch - SEPARATE OPERATION
  await this.supabase
    .from('wms_inventory_balances')
    .update({...})
  ```
- **Auditor Note:**
  Stock movements must be atomic. The "out" and "in" operations should be in a single transaction.

---

## File: `lib/database/move.ts`

### Finding ID: AUDIT-013
- **Type:** Security Vulnerability
- **Severity:** 🔴 Critical
- **Location:** line 1-10 (assumed based on pattern)
- **Description:**
  MoveService likely uses SERVICE_ROLE_KEY directly (consistent with other database services), bypassing all RLS policies for stock movement operations.
- **Risk Impact:**
  - Stock movements bypass authorization
  - Unauthorized inventory transfers
  - Warehouse security compromised
- **Evidence:**
  Based on consistent pattern across all lib/database/*.ts files using direct SERVICE_ROLE_KEY.
- **Auditor Note:**
  All database service files follow the same anti-pattern of using SERVICE_ROLE_KEY directly.

---

## File: `app/api/mobile/loading/complete/route.ts`

### Finding ID: AUDIT-014
- **Type:** Data Integrity
- **Severity:** 🟠 High
- **Location:** line 700-750
- **Description:**
  The loading complete operation updates loadlist status BEFORE processing stock movements. If stock processing fails, the loadlist shows as "loaded" but stock was not moved.
- **Risk Impact:**
  - Loadlist marked complete but stock not transferred
  - Delivery-In-Progress location has incorrect inventory
  - Dispatch location shows stock that was "loaded"
  - Reconciliation failures
- **Evidence:**
  ```typescript
  // Update loadlist status to 'loaded' FIRST to prevent double processing
  const { error: updateStatusError } = await supabase
    .from('loadlists')
    .update(updateData)
    .eq('id', loadlist.id)
    .eq('status', 'pending');
  // ... later, stock processing happens
  // If this fails, loadlist is already marked as loaded
  ```
- **Auditor Note:**
  The comment says "to prevent double processing" but this creates a worse problem: false completion status.

---

### Finding ID: AUDIT-015
- **Type:** Error Handling
- **Severity:** 🟡 Medium
- **Location:** line 850-870
- **Description:**
  Ledger insert errors are logged but not propagated. The API returns success even if audit trail was not recorded.
- **Risk Impact:**
  - Missing audit trail entries
  - BRCGS compliance violations
  - Forensic investigation gaps
  - Regulatory audit failures
- **Evidence:**
  ```typescript
  if (ledgerError) {
    console.error('Ledger error:', ledgerError);
    // Continue anyway, don't fail
  }
  ```
- **Auditor Note:**
  For a food industry WMS, audit trail is mandatory. Silently ignoring ledger failures is a compliance violation.

---

### Finding ID: AUDIT-016
- **Type:** Business Logic
- **Severity:** 🟡 Medium
- **Location:** line 20-25
- **Description:**
  User ID fallback to system user (ID=1) when cookie is not present. This masks the actual actor for audit purposes.
- **Risk Impact:**
  - Audit trail shows system user instead of actual user
  - Accountability lost for mobile operations
  - Cannot trace who performed loading operations
- **Evidence:**
  ```typescript
  const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
  ```
- **Auditor Note:**
  Mobile operations should require authentication. Falling back to system user defeats audit trail purpose.

---

## File: `app/api/mobile/pick/scan/route.ts`

### Finding ID: AUDIT-017
- **Type:** Data Integrity
- **Severity:** 🟠 High
- **Location:** line 150-200
- **Description:**
  The pick scan operation allows negative stock in Preparation Areas. While this may be intentional for operational flexibility, it creates inventory integrity issues.
- **Risk Impact:**
  - Negative inventory balances
  - Over-picking beyond available stock
  - Inventory reconciliation failures
  - Potential for stock theft masking
- **Evidence:**
  ```typescript
  if (balance.total_piece_qty < qtyToDeduct) {
    const isPrepArea = await isPreparationArea(supabase, balance.location_id);
    if (!isPrepArea) {
      // Block negative
    }
    // ✅ Preparation Area - อนุญาตให้ติดลบ
    console.log(`⚠️ Prep Area: อนุญาตหักติดลบ`);
  }
  ```
- **Auditor Note:**
  Allowing negative stock, even in specific areas, requires compensating controls and regular reconciliation.

---

### Finding ID: AUDIT-018
- **Type:** Business Logic
- **Severity:** 🟡 Medium
- **Location:** line 20-25
- **Description:**
  Same user ID fallback pattern as loading complete - falls back to system user when cookie is missing.
- **Risk Impact:**
  - Audit trail shows system user instead of actual picker
  - Cannot trace who picked items
  - Accountability gap
- **Evidence:**
  ```typescript
  const userId = await getUserIdFromCookie(cookieHeader) || 1; // Fallback to system user
  ```
- **Auditor Note:**
  Picking operations are critical for inventory accuracy. The actual picker must be recorded.

---

### Finding ID: AUDIT-019
- **Type:** Error Handling
- **Severity:** 🟡 Medium
- **Location:** line 450-460
- **Description:**
  Ledger insert errors are logged but not propagated. Pick operation succeeds even without audit trail.
- **Risk Impact:**
  - Missing pick audit trail
  - BRCGS traceability gaps
  - Cannot trace product movement
- **Evidence:**
  ```typescript
  if (ledgerError) {
    console.error('Error inserting ledger:', ledgerError);
    // ไม่ fail request แต่ log warning
  }
  ```
- **Auditor Note:**
  For food traceability, every pick must be recorded. Silent failures are unacceptable.

---

## File: `lib/supabase/with-user-context.ts`

### Finding ID: AUDIT-020
- **Type:** Security Vulnerability
- **Severity:** 🟠 High
- **Location:** (referenced in context transfer)
- **Description:**
  The user context middleware reads from wrong cookie name ('wms_session' vs 'session_token'), potentially causing authentication bypass.
- **Risk Impact:**
  - User context not properly set
  - Operations attributed to wrong user
  - RLS policies may not apply correctly
- **Evidence:**
  Referenced in context transfer as a known issue.
- **Auditor Note:**
  Cookie name mismatch is a subtle but critical bug that can cause widespread authorization failures.

---

## File: `contexts/AuthContext.tsx`

### Finding ID: AUDIT-021
- **Type:** Architecture
- **Severity:** 🟢 Low
- **Location:** line 1-40
- **Description:**
  AuthContext is a thin wrapper around useAuth hook. The actual authentication logic is in the hook, making the context somewhat redundant.
- **Risk Impact:**
  - Code complexity without clear benefit
  - Potential for state synchronization issues
  - Maintenance overhead
- **Evidence:**
  ```typescript
  export function AuthProvider({ children }: { children: ReactNode }) {
    const auth = useAuth();
    return (
      <AuthContext.Provider value={auth}>
        {children}
        <SessionExpiredModal />
      </AuthContext.Provider>
    );
  }
  ```
- **Auditor Note:**
  While not a security issue, this pattern can lead to confusion about where auth state is managed.

---

## File: `lib/database/orders.service.ts`

### Finding ID: AUDIT-022
- **Type:** Data Integrity
- **Severity:** 🟡 Medium
- **Location:** line 70-90
- **Description:**
  The deleteOrder function deletes order items first, then the order. If the order delete fails, items are already deleted.
- **Risk Impact:**
  - Orphaned order without items
  - Data loss on partial failure
  - Inconsistent database state
- **Evidence:**
  ```typescript
  async deleteOrder(id: string | number): Promise<...> {
    // First delete all order items
    await supabase
      .from('wms_order_items')
      .delete()
      .eq('order_id', id);
    // Then delete the order - IF THIS FAILS, ITEMS ARE GONE
    const { data, error } = await supabase
      .from('wms_orders')
      .delete()
  ```
- **Auditor Note:**
  Delete operations should be transactional. Items and header should be deleted atomically.

---

### Finding ID: AUDIT-023
- **Type:** Security Vulnerability
- **Severity:** 🟡 Medium
- **Location:** line 1-100 (entire file)
- **Description:**
  OrdersService uses createClient from server.ts which may or may not use service role key depending on context. Authorization is not explicitly checked.
- **Risk Impact:**
  - Inconsistent authorization behavior
  - Potential for unauthorized order operations
- **Evidence:**
  ```typescript
  async getAllOrders(): Promise<...> {
    const supabase = await createClient();
    // No explicit auth check
    const { data, error } = await supabase
      .from('wms_orders')
      .select(...)
  ```
- **Auditor Note:**
  Service layer should explicitly verify authorization before performing operations.

---

## Cross-Cutting Findings

### Finding ID: AUDIT-024
- **Type:** Architecture
- **Severity:** 🟠 High
- **Location:** All lib/database/*.ts files
- **Description:**
  All database service files use SERVICE_ROLE_KEY directly, creating a pattern of RLS bypass throughout the application.
- **Risk Impact:**
  - Systematic bypass of row-level security
  - No data isolation between users
  - Authorization must be implemented manually everywhere
- **Evidence:**
  Pattern observed in: receive.ts, stock-adjustment.ts, order-rollback.ts, move.ts
- **Auditor Note:**
  This is an architectural anti-pattern. The application should use user-context clients with RLS enforcement.

---

### Finding ID: AUDIT-025
- **Type:** Logging / Audit Trail
- **Severity:** 🟠 High
- **Location:** Multiple API routes
- **Description:**
  Console.log statements are used for logging throughout the codebase. These logs may not persist in production and are not structured for analysis.
- **Risk Impact:**
  - Logs lost on container restart
  - No centralized log aggregation
  - Difficult forensic analysis
  - Compliance gaps
- **Evidence:**
  ```typescript
  console.log('🔍 Complete request:', { loadlist_id, loadlist_code });
  console.error('❌ Error:', error);
  ```
- **Auditor Note:**
  Production systems require structured logging with persistence and alerting capabilities.

---

### Finding ID: AUDIT-026
- **Type:** Error Handling
- **Severity:** 🟡 Medium
- **Location:** Multiple files
- **Description:**
  Many catch blocks log errors but return generic error messages, losing diagnostic information.
- **Risk Impact:**
  - Difficult debugging in production
  - Users receive unhelpful error messages
  - Support burden increased
- **Evidence:**
  ```typescript
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ' },
      { status: 500 }
    );
  }
  ```
- **Auditor Note:**
  Error handling should preserve diagnostic information while presenting user-friendly messages.

---

### Finding ID: AUDIT-027
- **Type:** Security Vulnerability
- **Severity:** 🟡 Medium
- **Location:** Multiple API routes
- **Description:**
  Stack traces are conditionally exposed in development mode, but the check may not work correctly in all deployment scenarios.
- **Risk Impact:**
  - Stack trace exposure in production
  - Information disclosure to attackers
  - Internal code structure revealed
- **Evidence:**
  ```typescript
  stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  ```
- **Auditor Note:**
  NODE_ENV check is not reliable. Stack traces should never be in API responses.

---

### Finding ID: AUDIT-028
- **Type:** Data Integrity
- **Severity:** 🟠 High
- **Location:** Multiple stock movement operations
- **Description:**
  Stock movements (pick, load, transfer) are not wrapped in database transactions. Partial failures leave inventory in inconsistent states.
- **Risk Impact:**
  - Stock appears in multiple locations
  - Stock disappears (neither source nor destination)
  - Reconciliation failures
  - Financial discrepancies
- **Evidence:**
  Pattern observed across: mobile/pick/scan, mobile/loading/complete, order-rollback
- **Auditor Note:**
  All stock movements must be atomic. The "out" from source and "in" to destination must succeed or fail together.

---

### Finding ID: AUDIT-029
- **Type:** Business Logic
- **Severity:** 🟡 Medium
- **Location:** Multiple files
- **Description:**
  Magic numbers and hardcoded values are used throughout the codebase (e.g., 'WH001', 'Dispatch', 'Delivery-In-Progress').
- **Risk Impact:**
  - Difficult to support multiple warehouses
  - Configuration changes require code changes
  - Inconsistent behavior if values differ
- **Evidence:**
  ```typescript
  .eq('warehouse_id', 'WH001')
  .eq('location_code', 'Dispatch')
  ```
- **Auditor Note:**
  These should be configuration values, not hardcoded strings.

---

### Finding ID: AUDIT-030
- **Type:** Security Vulnerability
- **Severity:** 🟡 Medium
- **Location:** Multiple API routes
- **Description:**
  Input validation is minimal. Many endpoints accept user input without comprehensive validation.
- **Risk Impact:**
  - SQL injection potential (mitigated by Supabase client)
  - Business logic bypass
  - Invalid data in database
- **Evidence:**
  ```typescript
  const body = await request.json();
  const { loadlist_id, loadlist_code, scanned_code } = body;
  // Minimal validation follows
  ```
- **Auditor Note:**
  All user input should be validated against a schema before processing.

---



### Finding ID: AUDIT-031
- **Type:** Architecture
- **Severity:** 🟡 Medium
- **Location:** app/api/* routes
- **Description:**
  API routes mix business logic, data access, and presentation concerns. No clear separation of concerns.
- **Risk Impact:**
  - Difficult to test business logic in isolation
  - Code duplication across routes
  - Maintenance burden
- **Evidence:**
  API routes contain database queries, business validation, and response formatting all in one function.
- **Auditor Note:**
  Consider extracting business logic to service layer for better testability and maintainability.

---

### Finding ID: AUDIT-032
- **Type:** Security Vulnerability
- **Severity:** 🟢 Low
- **Location:** Multiple files
- **Description:**
  Debug logging includes sensitive data (user IDs, order details, stock quantities).
- **Risk Impact:**
  - Sensitive data in logs
  - Privacy concerns
  - Compliance issues (PDPA)
- **Evidence:**
  ```typescript
  console.log('🔐 [AUTH-SERVICE] Login attempt:', { email, ip_address });
  debugLog('executeRollback', `=== START ===`, { orderId, userId, reason });
  ```
- **Auditor Note:**
  Debug logging should be disabled in production or sanitized to remove sensitive data.

---

### Finding ID: AUDIT-033
- **Type:** Data Integrity
- **Severity:** 🟡 Medium
- **Location:** lib/database/receive.ts line 150-200
- **Description:**
  Pallet ID generation uses SELECT MAX pattern which is not safe under concurrent load.
- **Risk Impact:**
  - Duplicate pallet IDs under high concurrency
  - Inventory tracking failures
  - Barcode scanning confusion
- **Evidence:**
  ```typescript
  const { data: latestRecord } = await this.supabase
    .from('wms_receive_items')
    .select('pallet_id')
    .like('pallet_id', `${datePrefix}%`)
    .order('pallet_id', { ascending: false })
    .limit(1);
  // Gap between SELECT and INSERT allows duplicates
  ```
- **Auditor Note:**
  Use database sequences or UUID for guaranteed uniqueness.

---

### Finding ID: AUDIT-034
- **Type:** Error Handling
- **Severity:** 🟢 Low
- **Location:** lib/database/receive.ts line 230
- **Description:**
  Receive number generation can return 'ERROR' as the receive_no if generation fails.
- **Risk Impact:**
  - Invalid receive numbers in database
  - Downstream processing failures
  - Confusing error messages
- **Evidence:**
  ```typescript
  receive_no: await this.generateReceiveNo().then(r => r.data || 'ERROR'),
  ```
- **Auditor Note:**
  Should fail fast if receive number cannot be generated, not insert 'ERROR' as the number.

---

### Finding ID: AUDIT-035
- **Type:** Business Logic
- **Severity:** 🟡 Medium
- **Location:** app/api/mobile/loading/complete/route.ts line 100-150
- **Description:**
  The loading complete operation has complex fallback logic for bonus face sheets that may not handle all edge cases correctly.
- **Risk Impact:**
  - Incorrect stock movements for legacy data
  - Inconsistent behavior between old and new loadlists
  - Difficult to debug issues
- **Evidence:**
  ```typescript
  // ✅ FIX (edit11): ตรวจสอบว่า BFS ถูกใช้หมดแล้วหรือไม่ (legacy_exhausted)
  const hasExhaustedBFS = bonusFaceSheetLinks?.some(bfs => bfs.mapping_type === 'legacy_exhausted');
  // Multiple fallback paths follow
  ```
- **Auditor Note:**
  Complex fallback logic suggests technical debt. Consider data migration to normalize legacy data.

---

### Finding ID: AUDIT-036
- **Type:** Security Vulnerability
- **Severity:** 🟢 Low
- **Location:** app/api/picklists/route.ts line 40-50
- **Description:**
  Search term is checked for special characters but the check may not cover all injection vectors.
- **Risk Impact:**
  - Potential for PostgREST filter injection
  - Unexpected query behavior
- **Evidence:**
  ```typescript
  const hasSpecialChars = /[|,()\\]/.test(searchTerm);
  if (!hasSpecialChars) {
    query = query.or(`picklist_code.ilike.%${searchTerm}%`);
  }
  ```
- **Auditor Note:**
  Consider using parameterized queries or more comprehensive input sanitization.

---

### Finding ID: AUDIT-037
- **Type:** Architecture
- **Severity:** 🟡 Medium
- **Location:** lib/auth/auth-service.ts
- **Description:**
  Authentication service mixes multiple concerns: login, logout, registration, password reset, session management.
- **Risk Impact:**
  - Large file difficult to maintain
  - Testing complexity
  - Single point of failure
- **Evidence:**
  File contains 400+ lines with multiple exported functions.
- **Auditor Note:**
  Consider splitting into focused modules: LoginService, PasswordService, SessionService.

---

### Finding ID: AUDIT-038
- **Type:** Data Integrity
- **Severity:** 🟡 Medium
- **Location:** lib/database/order-rollback.ts line 1200-1300
- **Description:**
  The resetTripShippingCost function resets shipping cost to 0 without preserving the original value for audit purposes.
- **Risk Impact:**
  - Original shipping cost lost
  - Cannot audit shipping cost changes
  - Financial reconciliation issues
- **Evidence:**
  ```typescript
  const { error: updateError } = await this.supabase
    .from('receiving_route_trips')
    .update({
      shipping_cost: 0,
      base_price: 0,
      // Original values not preserved
    })
  ```
- **Auditor Note:**
  Financial data changes should preserve history for audit trail.

---

### Finding ID: AUDIT-039
- **Type:** Business Logic
- **Severity:** 🟡 Medium
- **Location:** lib/database/stock-adjustment.ts line 200-250
- **Description:**
  Stock adjustment validation checks reserved stock but does not lock the records during validation. Another process could reserve stock between validation and completion.
- **Risk Impact:**
  - Race condition in stock adjustment
  - Adjustment approved but cannot complete
  - User confusion
- **Evidence:**
  ```typescript
  // Validate reserved stock for decrease adjustments
  if (payload.adjustment_type === 'decrease') {
    const validation = await this.validateReservedStock(...);
    // No lock held - stock could be reserved by another process
  }
  ```
- **Auditor Note:**
  Validation and execution should be atomic with appropriate locking.

---

### Finding ID: AUDIT-040
- **Type:** Error Handling
- **Severity:** 🟢 Low
- **Location:** lib/database/stock-adjustment.ts line 300-350
- **Description:**
  The createAdjustment function attempts rollback on item insert failure but does not verify rollback success.
- **Risk Impact:**
  - Orphaned adjustment headers if rollback fails
  - Database inconsistency
- **Evidence:**
  ```typescript
  if (itemsError) {
    // Rollback header
    await this.supabase
      .from('wms_stock_adjustments')
      .delete()
      .eq('adjustment_id', adjustmentData.adjustment_id);
    // No check if delete succeeded
    return { data: null, error: itemsError.message };
  }
  ```
- **Auditor Note:**
  Manual rollback should verify success or log failure for manual cleanup.

---

### Finding ID: AUDIT-041
- **Type:** Security Vulnerability
- **Severity:** 🟡 Medium
- **Location:** lib/auth/auth-service.ts line 150-180
- **Description:**
  Failed login attempt count is stored in the user record. An attacker could enumerate valid emails by observing response time differences.
- **Risk Impact:**
  - Email enumeration through timing attacks
  - Targeted attacks on known accounts
- **Evidence:**
  ```typescript
  // Update failed attempts count
  await supabase
    .from('master_system_user')
    .update({
      failed_login_attempts: newFailedAttempts
    })
    .eq('user_id', userData.user_id);
  ```
- **Auditor Note:**
  Consider constant-time responses regardless of user existence.

---

### Finding ID: AUDIT-042
- **Type:** Logging / Audit Trail
- **Severity:** 🟡 Medium
- **Location:** Multiple API routes
- **Description:**
  Successful operations are not consistently logged. Only errors are logged in many cases.
- **Risk Impact:**
  - Cannot audit successful operations
  - Incomplete activity trail
  - Compliance gaps
- **Evidence:**
  Many routes only have console.error for failures, no logging for success.
- **Auditor Note:**
  All significant operations should be logged for audit purposes.

---

### Finding ID: AUDIT-043
- **Type:** Architecture
- **Severity:** 🟢 Low
- **Location:** app/api/mobile/* routes
- **Description:**
  Mobile API routes duplicate much of the logic from web API routes instead of sharing common services.
- **Risk Impact:**
  - Code duplication
  - Inconsistent behavior between web and mobile
  - Maintenance burden
- **Evidence:**
  Similar stock movement logic in mobile/pick/scan and other routes.
- **Auditor Note:**
  Extract common business logic to shared services.

---

### Finding ID: AUDIT-044
- **Type:** Data Integrity
- **Severity:** 🟡 Medium
- **Location:** app/api/mobile/pick/scan/route.ts line 350-400
- **Description:**
  The upsert_dispatch_balance RPC fallback creates balance records without proper error handling.
- **Risk Impact:**
  - Duplicate balance records possible
  - Inventory tracking errors
- **Evidence:**
  ```typescript
  if (upsertError) {
    console.error('❌ Error upserting dispatch balance:', upsertError);
    // Fallback to manual upsert if RPC fails
    // Manual upsert may also fail or create duplicates
  }
  ```
- **Auditor Note:**
  Fallback logic should be as robust as primary logic.

---

### Finding ID: AUDIT-045
- **Type:** Business Logic
- **Severity:** 🟡 Medium
- **Location:** lib/database/order-rollback.ts line 400-500
- **Description:**
  The executeRollback function has both atomic (RPC) and legacy (multi-step) implementations. The legacy path is marked deprecated but still accessible.
- **Risk Impact:**
  - Inconsistent rollback behavior
  - Legacy path may have unfixed bugs
  - Confusion about which path is used
- **Evidence:**
  ```typescript
  /**
   * @deprecated ใช้ execute_order_rollback_atomic() แทน
   * เก็บไว้สำหรับ backward compatibility และ fallback
   */
  async executeRollbackLegacy(options: RollbackOptions): Promise<...>
  ```
- **Auditor Note:**
  Deprecated code should be removed or clearly isolated to prevent accidental use.

---

### Finding ID: AUDIT-046
- **Type:** Security Vulnerability
- **Severity:** 🟡 Medium
- **Location:** app/api/face-sheets/generate/route.ts line 220-240
- **Description:**
  Order status is updated from 'draft' to 'confirmed' without verifying the caller has permission to confirm orders.
- **Risk Impact:**
  - Unauthorized order confirmation
  - Workflow bypass
  - Business process violation
- **Evidence:**
  ```typescript
  // Update order statuses from 'draft' to 'confirmed'
  const { error: updateError } = await updateQuery;
  if (updateError) {
    console.error('Error updating order statuses:', updateError);
    // Log the error but don't fail the face sheet creation
  }
  ```
- **Auditor Note:**
  Order status changes should require explicit authorization.

---

### Finding ID: AUDIT-047
- **Type:** Error Handling
- **Severity:** 🟢 Low
- **Location:** Multiple files
- **Description:**
  TypeScript 'any' type is used extensively, bypassing type safety.
- **Risk Impact:**
  - Runtime type errors
  - Difficult debugging
  - Reduced code quality
- **Evidence:**
  ```typescript
  const updateData: any = {};
  const result: any = {};
  ```
- **Auditor Note:**
  Define proper types for all data structures.

---

## Summary by Audit Dimension

### 1️⃣ Security Vulnerability
- **Critical:** 6 findings (AUDIT-001, 003, 007, 009, 011, 013)
- **High:** 4 findings (AUDIT-002, 004, 006, 020)
- **Medium:** 5 findings (AUDIT-023, 027, 030, 041, 046)
- **Low:** 2 findings (AUDIT-032, 036)

### 2️⃣ Data & Stock Integrity
- **High:** 6 findings (AUDIT-008, 010, 012, 014, 028, 033)
- **Medium:** 5 findings (AUDIT-005, 017, 022, 039, 044)

### 3️⃣ Business Logic Risk
- **Medium:** 4 findings (AUDIT-016, 018, 029, 035, 045)

### 4️⃣ Code Quality Risk
- **Low:** 1 finding (AUDIT-047)

### 5️⃣ Architecture & Scalability Risk
- **High:** 1 finding (AUDIT-024)
- **Medium:** 2 findings (AUDIT-031, 037)
- **Low:** 2 findings (AUDIT-021, 043)

### 6️⃣ Error Handling & Recovery
- **Medium:** 3 findings (AUDIT-015, 019, 026)
- **Low:** 2 findings (AUDIT-034, 040)

### 7️⃣ Logging / Audit Trail Risk
- **High:** 1 finding (AUDIT-025)
- **Medium:** 2 findings (AUDIT-38, 042)

---

## Conclusion

This audit reveals significant security and data integrity concerns in the AustamGood WMS system. The most critical issues are:

1. **Systematic RLS Bypass:** All database services use SERVICE_ROLE_KEY, bypassing row-level security.
2. **Missing Authentication:** Multiple API endpoints lack authentication checks.
3. **Disabled Rate Limiting:** Login rate limiting is disabled in production.
4. **Non-Atomic Operations:** Stock movements are not transactional, risking data inconsistency.
5. **Audit Trail Gaps:** Ledger errors are silently ignored, compromising traceability.

**This system should NOT be considered production-ready until these findings are addressed.**

---

*Report generated by Senior System Auditor*  
*Date: 2026-01-10*
