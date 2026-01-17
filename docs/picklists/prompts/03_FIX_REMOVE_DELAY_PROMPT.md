# 🔧 Prompt #3: Remove Artificial Delays

## 📋 Task Overview
ลบ `setTimeout` / `delay` ที่ไม่จำเป็นซึ่งสร้าง Race Condition window

---

## 🎯 Instructions for AI

### Step 1: Search for Delays

ใช้คำสั่งนี้ค้นหา:

```bash
# Search for setTimeout in API routes
grep -rn "setTimeout" app/api/ --include="*.ts" --include="*.tsx"

# Search for sleep/delay patterns
grep -rn "await new Promise" app/api/ --include="*.ts"

# Search for delay utilities
grep -rn "delay\|sleep" app/api/ --include="*.ts"
```

### Step 2: Identify Bug Pattern

```typescript
// ❌ BUG: Artificial delay before stock reservation
for (let i = 0; i < packages.length; i++) {
  await supabase.from('bonus_face_sheet_packages').insert({ ... });
  await supabase.from('bonus_face_sheet_items').insert(items);
}

// ❌ THIS IS THE BUG - 500ms window for race condition!
await new Promise(resolve => setTimeout(resolve, 500));

// Stock can be reserved by another request during this 500ms!
const { data: reservationResult } = await supabase
  .rpc('reserve_stock_for_bonus_face_sheet_items', {
    p_bonus_face_sheet_id: faceSheet.id
  });
```

### Step 3: Apply Fix

```typescript
// ✅ FIX: Remove delay and call immediately
for (let i = 0; i < packages.length; i++) {
  await supabase.from('bonus_face_sheet_packages').insert({ ... });
  await supabase.from('bonus_face_sheet_items').insert(items);
}

// ✅ NO DELAY - call reservation immediately
const { data: reservationResult } = await supabase
  .rpc('reserve_stock_for_bonus_face_sheet_items', {
    p_bonus_face_sheet_id: faceSheet.id,
    p_warehouse_id: warehouse_id,
    p_reserved_by: created_by
  });
```

### Step 4: Files to Check and Fix

```
1. app/api/bonus-face-sheets/route.ts
   - Line ~348-390: ลบ setTimeout ก่อน reservation

2. app/api/face-sheets/generate/route.ts
   - ตรวจสอบ delay ใดๆ ระหว่าง create และ reserve

3. app/api/picklists/create-from-trip/route.ts
   - ตรวจสอบ delay ใดๆ

4. app/api/loadlists/route.ts
   - ตรวจสอบ delay ใดๆ
```

---

## 📝 Checklist Before Commit

- [ ] Search ทุกไฟล์ใน `app/api/` หา setTimeout
- [ ] ลบ delay ที่ไม่จำเป็น
- [ ] เพิ่ม proper error handling แทน
- [ ] Test ว่า flow ยังทำงานถูกต้อง
- [ ] Test concurrent requests
- [ ] Code review

---

## ⚠️ Important Notes

1. **อย่าลบ** setTimeout ที่อยู่ใน rate limiter หรือ retry logic
2. **อย่าลบ** delay ที่ใช้สำหรับ animation/UI
3. **ตรวจสอบ** ว่า delay ถูกเพิ่มเพื่ออะไร ก่อนลบ
4. **Test** ว่า flow ยังทำงานถูกต้องหลังลบ delay
