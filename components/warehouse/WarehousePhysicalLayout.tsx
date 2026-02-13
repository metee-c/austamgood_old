'use client';

import { useState, useEffect, useCallback } from 'react';

// Additional Inventory Table Component
function AdditionalInventoryTable() {
  const [data, setData] = useState<any[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/warehouse/additional-inventory')
      .then(res => res.json())
      .then(result => {
        setData(result.data || []);
        setDates(result.dates || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-xs">กำลังโหลด...</div>;
  }

  if (!data.length) {
    return <div className="text-center py-8 text-gray-400 text-xs">ไม่มีข้อมูล</div>;
  }

  // Group locations by type
  const pk001Data = data.find(row => row.location === 'PK001');
  const a10Data = data.filter(row => row.location.startsWith('A10-01-'));
  const a09Data = data.filter(row => row.location.startsWith('A09-01-'));

  return (
    <div className="overflow-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="bg-blue-100 border-b border-blue-200 text-blue-900">
            <th className="px-2 py-1.5 text-center font-semibold" colSpan={3}>Location</th>
            {dates.map(date => (
              <th key={date} className="px-2 py-1.5 text-center font-semibold min-w-[80px]">
                {new Date(date).getDate()}/{new Date(date).getMonth() + 1}
              </th>
            ))}
          </tr>
          <tr className="bg-blue-50 border-b border-blue-200 text-blue-900">
            <th className="px-2 py-1.5 text-center font-semibold">PK001</th>
            <th className="px-2 py-1.5 text-center font-semibold">A10-01</th>
            <th className="px-2 py-1.5 text-center font-semibold">A09-01</th>
            {dates.map(date => (
              <th key={date} className="px-2 py-1.5 text-center font-semibold min-w-[80px]">
                {new Date(date).getDate()}/{new Date(date).getMonth() + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* PK001 row */}
          <tr className="bg-white">
            <td className="px-2 py-1.5 font-medium text-gray-800">PK001</td>
            <td className="px-2 py-1.5 text-center text-gray-400">-</td>
            <td className="px-2 py-1.5 text-center text-gray-400">-</td>
            {dates.map(date => (
              <td key={date} className="px-2 py-1.5 text-center font-mono">
                {pk001Data?.dailyPallets[date] || 0}
              </td>
            ))}
          </tr>
          {/* A10 rows */}
          {a10Data.map((row, idx) => (
            <tr key={row.location} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
              <td className="px-2 py-1.5 text-center text-gray-400">-</td>
              <td className="px-2 py-1.5 font-medium text-gray-800">{row.location}</td>
              <td className="px-2 py-1.5 text-center text-gray-400">-</td>
              {dates.map(date => (
                <td key={date} className="px-2 py-1.5 text-center font-mono">
                  {row.dailyPallets[date] || 0}
                </td>
              ))}
            </tr>
          ))}
          {/* A09 rows */}
          {a09Data.map((row, idx) => (
            <tr key={row.location} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
              <td className="px-2 py-1.5 text-center text-gray-400">-</td>
              <td className="px-2 py-1.5 text-center text-gray-400">-</td>
              <td className="px-2 py-1.5 font-medium text-gray-800">{row.location}</td>
              {dates.map(date => (
                <td key={date} className="px-2 py-1.5 text-center font-mono">
                  {row.dailyPallets[date] || 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface LocationInventory {
  location_id: string;
  location_code: string;
  aisle: string;
  shelf: string;
  lock_number: number;
  has_inventory: boolean;
  sku_id?: string;
  sku_name?: string;
  pallet_id?: string;
  total_pack_qty?: number;
  total_piece_qty?: number;
  expiry_date?: string;
  mfg_date?: string;
  received_date?: string;
  reserved_pack_qty?: number;
}

interface SlotInventory {
  slot_index: number;
  aisle: string;
  levels: {
    level: number;
    positions: LocationInventory[];
  }[];
}

interface BlockInventory {
  slot_index: number;
  zone: string;
  location_code: string;
  pallets: {
    index: number;
    location_id: string;
    location_code: string;
    sku_id?: string;
    sku_name?: string;
    pallet_id?: string;
    total_pack_qty?: number;
    total_piece_qty?: number;
    production_date?: string;
    expiry_date?: string;
    reserved_pack_qty?: number;
  }[];
  total_pallets: number;
}

interface SlotOccupancy {
  aisle: string;
  slot: number;
  total_positions: number;
  occupied_positions: number;
  occupancy_rate: number;
}

interface OccupancyMap {
  [key: string]: SlotOccupancy;
}

interface SelectedCell {
  aisle: string;
  slot: number;
  section: string;
}

export default function WarehousePhysicalLayout() {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [showRack3D, setShowRack3D] = useState(false);
  const [slotData, setSlotData] = useState<SlotInventory | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyMap>({});
  const [loading, setLoading] = useState(false);
  const [loadingOccupancy, setLoadingOccupancy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<LocationInventory | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showBlock3D, setShowBlock3D] = useState(false);
  const [blockData, setBlockData] = useState<BlockInventory | null>(null);
  const [showPickingZone1Modal, setShowPickingZone1Modal] = useState(false);
  const [pickingZone1Data, setPickingZone1Data] = useState<any[]>([]);
  const [loadingPickingZone1, setLoadingPickingZone1] = useState(false);
  const [showRepackModal, setShowRepackModal] = useState(false);
  const [repackData, setRepackData] = useState<any[]>([]);
  const [loadingRepack, setLoadingRepack] = useState(false);
  // State สำหรับ Capacity Trend Dashboard
  interface TrendPoint { date: string; rack_pct: number; blk_pct: number; rack_occupied: number; rack_empty: number; blk_occupied: number; blk_empty: number }
  interface CapacityInfo { rack_total: number; rack_occupied: number; rack_empty: number; rack_pct: number; blk_total: number; blk_occupied: number; blk_empty: number; blk_pct: number }
  interface ZoneSummary { zone: string; section: string; storageType: string; productType: string; totalLocs: number; occupiedLocs: number; emptyLocs: number; pct: number; status: string; unit?: string; order?: number }
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [capacityInfo, setCapacityInfo] = useState<CapacityInfo | null>(null);
  const [zoneSummaries, setZoneSummaries] = useState<ZoneSummary[]>([]);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [hoveredTrend, setHoveredTrend] = useState<{ idx: number; x: number; y: number } | null>(null);

  // State สำหรับ PQ/MR Modal
  const [showPrepAreaModal, setShowPrepAreaModal] = useState(false);
  const [prepAreaZone, setPrepAreaZone] = useState<'PQ' | 'MR'>('PQ');
  const [prepAreaData, setPrepAreaData] = useState<any[]>([]);
  const [loadingPrepArea, setLoadingPrepArea] = useState(false);
  const [prepAreaSummary, setPrepAreaSummary] = useState<{ total_locations: number; occupied_locations: number; total_packages: number; staging_packages?: number } | null>(null);
  // State สำหรับ Package tooltip ใน PrepAreaModal
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [packageMousePos, setPackageMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fetch occupancy summary
  const fetchOccupancy = useCallback(async () => {
    setLoadingOccupancy(true);
    try {
      console.log('[DEBUG] Fetching occupancy data...');
      const response = await fetch('/api/warehouse/layout-inventory');
      const result = await response.json();
      console.log('[DEBUG] API Response:', { 
        status: response.status, 
        dataLength: result.data?.length,
        error: result.error,
        sampleData: result.data?.slice(0, 3),
        _debug: result._debug  // Show debug info from API
      });
      
      if (result.data) {
        const newOccupancy: OccupancyMap = {};
        let occupiedCount = 0;
        result.data.forEach((item: SlotOccupancy) => {
          const key = `${item.aisle}-${item.slot}`;
          newOccupancy[key] = item;
          if (item.occupied_positions > 0) {
            occupiedCount++;
          }
        });
        console.log('[DEBUG] Occupancy map created:', {
          totalSlots: Object.keys(newOccupancy).length,
          slotsWithInventory: occupiedCount,
          sampleKeys: Object.keys(newOccupancy).slice(0, 5),
          a01Slot1: newOccupancy['A01-1'],
          a01Slot29: newOccupancy['A01-29'],
        });
        setOccupancyData(newOccupancy);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('[DEBUG] Error fetching occupancy:', error);
    } finally {
      setLoadingOccupancy(false);
    }
  }, []);

  // Fetch capacity trend
  const fetchCapacityTrend = useCallback(async () => {
    setLoadingCapacity(true);
    try {
      const res = await fetch('/api/warehouse/capacity-trend');
      const json = await res.json();
      if (json.trend) {
        setTrendData(json.trend);
        setCapacityInfo(json.capacity);
        setZoneSummaries(json.zones || []);
      }
    } catch (e) {
      console.error('Capacity trend error:', e);
    } finally {
      setLoadingCapacity(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchOccupancy();
    fetchCapacityTrend();
  }, [fetchOccupancy, fetchCapacityTrend]);

  // Fetch slot details when cell is selected
  const fetchSlotDetails = useCallback(async (aisle: string, slot: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warehouse/layout-inventory?aisle=${aisle}&slot=${slot}`);
      const result = await response.json();
      if (result.data) {
        setSlotData(result.data);
      }
    } catch (error) {
      console.error('Error fetching slot details:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle cell click
  const handleCellClick = (aisle: string, slot: number, section: string) => {
    console.log(`[DEBUG] Cell clicked: ${aisle} slot ${slot}`, {
      occupancyData: occupancyData[`${aisle}-${slot}`],
      occupancyDataSize: Object.keys(occupancyData).length
    });
    setSelectedCell({ aisle, slot, section });
    setShowRack3D(true);
    setShowBlock3D(false);
    fetchSlotDetails(aisle, slot);
  };

  // Handle block cell click (AA-BLK, AB-BLK)
  const handleBlockCellClick = (zone: string, slot: number) => {
    console.log(`[DEBUG] Block cell clicked: ${zone} slot ${slot}`);
    setSelectedCell({ aisle: zone, slot, section: 'block' });
    setShowBlock3D(true);
    setShowRack3D(false);
    fetchBlockDetails(zone, slot);
  };

  // Fetch block details
  const fetchBlockDetails = useCallback(async (zone: string, slot: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/warehouse/layout-inventory?zone=${zone}&slot=${slot}&type=block`);
      const result = await response.json();
      if (result.data) {
        setBlockData(result.data);
      }
    } catch (error) {
      console.error('Error fetching block details:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Picking Zone 1 inventory (preparation area inventory)
  const fetchPickingZone1Data = useCallback(async () => {
    setLoadingPickingZone1(true);
    try {
      const response = await fetch('/api/warehouse/layout-inventory?type=picking-zone-1');
      const result = await response.json();
      if (result.data) {
        setPickingZone1Data(result.data);
      }
    } catch (error) {
      console.error('Error fetching Picking Zone 1 data:', error);
    } finally {
      setLoadingPickingZone1(false);
    }
  }, []);

  // Handle Picking Zone 1 click
  const handlePickingZone1Click = () => {
    setShowPickingZone1Modal(true);
    setShowRack3D(false);
    setShowBlock3D(false);
    setShowRepackModal(false);
    fetchPickingZone1Data();
  };

  // Fetch Repack inventory
  const fetchRepackData = useCallback(async () => {
    setLoadingRepack(true);
    try {
      const response = await fetch('/api/warehouse/layout-inventory?type=repack');
      const result = await response.json();
      if (result.data) {
        setRepackData(result.data);
      }
    } catch (error) {
      console.error('Error fetching Repack data:', error);
    } finally {
      setLoadingRepack(false);
    }
  }, []);

  // Handle Repack click
  const handleRepackClick = () => {
    setShowRepackModal(true);
    setShowRack3D(false);
    setShowBlock3D(false);
    setShowPickingZone1Modal(false);
    setShowPrepAreaModal(false);
    fetchRepackData();
  };

  // Fetch Prep Area (PQ/MR) packages
  const fetchPrepAreaData = useCallback(async (zone: 'PQ' | 'MR') => {
    setLoadingPrepArea(true);
    try {
      const response = await fetch(`/api/warehouse/prep-area-packages?zone=${zone}`);
      const result = await response.json();
      if (result.success) {
        setPrepAreaData(result.data);
        setPrepAreaSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching Prep Area data:', error);
    } finally {
      setLoadingPrepArea(false);
    }
  }, []);

  // Handle PQ click
  const handlePQClick = () => {
    setPrepAreaZone('PQ');
    setShowPrepAreaModal(true);
    setShowRack3D(false);
    setShowBlock3D(false);
    setShowPickingZone1Modal(false);
    setShowRepackModal(false);
    fetchPrepAreaData('PQ');
  };

  // Handle MR click
  const handleMRClick = () => {
    setPrepAreaZone('MR');
    setShowPrepAreaModal(true);
    setShowRack3D(false);
    setShowBlock3D(false);
    setShowPickingZone1Modal(false);
    setShowRepackModal(false);
    fetchPrepAreaData('MR');
  };

  // Get cell color based on occupancy rate (percentage) - Red gradient
  // 0% = #FEF2F2, 20% = #FECACA, 40% = #FCA5A5, 60% = #F87171, 80% = #EF4444, 100% = #B91C1C
  const getCellColor = (aisle: string, slot: number) => {
    // ถ้ายังโหลดไม่เสร็จ แสดงสีเทา
    if (loadingOccupancy) {
      return { fill: '#f3f4f6', stroke: '#9ca3af' }; // gray while loading
    }
    
    const key = `${aisle}-${slot}`;
    const occupancy = occupancyData[key];
    
    // ถ้าไม่มีข้อมูลหรือ 0% = เทาอ่อน
    if (!occupancy || occupancy.total_positions === 0 || occupancy.occupied_positions === 0) {
      return { fill: '#F3F4F6', stroke: '#E5E7EB' }; // 0% - เทาอ่อน
    }
    
    const rate = occupancy.occupancy_rate * 100; // convert to percentage
    
    // ไล่เฉดสีแดงตาม occupancy rate
    if (rate <= 20) {
      return { fill: '#FECACA', stroke: '#FCA5A5' }; // 1-20% - แดงอ่อน
    } else if (rate <= 40) {
      return { fill: '#FCA5A5', stroke: '#F87171' }; // 21-40% - แดงกลางอ่อน
    } else if (rate <= 60) {
      return { fill: '#F87171', stroke: '#EF4444' }; // 41-60% - แดงกลาง
    } else if (rate <= 80) {
      return { fill: '#EF4444', stroke: '#DC2626' }; // 61-80% - แดงเข้ม
    } else {
      return { fill: '#B91C1C', stroke: '#991B1B' }; // 81-100% - แดงเข้มสุด
    }
  };

  // Mapping configuration for grid to aisle
  // Top row = A01 (34 slots = 68 locks)
  // Rows 2-10 left side (before aisle gap) = B02-B10
  // Rows 2-10 right side (after aisle gap) = A02-A10
  const rackRows = [
    { id: 1, y: 70, leftAisles: ['B02', 'B03'], rightAisles: ['A02', 'A03'] },
    { id: 2, y: 130, leftAisles: ['B04', 'B05'], rightAisles: ['A04', 'A05'] },
    { id: 3, y: 190, leftAisles: ['B06', 'B07'], rightAisles: ['A06', 'A07'] },
    { id: 4, y: 250, leftAisles: ['B08', 'B09'], rightAisles: ['A08', 'A09'] },
  ];

  const docks = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D00'];

  // Generate clickable rack cells for a row
  const generateClickableRackCells = (
    startX: number,
    width: number,
    cellCount: number,
    aisle: string,
    yOffset: number = 0
  ) => {
    const cells = [];
    const cellWidth = width / cellCount;

    for (let i = 0; i < cellCount; i++) {
      const slot = i + 1;
      const isSelected = selectedCell?.aisle === aisle && selectedCell?.slot === slot;
      const colors = getCellColor(aisle, slot);

      cells.push(
        <rect
          key={`${aisle}-${i}`}
          x={startX + i * cellWidth}
          y={yOffset}
          width={cellWidth - 1}
          height={18}
          fill={colors.fill}
          stroke={isSelected ? '#60A5FA' : colors.stroke}
          strokeWidth={isSelected ? 2 : 0.5}
          style={{ cursor: 'pointer' }}
          onClick={() => handleCellClick(aisle, slot, aisle.startsWith('B') ? 'left' : 'right')}
        />
      );
    }
    return cells;
  };

  // Generate clickable block cells for AA-BLK / AB-BLK zones
  // แต่ละช่องแสดงสี่เหลี่ยมเล็ก 20 อัน (2 คอลัมน์ × 10 แถว) แทนพาเลท
  const generateClickableBlockCells = (
    startX: number,
    cellCount: number,
    zone: string,
    cellWidth: number = 24,
    cellHeight: number = 88,
    bottomToTop: boolean = false // true = ไล่จากล่างขึ้นบน (สำหรับ AB-BLK)
  ) => {
    const cells = [];
    const miniCols = 2;  // 2 คอลัมน์
    const miniRows = 10; // 10 แถว
    const padding = 2;   // padding รอบๆ
    const gap = 1;       // ช่องว่างระหว่าง mini rect (เพิ่มจาก 0.5)
    const miniWidth = (cellWidth - padding * 2 - gap * (miniCols - 1)) / miniCols;
    const miniHeight = (cellHeight - padding * 2 - gap * (miniRows - 1)) / miniRows;
    
    for (let i = 0; i < cellCount; i++) {
      const slot = i + 1;
      const isSelected = selectedCell?.aisle === zone && selectedCell?.slot === slot;
      const cellX = startX + i * cellWidth;
      
      // Get pallet count for this slot from occupancy data
      const key = `${zone}-${slot}`;
      const occupancy = occupancyData[key];
      const palletCount = occupancy?.occupied_positions || 0;
      
      // Generate mini rectangles for pallets (2 cols × 10 rows)
      const miniRects = [];
      for (let row = 0; row < miniRows; row++) {
        for (let col = 0; col < miniCols; col++) {
          const palletIndex = row * miniCols + col;
          const hasPallet = palletIndex < palletCount;
          
          // คำนวณ y position: ถ้า bottomToTop ให้เริ่มจากล่าง
          const actualRow = bottomToTop ? (miniRows - 1 - row) : row;
          
          miniRects.push(
            <rect
              key={`${zone}-${i}-mini-${row}-${col}`}
              x={cellX + padding + col * (miniWidth + gap)}
              y={padding + actualRow * (miniHeight + gap)}
              width={miniWidth}
              height={miniHeight}
              fill={hasPallet ? '#F97316' : '#FEF3C7'}
              stroke={hasPallet ? '#EA580C' : '#FCD34D'}
              strokeWidth={0.3}
              rx={0.5}
            />
          );
        }
      }

      cells.push(
        <g
          key={`${zone}-${i}`}
          style={{ cursor: 'pointer' }}
          onClick={() => handleBlockCellClick(zone, slot)}
        >
          {/* Background/border */}
          <rect
            x={cellX}
            y={0}
            width={cellWidth}
            height={cellHeight}
            fill="transparent"
            stroke={isSelected ? '#60A5FA' : '#D97706'}
            strokeWidth={isSelected ? 2 : 0.5}
            rx={1}
          />
          {/* Mini pallet rectangles */}
          {miniRects}
        </g>
      );
    }
    return cells;
  };

  // Picking Zone 1 Modal - แสดงสินค้าคงเหลือในบ้านหยิบ
  const PickingZone1Modal = () => {
    if (!showPickingZone1Modal) return null;

    const totalItems = pickingZone1Data.length;
    const totalPieces = pickingZone1Data.reduce((sum: number, item: any) => sum + (item.total_piece_qty || 0), 0);
    const totalReserved = pickingZone1Data.reduce((sum: number, item: any) => sum + (item.reserved_piece_qty || 0), 0);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-4 max-w-5xl w-full shadow-2xl border border-blue-100 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-4 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${loadingPickingZone1 ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className={`text-sm font-medium ${loadingPickingZone1 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {loadingPickingZone1 ? 'กำลังโหลด...' : 'ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Picking Zone 1 - บ้านหยิบ</h2>
              <p className="text-gray-500 text-sm mt-1">
                {totalItems} รายการ • {totalPieces.toLocaleString()} ชิ้น • จอง {totalReserved.toLocaleString()} ชิ้น
              </p>
            </div>
            <button
              onClick={() => setShowPickingZone1Modal(false)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">ตำแหน่ง</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">รหัสสินค้า</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">ชื่อสินค้า</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">พาเลท</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">คงเหลือ (ชิ้น)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">จอง (ชิ้น)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b">วันผลิต</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b">วันหมดอายุ</th>
                </tr>
              </thead>
              <tbody>
                {loadingPickingZone1 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        กำลังโหลดข้อมูล...
                      </div>
                    </td>
                  </tr>
                ) : pickingZone1Data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      ไม่พบสินค้าในบ้านหยิบ
                    </td>
                  </tr>
                ) : (
                  pickingZone1Data.map((item: any, index: number) => {
                    const isExpiringSoon = item.expiry_date && (() => {
                      const expiry = new Date(item.expiry_date);
                      const today = new Date();
                      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
                    })();
                    const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();

                    return (
                      <tr key={index} className={`border-b hover:bg-blue-50/50 ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs">{item.location_id}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sku_id}</td>
                        <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={item.sku_name}>{item.sku_name || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.pallet_id || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.total_piece_qty?.toLocaleString() || 0}</td>
                        <td className="px-3 py-2 text-right text-orange-600">{item.reserved_piece_qty?.toLocaleString() || 0}</td>
                        <td className="px-3 py-2 text-center text-xs">{item.production_date || '-'}</td>
                        <td className={`px-3 py-2 text-center text-xs ${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-yellow-600 font-medium' : ''}`}>
                          {item.expiry_date || '-'}
                          {isExpired && <span className="ml-1 text-red-500">⚠️</span>}
                          {isExpiringSoon && !isExpired && <span className="ml-1 text-yellow-500">⏰</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-4 flex-shrink-0">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
                <span>หมดอายุแล้ว</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                <span>ใกล้หมดอายุ (≤30 วัน)</span>
              </div>
            </div>
            <button
              onClick={() => setShowPickingZone1Modal(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Repack Modal - แสดงสินค้าคงเหลือในพื้นที่ Repack
  const RepackModal = () => {
    if (!showRepackModal) return null;

    const totalItems = repackData.length;
    const totalPieces = repackData.reduce((sum: number, item: any) => sum + (item.total_piece_qty || 0), 0);
    const totalReserved = repackData.reduce((sum: number, item: any) => sum + (item.reserved_piece_qty || 0), 0);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-4 max-w-5xl w-full shadow-2xl border border-blue-100 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-4 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${loadingRepack ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className={`text-sm font-medium ${loadingRepack ? 'text-yellow-600' : 'text-green-600'}`}>
                  {loadingRepack ? 'กำลังโหลด...' : 'ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Repack - พื้นที่แพ็คใหม่</h2>
              <p className="text-gray-500 text-sm mt-1">
                {totalItems} รายการ • {totalPieces.toLocaleString()} ชิ้น • จอง {totalReserved.toLocaleString()} ชิ้น
              </p>
            </div>
            <button
              onClick={() => setShowRepackModal(false)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-blue-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">ตำแหน่ง</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">รหัสสินค้า</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">ชื่อสินค้า</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">พาเลท</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">คงเหลือ (ชิ้น)</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 border-b">จอง (ชิ้น)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b">วันผลิต</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b">วันหมดอายุ</th>
                </tr>
              </thead>
              <tbody>
                {loadingRepack ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        กำลังโหลดข้อมูล...
                      </div>
                    </td>
                  </tr>
                ) : repackData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      ไม่พบสินค้าในพื้นที่ Repack
                    </td>
                  </tr>
                ) : (
                  repackData.map((item: any, index: number) => {
                    const isExpiringSoon = item.expiry_date && (() => {
                      const expiry = new Date(item.expiry_date);
                      const today = new Date();
                      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
                    })();
                    const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();

                    return (
                      <tr key={index} className={`border-b hover:bg-blue-50/50 ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''}`}>
                        <td className="px-3 py-2 font-mono text-xs">{item.location_id}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sku_id}</td>
                        <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={item.sku_name}>{item.sku_name || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.pallet_id || '-'}</td>
                        <td className="px-3 py-2 text-right font-medium">{item.total_piece_qty?.toLocaleString() || 0}</td>
                        <td className="px-3 py-2 text-right text-orange-600">{item.reserved_piece_qty?.toLocaleString() || 0}</td>
                        <td className="px-3 py-2 text-center text-xs">{item.production_date || '-'}</td>
                        <td className={`px-3 py-2 text-center text-xs ${isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-yellow-600 font-medium' : ''}`}>
                          {item.expiry_date || '-'}
                          {isExpired && <span className="ml-1 text-red-500">⚠️</span>}
                          {isExpiringSoon && !isExpired && <span className="ml-1 text-yellow-500">⏰</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-4 flex-shrink-0">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300"></div>
                <span>หมดอายุแล้ว</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></div>
                <span>ใกล้หมดอายุ (≤30 วัน)</span>
              </div>
            </div>
            <button
              onClick={() => setShowRepackModal(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Prep Area Modal (PQ/MR) - แสดง 3D view ของ packages ใน PQ01-PQ10, MR01-MR10, PQTD, MRTD
  const PrepAreaModal = () => {
    if (!showPrepAreaModal) return null;

    const zoneName = prepAreaZone === 'PQ' ? 'PQ (ของแถม PQ)' : 'MR (ของแถม MR)';
    const zoneColor = prepAreaZone === 'PQ' ? 'blue' : 'purple';

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-4 max-w-6xl w-full shadow-2xl border border-blue-100 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-start mb-4 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${loadingPrepArea ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className={`text-sm font-medium ${loadingPrepArea ? 'text-yellow-600' : 'text-green-600'}`}>
                  {loadingPrepArea ? 'กำลังโหลด...' : 'ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{zoneName} - พื้นที่จัดเก็บของแถม</h2>
              <p className="text-gray-500 text-sm mt-1">
                {prepAreaSummary?.occupied_locations || 0}/{prepAreaSummary?.total_locations || 0} ตำแหน่งมีของ • 
                {prepAreaSummary?.total_packages || 0} แพ็ค
                {(prepAreaSummary?.staging_packages || 0) > 0 && (
                  <span className="text-amber-600"> • {prepAreaSummary?.staging_packages} แพ็ครอโหลด</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle Zone */}
              <button
                onClick={() => {
                  const newZone = prepAreaZone === 'PQ' ? 'MR' : 'PQ';
                  setPrepAreaZone(newZone);
                  setSelectedPackage(null);
                  fetchPrepAreaData(newZone);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  prepAreaZone === 'PQ' 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                สลับไป {prepAreaZone === 'PQ' ? 'MR' : 'PQ'}
              </button>
              <button
                onClick={() => setShowPrepAreaModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 3D Pallet View */}
          <div className="flex-1 overflow-auto">
            {loadingPrepArea ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  กำลังโหลดข้อมูล...
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {/* Storage Locations (01-10) */}
                <div className="grid grid-cols-5 gap-3">
                  {prepAreaData.filter(loc => !loc.location_code.endsWith('TD')).map((location) => (
                    <div
                      key={location.location_code}
                      className={`border-2 rounded-xl p-3 transition-all ${
                        location.packages.length > 0 
                          ? prepAreaZone === 'PQ' ? 'border-blue-300 bg-blue-50' : 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold text-sm ${
                          location.packages.length > 0 
                            ? prepAreaZone === 'PQ' ? 'text-blue-700' : 'text-purple-700'
                            : 'text-gray-400'
                        }`}>
                          {location.location_code}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          location.packages.length > 0 
                            ? prepAreaZone === 'PQ' ? 'bg-blue-200 text-blue-800' : 'bg-purple-200 text-purple-800'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {location.packages.length} แพ็ค
                        </span>
                      </div>
                      
                      {/* 3D Pallet visualization */}
                      <div className="relative h-32 bg-gradient-to-b from-gray-100 to-gray-200 rounded-lg overflow-hidden" onClick={() => setSelectedPackage(null)}>
                        {location.packages.length === 0 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                            ว่าง
                          </div>
                        ) : (
                          <div className="absolute inset-0 p-1">
                            {/* Grid of packages (max 12 visible) */}
                            <div className="grid grid-cols-3 gap-0.5 h-full">
                              {location.packages.slice(0, 12).map((pkg: any, idx: number) => (
                                <div
                                  key={pkg.id}
                                  className={`rounded text-[8px] flex items-center justify-center font-medium truncate px-0.5 cursor-pointer hover:ring-2 hover:ring-white hover:ring-opacity-50 transition-all ${
                                    pkg.trip_number 
                                      ? 'bg-green-400 text-green-900 hover:bg-green-500' 
                                      : prepAreaZone === 'PQ' ? 'bg-blue-400 text-blue-900 hover:bg-blue-500' : 'bg-purple-400 text-purple-900 hover:bg-purple-500'
                                  } ${selectedPackage?.id === pkg.id ? 'ring-2 ring-white' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedPackage?.id === pkg.id) {
                                      setSelectedPackage(null);
                                    } else {
                                      setSelectedPackage(pkg);
                                      const rect = (e.currentTarget.closest('.relative') as HTMLElement)?.getBoundingClientRect();
                                      if (rect) {
                                        setPackageMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                      }
                                    }
                                  }}
                                >
                                  #{pkg.package_number}
                                </div>
                              ))}
                              {location.packages.length > 12 && (
                                <div className="rounded bg-gray-300 text-gray-600 text-[8px] flex items-center justify-center font-medium">
                                  +{location.packages.length - 12}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Package Tooltip */}
                        {selectedPackage && location.packages.some((p: any) => p.id === selectedPackage.id) && (
                          <div 
                            className="absolute bg-gray-800 text-white rounded-md shadow-lg px-3 py-2 text-xs z-50 pointer-events-none"
                            style={{ 
                              left: Math.min(Math.max(packageMousePos.x - 60, 5), 80), 
                              top: Math.max(packageMousePos.y - 80, 5),
                              minWidth: '140px'
                            }}
                          >
                            <div className={`font-semibold mb-1 ${prepAreaZone === 'PQ' ? 'text-blue-300' : 'text-purple-300'}`}>
                              แพ็ค #{selectedPackage.package_number}
                            </div>
                            <div className="space-y-0.5">
                              <div className="truncate"><span className="text-gray-400">ร้าน:</span> {selectedPackage.shop_name || '-'}</div>
                              <div><span className="text-gray-400">BFS:</span> <span className="font-mono text-[10px]">{selectedPackage.face_sheet_no}</span></div>
                              {selectedPackage.trip_number && (
                                <div><span className="text-gray-400">สายรถ:</span> <span className="text-green-300">{selectedPackage.trip_number}</span></div>
                              )}
                              {selectedPackage.hub && (
                                <div><span className="text-gray-400">Hub:</span> {selectedPackage.hub}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Package list (collapsed) */}
                      {location.packages.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            ดูรายละเอียด
                          </summary>
                          <div className="mt-1 max-h-32 overflow-y-auto text-xs space-y-1">
                            {location.packages.map((pkg: any) => (
                              <div key={pkg.id} className={`p-1.5 rounded ${pkg.trip_number ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <div className="font-medium">#{pkg.package_number} - {pkg.shop_name || 'N/A'}</div>
                                <div className="text-gray-500 text-[10px]">
                                  {pkg.face_sheet_no} {pkg.trip_number && `• ${pkg.trip_number}`}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>

                {/* Staging Area (TD) - แสดงแพ็ครอโหลดจาก loadlist ที่ยังไม่โหลด */}
                {prepAreaData.filter(loc => loc.location_code.endsWith('TD')).map((location) => {
                  const hasStagingPackages = location.staging_packages && location.staging_packages.length > 0;
                  
                  return (
                  <div
                    key={location.location_code}
                    className={`border-2 rounded-xl p-4 ${
                      hasStagingPackages 
                        ? 'border-amber-400 bg-amber-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg ${hasStagingPackages ? 'text-amber-700' : 'text-gray-400'}`}>
                          {location.location_code}
                        </span>
                        <span className="text-sm text-gray-500">- จุดพักรอโหลด (Staging)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasStagingPackages && (
                          <span className="text-sm px-3 py-1 rounded-full bg-amber-200 text-amber-800">
                            {location.staging_packages.length} แพ็ค
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {!hasStagingPackages ? (
                      <div className="text-center py-8 text-gray-400">
                        ไม่มีแพ็ครอโหลด
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* แสดงแพ็ครอโหลด: แพ็ค x/x, ชื่อร้าน, เลขเอกสาร */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {location.staging_packages.map((pkg: any, idx: number) => (
                            <div
                              key={pkg.package_id}
                              className="bg-amber-100 border border-amber-300 rounded-lg p-2 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-900">แพ็ค {pkg.package_number}</span>
                              </div>
                              <div className="text-amber-800 truncate" title={pkg.shop_name}>
                                {pkg.shop_name || '-'}
                              </div>
                              <div className="text-amber-600 font-mono text-xs">
                                {pkg.order_no}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-4 flex-shrink-0 pt-3 border-t">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${prepAreaZone === 'PQ' ? 'bg-blue-400' : 'bg-purple-400'}`}></div>
                <span>รอแมพสายรถ</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-400"></div>
                <span>แมพสายรถแล้ว</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-300"></div>
                <span>รอโหลด (Staging)</span>
              </div>
            </div>
            <button
              onClick={() => setShowPrepAreaModal(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 3D Block Storage Component (แสดงพาเลทที่เก็บใน 1 location + 3D มุมข้าง)
  const BlockStorage3D = () => {
    if (!showBlock3D || !selectedCell) return null;

    const pallets = blockData?.pallets || [];
    const totalPallets = blockData?.total_pallets || 0;
    const locationCode = blockData?.location_code || `${selectedCell.aisle}-${selectedCell.slot.toString().padStart(2, '0')}`;

    // แสดงพาเลทใน 3D view (สูงสุด 10 ตัว × 2 ชั้น = 20 ตำแหน่ง)
    const palletsPerRow = 10;
    const stackLevels = 2;
    const maxDisplay = palletsPerRow * stackLevels;

    // จัดเรียง pallets เป็น 2 ชั้น (L1 = index 0-9, L2 = index 10-19)
    const level1Pallets = pallets.slice(0, palletsPerRow);
    const level2Pallets = pallets.slice(palletsPerRow, maxDisplay);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-4 max-w-3xl w-full shadow-2xl border border-amber-100 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className={`text-sm font-medium ${loading ? 'text-yellow-600' : 'text-green-600'}`}>
                  {loading ? 'กำลังโหลด...' : 'ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Block Storage</h2>
              <p className="text-gray-500 text-sm mt-1">
                {locationCode} • {totalPallets} พาเลท
              </p>
            </div>
            <button
              onClick={() => setShowBlock3D(false)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 3D Block Storage Visualization - Side View */}
          <div className="relative bg-gradient-to-b from-amber-50 to-white rounded-xl p-4 border border-amber-100" onClick={() => setHoveredPosition(null)}>
            <svg viewBox="0 0 520 180" className="w-full">
              <defs>
                <linearGradient id="palletWood" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d4a574" />
                  <stop offset="50%" stopColor="#c4956a" />
                  <stop offset="100%" stopColor="#b8895e" />
                </linearGradient>
                <linearGradient id="cargoBoxBlock" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <filter id="blockShadow">
                  <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.15"/>
                </filter>
              </defs>

              {/* Floor */}
              <rect x="10" y="160" width="500" height="10" fill="#94a3b8" rx="2"/>

              {/* Front/Back labels - above level 2 */}
              <text x="15" y="22" fontSize="9" fill="#64748b" fontWeight="bold">← หน้า (ทางเดิน)</text>
              <text x="505" y="22" fontSize="9" fill="#64748b" fontWeight="bold" textAnchor="end">หลัง →</text>

              {/* 10 Pallet positions × 2 levels */}
              {[...Array(palletsPerRow)].map((_, posIndex) => {
                const posX = 15 + posIndex * 50;
                const palletWidth = 45;
                const palletHeight = 8;
                const boxHeight = 55;

                // Get data for this position
                const level1Data = level1Pallets[posIndex];
                const level2Data = level2Pallets[posIndex];

                return (
                  <g key={posIndex} filter="url(#blockShadow)">
                    {/* Level 1 - Ground */}
                    <g>
                      {/* Pallet L1 */}
                      <rect x={posX} y={152} width={palletWidth} height={palletHeight} fill="url(#palletWood)" rx="1"/>
                      {/* Pallet blocks */}
                      <rect x={posX + 2} y={152} width={8} height={palletHeight} fill="#a67c52"/>
                      <rect x={posX + 18} y={152} width={8} height={palletHeight} fill="#a67c52"/>
                      <rect x={posX + 34} y={152} width={8} height={palletHeight} fill="#a67c52"/>
                      
                      {/* Cargo L1 */}
                      {level1Data ? (
                        <g
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hoveredPosition?.pallet_id === level1Data.pallet_id) {
                              setHoveredPosition(null);
                            } else {
                              setHoveredPosition({
                                location_id: level1Data.location_id,
                                location_code: level1Data.location_code,
                                aisle: selectedCell.aisle,
                                shelf: 'BLK',
                                lock_number: selectedCell.slot,
                                has_inventory: true,
                                sku_id: level1Data.sku_id,
                                sku_name: level1Data.sku_name,
                                pallet_id: level1Data.pallet_id,
                                total_pack_qty: level1Data.total_pack_qty,
                                total_piece_qty: level1Data.total_piece_qty,
                                expiry_date: level1Data.expiry_date,
                                mfg_date: level1Data.production_date,
                              });
                              const rect = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect();
                              if (rect) {
                                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                              }
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect x={posX + 2} y={152 - boxHeight} width={palletWidth - 4} height={boxHeight} fill="url(#cargoBoxBlock)" rx="2"/>
                          <text x={posX + palletWidth/2} y={152 - boxHeight/2} fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">{posIndex + 1}</text>
                        </g>
                      ) : (
                        <rect x={posX + 2} y={152 - boxHeight} width={palletWidth - 4} height={boxHeight} fill="#e5e7eb" rx="2" strokeDasharray="3 2" stroke="#9ca3af" strokeWidth="0.5"/>
                      )}
                    </g>

                    {/* Level 2 - Stacked */}
                    <g>
                      {/* Pallet L2 */}
                      <rect x={posX} y={152 - boxHeight - palletHeight} width={palletWidth} height={palletHeight} fill="url(#palletWood)" rx="1"/>
                      <rect x={posX + 2} y={152 - boxHeight - palletHeight} width={8} height={palletHeight} fill="#a67c52"/>
                      <rect x={posX + 18} y={152 - boxHeight - palletHeight} width={8} height={palletHeight} fill="#a67c52"/>
                      <rect x={posX + 34} y={152 - boxHeight - palletHeight} width={8} height={palletHeight} fill="#a67c52"/>
                      
                      {/* Cargo L2 */}
                      {level2Data ? (
                        <g
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hoveredPosition?.pallet_id === level2Data.pallet_id) {
                              setHoveredPosition(null);
                            } else {
                              setHoveredPosition({
                                location_id: level2Data.location_id,
                                location_code: level2Data.location_code,
                                aisle: selectedCell.aisle,
                                shelf: 'BLK',
                                lock_number: selectedCell.slot,
                                has_inventory: true,
                                sku_id: level2Data.sku_id,
                                sku_name: level2Data.sku_name,
                                pallet_id: level2Data.pallet_id,
                                total_pack_qty: level2Data.total_pack_qty,
                                total_piece_qty: level2Data.total_piece_qty,
                                expiry_date: level2Data.expiry_date,
                                mfg_date: level2Data.production_date,
                              });
                              const rect = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect();
                              if (rect) {
                                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                              }
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect x={posX + 2} y={152 - boxHeight - palletHeight - boxHeight} width={palletWidth - 4} height={boxHeight} fill="url(#cargoBoxBlock)" rx="2"/>
                          <text x={posX + palletWidth/2} y={152 - boxHeight - palletHeight - boxHeight/2} fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">{posIndex + 11}</text>
                        </g>
                      ) : (
                        <rect x={posX + 2} y={152 - boxHeight - palletHeight - boxHeight} width={palletWidth - 4} height={boxHeight} fill="#e5e7eb" rx="2" strokeDasharray="3 2" stroke="#9ca3af" strokeWidth="0.5"/>
                      )}
                    </g>

                    {/* Position number */}
                    <text x={posX + palletWidth/2} y={175} fontSize="8" fill="#64748b" textAnchor="middle">{(posIndex + 1).toString().padStart(2, '0')}</text>
                  </g>
                );
              })}

              {/* Level labels */}
              <text x="5" y="125" fontSize="8" fill="#64748b" fontWeight="bold">L1</text>
              <text x="5" y="60" fontSize="8" fill="#64748b" fontWeight="bold">L2</text>
            </svg>

            {/* Tooltip for clicked cargo */}
            {hoveredPosition && (
              <div 
                className="absolute bg-gray-800 text-white rounded-md shadow-lg px-3 py-2 text-xs z-50"
                style={{ 
                  left: Math.min(mousePos.x + 12, 400), 
                  top: mousePos.y - 10,
                  maxWidth: '220px'
                }}
              >
                <div className="font-semibold text-amber-300 mb-1">{hoveredPosition.location_code}</div>
                <div className="space-y-0.5">
                  <div className="truncate" title={hoveredPosition.sku_name}><span className="text-gray-400">สินค้า:</span> {hoveredPosition.sku_name || '-'}</div>
                  <div><span className="text-gray-400">พาเลท:</span> <span className="font-mono">{hoveredPosition.pallet_id || '-'}</span></div>
                  <div><span className="text-gray-400">จำนวน:</span> {hoveredPosition.total_piece_qty?.toLocaleString() || '-'} ชิ้น</div>
                  <div><span className="text-gray-400">ผลิต:</span> {hoveredPosition.mfg_date || '-'}</div>
                  <div><span className="text-gray-400">หมดอายุ:</span> {hoveredPosition.expiry_date || '-'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Summary info */}
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(to bottom, #fb923c, #f97316)' }}></div>
                <span>มีสินค้า</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-gray-200 border border-dashed border-gray-400"></div>
                <span>ว่าง</span>
              </div>
            </div>
            <div>
              {totalPallets > maxDisplay && (
                <span className="text-amber-600">แสดง {maxDisplay} จาก {totalPallets} พาเลท</span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setShowBlock3D(false);
                setHoveredPosition(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 3D Selective Rack Component with real data
  const SelectiveRack3D = () => {
    if (!showRack3D || !selectedCell) return null;

    const levels = 5;
    const palletsPerLevel = 2;

    // Calculate occupancy from real data
    const occupiedCount = slotData?.levels.reduce((acc, level) => {
      return acc + level.positions.filter(p => p.has_inventory).length;
    }, 0) || 0;

    // Generate location codes for this slot
    // slot 1 = locks 001,002; slot 2 = locks 003,004; etc.
    const lock1 = (selectedCell.slot - 1) * 2 + 1;
    const lock2 = lock1 + 1;
    const lock1Str = lock1.toString().padStart(3, '0');
    const lock2Str = lock2.toString().padStart(3, '0');

    // Helper to get location code for a level and position
    const getLocationCode = (level: number, posIndex: number) => {
      const levelStr = level.toString().padStart(2, '0');
      const lockStr = posIndex === 0 ? lock1Str : lock2Str;
      return `${selectedCell.aisle}-${levelStr}-${lockStr}`;
    };

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-4 max-w-xl w-full shadow-2xl border border-blue-100 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className={`text-sm font-medium ${loading ? 'text-yellow-600' : 'text-green-600'}`}>
                  {loading ? 'กำลังโหลด...' : 'ACTIVE'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Selective Rack</h2>
              <p className="text-gray-500 text-sm mt-1">
                {selectedCell.aisle} • Slot {selectedCell.slot} • {occupiedCount}/10 ตำแหน่งมีสินค้า
              </p>
            </div>
            <button
              onClick={() => setShowRack3D(false)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 3D Rack Visualization */}
          <div className="relative bg-gradient-to-b from-blue-50 to-white rounded-xl p-4 border border-blue-100" onClick={() => setHoveredPosition(null)}>
            <svg viewBox="0 0 400 320" className="w-full">
              <defs>
                <linearGradient id="metalFrameLight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e40af" />
                  <stop offset="50%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="beamOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="50%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <filter id="shadowLight">
                  <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.15"/>
                </filter>
              </defs>

              {/* Background grid */}
              <pattern id="gridLight" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e7ff" strokeWidth="0.5"/>
              </pattern>
              <rect width="400" height="320" fill="url(#gridLight)" opacity="0.5"/>

              {/* Rack frame - 2 posts only */}
              <g filter="url(#shadowLight)">
                <rect x="30" y="20" width="12" height="280" fill="url(#metalFrameLight)" rx="2"/>
                <rect x="358" y="20" width="12" height="280" fill="url(#metalFrameLight)" rx="2"/>
                <line x1="36" y1="30" x2="36" y2="290" stroke="#1e40af" strokeWidth="2"/>
                <line x1="364" y1="30" x2="364" y2="290" stroke="#1e40af" strokeWidth="2"/>
              </g>

              {/* 5 Levels */}
              {[...Array(levels)].map((_, levelIndex) => {
                const floorY = 300;
                const beamHeight = 8;
                const palletHeight = 6;
                const boxHeight = 38;
                const levelSpacing = 62;

                const isGroundLevel = levelIndex === 0;
                const beamY = isGroundLevel ? floorY : floorY - (levelIndex * levelSpacing);
                const palletY = isGroundLevel ? floorY - palletHeight : beamY - palletHeight;

                // Get real data for this level
                const levelData = slotData?.levels.find(l => l.level === levelIndex + 1);
                const positions = levelData?.positions || [];

                return (
                  <g key={levelIndex}>
                    {/* Beam with location codes (skip beam for ground level but show codes) */}
                    {!isGroundLevel && (
                      <g>
                        <rect x="30" y={beamY} width="340" height={beamHeight} fill="url(#beamOrange)" rx="1"/>
                        {/* Location codes on beam */}
                        <text x="125" y={beamY + 6} fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">
                          {getLocationCode(levelIndex + 1, 0)}
                        </text>
                        <text x="275" y={beamY + 6} fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">
                          {getLocationCode(levelIndex + 1, 1)}
                        </text>
                      </g>
                    )}

                    {/* Level label */}
                    <g transform={`translate(8, ${palletY - 25})`}>
                      <rect x="0" y="0" width="20" height="20" fill="#3b82f6" rx="4"/>
                      <text x="10" y="14" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">L{levelIndex + 1}</text>
                    </g>

                    {/* 2 Pallets per level */}
                    {[...Array(palletsPerLevel)].map((_, palletIndex) => {
                      const palletWidth = 130;
                      const boxWidth = 110;
                      const gapBetweenPallets = 20;
                      const startX = 60;
                      const palletX = startX + palletIndex * (palletWidth + gapBetweenPallets);
                      const bayCenterX = palletX + palletWidth / 2;
                      const boxX = bayCenterX - boxWidth / 2;

                      // Get inventory for this position
                      const positionData = positions[palletIndex];
                      const hasCargo = positionData?.has_inventory || false;

                      const totalParts = 7;
                      const unitWidth = palletWidth / totalParts;
                      const blockW = unitWidth;
                      const spaceW = unitWidth * 2;

                      return (
                        <g key={palletIndex} className="cursor-pointer hover:opacity-80 transition-opacity">
                          {/* Pallet */}
                          <rect x={palletX} y={palletY} width={palletWidth} height={palletHeight} fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2"/>
                          <rect x={palletX} y={palletY} width={blockW} height={palletHeight} fill="#9ca3af"/>
                          <rect x={palletX + blockW + spaceW} y={palletY} width={blockW} height={palletHeight} fill="#9ca3af"/>
                          <rect x={palletX + blockW + spaceW + blockW + spaceW} y={palletY} width={blockW} height={palletHeight} fill="#9ca3af"/>

                          {/* Location code for L1 (ground level - no beam) */}
                          {isGroundLevel && (
                            <text x={bayCenterX} y={palletY + 12} fontSize="7" fill="#6b7280" textAnchor="middle" fontWeight="bold">
                              {getLocationCode(1, palletIndex)}
                            </text>
                          )}

                          {/* Cargo box or empty slot */}
                          {hasCargo ? (
                            <g
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hoveredPosition?.location_id === positionData?.location_id) {
                                  setHoveredPosition(null);
                                } else {
                                  setHoveredPosition(positionData || null);
                                  const rect = (e.currentTarget.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect();
                                  if (rect) {
                                    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                  }
                                }
                              }}
                              style={{ cursor: 'pointer', pointerEvents: 'all' }}
                            >
                              <rect x={boxX} y={palletY - boxHeight - 2} width={boxWidth} height={boxHeight} fill="#60a5fa" rx="3" style={{ pointerEvents: 'all' }}/>
                              <rect x={bayCenterX - 30} y={palletY - boxHeight / 2 - 8} width="60" height="16" fill="white" rx="4" opacity="0.9" style={{ pointerEvents: 'none' }}/>
                              <text x={bayCenterX} y={palletY - boxHeight / 2 + 3} fontSize="8" fill="#3b82f6" textAnchor="middle" fontWeight="500" style={{ pointerEvents: 'none' }}>มีสินค้า</text>
                            </g>
                          ) : (
                            <g>
                              <rect x={boxX} y={palletY - boxHeight - 2} width={boxWidth} height={boxHeight} fill="#e5e7eb" rx="3" strokeDasharray="4 2" stroke="#9ca3af" strokeWidth="1"/>
                              <text x={bayCenterX} y={palletY - boxHeight + 16} fontSize="10" fill="#6b7280" textAnchor="middle">ว่าง</text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Floor */}
              <rect x="20" y="300" width="360" height="8" fill="#cbd5e1" rx="2"/>
              <rect x="20" y="300" width="360" height="2" fill="#e2e8f0" rx="1"/>
            </svg>

            {/* Tooltip for clicked cargo */}
            {hoveredPosition && (
              <div 
                className="absolute bg-gray-800 text-white rounded-md shadow-lg px-3 py-2 text-xs z-50"
                style={{ 
                  left: mousePos.x + 12, 
                  top: mousePos.y - 10,
                  maxWidth: '220px'
                }}
              >
                <div className="font-semibold text-blue-300 mb-1">{hoveredPosition.location_code}</div>
                <div className="space-y-0.5">
                  <div className="truncate" title={hoveredPosition.sku_name}><span className="text-gray-400">สินค้า:</span> {hoveredPosition.sku_name || '-'}</div>
                  <div><span className="text-gray-400">พาเลท:</span> <span className="font-mono">{hoveredPosition.pallet_id || '-'}</span></div>
                  <div><span className="text-gray-400">จำนวน:</span> {hoveredPosition.total_piece_qty?.toLocaleString() || '-'} ชิ้น</div>
                  <div><span className="text-gray-400">ผลิต:</span> {hoveredPosition.mfg_date || '-'}</div>
                  <div><span className="text-gray-400">หมดอายุ:</span> {hoveredPosition.expiry_date || '-'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={() => setShowRack3D(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-4 min-h-screen">
      {/* Header with title and refresh button */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-xl font-bold text-gray-800">Physical Layout - WH001</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              อัพเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}
            </span>
          )}
          <button
            onClick={fetchOccupancy}
            disabled={loadingOccupancy}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className={`w-4 h-4 ${loadingOccupancy ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loadingOccupancy ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
        </div>
      </div>

      {/* Legend - Compact Modern Style */}
      <div className="mb-3">
        {loadingOccupancy ? (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <div className="w-3 h-3 bg-gray-100 border border-gray-400 rounded animate-pulse"></div>
            <span>กำลังโหลดข้อมูล...</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-3 bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">อัตราการใช้พื้นที่:</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 rounded shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}></div>
                <span className="text-xs text-gray-600">0%</span>
              </div>
              <div className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 rounded shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: '#FECACA', border: '1px solid #FCA5A5' }}></div>
                <span className="text-xs text-gray-600">1-20%</span>
              </div>
              <div className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 rounded shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: '#FCA5A5', border: '1px solid #F87171' }}></div>
                <span className="text-xs text-gray-600">21-40%</span>
              </div>
              <div className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 rounded shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: '#F87171', border: '1px solid #EF4444' }}></div>
                <span className="text-xs text-gray-600">41-60%</span>
              </div>
              <div className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 rounded shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: '#EF4444', border: '1px solid #DC2626' }}></div>
                <span className="text-xs text-gray-600">61-80%</span>
              </div>
              <div className="flex items-center gap-1 group">
                <div className="w-3.5 h-3.5 rounded shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: '#B91C1C', border: '1px solid #991B1B' }}></div>
                <span className="text-xs text-gray-600">81-100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border border-gray-300 overflow-auto">
        <svg viewBox="0 0 1250 610" className="w-full" style={{ minWidth: '1150px' }}>
          {/* Background */}
          <rect x="0" y="0" width="1250" height="610" fill="#fafafa" />

          {/* Top row - A01 (29 slots = 58 locks) */}
          <g transform="translate(30, 40)">
            {generateClickableRackCells(0, 930, 29, 'A01', 0)}
            <text x="940" y="13" fill="#333" fontSize="9">A01</text>
          </g>

          {/* Main Storage Racks - 4 double rows with gap in middle */}
          {rackRows.map((row) => (
            <g key={row.id} transform={`translate(30, ${row.y})`}>
              {/* Left section - B aisles */}
              <g>
                <g transform="translate(0, 0)">
                  {generateClickableRackCells(0, 410, 13, row.leftAisles[0], 0)}
                </g>
                <text x="420" y="13" fill="#333" fontSize="8">{row.leftAisles[0]}</text>
                <g transform="translate(0, 20)">
                  {generateClickableRackCells(0, 410, 13, row.leftAisles[1], 0)}
                </g>
                <text x="420" y="33" fill="#333" fontSize="8">{row.leftAisles[1]}</text>
              </g>

              {/* Right section - A aisles */}
              <g transform="translate(470, 0)">
                <g transform="translate(0, 0)">
                  {generateClickableRackCells(0, 410, 13, row.rightAisles[0], 0)}
                </g>
                <text x="420" y="13" fill="#333" fontSize="8">{row.rightAisles[0]}</text>
                <g transform="translate(0, 20)">
                  {generateClickableRackCells(0, 410, 13, row.rightAisles[1], 0)}
                </g>
                <text x="420" y="33" fill="#333" fontSize="8">{row.rightAisles[1]}</text>
              </g>
            </g>
          ))}

          {/* Bottom row - B10 and A10 */}
          <g transform="translate(30, 310)">
            {generateClickableRackCells(0, 410, 13, 'B10', 0)}
            <text x="420" y="13" fill="#333" fontSize="8">B10</text>
            <g transform="translate(470, 0)">
              {generateClickableRackCells(0, 410, 13, 'A10', 0)}
              <text x="420" y="13" fill="#333" fontSize="8">A10</text>
            </g>
          </g>

          {/* AA-BLK Zone - 31 slots แบ่งเป็น 2 ส่วน: 1-16 และ 17-31 มีช่องว่าง 2 ช่องคั่น */}
          <g transform="translate(30, 360)">
            {/* ส่วนซ้าย: AA-BLK-01 ถึง AA-BLK-16 */}
            <text x="0" y="-5" fill="#c62828" fontSize="9">AA-BLK-01</text>
            <rect x="0" y="0" width={16 * 24} height="90" fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" />
            {generateClickableBlockCells(0, 16, 'AA-BLK', 24, 88)}
            <text x={15 * 24 + 12} y="-5" textAnchor="middle" fill="#333" fontSize="9">AA-BLK-16</text>
            
            {/* ส่วนขวา: AA-BLK-17 ถึง AA-BLK-31 (เว้น 2 ช่อง = 48px) */}
            <g transform={`translate(${16 * 24 + 48}, 0)`}>
              <text x="0" y="-5" fill="#c62828" fontSize="9">AA-BLK-17</text>
              <rect x="0" y="0" width={15 * 24} height="90" fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" />
              {generateClickableBlockCells(0, 15, 'AA-BLK-R', 24, 88)}
              <text x={14 * 24 + 12} y="-5" textAnchor="middle" fill="#333" fontSize="9">AA-BLK-31</text>
            </g>
          </g>

          {/* AB-BLK Zone - 30 slots */}
          <g transform="translate(30, 490)">
            <text x="0" y="-5" fill="#c62828" fontSize="9">AB-BLK-01</text>
            <rect x="0" y="0" width="720" height="90" fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" />
            {generateClickableBlockCells(0, 30, 'AB-BLK', 24, 88, true)}
            <text x={29 * 24 + 12} y="-5" textAnchor="middle" fill="#333" fontSize="9">AB-BLK-30</text>
          </g>

          {/* Picking Zone 1 - Clickable */}
          <g style={{ cursor: 'pointer' }} onClick={handlePickingZone1Click}>
            <rect x="830" y="360" width="120" height="90" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} className="hover:fill-blue-300 transition-colors" />
            <text x="890" y="410" textAnchor="middle" fill="#1e40af" fontSize="12" fontWeight="bold" style={{ pointerEvents: 'none' }}>Picking Zone 1</text>
          </g>

          {/* Docks Area */}
          <g transform="translate(1100, 40)">
            {docks.map((dock, index) => (
              <g key={dock} transform={`translate(0, ${index * 50})`}>
                <rect x="80" y="5" width="35" height="30" fill="#333" />
                <text x="97" y="25" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{dock}</text>
                {[...Array(5)].map((_, i) => (
                  <rect key={i} x={0} y={i * 7} width={70} height={5} fill="none" stroke="#ef5350" strokeWidth={1.5} />
                ))}
              </g>
            ))}
          </g>

          {/* Picking Zone 2 */}
          <g transform="translate(1060, 480)">
            <rect x="0" y="0" width="40" height="100" fill="#e3f2fd" stroke="#90caf9" strokeWidth={1} strokeDasharray="3,2" />
            <text x="20" y="50" textAnchor="middle" dominantBaseline="middle" fill="#1976d2" fontSize="9" fontWeight="bold" transform="rotate(-90, 20, 50)">Picking Zone 2</text>
          </g>

          {/* MCF Area */}
          <g transform="translate(1110, 390)">
            <rect x="0" y="0" width="110" height="200" fill="#e3f2fd" stroke="#90caf9" strokeWidth={1} strokeDasharray="3,2" />
            <text x="55" y="105" textAnchor="middle" fill="#1976d2" fontSize="12" fontWeight="bold">MCF</text>
          </g>

          {/* Repack, Online, PQ, MR Areas */}
          <g transform="translate(780, 520)" style={{ cursor: 'pointer' }} onClick={handleRepackClick}>
            <rect x="0" y="0" width="70" height="60" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} className="hover:fill-blue-300 transition-colors" />
            <text x="35" y="35" textAnchor="middle" fill="#1e40af" fontSize="9" fontWeight="bold" style={{ pointerEvents: 'none' }}>Repack</text>
          </g>
          <g transform="translate(858, 520)">
            <rect x="0" y="0" width="75" height="60" fill="#e3f2fd" stroke="#90caf9" strokeWidth={1} strokeDasharray="3,2" />
            <text x="37" y="35" textAnchor="middle" fill="#1976d2" fontSize="8" fontWeight="bold">E-Commerce</text>
          </g>
          <g transform="translate(966, 520)" style={{ cursor: 'pointer' }} onClick={handlePQClick}>
            <rect x="0" y="0" width="45" height="60" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} className="hover:fill-blue-300 transition-colors" />
            <text x="22" y="35" textAnchor="middle" fill="#1e40af" fontSize="10" fontWeight="bold" style={{ pointerEvents: 'none' }}>PQ</text>
          </g>
          <g transform="translate(1019, 520)" style={{ cursor: 'pointer' }} onClick={handleMRClick}>
            <rect x="0" y="0" width="35" height="60" rx="4" fill="#e9d5ff" stroke="#9333ea" strokeWidth={2} className="hover:fill-purple-300 transition-colors" />
            <text x="17" y="35" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="bold" style={{ pointerEvents: 'none' }}>MR</text>
          </g>
        </svg>
      </div>

      <div className="mt-2 text-sm text-gray-500">
        Warehouse Width: 80m × Depth: 60m | Scale: 1:12m
      </div>

      {/* ═══ CAPACITY ANALYTICS DASHBOARD ═══ */}
      <div className="mt-4 space-y-4">
        {/* ── Header ── */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-blue-900 text-base font-bold tracking-wide">Warehouse Capacity Analytics</h2>
            <p className="text-blue-700 text-xs mt-0.5">แนวโน้มการใช้พื้นที่คลังสินค้า — Rack (พาเลท) vs BLK (พาเลท)</p>
          </div>
          {loadingCapacity && <span className="text-blue-600 text-xs animate-pulse">กำลังโหลด...</span>}
        </div>

        {/* ── Chart + Zone Summary side by side ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Main Chart (7 cols) */}
          <div className="col-span-7 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-700">% Utilization — ชั้นวาง (Rack) vs วางพื้น (BLK)</h3>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: '#2563eb' }} />Rack</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: '#0d9488' }} />BLK</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0 border-t border-dashed inline-block" style={{ borderColor: '#f59e0b' }} />80%</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0 border-t border-dashed inline-block" style={{ borderColor: '#ef4444' }} />90%</span>
              </div>
            </div>
            {trendData.length > 0 ? (() => {
              const w = 620, h = 260;
              const pad = { top: 20, bottom: 30, left: 36, right: 14 };
              const cw = w - pad.left - pad.right;
              const ch = h - pad.top - pad.bottom;
              const yMax = 100;
              const step = cw / (trendData.length - 1 || 1);
              const labelInterval = Math.max(1, Math.floor(trendData.length / 8));
              const dotInterval = Math.max(1, Math.floor(trendData.length / 8));
              const toY = (pct: number) => pad.top + ch - (Math.min(Math.max(pct, 0), yMax) / yMax) * ch;
              const rackPts = trendData.map((d, i) => `${pad.left + i * step},${toY(d.rack_pct)}`).join(' ');
              const blkPts = trendData.map((d, i) => `${pad.left + i * step},${toY(d.blk_pct)}`).join(' ');

              return (
                <div className="relative">
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet"
                    onMouseLeave={() => setHoveredTrend(null)}>
                    {[0, 20, 40, 60, 80, 100].map(v => (
                      <g key={`yg-${v}`}>
                        <line x1={pad.left} y1={toY(v)} x2={w - pad.right} y2={toY(v)} stroke="#f3f4f6" strokeWidth="1" />
                        <text x={pad.left - 4} y={toY(v) + 3} textAnchor="end" fontSize="8" fill="#9ca3af">{v}%</text>
                      </g>
                    ))}
                    <line x1={pad.left} y1={toY(80)} x2={w - pad.right} y2={toY(80)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="5,3" opacity="0.7" />
                    <line x1={pad.left} y1={toY(90)} x2={w - pad.right} y2={toY(90)} stroke="#ef4444" strokeWidth="1" strokeDasharray="5,3" opacity="0.7" />
                    <polygon points={`${pad.left},${toY(0)} ${rackPts} ${pad.left + (trendData.length - 1) * step},${toY(0)}`} fill="#2563eb" opacity="0.06" />
                    <polygon points={`${pad.left},${toY(0)} ${blkPts} ${pad.left + (trendData.length - 1) * step},${toY(0)}`} fill="#0d9488" opacity="0.06" />
                    <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={rackPts} strokeLinecap="round" strokeLinejoin="round" />
                    <polyline fill="none" stroke="#0d9488" strokeWidth="2" points={blkPts} strokeLinecap="round" strokeLinejoin="round" />
                    {/* Dots + % labels at intervals (anti-overlap) */}
                    {trendData.map((d, i) => {
                      if (i % dotInterval !== 0 && i !== trendData.length - 1) return null;
                      const x = pad.left + i * step;
                      const rackY = toY(d.rack_pct);
                      const blkY = toY(d.blk_pct);
                      const gap = Math.abs(rackY - blkY);
                      const tooClose = gap < 14;
                      // If too close, push labels apart more to clear the lines
                      let rackLabelY = rackY - 6;
                      let blkLabelY = blkY - 6;
                      if (tooClose) {
                        const mid = (rackY + blkY) / 2;
                        if (d.rack_pct >= d.blk_pct) { rackLabelY = mid - 16; blkLabelY = mid + 12; }
                        else { blkLabelY = mid - 16; rackLabelY = mid + 12; }
                      }
                      return (
                        <g key={`dot-${i}`}>
                          <circle cx={x} cy={rackY} r="3" fill="#2563eb" stroke="white" strokeWidth="1" />
                          <text x={x} y={rackLabelY} textAnchor="middle" fontSize="8.5" fill="#2563eb" fontWeight="bold">{d.rack_pct}%</text>
                          <circle cx={x} cy={blkY} r="3" fill="#0d9488" stroke="white" strokeWidth="1" />
                          <text x={x} y={blkLabelY} textAnchor="middle" fontSize="8.5" fill="#0d9488" fontWeight="bold">{d.blk_pct}%</text>
                        </g>
                      );
                    })}
                    {/* X axis date labels */}
                    {trendData.map((d, i) => {
                      if (i % labelInterval !== 0 && i !== trendData.length - 1) return null;
                      const x = pad.left + i * step;
                      const dt = new Date(d.date);
                      return <text key={`xl-${i}`} x={x} y={h - 6} textAnchor="middle" fontSize="7" fill="#9ca3af">{dt.getDate()}/{dt.getMonth() + 1}</text>;
                    })}
                    {/* Hover zones */}
                    {trendData.map((_, i) => {
                      const x = pad.left + i * step;
                      return (
                        <rect key={`hov-${i}`} x={x - step / 2} y={pad.top} width={step} height={ch}
                          fill="transparent" onMouseEnter={(e) => setHoveredTrend({ idx: i, x: e.clientX, y: e.clientY })} />
                      );
                    })}
                    {hoveredTrend && (() => {
                      const d = trendData[hoveredTrend.idx];
                      if (!d) return null;
                      const x = pad.left + hoveredTrend.idx * step;
                      return (
                        <g>
                          <line x1={x} y1={pad.top} x2={x} y2={pad.top + ch} stroke="#6b7280" strokeWidth="0.5" strokeDasharray="3,2" />
                          <circle cx={x} cy={toY(d.rack_pct)} r="3.5" fill="#2563eb" stroke="white" strokeWidth="1.5" />
                          <circle cx={x} cy={toY(d.blk_pct)} r="3.5" fill="#0d9488" stroke="white" strokeWidth="1.5" />
                        </g>
                      );
                    })()}
                    <text x={12} y={pad.top + ch / 2} textAnchor="middle" fontSize="8" fill="#6b7280" transform={`rotate(-90, 12, ${pad.top + ch / 2})`}>% Utilization</text>
                  </svg>
                  {hoveredTrend && trendData[hoveredTrend.idx] && (() => {
                    const d = trendData[hoveredTrend.idx];
                    const dt = new Date(d.date);
                    const dateStr = `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
                    return (
                      <div className="absolute z-50 bg-[#1B2A4A] text-white rounded-lg shadow-xl px-3 py-2 text-xs pointer-events-none"
                        style={{ left: Math.min(hoveredTrend.idx / trendData.length * 100, 70) + '%', top: 0 }}>
                        <div className="font-bold mb-1 text-blue-200">{dateStr}</div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#2563eb' }} />
                          <span>Rack: <b>{d.rack_pct}%</b> (มีของ {d.rack_occupied.toLocaleString()} / ว่าง {d.rack_empty.toLocaleString()} พาเลท)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#0d9488' }} />
                          <span>BLK: <b>{d.blk_pct}%</b> (มีของ {d.blk_occupied.toLocaleString()} / ว่าง {d.blk_empty.toLocaleString()} พาเลท)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })() : !loadingCapacity && <div className="text-center py-12 text-gray-400 text-sm">ไม่มีข้อมูล</div>}
          </div>

          {/* Zone Summary (5 cols) — split into 2 sections */}
          <div className="col-span-5 space-y-3">
            {/* Section 1: Main Storage (Rack + BLK) */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-blue-50">
                <h3 className="text-[11px] font-bold text-blue-800">พื้นที่จัดเก็บหลัก — Selective Rack + Block Stack</h3>
              </div>
              {(() => {
                const mainZones = zoneSummaries.filter(z => z.section === 'main');
                const mainTotal = mainZones.reduce((s, z) => s + z.totalLocs, 0);
                const mainOcc = mainZones.reduce((s, z) => s + z.occupiedLocs, 0);
                const mainEmpty = mainTotal - mainOcc;
                const mainPct = mainTotal > 0 ? Math.round((mainOcc / mainTotal) * 1000) / 10 : 0;
                return (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-blue-100 border-b border-blue-200 text-blue-900">
                        <th className="px-2 py-1.5 text-left font-semibold">โซน</th>
                        <th className="px-2 py-1.5 text-left font-semibold">ประเภท</th>
                        <th className="px-2 py-1.5 text-center font-semibold">หน่วย</th>
                        <th className="px-2 py-1.5 text-right font-semibold">ทั้งหมด</th>
                        <th className="px-2 py-1.5 text-right font-semibold">มีของ</th>
                        <th className="px-2 py-1.5 text-right font-semibold">ว่าง</th>
                        <th className="px-2 py-1.5 text-right font-semibold">%</th>
                        <th className="px-2 py-1.5 text-center font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mainZones.map((z, i) => (
                        <tr key={z.zone} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-1.5 font-semibold text-gray-800">{z.zone}</td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                              z.section === 'main' && z.zone === 'Selective Rack' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'
                            }`}>{z.storageType}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{z.unit || 'พาเลท'}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-gray-700">{z.totalLocs.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-gray-800 font-semibold">{z.occupiedLocs.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-green-600 font-semibold">{z.emptyLocs.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-10 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${Math.min(z.pct, 100)}%`, backgroundColor: z.pct >= 90 ? '#ef4444' : z.pct >= 80 ? '#f59e0b' : '#2563eb' }} />
                              </div>
                              <span className="font-mono font-semibold w-10 text-right" style={{ color: z.pct >= 90 ? '#ef4444' : z.pct >= 80 ? '#f59e0b' : '#374151' }}>{z.pct}%</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${z.status === 'วิกฤต' ? 'bg-red-100 text-red-700' : z.status === 'ใกล้เต็ม' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{z.status}</span>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 border-t border-blue-200">
                        <td className="px-2 py-1.5 font-bold text-blue-800" colSpan={3}>รวมพื้นที่หลัก</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-800">{mainTotal.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-800">{mainOcc.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-green-600">{mainEmpty.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-800">{mainPct}%</td>
                        <td className="px-2 py-1.5"></td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Section 2: Other Zones (MCF, PQ, MR) */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                <h3 className="text-[11px] font-bold text-gray-700">พื้นที่เสริม — MCF / PQ (เบิกรอส่ง) / MR (แถมรอส่ง)</h3>
              </div>
              {(() => {
                const otherZones = zoneSummaries.filter(z => z.section === 'other');
                return otherZones.length > 0 ? (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-blue-100 border-b border-blue-200 text-blue-900">
                        <th className="px-2 py-1.5 text-left font-semibold">โซน</th>
                        <th className="px-2 py-1.5 text-left font-semibold">สินค้า</th>
                        <th className="px-2 py-1.5 text-center font-semibold">หน่วย</th>
                        <th className="px-2 py-1.5 text-right font-semibold">ทั้งหมด</th>
                        <th className="px-2 py-1.5 text-right font-semibold">มีของ</th>
                        <th className="px-2 py-1.5 text-right font-semibold">ว่าง</th>
                        <th className="px-2 py-1.5 text-right font-semibold">%</th>
                        <th className="px-2 py-1.5 text-center font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherZones.map((z, i) => (
                        <tr key={z.zone} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-1.5 font-semibold text-gray-800">{z.zone}</td>
                          <td className="px-2 py-1.5 text-gray-600 text-[10px]">{z.productType}</td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{z.unit}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-gray-700">{z.totalLocs.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-gray-800 font-semibold">{z.occupiedLocs.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-green-600 font-semibold">{z.emptyLocs.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right">
                            <span className="font-mono font-semibold" style={{ color: z.pct >= 90 ? '#ef4444' : z.pct >= 80 ? '#f59e0b' : '#374151' }}>{z.pct}%</span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${z.status === 'วิกฤต' ? 'bg-red-100 text-red-700' : z.status === 'ใกล้เต็ม' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{z.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Rack Popup */}
      <SelectiveRack3D />
      
      {/* 3D Block Storage Popup */}
      <BlockStorage3D />
      
      {/* Picking Zone 1 Modal */}
      <PickingZone1Modal />
      
      {/* Repack Modal */}
      <RepackModal />
      
      {/* Prep Area (PQ/MR) Modal */}
      <PrepAreaModal />
    </div>
  );
}
