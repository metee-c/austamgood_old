// app/command-center/components/error-monitor.tsx
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

export async function ErrorMonitor() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('wms_errors')
    .select(`
      error_id,
      transaction_id,
      error_code,
      error_message,
      operation_type,
      entity_type,
      entity_id,
      occurred_at
    `)
    .order('occurred_at', { ascending: false })
    .limit(15);

  if (error) {
    console.error('Error fetching error logs:', error);
  }

  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold font-thai text-red-700">Error Monitor</h2>
        <span className="text-xs text-muted-foreground">ล่าสุด 15 รายการ</span>
      </div>

      {!data || data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-green-600 text-2xl mb-2">✓</div>
          <p className="font-thai">ไม่มี Error</p>
          <p className="text-xs mt-1">ระบบทำงานปกติ</p>
        </div>
      ) : (
        <ul className="space-y-2 text-sm max-h-[400px] overflow-y-auto">
          {data.map((err) => (
            <li 
              key={err.error_id} 
              className="py-2 px-3 rounded-md bg-red-50 border border-red-100"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-red-700">
                  {err.error_code || 'UNKNOWN'}
                </span>
                {err.occurred_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(err.occurred_at), { 
                      addSuffix: true,
                      locale: th 
                    })}
                  </span>
                )}
              </div>
              <p className="text-red-600 mt-1 text-xs line-clamp-2">
                {err.error_message || 'No message'}
              </p>
              {(err.operation_type || err.entity_type) && (
                <div className="text-xs text-muted-foreground mt-1">
                  {err.operation_type && <span>{err.operation_type}</span>}
                  {err.entity_type && <span> • {err.entity_type}</span>}
                  {err.entity_id && <span> #{err.entity_id}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
