# วิธีแก้ไข 404 Error สำหรับ /api/moves/quick-move

## สาเหตุ
- มี Node.js processes หลายตัวรันอยู่พร้อมกัน
- Next.js cache ไม่ได้ refresh
- Dev server ไม่ได้ load API route ใหม่

## การแก้ไขที่ทำแล้ว
✅ ลบ `.next` cache folder
✅ Kill Node.js processes ทั้งหมด
✅ Build project ใหม่

## ขั้นตอนต่อไป (สำหรับ User)

### 1. รัน Dev Server ใหม่
```bash
npm run dev
```

### 2. รอจนกว่า Server จะพร้อม
คุณจะเห็นข้อความ:
```
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

### 3. ทดสอบย้ายสินค้า
- เปิด http://localhost:3000/mobile/transfer
- สแกน Pallet ID: ATG20260122000000039
- เลือก Location: B10-05-001
- กดบันทึก

## หากยังเกิด 404 อีก

### ตรวจสอบว่า API route มีอยู่จริง:
```bash
dir app\api\moves\quick-move\route.ts
```

### ตรวจสอบ Dev Server logs:
ดูใน terminal ว่ามี error อะไรหรือไม่

### Hard Refresh Browser:
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

## สรุป
ไฟล์ `app/api/moves/quick-move/route.ts` มีอยู่และถูกต้องแล้ว
แค่ต้องรัน dev server ใหม่เพื่อให้ Next.js load route นี้ขึ้นมา
