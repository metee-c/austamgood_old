'use client';

import { useState, useEffect } from 'react';
import { History, User, Clock, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface RollbackHistoryItem {
  log_id: number;
  action: string;
  user_id: number;
  reason: string;
  previous_status: string;
  new_status: string;
  affected_documents: any;
  rollback_summary: any;
  created_at: string;
  user_name?: string;
}

interface RollbackHistoryTableProps {
  orderId: number;
  className?: string;
}

export default function RollbackHistoryTable({ orderId, className = '' }: RollbackHistoryTableProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<RollbackHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/orders/${orderId}/rollback-history`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || 'ไม่สามารถดึงข้อมูลได้');
          return;
        }

        setHistory(data.data || []);
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาด');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [orderId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 text-red-600 ${className}`}>
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>ไม่มีประวัติการ Rollback</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="font-medium text-gray-900 flex items-center gap-2">
        <History className="w-4 h-4" />
        ประวัติการ Rollback ({history.length})
      </h3>

      <div className="border rounded-lg divide-y">
        {history.map((item) => (
          <div key={item.log_id} className="bg-white">
            {/* Header Row */}
            <button
              onClick={() => setExpandedId(expandedId === item.log_id ? null : item.log_id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    {format(new Date(item.created_at), 'dd MMM yyyy HH:mm', { locale: th })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{item.user_name}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {item.previous_status}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {item.new_status}
                  </span>
                </div>
              </div>
              {expandedId === item.log_id ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Expanded Details */}
            {expandedId === item.log_id && (
              <div className="px-4 pb-4 pt-2 bg-gray-50 border-t">
                {/* Reason */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">เหตุผล</p>
                  <p className="text-sm text-gray-700">{item.reason || '-'}</p>
                </div>

                {/* Summary */}
                {item.rollback_summary && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">สรุปการดำเนินการ</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">Picklist Items</p>
                        <p className="font-medium">{item.rollback_summary.picklistItemsVoided || 0}</p>
                      </div>
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">Face Sheet Items</p>
                        <p className="font-medium">{item.rollback_summary.faceSheetItemsVoided || 0}</p>
                      </div>
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">Loadlist Items</p>
                        <p className="font-medium">{item.rollback_summary.loadlistItemsRemoved || 0}</p>
                      </div>
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">Route Stops</p>
                        <p className="font-medium">{item.rollback_summary.routeStopsRemoved || 0}</p>
                      </div>
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">Reservations</p>
                        <p className="font-medium">{item.rollback_summary.reservationsReleased || 0}</p>
                      </div>
                      <div className="bg-white rounded p-2">
                        <p className="text-gray-500">Ledger Entries</p>
                        <p className="font-medium">{item.rollback_summary.ledgerEntriesCreated || 0}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Affected Documents */}
                {item.affected_documents && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">เอกสารที่ได้รับผลกระทบ</p>
                    <div className="flex flex-wrap gap-2">
                      {item.affected_documents.picklists?.map((doc: any) => (
                        <span key={doc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          <FileText className="w-3 h-3" />
                          Picklist #{doc.id}
                        </span>
                      ))}
                      {item.affected_documents.faceSheets?.map((doc: any) => (
                        <span key={doc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                          <FileText className="w-3 h-3" />
                          Face Sheet #{doc.id}
                        </span>
                      ))}
                      {item.affected_documents.loadlists?.map((doc: any) => (
                        <span key={doc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                          <FileText className="w-3 h-3" />
                          Loadlist #{doc.id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t text-xs text-gray-400">
                  Log ID: {item.log_id}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
