# Force Move Implementation - Misplaced Inventory

## Overview
Implementation of the "Quick Move" functionality for the Misplaced Inventory page, allowing users to move items from their current location to their designated picking home.

## Features

### 1. Quick Move API (`/api/moves/quick-move`)
- **Method**: POST
- **Authentication**: Session token required
- **Purpose**: Create a completed move record and update inventory location

### 2. Move Methods
- **Pallet Move**: When `pallet_id` is provided, moves all balance records with that pallet
- **Piece Move**: When `balance_id` is provided, moves a single balance record

### 3. Picking Home Validation
- Validates that destination location matches SKU's `default_location`
- If validation fails, returns `canForceMove: true` flag
- User can confirm to bypass validation with `force_move: true`

### 4. Force Move Flow
1. User clicks "ย้าย" button
2. If destination ≠ picking home → Show warning with force move option
3. User confirms → Retry with `force_move: true`
4. Move completes successfully

## Database Schema

### Tables Used
- `wms_moves`: Move header records
- `wms_move_items`: Move item details
- `wms_inventory_balances`: Inventory balance records
- `master_sku`: SKU master data (for picking home validation)
- `user_sessions`: Session authentication
- `master_system_user`: User to employee mapping
- `master_employee`: Employee master data

### Foreign Key Relationships
- `wms_moves.created_by` → `master_employee.employee_id`
- `wms_move_items.created_by` → `master_employee.employee_id`
- `wms_move_items.executed_by` → `master_employee.employee_id`

**Important**: The API fetches `employee_id` from `master_system_user` via the session token, not directly from `user_id`.

## API Request Format

```json
{
  "pallet_id": "ATG2500016115",  // Optional: for pallet moves
  "balance_id": 12345,            // Optional: for piece moves (required if no pallet_id)
  "to_location_id": "A03-01-009", // Required: destination location
  "notes": "Custom notes",        // Optional
  "force_move": false             // Optional: bypass picking home validation
}
```

## API Response Format

### Success
```json
{
  "success": true,
  "data": {
    "move_id": 123,
    "move_no": "MV0000001088",
    "move_type": "transfer",
    "status": "completed",
    "created_by": 11,
    "completed_at": "2026-01-21T10:30:00Z"
  },
  "message": "ย้ายสินค้าสำเร็จ"
}
```

### Error (Picking Home Mismatch)
```json
{
  "error": "ตำแหน่งปลายทาง A03-01-009 ไม่ใช่บ้านหยิบของ SKU นี้ (A03-01-010)",
  "canForceMove": true
}
```

## Implementation Details

### 1. Session Authentication
```typescript
// Get employee_id from session via master_system_user
const { data: sessionData } = await supabase
  .from('user_sessions')
  .select(`
    user_id,
    master_system_user!inner(employee_id)
  `)
  .eq('token', sessionToken)
  .eq('invalidated', false)
  .single()

const employeeId = sessionData.master_system_user?.employee_id
```

### 2. Pallet vs Balance Move
```typescript
if (pallet_id) {
  // Query all balance records with this pallet_id
  const { data } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('pallet_id', pallet_id)
  
  balanceRecords = data // Multiple records
} else if (balance_id) {
  // Query single balance record
  const { data } = await supabase
    .from('wms_inventory_balances')
    .select('*')
    .eq('balance_id', balance_id)
    .maybeSingle()
  
  balanceRecords = [data] // Single record
}
```

### 3. Move Number Generation
```typescript
// Get last move number
const { data: lastMove } = await supabase
  .from('wms_moves')
  .select('move_no')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

// Generate next number (MV0000001088 → MV0000001089)
let nextNumber = 1
if (lastMove?.move_no) {
  const match = lastMove.move_no.match(/MV(\d+)/)
  if (match) {
    nextNumber = parseInt(match[1]) + 1
  }
}
const move_no = `MV${String(nextNumber).padStart(10, '0')}`
```

### 4. Move Record Creation
```typescript
// Insert move header
const { data: move } = await supabase
  .from('wms_moves')
  .insert({
    move_no,
    move_type: 'transfer',
    status: 'completed',
    notes: notes || 'Quick move from misplaced inventory',
    created_by: employeeId,  // From master_employee
    completed_at: new Date().toISOString()
  })
  .select()
  .single()

// Insert move items (one per balance record)
const moveItems = balanceRecords.map(balance => ({
  move_id: move.move_id,
  sku_id: balance.sku_id,
  pallet_id: balance.pallet_id,
  move_method: balance.pallet_id ? 'PALLET' : 'PIECE',
  status: 'completed',
  from_location_id,
  to_location_id,
  requested_pack_qty: balance.total_packs || 0,
  requested_piece_qty: balance.total_pieces || 0,
  confirmed_pack_qty: balance.total_packs || 0,
  confirmed_piece_qty: balance.total_pieces || 0,
  production_date: balance.production_date,
  expiry_date: balance.expiry_date,
  created_by: employeeId,   // From master_employee
  executed_by: employeeId,  // From master_employee
  completed_at: new Date().toISOString()
}))

await supabase.from('wms_move_items').insert(moveItems)
```

### 5. Inventory Update
```typescript
// Update location for all affected balance records
const balanceIds = balanceRecords.map(b => b.balance_id)
await supabase
  .from('wms_inventory_balances')
  .update({ location_id: to_location_id })
  .in('balance_id', balanceIds)
```

## UI Integration

### Move Button States
1. **Normal**: Blue button "ย้าย" (for pallet moves)
2. **Piece Move**: Orange button "ย้าย (ชิ้น)" (for non-pallet moves)
3. **Moving**: Gray button with spinner "กำลังย้าย..."
4. **Success**: Green button with checkmark "ย้ายแล้ว" (3 seconds)

### Force Move Confirmation
```typescript
const forceConfirm = confirm(
  `⚠️ การตรวจสอบบ้านหยิบล้มเหลว:\n\n${result.error}\n\n` +
  `❓ ต้องการบังคับย้ายหรือไม่?\n\n` +
  `⚠️ คำเตือน: การบังคับย้ายจะข้ามการตรวจสอบบ้านหยิบ\n` +
  `กรุณาตรวจสอบให้แน่ใจว่าปลายทางถูกต้อง`
)
```

## Error Handling

### Common Errors
1. **No pallet_id or balance_id**: 400 Bad Request
2. **No to_location_id**: 400 Bad Request
3. **Unauthorized**: 401 Unauthorized
4. **No employee linked**: 401 Unauthorized
5. **Pallet/Balance not found**: 404 Not Found
6. **Picking home mismatch**: 400 Bad Request (with `canForceMove: true`)
7. **Database errors**: 500 Internal Server Error

## Testing

### Test Case 1: Pallet Move
```bash
curl -X POST http://localhost:3000/api/moves/quick-move \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_TOKEN" \
  -d '{
    "pallet_id": "ATG2500016115",
    "to_location_id": "A03-01-009"
  }'
```

### Test Case 2: Piece Move
```bash
curl -X POST http://localhost:3000/api/moves/quick-move \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_TOKEN" \
  -d '{
    "balance_id": 12345,
    "to_location_id": "A03-01-009"
  }'
```

### Test Case 3: Force Move
```bash
curl -X POST http://localhost:3000/api/moves/quick-move \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_TOKEN" \
  -d '{
    "pallet_id": "ATG2500016115",
    "to_location_id": "A03-01-010",
    "force_move": true
  }'
```

## Files Modified
- `app/api/moves/quick-move/route.ts` - API endpoint implementation
- `app/warehouse/misplaced-inventory/page.tsx` - UI with move button
- `docs/warehouse/FORCE_MOVE_IMPLEMENTATION.md` - This documentation

## Known Issues & Solutions

### Issue 1: Foreign Key Constraint Violation
**Error**: `Key (created_by)=(2) is not present in table "master_employee"`

**Root Cause**: Using `user_id` from `master_system_user` instead of `employee_id` from `master_employee`

**Solution**: 
- Query `master_system_user.employee_id` via session join
- Use `employee_id` for all `created_by` and `executed_by` fields

### Issue 2: Pallet ID Not Unique
**Error**: One pallet_id maps to 178 balance records

**Solution**: 
- Query all balance records with matching pallet_id
- Create one move_item per balance record
- Update all balance records' locations

### Issue 3: Items Without Pallet
**Solution**: 
- Support both `pallet_id` and `balance_id` parameters
- Use `balance_id` for piece-level moves
- Show different button text for piece moves

## Future Enhancements
1. Add move history tracking
2. Support batch moves (multiple items at once)
3. Add move cancellation/rollback
4. Generate move reports
5. Add barcode scanning for move confirmation
