// app/command-center/components/system-health.tsx
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function SystemHealth() {
  const supabase = createServiceRoleClient();

  // Get counts from shadow tables
  const [
    { count: totalTransactions },
    { count: totalActivities },
    { count: totalErrors },
    { count: recentActivities },
  ] = await Promise.all([
    supabase.from('wms_transactions').select('*', { count: 'exact', head: true }),
    supabase.from('wms_activity_logs').select('*', { count: 'exact', head: true }),
    supabase.from('wms_errors').select('*', { count: 'exact', head: true }),
    supabase
      .from('wms_activity_logs')
      .select('*', { count: 'exact', head: true })
      .gte('logged_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Get error rate (errors in last 24h / activities in last 24h)
  const { count: recentErrors } = await supabase
    .from('wms_errors')
    .select('*', { count: 'exact', head: true })
    .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const errorRate = recentActivities && recentActivities > 0 
    ? ((recentErrors || 0) / recentActivities * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat 
        label="Transactions ทั้งหมด" 
        value={totalTransactions ?? 0} 
        color="blue"
      />
      <Stat 
        label="Activities ทั้งหมด" 
        value={totalActivities ?? 0} 
        color="green"
      />
      <Stat 
        label="Errors ทั้งหมด" 
        value={totalErrors ?? 0} 
        color="red"
      />
      <Stat 
        label="Error Rate (24h)" 
        value={`${errorRate}%`} 
        color={parseFloat(errorRate) > 5 ? 'red' : 'green'}
      />
    </div>
  );
}

function Stat({ 
  label, 
  value, 
  color = 'gray' 
}: { 
  label: string; 
  value: number | string; 
  color?: 'blue' | 'green' | 'red' | 'gray';
}) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
    gray: 'border-gray-200 bg-gray-50',
  };

  const valueColorClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
    gray: 'text-gray-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="text-sm text-muted-foreground font-thai">{label}</div>
      <div className={`text-2xl font-bold ${valueColorClasses[color]}`}>{value}</div>
    </div>
  );
}
