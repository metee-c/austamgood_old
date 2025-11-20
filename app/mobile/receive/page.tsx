'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Package,
  ChevronRight,
  QrCode,
  CheckCircle,
  Clock,
  AlertCircle,
  Printer,
  Camera,
  X,
  RefreshCw,
  Loader2,
  ScanLine,
  Info
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

// Types
interface ReceiveItem {
  item_id: number;
  sku_id: string;
  product_name: string;
  barcode?: string;
  piece_quantity: number;
  pack_quantity: number;
  pallet_id?: string;
  pallet_id_external?: string;
  pallet_scan_status: 'ไม่จำเป็น' | 'รอดำเนินการ' | 'สแกนแล้ว';
  production_date?: string;
  expiry_date?: string;
  location_id?: string;
  master_sku?: {
    sku_name: string;
    barcode: string;
  };
  master_location?: {
    location_code: string;
  };
}

interface ReceiveDocument {
  receive_id: number;
  receive_no: string;
  receive_type: string;
  reference_doc?: string;
  receive_date: string;
  status: string;
  warehouse_id: string;
  supplier_id?: string;
  wms_receive_items: ReceiveItem[];
  master_supplier?: {
    supplier_name: string;
  };
  master_customer?: {
    customer_name: string;
  };
  received_by_employee?: {
    first_name: string;
    last_name: string;
  };
}

export default function MobileReceivePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receives, setReceives] = useState<ReceiveDocument[]>([]);
  const [filteredReceives, setFilteredReceives] = useState<ReceiveDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedReceive, setSelectedReceive] = useState<ReceiveDocument | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanningItem, setScanningItem] = useState<ReceiveItem | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Fetch receives
  useEffect(() => {
    fetchReceives();
  }, []);

  // Filter receives
  useEffect(() => {
    let filtered = receives;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.receive_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reference_doc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.master_supplier?.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'pending_scan') {
        filtered = filtered.filter(r =>
          r.wms_receive_items.some(item => item.pallet_scan_status === 'รอดำเนินการ')
        );
      } else {
        filtered = filtered.filter(r => r.status === selectedStatus);
      }
    }

    setFilteredReceives(filtered);
  }, [searchTerm, selectedStatus, receives]);

  const fetchReceives = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/receives?status=รับเข้าแล้ว,กำลังตรวจสอบ');
      const result = await response.json();

      if (result.data) {
        setReceives(result.data);
      }
    } catch (error) {
      console.error('Error fetching receives:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReceive = (receive: ReceiveDocument) => {
    setSelectedReceive(receive);
  };

  const handleBack = () => {
    setSelectedReceive(null);
    setShowScanner(false);
    setScanningItem(null);
    setManualInput('');
  };

  const handleStartScan = (item: ReceiveItem) => {
    setScanningItem(item);
    setShowScanner(true);
    setManualInput('');
  };

  const handleSaveExternalPallet = async () => {
    if (!scanningItem || !manualInput.trim()) {
      alert('กรุณากรอกรหัสพาเลทภายนอก');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/receive/update-external-pallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: scanningItem.item_id,
          externalPalletId: manualInput.trim(),
        }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        return;
      }

      // Success - play sound and refresh
      playSuccessSound();
      alert('✅ บันทึกรหัสพาเลทสำเร็จ!');

      // Refresh data
      await fetchReceives();

      // Update local state
      if (selectedReceive) {
        const updatedItems = selectedReceive.wms_receive_items.map(item =>
          item.item_id === scanningItem.item_id
            ? { ...item, pallet_id_external: manualInput.trim(), pallet_scan_status: 'สแกนแล้ว' as const }
            : item
        );
        setSelectedReceive({ ...selectedReceive, wms_receive_items: updatedItems });
      }

      // Close scanner
      setShowScanner(false);
      setScanningItem(null);
      setManualInput('');
    } catch (error) {
      console.error('Error saving external pallet:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('/audio/success.mp3');
      audio.play().catch(() => {});
    } catch (error) {
      // Silent fail
    }
  };

  const formatThaiDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'รอรับเข้า':
        return <Badge variant="default" size="sm">รอรับเข้า</Badge>;
      case 'รับเข้าแล้ว':
        return <Badge variant="info" size="sm">รับเข้าแล้ว</Badge>;
      case 'กำลังตรวจสอบ':
        return <Badge variant="warning" size="sm">กำลังตรวจสอบ</Badge>;
      case 'สำเร็จ':
        return <Badge variant="success" size="sm">สำเร็จ</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const getScanStatusBadge = (status: string) => {
    switch (status) {
      case 'สแกนแล้ว':
        return <Badge variant="success" size="sm">✓ สแกนแล้ว</Badge>;
      case 'รอดำเนินการ':
        return <Badge variant="warning" size="sm">⏳ รอสแกน</Badge>;
      default:
        return <Badge variant="secondary" size="sm">ไม่จำเป็น</Badge>;
    }
  };

  const getPendingScanCount = (receive: ReceiveDocument) => {
    return receive.wms_receive_items.filter(item => item.pallet_scan_status === 'รอดำเนินการ').length;
  };

  const getTotalItemCount = (receive: ReceiveDocument) => {
    return receive.wms_receive_items.length;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // Scanner View
  if (showScanner && scanningItem) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 p-4 flex items-center justify-between">
          <button
            onClick={() => setShowScanner(false)}
            className="text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-white font-bold font-thai text-lg">สแกนพาเลทภายนอก</h2>
          <div className="w-6" />
        </div>

        {/* Scanning Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-white/10 border-4 border-dashed border-blue-400 rounded-2xl w-full max-w-md aspect-square flex items-center justify-center mb-8">
            <div className="text-center">
              <ScanLine className="w-24 h-24 text-blue-400 mx-auto mb-4 animate-pulse" />
              <p className="text-white text-lg font-thai">เตรียมสแกนบาร์โค้ด</p>
              <p className="text-gray-400 text-sm font-thai mt-2">หรือพิมพ์รหัสด้านล่าง</p>
            </div>
          </div>

          {/* Item Info */}
          <div className="bg-gray-800 rounded-xl p-4 w-full max-w-md mb-6">
            <div className="text-gray-400 text-sm font-thai mb-2">รายการที่กำลังสแกน:</div>
            <div className="text-white font-bold font-thai text-lg mb-1">
              {scanningItem.master_sku?.sku_name || scanningItem.product_name}
            </div>
            <div className="text-gray-400 text-sm font-thai">
              SKU: {scanningItem.sku_id}
            </div>
            <div className="flex gap-3 mt-3">
              <div className="bg-blue-500/20 px-3 py-1 rounded">
                <span className="text-blue-300 text-sm font-thai">{scanningItem.pack_quantity} แพ็ค</span>
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded">
                <span className="text-green-300 text-sm font-thai">{scanningItem.piece_quantity} ชิ้น</span>
              </div>
            </div>
          </div>

          {/* Manual Input */}
          <div className="w-full max-w-md">
            <label className="text-white text-sm font-thai mb-2 block">
              พิมพ์รหัสพาเลทภายนอก:
            </label>
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="สแกนหรือพิมพ์รหัส..."
              className="w-full px-4 py-4 bg-gray-800 border-2 border-gray-700 rounded-xl text-white text-lg font-mono focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Save Button */}
          <Button
            variant="primary"
            size="lg"
            onClick={handleSaveExternalPallet}
            disabled={!manualInput.trim() || saving}
            loading={saving}
            className="w-full max-w-md mt-6 py-4 text-lg font-thai"
          >
            {saving ? 'กำลังบันทึก...' : '✓ บันทึกรหัสพาเลท'}
          </Button>
        </div>
      </div>
    );
  }

  // Detail View
  if (selectedReceive) {
    const pendingCount = getPendingScanCount(selectedReceive);
    const totalCount = getTotalItemCount(selectedReceive);
    const completedCount = totalCount - pendingCount;

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-bold font-thai text-gray-900">
                  {selectedReceive.receive_no}
                </h1>
                <p className="text-sm text-gray-500 font-thai">
                  {formatThaiDate(selectedReceive.receive_date)}
                </p>
              </div>
              <button
                onClick={fetchReceives}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-100 rounded-full h-3 mb-2">
              <div
                className="bg-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-thai text-gray-600">
              <span>สแกนแล้ว {completedCount}/{totalCount}</span>
              <span>{Math.round((completedCount / totalCount) * 100)}%</span>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-2 p-4 pt-0">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-600 font-thai mb-1">ประเภท</div>
              <div className="text-sm font-semibold text-blue-900 font-thai">
                {selectedReceive.receive_type}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-green-600 font-thai mb-1">สถานะ</div>
              <div>{getStatusBadge(selectedReceive.status)}</div>
            </div>
            {selectedReceive.master_supplier && (
              <div className="col-span-2 bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-600 font-thai mb-1">ผู้จำหน่าย</div>
                <div className="text-sm font-semibold text-gray-900 font-thai">
                  {selectedReceive.master_supplier.supplier_name}
                </div>
              </div>
            )}
            {selectedReceive.reference_doc && (
              <div className="col-span-2 bg-purple-50 rounded-lg p-3">
                <div className="text-xs text-purple-600 font-thai mb-1">เอกสารอ้างอิง</div>
                <div className="text-sm font-semibold text-purple-900 font-thai">
                  {selectedReceive.reference_doc}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold font-thai text-gray-900">
              รายการสินค้า ({selectedReceive.wms_receive_items.length})
            </h2>
            {pendingCount > 0 && (
              <Badge variant="warning" size="sm">
                รอสแกน {pendingCount} รายการ
              </Badge>
            )}
          </div>

          {selectedReceive.wms_receive_items.map((item, index) => {
            const needsScan = item.pallet_scan_status === 'รอดำเนินการ';

            return (
              <div
                key={item.item_id}
                className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
                  needsScan ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
                }`}
              >
                {/* Item Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        {getScanStatusBadge(item.pallet_scan_status)}
                      </div>
                      <h3 className="font-bold text-gray-900 font-thai text-base mb-1">
                        {item.master_sku?.sku_name || item.product_name}
                      </h3>
                      <p className="text-sm text-gray-600 font-mono">
                        SKU: {item.sku_id}
                      </p>
                    </div>
                  </div>

                  {/* Quantities */}
                  <div className="flex gap-2 mt-3">
                    <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-600 font-thai mb-1">แพ็ค</div>
                      <div className="text-lg font-bold text-blue-900">{item.pack_quantity}</div>
                    </div>
                    <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-green-600 font-thai mb-1">ชิ้น</div>
                      <div className="text-lg font-bold text-green-900">{item.piece_quantity}</div>
                    </div>
                  </div>

                  {/* Pallet Info */}
                  <div className="mt-3 space-y-2">
                    {item.pallet_id && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 font-thai">พาเลทภายใน:</span>
                        <span className="font-mono text-blue-600">{item.pallet_id}</span>
                      </div>
                    )}
                    {item.pallet_id_external && (
                      <div className="flex items-center gap-2 text-sm">
                        <QrCode className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 font-thai">พาเลทภายนอก:</span>
                        <span className="font-mono text-green-600">{item.pallet_id_external}</span>
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  {(item.production_date || item.expiry_date) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      {item.production_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 font-thai">วันที่ผลิต:</span>
                          <span className="font-semibold text-gray-900">{formatThaiDate(item.production_date)}</span>
                        </div>
                      )}
                      {item.expiry_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 font-thai">วันหมดอายุ:</span>
                          <span className="font-semibold text-gray-900">{formatThaiDate(item.expiry_date)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Button */}
                {needsScan ? (
                  <button
                    onClick={() => handleStartScan(item)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 font-bold font-thai text-base flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 transition-all active:scale-95"
                  >
                    <Camera className="w-5 h-5" />
                    สแกนพาเลทภายนอก
                  </button>
                ) : (
                  <div className="w-full bg-green-50 text-green-700 py-3 font-semibold font-thai text-sm flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    สแกนเรียบร้อยแล้ว
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold font-thai mb-1">รับสินค้าเข้าคลัง</h1>
            <p className="text-blue-100 text-sm font-thai">Inbound Receiving</p>
          </div>
          <button
            onClick={fetchReceives}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่รับ, PO, ผู้จำหน่าย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 font-thai"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-4 py-2 rounded-lg font-thai text-sm whitespace-nowrap transition-colors ${
              selectedStatus === 'all'
                ? 'bg-white text-blue-600 font-semibold'
                : 'bg-white/20 text-white'
            }`}
          >
            ทั้งหมด ({receives.length})
          </button>
          <button
            onClick={() => setSelectedStatus('pending_scan')}
            className={`px-4 py-2 rounded-lg font-thai text-sm whitespace-nowrap transition-colors ${
              selectedStatus === 'pending_scan'
                ? 'bg-white text-blue-600 font-semibold'
                : 'bg-white/20 text-white'
            }`}
          >
            🔸 รอสแกน ({receives.filter(r => getPendingScanCount(r) > 0).length})
          </button>
          <button
            onClick={() => setSelectedStatus('รับเข้าแล้ว')}
            className={`px-4 py-2 rounded-lg font-thai text-sm whitespace-nowrap transition-colors ${
              selectedStatus === 'รับเข้าแล้ว'
                ? 'bg-white text-blue-600 font-semibold'
                : 'bg-white/20 text-white'
            }`}
          >
            รับเข้าแล้ว
          </button>
          <button
            onClick={() => setSelectedStatus('กำลังตรวจสอบ')}
            className={`px-4 py-2 rounded-lg font-thai text-sm whitespace-nowrap transition-colors ${
              selectedStatus === 'กำลังตรวจสอบ'
                ? 'bg-white text-blue-600 font-semibold'
                : 'bg-white/20 text-white'
            }`}
          >
            กำลังตรวจสอบ
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredReceives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <Package className="w-20 h-20 text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 font-thai mb-2">
            ไม่พบรายการรับสินค้า
          </h3>
          <p className="text-gray-500 font-thai text-center">
            {searchTerm ? 'ลองค้นหาด้วยคำอื่น' : 'ยังไม่มีรายการรับสินค้าในขณะนี้'}
          </p>
        </div>
      )}

      {/* Receives List */}
      <div className="p-4 space-y-3">
        {filteredReceives.map((receive) => {
          const pendingCount = getPendingScanCount(receive);
          const totalCount = getTotalItemCount(receive);
          const hasPending = pendingCount > 0;

          return (
            <div
              key={receive.receive_id}
              onClick={() => handleSelectReceive(receive)}
              className={`bg-white rounded-xl shadow-sm border-2 p-4 active:scale-98 transition-all cursor-pointer ${
                hasPending ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 font-mono text-lg">
                      {receive.receive_no}
                    </h3>
                    {hasPending && (
                      <Badge variant="warning" size="sm">
                        🔸 {pendingCount} รอสแกน
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-thai">
                    {formatThaiDate(receive.receive_date)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="text-xs text-blue-600 font-thai mb-0.5">ประเภท</div>
                  <div className="text-sm font-semibold text-blue-900 font-thai truncate">
                    {receive.receive_type}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-600 font-thai mb-0.5">สถานะ</div>
                  <div>{getStatusBadge(receive.status)}</div>
                </div>
              </div>

              {/* Supplier */}
              {receive.master_supplier && (
                <div className="flex items-center gap-2 text-sm mb-3">
                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600 font-thai truncate">
                    {receive.master_supplier.supplier_name}
                  </span>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900">
                      {totalCount} รายการ
                    </span>
                  </div>
                  {hasPending && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-600">
                        {pendingCount} รอสแกน
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-thai">
                  แตะเพื่อดูรายละเอียด
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="mx-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 font-thai mb-1">
              วิธีใช้งาน
            </h4>
            <p className="text-sm text-blue-700 font-thai leading-relaxed">
              1. เลือกเอกสารรับที่ต้องการสแกน<br />
              2. แตะปุ่ม "สแกนพาเลทภายนอก" ในรายการสินค้า<br />
              3. สแกนหรือพิมพ์รหัสพาเลทจากผู้จำหน่าย<br />
              4. กดบันทึก - เสร็จสิ้น!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
