# 📱 คู่มือการใช้งาน - หน้ารับสินค้าเข้าคลังบนมือถือ
## Mobile Inbound Receiving System

---

## 🎯 ภาพรวม

หน้ารับสินค้าเข้าคลังบนมือถือ (`/mobile/receive`) ออกแบบมาเพื่อให้พนักงานคลังสินค้าสามารถสแกนและบันทึกรหัสพาเลทภายนอกได้อย่างรวดเร็วและสะดวก โดยใช้งานผ่านมือถือหรือแท็บเล็ต

### จุดเด่น
- ✅ **ใช้งานง่าย** - ออกแบบ UI เฉพาะสำหรับมือถือ
- ✅ **สแกนรวดเร็ว** - สแกน QR Code/Barcode ได้ทันที
- ✅ **รายละเอียดครบ** - แสดงข้อมูลสินค้าครบถ้วน
- ✅ **ติดตามสถานะ** - Progress bar แสดงความคืบหน้า
- ✅ **Audio Feedback** - เสียงแจ้งเตือนเมื่อสแกนสำเร็จ
- ✅ **Offline-ready** - พร้อมรองรับการใช้งาน offline

---

## 📋 ฟีเจอร์หลัก

### 1. 📜 หน้ารายการเอกสาร (List View)
**หน้าแรกที่เห็นเมื่อเข้าหน้า `/mobile/receive`**

#### ส่วนประกอบ:
```
┌─────────────────────────────────────┐
│ 📦 รับสินค้าเข้าคลัง          [🔄] │ Header
│     Inbound Receiving              │
├─────────────────────────────────────┤
│ 🔍 [ค้นหา...]                      │ Search Bar
├─────────────────────────────────────┤
│ [ทั้งหมด] [🔸รอสแกน] [รับเข้าแล้ว] │ Filter Tabs
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ RCV-2025-001     [🔸3 รอสแกน]  │ │ Card 1
│ │ 20 พ.ย. 2568                   │ │
│ │ รับสินค้าปกติ | [รับเข้าแล้ว]   │ │
│ │ 📦 ABC Company Ltd.            │ │
│ │ 📊 5 รายการ | ⏰ 3 รอสแกน       │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ RCV-2025-002     [✓ เสร็จสิ้น]  │ │ Card 2
│ │ 19 พ.ย. 2568                   │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### การทำงาน:
1. **Header**
   - ชื่อหน้า: "รับสินค้าเข้าคลัง"
   - ปุ่ม Refresh (🔄): รีเฟรชข้อมูล

2. **Search Bar**
   - ค้นหาได้จาก:
     * เลขที่เอกสารรับ (receive_no)
     * เลขที่อ้างอิง (reference_doc)
     * ชื่อผู้จำหน่าย (supplier_name)

3. **Filter Tabs**
   - **ทั้งหมด**: แสดงเอกสารทั้งหมด
   - **🔸 รอสแกน**: เอกสารที่มีรายการรอสแกนพาเลท
   - **รับเข้าแล้ว**: สถานะ "รับเข้าแล้ว"
   - **กำลังตรวจสอบ**: สถานะ "กำลังตรวจสอบ"

4. **Document Cards**
   แต่ละการ์ดแสดง:
   - **รหัสเอกสาร** (เช่น RCV-2025-001)
   - **วันที่รับ** (รูปแบบไทย)
   - **ประเภท** + **สถานะ** (Badges)
   - **ผู้จำหน่าย** (ถ้ามี)
   - **สถิติ**: จำนวนรายการ + จำนวนรอสแกน
   - **Badge เด่น**: 🔸 X รอสแกน (ถ้ามีรายการรอสแกน)

#### Visual Indicators:
- 🔸 **สีเหลืองอำพัน**: เอกสารที่มีรายการรอสแกน
- ⏰ **Clock icon**: จำนวนรายการที่รอสแกน
- ✓ **Check icon**: สแกนเรียบร้อยแล้ว

---

### 2. 📝 หน้ารายละเอียดเอกสาร (Detail View)
**เมื่อแตะการ์ดเอกสาร**

#### ส่วนประกอบ:
```
┌─────────────────────────────────────┐
│ ← RCV-2025-001              [🔄]    │ Header
│   20 พ.ย. 2568                     │
├─────────────────────────────────────┤
│ ████████░░░░░░░░░░ 40%             │ Progress Bar
│ สแกนแล้ว 2/5                       │
├─────────────────────────────────────┤
│ ┌──────────┬──────────────────────┐ │
│ │ ประเภท    │ รับสินค้าปกติ        │ │ Info Cards
│ ├──────────┼──────────────────────┤ │
│ │ สถานะ    │ [รับเข้าแล้ว]        │ │
│ ├──────────┴──────────────────────┤ │
│ │ ผู้จำหน่าย: ABC Company Ltd.    │ │
│ ├─────────────────────────────────┤ │
│ │ เอกสารอ้างอิง: PO-2025-001      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 📦 รายการสินค้า (5)  [🔸3 รอสแกน] │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ #1  [⏳ รอสแกน]                  │ │ Item 1
│ │ Buzz Beyond แมวโต รสแกะ | 1 กก. │ │
│ │ SKU: B-BEY-C|LAM|010            │ │
│ │ ┌──────┬──────┐                 │ │
│ │ │ แพ็ค  │ ชิ้น  │                 │ │
│ │ │  17  │ 200  │                 │ │
│ │ └──────┴──────┘                 │ │
│ │ 📦 พาเลทภายใน: ATG2025...      │ │
│ │                                 │ │
│ │ [📷 สแกนพาเลทภายนอก]           │ │ Action
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ #2  [✓ สแกนแล้ว]                │ │ Item 2
│ │ ...                             │ │
│ │ [✓ สแกนเรียบร้อยแล้ว]          │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### การทำงาน:
1. **Header**
   - ปุ่ม Back (←): กลับไปหน้ารายการ
   - เลขที่เอกสาร + วันที่
   - ปุ่ม Refresh (🔄)

2. **Progress Bar**
   - แถบความคืบหน้าสีเขียว
   - แสดง "สแกนแล้ว X/Y"
   - เปอร์เซ็นต์

3. **Info Cards**
   - **ประเภท**: รับสินค้าปกติ, รับสินค้าชำรุด, ฯลฯ
   - **สถานะ**: รอรับเข้า, รับเข้าแล้ว, ฯลฯ
   - **ผู้จำหน่าย**: ชื่อบริษัท
   - **เอกสารอ้างอิง**: เลข PO, DO

4. **Item Cards**
   แต่ละรายการแสดง:
   - **หมายเลข** (#1, #2, ...)
   - **Status Badge**: ⏳ รอสแกน / ✓ สแกนแล้ว
   - **ชื่อสินค้า** (จาก master_sku)
   - **SKU Code** (font-mono)
   - **จำนวน**: แพ็ค + ชิ้น (2 กล่องคู่)
   - **รหัสพาเลทภายใน**: ATG2025...
   - **รหัสพาเลทภายนอก**: (หลังสแกน)
   - **วันที่ผลิต/หมดอายุ**: (ถ้ามี)
   - **ปุ่ม Action**:
     * 🟡 สีส้ม "📷 สแกนพาเลทภายนอก" (ถ้ารอสแกน)
     * 🟢 สีเขียว "✓ สแกนเรียบร้อยแล้ว" (ถ้าสแกนแล้ว)

#### Color Coding:
- 🟡 **Amber border**: รายการรอสแกน
- ⏳ **Amber badge**: สถานะรอสแกน
- ✓ **Green badge**: สถานะสแกนแล้ว

---

### 3. 📷 หน้าสแกนพาเลท (Scanner View)
**เมื่อกดปุ่ม "สแกนพาเลทภายนอก"**

#### ส่วนประกอบ:
```
┌─────────────────────────────────────┐
│ [×] สแกนพาเลทภายนอก              │ Header (dark)
├─────────────────────────────────────┤
│                                     │
│   ╔═══════════════════════════╗    │
│   ║                           ║    │
│   ║   [📷 Scanning Area]      ║    │ Scan Area
│   ║                           ║    │
│   ╚═══════════════════════════╝    │
│                                     │
│   เตรียมสแกนบาร์โค้ด                │
│   หรือพิมพ์รหัสด้านล่าง             │
├─────────────────────────────────────┤
│ รายการที่กำลังสแกน:                 │
│ Buzz Beyond แมวโต รสแกะ | 1 กก.    │ Item Info
│ SKU: B-BEY-C|LAM|010               │
│ [17 แพ็ค] [200 ชิ้น]               │
├─────────────────────────────────────┤
│ พิมพ์รหัสพาเลทภายนอก:              │
│ [_________________________]        │ Manual Input
├─────────────────────────────────────┤
│ [✓ บันทึกรหัสพาเลท]                │ Save Button
└─────────────────────────────────────┘
```

#### การทำงาน:
1. **Header**
   - ปุ่ม Close (×): ปิดหน้าสแกน
   - พื้นหลังสีเข้ม (gray-800)

2. **Scanning Area**
   - กรอบเส้นประสีฟ้า (border-dashed)
   - ไอคอน ScanLine แบบ animated
   - ข้อความ "เตรียมสแกนบาร์โค้ด"

3. **Item Info Card**
   - พื้นหลังเทาเข้ม
   - แสดงข้อมูลสินค้าที่กำลังสแกน
   - SKU + จำนวนแพ็ค/ชิ้น

4. **Manual Input**
   - Input field ขนาดใหญ่
   - font-mono สำหรับรหัส
   - Auto-focus เมื่อเปิดหน้า
   - รองรับการพิมพ์และสแกน

5. **Save Button**
   - ปุ่มใหญ่เต็มความกว้าง
   - สีเขียว (primary)
   - Loading state เมื่อกำลังบันทึก
   - Disabled ถ้าไม่มีรหัส

#### Workflow:
```
1. เปิดหน้าสแกน
   ↓
2. สแกนบาร์โค้ด OR พิมพ์รหัสด้วยมือ
   ↓
3. กดปุ่ม "✓ บันทึกรหัสพาเลท"
   ↓
4. Loading... (แสดง spinner)
   ↓
5. API Call: POST /api/receive/update-external-pallet
   ↓
6. Success:
   - 🔊 เล่นเสียงสำเร็จ (success.mp3)
   - ✅ Alert "บันทึกสำเร็จ!"
   - 🔄 Refresh data
   - ⬅️ กลับไปหน้ารายละเอียด
   ↓
7. Update UI:
   - Status badge: รอสแกน → สแกนแล้ว
   - แสดงรหัสพาเลทภายนอก
   - Progress bar เพิ่มขึ้น
```

---

## 🎨 การออกแบบ UI/UX

### Color Scheme
```css
Primary:   #0099FF (Blue)      - หลัก, ลิงก์
Success:   #10B981 (Green)     - สำเร็จ, สแกนแล้ว
Warning:   #F59E0B (Amber)     - รอดำเนินการ, รอสแกน
Danger:    #EF4444 (Red)       - ข้อผิดพลาด
Info:      #0099FF (Blue)      - ข้อมูล
Gray:      #6B7280             - ข้อความทั่วไป
```

### Typography
```css
Font Family: 'Sarabun', 'Noto Sans Thai', sans-serif
Headings:    font-bold font-thai
Body:        font-thai
Code/SKU:    font-mono (Courier New)
```

### Spacing
```css
Cards:       p-4 (16px padding)
Gap:         gap-3 (12px)
Margins:     mb-3, mt-3
Rounded:     rounded-xl (12px)
```

### Touch Targets
```css
Minimum:     48x48px
Buttons:     py-4 (16px vertical padding)
Input:       py-3 (12px vertical padding)
```

---

## 🔄 Data Flow

### 1. Fetch Receives
```typescript
GET /api/receives?status=รับเข้าแล้ว,กำลังตรวจสอบ

Response:
{
  data: [
    {
      receive_id: 1,
      receive_no: "RCV-2025-001",
      receive_type: "รับสินค้าปกติ",
      status: "รับเข้าแล้ว",
      wms_receive_items: [
        {
          item_id: 1,
          sku_id: "B-BEY-C|LAM|010",
          pallet_scan_status: "รอดำเนินการ",
          ...
        }
      ],
      master_supplier: { supplier_name: "ABC Company" },
      received_by_employee: { first_name: "สมชาย", last_name: "ใจดี" }
    }
  ]
}
```

### 2. Update External Pallet
```typescript
POST /api/receive/update-external-pallet

Request:
{
  itemId: 1,
  externalPalletId: "EXT-PALLET-001"
}

Response:
{
  data: {
    item_id: 1,
    pallet_id_external: "EXT-PALLET-001",
    pallet_scan_status: "สแกนแล้ว",
    ...
  },
  message: "External pallet ID updated successfully"
}
```

---

## 🎵 Audio Feedback

### เสียงแจ้งเตือน
1. **success.mp3** - เล่นเมื่อบันทึกสำเร็จ
2. **error.mp3** - เล่นเมื่อเกิดข้อผิดพลาด (future)
3. **beep.mp3** - เล่นเมื่อกดปุ่ม (future)

### การใช้งาน:
```typescript
const playSuccessSound = () => {
  try {
    const audio = new Audio('/audio/success.mp3');
    audio.play().catch(() => {});
  } catch (error) {
    // Silent fail - ไม่ให้ขัดขวางการทำงาน
  }
};
```

---

## 📊 State Management

### Component States
```typescript
const [loading, setLoading] = useState(true);
const [receives, setReceives] = useState<ReceiveDocument[]>([]);
const [filteredReceives, setFilteredReceives] = useState<ReceiveDocument[]>([]);
const [searchTerm, setSearchTerm] = useState('');
const [selectedStatus, setSelectedStatus] = useState<string>('all');
const [selectedReceive, setSelectedReceive] = useState<ReceiveDocument | null>(null);
const [showScanner, setShowScanner] = useState(false);
const [scanningItem, setScanningItem] = useState<ReceiveItem | null>(null);
const [manualInput, setManualInput] = useState('');
const [saving, setSaving] = useState(false);
```

### View States
```
┌─────────────────────────────┐
│                             │
│   Loading State             │
│   (Loader2 spinner)         │
│                             │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│                             │
│   List View                 │
│   (Document cards)          │
│                             │
└─────────────────────────────┘
        ↓ (Click card)
┌─────────────────────────────┐
│                             │
│   Detail View               │
│   (Item cards)              │
│                             │
└─────────────────────────────┘
        ↓ (Click scan button)
┌─────────────────────────────┐
│                             │
│   Scanner View              │
│   (Input + Save)            │
│                             │
└─────────────────────────────┘
        ↓ (Save success)
┌─────────────────────────────┐
│                             │
│   Back to Detail View       │
│   (Updated status)          │
│                             │
└─────────────────────────────┘
```

---

## 🚀 Performance

### Optimization
1. **React.memo** - Components ที่ไม่ต้องการ re-render
2. **useCallback** - Memoize event handlers
3. **useMemo** - Memoize filtered data
4. **Lazy Loading** - Load images/data เมื่อต้องการ
5. **Debounce** - Search input (ถ้าจำเป็น)

### Caching
- ไม่ใช้ SWR (เพื่อความเรียบง่าย)
- Manual fetch + local state
- Refetch หลังจาก mutation

---

## 📱 Mobile Responsiveness

### Breakpoints
```css
Mobile:   < 640px  (ใช้ full width)
Tablet:   640px+   (max-width container)
Desktop:  768px+   (redirect หรือแสดง warning)
```

### Safe Areas
```css
.safe-top    { padding-top: env(safe-area-inset-top); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

### Touch Interactions
- **Tap**: เลือกรายการ
- **Long Press**: (future) แสดง quick actions
- **Swipe**: (future) refresh to reload
- **Pull to Refresh**: (future)

---

## 🔐 Security & Validation

### Input Validation
```typescript
// ตรวจสอบรหัสพาเลทไม่ว่าง
if (!manualInput.trim()) {
  alert('กรุณากรอกรหัสพาเลทภายนอก');
  return;
}

// Trim whitespace
const externalId = manualInput.trim();
```

### Error Handling
```typescript
try {
  const response = await fetch('/api/...', { ... });
  const result = await response.json();

  if (result.error) {
    alert(`เกิดข้อผิดพลาด: ${result.error}`);
    return;
  }

  // Success
  playSuccessSound();
  alert('✅ บันทึกสำเร็จ!');
} catch (error) {
  console.error('Error:', error);
  alert('เกิดข้อผิดพลาดในการบันทึก');
} finally {
  setSaving(false);
}
```

---

## 🧪 Testing Checklist

### Functional Testing
- [ ] ดึงรายการเอกสารได้
- [ ] ค้นหาทำงานได้
- [ ] กรองตามสถานะได้
- [ ] เปิดรายละเอียดได้
- [ ] Progress bar แสดงถูกต้อง
- [ ] เปิดหน้าสแกนได้
- [ ] พิมพ์รหัสได้
- [ ] บันทึกรหัสได้
- [ ] Update status ถูกต้อง
- [ ] Refresh data หลังบันทึก
- [ ] เสียงเล่นเมื่อสำเร็จ
- [ ] กลับหน้าได้

### UI/UX Testing
- [ ] Touch targets ≥ 48px
- [ ] Text อ่านง่าย
- [ ] สีตัดกันชัด
- [ ] Animation ลื่นไหล
- [ ] Loading states ชัดเจน
- [ ] Error messages เข้าใจง่าย

### Performance Testing
- [ ] Load time < 3s
- [ ] Smooth scrolling
- [ ] No memory leaks
- [ ] API calls optimized

### Device Testing
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (landscape + portrait)
- [ ] Various screen sizes

---

## 🔮 Future Enhancements

### Phase 2 (Nice to Have)
1. **Camera Integration**
   - เปิดกล้องสแกนจริง (react-qr-reader)
   - Auto-fill จาก camera scan

2. **Offline Mode**
   - Cache ข้อมูลใน localStorage
   - Queue mutations
   - Sync เมื่อ online

3. **PWA Features**
   - Install on home screen
   - Push notifications
   - Background sync

4. **Bulk Scanning**
   - สแกนหลายรายการติดกัน
   - Batch update API

5. **Advanced Filters**
   - Filter by supplier
   - Filter by date range
   - Sort options

6. **Statistics Dashboard**
   - รายงานการสแกนวันนี้
   - Performance metrics
   - Top scanners

---

## 📞 Support

### ติดปัญหา?
1. ลองกด Refresh (🔄)
2. ตรวจสอบ internet connection
3. Clear browser cache
4. ติดต่อ IT Support

### คำถามที่พบบ่อย (FAQ)

**Q: สแกนแล้วไม่ขึ้น?**
A: ลองพิมพ์รหัสด้วยมือแทน หรือกด Refresh

**Q: ข้อมูลไม่อัพเดท?**
A: กดปุ่ม Refresh ที่มุมขวาบน

**Q: เสียงไม่ดัง?**
A: เช็คว่า phone ไม่ได้ silent mode

**Q: หน้าช้า?**
A: ตรวจสอบ internet หรือลอง reload page

---

## 🎓 สรุป

หน้ารับสินค้าเข้าคลังบนมือถือออกแบบมาเพื่อให้**ใช้งานง่าย รวดเร็ว และมีรายละเอียดครบถ้วน** เหมาะสำหรับพนักงานคลังสินค้าที่ต้องการสแกนและบันทึกข้อมูลพาเลทในสนาม

### จุดเด่น 3 ข้อ:
1. 🚀 **รวดเร็ว** - สแกนและบันทึกได้ในไม่กี่วินาที
2. 👁️ **ชัดเจน** - แสดงข้อมูลครบถ้วน เข้าใจง่าย
3. ✨ **ใช้งานง่าย** - UI ออกแบบเฉพาะมือถือ

---

**เวอร์ชัน:** 1.0.0
**อัพเดทล่าสุด:** 20 พฤศจิกายน 2568
**หน้า:** `/mobile/receive`
