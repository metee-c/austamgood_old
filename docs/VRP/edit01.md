# 🔍 Full System Analysis Request: /receiving/routes

## 📋 Objective
วิเคราะห์หน้า http://localhost:3000/receiving/routes อย่างละเอียดทุกมิติ เนื่องจากหน้านี้มี bugs เยอะมากใน production

---

## 🛠️ ขั้นตอนการวิเคราะห์

### 1. 📂 สำรวจโครงสร้างโปรเจค
ใช้ MCP tools สำรวจโครงสร้างทั้งหมดก่อน:
- ดูโครงสร้าง folder ทั้งหมด
- หา files ที่เกี่ยวข้องกับ "receiving" และ "routes"
- ระบุ tech stack ที่ใช้ (React/Vue/Next.js, Express/NestJS, PostgreSQL/MongoDB etc.)

### 2. 🎨 Frontend Analysis
วิเคราะห์ Frontend อย่างละเอียด:

#### 2.1 Components
- หา component หลักของหน้า receiving/routes
- วิเคราะห์ทุก child components
- ดู props ที่ส่งผ่านระหว่าง components
- ตรวจสอบ state management (Redux/Zustand/Context)

#### 2.2 UI Elements
- **ทุกปุ่ม**: ระบุทุกปุ่ม พร้อม function ที่เรียก และ expected behavior
- **ทุก form**: ระบุ fields, validation rules, submit handlers
- **ทุก table/list**: ระบุ columns, sorting, filtering, pagination
- **ทุก modal/dialog**: ระบุ trigger conditions และ content

#### 2.3 State & Data Flow
- Initial state เป็นอย่างไร
- Data fetching เกิดขึ้นตอนไหน (useEffect, onMount)
- State updates เกิดขึ้นอย่างไร
- Error handling มีครบไหม

### 3. 🔌 API & Backend Analysis
วิเคราะห์ Backend ทั้งหมดที่เกี่ยวข้อง:

#### 3.1 API Endpoints
ระบุทุก API ที่หน้านี้เรียกใช้:
- GET endpoints (list, detail)
- POST endpoints (create)
- PUT/PATCH endpoints (update)
- DELETE endpoints

สำหรับแต่ละ endpoint ระบุ:
- URL pattern
- Request parameters/body schema
- Response schema
- Error responses

#### 3.2 Controllers/Handlers
- ดู logic ใน controller
- ดู validation ที่ backend
- ดู business logic
- ดู error handling

#### 3.3 Services/Use Cases
- ดู service layer
- ดู business rules
- ดู transactions

### 4. 🗄️ Database Analysis
วิเคราะห์ Database ที่เกี่ยวข้อง:

#### 4.1 Models/Entities
ระบุทุก model ที่เกี่ยวข้อง:
- Model name
- Fields ทั้งหมด (name, type, constraints)
- Indexes
- Default values

#### 4.2 Relationships
สร้าง diagram แสดง:
- One-to-One relationships
- One-to-Many relationships  
- Many-to-Many relationships
- Foreign keys

#### 4.3 Queries
- ดู queries ที่ใช้
- มี N+1 problem ไหม
- มี slow queries ไหม
- Indexes เหมาะสมไหม

### 5. 🔄 Complete Flow Mapping
สร้าง flow diagram สำหรับทุก user action:
```
User Action → Frontend Event → API Call → Controller → Service → Database → Response → UI Update
```

ทำสำหรับ:
- [ ] การโหลดหน้าครั้งแรก (Initial Load)
- [ ] การสร้างข้อมูลใหม่ (Create)
- [ ] การแก้ไขข้อมูล (Update)
- [ ] การลบข้อมูล (Delete)
- [ ] การค้นหา/กรอง (Search/Filter)
- [ ] การ pagination
- [ ] ทุก action อื่นๆ ที่มี

### 6. 🐛 Bug Detection Checklist
ตรวจสอบ common bugs:

#### Frontend
- [ ] Race conditions ใน async operations
- [ ] Memory leaks (useEffect cleanup)
- [ ] Stale state/closure issues
- [ ] Missing error boundaries
- [ ] Missing loading states
- [ ] Missing empty states
- [ ] Incorrect dependency arrays
- [ ] Unhandled promise rejections

#### Backend
- [ ] Missing input validation
- [ ] SQL/NoSQL injection vulnerabilities
- [ ] Missing authentication/authorization checks
- [ ] Incorrect error status codes
- [ ] Missing transaction handling
- [ ] Race conditions in concurrent requests
- [ ] Missing rate limiting

#### Database
- [ ] Missing indexes for frequent queries
- [ ] Incorrect foreign key constraints
- [ ] Missing cascade rules
- [ ] Data type mismatches
- [ ] Missing NOT NULL constraints where needed

### 7. 📊 Output Format
สรุปผลการวิเคราะห์ในรูปแบบ:
```markdown
## Summary Report

### 1. Architecture Overview
[Diagram และคำอธิบาย]

### 2. File Mapping
| Layer | Files | Purpose |
|-------|-------|---------|
| Frontend | ... | ... |
| Backend | ... | ... |
| Database | ... | ... |

### 3. Data Flow Diagrams
[Mermaid diagrams for each flow]

### 4. Model Relationships
[ER Diagram]

### 5. Identified Issues
| # | Location | Type | Severity | Description | Suggested Fix |
|---|----------|------|----------|-------------|---------------|
| 1 | ... | ... | Critical/High/Medium/Low | ... | ... |

### 6. Recommendations
[รายการแนะนำการแก้ไข เรียงตาม priority]
```

---

## ⚠️ Important Notes
- อ่านทุก file ที่เกี่ยวข้องอย่างละเอียด อย่าข้าม
- ถ้าเจอ import/reference ไปยัง file อื่น ให้ตามไปดูด้วย
- สังเกต patterns ที่อาจก่อให้เกิด bugs
- ให้ความสำคัญกับ edge cases
- ตรวจสอบ consistency ระหว่าง frontend และ backend schemas

## 🚀 เริ่มต้น
เริ่มจากการใช้ MCP tools เพื่อ:
1. `list_directory` ดูโครงสร้างโปรเจค
2. หา files ที่มีคำว่า "receiving" หรือ "routes"
3. เริ่มอ่านและวิเคราะห์ทีละ layer