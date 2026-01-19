'use client';

import { useState } from 'react';
import { X, Package, Edit2, Save, Loader2, Info } from 'lucide-react';

interface SkuMasterInfoModalProps {
  sku: {
    sku_id: string;
    sku_name: string;
    barcode?: string;
    qty_per_pack?: number;
    qty_per_pallet?: number;
    weight_per_piece_kg?: number;
    uom_base?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function SkuMasterInfoModal({ sku, isOpen, onClose, onUpdate }: SkuMasterInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [qtyPerPallet, setQtyPerPallet] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !sku) return null;

  const handleEdit = () => {
    setQtyPerPallet(sku.qty_per_pallet || 0);
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    if (qtyPerPallet <= 0) {
      setError('จำนวนต้องมากกว่า 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/master-sku/${sku.sku_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_per_pallet: qtyPerPallet }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'ไม่สามารถบันทึกได้');
      }

      // Update local sku object
      sku.qty_per_pallet = qtyPerPallet;
      
      setIsEditing(false);
      if (onUpdate) onUpdate();
      
      // Show success message briefly
      setTimeout(() => {
        alert('✅ บันทึกสำเร็จ');
      }, 100);
    } catch (err: any) {
      console.error('Error updating SKU:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            <h3 className="font-bold font-thai text-sm">ข้อมูลมาสเตอร์สินค้า</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* SKU Name */}
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-600 font-thai mb-1">ชื่อสินค้า</div>
            <div className="font-semibold text-sm text-gray-900 font-thai">{sku.sku_name}</div>
          </div>

          {/* SKU ID */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-[10px] text-gray-500 font-thai mb-0.5">รหัส SKU</div>
              <div className="font-mono text-xs text-gray-900">{sku.sku_id}</div>
            </div>

            {/* Barcode */}
            {sku.barcode && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 font-thai mb-0.5">บาร์โค้ด</div>
                <div className="font-mono text-xs text-gray-900">{sku.barcode}</div>
              </div>
            )}
          </div>

          {/* Quantities */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 font-thai">
              <Package className="w-4 h-4" />
              <span>ข้อมูลจำนวน</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Qty per Pack */}
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 font-thai mb-0.5">ชิ้น/แพ็ค</div>
                <div className="font-bold text-sm text-gray-900">{sku.qty_per_pack || '-'}</div>
              </div>

              {/* Weight per Piece */}
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 font-thai mb-0.5">น้ำหนัก/ชิ้น (กก.)</div>
                <div className="font-bold text-sm text-gray-900">{sku.weight_per_piece_kg || '-'}</div>
              </div>
            </div>

            {/* Qty per Pallet - Editable */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-3 border-2 border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-purple-700 font-thai">ชิ้น/พาเลท</div>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-[10px] font-thai hover:bg-purple-700 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    แก้ไข
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={qtyPerPallet}
                    onChange={(e) => setQtyPerPallet(Number(e.target.value))}
                    min="1"
                    className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-sm font-bold text-center focus:border-purple-500 focus:outline-none"
                    autoFocus
                  />
                  {error && (
                    <div className="text-red-500 text-[10px] font-thai">{error}</div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-thai hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-thai hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          <span>บันทึก</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="font-bold text-2xl text-purple-700 text-center">
                  {sku.qty_per_pallet || '-'}
                </div>
              )}
            </div>

            {/* UOM */}
            {sku.uom_base && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 font-thai mb-0.5">หน่วยนับ</div>
                <div className="font-semibold text-xs text-gray-900 font-thai">{sku.uom_base}</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 rounded-b-xl border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-thai hover:bg-gray-700 transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
