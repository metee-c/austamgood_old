# 🎨 AustamGood WMS - Design System

**เอกสารนี้สรุปรายละเอียดทุกมิติของระบบ UI/UX สำหรับ WMS**
**วันที่อัพเดท:** 7 พฤศจิกายน 2025

---

## 📋 สารบัญ

1. [Color Palette (สีหลัก)](#-color-palette-สีหลัก)
2. [Typography (ตัวอักษร)](#-typography-ตัวอักษร)
3. [Spacing & Layout](#-spacing--layout)
4. [Components (คอมโพเนนต์)](#-components-คอมโพเนนต์)
5. [Animations](#-animations)
6. [Best Practices](#-best-practices)

---

## 🎨 Color Palette (สีหลัก)

### Primary Colors (สีหลัก - โทนฟ้า)

```css
primary-50:  #e6f7ff  /* ฟ้าอ่อนมาก */
primary-100: #bae7ff  /* ฟ้าอ่อน */
primary-200: #91d5ff  /* ฟ้า */
primary-300: #69c0ff  /* ฟ้าปานกลาง */
primary-400: #40a9ff  /* ฟ้าเข้ม */
primary-500: #0099FF  /* ✨ สีหลัก - Thai Style Blue */
primary-600: #0080d6  /* ฟ้าเข้มมาก */
primary-700: #006bb3  /* น้ำเงินฟ้า */
primary-800: #005591  /* น้ำเงิน */
primary-900: #003f6e  /* น้ำเงินเข้ม */
```

**การใช้งาน:**
- Buttons หลัก: `bg-primary-500` หรือ `bg-blue-500`
- Links: `text-primary-600`
- Hover: `hover:bg-primary-600`
- Focus ring: `ring-primary-500`

### Thai Gray Scale (โทนเทาไทย)

```css
thai-gray-25:  #fcfcfd  /* เทาอ่อนมากๆ - พื้นหลัง */
thai-gray-50:  #f9fafb  /* เทาอ่อนมาก */
thai-gray-100: #f3f4f6  /* เทาอ่อน - พื้นหลัง Input */
thai-gray-200: #e5e7eb  /* เทา - ขอบ Border */
thai-gray-300: #d1d5db  /* เทาปานกลาง */
thai-gray-400: #9ca3af  /* เทาเข้ม - Placeholder */
thai-gray-500: #6b7280  /* เทาเข้มมาก - Text Secondary */
thai-gray-600: #4b5563  /* เทาดำ - Text */
thai-gray-700: #374151  /* เทาดำเข้ม - Headings */
thai-gray-800: #1f2937  /* ดำอมเทา - Text Primary */
thai-gray-900: #111827  /* ดำ - Headings Important */
```

### Background Colors (สีพื้นหลัง)

```css
background-cream: #FFFAF0  /* ครีมไทย - พื้นหลังทางเลือก */
background-light: #FEFEFE  /* ขาวนวล */

/* Gradient หลัก */
bg-gradient-to-br from-thai-gray-25 to-white
```

### Semantic Colors (สีตามความหมาย)

```css
/* Success (สำเร็จ) */
bg-green-50:  #f0fdf4  /* พื้นหลัง */
bg-green-100: #dcfce7  /* Badge */
text-green-600: #16a34a /* ข้อความ */
text-green-800: #166534 /* ข้อความเข้ม */

/* Warning (เตือน) */
bg-yellow-50:  #fffbeb  /* พื้นหลัง */
bg-yellow-100: #fef3c7  /* Badge */
bg-amber-50:   #fffbeb  /* พื้นหลังรอสแกน */
text-yellow-600: #ca8a04 /* ข้อความ */
text-yellow-800: #854d0e /* ข้อความเข้ม */
text-amber-700:  #b45309 /* ข้อความพิเศษ */

/* Danger/Error (อันตราย/ผิดพลาด) */
bg-red-50:  #fef2f2  /* พื้นหลัง */
bg-red-100: #fee2e2  /* Badge */
text-red-600: #dc2626 /* ข้อความ */
text-red-800: #991b1b /* ข้อความเข้ม */

/* Info (ข้อมูล) */
bg-blue-50:  #eff6ff  /* พื้นหลัง */
bg-blue-100: #dbeafe  /* Badge */
text-blue-600: #2563eb /* ข้อความ */
text-blue-800: #1e40af /* ข้อความเข้ม */

/* Secondary/Default */
bg-purple-50:  #faf5ff  /* พื้นหลัง */
bg-purple-100: #f3e8ff  /* Badge */
text-purple-600: #9333ea /* ข้อความ */
text-purple-800: #6b21a8 /* ข้อความเข้ม */
```

---

## 📝 Typography (ตัวอักษร)

### Font Families

```css
/* หลัก - สำหรับข้อความไทย */
font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;

/* Class utility */
font-sans: Sarabun + Noto Sans Thai (ค่าเริ่มต้น)
font-thai: Sarabun + Noto Sans Thai (สำหรับข้อความไทย)
font-inter: Inter (สำหรับตัวเลข/Code)
font-mono: monospace (สำหรับรหัส/บาร์โค้ด)
```

### Font Sizes

```css
/* Tailwind Classes */
text-xs:   0.75rem  (12px)  - Badge, หมายเหตุเล็ก, ในตาราง
text-sm:   0.875rem (14px)  - ข้อความปกติ, ฟอร์ม, ตาราง
text-base: 1rem     (16px)  - ข้อความหลัก
text-lg:   1.125rem (18px)  - หัวข้อรอง, Modal Title
text-xl:   1.25rem  (20px)  - หัวข้อหลัก (Page Title)
text-2xl:  1.5rem   (24px)  - หัวข้อใหญ่, StatsCard Value
```

**ตัวอย่างการใช้งาน:**
```tsx
// Page Title
<h1 className="text-xl font-bold text-thai-gray-900 font-thai">
  รับสินค้าเข้าคลัง (Inbound)
</h1>

// Table Header
<th className="text-xs font-semibold text-gray-700 uppercase">
  รหัสรับ
</th>

// Table Cell
<td className="text-xs font-mono text-thai-gray-600">
  GR-202511-0001
</td>

// Stats Value
<p className="text-2xl font-bold text-thai-gray-900">
  1,234
</p>
```

### Font Weights

```css
font-light:    300  - ข้อความบางมาก (ไม่ค่อยใช้)
font-normal:   400  - ข้อความปกติ
font-medium:   500  - ข้อความเน้น, Labels
font-semibold: 600  - หัวข้อย่อย, ตัวหนา
font-bold:     700  - หัวข้อหลัก, ตัวเลขสำคัญ
```

### Line Heights & Letter Spacing

```css
/* Line Height สำหรับข้อความไทย */
leading-tight:   1.25  - หัวข้อ
leading-normal:  1.5   - ค่าเริ่มต้น
leading-relaxed: 1.625 - ข้อความยาว

/* Letter Spacing สำหรับข้อความไทย */
.thai-text {
  line-height: 1.6;
  letter-spacing: 0.025em;
}

/* สำหรับ Table Header */
tracking-wide: 0.025em
tracking-wider: 0.05em (Uppercase Headers)
```

---

## 📐 Spacing & Layout

### Container & Layout Spacing

```css
/* Page Container */
.h-screen              /* เต็มหน้าจอ */
.overflow-hidden       /* ป้องกัน scroll */

/* Padding ระดับ Page */
pt-0  px-2  pb-2      /* Top 0, Left/Right 8px, Bottom 8px */

/* Flex Layout */
.flex  .flex-col      /* แนวตั้ง */
.space-y-2            /* ช่องว่างระหว่าง elements 8px */
```

### Component Spacing

```css
/* Padding ภายในคอมโพเนนต์ */
p-1:     0.25rem  (4px)   - ขนาดเล็กมาก
p-1.5:   0.375rem (6px)   - ขนาดเล็ก (Table Cell)
p-2:     0.5rem   (8px)   - ปกติเล็ก
p-3:     0.75rem  (12px)  - ปกติ (Search Bar, Filter)
p-4:     1rem     (16px)  - ค่าเริ่มต้น Card
p-6:     1.5rem   (24px)  - Modal, Card Header

/* Margin ระหว่างองค์ประกอบ */
m-0:     0
space-x-2: 0.5rem  (8px)  - ช่องว่างแนวนอน
space-x-3: 0.75rem (12px)
space-y-2: 0.5rem  (8px)  - ช่องว่างแนวตั้ง
space-y-3: 0.75rem (12px)
space-y-4: 1rem    (16px)

gap-1:   0.25rem  (4px)
gap-2:   0.5rem   (8px)  - ปุ่มติดกัน
gap-3:   0.75rem  (12px)
```

### Border Radius

```css
rounded:      0.25rem  (4px)   - มุมมนขนาดเล็ก
rounded-md:   0.375rem (6px)   - มุมมนปานกลาง
rounded-lg:   0.5rem   (8px)   - ⭐ ค่าเริ่มต้น (Button, Input, Card)
rounded-xl:   0.75rem  (12px)  - Card ใหญ่, Container
rounded-full: 9999px           - วงกลม (Badge, Avatar)
```

### Shadows

```css
shadow-sm:  0 1px 2px rgba(0,0,0,0.05)    - Card เล็ก
shadow:     0 1px 3px rgba(0,0,0,0.1)     - ปกติ
shadow-md:  0 4px 6px rgba(0,0,0,0.1)     - Card hover
shadow-lg:  0 10px 15px rgba(0,0,0,0.1)   - Modal, Dropdown
shadow-xl:  0 20px 25px rgba(0,0,0,0.1)   - Modal ใหญ่
```

**ตัวอย่างการใช้งาน:**
```tsx
// Search Bar / Filter Container
className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm"

// Button Primary
className="bg-blue-500 hover:bg-blue-600 shadow-lg rounded-lg px-4 py-2"

// Card
className="bg-white rounded-lg border border-thai-gray-200 shadow-sm p-4"
```

---

## 🧩 Components (คอมโพเนนต์)

### 1. Button Component

**ขนาด (Sizes):**
```tsx
sm:  px-3 py-1.5  text-sm    (Padding: 12px 6px, Font: 14px)
md:  px-4 py-2    text-sm    (Padding: 16px 8px, Font: 14px) ⭐ Default
lg:  px-6 py-3    text-base  (Padding: 24px 12px, Font: 16px)
```

**Variants:**
```tsx
primary:    bg-primary-500 text-white hover:bg-primary-600
secondary:  bg-thai-gray-200 text-thai-gray-800 hover:bg-thai-gray-300
outline:    border border-primary-500 text-primary-500 hover:bg-primary-50
ghost:      text-thai-gray-600 hover:bg-thai-gray-100
danger:     bg-red-500 text-white hover:bg-red-600
success:    bg-green-500 text-white hover:bg-green-600
warning:    bg-orange-500 text-white hover:bg-orange-600
```

**States:**
```css
/* Normal */
transition-all duration-200

/* Hover */
hover:bg-{color}-600

/* Focus */
focus:ring-2 focus:ring-{color}-500 focus:ring-offset-2

/* Disabled */
opacity-50 cursor-not-allowed

/* Loading */
<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
```

**ตัวอย่าง:**
```tsx
<Button
  variant="primary"
  size="md"
  icon={Plus}
  className="bg-blue-500 hover:bg-blue-600 shadow-lg"
>
  สร้างใบรับใหม่
</Button>
```

---

### 2. Badge Component

**ขนาด:**
```tsx
sm: px-2   py-0.5  text-xs    (Padding: 8px 2px, Font: 12px) ⭐ Default
md: px-2.5 py-0.5  text-sm    (Padding: 10px 2px, Font: 14px)
lg: px-3   py-1    text-base  (Padding: 12px 4px, Font: 16px)
```

**Variants:**
```tsx
default:    bg-thai-gray-100  text-thai-gray-800    /* เทา */
primary:    bg-primary-100    text-primary-800      /* ฟ้า */
secondary:  bg-purple-100     text-purple-800       /* ม่วง */
success:    bg-green-100      text-green-800        /* เขียว */
warning:    bg-yellow-100     text-yellow-800       /* เหลือง */
danger:     bg-red-100        text-red-800          /* แดง */
info:       bg-blue-100       text-blue-800         /* น้ำเงิน */
```

**Style:**
```css
/* Base */
inline-flex items-center font-medium rounded-full font-thai

/* สำหรับสถานะ */
whitespace-nowrap  /* ไม่ตัดบรรทัด */
```

**ตัวอย่างการใช้งาน:**
```tsx
// สถานะการรับสินค้า
{status === 'รับเข้าแล้ว' && (
  <Badge variant="info" size="sm">รับเข้าแล้ว</Badge>
)}

// ประเภทการรับ
<Badge variant="danger" size="sm">รับสินค้าชำรุด</Badge>

// สถานะการสแกน
<Badge variant="success" size="sm">สแกนแล้ว</Badge>
```

---

### 3. Table Component

**Header:**
```css
/* Sticky Header */
className="sticky top-0 z-10 bg-gray-100"

/* Header Cell */
px-2  py-3                     /* Padding */
text-xs                        /* Font Size: 12px */
font-semibold                  /* Font Weight: 600 */
text-gray-700                  /* สีข้อความ */
uppercase tracking-wide        /* ตัวพิมพ์ใหญ่ + spacing */
border-b border-gray-200       /* ขอบล่าง */
```

**Body Rows:**
```css
/* Row */
hover:bg-gray-50/80 transition-colors duration-200

/* Cell */
px-1.5 py-1                    /* Padding: 6px 4px */
text-xs                        /* Font Size: 12px */
border-r border-gray-100       /* ขอบขวา */
whitespace-nowrap              /* ไม่ตัดบรรทัด */
overflow-hidden                /* ซ่อนส่วนเกิน */
```

**ขนาดคอลัมน์ (Column Widths) - ตัวอย่างจากหน้า Inbound:**
```tsx
const columnWidths = {
  receive_no: 8,        // รหัสรับ (8%)
  reference_doc: 6,     // อ้างอิง (6%)
  receive_type: 7,      // ประเภท (7%)
  product_name: 20,     // ชื่อสินค้า (20%) - กว้างสุด
  sku_id: 6,            // SKU (6%)
  barcode: 8,           // บาร์โค้ด (8%)
  piece_quantity: 5,    // ชิ้น (5%)
  pack_quantity: 5,     // แพ็ค (5%)
  supplier_name: 10,    // ผู้ส่ง (10%)
  customer_name: 10,    // ลูกค้า (10%)
  receive_date: 6,      // วันรับ (6%)
  status: 6,            // สถานะ (6%)
  employee_name: 8,     // ผู้รับ (8%)
  actions: 12           // การดำเนินการ (12%)
};

/* Min Widths สำหรับคอลัมน์ */
minWidth: '60px'   - คอลัมน์เล็ก (ชิ้น, แพ็ค)
minWidth: '70px'   - คอลัมน์กลาง
minWidth: '80px'   - คอลัมน์ปกติ
minWidth: '100px'  - คอลัมน์ใหญ่
minWidth: '120px'  - คอลัมน์กว้าง (ผู้ส่ง, ลูกค้า)
minWidth: '200px'  - คอลัมน์กว้างมาก (ชื่อสินค้า)
```

**การเรียงลำดับ (Sortable Headers):**
```tsx
// Button ในหัวตาราง
className="flex items-center hover:bg-gray-200/50 px-1.5 py-0.5 rounded transition-colors"

// Sort Icons
<ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />  /* ไม่เลือก */
<ArrowUp className="w-3 h-3 ml-1 text-gray-600" />      /* เรียง ASC */
<ArrowDown className="w-3 h-3 ml-1 text-gray-600" />    /* เรียง DESC */
```

**การ Resize คอลัมน์:**
```css
/* Handle สำหรับลากเปลี่ยนขนาด */
className="absolute right-0 top-0 w-1 h-full bg-transparent
           hover:bg-blue-400 cursor-col-resize z-20
           transition-colors duration-200"
```

**Expanded Row (แสดงรายละเอียด):**
```css
/* Row สำหรับรายละเอียด */
className="bg-gray-50"

/* Content */
px-4 py-3 border border-gray-100

/* ตารางย่อย (Sub-table) */
className="min-w-full divide-y divide-gray-200"
sticky top-0 bg-gray-50 z-10  /* Header ย่อย */
```

**สถานะพิเศษ:**
```tsx
// แถวที่รอสแกนพาเลท
className="bg-amber-50/30 border-l-2 border-amber-400"

// แถวที่ขยาย
className="bg-gray-50"

// Hover
className="hover:bg-gray-50/80 transition-colors duration-200"
```

---

### 4. Card Component

**Padding Options:**
```tsx
none: ''         /* ไม่มี Padding */
sm:   'p-3'      /* 12px */
md:   'p-4'      /* 16px */ ⭐ Default
lg:   'p-6'      /* 24px */
```

**Shadow Options:**
```tsx
none: ''             /* ไม่มีเงา */
sm:   'shadow-sm'    /* เงาเล็ก */ ⭐ Default
md:   'shadow-md'    /* เงากลาง */
lg:   'shadow-lg'    /* เงาใหญ่ */
```

**Base Style:**
```css
bg-white
rounded-lg
border border-thai-gray-200
```

**Sub-components:**
```tsx
// Card.Header
border-b border-thai-gray-200 pb-4 mb-4

// Card.Body
{/* ไม่มี style พิเศษ */}

// Card.Footer
border-t border-thai-gray-200 pt-4 mt-4
```

**Hover Effect:**
```css
/* Card ที่มี Hover */
.card-hover {
  transition: all 0.3s ease-in-out;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
```

**ตัวอย่าง:**
```tsx
<Card padding="md" shadow="sm" className="hover:shadow-md transition-shadow">
  <Card.Header>
    <h2>หัวข้อ</h2>
  </Card.Header>
  <Card.Body>
    เนื้อหา
  </Card.Body>
</Card>
```

---

### 5. Modal Component

**Sizes:**
```tsx
sm:   'max-w-md'      (448px)
md:   'max-w-lg'      (512px) ⭐ Default
lg:   'max-w-2xl'     (672px)
xl:   'max-w-4xl'     (896px)
2xl:  'max-w-6xl'     (1152px)
3xl:  'max-w-7xl'     (1280px)
4xl:  'max-w-screen-xl' (1536px)
```

**Structure:**
```css
/* Backdrop */
fixed inset-0 bg-black bg-opacity-50

/* Modal Container */
flex min-h-full items-center justify-center p-4

/* Modal */
relative w-full bg-white rounded-lg shadow-xl

/* Header */
p-6 border-b border-thai-gray-200
text-lg font-semibold text-thai-gray-900

/* Close Button */
p-2 text-thai-gray-400 hover:text-thai-gray-600
hover:bg-thai-gray-100 rounded-lg

/* Content */
p-6 max-h-[80vh] overflow-y-auto
```

---

### 6. Input & Form Elements

**Text Input:**
```css
/* Base Style */
w-full
px-3 py-1.5                            /* Padding */
bg-thai-gray-50/50                     /* พื้นหลัง */
border border-thai-gray-200/50         /* ขอบ */
rounded-lg                             /* มุมมน */
text-sm font-thai                      /* ข้อความ */

/* Focus State */
focus:outline-none
focus:ring-2 focus:ring-primary-500/50
focus:border-primary-500/50
focus:bg-white/80

/* With Icon (Search) */
pl-10  /* Left padding สำหรับ Icon */
```

**Select Dropdown:**
```css
/* เหมือน Input แต่มี min-width */
min-w-24  /* 96px - สำหรับ dropdown ทั่วไป */
min-w-28  /* 112px - สำหรับ date picker */
```

**Date Input:**
```css
/* เหมือน Input + min-width */
min-w-28
```

**Placeholder:**
```css
placeholder:text-thai-gray-400
```

**ตัวอย่าง:**
```tsx
// Search Input
<div className="relative">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2
                     w-4 h-4 text-thai-gray-400" />
  <input
    type="text"
    placeholder="ค้นหา..."
    className="w-full pl-10 pr-4 py-1.5
               bg-thai-gray-50/50 border border-thai-gray-200/50
               rounded-lg text-sm font-thai
               focus:outline-none focus:ring-2 focus:ring-primary-500/50
               focus:border-primary-500/50 focus:bg-white/80
               transition-all duration-300"
  />
</div>

// Date Input
<input
  type="date"
  className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50
             rounded-lg text-sm font-thai min-w-28
             focus:outline-none focus:ring-2 focus:ring-primary-500/50"
/>
```

---

### 7. StatsCard Component

**Structure:**
```tsx
Card + Flex Layout
```

**Elements:**
```css
/* Title */
text-sm font-medium text-thai-gray-600 font-thai

/* Value */
text-2xl font-bold text-thai-gray-900 font-thai mt-1

/* Change Indicator */
text-sm font-medium
text-green-600  /* เพิ่มขึ้น */
text-red-600    /* ลดลง */

/* Icon Container */
w-12 h-12 rounded-lg flex items-center justify-center
bg-{color}-50    /* พื้นหลัง */
text-{color}-600 /* Icon */
```

**Color Variants:**
```tsx
blue:   bg-blue-50   text-blue-600
green:  bg-green-50  text-green-600
yellow: bg-yellow-50 text-yellow-600
red:    bg-red-50    text-red-600
purple: bg-purple-50 text-purple-600
```

---

### 8. Mobile Components

**MobileButton:**
```css
/* Size */
py-3 px-6                  /* Padding: 12px 24px */
text-lg                    /* Font: 18px */
rounded-lg                 /* มุมมน */

/* Variants */
primary:   bg-blue-500 hover:bg-blue-600 text-white
secondary: bg-gray-200 hover:bg-gray-300 text-gray-800
success:   bg-green-500 hover:bg-green-600 text-white
danger:    bg-red-500 hover:bg-red-600 text-white

/* Full Width */
w-full
```

**MobileBadge:**
```css
/* ใช้ Badge component เดียวกัน แต่อาจปรับ size เป็น md หรือ lg */
```

---

## 🎬 Animations

### Transitions

```css
/* Default Duration */
transition-all duration-200      /* เร็ว - Buttons, Hovers */
transition-all duration-300      /* ปกติ - Cards, Inputs */
transition-colors duration-200   /* สีเท่านั้น */

/* Easing */
ease-in-out  /* ค่าเริ่มต้น */
ease-out     /* สำหรับ slide in */
ease-in      /* สำหรับ slide out */
```

### Keyframe Animations

**Slide Animations:**
```css
/* Slide In (Sidebar) */
@keyframes slideIn {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}
animation: slideIn 0.3s ease-out

/* Slide Out */
@keyframes slideOut {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
animation: slideOut 0.3s ease-in

/* Flow (Loading Animation) */
@keyframes flow {
  0%   { transform: translateX(-100%); opacity: 0; }
  5%   { opacity: 1; }
  15%  { opacity: 1; }
  20%  { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(100%); opacity: 0; }
}
animation: flow 5s linear infinite
```

**Spin (Loading):**
```css
@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
animation: spin 1s linear infinite

/* Component */
<div className="w-4 h-4 border-2 border-white border-t-transparent
                rounded-full animate-spin" />
```

**Fade In:**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
```

**Slide Up:**
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 0.3s ease-out;
}
```

### Hover Effects

**Button Lift:**
```css
.btn-hover-lift {
  transition: all 0.2s ease-in-out;
}

.btn-hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

**Card Hover:**
```css
.card-hover {
  transition: all 0.3s ease-in-out;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
```

**Table Row Hover:**
```css
.table-row-hover {
  transition: background-color 0.2s ease-in-out;
}

.table-row-hover:hover {
  background-color: #f8fafc;
}
```

---

## 🎨 Gradients

### Background Gradients

```css
/* Primary Gradient */
.gradient-primary {
  background: linear-gradient(135deg, #0099FF 0%, #0080d6 100%);
}

/* Success Gradient */
.gradient-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

/* Warning Gradient */
.gradient-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

/* Danger Gradient */
.gradient-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

/* Page Background */
bg-gradient-to-br from-thai-gray-25 to-white
```

---

## 🖱️ Utility Classes

### Scrollbar Customization

```css
/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Hide Scrollbar แต่ยังเลื่อนได้ */
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
```

### Backdrop Effects

```css
/* Blur สำหรับ Modal Backdrop */
backdrop-blur-sm: backdrop-filter: blur(4px)
backdrop-blur:    backdrop-filter: blur(8px)

/* Glass Morphism Effect */
bg-white/80 backdrop-blur-sm border border-white/20
```

### Text Shadows

```css
.text-shadow-sm {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.text-shadow {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### Status Indicators

```css
.status-indicator::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -12px;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-success::before  { background-color: #10b981; }
.status-warning::before  { background-color: #f59e0b; }
.status-danger::before   { background-color: #ef4444; }
.status-info::before     { background-color: #0099FF; }
```

### Tooltips

```css
.tooltip {
  position: relative;
}

.tooltip:hover .tooltip-content {
  opacity: 1;
  visibility: visible;
  transform: translateY(-5px);
}

.tooltip-content {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  padding: 8px 12px;
  background-color: #1f2937;
  color: white;
  font-size: 0.875rem;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease-in-out;
  z-index: 50;
}
```

---

## 📱 Responsive Breakpoints

```css
/* Tailwind Default Breakpoints */
sm:  640px   /* Small devices (landscape phones) */
md:  768px   /* Medium devices (tablets) */
lg:  1024px  /* Large devices (desktops) */
xl:  1280px  /* Extra large devices */
2xl: 1536px  /* 2K screens */

/* Mobile First Approach */
/* Base styles = Mobile */
/* sm: = Tablet and up */
/* lg: = Desktop and up */
```

**ตัวอย่าง:**
```tsx
// ซ่อนบนมือถือ แสดงบน Desktop
<div className="hidden lg:block">Desktop Only</div>

// แสดงเฉพาะมือถือ
<div className="block lg:hidden">Mobile Only</div>

// เปลี่ยนขนาดตามหน้าจอ
<div className="text-sm lg:text-base xl:text-lg">
  Responsive Text
</div>
```

---

## 🎯 Best Practices

### 1. การใช้สีอย่างสอดคล้อง

```tsx
✅ GOOD - ใช้ semantic colors
<Badge variant="success">สำเร็จ</Badge>
<Badge variant="danger">ผิดพลาด</Badge>

❌ BAD - ใช้สีแบบ hardcode
<span className="bg-green-100 text-green-800">สำเร็จ</span>
```

### 2. Spacing ที่สม่ำเสมอ

```tsx
✅ GOOD - ใช้ spacing scale
<div className="space-y-4">  {/* 16px */}
  <div className="p-4">       {/* 16px */}
    <div className="mb-4">    {/* 16px */}

❌ BAD - ใช้ค่าที่ไม่ได้มาจาก scale
<div style={{ marginBottom: '15px' }}>
```

### 3. Typography Hierarchy

```tsx
✅ GOOD - ลำดับชั้นชัดเจน
<h1 className="text-xl font-bold">หัวข้อหลัก</h1>
<h2 className="text-lg font-semibold">หัวข้อรอง</h2>
<p className="text-sm">เนื้อหา</p>

❌ BAD - ขนาดไม่สอดคล้อง
<h1 className="text-base">หัวข้อหลัก</h1>
<p className="text-2xl">เนื้อหา</p>
```

### 4. Font Family สำหรับข้อความไทย

```tsx
✅ GOOD - ระบุ font-thai
<p className="font-thai">ข้อความภาษาไทย</p>
<h1 className="text-xl font-bold font-thai">หัวข้อ</h1>

✅ GOOD - ใช้ font-mono สำหรับรหัส
<code className="font-mono">GR-202511-0001</code>
<div className="font-mono text-xs">8854052308100</div>
```

### 5. Responsive Design

```tsx
✅ GOOD - Mobile First
<div className="text-sm md:text-base lg:text-lg">
  <div className="p-4 md:p-6 lg:p-8">

❌ BAD - Desktop First
<div className="text-lg md:text-sm">
```

### 6. Accessibility

```tsx
✅ GOOD - มี focus states
<button className="focus:ring-2 focus:ring-primary-500">

✅ GOOD - มี alt text และ title
<img alt="Product image" />
<div title="รายละเอียดเพิ่มเติม">...</div>

✅ GOOD - ใช้ semantic HTML
<button>Click me</button>

❌ BAD - ไม่มี focus states
<div onClick={...}>Click</div>
```

### 7. Performance

```tsx
✅ GOOD - ใช้ transitions เฉพาะที่จำเป็น
<div className="transition-colors duration-200">

❌ BAD - transition-all ทุกอย่าง
<div className="transition-all">
```

### 8. Consistency ในการใช้ Component

```tsx
✅ GOOD - ใช้ Component ที่มีอยู่
<Button variant="primary" size="md">บันทึก</Button>
<Badge variant="success">สำเร็จ</Badge>

❌ BAD - สร้างสไตล์เอง
<button className="bg-blue-500 px-4 py-2 rounded">บันทึก</button>
<span className="bg-green-100 text-green-800 px-2 py-1">สำเร็จ</span>
```

---

## 📋 Quick Reference Table

### สรุปขนาดทั่วไป

| Element | Padding | Font Size | Border Radius | Use Case |
|---------|---------|-----------|---------------|----------|
| Button SM | px-3 py-1.5 | text-sm (14px) | rounded-lg | ปุ่มเล็ก, ในตาราง |
| Button MD | px-4 py-2 | text-sm (14px) | rounded-lg | ⭐ ปุ่มปกติ |
| Button LG | px-6 py-3 | text-base (16px) | rounded-lg | ปุ่มใหญ่, CTA |
| Badge SM | px-2 py-0.5 | text-xs (12px) | rounded-full | ⭐ Badge ในตาราง |
| Badge MD | px-2.5 py-0.5 | text-sm (14px) | rounded-full | Badge ปกติ |
| Input | px-3 py-1.5 | text-sm (14px) | rounded-lg | ⭐ Input ทั่วไป |
| Card | p-4 | - | rounded-lg | ⭐ Card ปกติ |
| Modal Header | p-6 | text-lg (18px) | - | หัวข้อ Modal |
| Table Header | px-2 py-3 | text-xs (12px) | - | หัวตาราง |
| Table Cell | px-1.5 py-1 | text-xs (12px) | - | ⭐ ช่องในตาราง |
| Page Title | - | text-xl (20px) | - | หัวข้อหน้า |
| Stats Value | - | text-2xl (24px) | - | ตัวเลขสถิติ |

### สีที่ใช้บ่อย

| Purpose | Class | Color Code |
|---------|-------|------------|
| Primary Blue | bg-primary-500 | #0099FF |
| Text Primary | text-thai-gray-800 | #1f2937 |
| Text Secondary | text-thai-gray-600 | #4b5563 |
| Border | border-thai-gray-200 | #e5e7eb |
| Background | bg-thai-gray-50 | #f9fafb |
| Success | bg-green-500 | #10b981 |
| Warning | bg-yellow-500 | #eab308 |
| Danger | bg-red-500 | #ef4444 |

---

## 🔗 Related Files

- **Tailwind Config:** `tailwind.config.js`
- **Global CSS:** `app/globals.css`
- **Components:** `components/ui/*.tsx`
- **Layout:** `app/layout.tsx`

---

**สร้างโดย:** Claude Code
**วันที่:** 7 พฤศจิกายน 2025
**เวอร์ชัน:** 1.0
