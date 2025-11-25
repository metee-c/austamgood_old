import React from 'react';
import { SuggestedSource } from '@/types/stock-alerts';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface SuggestedSourcesTableProps {
  sources: SuggestedSource[];
  skuName: string;
  uomBase: string;
}

export function SuggestedSourcesTable({
  sources,
  skuName,
  uomBase
}: SuggestedSourcesTableProps) {
  if (!sources || sources.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 font-thai">
        ไม่พบแหล่งสต็อกที่แนะนำ
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 font-thai mb-3">
        แหล่งสต็อกที่แนะนำ (เรียงตาม FEFO)
      </h4>

      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={source.location_id || index}
            className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white text-xs font-bold rounded-full">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-gray-900 font-thai">
                    {source.location_code}
                  </span>
                </div>

                {source.pallet_id && (
                  <div className="text-xs text-gray-600 font-thai ml-8">
                    พาเลท: {source.pallet_id}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {source.available_qty.toLocaleString('th-TH')}
                </div>
                <div className="text-xs text-gray-600 font-thai">
                  {uomBase}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600 font-thai border-t border-gray-100 pt-2 mt-2">
              {source.expiry_date && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">หมดอายุ:</span>
                  <span className="text-red-600 font-medium">
                    {format(new Date(source.expiry_date), 'dd MMM yyyy', { locale: th })}
                  </span>
                </div>
              )}

              {source.production_date && (
                <div className="flex items-center gap-1">
                  <span className="font-medium">ผลิต:</span>
                  <span>
                    {format(new Date(source.production_date), 'dd MMM yyyy', { locale: th })}
                  </span>
                </div>
              )}
            </div>

            {index === 0 && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                <span className="text-xs text-blue-700 font-thai font-medium">
                  ⭐ แนะนำให้ย้ายจากที่นี่ก่อน (FEFO)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mt-3">
        <div className="text-xs text-gray-600 font-thai">
          <div className="font-medium mb-1">💡 หมายเหตุ:</div>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>เรียงตามวันหมดอายุเร็วสุดก่อน (FEFO)</li>
            <li>ถ้าวันหมดอายุเท่ากัน จะเรียงตามวันผลิตเก่าสุดก่อน (FIFO)</li>
            <li>ควรเลือกย้ายจากอันดับ 1 ก่อน</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
