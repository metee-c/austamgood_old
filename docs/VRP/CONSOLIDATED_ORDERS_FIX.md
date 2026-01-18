# Consolidated Orders Display Fix

## Problem Summary
เมื่อ VRP algorithm รวมออเดอร์หลายรายการเป็น 1 stop (consolidated stop) UI แสดงเฉพาะเลขออเดอร์หลักเพียงรายการเดียว ทั้งที่น้ำหนักรวมตรงกับออเดอร์ทั้งหมด

### ตัวอย่างปัญหา
- แผน 253 มี 5 ออเดอร์ (IV27010941-944, IV27010947)
- VRP รวมเป็น 2 stops:
  - Stop 3117: รวม 2 ออเดอร์ (IV27010942 + IV27010941) - 1,362.4 kg
  - Stop 3118: รวม 3 ออเดอร์ (IV27010944 + IV27010943 + IV27010947) - 3,222 kg
- แต่ UI แสดงแค่ 2 เลขออเดอร์ (primary orders เท่านั้น)

## Root Cause
1. **VRP Algorithm** บันทึก consolidated orders ใน `stop.tags.order_ids` array
2. **API** (`/api/route-plans/[id]/editor/route.ts`) ดึงข้อมูลออเดอร์ทั้งหมดและสร้าง `stop.orders` array
3. **UI Components** แสดงเฉพาะ `stop.order_no` (primary order) แทนที่จะแสดงทั้ง array

## Solution Implemented

### 1. Preview Modal Table (✅ Fixed)
**File:** `app/receiving/routes/page.tsx` (lines ~2580)

**Before:**
```tsx
{trip.stops.flatMap((stop: any) => {
  const orderRows = stop.orders || [{ order_no: stop.order_no }];
  return orderRows.map((order) => (
    <tr>
      <td>{order.order_no}</td>  // แสดงแยกแถว
    </tr>
  ));
})}
```

**After:**
```tsx
{trip.stops.map((stop: any) => {
  const orderNumbers = stop.orders
    ? stop.orders.map(o => o.order_no).join(', ')
    : stop.order_no;
  const isConsolidated = stop.orders?.length > 1;
  
  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span>{orderNumbers}</span>  // แสดงทุกเลขในแถวเดียว
          {isConsolidated && (
            <span className="badge">{stop.orders.length} ออเดอร์</span>
          )}
        </div>
      </td>
    </tr>
  );
})}
```

**Changes:**
- เปลี่ยนจาก `flatMap` (แยกแถว) เป็น `map` (แถวเดียว)
- แสดงเลขออเดอร์ทั้งหมดคั่นด้วย comma (เช่น "IV27010941, IV27010942")
- เพิ่ม badge แสดงจำนวนออเดอร์ที่รวมกัน (เช่น "2 ออเดอร์")
- รวมน้ำหนักจาก `orders` array แทนที่จะใช้ `stop.load_weight_kg`

### 2. Route Map Popup (✅ Already Fixed)
**File:** `components/maps/StopDetailPopup.tsx`

**Status:** Component นี้รองรับ `stop.orders` array อยู่แล้ว
- แสดงเลขออเดอร์ทั้งหมดพร้อมน้ำหนักแต่ละรายการ
- แสดง badge "X ออเดอร์รวมกัน" เมื่อมีหลายออเดอร์
- มีปุ่มย้ายออเดอร์แยกสำหรับแต่ละรายการ

### 3. Excel Editor Table (✅ Enhanced)
**File:** `components/receiving/ExcelStyleRouteEditor.tsx` (lines ~960)

**Design Decision:** 
- เก็บการแสดงแยกแถวต่อออเดอร์ (เพื่อให้แก้ไขแต่ละออเดอร์ได้)
- เพิ่ม badge "รวม X" เพื่อบอกว่าออเดอร์นี้อยู่ใน consolidated stop

**Implementation:**
```tsx
<td className="border px-3 py-1 font-mono text-blue-600">
  <div className="flex items-center gap-2">
    <span>{row.orderNo}</span>
    {(() => {
      const sameStopOrders = rows.filter(r => 
        r.stopId === row.stopId && 
        r.tripNumber === row.tripNumber &&
        !r.isSplit
      );
      if (sameStopOrders.length > 1) {
        return (
          <span className="badge">รวม {sameStopOrders.length}</span>
        );
      }
    })()}
  </div>
</td>
```

## Data Flow

### 1. VRP Optimization
```javascript
// VRP algorithm creates consolidated stops
const stop = {
  stop_id: 3117,
  order_id: 10942,  // primary order
  tags: {
    order_ids: [10942, 10941],  // all orders
    input_ids: [1001, 1002]
  }
};
```

### 2. API Response
```javascript
// /api/route-plans/[id]/editor/route.ts
const stop = {
  stop_id: 3117,
  order_id: 10942,
  order_no: "IV27010942",
  orders: [
    {
      order_id: 10942,
      order_no: "IV27010942",
      allocated_weight_kg: 700.0,
      items: [...]
    },
    {
      order_id: 10941,
      order_no: "IV27010941",
      allocated_weight_kg: 662.4,
      items: [...]
    }
  ]
};
```

### 3. UI Display

#### Preview Modal:
```
ลำดับ | เลขที่ออเดอร์                    | จุดแวะ      | น้ำหนัก
1     | IV27010942, IV27010941 [2 ออเดอร์] | ร้านเอ      | 1,362.4 kg
2     | IV27010944, IV27010943, IV27010947 [3 ออเดอร์] | ร้านบี | 3,222.0 kg
```

#### Route Map Popup:
```
📦 เลขที่ออเดอร์
   IV27010942  700.0 kg  [→ 2] [→ 3]
   IV27010941  662.4 kg  [→ 2] [→ 3]
   
⚖️ น้ำหนักรวม: 1,362.4 kg
```

#### Excel Editor:
```
คัน | ลำดับ | เลขที่ออเดอร์
1   | 1     | IV27010942 [รวม 2]
1   | 1     | IV27010941 [รวม 2]
1   | 2     | IV27010944 [รวม 3]
1   | 2     | IV27010943 [รวม 3]
1   | 2     | IV27010947 [รวม 3]
```

## Testing Checklist

### ✅ Preview Modal
- [x] แสดงเลขออเดอร์ทั้งหมดในแถวเดียว
- [x] แสดง badge จำนวนออเดอร์ที่รวมกัน
- [x] น้ำหนักรวมถูกต้อง
- [x] ไม่มีแถวซ้ำ

### ✅ Route Map
- [x] Popup แสดงออเดอร์ทั้งหมด
- [x] แสดงน้ำหนักแต่ละออเดอร์
- [x] ปุ่มย้ายออเดอร์ทำงานถูกต้อง

### ✅ Excel Editor
- [x] แสดงแถวแยกต่อออเดอร์ (เพื่อแก้ไข)
- [x] แสดง badge "รวม X" บนออเดอร์ที่ consolidated
- [x] สามารถแก้ไขแต่ละออเดอร์ได้

## User Impact

### Before Fix
❌ ผู้ใช้เห็นแค่ 2 ออเดอร์ แต่น้ำหนักรวม 5 ออเดอร์ → สับสน
❌ ไม่รู้ว่าออเดอร์ไหนถูกรวมกัน
❌ ไม่สามารถตรวจสอบความถูกต้องได้

### After Fix
✅ เห็นเลขออเดอร์ทั้งหมดชัดเจน
✅ มี badge บอกว่ารวมกี่ออเดอร์
✅ น้ำหนักและจำนวนออเดอร์สอดคล้องกัน
✅ สามารถตรวจสอบและแก้ไขได้ง่าย

## Related Files

### Modified
- `app/receiving/routes/page.tsx` - Preview modal table
- `components/receiving/ExcelStyleRouteEditor.tsx` - Editor table badge

### Already Working
- `components/maps/StopDetailPopup.tsx` - Map popup
- `components/maps/RouteMap.tsx` - Map display
- `app/api/route-plans/[id]/editor/route.ts` - API data preparation

## Notes

1. **VRP Consolidation Logic** ยังคงทำงานถูกต้อง - การรวมออเดอร์เป็น 2 stops นั้นถูกต้องแล้ว (ลูกค้าเดียวกันหรือ 2 คัน)

2. **Data Integrity** - ข้อมูลใน `stop.tags.order_ids` และ `stop.orders` array ตรงกัน

3. **Backward Compatibility** - แผนเก่าที่ไม่มี `orders` array จะ fallback ไปใช้ `order_no` เดิม

4. **Performance** - ไม่มีผลกระทบต่อประสิทธิภาพ (ใช้ข้อมูลที่มีอยู่แล้ว)

## Future Enhancements

1. **Compact Display** - แสดงเป็น "IV27010941 +1" แทน "IV27010941, IV27010942" เมื่อมีหลายออเดอร์
2. **Tooltip** - แสดงรายละเอียดออเดอร์ทั้งหมดเมื่อ hover
3. **Export** - รวมเลขออเดอร์ทั้งหมดใน Excel export
4. **Print** - แสดงออเดอร์ทั้งหมดในเอกสารพิมพ์

## Conclusion

✅ **Problem Solved:** UI ตอนนี้แสดงเลขออเดอร์ทั้งหมดในทุกจุดที่ผู้ใช้ต้องการเห็น
✅ **User Experience:** ผู้ใช้เข้าใจได้ชัดเจนว่าออเดอร์ไหนถูกรวมกัน
✅ **Data Accuracy:** น้ำหนักและจำนวนออเดอร์สอดคล้องกัน
✅ **Maintainability:** โค้ดชัดเจน มี badge indicator ที่เข้าใจง่าย
