# Issues by File Report
## วันที่: 11 มกราคม 2026

---

## 1. app/api/mobile/pick/scan/route.ts

**Total Issues: 11** (Critical: 2, High: 2, Medium: 3, Low: 4)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C02 | 1-500 | ไม่มี database transaction |
| 2 | C03 | ~150 | Race condition - ไม่มี row locking |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | ~50 | ไม่ validate scanned_code format |
| 2 | H03 | ~30 | ใช้ fallback userId = 1 |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M02 | ~30 | Hardcoded fallback userId = 1 |
| 2 | M04 | ~400 | Status transition ไม่ atomic |
| 3 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log มาก |
| 3 | L03 | - | Code ซ้ำกับ loading/complete |
| 4 | L04 | - | ไม่มี JSDoc |

---

## 2. app/api/mobile/loading/complete/route.ts

**Total Issues: 14** (Critical: 2, High: 3, Medium: 4, Low: 5)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |
| 2 | C02 | 1-953 | ไม่มี database transaction |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | ~40 | ไม่ validate input อย่างเต็มที่ |
| 2 | H03 | ~30 | ใช้ fallback userId = 1 |
| 3 | H04 | ~80 | ไม่มี idempotency key |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M02 | ~350 | Hardcoded warehouse_id = 'WH001' |
| 2 | M04 | ~730 | Status update ก่อน stock movement |
| 3 | M05 | - | ไม่ log user actions |
| 4 | M01 | - | Error handling ไม่ครบ |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log 50+ จุด |
| 3 | L03 | - | Code ซ้ำกับ pick/scan |
| 4 | L04 | - | ไม่มี JSDoc |
| 5 | L05 | - | File ยาวมาก (953 lines) |

---

## 3. app/api/loadlists/route.ts

**Total Issues: 10** (Critical: 1, High: 3, Medium: 3, Low: 3)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | ไม่ validate input อย่างเต็มที่ |
| 2 | H04 | POST | ไม่มี idempotency key |
| 3 | H05 | POST | ไม่ validate FK references |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M03 | - | ไม่มี DELETE handler |
| 3 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log |
| 3 | L05 | - | File ยาวมาก |

---

## 4. app/api/orders/route.ts

**Total Issues: 8** (Critical: 1, High: 3, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | GET | searchTerm ไม่ sanitize |
| 2 | H04 | POST | ไม่ป้องกัน duplicate |
| 3 | H05 | POST | ไม่ validate customer_id |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M03 | - | ไม่มี DELETE handler |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |
| 2 | L01 | - | ใช้ any ใน reduce |

---

## 5. app/api/receives/route.ts

**Total Issues: 7** (Critical: 1, High: 2, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | Validation ไม่ครบ |
| 2 | H05 | POST | ไม่ validate FK references |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M03 | - | ไม่มี DELETE handler |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |
| 2 | L01 | - | ใช้ any ใน filters |

---

## 6. lib/database/receive.ts

**Total Issues: 6** (Critical: 1, High: 1, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C05 | 3-6 | ใช้ SUPABASE_SERVICE_ROLE_KEY |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | - | ไม่ validate input ใน service |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log operations |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L04 | - | Comments ไม่ครบ |

---

## 7. lib/database/stock-adjustment.ts

**Total Issues: 6** (Critical: 1, High: 1, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C05 | 10-13 | ใช้ SUPABASE_SERVICE_ROLE_KEY |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่ตรวจสอบ permission ใน service |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M02 | ~380 | Hardcoded ADJ_LOSS_LOCATION |
| 2 | M05 | - | ไม่ log operations |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.error |

---

## 8. app/api/stock-adjustments/[id]/route.ts

**Total Issues: 5** (Critical: 0, High: 2, Medium: 2, Low: 1)

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | GET/PATCH/DELETE | ไม่ตรวจสอบ ownership |
| 2 | H03 | - | ใช้ supabase.auth.getUser() |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## Summary Table

| File | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| mobile/loading/complete/route.ts | 2 | 3 | 4 | 5 | 14 |
| mobile/pick/scan/route.ts | 2 | 2 | 3 | 4 | 11 |
| loadlists/route.ts | 1 | 3 | 3 | 3 | 10 |
| orders/route.ts | 1 | 3 | 2 | 2 | 8 |
| receives/route.ts | 1 | 2 | 2 | 2 | 7 |
| lib/database/receive.ts | 1 | 1 | 2 | 2 | 6 |
| lib/database/stock-adjustment.ts | 1 | 1 | 2 | 2 | 6 |
| stock-adjustments/[id]/route.ts | 0 | 2 | 2 | 1 | 5 |
| **Total** | **9** | **17** | **20** | **21** | **67** |

---

## Files Requiring Immediate Attention

1. **app/api/mobile/loading/complete/route.ts** - 14 issues
   - ต้องเพิ่ม authentication
   - ต้องใช้ database transaction
   - ต้อง refactor ให้สั้นลง

2. **app/api/mobile/pick/scan/route.ts** - 11 issues
   - ต้องเพิ่ม row locking
   - ต้องใช้ database transaction

3. **app/api/loadlists/route.ts** - 10 issues
   - ต้องเพิ่ม authentication
   - ต้องเพิ่ม input validation

4. **lib/database/receive.ts** & **lib/database/stock-adjustment.ts**
   - ต้องเปลี่ยนจาก service role key เป็น server client


---

## 9. app/api/moves/route.ts

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | Validation ไม่ครบ - ไม่ validate warehouse exists |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 10. app/api/moves/quick-move/route.ts

**Total Issues: 8** (Critical: 1, High: 3, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check - ย้ายสต็อคได้โดยไม่ต้อง login |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | ไม่ validate pallet_id format |
| 2 | H06 | - | ไม่มี transaction - ถ้า error ระหว่างทางจะมี orphan records |
| 3 | H07 | - | ไม่มี user context tracking เลย |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L04 | - | ไม่มี JSDoc |

---

## 11. app/api/bonus-face-sheets/route.ts

**Total Issues: 9** (Critical: 1, High: 3, Medium: 3, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H06 | POST | ไม่มี transaction - สร้าง packages และ items แยกกัน |
| 2 | H04 | POST | ไม่มี idempotency key |
| 3 | H05 | POST | ไม่ validate order_id exists |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M02 | POST | `warehouse_id = 'WH001'` default hardcoded |
| 2 | M01 | - | Error handling ไม่ครบ |
| 3 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log |

---

## 12. app/api/face-sheets/generate/route.ts

**Total Issues: 7** (Critical: 1, High: 2, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H06 | POST | Stock reservation แยกจาก face sheet creation - อาจ fail หลังสร้างแล้ว |
| 2 | H04 | POST | ไม่มี idempotency key (แม้จะมี duplicate check) |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log |

---

## 13. app/api/inventory-balances/reset-reservations/route.ts

**Total Issues: 5** (Critical: 1, High: 2, Medium: 1, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C06 | 1 | Dangerous admin API - ล้างยอดจองทั้งหมดโดยไม่มี authentication |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | POST | ไม่มี authorization check - ใครก็เรียกได้ |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M05 | - | ไม่ log who performed the reset |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## 14. lib/database/move.ts

**Total Issues: 7** (Critical: 1, High: 1, Medium: 3, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C05 | 1-6 | ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรง |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | - | ไม่ validate input ใน service functions |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M02 | - | Weight estimation hardcoded (0.5 kg per piece) |
| 3 | M05 | - | ไม่ log operations |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L04 | - | Comments ไม่ครบ |

---

## 15. app/api/picklists/create-from-trip/route.ts

**Total Issues: 8** (Critical: 1, High: 2, Medium: 3, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H06 | POST | Manual rollback แต่ไม่ครอบคลุมทุก case |
| 2 | H04 | POST | ไม่มี idempotency key (แม้จะมี existing check) |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M04 | - | Status transition ไม่ atomic |
| 3 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log |

---

## 16. app/api/mobile/face-sheet/scan/route.ts

**Total Issues: 6** (Critical: 0, High: 2, Medium: 2, Low: 2)

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H07 | ~10 | ใช้ `userId = 1` เป็น fallback |
| 2 | H06 | - | ไม่มี transaction - balance update และ ledger insert แยกกัน |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M04 | - | Status transition ไม่ atomic |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log |

---

## 17. app/api/mobile/bonus-face-sheet/scan/route.ts

**Total Issues: 6** (Critical: 0, High: 2, Medium: 2, Low: 2)

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H07 | ~10 | ใช้ `userId = 1` เป็น fallback |
| 2 | H06 | - | ไม่มี transaction - balance update และ ledger insert แยกกัน |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M04 | - | Status transition ไม่ atomic |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type |
| 2 | L02 | หลายที่ | มี console.log |

---

## 18. app/api/users/route.ts (Good Example)

**Total Issues: 1** (Critical: 0, High: 0, Medium: 0, Low: 1)

### Positive Findings
- ✅ มี session validation (`getCurrentSession`)
- ✅ มี audit logging
- ✅ มี input validation
- ✅ มี password hashing

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | หลายที่ | ใช้ any type ใน transform |

---

## 19. lib/auth/middleware.ts (Good Example)

**Total Issues: 0** (Critical: 0, High: 0, Medium: 0, Low: 0)

### Positive Findings
- ✅ มี `authenticateRequest` middleware ที่ครบถ้วน
- ✅ มี permission checking
- ✅ มี role-based access control
- ✅ มี rate limiting implementation
- ✅ มี audit logging

---

## Updated Summary Table

| File | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| mobile/loading/complete/route.ts | 2 | 3 | 4 | 5 | 14 |
| mobile/pick/scan/route.ts | 2 | 2 | 3 | 4 | 11 |
| loadlists/route.ts | 1 | 3 | 3 | 3 | 10 |
| bonus-face-sheets/route.ts | 1 | 3 | 3 | 2 | 9 |
| orders/route.ts | 1 | 3 | 2 | 2 | 8 |
| moves/quick-move/route.ts | 1 | 3 | 2 | 2 | 8 |
| picklists/create-from-trip/route.ts | 1 | 2 | 3 | 2 | 8 |
| receives/route.ts | 1 | 2 | 2 | 2 | 7 |
| lib/database/move.ts | 1 | 1 | 3 | 2 | 7 |
| face-sheets/generate/route.ts | 1 | 2 | 2 | 2 | 7 |
| lib/database/receive.ts | 1 | 1 | 2 | 2 | 6 |
| lib/database/stock-adjustment.ts | 1 | 1 | 2 | 2 | 6 |
| moves/route.ts | 1 | 2 | 2 | 1 | 6 |
| mobile/face-sheet/scan/route.ts | 0 | 2 | 2 | 2 | 6 |
| mobile/bonus-face-sheet/scan/route.ts | 0 | 2 | 2 | 2 | 6 |
| inventory-balances/reset-reservations/route.ts | 1 | 2 | 1 | 1 | 5 |
| stock-adjustments/[id]/route.ts | 0 | 2 | 2 | 1 | 5 |
| users/route.ts | 0 | 0 | 0 | 1 | 1 |
| lib/auth/middleware.ts | 0 | 0 | 0 | 0 | 0 |
| **Total** | **16** | **36** | **40** | **38** | **130** |

---

## Files Requiring Immediate Attention (Updated)

1. **app/api/mobile/loading/complete/route.ts** - 14 issues
   - ต้องเพิ่ม authentication
   - ต้องใช้ database transaction
   - ต้อง refactor ให้สั้นลง

2. **app/api/mobile/pick/scan/route.ts** - 11 issues
   - ต้องเพิ่ม row locking
   - ต้องใช้ database transaction

3. **app/api/loadlists/route.ts** - 10 issues
   - ต้องเพิ่ม authentication
   - ต้องเพิ่ม input validation

4. **app/api/bonus-face-sheets/route.ts** - 9 issues
   - ต้องเพิ่ม authentication
   - ต้องใช้ database transaction

5. **app/api/moves/quick-move/route.ts** - 8 issues
   - ต้องเพิ่ม authentication ทันที (ย้ายสต็อคได้โดยไม่ต้อง login!)
   - ต้องเพิ่ม user context tracking

6. **app/api/inventory-balances/reset-reservations/route.ts** - 5 issues
   - **CRITICAL**: ต้องเพิ่ม authentication และ authorization ทันที
   - API นี้อันตรายมาก - ล้างยอดจองทั้งหมดได้

7. **lib/database/receive.ts** & **lib/database/stock-adjustment.ts** & **lib/database/move.ts**
   - ต้องเปลี่ยนจาก service role key เป็น server client


---

## 20. app/api/master-customer/route.ts (NEW)

**Total Issues: 7** (Critical: 1, High: 2, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C08 | 1 | ไม่มี authentication check - GET/POST/PUT/DELETE ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authorization check - ใครก็แก้ไข/ลบข้อมูลลูกค้าได้ |
| 2 | H07 | - | ไม่มี user context tracking - ไม่รู้ว่าใครแก้ไข |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M03 | DELETE | ไม่ตรวจสอบ cascade delete - orders ที่อ้างอิง customer จะ orphan |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | - | ใช้ any type ใน error handling |
| 2 | L04 | - | ไม่มี JSDoc |

---

## 21. app/api/master-supplier/route.ts (NEW)

**Total Issues: 7** (Critical: 1, High: 2, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C08 | 1 | ไม่มี authentication check - GET/POST/PUT/DELETE ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authorization check - ใครก็แก้ไข/ลบข้อมูล supplier ได้ |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M03 | DELETE | ไม่ตรวจสอบ cascade delete - vehicles/receives ที่อ้างอิง supplier จะ orphan |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | - | ใช้ any type |
| 2 | L04 | - | ไม่มี JSDoc |

---

## 22. app/api/master-employee/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C08 | 1 | ไม่มี authentication check - GET/POST/PUT/DELETE ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authorization check - ใครก็แก้ไข/ลบข้อมูลพนักงานได้ |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M03 | DELETE | ไม่ตรวจสอบ cascade delete - user accounts ที่อ้างอิง employee จะ orphan |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 23. app/api/master-warehouse/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C08 | 1 | ไม่มี authentication check - GET/POST/PUT/DELETE ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authorization check - ใครก็แก้ไข/ลบข้อมูลคลังได้ |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M03 | DELETE | ไม่ตรวจสอบ cascade delete - locations/inventory ที่อ้างอิง warehouse จะ orphan |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 24. app/api/master-sku/route.ts (NEW)

**Total Issues: 5** (Critical: 1, High: 1, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C08 | 1 | ไม่มี authentication check - GET/POST ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 25. app/api/skus/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 1, Medium: 2, Low: 2)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C09 | 1-10 | ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรง - bypass RLS ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authentication/authorization - ใครก็ดูข้อมูล SKU ทั้งหมดได้ |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L01 | - | ใช้ any type |
| 2 | L04 | - | ไม่มี JSDoc |

---

## 26. app/api/route-plans/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check - GET/POST ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | ไม่ validate input body |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## 27. app/api/stock-count/sessions/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check - GET/POST ทั้งหมด |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | ไม่ validate counted_by |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M02 | POST | `warehouse_id: 'WH001'` default hardcoded |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 28. app/api/stock-count/scan/route.ts (NEW)

**Total Issues: 5** (Critical: 1, High: 1, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H01 | POST | ไม่ validate scanned_code format |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 29. app/api/stock-import/upload/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C10 | 1 | ไม่มี authentication check - upload stock data ได้โดยไม่ต้อง login |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H07 | ~70 | ใช้ `userId = 1` hardcoded - ไม่รู้ว่าใคร upload |
| 2 | H01 | - | ไม่ validate file content อย่างเต็มที่ |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## 30. app/api/stock-import/process/route.ts (NEW)

**Total Issues: 5** (Critical: 0, High: 2, Medium: 2, Low: 1)

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H07 | ~30 | ใช้ `userId = 1` fallback - ไม่ถูกต้อง |
| 2 | H01 | - | ไม่ validate batch_id format |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## 31. app/api/admin/migrate-supplier/route.ts (NEW)

**Total Issues: 5** (Critical: 1, High: 2, Medium: 1, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C10 | 1 | ไม่มี authentication check - admin API ที่ insert sample data ได้ |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authorization check - ต้องเป็น admin เท่านั้น |
| 2 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L04 | - | ไม่มี JSDoc |

---

## 32. app/api/file-uploads/route.ts (NEW)

**Total Issues: 6** (Critical: 1, High: 2, Medium: 2, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C09 | ~30 | ใช้ `SUPABASE_SERVICE_ROLE_KEY` โดยตรงสำหรับ file upload |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H02 | - | ไม่มี authentication check - ใครก็ upload ไฟล์ได้ |
| 2 | H07 | ~100 | `created_by: 'system'` hardcoded - ไม่รู้ว่าใคร upload |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | - | ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## 33. app/api/production/orders/route.ts (NEW)

**Total Issues: 4** (Critical: 0, High: 1, Medium: 2, Low: 1)

### Positive Findings
- ✅ POST มี session validation (`getCurrentSession`)
- ✅ มี user context tracking สำหรับ POST

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H03 | GET | GET ไม่มี authentication - inconsistent กับ POST |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |
| 2 | M05 | GET | GET ไม่ log user actions |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## 34. app/api/production/actual/route.ts (NEW)

**Total Issues: 3** (Critical: 0, High: 0, Medium: 2, Low: 1)

### Positive Findings
- ✅ POST มี session validation (`getCurrentSession`)
- ✅ มี user context tracking
- ✅ มี validation ก่อน process
- ✅ ตรวจสอบ replenishment status ก่อนบันทึก

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M02 | ~15 | `DEFAULT_WAREHOUSE_ID = 'WH001'` hardcoded |
| 2 | M01 | - | Error handling ไม่ครบใน variance adjustment |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log มาก |

---

## 35. app/api/production/material-requisition/route.ts (NEW)

**Total Issues: 4** (Critical: 1, High: 1, Medium: 1, Low: 1)

### Critical Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | C01 | 1 | ไม่มี authentication check |

### High Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | H07 | - | ไม่มี user context tracking |

### Medium Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | M01 | - | Error handling ไม่ครบ |

### Low Issues
| # | Code | Line | Description |
|---|------|------|-------------|
| 1 | L02 | หลายที่ | มี console.log |

---

## Final Updated Summary Table

| File | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| mobile/loading/complete/route.ts | 2 | 3 | 4 | 5 | 14 |
| mobile/pick/scan/route.ts | 2 | 2 | 3 | 4 | 11 |
| loadlists/route.ts | 1 | 3 | 3 | 3 | 10 |
| bonus-face-sheets/route.ts | 1 | 3 | 3 | 2 | 9 |
| orders/route.ts | 1 | 3 | 2 | 2 | 8 |
| moves/quick-move/route.ts | 1 | 3 | 2 | 2 | 8 |
| picklists/create-from-trip/route.ts | 1 | 2 | 3 | 2 | 8 |
| master-customer/route.ts | 1 | 2 | 2 | 2 | 7 |
| master-supplier/route.ts | 1 | 2 | 2 | 2 | 7 |
| receives/route.ts | 1 | 2 | 2 | 2 | 7 |
| lib/database/move.ts | 1 | 1 | 3 | 2 | 7 |
| face-sheets/generate/route.ts | 1 | 2 | 2 | 2 | 7 |
| master-employee/route.ts | 1 | 2 | 2 | 1 | 6 |
| master-warehouse/route.ts | 1 | 2 | 2 | 1 | 6 |
| lib/database/receive.ts | 1 | 1 | 2 | 2 | 6 |
| lib/database/stock-adjustment.ts | 1 | 1 | 2 | 2 | 6 |
| moves/route.ts | 1 | 2 | 2 | 1 | 6 |
| mobile/face-sheet/scan/route.ts | 0 | 2 | 2 | 2 | 6 |
| mobile/bonus-face-sheet/scan/route.ts | 0 | 2 | 2 | 2 | 6 |
| skus/route.ts | 1 | 1 | 2 | 2 | 6 |
| route-plans/route.ts | 1 | 2 | 2 | 1 | 6 |
| stock-count/sessions/route.ts | 1 | 2 | 2 | 1 | 6 |
| stock-import/upload/route.ts | 1 | 2 | 2 | 1 | 6 |
| file-uploads/route.ts | 1 | 2 | 2 | 1 | 6 |
| inventory-balances/reset-reservations/route.ts | 1 | 2 | 1 | 1 | 5 |
| stock-adjustments/[id]/route.ts | 0 | 2 | 2 | 1 | 5 |
| master-sku/route.ts | 1 | 1 | 2 | 1 | 5 |
| stock-count/scan/route.ts | 1 | 1 | 2 | 1 | 5 |
| stock-import/process/route.ts | 0 | 2 | 2 | 1 | 5 |
| admin/migrate-supplier/route.ts | 1 | 2 | 1 | 1 | 5 |
| production/material-requisition/route.ts | 1 | 1 | 1 | 1 | 4 |
| production/orders/route.ts | 0 | 1 | 2 | 1 | 4 |
| production/actual/route.ts | 0 | 0 | 2 | 1 | 3 |
| users/route.ts | 0 | 0 | 0 | 1 | 1 |
| lib/auth/middleware.ts | 0 | 0 | 0 | 0 | 0 |
| **Total** | **28** | **60** | **68** | **55** | **211** |

---

## APIs Requiring Immediate Attention (Final Priority List)

### Priority 1: Dangerous APIs (ต้องแก้ทันที)
1. **app/api/inventory-balances/reset-reservations/route.ts** - ล้างยอดจองทั้งหมดได้
2. **app/api/moves/quick-move/route.ts** - ย้ายสต็อคได้โดยไม่ต้อง login
3. **app/api/admin/migrate-supplier/route.ts** - insert sample data ได้

### Priority 2: Master Data APIs (ป้องกันแก้ไข/ลบข้อมูลหลัก)
4. **app/api/master-customer/route.ts** - ลบข้อมูลลูกค้าได้
5. **app/api/master-supplier/route.ts** - ลบข้อมูล supplier ได้
6. **app/api/master-employee/route.ts** - ลบข้อมูลพนักงานได้
7. **app/api/master-warehouse/route.ts** - ลบข้อมูลคลังได้

### Priority 3: Stock-Critical APIs
8. **app/api/stock-import/upload/route.ts** - upload stock data ได้
9. **app/api/mobile/loading/complete/route.ts** - ต้องใช้ transaction
10. **app/api/mobile/pick/scan/route.ts** - ต้องใช้ transaction

### Priority 4: Service Role Key Usage
11. **app/api/skus/route.ts** - ใช้ service role key โดยตรง
12. **app/api/file-uploads/route.ts** - ใช้ service role key โดยตรง
13. **lib/database/receive.ts** - ใช้ service role key โดยตรง
14. **lib/database/stock-adjustment.ts** - ใช้ service role key โดยตรง
15. **lib/database/move.ts** - ใช้ service role key โดยตรง
