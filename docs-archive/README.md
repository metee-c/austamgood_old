# 📚 Documentation Archive

โฟลเดอร์นี้เก็บเอกสารต่างๆ ที่เคยอยู่ใน root directory ที่ถูกจัดระเบียบใหม่เป็นหมวดหมู่

## 📁 โครงสร้างโฟลเดอร์

```
docs-archive/
├── mobile/              # เอกสารระบบมือถือ (4 ไฟล์ + README)
├── workflow/            # เอกสาร Workflow และ Status Management (4 ไฟล์ + README)
├── stock-import/        # เอกสารระบบนำเข้าสต็อก (2 ไฟล์ + README)
├── migration/           # เอกสาร Database Migration (4 ไฟล์ + README)
├── vrp/                 # เอกสาร Vehicle Routing Problem (1 ไฟล์ + README)
├── build-reports/       # รายงาน Build และ Changelogs (2 ไฟล์ + README)
└── analysis/            # การวิเคราะห์และ Templates (1 ไฟล์ + README)
```

## 📱 Mobile (5 ไฟล์)
คู่มือและการวิเคราะห์ระบบมือถือสำหรับคลังสินค้า

- `MOBILE_RECEIVE_GUIDE.md` - คู่มือระบบรับสินค้าบนมือถือ
- `MOBILE_TRANSFER_GUIDE.md` - คู่มือระบบย้ายสินค้าบนมือถือ
- `INBOUND_ANALYSIS_FOR_MOBILE.md` - การวิเคราะห์ระบบรับสินค้า
- `TRANSFER_ANALYSIS_FOR_MOBILE.md` - การวิเคราะห์ระบบย้ายสินค้า
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** Developer ที่ทำงานกับ mobile interface

## 🔄 Workflow (5 ไฟล์)
เอกสารระบบ Workflow การจัดการสถานะอัตโนมัติ

- `WORKFLOW_STATUS_DESIGN.md` - ⭐⭐⭐⭐ การออกแบบระบบสถานะ
- `WORKFLOW_IMPLEMENTATION_SUMMARY.md` - ⭐⭐⭐⭐ สรุปการ implement
- `WORKFLOW_QUICK_START.md` - ⭐⭐⭐ Quick start guide
- `WORKFLOW_VERIFICATION_PROMPT.md` - การตรวจสอบ workflow
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** Developer ที่ทำงานกับ order workflow, status management, database triggers

## 📦 Stock Import (3 ไฟล์)
เอกสารระบบนำเข้าสต็อกจากระบบเดิม

- `STOCK_IMPORT_SUMMARY.md` - ⭐⭐⭐ สรุประบบนำเข้าสต็อก
- `STOCK_IMPORT_PLAN.md` - แผนการพัฒนาระบบ
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** Developer ที่ทำงานกับ batch import, data migration

## 🔧 Migration (5 ไฟล์)
คู่มือการทำ Database Migration

- `MIGRATION_INSTRUCTIONS.md` - ⭐⭐⭐ คำแนะนำการทำ migration
- `MIGRATION_REPORT.md` - รายงานการ migrate
- `MIGRATION_AUDIT_REPORT.md` - ตรวจสอบ migration
- `RUN_VRP_MIGRATION.md` - วิธีรัน VRP migration
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** Backend developer ที่ทำงานกับ database schema changes

## 🚚 VRP (2 ไฟล์)
เอกสารระบบจัดเส้นทางรถแบบอัตโนมัติ

- `README_VRP.md` - ⭐⭐⭐⭐⭐ คู่มือ VRP ฉบับสมบูรณ์
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** Developer ที่ทำงานกับ route planning, optimization algorithms

## 📊 Build Reports (3 ไฟล์)
รายงานการ build และประวัติการเปลี่ยนแปลง

- `BUILD_SUCCESS_REPORT.md` - รายงาน build สำเร็จ
- `CHANGELOG_20241111.md` - บันทึกการเปลี่ยนแปลง 11/11/2024
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** ตรวจสอบ build status และ release notes

## 🔍 Analysis (2 ไฟล์)
การวิเคราะห์และ templates สำหรับการพัฒนา

- `DEVELOPMENT_CONTEXT_TEMPLATE.md` - Template สำหรับเขียน context
- `README.md` - คำอธิบายโฟลเดอร์

**🎯 ใช้สำหรับ:** สร้าง documentation และ development context

---

## 🎯 Quick Navigation

### ฉันต้องการ...

#### เข้าใจระบบ Workflow
→ ไป `workflow/WORKFLOW_STATUS_DESIGN.md`

#### ทำ Database Migration
→ ไป `migration/MIGRATION_INSTRUCTIONS.md`

#### พัฒนา Mobile Interface
→ ไป `mobile/MOBILE_RECEIVE_GUIDE.md` หรือ `mobile/MOBILE_TRANSFER_GUIDE.md`

#### ทำความเข้าใจ VRP
→ ไป `vrp/README_VRP.md`

#### นำเข้าสต็อกจากระบบเดิม
→ ไป `stock-import/STOCK_IMPORT_SUMMARY.md`

#### ดู Changelog
→ ไป `build-reports/CHANGELOG_*.md`

---

## 📌 หมายเหตุสำคัญ

### ไฟล์ที่ยังอยู่ใน Root Directory
เอกสารสำคัญที่ยังอยู่ใน root:
- `README.md` - README หลักของโปรเจค
- `CLAUDE.md` - ⭐⭐⭐⭐⭐ Context หลักสำหรับ AI (อ่านก่อนเสมอ!)
- `DESIGN_SYSTEM.md` - ⭐⭐⭐⭐⭐ ระบบดีไซน์ UI/UX
- `GEMINI.md` - AI configuration
- `DOCUMENTATION_INDEX.md` - Index ของเอกสารทั้งหมด

### เอกสารใน /docs Directory
เอกสารเทคนิคโดยละเอียดยังอยู่ใน `/docs`:
- VRP System details
- Database setup
- API documentation
- Order import guides
- Shipping cost calculation
- และอื่นๆ อีกมาก

---

## 🔄 Last Updated
**Date:** 2025-01-23
**Organized by:** Claude Code
**Total Files:** 25 ไฟล์ (19 เอกสาร + 6 README)

---

**💡 Tip:** อ่าน `DOCUMENTATION_INDEX.md` ใน root directory เพื่อดู index ครบทุกเอกสารในโปรเจค
