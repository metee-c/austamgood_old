// app/command-center/page.tsx
// ศูนย์บัญชาการ - Command Center
// Excel-like activity monitoring with 100% API coverage

import { Suspense } from 'react';
import { CommandCenterClient } from './components/command-center-client';
import { SystemHealth } from './components/system-health';
import { StockDiscrepancyMonitor } from './components/stock-discrepancy-monitor';

export const dynamic = 'force-dynamic';

export default function CommandCenterPage() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-thai">ศูนย์บัญชาการ</h1>
        <span className="text-sm text-muted-foreground">
          Command Center - บันทึกทุกกิจกรรม 100%
        </span>
      </div>

      {/* Client-side tabbed interface */}
      <CommandCenterClient
        systemHealthSlot={
          <Suspense fallback={<div className="animate-pulse bg-muted h-40 rounded-lg" />}>
            <SystemHealth />
          </Suspense>
        }
        stockIntegritySlot={
          <Suspense fallback={<div className="animate-pulse bg-muted h-40 rounded-lg" />}>
            <StockDiscrepancyMonitor />
          </Suspense>
        }
      />
    </div>
  );
}
