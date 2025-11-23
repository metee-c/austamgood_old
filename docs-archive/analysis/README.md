# 🔍 Analysis & Templates

เอกสารการวิเคราะห์และ templates สำหรับการพัฒนา

## เอกสารในโฟลเดอร์นี้

### Templates
- **DEVELOPMENT_CONTEXT_TEMPLATE.md** - Template สำหรับเขียน development context
  - โครงสร้าง context document
  - ส่วนประกอบที่ควรมี
  - ตัวอย่างการเขียน
  - Best practices

## ใช้เมื่อไหร่?

### สำหรับ Developer
ใช้เอกสารเหล่านี้เมื่อ:
- เริ่มพัฒนา feature ใหม่
- ต้องการเขียน documentation ที่มีโครงสร้างดี
- สร้าง context สำหรับ AI assistants
- วิเคราะห์ระบบก่อนแก้ไข

### สำหรับ Technical Writer
ใช้เอกสารเหล่านี้เมื่อ:
- เขียนเอกสารทางเทคนิค
- สร้าง template สำหรับทีม
- จัดโครงสร้างเอกสาร

## Development Context Best Practices

### 1. โครงสร้างที่ดี
```markdown
# Feature Name

## Overview
- จุดประสงค์
- ปัญหาที่แก้
- Solution overview

## Technical Details
- Architecture
- Database schema
- API endpoints
- Components

## Implementation Notes
- Step-by-step guide
- Code examples
- Common patterns

## Testing
- Test cases
- Edge cases
- Expected behavior

## References
- Related files
- Related documentation
- External resources
```

### 2. ข้อมูลที่ควรมี
- **Problem Statement** - ปัญหาที่ต้องแก้อย่างชัดเจน
- **Solution** - วิธีแก้และเหตุผลที่เลือก
- **Code Examples** - ตัวอย่าง code ที่ใช้งานได้จริง
- **Database Schema** - ถ้ามีการเปลี่ยนแปลง database
- **API Contracts** - Request/Response format
- **UI/UX Notes** - ถ้ามีส่วนที่เกี่ยวข้อง

### 3. สิ่งที่ควรหลีกเลี่ยง
- ❌ เอกสารที่ยาวเกินไปจนอ่านยาก
- ❌ ข้อมูลที่ล้าสมัย (outdated)
- ❌ Code examples ที่ไม่ทำงาน
- ❌ คำอธิบายที่คลุมเครือ

## Template Usage

### สำหรับ Feature ใหม่
1. Copy template
2. กรอกข้อมูลตามหัวข้อ
3. เพิ่ม code examples
4. Review และ update ก่อน commit

### สำหรับ Bug Fix
1. อธิบายปัญหา (Problem)
2. อธิบายสาเหตุ (Root Cause)
3. อธิบายวิธีแก้ (Solution)
4. ใส่ test case ที่ครอบคลุม

### สำหรับ Refactoring
1. อธิบายเหตุผลที่ต้อง refactor
2. แสดง before/after code
3. อธิบายผลกระทบ (impact)
4. Migration plan (ถ้ามี)

## เอกสารที่เกี่ยวข้อง

- `CLAUDE.md` - Context หลักสำหรับ AI assistant
- `DESIGN_SYSTEM.md` - Design patterns และ UI guidelines
- `docs/` - Technical documentation
- `.claude/` - Claude-specific configuration
