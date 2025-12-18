# รายการหน้าทั้งหมดที่ต้องแก้ไข Server-Side Search

> อัปเดตล่าสุด: 18 ธันวาคม 2025
>
> รายการนี้แสดงหน้าทั้งหมดที่มีตารางและช่องค้นหา ซึ่งต้องแก้ไขให้รองรับการค้นหาแบบ server-side
>
> **ยกเว้น:** หน้าในโมดูล `/online-packing` และหน้า login/password

---

## สถานะการแก้ไข

- ✅ **แก้ไขแล้ว**: 3 หน้า
- ⏳ **รอแก้ไข**: 39 หน้า
- 📊 **รวมทั้งหมด**: 42 หน้า

---

## 1. WAREHOUSE MANAGEMENT (6 หน้า)

### Inventory
- [x] ✅ `app/warehouse/inventory-balances/page.tsx` - ยอดสต็อกคงเหลือ (แก้ไขแล้ว)
- [x] ✅ `app/warehouse/inventory-ledger/page.tsx` - การเคลื่อนไหวสต็อก (แก้ไขแล้ว)

### Inbound Operations
- [x] ✅ `app/warehouse/inbound/page.tsx` - รับสินค้าเข้า (แก้ไขแล้ว)
- [ ] ⏳ `app/warehouse/inbound-new/page.tsx` - รับสินค้าเข้า (ใหม่)

### Stock Operations
- [ ] ⏳ `app/warehouse/transfer/page.tsx` - โอนย้ายสินค้า
- [ ] ⏳ `app/warehouse/preparation-area-inventory/page.tsx` - สต็อกพื้นที่เตรียมการ

---

## 2. ORDER MANAGEMENT - RECEIVING (10 หน้า)

### Orders
- [ ] ⏳ `app/receiving/orders/page.tsx` - รายการออเดอร์
- [ ] ⏳ `app/receiving/page.tsx` - หน้าหลักการรับสินค้า

### Picklists
- [ ] ⏳ `app/receiving/picklists/page.tsx` - รายการหยิบสินค้า
- [ ] ⏳ `app/receiving/picklists/[id]/page.tsx` - รายละเอียดรายการหยิบ
- [ ] ⏳ `app/receiving/picklists/face-sheets/page.tsx` - ใบปะหน้าสินค้า
- [ ] ⏳ `app/receiving/picklists/bonus-face-sheets/page.tsx` - ใบปะหน้าของแถม
- [ ] ⏳ `app/receiving/picklists/bonus-face-sheets/pack-form/page.tsx` - ฟอร์มแพ็คของแถม

### Loadlists & Routes
- [ ] ⏳ `app/receiving/loadlists/page.tsx` - รายการโหลดสินค้า
- [ ] ⏳ `app/receiving/routes/page.tsx` - จัดเส้นทางขนส่ง

### Auto Replenishment
- [ ] ⏳ `app/receiving/auto-replenishment/page.tsx` - เบิกเติมสินค้าอัตโนมัติ

---

## 3. STOCK MANAGEMENT (2 หน้า)

- [ ] ⏳ `app/stock-management/import/page.tsx` - นำเข้าสต็อกจากระบบเก่า
- [ ] ⏳ `app/stock-management/adjustment/page.tsx` - ปรับปรุงสต็อก

---

## 4. MASTER DATA (17 หน้า)

### Products & Inventory
- [ ] ⏳ `app/master-data/products/page.tsx` - ข้อมูลสินค้า
- [ ] ⏳ `app/master-data/bom/page.tsx` - Bill of Materials
- [ ] ⏳ `app/master-data/locations/page.tsx` - ตำแหน่งจัดเก็บ
- [ ] ⏳ `app/master-data/warehouses/page.tsx` - คลังสินค้า
- [ ] ⏳ `app/master-data/preparation-area/page.tsx` - พื้นที่เตรียมการ
- [ ] ⏳ `app/master-data/storage-strategy/page.tsx` - กลยุทธ์การจัดเก็บ

### Business Partners
- [ ] ⏳ `app/master-data/suppliers/page.tsx` - ซัพพลายเออร์
- [ ] ⏳ `app/master-data/customers/page.tsx` - ลูกค้า

### Operations
- [ ] ⏳ `app/master-data/employees/page.tsx` - พนักงาน
- [ ] ⏳ `app/master-data/vehicles/page.tsx` - ยานพาหนะ
- [ ] ⏳ `app/master-data/shipping-costs/page.tsx` - ค่าขนส่ง
- [ ] ⏳ `app/master-data/assets/page.tsx` - สินทรัพย์

### System Management
- [ ] ⏳ `app/master-data/users/page.tsx` - ผู้ใช้งานระบบ
- [ ] ⏳ `app/master-data/roles/page.tsx` - บทบาทและสิทธิ์
- [ ] ⏳ `app/master-data/file-management/page.tsx` - จัดการไฟล์

### Document Types
- [ ] ⏳ `app/master-data/document-verification/page.tsx` - ตรวจสอบเอกสาร
- [ ] ⏳ `app/master-data/document-verification/iv-document-types/page.tsx` - ประเภทเอกสาร IV
- [ ] ⏳ `app/master-data/customer-rejection/page.tsx` - เหตุผลการปฏิเสธของลูกค้า

---

## 5. MOBILE OPERATIONS (7 หน้า)

### Pick Operations
- [ ] ⏳ `app/mobile/pick/page.tsx` - หยิบสินค้า (รายการ)
- [ ] ⏳ `app/mobile/pick/[id]/page.tsx` - หยิบสินค้า (รายละเอียด)
- [ ] ⏳ `app/mobile/pick-up-pieces/page.tsx` - เบิกชิ้นสินค้า

### Loading Operations
- [ ] ⏳ `app/mobile/loading/page.tsx` - ขึ้นรถ (รายการ)
- [ ] ⏳ `app/mobile/loading/[code]/page.tsx` - ขึ้นรถ (รายละเอียด)

### Face Sheet Operations
- [ ] ⏳ `app/mobile/face-sheet/[id]/page.tsx` - จ่ายสินค้า Face Sheet
- [ ] ⏳ `app/mobile/bonus-face-sheet/[id]/page.tsx` - จ่ายสินค้า Bonus Face Sheet

---

## แนวทางการแก้ไข

### ลำดับความสำคัญ (แนะนำ)

**Priority 1 - หน้าที่ใช้งานบ่อย (แก้ไขก่อน):**
1. ✅ `/warehouse/inventory-balances` (แก้ไขแล้ว)
2. `/warehouse/inventory-ledger`
3. `/receiving/orders`
4. `/receiving/picklists`
5. `/master-data/products`
6. `/master-data/customers`
7. `/master-data/locations`

**Priority 2 - หน้าที่ใช้งานปานกลาง:**
8. `/warehouse/inbound`
9. `/receiving/loadlists`
10. `/receiving/routes`
11. `/master-data/suppliers`
12. `/master-data/employees`
13. `/stock-management/import`

**Priority 3 - หน้าที่ใช้งานน้อย:**
14. `/receiving/auto-replenishment`
15. `/warehouse/preparation-area-inventory`
16. `/master-data/*` (หน้าอื่นๆ)
17. `/mobile/*` (หน้า mobile)

### ขั้นตอนการแก้ไข

1. อ่านคู่มือ: `docs/guides/SERVER_SIDE_SEARCH_MIGRATION.md`
2. ศึกษาตัวอย่างจาก: `app/warehouse/inventory-balances/page.tsx`
3. ทำตาม Checklist 8 ขั้นตอน
4. ทดสอบการค้นหาจากทุกหน้า
5. Commit และทำหน้าถัดไป

### เครื่องมือที่ใช้

- **Custom Hook**: `hooks/useServerSideSearch.ts`
- **คู่มือ**: `docs/guides/SERVER_SIDE_SEARCH_MIGRATION.md`
- **ตัวอย่าง**: `app/warehouse/inventory-balances/page.tsx`

---

## หมายเหตุ

- หน้าใน `/online-packing/*` **ไม่ต้องแก้ไข** (ตามคำขอของผู้ใช้)
- หน้า login, change-password, reset-password **ไม่ต้องแก้ไข** (ไม่มีตาราง)
- หน้า dashboard **ไม่ต้องแก้ไข** (ไม่มีการค้นหา)
- บางหน้า mobile อาจไม่ต้องแก้ไข (ถ้าไม่มี pagination)

---

## การติดตามความคืบหน้า

อัปเดตไฟล์นี้เมื่อแก้ไขเสร็จแต่ละหน้า:
- เปลี่ยนจาก `[ ] ⏳` เป็น `[x] ✅`
- เพิ่มวันที่แก้ไข (ถ้าต้องการ)
- อัปเดตสถิติด้านบน

---

**สุดท้ายอัปเดต:** 18 ธันวาคม 2025
**ผู้รับผิดชอบ:** Development Team
**เป้าหมาย:** แก้ไขให้ครบทุกหน้าภายในสิ้นเดือน
