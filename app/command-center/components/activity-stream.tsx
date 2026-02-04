// app/command-center/components/activity-stream.tsx
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export async function ActivityStream() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('wms_activity_logs')
    .select(`
      log_id,
      transaction_id,
      activity_type,
      activity_status,
      entity_type,
      entity_id,
      entity_no,
      duration_ms,
      logged_at
    `)
    .order('logged_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching activity logs:', error);
  }

  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold font-thai">Activity Stream</h2>
        <span className="text-xs text-muted-foreground">ล่าสุด 20 รายการ</span>
      </div>

      {!data || data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="font-thai">ยังไม่มี Activity</p>
          <p className="text-xs mt-1">เมื่อมีการใช้งานระบบ จะแสดงที่นี่</p>
        </div>
      ) : (
        <ul className="space-y-2 text-sm max-h-[400px] overflow-y-auto">
          {data.map((log) => (
            <li 
              key={log.log_id} 
              className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {log.activity_type}
                  </span>
                  {log.entity_no && (
                    <span className="text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                      #{log.entity_no}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {log.entity_type}
                  {log.duration_ms && ` • ${log.duration_ms}ms`}
                  {log.logged_at && (
                    <span className="ml-2">
                      {formatDistanceToNow(new Date(log.logged_at), { 
                        addSuffix: true,
                        locale: th 
                      })}
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge status={log.activity_status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: 'bg-green-100', text: 'text-green-700', label: 'SUCCESS' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'FAILED' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'PENDING' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'IN PROGRESS' },
  };

  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status.toUpperCase() };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
