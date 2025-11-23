'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';

interface OrderDetail {
  order_id: number;
  order_no: string;
  customer_id: string;
  stop_name: string;
  total_qty: number;
  weight: number;
}

interface Stop {
  stop_id: number;
  stop_name: string;
  order_id?: number;
  load_weight_kg?: number;
  orders: OrderDetail[];
}

interface Trip {
  trip_id: number;
  trip_sequence: number;
  vehicle_id?: number;
  driver_id?: number;
  shipping_cost?: number;
  total_distance_km?: number;
  total_weight_kg?: number;
  notes?: string;
  stops?: Stop[];
}

interface Plan {
  plan_id: number;
  plan_code: string;
  plan_name: string;
  plan_date: string;
  status: string;
  warehouse_id: string;
  total_trips?: number;
  total_distance_km?: number;
  warehouse?: {
    warehouse_id: string;
    warehouse_name: string;
  };
  trips?: Trip[];
}

interface EditShippingCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId?: number | null;
}

interface TripEditFormProps {
  trip: Trip;
  tripIndex: number;
  suppliers: Supplier[];
  onDataChange: (tripId: number, data: TripFormData) => void;
}

interface TripFormData {
  pricingMode: 'formula' | 'flat';
  shipping_cost: number;
  vehicle_label: string;
  driver_label: string;
  supplier_id: string;
  base_price: number;
  helper_fee: number;
  extra_stop_fee: number;
  orderRemarks: Record<number, string>;
}

interface Supplier {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_type: string;
  phone?: string;
  service_category?: string;
}

const TripEditForm: React.FC<TripEditFormProps> = ({ trip, tripIndex, suppliers, onDataChange }) => {
  // Parse notes if it's a JSON string
  let parsedNotes = {
    vehicle_label: '',
    driver_label: '',
    order_remarks: {} as Record<number, string>
  };

  if (trip.notes) {
    try {
      const parsed = JSON.parse(trip.notes);
      if (typeof parsed === 'object') {
        parsedNotes = {
          vehicle_label: parsed.vehicle_label || '',
          driver_label: parsed.driver_label || '',
          order_remarks: parsed.order_remarks || {}
        };
      }
    } catch {
      // If notes is plain text, ignore it
    }
  }

  // Initialize pricing mode from trip data
  const [pricingMode, setPricingMode] = useState<'formula' | 'flat'>(
    (trip as any).pricing_mode === 'formula' ? 'formula' : 'flat'
  );

  const [formData, setFormData] = useState({
    shipping_cost: trip.shipping_cost || 0,
    vehicle_label: parsedNotes.vehicle_label,
    driver_label: parsedNotes.driver_label,
    supplier_id: (trip as any).supplier_id || '',
    base_price: (trip as any).base_price || 0,
    helper_fee: (trip as any).helper_fee || 0,
    extra_stop_fee: (trip as any).extra_stop_fee || 100
  });

  // State for order-specific remarks
  const [orderRemarks, setOrderRemarks] = useState<Record<number, string>>(parsedNotes.order_remarks);

  const handleChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Notify parent of changes
    onDataChange(trip.trip_id, {
      pricingMode,
      ...newFormData,
      orderRemarks
    });
  };

  // Calculate shipping cost based on formula
  const calculateShippingCost = () => {
    if (pricingMode === 'flat') {
      return formData.shipping_cost;
    }
    
    // Formula mode: base_price + helper_fee + (extra stops × extra_stop_fee)
    const extraStops = Math.max(0, totalStops - 1);
    const calculated = formData.base_price + formData.helper_fee + (extraStops * formData.extra_stop_fee);
    return calculated;
  };

  const handleOrderRemarkChange = (orderId: number, value: string) => {
    const newRemarks = { ...orderRemarks, [orderId]: value };
    setOrderRemarks(newRemarks);
    
    // Notify parent of changes
    onDataChange(trip.trip_id, {
      pricingMode,
      ...formData,
      orderRemarks: newRemarks
    });
  };

  const handlePricingModeChange = (mode: 'formula' | 'flat') => {
    setPricingMode(mode);
    
    // Notify parent of changes
    onDataChange(trip.trip_id, {
      pricingMode: mode,
      ...formData,
      orderRemarks
    });
  };

  // Collect all orders from all stops
  const allOrders = trip.stops?.flatMap(stop => stop.orders || []) || [];

  // Calculate totals
  const totalStops = trip.stops?.length || 0;
  const totalUnits = allOrders.reduce((sum, order) => sum + order.total_qty, 0);
  const totalWeight = trip.total_weight_kg || allOrders.reduce((sum, order) => sum + order.weight, 0);
  const distance = trip.total_distance_km || 0;
  
  // Calculate capacity percentage (assuming 2200kg default capacity)
  const vehicleCapacity = 2200; // Default capacity, can be made configurable
  const capacityPercent = vehicleCapacity > 0 ? (totalWeight / vehicleCapacity * 100) : 0;

  return (
    <div className="border-2 border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Summary Card Header */}
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900 font-thai mb-3">
          เที่ยวที่ {trip.trip_sequence}
        </h3>
        
        {/* Compact Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-sm mb-4">
          <div className="flex justify-between items-center py-1.5 px-2 bg-blue-50 rounded">
            <span className="text-gray-600 text-xs">ระยะทาง:</span>
            <span className="font-semibold text-blue-600">{distance.toFixed(1)} km</span>
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded">
            <span className="text-gray-600 text-xs">รวมจุดส่ง:</span>
            <span className="font-semibold text-gray-900">{totalStops} จุด</span>
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded">
            <span className="text-gray-600 text-xs">รวมออเดอร์:</span>
            <span className="font-semibold text-gray-900">{allOrders.length} รายการ</span>
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded">
            <span className="text-gray-600 text-xs">รวมชิ้น:</span>
            <span className="font-semibold text-gray-900">{totalUnits} ชิ้น</span>
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded">
            <span className="text-gray-600 text-xs">รวมน้ำหนัก:</span>
            <span className="font-semibold text-gray-900">{totalWeight.toFixed(1)} kg</span>
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-gradient-to-r from-green-50 to-green-100 rounded">
            <span className="text-gray-600 text-xs">% การใช้รถ:</span>
            <span className={`font-bold text-base ${
              capacityPercent > 100 ? 'text-red-600' : 
              capacityPercent > 90 ? 'text-orange-600' : 
              'text-green-600'
            }`}>
              {capacityPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Order Details Table */}
      {allOrders.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="min-w-full text-xs border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">ลำดับ</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">เลขที่ออเดอร์</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">รหัสลูกค้า</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">ชื่อร้าน</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-700 border-b font-thai">รวมจำนวนชิ้น</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-700 border-b font-thai">น้ำหนัก (kg)</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai" style={{ minWidth: '200px' }}>หมายเหตุเพิ่มเติม</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allOrders.map((order, index) => (
                <tr key={order.order_id} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-gray-900">{index + 1}</td>
                  <td className="px-2 py-2 text-blue-600 font-mono">{order.order_no}</td>
                  <td className="px-2 py-2 text-gray-900 font-mono">{order.customer_id}</td>
                  <td className="px-2 py-2 text-gray-900 font-thai">{order.stop_name}</td>
                  <td className="px-2 py-2 text-right text-gray-900 font-mono">{order.total_qty}</td>
                  <td className="px-2 py-2 text-right text-gray-900 font-mono">{order.weight.toFixed(1)}</td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={orderRemarks[order.order_id] || ''}
                      onChange={(e) => handleOrderRemarkChange(order.order_id, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-thai"
                      placeholder="หมายเหตุ..."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-2 py-2 text-right font-semibold text-gray-900 font-thai">รวม:</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900 font-mono">{allOrders.reduce((sum, order) => sum + order.total_qty, 0)} ชิ้น</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900 font-mono">{allOrders.reduce((sum, order) => sum + order.weight, 0).toFixed(1)} kg</td>
                <td className="px-2 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Pricing Mode Selector */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <label className="block text-sm font-semibold text-gray-800 mb-2 font-thai">
          รูปแบบการคิดค่าขนส่ง
        </label>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name={`pricing-mode-${trip.trip_id}`}
              value="flat"
              checked={pricingMode === 'flat'}
              onChange={() => handlePricingModeChange('flat')}
              className="mr-2"
            />
            <span className="text-sm font-thai">แบบเหมา (ใส่ราคาเดียวจบ)</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name={`pricing-mode-${trip.trip_id}`}
              value="formula"
              checked={pricingMode === 'formula'}
              onChange={() => handlePricingModeChange('formula')}
              className="mr-2"
            />
            <span className="text-sm font-thai">แบบคำนวณ (ราคาเริ่มต้น + ค่าเด็ก + ค่าจุดเพิ่ม)</span>
          </label>
        </div>
      </div>

      {/* Pricing Fields */}
      {pricingMode === 'flat' ? (
        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ผู้ให้บริการขนส่ง
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => handleChange('supplier_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai"
              >
                <option value="">-- เลือกผู้ให้บริการ --</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.supplier_name} ({supplier.supplier_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ค่าขนส่งเหมา (บาท) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.shipping_cost}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('shipping_cost', value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ทะเบียนรถ
              </label>
              <input
                type="text"
                value={formData.vehicle_label}
                onChange={(e) => handleChange('vehicle_label', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai"
                placeholder="เช่น กข 1234 กรุงเทพ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ชื่อผู้ขับ
              </label>
              <input
                type="text"
                value={formData.driver_label}
                onChange={(e) => handleChange('driver_label', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai"
                placeholder="ชื่อผู้ขับรถ"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ราคาเริ่มต้นตามจังหวัด (บาท) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.base_price}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('base_price', value);
                  handleChange('shipping_cost', value + formData.helper_fee + (Math.max(0, totalStops - 1) * formData.extra_stop_fee));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น 1700"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">เช่น กทม 1700, เชียงใหม่ 5000</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ค่าเด็กติดรถ (บาท)
              </label>
              <input
                type="number"
                value={formData.helper_fee}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('helper_fee', value);
                  handleChange('shipping_cost', formData.base_price + value + (Math.max(0, totalStops - 1) * formData.extra_stop_fee));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น 500"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">ถ้าไม่มีใส่ 0</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ค่าจุดเพิ่ม (บาท/จุด)
              </label>
              <input
                type="number"
                value={formData.extra_stop_fee}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('extra_stop_fee', value);
                  handleChange('shipping_cost', formData.base_price + formData.helper_fee + (Math.max(0, totalStops - 1) * value));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">จุดที่ 2 ขึ้นไป</p>
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-thai space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-700">ราคาเริ่มต้น:</span>
                <span className="font-semibold">{formData.base_price.toLocaleString()} บาท</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">ค่าเด็กติดรถ:</span>
                <span className="font-semibold">{formData.helper_fee.toLocaleString()} บาท</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">ค่าจุดเพิ่ม ({Math.max(0, totalStops - 1)} จุด × {formData.extra_stop_fee} บาท):</span>
                <span className="font-semibold">{(Math.max(0, totalStops - 1) * formData.extra_stop_fee).toLocaleString()} บาท</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-300">
                <span className="text-gray-900 font-bold">รวมค่าขนส่ง:</span>
                <span className="text-green-700 font-bold text-lg">{calculateShippingCost().toLocaleString()} บาท</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ผู้ให้บริการขนส่ง
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => handleChange('supplier_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai"
              >
                <option value="">-- เลือกผู้ให้บริการ --</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.supplier_name} ({supplier.supplier_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ทะเบียนรถ
              </label>
              <input
                type="text"
                value={formData.vehicle_label}
                onChange={(e) => handleChange('vehicle_label', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai"
                placeholder="เช่น กข 1234 กรุงเทพ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-thai">
                ชื่อผู้ขับ
              </label>
              <input
                type="text"
                value={formData.driver_label}
                onChange={(e) => handleChange('driver_label', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai"
                placeholder="ชื่อผู้ขับรถ"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const EditShippingCostModal: React.FC<EditShippingCostModalProps> = ({
  isOpen,
  onClose
}) => {
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Store form data for all trips
  const [tripsFormData, setTripsFormData] = useState<Record<number, TripFormData>>({});

  useEffect(() => {
    if (isOpen && step === 'select') {
      fetchPublishedPlans();
      fetchSuppliers();
    }
  }, [isOpen, step]);

  const fetchPublishedPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/route-plans/published');
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
      const { data, error } = await res.json();
      if (!error && data) {
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep('edit');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedPlan(null);
    setTripsFormData({});
  };

  const handleClose = () => {
    setStep('select');
    setSelectedPlan(null);
    setPlans([]);
    setError(null);
    setTripsFormData({});
    onClose();
  };

  const handleTripDataChange = (tripId: number, data: TripFormData) => {
    setTripsFormData(prev => ({
      ...prev,
      [tripId]: data
    }));
  };

  const handleSaveAll = async () => {
    if (!selectedPlan?.trips) return;

    setSavingAll(true);
    const errors: string[] = [];
    let successCount = 0;

    try {
      // Save all trips in parallel
      const savePromises = selectedPlan.trips.map(async (trip) => {
        const tripData = tripsFormData[trip.trip_id];

        // Parse existing notes
        let existingNotes: any = {};
        try {
          existingNotes = trip.notes ? JSON.parse(trip.notes) : {};
        } catch {}

        // If no changes in form, use existing trip data
        const pricingMode = tripData?.pricingMode || (trip as any).pricing_mode || 'flat';
        const basePrice = tripData?.base_price ?? (trip as any).base_price ?? 0;
        const helperFee = tripData?.helper_fee ?? (trip as any).helper_fee ?? 0;
        const extraStopFee = tripData?.extra_stop_fee ?? (trip as any).extra_stop_fee ?? 100;
        const supplierId = tripData?.supplier_id || (trip as any).supplier_id || null;
        const vehicleLabel = tripData?.vehicle_label ?? existingNotes.vehicle_label ?? '';
        const driverLabel = tripData?.driver_label ?? existingNotes.driver_label ?? '';
        const orderRemarks = tripData?.orderRemarks ?? existingNotes.order_remarks ?? {};

        try {
          // Prepare notes as JSON string with order remarks
          const notesData = {
            vehicle_label: vehicleLabel,
            driver_label: driverLabel,
            order_remarks: orderRemarks
          };

          // Prepare payload based on pricing mode
          const totalStops = trip.stops?.length || 0;
          const payload: any = {
            notes: JSON.stringify(notesData),
            pricing_mode: pricingMode,
            supplier_id: supplierId
          };

          // Add formula-specific fields if in formula mode
          if (pricingMode === 'formula') {
            payload.base_price = basePrice;
            payload.helper_fee = helperFee;
            payload.extra_stop_fee = extraStopFee;
            payload.total_stops = totalStops; // Send total_stops to trigger database calculation
          } else {
            // For flat mode, send shipping_cost directly
            payload.shipping_cost = tripData?.shipping_cost ?? trip.shipping_cost ?? 0;
          }

          const res = await fetch(`/api/route-plans/trips/${trip.trip_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const { data, error } = await res.json();
          if (error) {
            errors.push(`เที่ยวที่ ${trip.trip_sequence}: ${error}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          errors.push(`เที่ยวที่ ${trip.trip_sequence}: ${err.message}`);
        }
      });

      await Promise.all(savePromises);

      // ⚠️ หมายเหตุ: ไม่ต้องอัปเดต objective_value ที่นี่แล้ว
      // Database Trigger (check_shipping_cost_complete_and_publish) จะทำให้อัตโนมัติ
      // เมื่อค่าขนส่งครบทุกเที่ยว trigger จะ:
      // 1. คำนวณ objective_value = SUM(shipping_cost)
      // 2. เปลี่ยนสถานะจาก 'optimizing' → 'published'

      // Show result
      if (errors.length === 0) {
        alert(`✅ บันทึกสำเร็จทั้งหมด ${successCount} เที่ยว`);
        handleClose();
      } else if (successCount > 0) {
        alert(`⚠️ บันทึกสำเร็จ ${successCount} เที่ยว\n\nข้อผิดพลาด:\n${errors.join('\n')}`);
      } else {
        alert(`❌ เกิดข้อผิดพลาดทั้งหมด:\n${errors.join('\n')}`);
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setSavingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-bold font-thai text-gray-900">
            {step === 'select' ? 'เลือกแผนเส้นทางเพื่อจัดการค่าขนส่ง' : `แก้ไขค่าขนส่ง: ${selectedPlan?.plan_name || selectedPlan?.plan_code}`}
          </h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'select' && (
            <div>
              {loading && <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>}
              {error && <div className="text-center py-8 text-red-500">{error}</div>}
              {!loading && !error && plans.length === 0 && (
                <div className="text-center py-8 text-gray-500">ไม่พบแผนเส้นทางที่เผยแพร่แล้ว</div>
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
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase border-b">จำนวนเที่ยว</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase border-b">ระยะทาง (km)</th>
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
                          <td className="px-4 py-3 text-center">{plan.total_trips || plan.trips?.length || 0}</td>
                          <td className="px-4 py-3 text-center">{plan.total_distance_km ? plan.total_distance_km.toFixed(1) : '-'}</td>
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

          {step === 'edit' && selectedPlan && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <button
                  onClick={handleBack}
                  className="text-blue-600 hover:text-blue-700 text-sm font-thai"
                >
                  ← กลับไปเลือกแผนอื่น
                </button>
                <div className="text-sm text-gray-600 font-thai">
                  จำนวนเที่ยวทั้งหมด: <span className="font-bold">{selectedPlan.trips?.length || 0}</span> เที่ยว
                </div>
              </div>

              {selectedPlan.trips && selectedPlan.trips.length > 0 ? (
                <div className="space-y-4">
                  {selectedPlan.trips.map((trip, index) => (
                    <TripEditForm 
                      key={trip.trip_id} 
                      trip={trip} 
                      tripIndex={index}
                      suppliers={suppliers}
                      onDataChange={handleTripDataChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">ไม่พบข้อมูลเที่ยว</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600 font-thai">
            {step === 'edit' && Object.keys(tripsFormData).length > 0 && (
              <span>📝 มีการแก้ไข {Object.keys(tripsFormData).length} เที่ยว</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-thai"
            >
              ปิด
            </button>
            {step === 'edit' && selectedPlan && (
              <button
                onClick={handleSaveAll}
                disabled={savingAll || Object.keys(tripsFormData).length === 0}
                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-400 font-thai font-semibold"
              >
                {savingAll ? '⏳ กำลังบันทึก...' : '💾 บันทึกทั้งหมด'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditShippingCostModal;
