# Vehicle Limit Feature - Example Usage

## Scenario: 15 Orders, 10 Vehicle Limit

### Input
- **Orders**: 15 orders with varying weights
- **Vehicle Capacity**: 1000 kg per vehicle
- **Max Vehicles**: 10
- **Enforce Vehicle Limit**: ✅ Enabled

### Without Vehicle Limit
System might create 12 trips based on optimal capacity usage:
```
Trip 1: 950 kg (5 orders)
Trip 2: 920 kg (4 orders)
Trip 3: 880 kg (3 orders)
Trip 4: 940 kg (4 orders)
Trip 5: 910 kg (3 orders)
Trip 6: 890 kg (4 orders)
Trip 7: 870 kg (3 orders)
Trip 8: 900 kg (4 orders)
Trip 9: 850 kg (3 orders)
Trip 10: 930 kg (4 orders)
Trip 11: 860 kg (3 orders)
Trip 12: 840 kg (3 orders)
---
Total: 12 trips, all within capacity
```

### With Vehicle Limit (Max 10)
System consolidates to 10 trips, some may exceed capacity:
```
Trip 1: 950 kg (5 orders) ✅
Trip 2: 920 kg (4 orders) ✅
Trip 3: 880 kg (3 orders) ✅
Trip 4: 940 kg (4 orders) ✅
Trip 5: 910 kg (3 orders) ✅
Trip 6: 890 kg (4 orders) ✅
Trip 7: 1,720 kg (6 orders) ⚠️ OVERWEIGHT (merged Trip 7 + 8)
Trip 8: 1,780 kg (6 orders) ⚠️ OVERWEIGHT (merged Trip 9 + 10)
Trip 9: 1,700 kg (6 orders) ⚠️ OVERWEIGHT (merged Trip 11 + 12)
Trip 10: 1,650 kg (5 orders) ⚠️ OVERWEIGHT (merged remaining)
---
Total: 10 trips, 4 overweight trips marked with red warning
```

## UI Display

### Settings Panel
```
┌─────────────────────────────────────────┐
│ จำนวนรถสูงสุด (0 = ไม่จำกัด)           │
│ [10]                                    │
│                                         │
│ ☑ บังคับใช้จำนวนรถที่กำหนด             │
│   (อนุญาตให้น้ำหนักเกินได้)             │
│                                         │
│ ⚠️ รถที่น้ำหนักเกินจะแสดงเตือนสีแดง    │
└─────────────────────────────────────────┘
```

### Trip Preview (Normal)
```
┌─────────────────────────────────────────┐
│ เที่ยวที่ 1                             │
│ รถ: รถ-001 | คนขับ: สมชาย               │
│                          45.2 km • 5 จุด│
├─────────────────────────────────────────┤
│ ลำดับ | ออเดอร์ | จุดแวะ | น้ำหนัก      │
│   1   | ORD-001 | ลูกค้า A | 200 kg    │
│   2   | ORD-002 | ลูกค้า B | 180 kg    │
│   3   | ORD-003 | ลูกค้า C | 220 kg    │
│   4   | ORD-004 | ลูกค้า D | 190 kg    │
│   5   | ORD-005 | ลูกค้า E | 160 kg    │
├─────────────────────────────────────────┤
│ รวม: 950 kg                             │
└─────────────────────────────────────────┘
```

### Trip Preview (Overweight)
```
┌─────────────────────────────────────────┐
│ เที่ยวที่ 7  [⚠️ น้ำหนักเกิน]          │ ← RED BACKGROUND
│ รถ: รถ-007 | คนขับ: สมศักดิ์            │
│                          78.5 km • 6 จุด│
├─────────────────────────────────────────┤
│ ลำดับ | ออเดอร์ | จุดแวะ | น้ำหนัก      │
│   1   | ORD-019 | ลูกค้า S | 280 kg    │
│   2   | ORD-020 | ลูกค้า T | 290 kg    │
│   3   | ORD-021 | ลูกค้า U | 300 kg    │
│   4   | ORD-022 | ลูกค้า V | 270 kg    │
│   5   | ORD-023 | ลูกค้า W | 290 kg    │
│   6   | ORD-024 | ลูกค้า X | 290 kg    │
├─────────────────────────────────────────┤
│ รวม: 1,720 kg ⚠️ เกินความจุ 720 kg     │ ← RED TEXT
└─────────────────────────────────────────┘
```

## Use Cases

### 1. Limited Fleet
**Scenario**: Company has exactly 10 trucks available
**Solution**: Set max vehicles to 10, enable enforcement
**Result**: All orders fit into 10 trips, even if some are overweight

### 2. Driver Availability
**Scenario**: Only 8 drivers available today
**Solution**: Set max vehicles to 8, enable enforcement
**Result**: System consolidates into 8 trips maximum

### 3. Cost Optimization
**Scenario**: Fixed cost per vehicle is high, prefer fewer trips
**Solution**: Set max vehicles to desired number, enable enforcement
**Result**: Reduces number of trips, may increase weight per trip

### 4. Flexible Planning
**Scenario**: Want to see optimal plan first, then adjust
**Solution**: 
1. Run optimization with unlimited vehicles
2. Review result (e.g., 12 trips)
3. Adjust max vehicles to 10, re-optimize
4. Compare costs and feasibility

## Important Notes

1. **Weight Capacity**: When enforced, weight can exceed vehicle capacity
2. **Visual Warning**: Overweight trips are clearly marked in red
3. **Fewer Vehicles OK**: If system uses 7 out of 10 max, that's acceptable
4. **Manual Override**: Users can still manually adjust trips in editor
5. **Safety**: System warns but doesn't prevent overweight trips (user decision)

## Algorithm Behavior

### Consolidation Strategy
- Merges trips with **smallest combined weight** first
- Minimizes the severity of overweight situations
- Preserves as much capacity optimization as possible

### Example Consolidation
```
Before: Trip A (850 kg) + Trip B (840 kg) = 1,690 kg
        Trip C (950 kg) + Trip D (940 kg) = 1,890 kg

Algorithm chooses: Merge A + B (smaller combined weight)
Result: Trip AB (1,690 kg) ⚠️ overweight by 690 kg
        Trip C (950 kg) ✅
        Trip D (940 kg) ✅
```

## Testing Checklist

- [ ] Set max vehicles to 0 → Should create optimal number of trips
- [ ] Set max vehicles to 10 without enforcement → Should respect capacity
- [ ] Set max vehicles to 10 with enforcement → Should consolidate if needed
- [ ] Verify overweight trips show red warning
- [ ] Verify overweight flag saved to database
- [ ] Verify editor displays overweight warnings
- [ ] Verify preview modal displays overweight warnings
- [ ] Test with fewer orders than max vehicles → Should use fewer trips
- [ ] Test with many orders → Should consolidate to max vehicles
