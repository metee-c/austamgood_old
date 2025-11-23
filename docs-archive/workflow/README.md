# 🔄 Workflow Documentation

เอกสารระบบ Workflow การจัดการสถานะอัตโนมัติ

## เอกสารในโฟลเดอร์นี้

### การออกแบบ
- **WORKFLOW_STATUS_DESIGN.md** - การออกแบบระบบสถานะแบบอัตโนมัติครบวงจร
  - Flow ของสถานะ Order (draft → confirmed → in_picking → picked → loaded → in_transit → delivered)
  - Flow ของ Route Plan (draft → optimizing → published → pending_approval → approved → ready_to_load → in_transit → completed)
  - Database Triggers ทั้ง 7 ตัว
  - ความสัมพันธ์ระหว่าง Orders, Picklists, Loadlists, Route Plans

### การ Implement
- **WORKFLOW_IMPLEMENTATION_SUMMARY.md** - สรุปการ implement workflow ที่เสร็จแล้ว
  - Migration files ที่เกี่ยวข้อง (026-030)
  - API endpoints ที่ถูกสร้าง
  - Trigger functions ทั้งหมด
  - ตัวอย่างการใช้งาน

### Quick Start
- **WORKFLOW_QUICK_START.md** - คู่มือเริ่มต้นใช้งาน workflow
- **WORKFLOW_VERIFICATION_PROMPT.md** - การตรวจสอบ workflow ว่าทำงานถูกต้อง

## Database Triggers

Workflow ใช้ 7 Database Triggers หลัก:

1. **Route Publish → Orders Confirmed** (Trigger 1)
2. **Picklist Create → Orders In_Picking** (Trigger 2)
3. **Picklist Complete → Orders Picked + Route Ready_to_Load** (Trigger 3)
4. **Loadlist Scan → Orders Loaded** (Trigger 4)
5. **Loadlist Depart → Orders In_Transit + Route In_Transit** (Trigger 5)
6. **Order Delivered → Loadlist & Route Completed** (Trigger 6)
7. **Shipping Cost Complete → Route Published** (Trigger 7)

## Migration Files

- `026_add_workflow_status_enums.sql` - เพิ่ม status enums และตาราง loadlists
- `027_create_workflow_status_triggers.sql` - สร้าง triggers 6 ตัวแรก
- `028_add_loadlist_rls_and_triggers.sql` - เพิ่ม RLS policies
- `029_add_pending_approval_status.sql` - เพิ่มสถานะ pending_approval และ approved
- `030_add_shipping_cost_validation_trigger.sql` - สร้าง trigger ตรวจสอบค่าขนส่ง

## ใช้เมื่อไหร่?

### สำหรับ Backend Developer
ใช้เอกสารเหล่านี้เมื่อ:
- ทำความเข้าใจ database triggers
- แก้ไข workflow logic
- เพิ่ม status ใหม่
- Debug ปัญหา status ไม่เปลี่ยน

### สำหรับ Frontend Developer
ใช้เอกสารเหล่านี้เมื่อ:
- สร้าง UI สำหรับเปลี่ยนสถานะ
- แสดง status badge
- ทำความเข้าใจ flow การทำงาน

## เอกสารที่เกี่ยวข้อง

- `supabase/migrations/026-030*.sql` - Database migrations
- `app/receiving/routes/page.tsx` - หน้าจัดการ Route Plans
- `app/api/picklists/[id]/print/route.ts` - API เปลี่ยนสถานะ picklist
- `app/api/loadlists/[id]/scan/route.ts` - API สแกนขึ้นรถ
- `app/api/loadlists/[id]/depart/route.ts` - API รถออกจากคลัง
