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
  warehouse_id: string;
  warehouse?: {
    warehouse_name: string;
  };
  trips?: Trip[];
}

interface Trip {
  trip_id: number;
  trip_sequence: number;
  supplier_id?: string;
  shipping_cost?: number;
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
  supplier_code: string;
  trip_count: number;
  total_cost: number;
  trips: Trip[];
}

interface TransportContractModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TransportContractModal: React.FC<TransportContractModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'select-plan' | 'select-supplier'>('select-plan');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierSummaries, setSupplierSummaries] = useState<SupplierSummary[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'accounting' | 'warehouse'>('accounting');
  const [currentUser, setCurrentUser] = useState<string>('');

  const printRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบว่าจ้างขนส่ง-${selectedSupplier?.supplier_name}-${selectedPlan?.plan_code}`,
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
              console.error('Failed to update status:', result.error);
            }
          } catch (err) {
            console.error('Error updating plan status:', err);
          }
        }
      }, 500);
    } catch (err) {
      console.error('Error in handlePrint:', err);
    }
  };

  useEffect(() => {
    if (isOpen && step === 'select-plan') {
      fetchPublishedPlans();
      fetchSuppliers();
      fetchCurrentUser();
    }
  }, [isOpen, step, selectedSupplier, selectedPlan]);

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.user_metadata) {
        const fullName = `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim();
        setCurrentUser(fullName || user.email || 'ไม่ระบุ');
      } else if (user?.email) {
        setCurrentUser(user.email);
      } else {
        setCurrentUser('ไม่ระบุ');
      }
    } catch (err) {
      console.error('Error fetching user:', err);
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
    
    // Fetch full trip details
    try {
      const res = await fetch(`/api/route-plans/${plan.plan_id}/editor`);
      const { data } = await res.json();
      
      if (data?.trips) {
        // Group trips by supplier
        const grouped = data.trips.reduce((acc: Record<string, any>, trip: Trip) => {
          if (!trip.supplier_id) return acc;
          
          if (!acc[trip.supplier_id]) {
            const supplier = suppliers.find(s => s.supplier_id === trip.supplier_id);
            acc[trip.supplier_id] = {
              supplier_id: trip.supplier_id,
              supplier_name: supplier?.supplier_name || 'ไม่ระบุ',
              supplier_code: supplier?.supplier_code || '',
              trip_count: 0,
              total_cost: 0,
              trips: []
            };
          }
          
          acc[trip.supplier_id].trip_count++;
          acc[trip.supplier_id].total_cost += Number(trip.shipping_cost || 0);
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

  const handleSelectSupplier = (summary: SupplierSummary) => {
    setSelectedSupplier(summary);
  };



  const handleBack = () => {
    if (step === 'select-supplier') {
      setStep('select-plan');
      setSelectedPlan(null);
      setSupplierSummaries([]);
      setSelectedSupplier(null);
    }
  };

  const handleClose = () => {
    setStep('select-plan');
    setSelectedPlan(null);
    setSupplierSummaries([]);
    setSelectedSupplier(null);
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {supplierSummaries.map((summary) => (
                    <div
                      key={summary.supplier_id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedSupplier?.supplier_id === summary.supplier_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => handleSelectSupplier(summary)}
                    >
                      <h3 className="font-bold text-lg text-gray-900 font-thai mb-2">
                        {summary.supplier_name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">รหัส: {summary.supplier_code}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">จำนวนคัน:</span>
                          <span className="font-semibold">{summary.trip_count} คัน</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">ค่าขนส่งรวม:</span>
                          <span className="font-semibold text-green-600">
                            {summary.total_cost.toLocaleString()} บาท
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Print Preview */}
              {selectedSupplier && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    {/* Print Mode Selector */}
                    <div className="flex gap-4 items-center">
                      <span className="text-sm font-semibold text-gray-700 font-thai">รูปแบบใบว่าจ้าง:</span>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="print-mode"
                          value="accounting"
                          checked={printMode === 'accounting'}
                          onChange={() => setPrintMode('accounting')}
                          className="mr-2"
                        />
                        <span className="text-sm font-thai">บัญชี (แบบย่อ)</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="print-mode"
                          value="warehouse"
                          checked={printMode === 'warehouse'}
                          onChange={() => setPrintMode('warehouse')}
                          className="mr-2"
                        />
                        <span className="text-sm font-thai">คลังสินค้า (แบบละเอียด)</span>
                      </label>
                    </div>

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
                      printMode={printMode}
                      currentUser={currentUser}
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
  printMode: 'accounting' | 'warehouse';
  currentUser: string;
}

const TransportContractDocument: React.FC<TransportContractDocumentProps> = ({ plan, supplier, printMode, currentUser }) => {
  const contractDate = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="w-[297mm] min-h-[210mm] p-6 bg-white font-thai landscape-page" style={{ fontSize: '12px' }}>
      {/* Trip Info Cards - Show all trip summary info first */}
      <div className="mb-4 space-y-3 print-trip-summary">
        {supplier.trips.map((trip, tripIndex) => {
          let notes: any = {};
          try {
            notes = trip.notes ? JSON.parse(trip.notes) : {};
          } catch {}

          const totalStops = trip.stops?.length || 0;

          return (
            <div key={trip.trip_id} className="bg-blue-50 border border-blue-300 rounded px-4 py-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-base">คันที่ {tripIndex + 1}</span>
                  <span className="ml-3 text-sm text-gray-700">
                    ({totalStops} ร้านค้า / {totalStops} จุดส่ง)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm mr-4">ระยะทาง: {trip.total_distance_km ? trip.total_distance_km.toFixed(1) : '-'} km</span>
                  <span className="text-base font-bold text-green-700">
                    ค่าขนส่ง: {(trip.shipping_cost || 0).toLocaleString()} บาท
                  </span>
                </div>
              </div>

              {/* Warehouse Mode: Show pricing breakdown */}
              {printMode === 'warehouse' && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-gray-700 mb-1">
                        <span className="font-semibold">รูปแบบการคิดค่าขนส่ง:</span> {(trip as any).pricing_mode === 'formula' ? 'แบบคำนวณ' : 'แบบเหมา'}
                      </p>
                      {(trip as any).pricing_mode === 'formula' && (
                        <>
                          <p className="text-gray-700">• ราคาเริ่มต้น: {((trip as any).base_price || 0).toLocaleString()} บาท</p>
                          <p className="text-gray-700">• ค่าเด็กติดรถ: {((trip as any).helper_fee || 0).toLocaleString()} บาท</p>
                          <p className="text-gray-700">• ค่าจุดเพิ่ม: {Math.max(0, totalStops - 1)} จุด × {((trip as any).extra_stop_fee || 0).toLocaleString()} = {(Math.max(0, totalStops - 1) * ((trip as any).extra_stop_fee || 0)).toLocaleString()} บาท</p>
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-700"><span className="font-semibold">ทะเบียนรถ:</span> {notes.vehicle_label || '-'}</p>
                      <p className="text-gray-700"><span className="font-semibold">ชื่อผู้ขับ:</span> {notes.driver_label || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unified Table for All Trips */}
      <div className="mb-6">
        <div className="border-2 border-gray-400 rounded">
          <table className="w-full border-collapse">
            <thead className="bg-gray-200 page-header-repeat">
              {/* Header Info Row - Will repeat on every page */}
              <tr>
                <th colSpan={13} className="border-b-2 border-gray-300 px-4 py-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <Image
                        src="/images/austam-logo.png"
                        alt="Austam Logo"
                        width={40}
                        height={40}
                        className="object-contain flex-shrink-0"
                      />
                      <div className="text-xs leading-relaxed text-left">
                        <p className="font-bold text-sm mb-0.5">AUSTAM GOODS CORP., LTD.</p>
                        <p className="text-gray-700 font-normal">350, 352 Udomsuk Road., Bangkok 10260</p>
                        <p className="text-gray-700 font-normal">Tel. 662-749-4667-72 | austamgoods@yahoo.com</p>
                      </div>
                    </div>

                    <div className="text-xs text-right leading-relaxed flex-shrink-0">
                      <p className="text-gray-700 font-normal">เลขที่: {plan.plan_code}</p>
                      <p className="text-gray-700 font-normal">พิมพ์วันที่: {contractDate}</p>
                      <p className="text-gray-700 font-normal">แผนวันที่ส่ง: {plan.plan_name || plan.plan_code}</p>
                      <p className="text-gray-700 font-normal">ผู้ออกเอกสาร: {currentUser}</p>
                    </div>
                  </div>

                  <div className="text-center text-xs leading-relaxed mt-2">
                    <p className="font-bold text-base mb-1">ใบว่าจ้างขนส่ง / TRANSPORT CONTRACT</p>
                    <p className="text-gray-700 font-normal">ผู้ให้บริการ: {supplier.supplier_name} ({supplier.supplier_code}) | จำนวน: {supplier.trip_count} คัน</p>
                  </div>
                </th>
              </tr>
              {/* Column Headers */}
              <tr>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>คันที่</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>จุดที่</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '5%' }}>จังหวัด</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '7%' }}>เลขที่ใบสั่งส่ง</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '6%' }}>รหัสลูกค้า</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '20%' }}>ชื่อร้านค้า</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '6%' }}>น้ำหนัก</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '5%' }}>จำนวน</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '5%' }}>ประตู</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '4%' }}>คิว</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '6%' }}>เปิด-ปิด</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '16%' }}>หมายเหตุ</th>
                <th className="border border-gray-300 px-1 py-2 text-center text-xs" style={{ width: '12%' }}>(ละติจูด, ลองจิจูด)</th>
              </tr>
            </thead>
            <tbody>
              {supplier.trips.map((trip, tripIndex) => {
                let notes: any = {};
                try {
                  notes = trip.notes ? JSON.parse(trip.notes) : {};
                } catch {}

                const orderRemarks = notes.order_remarks || {};

                return (
                  <React.Fragment key={trip.trip_id}>
                    {/* Trip Info Header Row */}
                    <tr className="bg-blue-100 border-t-2 border-blue-400">
                      <td colSpan={13} className="border border-gray-300 px-3 py-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-sm">คันที่ {tripIndex + 1}</span>
                            <span className="ml-3 text-xs text-gray-700">
                              ({trip.stops?.length || 0} ร้านค้า / {trip.stops?.length || 0} จุดส่ง)
                            </span>
                            {printMode === 'warehouse' && (
                              <>
                                <span className="ml-4 text-xs">
                                  <span className="font-semibold">ทะเบียนรถ:</span> {notes.vehicle_label || '-'}
                                </span>
                                <span className="ml-4 text-xs">
                                  <span className="font-semibold">ชื่อผู้ขับ:</span> {notes.driver_label || '-'}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs mr-4">ระยะทาง: <span className="font-semibold">{trip.total_distance_km ? trip.total_distance_km.toFixed(1) : '-'} km</span></span>
                            <span className="text-sm font-bold text-green-700">
                              ค่าขนส่ง: {(trip.shipping_cost || 0).toLocaleString()} บาท
                            </span>
                          </div>
                        </div>
                        {printMode === 'warehouse' && (trip as any).pricing_mode === 'formula' && (
                          <div className="mt-1 pt-1 border-t border-blue-200 text-xs text-gray-700">
                            <span className="font-semibold">รูปแบบการคิดค่าขนส่ง:</span> แบบคำนวณ
                            <span className="ml-3">• ราคาเริ่มต้น: {((trip as any).base_price || 0).toLocaleString()} บาท</span>
                            <span className="ml-3">• ค่าเด็กติดรถ: {((trip as any).helper_fee || 0).toLocaleString()} บาท</span>
                            <span className="ml-3">• ค่าจุดเพิ่ม: {Math.max(0, (trip.stops?.length || 0) - 1)} จุด × {((trip as any).extra_stop_fee || 0).toLocaleString()} = {(Math.max(0, (trip.stops?.length || 0) - 1) * ((trip as any).extra_stop_fee || 0)).toLocaleString()} บาท</span>
                          </div>
                        )}
                        {printMode === 'warehouse' && (trip as any).pricing_mode !== 'formula' && (
                          <div className="mt-1 pt-1 border-t border-blue-200 text-xs text-gray-700">
                            <span className="font-semibold">รูปแบบการคิดค่าขนส่ง:</span> แบบเหมา
                          </div>
                        )}
                      </td>
                    </tr>
                    {trip.stops?.map((stop: any, stopIndex: number) => {
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
                            total_qty: 0
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

                        return (
                          <tr key={`${stop.stop_id}-${order.order_id || orderIndex}`}>
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs text-center font-semibold bg-gray-50"
                                rowSpan={orders.length}
                              >
                                {tripIndex + 1}
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
                              {order.order_no || '-'}
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
                              >
                                -
                              </td>
                            )}
                            <td className="border border-gray-300 px-1 py-2 text-xs">
                              {orderRemark}
                            </td>
                            {isFirstOrderInStop && (
                              <td
                                className="border border-gray-300 px-1 py-2 text-xs bg-gray-50 font-mono"
                                rowSpan={orders.length}
                                style={{ fontSize: '9px' }}
                              >
                                {coordinates}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })}
                    {/* Subtotal row for each trip */}
                    <tr className="bg-blue-50 font-semibold">
                      <td colSpan={6} className="border border-gray-300 px-2 py-2 text-xs text-right">
                        รวมคันที่ {tripIndex + 1}:
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-xs text-right">
                        {(trip.total_weight_kg || 0).toFixed(1)}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-xs text-right">
                        {trip.stops?.reduce((sum: number, stop: any) => {
                          const orders = Array.isArray(stop.orders) && stop.orders.length > 0
                            ? stop.orders
                            : [];
                          return sum + orders.reduce((s: number, o: any) => s + (o.total_qty || 0), 0);
                        }, 0)}
                      </td>
                      <td colSpan={5} className="border border-gray-300 px-2 py-2 text-xs"></td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grand Total */}
        <div className="bg-green-100 border-2 border-green-600 rounded px-4 py-3 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold">รวมทั้งสิ้น ({supplier.trip_count} คัน)</span>
            <span className="text-2xl font-bold text-green-700">
              {supplier.total_cost.toLocaleString()} บาท
            </span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-12">
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 mt-16">
            <p className="text-sm">ผู้ว่าจ้าง (AUSTAM GOODS CORP., LTD.)</p>
            <p className="text-xs text-gray-600 mt-1">วันที่: _______________</p>
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
