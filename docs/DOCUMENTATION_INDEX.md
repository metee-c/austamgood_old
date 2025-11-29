# 📚 Documentation Index - AustamGood WMS

> **คู่มือการใช้งานเอกสารทั้งหมดในโปรเจค**
> อัปเดตล่าสุด: 2025-01-23

---

## 🔥 เอกสารหลักที่ต้องอ่านก่อน (ลำดับความสำคัญ)

### 1. **CLAUDE.md** ⭐⭐⭐⭐⭐
**คำอธิบาย:** เอกสารหลักที่ Claude Code ใช้ในการทำงาน ครอบคลุมทุกอย่าง
**เนื้อหา:**
- โครงสร้างโปรเจคทั้งหมด
- คำสั่ง npm scripts
- การจัดการ Database
- ข้อตกลงการเขียนโค้ด (Code Conventions)
- ตำแหน่งไฟล์สำคัญทั้งหมด
- API Routes และ Components

**🎯 ใช้เมื่อ:** ต้องการเข้าใจภาพรวมโปรเจคทั้งหมด

---

### 2. **DESIGN_SYSTEM.md** ⭐⭐⭐⭐⭐
**คำอธิบาย:** ระบบดีไซน์ UI/UX ทั้งหมด
**เนื้อหา:**
- สีและ Theme
- Typography (ฟอนต์ภาษาไทย)
- Component styles
- Spacing และ Layout
- การใช้ Tailwind CSS

**🎯 ใช้เมื่อ:** ต้องการออกแบบหน้า UI ใหม่หรือแก้ไขสไตล์

---

### 3. **README_VRP.md** ⭐⭐⭐⭐
**คำอธิบาย:** ระบบจัดเส้นทางรถ (Vehicle Routing Problem)
**เนื้อหา:**
- อัลกอริทึมการจัดเส้นทาง (Insertion Heuristic, Clarke-Wright, Nearest Neighbor)
- การใช้งาน VRP API
- การตั้งค่า Optimization
- ข้อจำกัดต่างๆ (น้ำหนัก, ปริมาตร, เวลา)

**🎯 ใช้เมื่อ:** ทำงานกับระบบจัดเส้นทางส่งของ

---

### 4. **docs-archive/workflow/WORKFLOW_STATUS_DESIGN.md** ⭐⭐⭐⭐
**คำอธิบาย:** การออกแบบระบบสถานะแบบอัตโนมัติ (Workflow)
**เนื้อหา:**
- Flow ของสถานะ Order (draft → confirmed → in_picking → picked → loaded → in_transit → delivered)
- Flow ของ Route Plan
- Database Triggers ทั้ง 6 ตัว
- ความสัมพันธ์ระหว่าง Orders, Picklists, Loadlists, Route Plans

**🎯 ใช้เมื่อ:** ต้องการเข้าใจระบบสถานะการส่งของ

---

### 5. **docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md** ⭐⭐⭐⭐
**คำอธิบาย:** สรุปการ implement workflow ที่เสร็จแล้ว
**เนื้อหา:**
- Migration files ที่เกี่ยวข้อง (026-028)
- API endpoints ที่ถูกสร้าง
- Trigger functions ทั้งหมด
- ตัวอย่างการใช้งาน

**🎯 ใช้เมื่อ:** ต้องการดูรายละเอียดการ implement workflow

---

## 📖 เอกสารเฉพาะระบบย่อย

### Mobile System
- **docs-archive/mobile/MOBILE_RECEIVE_GUIDE.md** ⭐⭐⭐ - คู่มือระบบรับสินค้าบนมือถือ
- **docs-archive/mobile/MOBILE_TRANSFER_GUIDE.md** ⭐⭐⭐ - คู่มือระบบย้ายสินค้าบนมือถือ
- **docs-archive/mobile/INBOUND_ANALYSIS_FOR_MOBILE.md** ⭐⭐ - การวิเคราะห์ระบบรับสินค้า

### Stock Import
- **docs-archive/stock-import/STOCK_IMPORT_SUMMARY.md** ⭐⭐⭐ - สรุประบบนำเข้าสต็อก
- **docs-archive/stock-import/STOCK_IMPORT_PLAN.md** ⭐⭐ - แผนการพัฒนาระบบ

### Workflow System
- **docs-archive/workflow/WORKFLOW_QUICK_START.md** ⭐⭐⭐ - Quick start สำหรับ workflow
- **docs-archive/workflow/WORKFLOW_VERIFICATION_PROMPT.md** ⭐⭐ - การตรวจสอบ workflow

---

## 🗂️ เอกสารใน /docs (รายละเอียดเทคนิค)

### VRP System (Vehicle Routing)
- **docs/VRP_SYSTEM.md** - เอกสารระบบ VRP แบบละเอียด
- **docs/VRP_CHANGELOG.md** - ประวัติการแก้ไข VRP
- **docs/VRP_EXAMPLES.md** - ตัวอย่างการใช้งาน VRP
- **docs/VRP_VEHICLE_LIMIT_FEATURE.md** - ฟีเจอร์จำกัดจำนวนรถ
- **docs/VRP_VEHICLE_LIMIT_EXAMPLE.md** - ตัวอย่างการจำกัดรถ

### Order System
- **docs/ORDER_IMPORT_SUMMARY.md** - สรุประบบนำเข้า Order
- **docs/ORDER_IMPORT_ANALYSIS.md** - การวิเคราะห์ระบบ

### Database
- **docs/DATABASE_SETUP.md** - การติดตั้ง Database
- **docs/INVENTORY_BALANCE_SYNC.md** - ระบบ sync ยอด inventory
- **docs/SHIPPING_COST_CALCULATION.md** - การคำนวณค่าขนส่ง

---

## 🔧 เอกสาร Migration และ Build

### Migration
- **docs-archive/migration/MIGRATION_INSTRUCTIONS.md** ⭐⭐⭐ - คำแนะนำการทำ migration
- **docs-archive/migration/MIGRATION_REPORT.md** - รายงานการ migrate
- **docs-archive/migration/MIGRATION_AUDIT_REPORT.md** - ตรวจสอบ migration
- **docs-archive/migration/RUN_VRP_MIGRATION.md** - วิธีรัน VRP migration

### Build & Development
- **docs-archive/build-reports/BUILD_SUCCESS_REPORT.md** - รายงาน build สำเร็จ
- **README.md** - README หลักของโปรเจค
- **docs-archive/build-reports/CHANGELOG_20241111.md** - บันทึกการเปลี่ยนแปลง

---

## 🧪 เอกสารสำหรับ Development

### Analysis & Templates
- **analysis/inbound_page_analysis.md** - วิเคราะห์หน้า inbound
- **docs-archive/mobile/TRANSFER_ANALYSIS_FOR_MOBILE.md** - วิเคราะห์ระบบ transfer
- **docs-archive/analysis/DEVELOPMENT_CONTEXT_TEMPLATE.md** - Template สำหรับเขียน context

---

## 🤖 เอกสาร AI/Agent Config

### Claude Agents (.claude/agents/kfc/)
- **spec-design.md** - Agent สำหรับออกแบบ spec
- **spec-impl.md** - Agent สำหรับ implement
- **spec-judge.md** - Agent สำหรับประเมิน spec
- **spec-requirements.md** - Agent สำหรับเขียน requirements
- **spec-tasks.md** - Agent สำหรับจัดการ tasks
- **spec-test.md** - Agent สำหรับเขียน test
- **spec-system-prompt-loader.md** - Loader สำหรับ prompts

### System Prompts
- **.claude/system-prompts/spec-workflow-starter.md** - Prompt เริ่มต้น workflow

### Other AI Config
- **GEMINI.md** - Configuration สำหรับ Gemini AI

---

## 🎨 เอกสาร Kiro (.kiro/steering/)
- **product.md** - Product steering guide
- **structure.md** - โครงสร้างโปรเจค
- **tech.md** - Technical steering

---

## 📦 เอกสารเบ็ดเทล็ด

### Audio Files
- **public/audio/README.md** - คำอธิบายไฟล์เสียง
- **public/audio/tap.mp3.md** - ข้อมูลเสียง tap

---

## 🎯 แนะนำการอ่านตามบทบาท

### 👨‍💻 สำหรับ Developer ใหม่
1. **CLAUDE.md** - เข้าใจโครงสร้างโปรเจค
2. **DESIGN_SYSTEM.md** - เรียนรู้ระบบ UI
3. **README.md** - วิธีเริ่มต้นโปรเจค
4. **docs/DATABASE_SETUP.md** - ติดตั้ง Database

### 🚚 สำหรับคนทำ Logistics/Routes
1. **docs-archive/vrp/README_VRP.md** - เข้าใจระบบจัดเส้นทาง
2. **docs-archive/workflow/WORKFLOW_STATUS_DESIGN.md** - เข้าใจ flow การส่งของ
3. **docs/VRP_EXAMPLES.md** - ดูตัวอย่างการใช้งาน
4. **docs/SHIPPING_COST_CALCULATION.md** - วิธีคำนวณค่าขนส่ง

### 📱 สำหรับคนทำ Mobile
1. **docs-archive/mobile/MOBILE_RECEIVE_GUIDE.md** - ระบบรับสินค้า
2. **docs-archive/mobile/MOBILE_TRANSFER_GUIDE.md** - ระบบย้ายสินค้า
3. **docs-archive/mobile/INBOUND_ANALYSIS_FOR_MOBILE.md** - วิเคราะห์ระบบ

### 🗃️ สำหรับคนทำ Database/Backend
1. **docs-archive/migration/MIGRATION_INSTRUCTIONS.md** - วิธีทำ migration
2. **docs/DATABASE_SETUP.md** - Setup database
3. **docs/INVENTORY_BALANCE_SYNC.md** - ระบบ sync inventory
4. **docs-archive/workflow/WORKFLOW_IMPLEMENTATION_SUMMARY.md** - Triggers และ workflow

---

## ⚠️ หมายเหตุสำคัญ

1. **อย่าลบ** ไฟล์ .md ใดๆ โดยไม่ปรึกษาทีม เพราะอาจมีข้อมูลสำคัญ
2. **อัปเดตเอกสาร** เมื่อมีการเปลี่ยนแปลงระบบสำคัญ
3. **ใช้ CLAUDE.md เป็นหลัก** เมื่อต้องการ overview ของโปรเจค
4. **ตรวจสอบวันที่** ในเอกสารเพื่อดูว่าเป็น version ล่าสุดหรือไม่

---

## 📌 เอกสารที่ควรอัปเดตบ่อย

- ✅ **CLAUDE.md** - เมื่อมี feature ใหม่
- ✅ **docs-archive/build-reports/CHANGELOG_*.md** - ทุกครั้งที่ release
- ✅ **docs-archive/workflow/WORKFLOW_*.md** - เมื่อแก้ไข workflow
- ✅ **docs/VRP_CHANGELOG.md** - เมื่อแก้ VRP

---

**Last Updated:** 2025-01-23
**Total Documents:** 44 files
**Maintained by:** Development Team
