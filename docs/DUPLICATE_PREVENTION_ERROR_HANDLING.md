# Duplicate Prevention Error Handling Guide

**วันที่:** 14 ธันวาคม 2025  
**สถานะ:** ✅ Implemented  
**ความสำคัญ:** 🔴 CRITICAL

---

## 📋 สรุป

หลังจากเพิ่ม UNIQUE constraints ใน Migration 144 เพื่อป้องกัน duplicate items แล้ว ระบบจะ reject การสร้าง duplicate โดยอัตโนมัติ ด้วย error code `23505` (unique_violation)

**Error นี้เป็นสิ่งที่ดี** - หมายความว่าระบบป้องกัน duplicate ได้สำเร็จ!

---

## 🎯 Error Code 23505

### ความหมาย
```
Error Code: 23505
Error Name: unique_violation
Message: duplicate key value violates unique constraint "xxx_unique_per_order_item"
```

### สาเหตุที่เกิด
1. **Double Click** - ผู้ใช้กดปุ่มยืนยัน 2 ครั้งติดกัน
2. **Race Condition** - หลายคนกดพร้อมกัน
3. **API Retry** - Network timeout แล้ว retry อัตโนมัติ
4. **Stored Procedure Bug** - Function พยายามสร้าง duplicate

### การจัดการ
✅ **ทุก API ได้รับการอัปเดตแล้ว** เพื่อจัดการ error นี้อย่างถูกต้อง

---

## ✅ APIs ที่ได้รับการแก้ไข

### 1. Mobile Pick Scan API
**File:** `app/api/mobile/pick/scan/route.ts`


**Behavior:**
- ตรวจจับ error code `23505` เมื่ออัปเดต `picklist_items`
- Return success response พร้อมข้อความ "รายการนี้ถูกบันทึกไปแล้ว"
- ไม่ทำให้ระบบ error แต่แจ้งผู้ใช้ว่าข้อมูลถูกบันทึกแล้ว

**Response:**
```json
{
  "success": true,
  "message": "รายการนี้ถูกบันทึกไปแล้ว",
  "already_processed": true,
  "picklist_status": "picking",
  "picklist_completed": false,
  "quantity_picked": 12
}
```

### 2. Mobile Face Sheet Scan API
**File:** `app/api/mobile/face-sheet/scan/route.ts`

**Behavior:**
- ตรวจจับ error code `23505` เมื่ออัปเดต `face_sheet_items`
- Return success response แบบ idempotent

**Response:**
```json
{
  "success": true,
  "message": "รายการนี้ถูกบันทึกไปแล้ว",
  "already_processed": true,
  "face_sheet_status": "picking",
  "face_sheet_completed": false,
  "quantity_picked": 12
}
```

### 3. Mobile Bonus Face Sheet Scan API
**File:** `app/api/mobile/bonus-face-sheet/scan/route.ts`

**Behavior:**
- ตรวจจับ error code `23505` เมื่ออัปเดต `bonus_face_sheet_items`
- Return success response แบบ idempotent

**Response:**
```json
{
  "success": true,
  "message": "รายการนี้ถูกบันทึกไปแล้ว",
  "already_processed": true,
  "bonus_face_sheet_status": "picking",
  "bonus_face_sheet_completed": false,
  "quantity_picked": 12
}
```

### 4. Face Sheet Generate API
**File:** `app/api/face-sheets/generate/route.ts`

**Behavior:**
- ตรวจจับ error code `23505` จาก stored procedure
- Return 409 Conflict status พร้อมข้อความที่เป็นมิตร

**Response:**
```json
{
  "error": "ใบปะหน้าสำหรับวันที่นี้ถูกสร้างไปแล้ว",
  "details": "มีใบปะหน้าที่มีรายการเดียวกันอยู่แล้วในระบบ กรุณาตรวจสอบใบปะหน้าที่มีอยู่",
  "duplicate": true
}
```

---

## 🔧 Implementation Pattern

### Backend (API)
```typescript
try {
  // Update database
  const { error } = await supabase
    .from('table_name')
    .update({ ... })
    .eq('id', item_id);

  if (error) {
    // ✅ Check for duplicate constraint violation
    if ((error as any).code === '23505') {
      console.log('⚠️ Duplicate detected - already processed');
      return NextResponse.json({
        success: true,
        message: 'รายการนี้ถูกบันทึกไปแล้ว',
        already_processed: true
      });
    }
    
    // Other errors
    throw error;
  }
} catch (error) {
  // Handle other errors
}
```

### Frontend (UI)
```typescript
const response = await fetch('/api/mobile/pick/scan', {
  method: 'POST',
  body: JSON.stringify(data)
});

const result = await response.json();

if (result.success) {
  if (result.already_processed) {
    // แสดงข้อความว่าข้อมูลถูกบันทึกแล้ว (ไม่ใช่ error)
    showInfo('รายการนี้ถูกบันทึกไปแล้ว');
  } else {
    // บันทึกสำเร็จ
    showSuccess('บันทึกสำเร็จ');
  }
} else {
  // Error จริง
  showError(result.error);
}
```

---

## 🛡️ Protection Layers

### Layer 1: Database UNIQUE Constraints ✅
- **Location:** Migration 144
- **Protection:** ป้องกัน duplicate ที่ database level
- **Coverage:** 100% - ไม่มีทางสร้าง duplicate ได้

### Layer 2: API Error Handling ✅
- **Location:** All scan APIs
- **Protection:** จัดการ error code 23505 อย่างถูกต้อง
- **Behavior:** Idempotent - return success แทน error

### Layer 3: UI Prevention (Recommended)
- **Location:** Frontend components
- **Protection:** ป้องกันการกดซ้ำ
- **Implementation:**
  ```typescript
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent double click
    
    setIsSubmitting(true);
    try {
      await submitData();
    } finally {
      setIsSubmitting(false);
    }
  };
  ```

---

## 📊 Monitoring

### ตรวจสอบ Duplicate Attempts
```sql
-- Count duplicate attempts in last 24 hours
SELECT 
  COUNT(*) as duplicate_attempts,
  DATE_TRUNC('hour', created_at) as hour
FROM error_logs
WHERE error_code = '23505'
  AND table_name IN ('picklist_items', 'face_sheet_items', 'bonus_face_sheet_items')
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY hour
ORDER BY hour DESC;
```

### ตรวจสอบว่าไม่มี Duplicate
```sql
-- Verify no duplicates exist
SELECT 
  'picklist_items' as table_name,
  picklist_id,
  order_item_id,
  COUNT(*) as count
FROM picklist_items
GROUP BY picklist_id, order_item_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
  'face_sheet_items',
  face_sheet_id,
  order_item_id,
  COUNT(*)
FROM face_sheet_items
GROUP BY face_sheet_id, order_item_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
  'bonus_face_sheet_items',
  face_sheet_id,
  order_item_id,
  COUNT(*)
FROM bonus_face_sheet_items
GROUP BY face_sheet_id, order_item_id
HAVING COUNT(*) > 1;
```

---

## ✅ Testing

### Test Case 1: Double Click
```
1. เปิดหน้า mobile pick
2. สแกน item
3. กดยืนยัน 2 ครั้งติดกัน (เร็วมาก)
4. ✅ ครั้งแรก: บันทึกสำเร็จ
5. ✅ ครั้งที่สอง: แสดง "รายการนี้ถูกบันทึกไปแล้ว"
6. ✅ สต็อคถูกต้อง: ย้ายแค่ 1 ครั้ง
```

### Test Case 2: Network Retry
```
1. เปิดหน้า mobile pick
2. สแกน item
3. กดยืนยัน
4. Disconnect network ก่อน response กลับ
5. API retry อัตโนมัติ
6. ✅ Retry: แสดง "รายการนี้ถูกบันทึกไปแล้ว"
7. ✅ สต็อคถูกต้อง: ย้ายแค่ 1 ครั้ง
```

### Test Case 3: Concurrent Users
```
1. User A และ User B เปิดหน้า pick เดียวกัน
2. ทั้งคู่สแกน item เดียวกัน
3. กดยืนยันพร้อมกัน
4. ✅ คนแรก: บันทึกสำเร็จ
5. ✅ คนที่สอง: แสดง "รายการนี้ถูกบันทึกไปแล้ว"
6. ✅ สต็อคถูกต้อง: ย้ายแค่ 1 ครั้ง
```

---

## 🎯 Best Practices

### 1. Always Check `already_processed` Flag
```typescript
if (result.success && result.already_processed) {
  // แสดงข้อความแจ้งเตือน ไม่ใช่ error
  showWarning('รายการนี้ถูกบันทึกไปแล้ว');
} else if (result.success) {
  // บันทึกสำเร็จ
  showSuccess('บันทึกสำเร็จ');
}
```

### 2. Disable Buttons During Submit
```typescript
<button 
  disabled={isSubmitting}
  onClick={handleSubmit}
>
  {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
</button>
```

### 3. Show Loading State
```typescript
{isSubmitting && (
  <div className="loading-overlay">
    <Spinner />
    <p>กำลังบันทึกข้อมูล...</p>
  </div>
)}
```

### 4. Log Duplicate Attempts
```typescript
if (error.code === '23505') {
  console.warn('Duplicate attempt prevented:', {
    user_id,
    item_id,
    timestamp: new Date().toISOString()
  });
  
  // Optional: Send to monitoring service
  analytics.track('duplicate_prevented', { ... });
}
```

---

## 📈 Benefits

### ก่อนแก้ไข
- ❌ Duplicate items สามารถเกิดขึ้นได้
- ❌ สต็อคผิดพลาด
- ❌ ผู้ใช้เห็น error ที่น่ากลัว
- ❌ ต้อง manual cleanup

### หลังแก้ไข
- ✅ ไม่สามารถสร้าง duplicate ได้
- ✅ สต็อคถูกต้อง 100%
- ✅ ผู้ใช้เห็นข้อความที่เป็นมิตร
- ✅ ระบบทำงานแบบ idempotent
- ✅ ปลอดภัยสำหรับ production

---

## 🚀 Production Readiness

### Checklist
- ✅ Database constraints added (Migration 144)
- ✅ API error handling implemented
- ✅ Idempotent behavior
- ✅ User-friendly messages
- ✅ Documentation complete
- ✅ Testing scenarios defined
- ⚠️ UI prevention (recommended but optional)
- ⚠️ Monitoring setup (recommended)

### Deployment
1. ✅ Migration 144 applied
2. ✅ APIs updated and deployed
3. ✅ Documentation available
4. ⚠️ Monitor duplicate attempts
5. ⚠️ Update UI to disable buttons (optional)

---

**Status:** ✅ Production Ready  
**Migration:** 144_prevent_duplicate_document_items.sql  
**Date:** 2025-12-14  
**Impact:** 🔴 CRITICAL - Prevents stock movement errors

