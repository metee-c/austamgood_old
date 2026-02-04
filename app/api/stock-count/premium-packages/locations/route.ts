import { NextResponse } from 'next/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

// GET - ดึงรายการโลเคชั่นบ้านหยิบพรีเมี่ยมทั้งหมด (hardcoded)
async function _GET() {
  // โลเคชั่นบ้านหยิบพรีเมี่ยม: MR01-MR10, PQ01-PQ10, MRTD, PQTD
  const locations: { code: string }[] = [];

  // MR01-MR10
  for (let i = 1; i <= 10; i++) {
    locations.push({ code: `MR${i.toString().padStart(2, '0')}` });
  }

  // PQ01-PQ10
  for (let i = 1; i <= 10; i++) {
    locations.push({ code: `PQ${i.toString().padStart(2, '0')}` });
  }

  // MRTD, PQTD
  locations.push({ code: 'MRTD' });
  locations.push({ code: 'PQTD' });

  return NextResponse.json({ success: true, data: locations });
}

export const GET = withShadowLog(_GET);
