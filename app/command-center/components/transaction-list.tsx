// app/command-center/components/transaction-list.tsx
import { createServiceRoleClient } from '@/lib/supabase/server';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';

export async function TransactionList() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('wms_transactions')
    .select(`
      transaction_id,
      operation_type,
      operation_subtype,
      status,
      started_at,
      completed_at,
      duration_ms,
      reference_doc_no,
      user_id
    `)
    .order('started_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching transactions:', error);
  }

  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold font-thai">Transactions ล่าสุด</h2>
        <span className="text-xs text-muted-foreground">30 รายการ</span>
      </div>

      {!data || data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="font-thai">ยังไม่มี Transaction</p>
          <p className="text-xs mt-1">เมื่อมีการใช้งานระบบ จะแสดงที่นี่</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium">Operation</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
                <th className="text-left py-2 px-2 font-medium">Reference</th>
                <th className="text-left py-2 px-2 font-medium">Duration</th>
                <th className="text-left py-2 px-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.map((tx) => (
                <tr key={tx.transaction_id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <div className="font-medium">{tx.operation_type}</div>
                    {tx.operation_subtype && (
                      <div className="text-xs text-muted-foreground">{tx.operation_subtype}</div>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <TransactionStatus status={tx.status} />
                  </td>
                  <td className="py-2 px-2">
                    {tx.reference_doc_no ? (
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {tx.reference_doc_no}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {tx.duration_ms ? (
                      <span className="text-xs">{tx.duration_ms}ms</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">
                    {tx.started_at && formatDistanceToNow(new Date(tx.started_at), { 
                      addSuffix: true,
                      locale: th 
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionStatus({ status }: { status: string | null }) {
  if (!status) return null;

  const statusConfig: Record<string, { bg: string; text: string }> = {
    started: { bg: 'bg-blue-100', text: 'text-blue-700' },
    completed: { bg: 'bg-green-100', text: 'text-green-700' },
    failed: { bg: 'bg-red-100', text: 'text-red-700' },
    partial: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  };

  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {status.toUpperCase()}
    </span>
  );
}
