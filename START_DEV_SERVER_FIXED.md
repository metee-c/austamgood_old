# วิธีแก้ไข API Route 404 Error และ Start Dev Server

## ปัญหา
```
POST http://localhost:3000/api/moves/quick-move 404 (Not Found)
```

## สาเหตุ
- ไฟล์ `app/api/moves/quick-move/route.ts` มีอยู่และถูกต้อง
- แต่ Next.js dev server ไม่ได้ load API route ใหม่
- มี `.next` cache folder ที่อาจมี cache เก่า
- มี Node.js processes หลายตัวรันอยู่พร้อมกัน

## วิธีแก้ไข (แบบอัตโนมัติ)

### Windows PowerShell
```powershell
# รัน script อัตโนมัติ
.\restart-dev-server.ps1

# หรือรันและ start dev server ทันที
.\restart-dev-server.ps1 -StartServer
```

## วิธีแก้ไข (แบบ Manual)

### Step 1: Kill Node.js Processes
```powershell
Get-Process node | Stop-Process -Force
```

### Step 2: ลบ .next Cache
```powershell
Remove-Item -Recurse -Force .next
```

### Step 3: Build Project
```powershell
npm run build
```

### Step 4: Start Dev Server
```powershell
npm run dev
```

## ตรวจสอบว่าแก้ไขสำเร็จ

1. เปิด http://localhost:3000/mobile/transfer
2. สแกน Pallet (เช่น ATG20260122000000039)
3. เลือก destination location
4. กดปุ่ม "ย้ายสินค้า"
5. ตรวจสอบว่าไม่มี error 404

## หมายเหตุ

- ถ้ายังเจอ error 404 อยู่ ให้ลอง:
  1. ปิด browser และเปิดใหม่
  2. Clear browser cache (Ctrl+Shift+Delete)
  3. ลอง incognito mode

- ถ้ายังไม่ได้ ให้ตรวจสอบ:
  1. ไฟล์ `app/api/moves/quick-move/route.ts` มีอยู่หรือไม่
  2. Console log ใน terminal ที่รัน dev server
  3. Network tab ใน browser DevTools

## เอกสารที่เกี่ยวข้อง

- `docs/warehouse/API_404_FIX.md` - รายละเอียดการแก้ไข API 404
- `docs/warehouse/CURRENT_STATUS_20260122.md` - สถานะปัจจุบันของระบบ
