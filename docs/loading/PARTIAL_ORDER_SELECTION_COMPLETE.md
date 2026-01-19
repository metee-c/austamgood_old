# การเลือกเฉพาะบางออเดอร์จาก BFS เพื่อสร้าง Loadlist

## สรุป
เพิ่มฟีเจอร์ใหม่ในหน้า Loadlists ที่ให้ผู้ใช้สามารถเลือกเฉพาะบางออเดอร์จาก Bonus Face Sheet (BFS) เพื่อสร้าง Loadlist โดยไม่ต้องแมพกับ Picklist

## การทำงาน

### 1. UI Components
- **Checkbox "เลือกเฉพาะบางออเดอร์"**: เปิด/ปิดโหมดเลือกบางออเดอร์
- **คอลัมน์ "ดูออเดอร์"**: ปุ่มขยาย/ย่อเพื่อแสดงรายการออเดอร์
- **รายการออเดอร์**: แสดงเป็น expandable rows พร้อม checkbox สำหรับเลือกแต่ละออเดอร์
- **จำนวนออเดอร์ที่เลือก**: แสดงข้างเลข BFS เช่น "(3 ออเดอร์)"

### 2. State Management
```typescript
// เก็บสถานะการขยาย/ย่อของแต่ละ BFS
const [expandedBfsRows, setExpandedBfsRows] = useState<Record<number, boolean>>({});

// เก็บออเดอร์ที่เลือกสำหรับแต่ละ BFS
const [selectedBfsOrders, setSelectedBfsOrders] = useState<Record<number, string[]>>({});

// เก็บข้อมูลออเดอร์ที่ดึงมาแล้ว
const [bfsOrdersData, setBfsOrdersData] = useState<Record<number, any[]>>({});

// เก็บสถานะการโหลดข้อมูล
const [loadingBfsOrders, setLoadingBfsOrders] = useState<Record<number, boolean>>({});
```

### 3. API Integration

#### Frontend → Backend
```typescript
// ส่งข้อมูลไปยัง API
const response = await fetch('/api/loadlists', {
  method: 'POST',
  body: JSON.stringify({
    skip_mapping: true,
    bfs_ids: selectedBonusFaceSheets,
    selected_orders: selectedBfsOrders, // { bfs_id: [order_no, ...] }
    checker_employee_id,
    // ... other fields
  })
});
```

#### Backend Processing (`app/api/loadlists/route.ts`)
1. รับ `selected_orders` parameter (Record<number, string[]>)
2. ดึง packages ทั้งหมดของ BFS ที่เลือก
3. แปลง order_no → order_id จาก wms_orders table
4. กรอง packages เฉพาะที่อยู่ในออเดอร์ที่เลือก
5. สร้าง loadlist พร้อม mapping records

```typescript
// ตัวอย่าง code ใน handleSkipMappingMode
if (selected_orders && Object.keys(selected_orders).length > 0) {
  // แปลง order_no → order_id
  const allSelectedOrderNos = Object.values(selected_orders).flat();
  const { data: orders } = await supabase
    .from('wms_orders')
    .select('order_id, order_no')
    .in('order_no', allSelectedOrderNos);

  // กรอง packages
  availablePackages = availablePackages.filter(pkg => {
    const bfsId = pkg.face_sheet_id;
    const selectedOrderNos = selected_orders[bfsId] || [];
    
    if (selectedOrderNos.length === 0) return true; // ไม่มีการเลือก = เอาทั้งหมด
    
    const selectedOrderIds = selectedOrderNos
      .map(orderNo => orderIdsByOrderNo.get(orderNo))
      .filter(Boolean);
    
    return selectedOrderIds.includes(pkg.order_id);
  });
}
```

### 4. Validation
- ต้องเลือก BFS อย่างน้อย 1 รายการ
- ต้องเลือก checker
- ถ้าเปิดโหมดเลือกบางออเดอร์ ต้องมีการเลือกออเดอร์อย่างน้อย 1 รายการ

### 5. User Flow
1. เปิดหน้า Loadlists → สร้างใบโหลดใหม่
2. ไปที่แทบ "ใบปะหน้าของแถม (0)"
3. เช็ค "ไม่ต้องแมพกับใบหยิบ"
4. เช็ค "เลือกเฉพาะบางออเดอร์"
5. เลือก BFS ที่ต้องการ
6. คลิกปุ่ม "ดูออเดอร์" เพื่อขยายรายการ
7. เลือกออเดอร์ที่ต้องการ (หรือเลือกทั้งหมด)
8. เลือก checker
9. กดสร้าง Loadlist

## Bug Fixes

### React Hooks Error (Fixed)
**ปัญหา**: เรียก `useState` ภายใน `.map()` function ซึ่งละเมิด Rules of Hooks

**วิธีแก้**: ใช้ state object แทน
```typescript
// ❌ WRONG
unmappedBonusFaceSheets.map((bfs) => {
  const [showOrders, setShowOrders] = useState(false);
  ...
})

// ✅ CORRECT
const [expandedBfsRows, setExpandedBfsRows] = useState<Record<number, boolean>>({});

unmappedBonusFaceSheets.map((bfs) => {
  const showOrders = expandedBfsRows[bfs.id] || false;
  ...
})
```

## Files Modified

### Frontend
- `app/receiving/loadlists/page.tsx`
  - เพิ่ม state สำหรับจัดการการเลือกออเดอร์
  - เพิ่ม UI สำหรับแสดงและเลือกออเดอร์
  - เพิ่ม validation
  - ส่ง selected_orders ไปยัง API

### Backend
- `app/api/loadlists/route.ts`
  - รับ selected_orders parameter
  - กรอง packages ตาม order_id
  - สร้าง loadlist พร้อม matched_package_ids

### API Endpoints Used
- `GET /api/bonus-face-sheets/orders?delivery_date={date}` - ดึงรายการออเดอร์
- `GET /api/bonus-face-sheets/{id}` - ดึง packages ของ BFS
- `POST /api/loadlists` - สร้าง loadlist

## Testing Checklist
- [x] Build สำเร็จไม่มี error
- [x] ไม่มี React Hooks error
- [ ] ทดสอบเลือกออเดอร์เดียว
- [ ] ทดสอบเลือกหลายออเดอร์
- [ ] ทดสอบเลือกทั้งหมด
- [ ] ทดสอบไม่เลือกออเดอร์ (ควรแสดง error)
- [ ] ทดสอบสร้าง loadlist สำเร็จ
- [ ] ตรวจสอบว่า packages ที่สร้างตรงกับออเดอร์ที่เลือก

## Next Steps
1. ทดสอบการทำงานจริงในหน้า UI
2. ตรวจสอบว่า packages ที่ถูกสร้างใน loadlist ตรงกับออเดอร์ที่เลือก
3. ทดสอบ edge cases (เช่น BFS ที่มีออเดอร์เดียว, BFS ที่มีออเดอร์เยอะ)
4. ทดสอบ performance เมื่อมี BFS หลายรายการ

## Technical Notes
- ใช้ `Record<number, T>` pattern สำหรับเก็บข้อมูลที่เกี่ยวข้องกับแต่ละ BFS
- Lazy loading: ดึงข้อมูลออเดอร์เมื่อผู้ใช้คลิกขยายเท่านั้น
- การกรอง packages ทำที่ backend เพื่อความถูกต้อง
- ใช้ order_id แทน order_no ในการกรองเพื่อความแม่นยำ

## Status
✅ **COMPLETE** - Build สำเร็จ, พร้อมทดสอบ
