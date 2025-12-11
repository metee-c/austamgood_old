'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
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
        .select(`
          *,
          master_location!location_id (
            location_name
          ),
          master_sku!sku_id (
            sku_name,
            weight_per_piece_kg
          ),
          wms_move_items!move_item_id (
            parent_pallet_id,
            new_pallet_id
          ),
          master_system_user!created_by (
            username,
            full_name
          )
        `)
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
        return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">รับเข้า</span></Badge>;
      case 'import':
        return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">นำเข้าข้อมูล</span></Badge>;
      case 'issue':
        return <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เบิกออก</span></Badge>;
      case 'putaway':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เก็บเข้า</span></Badge>;
      case 'move':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ย้าย</span></Badge>;
      case 'adjust':
        return <Badge variant="warning" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ปรับปรุง</span></Badge>;
      case 'return':
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">คืน</span></Badge>;
      case 'pick':
        return <Badge variant="info" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เบิก</span></Badge>;
      default:
        return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">{type}</span></Badge>;
    }
  };

  const getDirectionBadge = (direction: string) => {
    if (direction === 'in') {
      return <Badge variant="success" size="sm" className="whitespace-nowrap"><span className="text-[10px]">เข้า</span></Badge>;
    } else if (direction === 'out') {
      return <Badge variant="danger" size="sm" className="whitespace-nowrap"><span className="text-[10px]">ออก</span></Badge>;
    }
    return <Badge variant="default" size="sm" className="whitespace-nowrap"><span className="text-[10px]">{direction}</span></Badge>;
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

  // รวม in/out entries ที่มี move_item_id เดียวกันให้เป็นแถวเดียว
  const consolidatedData = [];
  const processedIds = new Set<number>();

  for (const item of filteredData) {
    // ถ้า entry นี้ถูก process ไปแล้ว ให้ข้าม
    if (processedIds.has(item.ledger_id)) continue;

    // ถ้าเป็นธุรกรรมที่มี move_item_id (การย้ายสต็อกทุกประเภท)
    if (item.move_item_id) {
      // หาคู่ของมัน (in/out) ที่มี move_item_id เดียวกัน
      const pair = filteredData.find(
        other =>
          other.ledger_id !== item.ledger_id &&
          other.move_item_id === item.move_item_id &&
          other.direction !== item.direction &&
          other.sku_id === item.sku_id // ต้องเป็น SKU เดียวกัน
      );

      if (pair) {
        // รวมเป็นแถวเดียว
        const outEntry = item.direction === 'out' ? item : pair;
        const inEntry = item.direction === 'in' ? item : pair;

        consolidatedData.push({
          ...item,
          _isConsolidated: true,
          _outEntry: outEntry,
          _inEntry: inEntry,
        });

        processedIds.add(item.ledger_id);
        processedIds.add(pair.ledger_id);
      } else {
        // ไม่มีคู่ แสดงปกติ (อาจเป็นกรณี OUT อย่างเดียวหรือ IN อย่างเดียว)
        consolidatedData.push(item);
        processedIds.add(item.ledger_id);
      }
    } else {
      // ธุรกรรมอื่นๆ ที่ไม่มี move_item_id (เช่น receive) แสดงปกติ
      consolidatedData.push(item);
      processedIds.add(item.ledger_id);
    }
  }

  // ใช้ consolidatedData ที่รวม in/out entries ไว้แล้ว
  const groupedData = consolidatedData;

  return (
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
          <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">บันทึกธุรกรรมสต็อก</h1>
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
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาด้วย Reference No, SKU, Pallet ID..."
                  className="w-full pl-10 pr-4 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm placeholder:text-thai-gray-400"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28"
              />
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24"
              >
                <option value="all">ทุกคลัง</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>
              <select
                value={selectedTransactionType}
                onChange={(e) => setSelectedTransactionType(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24"
              >
                <option value="all">ทุกประเภท</option>
                <option value="receive">รับเข้า</option>
                <option value="issue">เบิกออก</option>
                <option value="move">ย้าย</option>
                <option value="adjust">ปรับปรุง</option>
                <option value="pick">เบิก</option>
                <option value="return">คืน</option>
              </select>
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                className="px-3 py-1.5 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24"
              >
                <option value="all">ทุกทิศทาง</option>
                <option value="in">เข้า</option>
                <option value="out">ออก</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col">
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
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันที่/เวลา</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประเภท</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทิศทาง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คลัง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[120px]">ตำแหน่งต้นทาง</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[120px]">ตำแหน่งปลายทาง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Move ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">Receive ID</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชื่อสินค้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสพาเลท</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">น้ำหนัก (กก.)</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันผลิต</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">วันหมดอายุ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขที่อ้างอิง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">หมายเหตุ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">สร้างโดย</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {groupedData.map((ledger: any) => {
                      // ตรวจสอบว่าเป็นการแบ่งพาเลทหรือไม่
                      const isPartialSplit = ledger.wms_move_items?.parent_pallet_id;
                      
                      // แถวปกติ (รวม in/out ไว้แล้วใน consolidatedData)
                      return (
                      <tr
                        key={ledger.ledger_id}
                        className={`transition-colors duration-150 ${
                          isPartialSplit
                            ? 'hover:bg-amber-50/50 bg-amber-50/20 border-l-2 border-amber-400'
                            : ledger._isConsolidated
                            ? 'hover:bg-blue-50/50 bg-blue-50/20'
                            : 'hover:bg-blue-50/30'
                        }`}
                      >
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.ledger_id}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="text-thai-gray-600 font-thai">
                            {new Date(ledger.movement_at).toLocaleString('th-TH', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {getTransactionTypeBadge(ledger.transaction_type)}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {ledger._isConsolidated ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="danger" size="sm" className="whitespace-nowrap">
                                <span className="text-[10px]">ออก</span>
                              </Badge>
                              <span className="text-gray-400 text-[10px]">→</span>
                              <Badge variant="success" size="sm" className="whitespace-nowrap">
                                <span className="text-[10px]">เข้า</span>
                              </Badge>
                            </div>
                          ) : (
                            getDirectionBadge(ledger.direction)
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-medium text-thai-gray-700 font-thai">{ledger.warehouse_id}</span>
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 min-w-[120px] align-top">
                          {ledger._isConsolidated ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {ledger._outEntry.location_id || '-'}
                            </span>
                          ) : ledger.direction === 'out' ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {ledger.location_id || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 min-w-[120px] align-top">
                          {ledger._isConsolidated ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {ledger._inEntry.location_id || '-'}
                            </span>
                          ) : ledger.direction === 'in' ? (
                            <span className="font-mono text-thai-gray-700 text-xs">
                              {ledger.location_id || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.move_item_id || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.receive_item_id || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <span className="font-mono font-semibold text-thai-gray-700">{ledger.sku_id}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <span className="text-thai-gray-700 font-thai text-[11px]">
                            {(ledger as any).master_sku?.sku_name || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          {ledger.transaction_type === 'transfer' && ledger.direction === 'in' ? (
                            (ledger as any).wms_move_items?.parent_pallet_id ? (
                              <details className="cursor-pointer">
                                <summary className="list-none pl-2 border-l-2 border-green-400 text-[10px]">
                                  <span className="text-gray-600 font-thai">พาเลทใหม่: </span>
                                  <span className="font-mono text-green-600 font-semibold">
                                    {(ledger as any).wms_move_items.new_pallet_id}
                                  </span>
                                </summary>
                                <div className="mt-1 pl-2 border-l-2 border-orange-300 text-[10px]">
                                  <span className="text-gray-600 font-thai">พาเลทเดิม: </span>
                                  <span className="font-mono text-orange-600">
                                    {(ledger as any).wms_move_items.parent_pallet_id}
                                  </span>
                                </div>
                              </details>
                            ) : (
                              <div className="pl-2 border-l-2 border-green-400 text-[10px]">
                                <span className="text-gray-600 font-thai">พาเลทใหม่: </span>
                                <span className="font-mono text-green-600 font-semibold">
                                  {ledger.pallet_id}
                                </span>
                              </div>
                            )
                          ) : (ledger as any).wms_move_items?.parent_pallet_id ? (
                            <details className="cursor-pointer">
                              <summary className="list-none pl-2 border-l-2 border-green-400 text-[10px]">
                                <span className="text-gray-600 font-thai">พาเลทใหม่: </span>
                                <span className="font-mono text-green-600 font-semibold">
                                  {(ledger as any).wms_move_items.new_pallet_id}
                                </span>
                              </summary>
                              <div className="mt-1 pl-2 border-l-2 border-orange-300 text-[10px]">
                                <span className="text-gray-600 font-thai">พาเลทเดิม: </span>
                                <span className="font-mono text-orange-600">
                                  {(ledger as any).wms_move_items.parent_pallet_id}
                                </span>
                              </div>
                            </details>
                          ) : (
                            <div>
                              {ledger.pallet_id_external && (
                                <div className="font-mono text-thai-gray-700">{ledger.pallet_id_external}</div>
                              )}
                              {ledger.pallet_id && (
                                <div className="font-mono text-[10px] text-gray-500">{ledger.pallet_id}</div>
                              )}
                              {!ledger.pallet_id && !ledger.pallet_id_external && (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          {ledger._isConsolidated ? (
                            <span className="font-bold text-blue-600">
                              {ledger.pack_qty?.toLocaleString()}
                            </span>
                          ) : (
                            <span className={`font-bold ${
                              ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {ledger.direction === 'in' ? '+' : '-'}{ledger.pack_qty?.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          {ledger._isConsolidated ? (
                            <span className="font-bold text-blue-600">
                              {ledger.piece_qty?.toLocaleString()}
                            </span>
                          ) : (
                            <span className={`font-bold ${
                              ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {ledger.direction === 'in' ? '+' : '-'}{ledger.piece_qty?.toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap">
                          {(() => {
                            const weightPerPiece = (ledger as any).master_sku?.weight_per_piece_kg || 0;
                            const totalWeight = (ledger.piece_qty || 0) * weightPerPiece;
                            if (totalWeight === 0) return <span className="text-gray-400">-</span>;

                            return ledger._isConsolidated ? (
                              <span className="font-bold text-blue-600">
                                {totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className={`font-bold ${
                                ledger.direction === 'in' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {ledger.direction === 'in' ? '+' : '-'}{totalWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-medium text-gray-900 font-thai">
                            {ledger.production_date ? new Date(ledger.production_date).toLocaleDateString('th-TH') : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-medium text-gray-900 font-thai">
                            {ledger.expiry_date ? new Date(ledger.expiry_date).toLocaleDateString('th-TH') : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="font-mono text-thai-gray-700">{ledger.reference_no || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap align-top">
                          <span className="text-gray-700 font-thai">{ledger.remarks || '-'}</span>
                        </td>
                        <td className="px-2 py-0.5 whitespace-nowrap align-top">
                          <span className="text-thai-gray-700 font-thai">
                            {(ledger as any).master_system_user?.full_name || 
                             (ledger as any).master_system_user?.username || 
                             (ledger.created_by ? `User #${ledger.created_by}` : '-')}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
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

export default function InventoryLedgerPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inventory.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูประวัติการเคลื่อนไหวสต็อก</p>
          </div>
        </div>
      }
    >
      <InventoryLedgerPage />
    </PermissionGuard>
  );
}