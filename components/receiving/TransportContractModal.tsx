'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, ChevronRight } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

interface Plan {
  plan_id: number;
  plan_code: string;
  plan_name: string;
  plan_date: string;
  status?: string;
  warehouse_id: string;
  warehouse?: {
    warehouse_name: string;
  };
  trips?: Trip[];
}

interface Trip {
  trip_id: number;
  trip_sequence: number;
  daily_trip_number?: number; // เลขคันที่ไม่ซ้ำกันทั้งวัน
  supplier_id?: string;
  supplier_name?: string;
  shipping_cost?: number;
  porterage_fee?: number;
  other_fees?: Array<{ label: string; amount: number }>;
  extra_delivery_stops?: Array<{ name: string; description: string; cost: number }>; // จุดส่งพิเศษ
  vehicle_label?: string;
  driver_label?: string;
  total_distance_km?: number;
  total_weight_kg?: number;
  notes?: string;
  stops?: any[];
}

interface SupplierSummary {
  supplier_id: string;
  supplier_name: string;
  supplier_code?: string;
  trip_count: number;
  total_trips: number;
  total_cost: number;
  total_shipping_cost: number;
  total_porterage_fee: number;
  total_other_fees: number;
  total_extra_delivery_stops_cost: number; // รวมค่าจุดส่งพิเศษ
  trips: Trip[];
}

interface TransportContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId?: number | null;
}

// Helper function: ตัดที่อยู่เอาเฉพาะส่วนที่เริ่มจาก "ต." หรือ "ตำบล" เป็นต้นไป
const extractAddressFromTambon = (fullAddress: string | null | undefined): string => {
  if (!fullAddress) return '-';
  
  // หา index ของ "ต." หรือ "ตำบล"
  const tambonIndex = fullAddress.indexOf('ต.');
  const tambonFullIndex = fullAddress.indexOf('ตำบล');
  
  // เลือก index ที่พบก่อน (ค่าน้อยกว่าและไม่ใช่ -1)
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
  
  // ถ้าไม่พบ ต. หรือ ตำบล ให้ return ที่อยู่เต็ม (ตัดให้สั้นลง)
  return fullAddress.length > 50 ? fullAddress.substring(0, 50) + '...' : fullAddress;
};

const TransportContractModal: React.FC<TransportContractModalProps> = ({ isOpen, onClose, planId }) => {
  const [step, setStep] = useState<'select-plan' | 'select-supplier'>('select-plan');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierSummaries, setSupplierSummaries] = useState<SupplierSummary[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  // State สำหรับเก็บ bonus orders (แมพ trip_id -> customer_id -> [order_no])
  const [bonusOrdersMap, setBonusOrdersMap] = useState<Record<number, Record<string, string[]>>>({});
  // State สำหรับเก็บเลขเอกสารใบว่าจ้าง
  const [contractNo, setContractNo] = useState<string>('');

  const printRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบว่าจ้างขนส่ง-${selectedSupplier?.supplier_name}-${contractNo || selectedPlan?.plan_code}`,
  });

  // ฟังก์ชันพิมพ์และเปลี่ยนสถานะ
  const handlePrint = async () => {
    try {
      // พิมพ์ก่อน
      reactToPrintFn();

      // รอให้พิมพ์เสร็จ (ใช้ setTimeout เล็กน้อย)
      setTimeout(async () => {
        if (selectedPlan) {
          try {
            // ดึงข้อมูล plan ปัจจุบันเพื่อเช็คสถานะ
            const supabase = createClient();
            const { data: currentPlan } = await supabase
              .from('receiving_route_plans')
              .select('status')
              .eq('plan_id', selectedPlan.plan_id)
              .single();

            // ถ้าสถานะเป็น optimizing ต้องเปลี่ยนเป็น published ก่อน
            if (currentPlan?.status === 'optimizing') {
              const publishResponse = await fetch(`/api/route-plans/${selectedPlan.plan_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'published' })
              });

              if (!publishResponse.ok) {
                const result = await publishResponse.json();
                alert(`ไม่สามารถเปลี่ยนสถานะเป็น published ได้: ${result.error}`);
                return;
              }
            }

            // เปลี่ยนสถานะเป็น pending_approval
            const response = await fetch(`/api/route-plans/${selectedPlan.plan_id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'pending_approval',
                printed_at: new Date().toISOString()
              })
            });

            if (response.ok) {
              alert('✅ พิมพ์ใบว่าจ้างสำเร็จ\nสถานะเปลี่ยนเป็น "รออนุมัติ" แล้ว');
              onClose(); // ปิด modal
            } else {
              const result = await response.json();
              alert(`ไม่สามารถเปลี่ยนสถานะได้: ${result.error}`);
            }
          } catch (err) {
            console.error('Error updating plan status:', err);
            alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
          }
        }
      }, 500);
    } catch (err) {
      console.error('Error in handlePrint:', err);
    }
  };

  useEffect(() => {
    if (isOpen && planId) {
      // ถ้ามี planId ให้โหลดแผนนั้นโดยตรง
      loadPlanDirectly(planId);
      fetchSuppliers();
      fetchCurrentUser();
    } else if (isOpen && step === 'select-plan') {
      fetchPublishedPlans();
      fetchSuppliers();
      fetchCurrentUser();
    }
  }, [isOpen, planId]);

  // โหลดแผนโดยตรงจาก planId
  const loadPlanDirectly = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      // ดึงข้อมูลแผนและ bonus orders พร้อมกัน
      const [editorRes, bonusRes] = await Promise.all([
        fetch(`/api/route-plans/${id}/editor`),
        fetch(`/api/route-plans/${id}/bonus-orders`)
      ]);
      
      const { data } = await editorRes.json();
      const { data: bonusData } = await bonusRes.json();
      
      // เก็บ bonus orders map
      if (bonusData?.bonusOrders) {
        setBonusOrdersMap(bonusData.bonusOrders);
      }
      
      if (data?.trips) {
        // สร้าง plan object จากข้อมูลที่ได้
        const plan: Plan = {
          plan_id: id,
          plan_code: data.plan?.plan_code || '',
          plan_name: data.plan?.plan_name || '',
          plan_date: data.plan?.plan_date || '',
          status: data.plan?.status || '',
          warehouse_id: data.plan?.warehouse_id || '',
          trips: data.trips
        };
        
        setSelectedPlan(plan);
        
        // Group trips by supplier
        const supplierMap = new Map<string, SupplierSummary>();
        
        for (const trip of data.trips) {
          const supplierId = trip.supplier_id || 'unknown';
          const supplierName = trip.supplier_name || 'ไม่ระบุผู้ให้บริการ';
          
          if (!supplierMap.has(supplierId)) {
            supplierMap.set(supplierId, {
              supplier_id: supplierId,
              supplier_name: supplierName,
              trips: [],
              trip_count: 0,
              total_trips: 0,
              total_shipping_cost: 0,
              total_porterage_fee: 0,
              total_other_fees: 0,
              total_extra_delivery_stops_cost: 0,
              total_cost: 0
            });
          }
          
          const summary = supplierMap.get(supplierId)!;
          summary.trips.push(trip);
          summary.trip_count++;
          summary.total_trips++;
          
          // ดึงค่าใช้จ่ายเพิ่มเติม
          const porterageFee = Number(trip.porterage_fee) || 0;
          let otherFeesTotal = 0;
          let extraStopsCost = 0;
          
          if (trip.other_fees && Array.isArray(trip.other_fees)) {
            otherFeesTotal = trip.other_fees.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0);
          }
          
          if (trip.extra_delivery_stops && Array.isArray(trip.extra_delivery_stops)) {
            extraStopsCost = trip.extra_delivery_stops.reduce((sum: number, stop: any) => sum + (Number(stop.cost) || 0), 0);
          }
          
          // เก็บค่าแยกรายการเพื่อแสดงใน UI
          summary.total_porterage_fee += porterageFee;
          summary.total_other_fees += otherFeesTotal;
          summary.total_extra_delivery_stops_cost += extraStopsCost;
          
          // ⚠️ IMPORTANT: shipping_cost ใน database รวมค่าเพิ่มเติมทั้งหมดแล้ว
          // ดังนั้น total_cost = shipping_cost โดยตรง ไม่ต้องบวกเพิ่ม
          summary.total_cost += Number(trip.shipping_cost) || 0;
          
          // คำนวณ total_shipping_cost = shipping_cost - ค่าเพิ่มเติมทั้งหมด (เพื่อแสดงค่าขนส่งพื้นฐานแยก)
          const baseShippingCost = (Number(trip.shipping_cost) || 0) - porterageFee - otherFeesTotal - extraStopsCost;
          summary.total_shipping_cost += Math.max(0, baseShippingCost);
        }
        
        setSupplierSummaries(Array.from(supplierMap.values()));
        setStep('select-supplier');
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลแผน');
      console.error('Error loading plan:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select-plan');
      setSelectedPlan(null);
      setSelectedSupplier(null);
      setSupplierSummaries([]);
      setError(null);
    }
  }, [isOpen]);

  const fetchCurrentUser = async () => {
    try {
      // ใช้ API /api/auth/me เพื่อดึงข้อมูล user จาก custom session
      const response = await fetch('/api/auth/me');
      const result = await response.json();
      
      console.log('🔍 [TransportContract] Fetching current user from API:', result);
      
      if (result.user) {
        const user = result.user;
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        const displayName = fullName || user.username || user.email || 'ไม่ระบุ';
        console.log('✅ [TransportContract] Setting user name:', displayName);
        setCurrentUser(displayName);
      } else {
        console.log('❌ [TransportContract] No user found in API response');
        setCurrentUser('ไม่ระบุ');
      }
    } catch (err) {
      console.error('❌ [TransportContract] Error fetching user:', err);
      setCurrentUser('ไม่ระบุ');
    }
  };

  const fetchPublishedPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      // เปลี่ยนจาก /published เป็น /api/route-plans เพื่อดึงทุกสถานะ
      const res = await fetch('/api/route-plans');
      const { data, error } = await res.json();
      if (error) {
        setError(error);
      } else {
        setPlans(data || []);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      const { data } = await res.json();
      if (data) {
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    setSelectedPlan(plan);
    
    // Fetch full trip details และ bonus orders พร้อมกัน
    try {
      const [editorRes, bonusRes] = await Promise.all([
        fetch(`/api/route-plans/${plan.plan_id}/editor`),
        fetch(`/api/route-plans/${plan.plan_id}/bonus-orders`)
      ]);
      
      const { data } = await editorRes.json();
      const { data: bonusData } = await bonusRes.json();
      
      // เก็บ bonus orders map
      if (bonusData?.bonusOrders) {
        setBonusOrdersMap(bonusData.bonusOrders);
      }
      
      if (data?.trips) {
        // Group trips by supplier
        const grouped = data.trips.reduce((acc: Record<string, any>, trip: Trip) => {
          if (!trip.supplier_id) return acc;
          
          if (!acc[trip.supplier_id]) {
            // ใช้ supplier_name จาก trip โดยตรง (จาก API) ก่อน ถ้าไม่มีค่อยหาจาก suppliers list
            const supplierNameFromTrip = trip.supplier_name;
            const supplier = suppliers.find(s => s.supplier_id === trip.supplier_id);
            acc[trip.supplier_id] = {
              supplier_id: trip.supplier_id,
              supplier_name: supplierNameFromTrip || supplier?.supplier_name || 'ไม่ระบุ',
              supplier_code: supplier?.supplier_code || '',
              trip_count: 0,
              total_cost: 0,
              total_shipping_cost: 0,
              total_porterage_fee: 0,
              total_other_fees: 0,
              total_extra_delivery_stops_cost: 0,
              trips: []
            };
          }
          
          // Calculate other fees total for this trip
          // ✅ FIX: แปลงเป็น number เพราะ database อาจส่งมาเป็น string
          const otherFees: Array<{ label: string; amount: number }> = (trip as any).other_fees || [];
          const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
          const porterageFee = Number((trip as any).porterage_fee) || 0;
          
          // Calculate extra delivery stops cost
          const extraDeliveryStops: Array<{ name: string; description: string; cost: number }> = (trip as any).extra_delivery_stops || [];
          const extraDeliveryStopsCost = extraDeliveryStops.reduce((sum, stop) => sum + (Number(stop.cost) || 0), 0);
          
          acc[trip.supplier_id].trip_count++;
          
          // ⚠️ IMPORTANT: shipping_cost ใน database รวมค่าเพิ่มเติมทั้งหมดแล้ว (porterage_fee, other_fees, extra_delivery_stops)
          // ดังนั้น total_cost = shipping_cost โดยตรง ไม่ต้องบวกเพิ่ม
          // ค่าแยกรายการ (total_porterage_fee, total_other_fees, etc.) เก็บไว้เพื่อแสดงใน UI เท่านั้น
          acc[trip.supplier_id].total_cost += Number(trip.shipping_cost) || 0;
          
          // เก็บค่าแยกรายการเพื่อแสดงใน UI (ไม่ใช้ในการคำนวณ total_cost)
          acc[trip.supplier_id].total_porterage_fee += porterageFee;
          acc[trip.supplier_id].total_other_fees += otherFeesTotal;
          acc[trip.supplier_id].total_extra_delivery_stops_cost += extraDeliveryStopsCost;
          
          // คำนวณ total_shipping_cost = shipping_cost - ค่าเพิ่มเติมทั้งหมด (เพื่อแสดงค่าขนส่งพื้นฐานแยก)
          const baseShippingCost = (Number(trip.shipping_cost) || 0) - porterageFee - otherFeesTotal - extraDeliveryStopsCost;
          acc[trip.supplier_id].total_shipping_cost += Math.max(0, baseShippingCost);
          
          acc[trip.supplier_id].trips.push(trip);
          
          return acc;
        }, {});
        
        setSupplierSummaries(Object.values(grouped));
        setStep('select-supplier');
      }
    } catch (err) {
      console.error('Error fetching trip details:', err);
      setError('ไม่สามารถโหลดรายละเอียดเที่ยวได้');
    }
  };

  const handleSelectSupplier = async (summary: SupplierSummary) => {
    setSelectedSupplier(summary);
    
    // Get or create transport contract number
    if (selectedPlan) {
      try {
        // total_cost รวมค่าเพิ่มเติมแล้ว (shipping_cost + porterage_fee + other_fees + extra_delivery_stops)
        const grandTotal = summary.total_cost;
        
        const response = await fetch('/api/transport-contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: selectedPlan.plan_id,
            supplier_id: summary.supplier_id,
            supplier_name: summary.supplier_name,
            total_trips: summary.trip_count,
            total_cost: grandTotal,
            printed_by: currentUser
          })
        });
        
        const result = await response.json();
        if (result.data?.contract_no) {
          setContractNo(result.data.contract_no);
        }
      } catch (err) {
        console.error('Error getting transport contract:', err);
      }
    }
  };



  const handleBack = () => {
    if (step === 'select-supplier') {
      setStep('select-plan');
      setSelectedPlan(null);
      setSupplierSummaries([]);
      setSelectedSupplier(null);
      setContractNo('');
    }
  };

  const handleClose = () => {
    setStep('select-plan');
    setSelectedPlan(null);
    setSupplierSummaries([]);
    setSelectedSupplier(null);
    setContractNo('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold font-thai text-gray-900">
            {step === 'select-plan' ? 'เลือกแผนเส้นทางเพื่อพิมพ์ใบว่าจ้าง' : 'เลือกบริษัทขนส่ง'}
          </h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'select-plan' && (
            <div>
              {loading && <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>}
              {error && <div className="text-center py-8 text-red-500">{error}</div>}
              {!loading && !error && plans.length === 0 && (
                <div className="text-center py-8 text-gray-500">ไม่พบแผนเส้นทาง</div>
              )}
              {!loading && !error && plans.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-b">รหัสแผน</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-b">ชื่อแผน</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-b">วันที่</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-b">คลัง</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase border-b">เลือก</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {plans.map((plan) => (
                        <tr key={plan.plan_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-blue-600 font-mono">{plan.plan_code}</td>
                          <td className="px-4 py-3 font-thai">{plan.plan_name || '-'}</td>
                          <td className="px-4 py-3">{new Date(plan.plan_date).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 font-thai">{plan.warehouse?.warehouse_name || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleSelectPlan(plan)}
                              className="inline-flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                              เลือก <ChevronRight size={16} className="ml-1" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 'select-supplier' && (
            <div>
              <div className="mb-4">
                <button
                  onClick={handleBack}
                  className="text-blue-600 hover:text-blue-700 text-sm font-thai"
                >
                  ← กลับไปเลือกแผนอื่น
                </button>
              </div>

              {supplierSummaries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  ไม่พบข้อมูลบริษัทขนส่งในแผนนี้
                </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {supplierSummaries.map((summary) => {
                    const hasExtraFees = summary.total_porterage_fee > 0 || summary.total_other_fees > 0 || summary.total_extra_delivery_stops_cost > 0;
                    // total_cost รวมค่าเพิ่มเติมแล้ว (shipping_cost + porterage_fee + other_fees + extra_delivery_stops)
                    const grandTotal = summary.total_cost;
                    
                    return (
                      <div
                        key={summary.supplier_id}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                          selectedSupplier?.supplier_id === summary.supplier_id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => handleSelectSupplier(summary)}
                      >
                        <div className="text-sm font-thai">
                          <p className="font-semibold text-gray-900 text-sm leading-tight mb-1">
                            {summary.supplier_name}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span className="font-mono">{summary.supplier_code}</span>
                            <span className="font-medium">{summary.trip_count} คัน</span>
                          </div>
                          <div className="text-xs space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-gray-600">ค่าขนส่ง:</span>
                              <span className="font-semibold">{summary.total_shipping_cost.toLocaleString()} ฿</span>
                            </div>
                            {summary.total_porterage_fee > 0 && (
                              <div className="flex justify-between text-orange-600">
                                <span>ค่าแบก:</span>
                                <span className="font-semibold">{summary.total_porterage_fee.toLocaleString()} ฿</span>
                              </div>
                            )}
                            {summary.total_other_fees > 0 && (
                              <div className="flex justify-between text-purple-600">
                                <span>ค่าอื่นๆ:</span>
                                <span className="font-semibold">{summary.total_other_fees.toLocaleString()} ฿</span>
                              </div>
                            )}
                            {summary.total_extra_delivery_stops_cost > 0 && (
                              <div className="flex justify-between text-pink-600">
                                <span>จุดส่งพิเศษ:</span>
                                <span className="font-semibold">{summary.total_extra_delivery_stops_cost.toLocaleString()} ฿</span>
                              </div>
                            )}
                            {hasExtraFees && (
                              <div className="flex justify-between border-t border-gray-300 pt-1 mt-1">
                                <span className="font-semibold text-gray-700">รวมทั้งหมด:</span>
                                <span className="text-green-700 font-bold">{grandTotal.toLocaleString()} ฿</span>
                              </div>
                            )}
                            {!hasExtraFees && (
                              <div className="flex justify-between">
                                <span className="font-semibold text-gray-700">รวม:</span>
                                <span className="text-green-700 font-bold">{summary.total_shipping_cost.toLocaleString()} ฿</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Print Preview */}
              {selectedSupplier && (
                <div className="mt-6">
                  <div className="flex justify-end items-center mb-4">
                    <button
                      onClick={handlePrint}
                      className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors font-thai"
                    >
                      <Printer size={20} className="mr-2" />
                      พิมพ์ใบว่าจ้าง
                    </button>
                  </div>

                  {/* Print Content */}
                  <div ref={printRef} className="bg-white">
                    <TransportContractDocument
                      plan={selectedPlan!}
                      supplier={selectedSupplier}
                      currentUser={currentUser}
                      bonusOrdersMap={bonusOrdersMap}
                      contractNo={contractNo}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-thai"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

// Transport Contract Document Component
interface TransportContractDocumentProps {
  plan: Plan;
  supplier: SupplierSummary;
  currentUser: string;
  bonusOrdersMap: Record<number, Record<string, string[]>>; // trip_id -> customer_id -> [bonus_order_no]
  contractNo: string; // เลขเอกสารใบว่าจ้าง
}

const TransportContractDocument: React.FC<TransportContractDocumentProps> = ({ plan, supplier, currentUser, bonusOrdersMap, contractNo }) => {
  const contractDate = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      {/* หน้าที่ 1: ฟอร์มบัญชี (แบบย่อ) */}
      <div className="w-[297mm] min-h-[210mm] p-6 bg-white font-thai landscape-page page-break-after" style={{ fontSize: '12px' }}>
        {/* Trip Info Cards - Show all trip summary info first */}
        <div className="mb-4 space-y-3 print-trip-summary">
          {supplier.trips.map((trip, tripIndex) => {
            let notes: any = {};
            try {
              notes = trip.notes ? JSON.parse(trip.notes) : {};
            } catch {}

            const totalStops = trip.stops?.length || 0;
            
            // ✅ FIX: นับจำนวนร้านค้า (unique customer_id) แทนจำนวน stops
            const allOrders = trip.stops?.flatMap((stop: any) => stop.orders || []) || [];
            const uniqueCustomerIds = new Set(allOrders.map((order: any) => order.customer_id).filter(Boolean));
            const customerCount = uniqueCustomerIds.size || totalStops;
            
            // ✅ FIX: แปลงเป็น number เพราะ database อาจส่งมาเป็น string
            const porterageFee = Number((trip as any).porterage_fee) || 0;
            const otherFees: Array<{ label: string; amount: number }> = (trip as any).other_fees || [];
            const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
            const extraDeliveryStops: Array<{ name: string; description: string; cost: number }> = (trip as any).extra_delivery_stops || [];
            const extraDeliveryStopsCost = extraDeliveryStops.reduce((sum, stop) => sum + (Number(stop.cost) || 0), 0);
            
            // ⚠️ IMPORTANT: shipping_cost ใน database รวมค่าเพิ่มเติมทั้งหมดแล้ว (porterage_fee, other_fees, extra_delivery_stops)
            // ดังนั้น tripGrandTotal = shippingCost โดยตรง ไม่ต้องบวกเพิ่ม
            const shippingCost = Number(trip.shipping_cost) || 0;
            const hasExtraFees = porterageFee > 0 || otherFees.length > 0 || extraDeliveryStops.length > 0;
            const tripGrandTotal = shippingCost; // shipping_cost รวมทุกอย่างแล้ว
            
            // คำนวณค่าขนส่งพื้นฐาน (ไม่รวมค่าเพิ่มเติม) เพื่อแสดงแยก
            const baseShippingCost = Math.max(0, shippingCost - porterageFee - otherFeesTotal - extraDeliveryStopsCost);
            
            // ใช้ daily_trip_number ถ้ามี ไม่งั้นใช้ tripIndex + 1
            const displayTripNumber = trip.daily_trip_number || (tripIndex + 1);

            return (
              <div key={trip.trip_id} className="bg-blue-50 border border-blue-300 rounded px-4 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-base">คันที่ {displayTripNumber}</span>
                    <span className="ml-3 text-sm text-gray-700">
                      ({customerCount} ร้านค้า / {totalStops} จุดส่ง)
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-600">ค่าขนส่ง:</span>
                      <span className="font-semibold">{baseShippingCost.toLocaleString()} บาท</span>
                    </div>
                    {porterageFee > 0 && (
                      <div className="flex justify-between gap-4 text-orange-700">
                        <span>ค่าแบก:</span>
                        <span className="font-semibold">{porterageFee.toLocaleString()} บาท</span>
                      </div>
                    )}
                    {otherFees.map((fee, idx) => (
                      <div key={idx} className="flex justify-between gap-4 text-purple-700">
                        <span>{fee.label}:</span>
                        <span className="font-semibold">{fee.amount.toLocaleString()} บาท</span>
                      </div>
                    ))}
                    {extraDeliveryStops.length > 0 && (
                      <div className="flex justify-between gap-4 text-pink-700">
                        <span>จุดส่งพิเศษ ({extraDeliveryStops.length}):</span>
                        <span className="font-semibold">{extraDeliveryStopsCost.toLocaleString()} บาท</span>
                      </div>
                    )}
                    {hasExtraFees && (
                      <div className="flex justify-between gap-4 border-t border-gray-300 mt-1 pt-1">
                        <span className="font-bold text-gray-800">รวมคันนี้:</span>
                        <span className="font-bold text-green-700">{tripGrandTotal.toLocaleString()} บาท</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      {/* Unified Table for All Trips */}
      <div className="mb-6">
        <div>
          <table className="w-full border-collapse">
            <thead className="page-header-repeat">
              {/* Header Info Row - Will repeat on every page */}
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
                    <p className="text-gray-700 font-normal">เลขที่: {contractNo || '-'}</p>
                    <p className="text-gray-700 font-normal">พิมพ์วันที่: {contractDate}</p>
                    <p className="text-gray-700 font-normal">วันที่ส่ง: {plan.plan_name || new Date(plan.plan_date).toLocaleDateString('th-TH')}</p>
                    <p className="text-gray-700 font-normal">ผู้ออกเอกสาร: {currentUser}</p>
                  </div>

                  <div className="text-center text-xs leading-relaxed mt-2">
                    <p className="font-bold text-base mb-1">ใบว่าจ้างขนส่ง / TRANSPORT CONTRACT</p>
                    <p className="text-gray-700 font-normal">ผู้ให้บริการ: {supplier.supplier_name} ({supplier.supplier_code}) | จำนวน: {supplier.trip_count} คัน</p>
                  </div>
                </th>
              </tr>
              {/* Column Headers */}
              <tr className="bg-gray-100">
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>คันที่</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>จุดที่</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '5%' }}>จังหวัด</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '6%' }}>เลขที่ใบสั่งส่ง</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '5%' }}>รหัสลูกค้า</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '14%' }}>ชื่อร้านค้า</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '5%' }}>น้ำหนัก</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>จำนวน</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>ประตู</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>คิว</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '8%' }}>เปิด-ปิด</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '12%' }}>หมายเหตุ</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '14%' }}>ที่อยู่จัดส่ง</th>
                <th className="border-b border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '11%' }}>(ละติจูด, ลองจิจูด)</th>
              </tr>
            </thead>
            <tbody>
              {supplier.trips.map((trip, tripIndex) => {
                let notes: any = {};
                try {
                  notes = trip.notes ? JSON.parse(trip.notes) : {};
                } catch {}

                const orderRemarks = notes.order_remarks || {};
                
                // คำนวณค่าใช้จ่ายรวมของคันนี้
                // ✅ FIX: แปลงเป็น number เพราะ database อาจส่งมาเป็น string
                const porterageFee = Number((trip as any).porterage_fee) || 0;
                const otherFees: Array<{ label: string; amount: number }> = (trip as any).other_fees || [];
                const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
                const extraDeliveryStops: Array<{ name: string; description: string; cost: number }> = (trip as any).extra_delivery_stops || [];
                const extraDeliveryStopsCost = extraDeliveryStops.reduce((sum, stop) => sum + (Number(stop.cost) || 0), 0);
                
                // ⚠️ IMPORTANT: shipping_cost ใน database รวมค่าเพิ่มเติมทั้งหมดแล้ว
                const shippingCost = Number(trip.shipping_cost) || 0;
                const tripGrandTotal = shippingCost; // shipping_cost รวมทุกอย่างแล้ว ไม่ต้องบวกเพิ่ม
                const hasExtraFees = porterageFee > 0 || otherFees.length > 0 || extraDeliveryStops.length > 0;
                
                // คำนวณค่าขนส่งพื้นฐาน (ไม่รวมค่าเพิ่มเติม) เพื่อแสดงแยก
                const baseShippingCost = Math.max(0, shippingCost - porterageFee - otherFeesTotal - extraDeliveryStopsCost);
                
                // ใช้ daily_trip_number ถ้ามี ไม่งั้นใช้ tripIndex + 1
                const displayTripNumber = trip.daily_trip_number || (tripIndex + 1);
                
                // ✅ FIX: นับจำนวนร้านค้า (unique customer_id) แทนจำนวน stops
                const totalStops = trip.stops?.length || 0;
                const allTripOrders = trip.stops?.flatMap((stop: any) => stop.orders || []) || [];
                const uniqueTripCustomerIds = new Set(allTripOrders.map((order: any) => order.customer_id).filter(Boolean));
                const tripCustomerCount = uniqueTripCustomerIds.size || totalStops;

                return (
                  <React.Fragment key={trip.trip_id}>
                    {/* Trip Info Header Row */}
                    <tr className="bg-blue-100 border-t-2 border-blue-400">
                      <td colSpan={14} className="border border-gray-300 px-3 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-sm">คันที่ {displayTripNumber}</span>
                            <span className="ml-3 text-xs text-gray-700">
                              ({tripCustomerCount} ร้านค้า / {totalStops} จุดส่ง)
                            </span>
                          </div>
                          <div className="text-right text-xs">
                            <div className="flex justify-end gap-3">
                              <span>ค่าขนส่ง: <span className="font-semibold">{baseShippingCost.toLocaleString()}</span></span>
                              {porterageFee > 0 && (
                                <span className="text-orange-700">ค่าแบก: <span className="font-semibold">{porterageFee.toLocaleString()}</span></span>
                              )}
                              {otherFees.map((fee, idx) => (
                                <span key={idx} className="text-purple-700">{fee.label}: <span className="font-semibold">{fee.amount.toLocaleString()}</span></span>
                              ))}
                              {extraDeliveryStops.length > 0 && (
                                <span className="text-pink-700">จุดส่งพิเศษ: <span className="font-semibold">{extraDeliveryStopsCost.toLocaleString()}</span></span>
                              )}
                            </div>
                            <div className="text-sm font-bold text-green-700 mt-1">
                              รวม: {tripGrandTotal.toLocaleString()} บาท
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {(() => {
                      // Track which customer_ids have already shown bonus orders in this trip
                      const shownBonusForCustomer = new Set<string>();
                      
                      return trip.stops?.map((stop: any, stopIndex: number) => {
                      // Get orders for this stop
                      const orders = Array.isArray(stop.orders) && stop.orders.length > 0
                        ? stop.orders
                        : (stop.order_id ? [{
                            order_id: stop.order_id,
                            order_no: stop.order_no,
                            customer_id: stop.order_data?.customer_id || '-',
                            customer_name: stop.stop_name,
                            allocated_weight_kg: stop.load_weight_kg,
                            load_units: stop.load_units || 0,
                            total_qty: 0,
                            note: stop.order_data?.notes || stop.order?.notes || null
                          }] : []);

                      // Extract province from address (if available)
                      const address = stop.address || '';
                      const province = address.split(',').pop()?.trim() || '-';

                      // Format coordinates
                      const coordinates = stop.latitude && stop.longitude
                        ? `${stop.latitude.toFixed(6)}, ${stop.longitude.toFixed(6)}`
                        : '-';

                      return orders.map((order: any, orderIndex: number) => {
                        const isFirstOrderInStop = orderIndex === 0;
                        const orderRemark = orderRemarks[order.order_id] || '';

                        // Get quantity - use total_qty which is the same field used in EditShippingCostModal
                        const quantity = order.total_qty || 0;
                        const weight = order.allocated_weight_kg || order.total_order_weight_kg || 0;
                        
                        // ดึง bonus order_no สำหรับ customer_id นี้
                        const customerId = order.customer_id || '';
                        const tripBonusOrders = bonusOrdersMap[trip.trip_id] || {};
                        
                        // แสดง bonus order_no เฉพาะครั้งแรกที่เจอ customer_id นี้ใน trip
                        let bonusOrderNos: string[] = [];
                        if (customerId && !shownBonusForCustomer.has(customerId)) {
                          bonusOrderNos = tripBonusOrders[customerId] || [];
                          if (bonusOrderNos.length > 0) {
                            shownBonusForCustomer.add(customerId);
                          }
                        }
                        
                        // รวม order_no ปกติกับ bonus order_no (ถ้าเป็นครั้งแรกของ customer)
                        const allOrderNos = [order.order_no];
                        for (const bonusNo of bonusOrderNos) {
                          if (!allOrderNos.includes(bonusNo)) {
                            allOrderNos.push(bonusNo);
                          }
                        }
                        const displayOrderNo = allOrderNos.filter(Boolean).join(', ');

                        return (
                          <tr key={`${stop.stop_id}-${order.order_id || orderIndex}`}>
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs text-center font-semibold bg-gray-50"
                                rowSpan={orders.length}
                              >
                                {displayTripNumber}
                              </td>
                            )}
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs text-center bg-gray-50"
                                rowSpan={orders.length}
                              >
                                {stopIndex + 1}
                              </td>
                            )}
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50"
                                rowSpan={orders.length}
                              >
                                {province}
                              </td>
                            )}
                            <td className="border border-gray-300 px-1 py-2 text-xs">
                              {displayOrderNo || '-'}
                            </td>
                            <td className="border border-gray-300 px-1 py-2 text-xs">
                              {order.customer_id || '-'}
                            </td>
                            <td className="border border-gray-300 px-1 py-2 text-xs">
                              {order.customer_name || stop.stop_name || '-'}
                            </td>
                            <td className="border border-gray-300 px-1 py-2 text-xs text-right">
                              {weight.toFixed(1)}
                            </td>
                            <td className="border border-gray-300 px-1 py-2 text-xs text-right">
                              {quantity}
                            </td>
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50 text-center"
                                rowSpan={orders.length}
                              >
                                {(trip as any).loading_door_number || '-'}
                              </td>
                            )}
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50 text-center"
                                rowSpan={orders.length}
                              >
                                {(trip as any).loading_queue_number || '-'}
                              </td>
                            )}
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50"
                                rowSpan={orders.length}
                                style={{ fontSize: '9px' }}
                              >
                                {order.note || '-'}
                              </td>
                            )}
                            <td className="border border-gray-300 px-1 py-2 text-xs">
                              {orderRemark}
                            </td>
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50"
                                rowSpan={orders.length}
                                style={{ fontSize: '9px' }}
                              >
                                {extractAddressFromTambon(order.text_field_long_1)}
                              </td>
                            )}
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50 font-mono"
                                rowSpan={orders.length}
                                style={{ fontSize: '10px' }}
                              >
                                {coordinates}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    });
                    })()}
                    {/* Extra Delivery Stops (จุดส่งพิเศษที่ไม่มี Order) */}
                    {trip.extra_delivery_stops && trip.extra_delivery_stops.length > 0 && (
                      trip.extra_delivery_stops.map((extraStop: any, extraIndex: number) => (
                        <tr key={`extra-${trip.trip_id}-${extraIndex}`} className="bg-pink-50">
                          <td className="border border-gray-300 px-1 py-2 text-xs text-center font-semibold bg-pink-100">
                            {displayTripNumber}
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs text-center bg-pink-100">
                            พิเศษ
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs bg-pink-100">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs text-pink-700 font-semibold">
                            จุดส่งพิเศษ
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs font-thai text-pink-700">
                            {extraStop.name || '-'}
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs text-right">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs text-right">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs bg-pink-100 text-center">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs bg-pink-100 text-center">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs bg-pink-100">
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs text-pink-700">
                            {extraStop.description || '-'} {extraStop.cost > 0 ? `(${extraStop.cost.toLocaleString()} บาท)` : ''}
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs bg-pink-100" style={{ fontSize: '9px' }}>
                            -
                          </td>
                          <td className="border border-gray-300 px-1 py-2 text-xs bg-pink-100 font-mono" style={{ fontSize: '9px' }}>
                            -
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Subtotal row for each trip */}
                    {(() => {
                      // คำนวณน้ำหนักรวมจาก orders ใน stops จริงๆ (ไม่ใช้ trip.total_weight_kg ที่อาจไม่ถูกต้องเมื่อแบ่งออเดอร์)
                      const calculatedTotalWeight = trip.stops?.reduce((sum: number, stop: any) => {
                        const orders = Array.isArray(stop.orders) && stop.orders.length > 0
                          ? stop.orders
                          : [];
                        return sum + orders.reduce((s: number, o: any) => s + (o.allocated_weight_kg || o.total_order_weight_kg || 0), 0);
                      }, 0) || 0;
                      
                      const calculatedTotalQty = trip.stops?.reduce((sum: number, stop: any) => {
                        const orders = Array.isArray(stop.orders) && stop.orders.length > 0
                          ? stop.orders
                          : [];
                        return sum + orders.reduce((s: number, o: any) => s + (o.total_qty || 0), 0);
                      }, 0) || 0;
                      
                      return (
                        <tr className="bg-blue-50 font-semibold">
                          <td colSpan={6} className="border border-gray-300 px-2 py-2 text-xs text-right">
                            รวมคันที่ {displayTripNumber}:
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-xs text-right">
                            {calculatedTotalWeight.toFixed(1)}
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-xs text-right">
                            {calculatedTotalQty}
                          </td>
                          <td colSpan={6} className="border border-gray-300 px-2 py-2 text-xs"></td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand Total */}
      <div className="border-t-2 border-gray-400 mt-6 pt-4">
        <div className="space-y-1 max-w-xs">
          <div className="flex justify-between items-center">
            <span className="text-sm">ค่าขนส่ง ({supplier.trip_count} คัน):</span>
            <span className="text-sm font-semibold text-right min-w-[100px]">
              {supplier.total_shipping_cost.toLocaleString()} บาท
            </span>
          </div>
          {supplier.total_porterage_fee > 0 && (
            <div className="flex justify-between items-center text-orange-700">
              <span className="text-sm">ค่าแบกน้ำหนัก:</span>
              <span className="text-sm font-semibold text-right min-w-[100px]">
                {supplier.total_porterage_fee.toLocaleString()} บาท
              </span>
            </div>
          )}
          {supplier.total_other_fees > 0 && (
            <div className="flex justify-between items-center text-purple-700">
              <span className="text-sm">ค่าใช้จ่ายอื่นๆ:</span>
              <span className="text-sm font-semibold text-right min-w-[100px]">
                {supplier.total_other_fees.toLocaleString()} บาท
              </span>
            </div>
          )}
          {supplier.total_extra_delivery_stops_cost > 0 && (
            <div className="flex justify-between items-center text-pink-700">
              <span className="text-sm">ค่าจุดส่งพิเศษ:</span>
              <span className="text-sm font-semibold text-right min-w-[100px]">
                {supplier.total_extra_delivery_stops_cost.toLocaleString()} บาท
              </span>
            </div>
          )}
          <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2">
            <span className="text-base font-bold">รวมทั้งสิ้น:</span>
            <span className="text-lg font-bold text-green-700 text-right min-w-[100px]">
              {supplier.total_cost.toLocaleString()} บาท
            </span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-12">
        <div className="text-center">
          <div className="pt-2">
            {/* รูปลายเซ็นผู้ว่าจ้าง */}
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
              <p className="text-xs text-gray-600 mt-1">วันที่: {new Date(plan.plan_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 mt-16">
            <p className="text-sm">ผู้รับจ้าง ({supplier.supplier_name})</p>
            <p className="text-xs text-gray-600 mt-1">วันที่: _______________</p>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-xs text-gray-600 border-t pt-4">
        <p>หมายเหตุ: เอกสารนี้สร้างโดยระบบอัตโนมัติ กรุณาตรวจสอบความถูกต้องก่อนลงนาม</p>
      </div>
    </div>

    {/* หน้าที่ 2: รายละเอียดค่าขนส่งแต่ละเที่ยว */}
    <div className="w-[297mm] min-h-[210mm] p-6 bg-white font-thai landscape-page" style={{ fontSize: '12px' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="text-center mb-4">
          <p className="font-bold text-lg mb-1">รายละเอียดค่าขนส่งแต่ละเที่ยว</p>
          <p className="text-sm text-gray-700">ผู้ให้บริการ: {supplier.supplier_name} ({supplier.supplier_code})</p>
        </div>
      </div>

      {/* Pricing Details - Table Format */}
      <div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '4%' }}>คันที่</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>จำนวนจุดส่ง</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>ทะเบียนรถ</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '9%' }}>ชื่อผู้ขับ</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '4%' }}>ประตู</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '4%' }}>คิว</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '6%' }}>รูปแบบ</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '7%' }}>ราคาเริ่มต้น</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '7%' }}>ค่าเด็กติดรถ</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '10%' }}>ค่าจุดเพิ่ม</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '6%' }}>ค่าแบก</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '10%' }}>ค่าใช้จ่ายอื่นๆ</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '8%' }}>จุดส่งพิเศษ</th>
              <th className="border border-gray-300 px-2 py-2 text-xs text-center" style={{ width: '9%' }}>รวมค่าขนส่ง</th>
            </tr>
          </thead>
          <tbody>
            {supplier.trips.map((trip, tripIndex) => {
              let notes: any = {};
              try {
                notes = trip.notes ? JSON.parse(trip.notes) : {};
              } catch {}

              const stopsCount = trip.stops?.length || 0;
              
              // นับจำนวนจุดจาก unique customer_id แทนการนับจาก order
              const uniqueCustomerIds = new Set<string>();
              trip.stops?.forEach((stop: any) => {
                const orders = Array.isArray(stop.orders) && stop.orders.length > 0
                  ? stop.orders
                  : (stop.order_id ? [{ customer_id: stop.tags?.customer_id || stop.order_data?.customer_id }] : []);
                orders.forEach((order: any) => {
                  if (order.customer_id) {
                    uniqueCustomerIds.add(order.customer_id);
                  }
                });
              });
              const uniqueCustomerCount = uniqueCustomerIds.size || stopsCount;
              
              // ✅ FIX: ใช้ actual_stops_count ถ้ามี (เหมือน EditShippingCostModal)
              // actual_stops_count คือจำนวนจุดส่งจริงที่ user กำหนด (กรณีหลายร้านส่งที่เดียวกัน)
              const actualStopsCount = (trip as any).actual_stops_count;
              const totalStopsForCalc = actualStopsCount !== null && actualStopsCount !== undefined && actualStopsCount > 0 
                ? actualStopsCount 
                : uniqueCustomerCount;
              
              const pricingMode = (trip as any).pricing_mode;
              // ✅ FIX: แปลงเป็น number เพราะ database อาจส่งมาเป็น string
              const basePrice = Number((trip as any).base_price) || 0;
              const helperFee = Number((trip as any).helper_fee) || 0;
              const extraStopFee = Number((trip as any).extra_stop_fee) || 0;
              const porterageFee = Number((trip as any).porterage_fee) || 0;
              const otherFees: Array<{ label: string; amount: number }> = (trip as any).other_fees || [];
              const otherFeesTotal = otherFees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
              const extraDeliveryStopsPage2: Array<{ name: string; description: string; cost: number }> = (trip as any).extra_delivery_stops || [];
              const extraDeliveryStopsCost = extraDeliveryStopsPage2.reduce((sum, stop) => sum + (Number(stop.cost) || 0), 0);
              const shippingCost = Number(trip.shipping_cost) || 0;
              // ✅ FIX: ใช้ base_shipping_cost สำหรับโหมดเหมา
              const baseShippingCostFlat = Number((trip as any).base_shipping_cost) || 0;
              // ✅ FIX: ใช้ totalStopsForCalc แทน uniqueCustomerCount เพื่อให้ตรงกับ EditShippingCostModal
              const extraStops = Math.max(0, totalStopsForCalc - 1);
              const extraStopTotal = extraStops * extraStopFee;
              
              // ใช้ daily_trip_number ถ้ามี ไม่งั้นใช้ tripIndex + 1
              const displayTripNumber = trip.daily_trip_number || (tripIndex + 1);

              return (
                <tr key={trip.trip_id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-3 text-center font-semibold text-sm">
                    {displayTripNumber}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-center text-xs">
                    {uniqueCustomerCount} ลูกค้า / {stopsCount} จุดส่ง
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-xs">
                    {notes.vehicle_label || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-xs">
                    {notes.driver_label || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-center text-xs">
                    {(trip as any).loading_door_number || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-center text-xs">
                    {(trip as any).loading_queue_number || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-center text-xs font-semibold">
                    {pricingMode === 'formula' ? 'คำนวณ' : 'เหมา'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-right text-xs">
                    {pricingMode === 'formula' ? `${basePrice.toLocaleString()}` : (baseShippingCostFlat > 0 ? `${baseShippingCostFlat.toLocaleString()}` : '-')}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-right text-xs">
                    {pricingMode === 'formula' ? `${helperFee.toLocaleString()}` : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-xs">
                    {pricingMode === 'formula' ? (
                      <div className="text-right">
                        {extraStops} × {extraStopFee.toLocaleString()} = {extraStopTotal.toLocaleString()}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-right text-xs">
                    {porterageFee > 0 ? `${porterageFee.toLocaleString()}` : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-xs">
                    {otherFees.length > 0 ? (
                      <div className="text-left">
                        {otherFees.map((fee, idx) => (
                          <div key={idx} className="text-xs">
                            {fee.label}: {fee.amount.toLocaleString()}
                          </div>
                        ))}
                        {otherFees.length > 1 && (
                          <div className="font-semibold border-t border-gray-300 mt-1 pt-1">
                            รวม: {otherFeesTotal.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-xs">
                    {extraDeliveryStopsPage2.length > 0 ? (
                      <div className="text-left">
                        {extraDeliveryStopsPage2.map((stop, idx) => (
                          <div key={idx} className="text-xs text-pink-700">
                            {stop.name}: {stop.cost.toLocaleString()}
                          </div>
                        ))}
                        {extraDeliveryStopsPage2.length > 1 && (
                          <div className="font-semibold border-t border-gray-300 mt-1 pt-1">
                            รวม: {extraDeliveryStopsCost.toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-3 text-right text-xs font-bold text-green-700">
                    {shippingCost.toLocaleString()} บาท
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="border-t-2 border-gray-400 mt-6 pt-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm">ค่าขนส่ง ({supplier.trip_count} คัน):</span>
            <span className="text-sm font-semibold">
              {supplier.total_shipping_cost.toLocaleString()} บาท
            </span>
          </div>
          {supplier.total_porterage_fee > 0 && (
            <div className="flex justify-between items-center text-orange-700">
              <span className="text-sm">ค่าแบกน้ำหนัก:</span>
              <span className="text-sm font-semibold">
                {supplier.total_porterage_fee.toLocaleString()} บาท
              </span>
            </div>
          )}
          {supplier.total_other_fees > 0 && (
            <div className="flex justify-between items-center text-purple-700">
              <span className="text-sm">ค่าใช้จ่ายอื่นๆ:</span>
              <span className="text-sm font-semibold">
                {supplier.total_other_fees.toLocaleString()} บาท
              </span>
            </div>
          )}
          {supplier.total_extra_delivery_stops_cost > 0 && (
            <div className="flex justify-between items-center text-pink-700">
              <span className="text-sm">ค่าจุดส่งพิเศษ:</span>
              <span className="text-sm font-semibold">
                {supplier.total_extra_delivery_stops_cost.toLocaleString()} บาท
              </span>
            </div>
          )}
          <div className="flex justify-between items-center border-t border-gray-300 pt-2 mt-2">
            <span className="text-base font-bold">รวมทั้งหมด:</span>
            <span className="text-lg font-bold text-green-700">
              {supplier.total_cost.toLocaleString()} บาท
            </span>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

// Add landscape print styles
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

      /* Force page break after first page */
      .page-break-after {
        page-break-after: always !important;
        break-after: page !important;
      }

      /* Hide trip summary cards on print */
      .print-trip-summary {
        display: none !important;
      }

      /* Remove all extra margins and paddings */
      .mb-6, .mb-4, .mt-4, .mt-12, .p-6 {
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Table wrapper - remove all spacing */
      .border-2.border-gray-400.rounded {
        border: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* CRITICAL: Make table header repeat on every page */
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

      /* Prevent page breaks inside rows */
      tbody tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      /* Prevent orphaned subtotal rows */
      tbody tr.bg-blue-50 {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }

      /* Prevent trip header from being separated from its data */
      tbody tr.bg-blue-100 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      /* Keep trip header with following rows */
      tbody tr.bg-blue-100 + tr {
        page-break-before: avoid !important;
        break-before: avoid !important;
      }

      tfoot {
        display: table-footer-group !important;
      }

      /* Ensure borders print correctly */
      td, th {
        border: 1px solid #9ca3af !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        padding: 4px !important;
      }

      /* Print background colors */
      .bg-gray-200,
      .bg-blue-100,
      .bg-blue-50,
      .bg-gray-50,
      .bg-green-100 {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      /* Signatures section - keep at end */
      .grid.grid-cols-2 {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 10mm !important;
      }

      /* Grand total section - keep with signatures */
      .bg-green-100.border-2 {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 3mm 0 !important;
        padding: 8px 16px !important;
        border: 2px solid #16a34a !important;
        border-radius: 0 !important;
      }

      /* Footer note */
      .border-t.pt-4 {
        page-break-inside: avoid !important;
        margin-top: 5mm !important;
        padding-top: 3mm !important;
      }
    }

    @media screen {
      /* On screen, show trip summary */
      .print-trip-summary {
        display: block;
      }
    }
  `;
  if (!document.querySelector('style[data-landscape-print]')) {
    style.setAttribute('data-landscape-print', 'true');
    document.head.appendChild(style);
  }
}

export default TransportContractModal;
