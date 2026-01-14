# Virtual Pallet System

## สรุป

Virtual Pallet คือระบบ "บัญชีเงินเชื่อ" สำหรับสต็อก ที่ช่วยให้สามารถสร้าง reservation ได้แม้สต็อกจริงไม่พอ

## แนวคิด

```
┌─────────────────────────────────────────────────────────────────┐
│  PK001 (Prep Area)                                              │
├─────────────────────────────────────────────────────────────────┤
│  พาเลทจริง:                                                      │
│    PAL-001: 10 ชิ้น (reserved: 10)                               │
│    PAL-002: 10 ชิ้น (reserved: 10)                               │
│    PAL-003: 10 ชิ้น (reserved: 10)                               │
│                                                                 │
│  พาเลทเสมือน (VIRTUAL):                                          │
│    VIRTUAL-PK001-SKU001: -5 ชิ้น (reserved: 5) ← ติดลบได้!       │
│                                                                 │
│  รวม: 30 - 5 = 25 ชิ้น (แต่จองได้ 35)                            │
└─────────────────────────────────────────────────────────────────┘
```

## การทำงาน

### 1. สร้าง Reservation บน Virtual Pallet

เมื่อสร้าง Face Sheet, Bonus Face Sheet หรือ Picklist และสต็อกไม่พอ:
1. จองจากพาเลทจริงก่อน (FEFO/FIFO)
2. ถ้ายังไม่พอ → สร้าง reservation บน Virtual Pallet
3. Virtual Pallet จะมี `total_piece_qty` ติดลบ

### 2. Auto Settle เมื่อเติมสินค้า

เมื่อมีสินค้าเข้า Prep Area (ไม่ว่าจะด้วยวิธีใด):
1. Trigger `trg_z_settle_virtual_on_replenishment` ทำงาน
2. เช็คว่า SKU นั้นมี Virtual Pallet ติดลบอยู่ไหม
3. ถ้ามี → หักจากพาเลทที่เพิ่งเข้ามา → เพิ่มให้ Virtual
4. บันทึก Settlement History

## Reservation Functions ที่รองรับ Virtual Pallet

| Function/API | Status | หมายเหตุ |
|--------------|--------|----------|
| `reserve_stock_for_face_sheet_items` | ✅ รองรับ | Database Function |
| `reserve_stock_for_bonus_face_sheet_items` | ✅ รองรับ | Database Function |
| `/api/picklists/create-from-trip` | ✅ รองรับ | API Route |
| `/api/picklists/create-from-trips-batch` | ✅ รองรับ | API Route |

## Database Objects

### Tables
- `virtual_pallet_settlements` - บันทึกประวัติการ settle

### Functions
- `generate_virtual_pallet_id(location, sku)` - สร้าง Virtual Pallet ID
- `is_preparation_area(location)` - เช็คว่าเป็น Prep Area หรือไม่
- `get_negative_virtual_balance(location, sku, warehouse)` - ดึง Virtual ที่ติดลบ
- `create_or_update_virtual_balance(...)` - สร้าง/อัพเดท Virtual Balance
- `settle_virtual_pallet(...)` - Settle Virtual จากพาเลทจริง
- `manual_settle_virtual_pallet(location, sku, warehouse)` - Manual settle สำหรับ Admin
- `get_virtual_pallet_summary(warehouse)` - สรุป Virtual Pallet

### Views
- `v_virtual_pallet_status` - สถานะ Virtual Pallet ทั้งหมด
- `v_virtual_pallet_settlement_history` - ประวัติการ settle

### Triggers
- `trg_z_settle_virtual_on_replenishment` - Auto settle เมื่อมีสินค้าเข้า Prep Area

## การใช้งาน

### ดูสถานะ Virtual Pallet
```sql
SELECT * FROM v_virtual_pallet_status;
```

### ดูประวัติการ Settle
```sql
SELECT * FROM v_virtual_pallet_settlement_history;
```

### ดูสรุป Virtual Pallet ที่ติดลบ
```sql
SELECT * FROM get_virtual_pallet_summary('WH001');
```

### Manual Settle (Admin)
```sql
SELECT * FROM manual_settle_virtual_pallet('PK001', 'B-BEY-C|SAL|NS|010', 'WH001');
```

## Status ของ Virtual Pallet

| Status | ความหมาย |
|--------|----------|
| DEFICIT | ติดลบ - รอเติมสินค้า |
| PENDING_SETTLE | balance = 0 แต่ยังมี reserved - รอ pick |
| SETTLED | balance = 0 และ reserved = 0 - เสร็จสมบูรณ์ |
| NORMAL | balance > 0 - ปกติ |

## Migration

ไฟล์: `supabase/migrations/209_create_virtual_pallet_system.sql`
