# Auto-fill ทะเบียนรถและคนขับในฟอร์มสร้างใบโหลด

## การแก้ไขที่ทำ

### 1. แก้ไข Frontend (`app/receiving/loadlists/page.tsx`)

เพิ่ม useEffect ที่จะดึงข้อมูลจาก picklist ที่เลือกมาตั้งค่าเริ่มต้น:

```typescript
// Auto-fill form fields from selected picklists
useEffect(() => {
  if (selectedPicklists.length > 0 && availablePicklists.length > 0) {
    // Get the first selected picklist
    const firstSelectedPicklist = availablePicklists.find(p => p.id === selectedPicklists[0]);
    
    if (firstSelectedPicklist) {
      // Set loading door number from picklist
      if (firstSelectedPicklist.loading_door_number && !loadingDoorNumber) {
        setLoadingDoorNumber(firstSelectedPicklist.loading_door_number);
      }
      
      // Set vehicle and driver from trip
      if (firstSelectedPicklist.trip) {
        // Set vehicle if available
        if (firstSelectedPicklist.trip.vehicle_id && !vehicleId) {
          setVehicleId(String(firstSelectedPicklist.trip.vehicle_id));
        }
        
        // Set driver if available
        if (firstSelectedPicklist.trip.driver_id && !driverEmployeeId) {
          setDriverEmployeeId(firstSelectedPicklist.trip.driver_id);
        }
      }
    }
  }
}, [selectedPicklists, availablePicklists]);
```

อัพเดท interface `AvailablePicklist` ให้มี `vehicle_id` และ `driver_id`:

```typescript
interface AvailablePicklist {
  // ... existing fields
  trip?: {
    trip_id: number;
    trip_code: string;
    vehicle_id?: number;  // เพิ่ม
    driver_id?: number;   // เพิ่ม
    vehicle?: {
      plate_number: string;
    };
    driver_name?: string;
  };
}
```

### 2. แก้ไข API (`app/api/loadlists/available-picklists/route.ts`)

เพิ่ม `vehicle_id` และ `driver_id` ใน response:

```typescript
return {
  // ... existing fields
  trip: {
    trip_id: picklist.trip?.trip_id,
    trip_code: picklist.trip?.trip_code || '-',
    vehicle_id: picklist.trip?.vehicle_id,  // เพิ่ม
    driver_id: picklist.trip?.driver_id,    // เพิ่ม
    vehicle: {
      plate_number: picklist.trip?.vehicle?.plate_number || '-'
    },
    driver_name: driverName
  }
};
```

## การทำงาน

1. **เมื่อเปิดฟอร์มสร้างใบโหลด**: ระบบจะดึงรายการ picklist ที่พร้อมสร้างใบโหลด
2. **เมื่อเลือก picklist**: useEffect จะทำงานและดึงข้อมูลจาก picklist แรกที่เลือก:
   - `loading_door_number` จาก picklist
   - `vehicle_id` จาก trip
   - `driver_id` จาก trip
3. **แสดงค่าเริ่มต้น**: ข้อมูลจะถูกแสดงใน dropdown ทั้ง 3 ช่อง
4. **สามารถแก้ไขได้**: ผู้ใช้สามารถเปลี่ยนค่าได้ตามต้องการ

## ขั้นตอนทดสอบ

1. **Refresh browser** (Ctrl + Shift + R)
2. ไปที่ http://localhost:3000/receiving/loadlists
3. คลิก "สร้างใบโหลดใหม่"
4. เลือก picklist อย่างน้อย 1 รายการ
5. ตรวจสอบว่า:
   - ประตูโหลด แสดงค่าที่บันทึกไว้
   - ทะเบียนรถ แสดงรถที่เลือกไว้
   - คนขับ แสดงคนขับที่เลือกไว้
6. ลองเปลี่ยนค่าใน dropdown
7. สร้างใบโหลด
8. ตรวจสอบว่าข้อมูลถูกบันทึกถูกต้อง

## หมายเหตุ

- ระบบจะใช้ข้อมูลจาก **picklist แรก** ที่เลือก
- ถ้า picklist ไม่มีข้อมูล vehicle หรือ driver ระบบจะไม่ตั้งค่าเริ่มต้น
- ผู้ใช้สามารถแก้ไขค่าได้ทุกเมื่อก่อนสร้างใบโหลด
- ข้อมูลที่บันทึกที่หน้า Routes (ฟอร์มแก้ไขราคาค่าขนส่ง) จะถูกนำมาแสดงอัตโนมัติ

## ไฟล์ที่แก้ไข

- `app/receiving/loadlists/page.tsx` - เพิ่ม useEffect และอัพเดท interface
- `app/api/loadlists/available-picklists/route.ts` - เพิ่ม vehicle_id และ driver_id ใน response
