# แก้ไข 404 Error: POST /api/moves/quick-move

## ปัญหา
เมื่อย้ายสินค้าที่หน้า `/mobile/transfer` เกิด error:
```
POST http://localhost:3000/api/moves/quick-move 404 (Not Found)
```

## สาเหตุ
1. **Multiple Node Processes**: มี Node.js processes หลายตัวรันอยู่พร้อมกัน (พบ 11 processes)
2. **Stale Cache**: Next.js `.next` folder มี cache เก่าที่ไม่ตรงกับ source code
3. **Route Not Loaded**: Dev server ไม่ได้ load API route ใหม่หลังจากแก้ไขโค้ด

## การแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบไฟล์
```bash
# ตรวจสอบว่าไฟล์มีอยู่
dir app\api\moves\quick-move\route.ts
```

ผลลัพธ์: ✅ ไฟล์มีอยู่และถูกต้อง

### ขั้นตอนที่ 2: ล้าง Cache และ Kill Processes
```bash
# ลบ .next cache
Remove-Item -Path ".next" -Recurse -Force

# Kill Node processes ทั้งหมด
Stop-Process -Name "node" -Force
```

### ขั้นตอนที่ 3: Build ใหม่
```bash
npm run build
```

ผลลัพธ์: ✅ Build สำเร็จ

### ขั้นตอนที่ 4: รัน Dev Server ใหม่
```bash
npm run dev
```

รอจนกว่าจะเห็นข้อความ:
```
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

### ขั้นตอนที่ 5: ทดสอบ
1. เปิด http://localhost:3000/mobile/transfer
2. สแกน Pallet ID
3. เลือก Location ปลายทาง
4. กดบันทึก

## ข้อมูลเพิ่มเติม

### API Route Details
- **Path**: `app/api/moves/quick-move/route.ts`
- **Method**: POST
- **Function**: `executeQuickMove()`
- **Features**:
  - รองรับ offline mode
  - Validation picking home
  - Capacity checking
  - Auto-generate move_no with retry logic

### Related Files
- `hooks/useOfflineTransfer.ts` - Hook ที่เรียก API
- `app/mobile/transfer/page.tsx` - หน้า UI
- `lib/offline/transfer-cache.ts` - Offline cache management

## การป้องกันปัญหาในอนาคต

### 1. ใช้ Single Dev Server
อย่ารัน `npm run dev` หลายครั้งพร้อมกัน

### 2. Kill Processes ก่อนรันใหม่
```bash
# Windows
Stop-Process -Name "node" -Force

# หรือใช้ Task Manager
```

### 3. Clear Cache เมื่อมีปัญหา
```bash
Remove-Item -Path ".next" -Recurse -Force
npm run build
```

### 4. ตรวจสอบ Port
ถ้า port 3000 ถูกใช้งานอยู่:
```bash
# ดู process ที่ใช้ port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

## สรุป
ปัญหา 404 เกิดจาก Next.js cache และ multiple Node processes ไม่ใช่เพราะไฟล์หายหรือโค้ดผิด หลังจากล้าง cache และรัน dev server ใหม่ API route จะทำงานได้ปกติ
