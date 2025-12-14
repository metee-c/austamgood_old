# Remaining Warnings & Tech Debt Roadmap

## วันที่: 14 ธันวาคม 2025

## สถานะปัจจุบัน

### ✅ แก้เสร็จแล้ว (Completed)
1. **@supabase/auth-helpers-nextjs deprecated** - ✅ DONE
2. **[usePermission] No user warnings** - ✅ DONE
3. **Permission loading states** - ✅ DONE
4. **Build warning checker** - ✅ DONE

### 🟡 Warnings ที่เหลือ (Remaining)

#### 1. Middleware Convention Deprecated (HIGH Priority)
```
⚠️ The "middleware" file convention is deprecated. 
   Please use "proxy" instead.
```

**สถานะ**: 📝 Documented, รอ Next.js 17
**ความเสี่ยง**: HIGH - จะไม่ทำงานใน Next.js 17+
**แผนการแก้ไข**:
- **Q1 2025**: ติดตาม Next.js 17 beta release
- **Q2 2025**: ทดสอบ migration ใน staging
- **Q3 2025**: Deploy to production (หลัง Next.js 17 stable)

**Migration Steps** (เมื่อถึงเวลา):
```typescript
// 1. สร้างไฟล์ proxy.ts
// proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export default async function proxy(request: NextRequest) {
  // Copy logic from middleware.ts
  return NextResponse.next();
}

export const config = {
  runtime: 'edge',
  regions: ['iad1'], // หรือ region ที่ต้องการ
};

// 2. ลบ middleware.ts
// 3. Test ทั้งหมด
// 4. Deploy
```

**Estimated Time**: 4-6 hours

---

#### 2. npm Deprecated Packages (MEDIUM Priority)

##### 2.1 rimraf@3.0.2
```
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
```

**สถานะ**: ⏳ Transitive dependency
**ความเสี่ยง**: MEDIUM - Tech debt
**แผนการแก้ไข**:
```bash
# ตรวจสอบว่า package ไหนใช้
npm ls rimraf

# อัปเดต dependencies
npm update

# ถ้ายังมีอยู่ ใช้ overrides
# package.json
{
  "overrides": {
    "rimraf": "^5.0.0"
  }
}
```

**Estimated Time**: 2 hours

##### 2.2 glob@7.2.3
```
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
```

**สถานะ**: ⏳ Transitive dependency
**ความเสี่ยง**: MEDIUM - Performance & security
**แผนการแก้ไข**:
```bash
# ตรวจสอบ
npm ls glob

# อัปเดต
npm update

# ใช้ overrides ถ้าจำเป็น
# package.json
{
  "overrides": {
    "glob": "^10.0.0"
  }
}
```

**⚠️ Warning**: glob v10 มี breaking changes (callback → Promise)
**Estimated Time**: 4-6 hours (รวม testing)

##### 2.3 inflight@1.0.6
```
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.
```

**สถานะ**: ⏳ จะหายเมื่ออัปเดต glob
**ความเสี่ยง**: LOW - จะแก้ไขอัตโนมัติ
**แผนการแก้ไข**: รอการอัปเดต glob

##### 2.4 node-domexception@1.0.0
```
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
```

**สถานะ**: ✅ ไม่ต้องแก้
**เหตุผล**: Node.js 18+ มี DOMException built-in
**การดำเนินการ**: ไม่ต้องทำอะไร

##### 2.5 @humanwhocodes/config-array & object-schema
```
npm warn deprecated @humanwhocodes/config-array@0.13.0
npm warn deprecated @humanwhocodes/object-schema@2.0.3
```

**สถานะ**: ⏳ รอการอัปเดต ESLint
**ความเสี่ยง**: LOW - จะหายเมื่ออัปเดต ESLint 9
**แผนการแก้ไข**: รอ ESLint 9 migration

---

#### 3. ESLint 8 Deprecated (MEDIUM Priority)
```
npm warn deprecated eslint@8.57.1: This version is no longer supported.
```

**สถานะ**: 📝 Lock version, วางแผน migration
**ความเสี่ยง**: MEDIUM - ไม่รับ security updates
**แผนการแก้ไข**:

**Phase 1: Lock Version (ทำแล้ว)**
```json
{
  "devDependencies": {
    "eslint": "^8"
  }
}
```

**Phase 2: Plan Migration (Q1 2025)**
```bash
# 1. ติดตั้ง ESLint 9
npm install eslint@9 @eslint/js @eslint/eslintrc --save-dev

# 2. สร้าง eslint.config.js (Flat Config)
# 3. ทดสอบ
# 4. ลบ .eslintrc.json
```

**Breaking Changes**:
- ต้องใช้ Flat Config (eslint.config.js)
- ไม่รองรับ .eslintrc.* อีกต่อไป
- Plugin system เปลี่ยนแปลง

**Estimated Time**: 8-12 hours

---

#### 4. xlsx Package Vulnerabilities (LOW Priority)
```
1 high severity vulnerability
Some issues need review, and may require choosing a different dependency.
```

**สถานะ**: ⏳ รอ upstream fix
**ความเสี่ยง**: LOW - ไม่ critical สำหรับ production
**แผนการแก้ไข**:
- ติดตาม xlsx updates
- พิจารณา alternatives: exceljs, sheetjs-style
- ไม่ block deployment

---

## Roadmap Timeline

### Sprint 1 (ปัจจุบัน) - ✅ DONE
- [x] Migrate @supabase/auth-helpers → @supabase/ssr
- [x] Fix usePermission warnings
- [x] Add build warning checker
- [x] Create documentation

### Sprint 2 (มกราคม 2025)
- [ ] อัปเดต glob เป็น v10+
- [ ] อัปเดต rimraf dependencies
- [ ] ทดสอบ regression ทั้งหมด
- [ ] Estimated: 8-10 hours

### Sprint 3 (กุมภาพันธ์ 2025)
- [ ] วางแผน ESLint 9 migration
- [ ] สร้าง eslint.config.js (Flat Config)
- [ ] ทดสอบใน branch แยก
- [ ] Estimated: 8-12 hours

### Sprint 4 (มีนาคม 2025)
- [ ] Deploy ESLint 9 to staging
- [ ] Test และ fix issues
- [ ] Deploy to production
- [ ] Estimated: 4-6 hours

### Future (Q2-Q3 2025)
- [ ] ติดตาม Next.js 17 release
- [ ] Plan middleware → proxy migration
- [ ] Test และ deploy
- [ ] Estimated: 4-6 hours

---

## Monitoring & Maintenance

### Weekly Tasks
```bash
# ทุกวันจันทร์
npm run check-deps
npm audit
npm run check-middleware
```

### Monthly Tasks
```bash
# ทุกต้นเดือน
npm outdated
npm audit fix
npm run build:check
```

### Quarterly Tasks
- Review และอัปเดต dependencies
- ตรวจสอบ security advisories
- วางแผน major upgrades

---

## CI/CD Integration

### GitHub Actions (แนะนำ)
```yaml
# .github/workflows/quality-check.yml
name: Quality Check

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run typecheck
      
      - name: Lint
        run: npm run lint
      
      - name: Build
        run: npm run build
      
      - name: Check build warnings
        run: node scripts/check-build-warnings.js
      
      - name: Security audit
        run: npm audit --audit-level=moderate
```

---

## Alerts & Notifications

### ควรตั้ง Alerts สำหรับ:
1. ❗ Build time > 10 minutes
2. ❗ Bundle size เพิ่ม > 10%
3. ❗ Deprecated package ถูกติดตั้ง
4. ❗ Security vulnerability (high/critical)
5. ❗ Test coverage ลดลง > 5%

---

## Summary

### ✅ Completed (100%)
- Supabase auth migration
- Permission system improvements
- Build monitoring tools
- Documentation

### 🟡 In Progress (0%)
- Dependency updates (glob, rimraf)
- ESLint 9 planning

### ⏳ Planned (0%)
- ESLint 9 migration (Q1 2025)
- Middleware → proxy migration (Q2-Q3 2025)

### 📊 Overall Progress
- **Critical Issues**: 100% ✅
- **High Priority**: 0% (middleware - รอ Next.js 17)
- **Medium Priority**: 0% (dependencies, ESLint)
- **Low Priority**: 0% (xlsx vulnerabilities)

### 🎯 Next Actions
1. **ทันที**: Deploy current fixes to production
2. **สัปดาห์หน้า**: เริ่ม Sprint 2 (dependency updates)
3. **เดือนหน้า**: เริ่ม ESLint 9 planning
4. **ไตรมาสหน้า**: ติดตาม Next.js 17 release

---

**หมายเหตุ**: เอกสารนี้จะถูกอัปเดตทุกครั้งที่มีความคืบหน้า

**Last Updated**: 14 ธันวาคม 2025
**Next Review**: 21 ธันวาคม 2025
