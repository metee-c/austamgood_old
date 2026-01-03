'use client';

import React from 'react';
import { X, Package, Calendar, Hash, MapPin, TrendingUp, AlertCircle } from 'lucide-react';
import { LocationDetailData } from '@/types/warehouse-dashboard';
import Badge from '@/components/ui/Badge';

interface LocationDetailPanelProps {
  location: LocationDetailData | null;
  onClose: () => void;
}

export default function LocationDetailPanel({ location, onClose }: LocationDetailPanelProps) {
  if (!location) return null;

  const availablePieceQty = location.total_piece_qty - location.reserved_piece_qty;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between z-10">
        <div>
          <h2 className="text-xl font-bold font-thai">{location.location_code}</h2>
          <p className="text-blue-100 text-sm font-thai">{location.location_name || 'ไม่มีชื่อ'}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Location Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 font-thai flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            ข้อมูลตำแหน่ง
          </h3>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 font-thai">ประเภท:</span>
              <p className="font-semibold font-thai">{location.location_type}</p>
            </div>
            <div>
              <span className="text-gray-600 font-thai">โซน:</span>
              <p className="font-semibold font-thai">{location.zone || '-'}</p>
            </div>
            <div>
              <span className="text-gray-600 font-thai">Aisle:</span>
              <p className="font-semibold font-mono">{location.aisle || '-'}</p>
            </div>
            <div>
              <span className="text-gray-600 font-thai">Rack:</span>
              <p className="font-semibold font-mono">{location.rack || '-'}</p>
            </div>
            <div>
              <span className="text-gray-600 font-thai">Shelf:</span>
              <p className="font-semibold font-mono">{location.shelf || '-'}</p>
            </div>
            <div>
              <span className="text-gray-600 font-thai">Bin:</span>
              <p className="font-semibold font-mono">{location.bin || '-'}</p>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 font-thai flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            สรุปสินค้าคงคลัง
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-600 font-thai">จำนวน SKU</p>
              <p className="text-2xl font-bold text-blue-600">{location.sku_count}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-600 font-thai">จำนวนรวม (ชิ้น)</p>
              <p className="text-2xl font-bold text-green-600">{location.total_piece_qty.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-600 font-thai">จอง (ชิ้น)</p>
              <p className="text-2xl font-bold text-yellow-600">{location.reserved_piece_qty.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-xs text-gray-600 font-thai">พร้อมใช้ (ชิ้น)</p>
              <p className="text-2xl font-bold text-emerald-600">{availablePieceQty.toLocaleString()}</p>
            </div>
          </div>

          {/* Utilization Bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600 font-thai">การใช้งาน</span>
              <span className="font-bold text-gray-900">{location.utilization_percent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  location.utilization_percent >= 95
                    ? 'bg-red-500'
                    : location.utilization_percent >= 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, location.utilization_percent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Items List */}
        <div>
          <h3 className="font-semibold text-gray-900 font-thai mb-3 flex items-center gap-2">
            <Hash className="w-5 h-5 text-blue-600" />
            รายการสินค้า ({location.items.length})
          </h3>

          {location.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 font-thai">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>ไม่มีสินค้าในตำแหน่งนี้</p>
            </div>
          ) : (
            <div className="space-y-2">
              {location.items.map((item) => {
                const availableQty = item.total_piece_qty - item.reserved_piece_qty;
                const isExpiringSoon = item.expiry_date &&
                  new Date(item.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                return (
                  <div
                    key={item.balance_id}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 font-thai">{item.sku_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.sku_id}</p>
                      </div>
                      {isExpiringSoon && (
                        <Badge variant="warning" size="sm">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          ใกล้หมดอายุ
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {item.pallet_id && (
                        <div>
                          <span className="text-gray-600 font-thai">Pallet:</span>
                          <p className="font-mono font-semibold">{item.pallet_id}</p>
                        </div>
                      )}
                      {item.lot_no && (
                        <div>
                          <span className="text-gray-600 font-thai">Lot:</span>
                          <p className="font-mono font-semibold">{item.lot_no}</p>
                        </div>
                      )}
                      {item.production_date && (
                        <div>
                          <span className="text-gray-600 font-thai">ผลิต:</span>
                          <p className="font-semibold">{new Date(item.production_date).toLocaleDateString('th-TH')}</p>
                        </div>
                      )}
                      {item.expiry_date && (
                        <div>
                          <span className="text-gray-600 font-thai">หมดอายุ:</span>
                          <p className={`font-semibold ${isExpiringSoon ? 'text-red-600' : ''}`}>
                            {new Date(item.expiry_date).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-gray-600 font-thai">รวม:</span>
                        <span className="ml-1 font-bold text-green-600">{item.total_piece_qty}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 font-thai">จอง:</span>
                        <span className="ml-1 font-bold text-yellow-600">{item.reserved_piece_qty}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 font-thai">พร้อมใช้:</span>
                        <span className="ml-1 font-bold text-blue-600">{availableQty}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
