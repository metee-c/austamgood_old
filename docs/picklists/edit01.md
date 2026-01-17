# 🔍 Full System Analysis: Picklist, Face Sheet & Loadlist Module

## 📋 ภาพรวมของงาน
ฉันต้องการให้คุณวิเคราะห์ระบบการสร้างใบหยิบ (Picklist), ใบปะหน้า (Face Sheet), และใบโหลด (Loadlist) อย่างละเอียดทุกมิติ เนื่องจากระบบที่ deploy จริงมี bug เยอะมาก โดยเฉพาะเรื่อง **สต็อกไม่พอ**

---

## 🎯 หน้าที่ต้องวิเคราะห์

### 1. หน้าสร้างใบหยิบ (Picklist)
- **URL:** `http://localhost:3000/receiving/picklists`
- **วัตถุประสงค์:** สร้างใบหยิบจากออเดอร์ประเภท "จัดเส้นทาง" → นำไปจัดเส้นทาง → เอาแผนจัดเส้นทางมาออกใบหยิบ

### 2. หน้าสร้างใบปะหน้า (Face Sheet)
- **URL:** `http://localhost:3000/receiving/picklists/face-sheets`
- **วัตถุประสงค์:** สร้างใบปะหน้าจากออเดอร์ประเภท "ส่งรายชิ้น"

### 3. หน้าสร้างใบปะหน้าของแถม (Bonus Face Sheet)
- **URL:** `http://localhost:3000/receiving/picklists/bonus-face-sheets`
- **วัตถุประสงค์:** สร้างใบปะหน้าของแถมจากออเดอร์ประเภท "พิเศษ"

### 4. หน้าสร้างใบโหลด (Loadlist)
- **URL:** `http://localhost:3000/receiving/loadlists`
- **วัตถุประสงค์:** สร้างใบโหลดของทุกประเภท (ใบหยิบ, ใบปะหน้า, ใบปะหน้าของแถม)

### 5. หน้ายืนยันหยิบ (Mobile Pick) - มี Bug
- **URL:** `http://localhost:3000/mobile/pick`
- **ปัญหา:** Bug เรื่องสต็อกไม่พอ

### 6. หน้ายืนยันย้าย/โหลด (Mobile Loading) - มี Bug
- **URL:** `http://localhost:3000/mobile/loading`
- **ปัญหา:** Bug เรื่องสต็อกไม่พอ

---

## 🔬 สิ่งที่ต้องวิเคราะห์อย่างละเอียด

### A. Frontend Analysis
1. **Page Components**
   - วิเคราะห์ทุก React/Vue component ที่ใช้ในแต่ละหน้า
   - ดู props, state, hooks ที่ใช้
   - ดู lifecycle และการ render

2. **UI Elements**
   - ทุกปุ่ม (Button) - onClick handler ทำอะไรบ้าง
   - ทุก Form - validation rules, submit logic
   - ทุก Table/List - data binding, pagination, sorting
   - ทุก Modal/Dialog - เปิด/ปิดเมื่อไหร่, ทำอะไร
   - ทุก Filter/Search - query parameters ที่ส่งไป

3. **State Management**
   - Global state (Redux/Vuex/Zustand/etc.)
   - Local state
   - การ sync state ระหว่าง component

4. **API Calls**
   - ทุก API endpoint ที่เรียก
   - Request payload structure
   - Response handling
   - Error handling
   - Loading states

### B. Backend Analysis
1. **API Routes/Controllers**
   - ทุก endpoint ที่เกี่ยวข้อง
   - HTTP methods (GET/POST/PUT/DELETE)
   - Request validation
   - Authentication/Authorization

2. **Business Logic/Services**
   - Logic การสร้างใบหยิบ
   - Logic การจัดเส้นทาง
   - Logic การสร้างใบปะหน้า
   - Logic การสร้างใบโหลด
   - **⚠️ Logic การตรวจสอบสต็อก (สำคัญมาก!)**
   - Logic การหักสต็อก
   - Logic การคืนสต็อก

3. **Stock Management Logic**
   - เมื่อไหร่ reserve stock?
   - เมื่อไหร่ deduct stock?
   - เมื่อไหร่ release stock?
   - Race condition handling
   - Transaction management

### C. Database Analysis
1. **Models/Entities**
   - ทุก Model ที่เกี่ยวข้อง (Picklist, FaceSheet, Loadlist, Order, Stock, etc.)
   - Fields และ data types
   - Indexes
   - Constraints

2. **Relationships**
   - One-to-One relationships
   - One-to-Many relationships
   - Many-to-Many relationships
   - Foreign keys
   - Cascade rules

3. **Schema Diagram**
   - สร้าง ER Diagram แสดงความสัมพันธ์

4. **Stock-Related Tables**
   - ตารางสต็อกหลัก
   - ตาราง stock movement/transaction
   - ตาราง reserved stock
   - ตาราง stock location

### D. Data Flow Analysis
1. **สร้างใบหยิบ Flow**
```
   ออเดอร์ประเภทจัดเส้นทาง → จัดเส้นทาง → สร้างใบหยิบ → ?
```

2. **สร้างใบปะหน้า Flow**
```
   ออเดอร์ประเภทส่งรายชิ้น → สร้างใบปะหน้า → ?
```

3. **สร้างใบปะหน้าของแถม Flow**
```
   ออเดอร์ประเภทพิเศษ → สร้างใบปะหน้าของแถม → ?
```

4. **สร้างใบโหลด Flow**
```
   ใบหยิบ/ใบปะหน้า/ใบปะหน้าของแถม → สร้างใบโหลด → ?
```

5. **ยืนยันหยิบ Flow**
```
   Scan → ตรวจสอบสต็อก → หักสต็อก → อัพเดทสถานะ → ?
```

6. **ยืนยันย้าย/โหลด Flow**
```
   Scan → ตรวจสอบ → ย้ายสต็อก → อัพเดทสถานะ → ?
```

---

## 🐛 Bug Analysis Focus

### สต็อกไม่พอ - Deep Dive
1. **จุดที่ตรวจสอบสต็อก**
   - ตรวจสอบตอนไหนบ้าง?
   - Query ที่ใช้ตรวจสอบ
   - มีการ lock row หรือไม่?

2. **Race Condition**
   - หลายคนหยิบพร้อมกันได้หรือไม่?
   - มี optimistic/pessimistic locking?
   - Transaction isolation level?

3. **Stock Calculation**
   - คำนวณ available stock อย่างไร?
   - `available = on_hand - reserved - committed`?
   - มี negative stock ได้หรือไม่?

4. **Timing Issues**
   - สต็อกถูก reserve ตอนสร้างใบหยิบ?
   - สต็อกถูกหักตอนยืนยันหยิบ?
   - มี gap ระหว่าง check กับ deduct?

---

## 📁 Files to Analyze

ให้ใช้ MCP tools เพื่อ:

1. **List และ Read ไฟล์ Frontend**
   - Pages/Views ที่เกี่ยวข้อง
   - Components ที่ใช้
   - API service files
   - Store/State files

2. **List และ Read ไฟล์ Backend**
   - Routes/Controllers
   - Services/Business Logic
   - Models/Entities
   - Middleware
   - Validators

3. **Database**
   - Migration files
   - Schema files
   - Seed files

---

## 📊 Output ที่ต้องการ

### 1. System Overview Document
- สรุปภาพรวมของระบบ
- Flowchart ของแต่ละ process

### 2. Database Schema Document
- ER Diagram
- รายละเอียดแต่ละ table
- Relationships

### 3. API Documentation
- ทุก endpoint ที่เกี่ยวข้อง
- Request/Response format

### 4. Component Tree
- Hierarchy ของ components
- Data flow ระหว่าง components

### 5. Bug Analysis Report
- Root cause ของปัญหาสต็อกไม่พอ
- จุดที่มีปัญหา
- แนะนำวิธีแก้ไข

### 6. Stock Flow Diagram
- แสดง stock movement ตลอด lifecycle
- จุดที่ reserve/deduct/release stock

---

## 🚀 เริ่มต้นการวิเคราะห์

กรุณาเริ่มจาก:

1. **สำรวจ Project Structure**
   - ดูโครงสร้าง folder ของ frontend และ backend

2. **หา Entry Points**
   - หาไฟล์ที่เป็น page/route สำหรับแต่ละ URL

3. **Trace ไปหา Dependencies**
   - Components → Services → API → Database

4. **Focus on Stock Logic**
   - หา code ที่เกี่ยวกับการจัดการ stock ทั้งหมด

เริ่มต้นเลย! ใช้ MCP tools ในการอ่านไฟล์และวิเคราะห์ code อย่างละเอียด