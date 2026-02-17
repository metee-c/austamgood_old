'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import Image from 'next/image';

interface Contract {
  id: number;
  contract_no: string;
  contract_type: 'single' | 'multi';
  supplier_id: string;
  supplier_name: string;
  contract_date: string;
  total_trips: number;
  total_cost: number;
  plan_ids?: string[] | number[];
  plan_codes?: string[];
  plan_id?: number;
  printed_at?: string | null;
}

interface Trip {
  trip_id: number;
  trip_sequence: number;
  daily_trip_number?: number;
  trip_code?: string;
  trip_status: string;
  supplier_id: string;
  total_stops: number;
  total_weight_kg: number;
  total_distance_km?: number;
  shipping_cost?: number;
  base_price?: number;
  helper_fee?: number;
  extra_stop_fee?: number;
  porterage_fee?: number;
  other_fees?: any;
  extra_delivery_stops?: Array<{ name: string; description: string; cost: number }>;
  pricing_mode?: string;
  base_shipping_cost?: number;
  actual_stops_count?: number;
  loading_door_number?: number;
  loading_queue_number?: number;
  notes?: string;
  plan?: {
    plan_id: number;
    plan_code: string;
    plan_name?: string;
    plan_date: string;
    status: string;
  };
  supplier?: {
    supplier_id: string;
    supplier_name: string;
    supplier_code?: string;
  };
  stops?: any[];
}

interface PrintContractModalProps {
  contract: Contract;
  onClose: () => void;
}

// Helper function: ตัดที่อยู่เอาเฉพาะส่วนที่เริ่มจาก "ต." หรือ "ตำบล" เป็นต้นไป
const extractAddressFromTambon = (fullAddress: string | null | undefined): string => {
  if (!fullAddress) return '-';

  const tambonIndex = fullAddress.indexOf('ต.');
  const tambonFullIndex = fullAddress.indexOf('ตำบล');

  let startIndex = -1;
  if (tambonIndex !== -1 && tambonFullIndex !== -1) {
    startIndex = Math.min(tambonIndex, tambonFullIndex);
  } else if (tambonIndex !== -1) {
    startIndex = tambonIndex;
  } else if (tambonFullIndex !== -1) {
    startIndex = tambonFullIndex;
  }

  if (startIndex !== -1) {
    return fullAddress.substring(startIndex).trim();
  }

  return fullAddress.length > 50 ? fullAddress.substring(0, 50) + '...' : fullAddress;
};

// Inject print styles for landscape A4 and proper page breaks
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @media print {
      @page {
        size: A4 landscape;
        margin: 8mm 10mm;
      }

      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto;
      }

      .landscape-page {
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      .contract-page-break {
        page-break-before: always !important;
        break-before: page !important;
      }

      .print-summary-cards {
        display: none !important;
      }

      table {
        width: 100% !important;
        border-collapse: collapse !important;
        border-spacing: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      thead {
        display: table-header-group !important;
      }

      thead.page-header-repeat {
        display: table-header-group !important;
      }

      thead tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      tbody {
        display: table-row-group !important;
      }

      tbody tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      /* Subtotal row should not be separated from its trip */
      tbody tr.bg-blue-50 {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }

      /* Trip header should not be orphaned at bottom of page */
      tbody tr.bg-blue-100 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      /* First data row after trip header should stay with header */
      tbody tr.bg-blue-100 + tr {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }

      tfoot {
        display: table-footer-group !important;
      }

      td, th {
        border: 1px solid #9ca3af !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        padding: 2px 4px !important;
        font-size: 9px !important;
        line-height: 1.3 !important;
      }

      .bg-gray-200,
      .bg-gray-100,
      .bg-blue-100,
      .bg-blue-50,
      .bg-gray-50,
      .bg-green-100,
      .bg-pink-50,
      .bg-pink-100 {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      /* Signatures block should not be split */
      .grid.grid-cols-2 {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 10mm !important;
      }

      /* Grand total summary should not be split */
      .border-t-2.border-gray-400 {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 5mm !important;
        padding-top: 3mm !important;
      }

      /* Footer note should stay with signatures */
      .contract-footer-note {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }

    @media screen {
      .print-summary-cards {
        display: grid;
      }
    }
  `;
  if (!document.querySelector('style[data-contract-print-styles]')) {
    style.setAttribute('data-contract-print-styles', 'true');
    document.head.appendChild(style);
  }
}

export function PrintContractModal({ contract, onClose }: PrintContractModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [enrichedTrips, setEnrichedTrips] = useState<Trip[]>([]);
  const [bonusOrdersMap, setBonusOrdersMap] = useState<Record<number, Record<string, string[]>>>({});
  const [currentUser, setCurrentUser] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const reactToPrintFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบว่าจ้างขนส่ง-${contract.contract_no}`,
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchFullTripDetails();
  }, [contract.id]);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const result = await response.json();
      if (result.user) {
        const fullName = `${result.user.first_name || ''} ${result.user.last_name || ''}`.trim();
        setCurrentUser(fullName || result.user.username || 'ไม่ระบุ');
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setCurrentUser('ไม่ระบุ');
    }
  };

  const fetchFullTripDetails = async () => {
    setLoading(true);
    try {
      // 1. Get trip_ids from junction table
      const contractRes = await fetch(`/api/transport-contracts/${contract.id}?type=${contract.contract_type}`);
      const contractData = await contractRes.json();

      if (!contractData.success || !contractData.data.trips || contractData.data.trips.length === 0) {
        setLoading(false);
        return;
      }

      const tripIds = new Set(contractData.data.trips.map((t: any) => t.trip_id));

      // 2. Get plan_ids from contract data or trips
      let planIds: number[] = [];
      if (contract.contract_type === 'multi' && contract.plan_ids) {
        planIds = (contract.plan_ids as any[]).map(Number);
      } else if (contract.contract_type === 'single' && contract.plan_id) {
        planIds = [contract.plan_id];
      } else {
        // Fallback: extract from trips
        planIds = [...new Set(contractData.data.trips.map((t: any) => t.plan_id))] as number[];
      }

      // 3. Fetch full trip details from editor API for each plan
      const allTrips: Trip[] = [];
      const allBonusOrders: Record<number, Record<string, string[]>> = {};

      for (const planId of planIds) {
        try {
          const [editorRes, bonusRes] = await Promise.all([
            fetch(`/api/route-plans/${planId}/editor`, { cache: 'no-store' }),
            fetch(`/api/route-plans/${planId}/bonus-orders`, { cache: 'no-store' })
          ]);

          const editorData = await editorRes.json();
          const bonusData = await bonusRes.json();

          // Collect bonus orders
          if (bonusData?.data?.bonusOrders) {
            Object.assign(allBonusOrders, bonusData.data.bonusOrders);
          }

          if (editorData?.data?.trips) {
            const plan = editorData.data.plan;

            for (const trip of editorData.data.trips) {
              if (tripIds.has(trip.trip_id) && trip.supplier_id === contract.supplier_id) {
                allTrips.push({
                  ...trip,
                  plan: {
                    plan_id: plan.plan_id,
                    plan_code: plan.plan_code,
                    plan_name: plan.plan_name,
                    plan_date: plan.plan_date,
                    status: plan.status
                  },
                  supplier: trip.supplier || {
                    supplier_id: trip.supplier_id,
                    supplier_name: trip.supplier_name || contract.supplier_name
                  }
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching plan ${planId}:`, err);
        }
      }

      // Sort by plan_date then daily_trip_number
      allTrips.sort((a, b) => {
        const dateA = a.plan?.plan_date || '';
        const dateB = b.plan?.plan_date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.daily_trip_number || a.trip_sequence || 0) - (b.daily_trip_number || b.trip_sequence || 0);
      });

      setEnrichedTrips(allTrips);
      setBonusOrdersMap(allBonusOrders);
    } catch (err) {
      console.error('Error fetching trip details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const tripsToUse = enrichedTrips;
  const totals = tripsToUse.reduce((acc, trip) => {
    acc.trips += 1;
    const stopsCount = trip.stops?.length || trip.total_stops || 0;
    acc.stops += stopsCount;

    if (trip.stops && trip.stops.length > 0) {
      const stopsWeight = trip.stops.reduce((sum: number, stop: any) => {
        if (Array.isArray(stop.orders) && stop.orders.length > 0) {
          return sum + stop.orders.reduce((s: number, o: any) =>
            s + (Number(o.allocated_weight_kg) || Number(o.total_order_weight_kg) || 0), 0);
        }
        return sum + (Number(stop.load_weight_kg) || Number(stop.order_weight) || 0);
      }, 0);
      acc.weight += stopsWeight;
    } else {
      acc.weight += trip.total_weight_kg || 0;
    }

    acc.cost += Number(trip.shipping_cost) || 0;
    acc.porterage += Number(trip.porterage_fee) || 0;
    return acc;
  }, { trips: 0, stops: 0, weight: 0, cost: 0, porterage: 0 });

  // Grand totals for cost breakdown
  const grandTotals = tripsToUse.reduce((acc, trip) => {
    const porterageFee = Number(trip.porterage_fee) || 0;
    const otherFees: Array<{ label: string; amount: number }> = trip.other_fees || [];
    const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
    const extraDeliveryStops: Array<{ name: string; description: string; cost: number }> = trip.extra_delivery_stops || [];
    const extraDeliveryStopsCost = extraDeliveryStops.reduce((sum, stop) => sum + (Number(stop.cost) || 0), 0);
    const shippingCost = Number(trip.shipping_cost) || 0;
    const baseShippingCost = Math.max(0, shippingCost - porterageFee - otherFeesTotal - extraDeliveryStopsCost);

    acc.baseShippingCost += baseShippingCost;
    acc.porterageFee += porterageFee;
    acc.otherFeesTotal += otherFeesTotal;
    acc.extraDeliveryStopsCost += extraDeliveryStopsCost;
    acc.grandTotal += shippingCost;
    return acc;
  }, { baseShippingCost: 0, porterageFee: 0, otherFeesTotal: 0, extraDeliveryStopsCost: 0, grandTotal: 0 });

  const supplierCode = tripsToUse[0]?.supplier?.supplier_code || '';
  const planCodes = contract.plan_codes || [...new Set(tripsToUse.map(t => t.plan?.plan_code).filter(Boolean))];

  // Date range from trips or contract_date
  const planDates = tripsToUse.map(t => t.plan?.plan_date).filter(Boolean).sort();
  const dateRangeText = planDates.length > 0
    ? (planDates[0] === planDates[planDates.length - 1]
      ? new Date(planDates[0]!).toLocaleDateString('en-GB')
      : `${new Date(planDates[0]!).toLocaleDateString('en-GB')} - ${new Date(planDates[planDates.length - 1]!).toLocaleDateString('en-GB')}`)
    : new Date(contract.contract_date).toLocaleDateString('en-GB');

  const contractDate = new Date(contract.contract_date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            ใบว่าจ้างขนส่ง - {contract.contract_no}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mr-3" />
              <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Summary Cards (hidden in print) */}
              <div className="print-summary-cards grid grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{totals.trips}</p>
                  <p className="text-sm text-blue-600">คัน</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{totals.stops}</p>
                  <p className="text-sm text-green-600">จุดส่ง</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-600">{totals.weight.toFixed(0)}</p>
                  <p className="text-sm text-orange-600">กก.</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">{totals.porterage.toLocaleString()}</p>
                  <p className="text-sm text-purple-600">ค่าแบก</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-600">{totals.cost.toLocaleString()}</p>
                  <p className="text-sm text-emerald-600">รวม (บาท)</p>
                </div>
              </div>

              {/* Print Preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
                  <span className="font-medium">ตัวอย่างใบว่าจ้าง ({tripsToUse.length} คัน)</span>
                  <button
                    onClick={() => reactToPrintFn()}
                    disabled={loading || tripsToUse.length === 0}
                    className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <Printer size={20} className="mr-2" />
                    พิมพ์ใบว่าจ้าง
                  </button>
                </div>

                {/* Print Content */}
                <div ref={printRef} className="bg-white">
                  {/* หน้าที่ 1: ฟอร์มบัญชีรวม */}
                  <div className="w-[297mm] min-h-[210mm] p-6 bg-white font-thai landscape-page" style={{ fontSize: '10px' }}>
                    <div className="mb-6">
                      <table className="w-full border-collapse">
                        <thead className="page-header-repeat">
                          {/* Header Info Row */}
                          <tr>
                            <th colSpan={14} className="border-b-2 border-gray-300 px-2 py-3" style={{ position: 'relative' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <Image
                                  src="/images/austam-logo.png"
                                  alt="Austam Logo"
                                  width={40}
                                  height={40}
                                  className="object-contain flex-shrink-0"
                                />
                                <div className="text-xs leading-relaxed text-left">
                                  <p className="font-bold text-sm mb-0.5">AUSTAM GOODS CORP., LTD.</p>
                                  <p className="text-gray-700 font-normal">350, 352 Udomsuk Road, Bangna, Bangnanuea, Bangkok 10260, Thailand.</p>
                                  <p className="text-gray-700 font-normal">E-mail: austamgoods@yahoo.com | Tel. 662-749-4667-72</p>
                                </div>
                              </div>

                              <div className="text-xs leading-relaxed pr-2" style={{ position: 'absolute', top: '12px', right: '0', textAlign: 'right' }}>
                                <p className="text-gray-700 font-normal">เลขที่: {contract.contract_no}</p>
                                <p className="text-gray-700 font-normal">พิมพ์วันที่: {contractDate}</p>
                                <p className="text-gray-700 font-normal">วันที่ส่ง: {dateRangeText}</p>
                                <p className="text-gray-700 font-normal">ผู้ออกเอกสาร: {currentUser}</p>
                              </div>

                              <div className="text-center text-xs leading-relaxed mt-2">
                                <p className="font-bold text-base mb-1">ใบว่าจ้างขนส่ง / TRANSPORT CONTRACT</p>
                                <p className="text-gray-700 font-normal">
                                  ผู้ให้บริการ: {contract.supplier_name} {supplierCode ? `(${supplierCode})` : ''} |
                                  รวม {totals.trips} คัน | แผน: {(planCodes as string[]).join(', ')}
                                </p>
                              </div>
                            </th>
                          </tr>
                          {/* Column Headers */}
                          <tr className="bg-gray-100">
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '4%', fontSize: '9px' }}>คันที่</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '4%', fontSize: '9px' }}>จุดที่</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '5%', fontSize: '9px' }}>จังหวัด</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '6%', fontSize: '9px' }}>ใบสั่งส่ง</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '5%', fontSize: '9px' }}>รหัสลูกค้า</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '14%', fontSize: '9px' }}>ชื่อร้านค้า</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '5%', fontSize: '9px' }}>น้ำหนัก</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '4%', fontSize: '9px' }}>จำนวน</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '4%', fontSize: '9px' }}>ประตู</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '4%', fontSize: '9px' }}>คิว</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '8%', fontSize: '9px' }}>เปิด-ปิด</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '12%', fontSize: '9px' }}>หมายเหตุ</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '14%', fontSize: '9px' }}>ที่อยู่จัดส่ง</th>
                            <th className="border-b border-gray-300 px-1 py-1 text-center" style={{ width: '11%', fontSize: '9px' }}>(ละติจูด, ลองจิจูด)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tripsToUse.map((trip, tripIndex) => {
                            let notes: any = {};
                            try {
                              notes = trip.notes ? JSON.parse(trip.notes) : {};
                            } catch {}
                            const orderRemarks = notes.order_remarks || {};

                            const porterageFee = Number(trip.porterage_fee) || 0;
                            const otherFees: Array<{ label: string; amount: number }> = trip.other_fees || [];
                            const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
                            const extraDeliveryStops: Array<{ name: string; description: string; cost: number }> = trip.extra_delivery_stops || [];
                            const extraDeliveryStopsCost = extraDeliveryStops.reduce((sum, stop) => sum + (Number(stop.cost) || 0), 0);
                            const shippingCost = Number(trip.shipping_cost) || 0;
                            const baseShippingCost = Math.max(0, shippingCost - porterageFee - otherFeesTotal - extraDeliveryStopsCost);

                            const totalStops = trip.stops?.length || 0;
                            const allOrders = trip.stops?.flatMap((stop: any) => stop.orders || []) || [];
                            const uniqueCustomerIds = new Set(allOrders.map((order: any) => order.customer_id).filter(Boolean));
                            const customerCount = uniqueCustomerIds.size || totalStops;

                            const displayTripNumber = trip.daily_trip_number || trip.trip_sequence || tripIndex + 1;

                            const tripBonusOrders = bonusOrdersMap[trip.trip_id] || {};
                            const shownBonusForCustomer = new Set<string>();

                            return (
                              <React.Fragment key={trip.trip_id}>
                                {/* Trip Info Header Row */}
                                <tr className="bg-blue-100 border-t-2 border-blue-400">
                                  <td colSpan={14} className="border border-gray-300 px-2 py-1" style={{ fontSize: '9px' }}>
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="font-bold" style={{ fontSize: '10px' }}>คันที่ {displayTripNumber}</span>
                                        <span className="ml-2 text-gray-700">
                                          ({customerCount} ร้านค้า / {totalStops} จุดส่ง)
                                        </span>
                                        <span className="ml-2 text-gray-500">
                                          แผน: {trip.plan?.plan_code} | วันที่: {trip.plan?.plan_date ? new Date(trip.plan.plan_date).toLocaleDateString('en-GB') : '-'}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <div className="flex justify-end gap-2">
                                          <span>ค่าขนส่ง: <span className="font-semibold">{baseShippingCost.toLocaleString()}</span></span>
                                          {porterageFee > 0 && (
                                            <span className="text-orange-700">ค่าแบก: <span className="font-semibold">{porterageFee.toLocaleString()}</span></span>
                                          )}
                                          {otherFees.map((fee, idx) => (
                                            <span key={idx} className="text-purple-700">{fee.label}: <span className="font-semibold">{Number(fee.amount).toLocaleString()}</span></span>
                                          ))}
                                          {extraDeliveryStops.length > 0 && (
                                            <span className="text-pink-700">จุดส่งพิเศษ: <span className="font-semibold">{extraDeliveryStopsCost.toLocaleString()}</span></span>
                                          )}
                                        </div>
                                        <div className="font-bold text-green-700" style={{ fontSize: '10px' }}>
                                          รวม: {shippingCost.toLocaleString()} บาท
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                {/* Stop rows */}
                                {trip.stops?.map((stop: any, stopIndex: number) => {
                                  let orders: any[] = [];

                                  if (Array.isArray(stop.orders) && stop.orders.length > 0) {
                                    orders = stop.orders.map((o: any) => ({
                                      order_id: o.order_id,
                                      order_no: o.order_no || '-',
                                      customer_id: o.customer_id || '-',
                                      customer_name: o.customer_name || o.shop_name || stop.stop_name || '-',
                                      allocated_weight_kg: Number(o.allocated_weight_kg) || Number(o.total_order_weight_kg) || 0,
                                      total_order_weight_kg: Number(o.total_order_weight_kg) || Number(o.allocated_weight_kg) || 0,
                                      total_qty: o.total_qty || 0,
                                      note: o.note || null,
                                      text_field_long_1: o.text_field_long_1 || null
                                    }));
                                  } else if (stop.order && stop.order.order_id) {
                                    orders = [{
                                      order_id: stop.order.order_id,
                                      order_no: stop.order.order_no || '-',
                                      customer_id: stop.order.customer_id || '-',
                                      customer_name: stop.stop_name || '-',
                                      allocated_weight_kg: Number(stop.load_weight_kg) || Number(stop.order.total_weight) || 0,
                                      total_order_weight_kg: Number(stop.order.total_weight) || 0,
                                      total_qty: stop.load_units || 0,
                                      note: stop.order.notes || null,
                                      text_field_long_1: stop.order.text_field_long_1 || null
                                    }];
                                  } else if (stop.order_data && stop.order_data.order_id) {
                                    orders = [{
                                      order_id: stop.order_data.order_id,
                                      order_no: stop.order_data.order_no || stop.order_no || '-',
                                      customer_id: stop.order_data.customer_id || '-',
                                      customer_name: stop.stop_name || '-',
                                      allocated_weight_kg: Number(stop.load_weight_kg) || Number(stop.order_data.total_weight) || 0,
                                      total_order_weight_kg: Number(stop.order_data.total_weight) || 0,
                                      total_qty: stop.load_units || 0,
                                      note: stop.order_data.notes || null,
                                      text_field_long_1: stop.order_data.text_field_long_1 || null
                                    }];
                                  } else if (stop.order_id || stop.order_no) {
                                    orders = [{
                                      order_id: stop.order_id || 0,
                                      order_no: stop.order_no || '-',
                                      customer_id: stop.customer_id || '-',
                                      customer_name: stop.stop_name || '-',
                                      allocated_weight_kg: Number(stop.load_weight_kg) || Number(stop.order_weight) || 0,
                                      total_order_weight_kg: Number(stop.order_weight) || Number(stop.load_weight_kg) || 0,
                                      total_qty: stop.load_units || 0,
                                      note: null,
                                      text_field_long_1: null
                                    }];
                                  }

                                  if (orders.length === 0) return null;

                                  const address = stop.address || '';
                                  const province = address.split(',').pop()?.trim() || '-';
                                  const coordinates = stop.latitude && stop.longitude
                                    ? `${Number(stop.latitude).toFixed(6)}, ${Number(stop.longitude).toFixed(6)}`
                                    : '-';

                                  return orders.map((order: any, orderIndex: number) => {
                                    const isFirstOrderInStop = orderIndex === 0;
                                    const orderRemark = orderRemarks[order.order_id] || '';
                                    const quantity = order.total_qty || 0;
                                    const weight = order.allocated_weight_kg || order.total_order_weight_kg || 0;

                                    const customerId = order.customer_id || '';
                                    let bonusOrderNos: string[] = [];
                                    if (customerId && !shownBonusForCustomer.has(customerId)) {
                                      bonusOrderNos = tripBonusOrders[customerId] || [];
                                      if (bonusOrderNos.length > 0) {
                                        shownBonusForCustomer.add(customerId);
                                      }
                                    }

                                    const allOrderNos = [order.order_no];
                                    for (const bonusNo of bonusOrderNos) {
                                      if (!allOrderNos.includes(bonusNo)) {
                                        allOrderNos.push(bonusNo);
                                      }
                                    }
                                    const displayOrderNo = allOrderNos.filter(Boolean).join(', ');

                                    return (
                                      <tr key={`${trip.trip_id}-${stop.stop_id}-${order.order_id || orderIndex}`} style={{ fontSize: '9px' }}>
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold bg-gray-50" rowSpan={orders.length}>
                                            {displayTripNumber}
                                          </td>
                                        )}
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 text-center bg-gray-50" rowSpan={orders.length}>
                                            {stopIndex + 1}
                                          </td>
                                        )}
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 bg-gray-50" rowSpan={orders.length}>
                                            {province}
                                          </td>
                                        )}
                                        <td className="border border-gray-300 px-1 py-0.5">{displayOrderNo || '-'}</td>
                                        <td className="border border-gray-300 px-1 py-0.5">{order.customer_id || '-'}</td>
                                        <td className="border border-gray-300 px-1 py-0.5">{order.customer_name || stop.stop_name || '-'}</td>
                                        <td className="border border-gray-300 px-1 py-0.5 text-right">{weight.toFixed(1)}</td>
                                        <td className="border border-gray-300 px-1 py-0.5 text-right">{quantity}</td>
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 bg-gray-50 text-center" rowSpan={orders.length}>
                                            {trip.loading_door_number || '-'}
                                          </td>
                                        )}
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 bg-gray-50 text-center" rowSpan={orders.length}>
                                            {trip.loading_queue_number || '-'}
                                          </td>
                                        )}
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 bg-gray-50" rowSpan={orders.length} style={{ fontSize: '8px' }}>
                                            {order.note || '-'}
                                          </td>
                                        )}
                                        <td className="border border-gray-300 px-1 py-0.5">{orderRemark}</td>
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 bg-gray-50" rowSpan={orders.length} style={{ fontSize: '8px' }}>
                                            {extractAddressFromTambon(order.text_field_long_1)}
                                          </td>
                                        )}
                                        {isFirstOrderInStop && (
                                          <td className="border border-gray-300 px-1 py-0.5 bg-gray-50 font-mono" rowSpan={orders.length} style={{ fontSize: '8px' }}>
                                            {coordinates}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  });
                                })}
                                {/* Extra Delivery Stops */}
                                {extraDeliveryStops.length > 0 && extraDeliveryStops.map((extraStop: any, extraIndex: number) => (
                                  <tr key={`extra-${trip.trip_id}-${extraIndex}`} className="bg-pink-50" style={{ fontSize: '9px' }}>
                                    <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold bg-pink-100">{displayTripNumber}</td>
                                    <td className="border border-gray-300 px-1 py-0.5 text-center bg-pink-100">พิเศษ</td>
                                    <td className="border border-gray-300 px-1 py-0.5 bg-pink-100">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 text-pink-700 font-semibold">จุดส่งพิเศษ</td>
                                    <td className="border border-gray-300 px-1 py-0.5">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 font-thai text-pink-700">{extraStop.name || '-'}</td>
                                    <td className="border border-gray-300 px-1 py-0.5 text-right">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 text-right">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 bg-pink-100 text-center">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 bg-pink-100 text-center">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 bg-pink-100">-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 text-pink-700">
                                      {extraStop.description || '-'} {extraStop.cost > 0 ? `(${extraStop.cost.toLocaleString()} บาท)` : ''}
                                    </td>
                                    <td className="border border-gray-300 px-1 py-0.5 bg-pink-100" style={{ fontSize: '8px' }}>-</td>
                                    <td className="border border-gray-300 px-1 py-0.5 bg-pink-100 font-mono" style={{ fontSize: '8px' }}>-</td>
                                  </tr>
                                ))}
                                {/* Subtotal row */}
                                {(() => {
                                  const calculatedTotalWeight = trip.stops?.reduce((sum: number, stop: any) => {
                                    if (Array.isArray(stop.orders) && stop.orders.length > 0) {
                                      return sum + stop.orders.reduce((s: number, o: any) =>
                                        s + (Number(o.allocated_weight_kg) || Number(o.total_order_weight_kg) || 0), 0);
                                    }
                                    return sum + (Number(stop.load_weight_kg) || Number(stop.order_weight) || 0);
                                  }, 0) || 0;

                                  const calculatedTotalQty = trip.stops?.reduce((sum: number, stop: any) => {
                                    if (Array.isArray(stop.orders) && stop.orders.length > 0) {
                                      return sum + stop.orders.reduce((s: number, o: any) => s + (o.total_qty || 0), 0);
                                    }
                                    return sum + (stop.load_units || 0);
                                  }, 0) || 0;

                                  return (
                                    <tr className="bg-blue-50 font-semibold" style={{ fontSize: '9px' }}>
                                      <td colSpan={6} className="border border-gray-300 px-1 py-1 text-right">
                                        รวมคันที่ {displayTripNumber}:
                                      </td>
                                      <td className="border border-gray-300 px-1 py-1 text-right">{calculatedTotalWeight.toFixed(1)}</td>
                                      <td className="border border-gray-300 px-1 py-1 text-right">{calculatedTotalQty}</td>
                                      <td colSpan={4} className="border border-gray-300 px-1 py-1 text-right text-green-700">
                                        ค่าขนส่ง: {shippingCost.toLocaleString()} บาท
                                      </td>
                                      <td colSpan={2} className="border border-gray-300 px-1 py-1"></td>
                                    </tr>
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })}
                          {/* Grand Total Row */}
                          <tr className="bg-green-100 font-bold border-t-2 border-green-500" style={{ fontSize: '10px' }}>
                            <td colSpan={6} className="border border-gray-300 px-1 py-1.5 text-right">
                              รวมทั้งหมด ({totals.trips} คัน):
                            </td>
                            <td className="border border-gray-300 px-1 py-1.5 text-right">{totals.weight.toFixed(1)}</td>
                            <td className="border border-gray-300 px-1 py-1.5 text-right">{totals.stops}</td>
                            <td colSpan={4} className="border border-gray-300 px-1 py-1.5 text-right text-green-700">
                              รวมค่าขนส่ง: {grandTotals.grandTotal.toLocaleString()} บาท
                            </td>
                            <td colSpan={2} className="border border-gray-300 px-1 py-1.5"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total Summary */}
                    <div className="border-t-2 border-gray-400 mt-6 pt-4">
                      <div className="space-y-1 max-w-md">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">ค่าขนส่งพื้นฐาน ({totals.trips} คัน):</span>
                          <span className="text-sm font-semibold text-right min-w-[100px]">{grandTotals.baseShippingCost.toLocaleString()} บาท</span>
                        </div>
                        {grandTotals.porterageFee > 0 && (
                          <div className="flex justify-between items-center text-orange-700">
                            <span className="text-sm">ค่าแบกน้ำหนักรวม:</span>
                            <span className="text-sm font-semibold text-right min-w-[100px]">{grandTotals.porterageFee.toLocaleString()} บาท</span>
                          </div>
                        )}
                        {grandTotals.otherFeesTotal > 0 && (
                          <div className="flex justify-between items-center text-purple-700">
                            <span className="text-sm">ค่าใช้จ่ายอื่นๆ รวม:</span>
                            <span className="text-sm font-semibold text-right min-w-[100px]">{grandTotals.otherFeesTotal.toLocaleString()} บาท</span>
                          </div>
                        )}
                        {grandTotals.extraDeliveryStopsCost > 0 && (
                          <div className="flex justify-between items-center text-pink-700">
                            <span className="text-sm">ค่าจุดส่งพิเศษรวม:</span>
                            <span className="text-sm font-semibold text-right min-w-[100px]">{grandTotals.extraDeliveryStopsCost.toLocaleString()} บาท</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2">
                          <span className="text-base font-bold">รวมทั้งสิ้น:</span>
                          <span className="text-lg font-bold text-green-700 text-right min-w-[100px]">{grandTotals.grandTotal.toLocaleString()} บาท</span>
                        </div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 mt-12">
                      <div className="text-center">
                        <div className="pt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/images/signature-austam.png"
                            alt="ลายเซ็นผู้ว่าจ้าง"
                            width={150}
                            height={60}
                            className="mx-auto mb-2"
                            style={{ objectFit: 'contain' }}
                          />
                          <div className="border-t border-gray-400 pt-2">
                            <p className="text-sm">ผู้ว่าจ้าง (AUSTAM GOODS CORP., LTD.)</p>
                            <p className="text-xs text-gray-600 mt-1">วันที่: {dateRangeText}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-gray-400 pt-2 mt-16">
                          <p className="text-sm">ผู้รับจ้าง ({contract.supplier_name})</p>
                          <p className="text-xs text-gray-600 mt-1">วันที่: _______________</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Note */}
                    <div className="mt-8 text-xs text-gray-600 border-t pt-4 contract-footer-note">
                      <p>หมายเหตุ: เอกสารนี้สร้างโดยระบบอัตโนมัติ กรุณาตรวจสอบความถูกต้องก่อนลงนาม</p>
                    </div>
                  </div>

                  {/* หน้าที่ 2: รายละเอียดค่าขนส่ง */}
                  <div className="w-[297mm] min-h-[210mm] p-6 bg-white font-thai landscape-page contract-page-break" style={{ fontSize: '12px' }}>
                    <div className="mb-6">
                      <div className="text-center mb-4">
                        <p className="font-bold text-lg mb-1">รายละเอียดค่าขนส่ง - {totals.trips} คัน</p>
                        <p className="text-sm text-gray-700">ผู้ให้บริการ: {contract.supplier_name} {supplierCode ? `(${supplierCode})` : ''}</p>
                        <p className="text-sm text-gray-500">วันที่ส่ง: {dateRangeText} | แผน: {(planCodes as string[]).join(', ')}</p>
                      </div>
                    </div>

                    <div>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '5%' }}>คันที่</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>แผน</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>วันที่</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>จำนวนจุดส่ง</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>ทะเบียนรถ</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>ชื่อผู้ขับ</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '5%' }}>ประตู</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '5%' }}>คิว</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '7%' }}>รูปแบบ</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>ราคาเริ่มต้น</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>ค่าเด็กติดรถ</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>ค่าจุดเพิ่ม</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '7%' }}>ค่าแบก</th>
                            <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '10%' }}>รวมค่าขนส่ง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tripsToUse.map((trip, tripIndex) => {
                            let notes: any = {};
                            try {
                              notes = trip.notes ? JSON.parse(trip.notes) : {};
                            } catch {}

                            const porterageFee = Number(trip.porterage_fee) || 0;
                            const shippingCost = Number(trip.shipping_cost) || 0;
                            const pricingMode = trip.pricing_mode;
                            const basePrice = Number(trip.base_price) || 0;
                            const helperFee = Number(trip.helper_fee) || 0;
                            const extraStopFee = Number(trip.extra_stop_fee) || 0;
                            const baseShippingCostFlat = Number(trip.base_shipping_cost) || 0;

                            const totalStops = trip.stops?.length || 0;
                            const allOrders = trip.stops?.flatMap((stop: any) => stop.orders || []) || [];
                            const uniqueCustomerIds = new Set(allOrders.map((order: any) => order.customer_id).filter(Boolean));
                            const customerCount = uniqueCustomerIds.size || totalStops;

                            const actualStopsCount = trip.actual_stops_count;
                            const totalStopsForCalc = actualStopsCount !== null && actualStopsCount !== undefined && actualStopsCount > 0
                              ? actualStopsCount
                              : customerCount;
                            const extraStops = Math.max(0, totalStopsForCalc - 1);
                            const extraStopTotal = extraStops * extraStopFee;

                            const displayTripNumber = trip.daily_trip_number || trip.trip_sequence || tripIndex + 1;

                            return (
                              <tr key={trip.trip_id} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-2 py-3 text-center font-semibold text-sm">{displayTripNumber}</td>
                                <td className="border border-gray-300 px-2 py-3 text-xs">{trip.plan?.plan_code || '-'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-xs">{trip.plan?.plan_date ? new Date(trip.plan.plan_date).toLocaleDateString('en-GB') : '-'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-center text-xs">{customerCount} ลูกค้า / {totalStops} จุด</td>
                                <td className="border border-gray-300 px-2 py-3 text-xs">{notes.vehicle_label || '-'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-xs">{notes.driver_label || '-'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-center text-xs">{trip.loading_door_number || '-'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-center text-xs">{trip.loading_queue_number || '-'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-center text-xs font-semibold">{pricingMode === 'formula' ? 'คำนวณ' : 'เหมา'}</td>
                                <td className="border border-gray-300 px-2 py-3 text-right text-xs">
                                  {pricingMode === 'formula' ? `${basePrice.toLocaleString()}` : (baseShippingCostFlat > 0 ? `${baseShippingCostFlat.toLocaleString()}` : '-')}
                                </td>
                                <td className="border border-gray-300 px-2 py-3 text-right text-xs">
                                  {pricingMode === 'formula' ? `${helperFee.toLocaleString()}` : '-'}
                                </td>
                                <td className="border border-gray-300 px-2 py-3 text-xs">
                                  {pricingMode === 'formula' ? (
                                    <div className="text-right">{extraStops} × {extraStopFee.toLocaleString()} = {extraStopTotal.toLocaleString()}</div>
                                  ) : '-'}
                                </td>
                                <td className="border border-gray-300 px-2 py-3 text-right text-xs">
                                  {porterageFee > 0 ? `${porterageFee.toLocaleString()}` : '-'}
                                </td>
                                <td className="border border-gray-300 px-2 py-3 text-right text-xs font-bold text-green-700">
                                  {shippingCost.toLocaleString()} บาท
                                </td>
                              </tr>
                            );
                          })}
                          {/* Grand Total Row */}
                          <tr className="bg-green-100 font-bold">
                            <td colSpan={12} className="border border-gray-300 px-2 py-3 text-sm text-right">
                              รวมทั้งหมด ({totals.trips} คัน):
                            </td>
                            <td className="border border-gray-300 px-2 py-3 text-right text-sm text-orange-700">
                              {grandTotals.porterageFee > 0 ? grandTotals.porterageFee.toLocaleString() : '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-3 text-right text-sm text-green-700">
                              {grandTotals.grandTotal.toLocaleString()} บาท
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Summary */}
                    <div className="border-t-2 border-gray-400 mt-6 pt-4">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">ค่าขนส่งพื้นฐาน ({totals.trips} คัน):</span>
                          <span className="text-sm font-semibold">{grandTotals.baseShippingCost.toLocaleString()} บาท</span>
                        </div>
                        {grandTotals.porterageFee > 0 && (
                          <div className="flex justify-between items-center text-orange-700">
                            <span className="text-sm">ค่าแบกน้ำหนักรวม:</span>
                            <span className="text-sm font-semibold">{grandTotals.porterageFee.toLocaleString()} บาท</span>
                          </div>
                        )}
                        {grandTotals.otherFeesTotal > 0 && (
                          <div className="flex justify-between items-center text-purple-700">
                            <span className="text-sm">ค่าใช้จ่ายอื่นๆ รวม:</span>
                            <span className="text-sm font-semibold">{grandTotals.otherFeesTotal.toLocaleString()} บาท</span>
                          </div>
                        )}
                        {grandTotals.extraDeliveryStopsCost > 0 && (
                          <div className="flex justify-between items-center text-pink-700">
                            <span className="text-sm">ค่าจุดส่งพิเศษรวม:</span>
                            <span className="text-sm font-semibold">{grandTotals.extraDeliveryStopsCost.toLocaleString()} บาท</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2">
                          <span className="text-base font-bold">รวมทั้งหมด:</span>
                          <span className="text-lg font-bold text-green-700">{grandTotals.grandTotal.toLocaleString()} บาท</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
