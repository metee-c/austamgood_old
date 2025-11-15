'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';

// Interface ตามโครงสร้างจริงจาก Supabase Cloud
interface InventoryLedger {
  ledger_id: number;
  movement_at: string;
  transaction_type: string;
  direction: 'in' | 'out';
  move_item_id: number | null;
  receive_item_id: number | null;
  warehouse_id: string;
  location_id: string | null;
  sku_id: string;
  pallet_id: string | null;
  pallet_id_external: string | null;
  production_date: string | null;
  expiry_date: string | null;
  pack_qty: number;
  piece_qty: number;
  reference_no: string | null;
  remarks: string | null;
  created_by: number | null;
}

const InventoryLedgerPage = () => {
  const [ledgerData, setLedgerData] = useState<InventoryLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedTransactionType, setSelectedTransactionType] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Warehouses for filter
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    fetchWarehouses();
    fetchLedgerData();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('master_warehouse')
        .select('warehouse_id, warehouse_name')
        .order('warehouse_name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (err) {
      console.error('Error fetching warehouses:', err);
    }
  };

  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('wms_inventory_ledger')
        .select('*')
        .order('movement_at', { ascending: false })
        .limit(1000);

      if (error) {
        setError(error.message);
        console.error('Error fetching ledger data:', error);
      } else {
        setLedgerData(data || []);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case 'receive':
        return <Badge variant="success" size="sm">รับเข้า</Badge>;
      case 'issue':
        return <Badge variant="danger" size="sm">เบิกออก</Badge>;
      case 'move':
        return <Badge variant="info" size="sm">ย้าย</Badge>;
      case 'adjust':
        return <Badge variant="warning" size="sm">ปรับปรุง</Badge>;
      case 'return':
        return <Badge variant="default" size="sm">คืน</Badge>;
      case 'pick':
        return <Badge variant="info" size="sm">เบิก</Badge>;
      default:
        return <Badge variant="default" size="sm">{type}</Badge>;
    }
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'in') {
      return <Badge variant="success" size="sm">เข้า</Badge>;
    } else if (direction === 'out') {
      return <Badge variant="danger" size="sm">ออก</Badge>;
    }
    return <Badge variant="default" size="sm">{direction}</Badge>;
  };

  const filteredData = ledgerData.filter(item => {
    const matchesSearch =
      (item.reference_no?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.sku_id?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.pallet_id_external?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.pallet_id?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesWarehouse = selectedWarehouse === 'all' || item.warehouse_id === selectedWarehouse;
    const matchesTransactionType = selectedTransactionType === 'all' || item.transaction_type === selectedTransactionType;
    const matchesDirection = selectedDirection === 'all' || item.direction === selectedDirection;

    const matchesDateFrom = !dateFrom || new Date(item.movement_at) >= new Date(dateFrom);
    const matchesDateTo = !dateTo || new Date(item.movement_at) <= new Date(dateTo + 'T23:59:59');

    return matchesSearch && matchesWarehouse && matchesTransactionType && matchesDirection && matchesDateFrom && matchesDateTo;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="flex flex-col space-y-2 pt-0 px-2 pb-2">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
          <h1 className="text-xl font-bold text-thai-gray-900 font-thai">บันทึกธุรกรรมสต็อก</h1>
          <div className="flex gap-2">
            <Button variant="outline" icon={Download}>
              ส่งออก Excel
            </Button>
            <Button variant="primary" icon={RefreshCw} onClick={fetchLedgerData} disabled={loading}>
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาด้วย Reference No, SKU, Pallet ID..."
                  className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 text-sm font-thai transition-all duration-300"
                />
              </div>
            </div>
            <div>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai"
              >
                <option value="all">ทุกคลัง</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedTransactionType}
                onChange={(e) => setSelectedTransactionType(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai"
              >
                <option value="all">ทุกประเภท</option>
                <option value="receive">รับเข้า</option>
                <option value="issue">เบิกออก</option>
                <option value="move">ย้าย</option>
                <option value="adjust">ปรับปรุง</option>
                <option value="pick">เบิก</option>
                <option value="return">คืน</option>
              </select>
            </div>
            <div>
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai"
              >
                <option value="all">ทุกทิศทาง</option>
                <option value="in">เข้า</option>
                <option value="out">ออก</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai"
              />
              <span className="text-thai-gray-400 text-xs">ถึง</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg text-sm font-thai"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-[74vh] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-sm">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังโหลดข้อมูลธุรกรรม...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <p className="text-sm font-thai">{error}</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <FileText className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">ไม่พบข้อมูลธุรกรรม</p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        วันที่/เวลา
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        ประเภท
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        ทิศทาง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        รหัสสินค้า
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        รหัสพาเลท
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        คลัง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        ตำแหน่ง
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        แพ็ค
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        ชิ้น
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        วันผลิต
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        วันหมดอายุ
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        เลขที่อ้างอิง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider font-thai">
                        หมายเหตุ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.map((ledger) => (
                      <tr key={ledger.ledger_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-900 font-thai">
                            {new Date(ledger.movement_at).toLocaleString('th-TH', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getTransactionTypeBadge(ledger.transaction_type)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getDirectionBadge(ledger.direction)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-medium text-gray-900 font-mono">{ledger.sku_id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">
                            {ledger.pallet_id_external && (
                              <div className="font-mono text-gray-900">{ledger.pallet_id_external}</div>
                            )}
                            {ledger.pallet_id && (
                              <div className="font-mono text-[10px] text-gray-500">{ledger.pallet_id}</div>
                            )}
                            {!ledger.pallet_id && !ledger.pallet_id_external && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-900 font-thai">{ledger.warehouse_id}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-900 font-mono">{ledger.location_id || '-'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className={`text-xs font-semibold ${
                            ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {ledger.direction === 'in' ? '+' : '-'}{ledger.pack_qty?.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className={`text-xs font-semibold ${
                            ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {ledger.direction === 'in' ? '+' : '-'}{ledger.piece_qty?.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-900 font-thai">
                            {ledger.production_date ? new Date(ledger.production_date).toLocaleDateString('th-TH') : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-900 font-thai">
                            {ledger.expiry_date ? new Date(ledger.expiry_date).toLocaleDateString('th-TH') : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-gray-900 font-mono">{ledger.reference_no || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700 font-thai">{ledger.remarks || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryLedgerPage;