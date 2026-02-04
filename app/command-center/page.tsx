// app/command-center/page.tsx
// ศูนย์บัญชาการ - Command Center
// Read-only dashboard for monitoring shadow logs

import { ActivityStream } from '@/app/command-center/components/activity-stream';
import { ErrorMonitor } from '@/app/command-center/components/error-monitor';
import { SystemHealth } from '@/app/command-center/components/system-health';
import { RefreshButton } from '@/app/command-center/components/refresh-button';
import { TransactionList } from '@/app/command-center/components/transaction-list';
import { StockDiscrepancyMonitor } from '@/app/command-center/components/stock-discrepancy-monitor';

export default function CommandCenterPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-thai">ศูนย์บัญชาการ</h1>
          <span className="text-sm text-muted-foreground">Command Center</span>
        </div>
        <RefreshButton autoRefreshInterval={30} />
      </div>

      <SystemHealth />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ActivityStream />
        <ErrorMonitor />
      </div>

      <StockDiscrepancyMonitor />

      <TransactionList />
    </div>
  );
}
