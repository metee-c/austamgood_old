'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';

interface OrderDetail {
  order_id: number;
  order_no: string;
  customer_id: string;
  stop_name: string;
  shop_name?: string;
  province?: string;
  total_qty: number;
  weight?: number;
  allocated_weight_kg?: number;
  total_order_weight_kg?: number;
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
  // Fields for shipping cost reset warning
  needs_shipping_cost_update?: boolean;
  shipping_cost_reset_reason?: string;
  shipping_cost_reset_at?: string;
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
  vehicle_id?: number | null;
  driver_id?: number | null;
  base_price: number;
  helper_fee: number;
  extra_stop_fee: number;
  porterage_fee: number;
  other_fees: Array<{ label: string; amount: number }>;
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

interface Customer {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  province?: string;
}

interface Vehicle {
  vehicle_id: number;
  vehicle_code: string;
  plate_number: string;
  driver_id?: number;
  driver_name?: string;
  supplier_id?: string;
}

const TripEditForm: React.FC<TripEditFormProps> = ({ trip, tripIndex, suppliers, onDataChange }) => {
  // State for customer data mapping
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // State for vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  
  // State for drivers (employees)
  const [drivers, setDrivers] = useState<Array<{employee_id: number; first_name: string; last_name: string}>>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

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

  // Fetch customer data when component mounts
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await fetch('/api/master-customer');
        const customers = await res.json();

        if (customers && Array.isArray(customers)) {
          // Create a map of customer_id to customer data
          const map: Record<string, Customer> = {};
          customers.forEach((customer: Customer) => {
            map[customer.customer_id] = customer;
          });
          setCustomerMap(map);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

  // Fetch drivers (employees with driver position) when component mounts
  useEffect(() => {
    const fetchDrivers = async () => {
      setLoadingDrivers(true);
      try {
        const res = await fetch('/api/employees');
        const employees = await res.json();

        if (employees && Array.isArray(employees)) {
          // Filter only drivers
          const driverList = employees.filter((emp: any) => 
            emp.position?.includes('ขับ') || emp.position?.toLowerCase().includes('driver')
          );
          setDrivers(driverList);
        }
      } catch (err) {
        console.error('Error fetching drivers:', err);
      } finally {
        setLoadingDrivers(false);
      }
    };

    fetchDrivers();
  }, []);

  // Initialize pricing mode from trip data
  // Default to 'formula' (แบบคำนวณ) for trips without saved pricing mode
  const [pricingMode, setPricingMode] = useState<'formula' | 'flat'>(
    (trip as any).pricing_mode === 'flat' ? 'flat' : 'formula'
  );

  const [formData, setFormData] = useState({
    shipping_cost: trip.shipping_cost || 0,
    vehicle_label: parsedNotes.vehicle_label,
    driver_label: parsedNotes.driver_label,
    vehicle_id: trip.vehicle_id || null,
    driver_id: trip.driver_id || null,
    supplier_id: (trip as any).supplier_id || '',
    base_price: (trip as any).base_price || 0,
    helper_fee: (trip as any).helper_fee || 0,
    extra_stop_fee: (trip as any).extra_stop_fee || 100,
    porterage_fee: (trip as any).porterage_fee || 0
  });

  // State for other fees (custom fees that user can add)
  const [otherFees, setOtherFees] = useState<Array<{ label: string; amount: number }>>(
    (trip as any).other_fees || []
  );

  // State for order-specific remarks
  const [orderRemarks, setOrderRemarks] = useState<Record<number, string>>(parsedNotes.order_remarks);

  // State for saving to master
  const [savingToMaster, setSavingToMaster] = useState(false);

  // State for reference province (จุดอ้างอิงราคา)
  const [referenceProvinceIndex, setReferenceProvinceIndex] = useState<number | null>(null);
  const [loadingRateFromMaster, setLoadingRateFromMaster] = useState(false);

  // Fetch vehicles when supplier changes
  useEffect(() => {
    const fetchVehicles = async () => {
      if (!formData.supplier_id) {
        setVehicles([]);
        return;
      }

      setLoadingVehicles(true);
      try {
        const res = await fetch(`/api/master-vehicle?supplier_id=${formData.supplier_id}`);
        const { data, error } = await res.json();

        if (!error && data) {
          setVehicles(data);
        } else {
          setVehicles([]);
        }
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        setVehicles([]);
      } finally {
        setLoadingVehicles(false);
      }
    };

    fetchVehicles();
  }, [formData.supplier_id]);

  // Notify parent when formData changes
  useEffect(() => {
    onDataChange(trip.trip_id, {
      pricingMode,
      ...formData,
      other_fees: otherFees,
      orderRemarks
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, pricingMode, otherFees, orderRemarks, trip.trip_id]);

  const handleChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Notify parent of changes
    onDataChange(trip.trip_id, {
      pricingMode,
      ...newFormData,
      other_fees: otherFees,
      orderRemarks
    });
  };

  // Calculate shipping cost based on formula
  const calculateShippingCost = () => {
    if (pricingMode === 'flat') {
      return formData.shipping_cost;
    }

    // Formula mode: base_price + helper_fee + (extra stops × extra_stop_fee) + porterage_fee + other_fees
    const extraStops = Math.max(0, totalStops - 1);
    const otherFeesTotal = otherFees.reduce((sum, fee) => sum + fee.amount, 0);
    const calculated = formData.base_price + formData.helper_fee + (extraStops * formData.extra_stop_fee) + formData.porterage_fee + otherFeesTotal;
    return calculated;
  };

  const handleOrderRemarkChange = (orderId: number, value: string) => {
    const newRemarks = { ...orderRemarks, [orderId]: value };
    setOrderRemarks(newRemarks);

    // Notify parent of changes
    onDataChange(trip.trip_id, {
      pricingMode,
      ...formData,
      other_fees: otherFees,
      orderRemarks: newRemarks
    });
  };

  const handlePricingModeChange = (mode: 'formula' | 'flat') => {
    setPricingMode(mode);

    // Notify parent of changes
    onDataChange(trip.trip_id, {
      pricingMode: mode,
      ...formData,
      other_fees: otherFees,
      orderRemarks
    });
  };

  // Collect all orders from all stops
  const allOrders = trip.stops?.flatMap(stop => stop.orders || []) || [];

  // Function to load rate from master based on selected province
  const handleLoadRateFromMaster = async (province: string) => {
    if (!formData.supplier_id) {
      alert('กรุณาเลือกผู้ให้บริการขนส่งก่อน');
      return;
    }

    setLoadingRateFromMaster(true);
    try {
      const res = await fetch(`/api/freight-rates/by-province?province=${encodeURIComponent(province)}&supplier_id=${formData.supplier_id}`);
      const { data, error } = await res.json();

      if (error || !data) {
        alert(`ไม่พบราคามาสเตอร์สำหรับจังหวัด "${province}"\nกรุณากรอกราคาด้วยตนเอง`);
        return;
      }

      // Apply rate to form
      // **สำคัญ:** ใช้โหมด formula เสมอ สำหรับการกรอกค่าขนส่งในหน้านี้
      // (ไม่ว่ามาสเตอร์จะเป็นโหมด formula หรือ flat ก็ตาม)
      setPricingMode('formula');
      setFormData(prev => ({
        ...prev,
        base_price: data.base_price || 0,
        helper_fee: data.helper_price || 0,
        extra_stop_fee: data.extra_drop_price || 100,
        porterage_fee: data.porterage_fee || 0
      }));

      alert(`โหลดราคาจากมาสเตอร์สำเร็จ!\nเส้นทาง: ${data.route_name}`);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setLoadingRateFromMaster(false);
    }
  };

  // Calculate totals
  // จำนวนจุดส่ง = จำนวนรหัสลูกค้าที่ไม่ซ้ำกัน (1 จุด = 1 customer_id)
  const uniqueCustomerIds = new Set(allOrders.map(order => order.customer_id));
  const totalStops = uniqueCustomerIds.size;
  const totalUnits = allOrders.reduce((sum, order) => sum + order.total_qty, 0);
  const totalWeight = trip.total_weight_kg || allOrders.reduce((sum, order) => sum + (order.allocated_weight_kg || order.weight || 0), 0);
  const distance = trip.total_distance_km || 0;
  
  // Calculate capacity percentage (assuming 2200kg default capacity)
  const vehicleCapacity = 2200; // Default capacity, can be made configurable
  const capacityPercent = vehicleCapacity > 0 ? (totalWeight / vehicleCapacity * 100) : 0;

  // Handler to save shipping cost to master freight rate
  const handleSaveToMaster = async () => {
    console.log('[Save to Master] Starting...', {
      supplier_id: formData.supplier_id,
      shipping_cost: formData.shipping_cost,
      pricingMode
    });

    if (!formData.supplier_id) {
      alert('กรุณาเลือกผู้ให้บริการขนส่งก่อน');
      return;
    }

    if (pricingMode === 'flat' && formData.shipping_cost <= 0) {
      alert('กรุณากรอกค่าขนส่งเหมาก่อน');
      return;
    }

    // Get provinces from trip stops
    const provinces = trip.stops?.map(stop => {
      // Extract province from stop name (assuming format: "ชื่อ - จังหวัด" or similar)
      const parts = stop.stop_name.split(/[-,]/);
      return parts.length > 1 ? parts[parts.length - 1].trim() : stop.stop_name;
    }) || [];

    const uniqueProvinces = [...new Set(provinces)];
    const originProvince = uniqueProvinces[0] || 'ไม่ระบุ';
    const destinationProvince = uniqueProvinces.length > 1 ? uniqueProvinces[uniqueProvinces.length - 1] : originProvince;

    const routeName = `${originProvince} - ${destinationProvince} (เที่ยวที่ ${trip.trip_sequence})`;

    const confirmMessage = `
บันทึกค่าขนส่งนี้เข้าฐานข้อมูลมาสเตอร์

ผู้ให้บริการ: ${suppliers.find(s => s.supplier_id === formData.supplier_id)?.supplier_name || '-'}
เส้นทาง: ${routeName}
ค่าขนส่ง: ${formData.shipping_cost.toLocaleString()} บาท
ค่าแบกน้ำหนัก: ${formData.porterage_fee.toLocaleString()} บาท
${otherFees.length > 0 ? `ค่าอื่นๆ: ${otherFees.length} รายการ\n` : ''}
ระยะทาง: ${distance.toFixed(1)} กม.

ยืนยันการบันทึก?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setSavingToMaster(true);

    try {
      const payload = {
        carrier_id: formData.supplier_id,
        supplier_id: formData.supplier_id,
        route_name: routeName,
        origin_province: originProvince,
        destination_province: destinationProvince,
        total_distance_km: distance,
        pricing_mode: pricingMode,
        shipping_cost: formData.shipping_cost,
        base_price: pricingMode === 'formula' ? formData.base_price : formData.shipping_cost,
        extra_drop_price: pricingMode === 'formula' ? formData.extra_stop_fee : null,
        extra_stop_fee: pricingMode === 'formula' ? formData.extra_stop_fee : null,
        helper_price: pricingMode === 'formula' ? formData.helper_fee : null,
        helper_fee: pricingMode === 'formula' ? formData.helper_fee : null,
        porterage_fee: formData.porterage_fee,
        other_fees: otherFees,
        price_unit: 'trip',
        effective_start_date: new Date().toISOString().split('T')[0],
        notes: `บันทึกจากแผนเส้นทาง - เที่ยวที่ ${trip.trip_sequence}\nทะเบียนรถ: ${formData.vehicle_label}\nผู้ขับ: ${formData.driver_label}`
      };

      console.log('[Save to Master] Payload:', payload);

      const res = await fetch('/api/freight-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      console.log('[Save to Master] Response status:', res.status);

      const result = await res.json();
      console.log('[Save to Master] Response data:', result);

      if (result.error || !res.ok) {
        alert(`เกิดข้อผิดพลาด: ${result.error || 'Unknown error'}`);
      } else {
        alert(`บันทึกเข้ามาสเตอร์สำเร็จ!\n\nสามารถดูได้ที่: หน้าจัดการข้อมูลมาสเตอร์ > ค่าขนส่ง`);
      }
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setSavingToMaster(false);
    }
  };

  return (
    <div className={`border-2 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
      trip.needs_shipping_cost_update 
        ? 'border-orange-400 bg-orange-50' 
        : 'border-gray-200 bg-white'
    }`}>
      {/* Warning Banner for Shipping Cost Reset */}
      {trip.needs_shipping_cost_update && (
        <div className="mb-4 p-3 bg-orange-100 border-2 border-orange-400 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-orange-600 text-xl">⚠️</span>
            <div>
              <p className="font-bold text-orange-800 font-thai text-sm">
                ต้องกรอกค่าขนส่งใหม่!
              </p>
              <p className="text-orange-700 font-thai text-xs mt-1">
                {trip.shipping_cost_reset_reason || 'ค่าขนส่งถูก reset เนื่องจากมีการ Rollback Order'}
              </p>
              {trip.shipping_cost_reset_at && (
                <p className="text-orange-600 font-thai text-xs mt-1">
                  Reset เมื่อ: {new Date(trip.shipping_cost_reset_at).toLocaleString('th-TH')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Card Header */}
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900 font-thai mb-3">
          เที่ยวที่ {trip.trip_sequence}
          {trip.needs_shipping_cost_update && (
            <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full font-thai">
              ต้องกรอกค่าขนส่ง
            </span>
          )}
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
        <div className="mb-4">
          {/* คำแนะนำ */}
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs font-thai">
            <span className="font-semibold text-blue-800">คำแนะนำ:</span>
            <span className="text-blue-700"> คลิกปุ่ม "เลือก" ที่จุดส่งที่ไกลที่สุด เพื่อดึงราคาเริ่มต้นจากมาสเตอร์อัตโนมัติ</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">ลำดับ</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">เลขที่ออเดอร์</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">รหัสลูกค้า</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">ชื่อร้าน</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai">จังหวัด</th>
                <th className="px-2 py-2 text-center font-semibold text-gray-700 border-b font-thai">จุดอ้างอิงราคา</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-700 border-b font-thai">รวมจำนวนชิ้น</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-700 border-b font-thai">น้ำหนัก (kg)</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700 border-b font-thai" style={{ minWidth: '200px' }}>หมายเหตุเพิ่มเติม</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allOrders.map((order, index) => {
                // Get province - prioritize order.province from database
                const getProvince = () => {
                  // Priority 1: Get from order data directly (from wms_orders.province)
                  if (order.province && order.province.trim() !== '') {
                    return order.province.trim();
                  }

                  // Priority 2: Try to get from customer map
                  const customer = customerMap[order.customer_id];
                  if (customer?.province && customer.province.trim() !== '') {
                    return customer.province.trim();
                  }

                  // Priority 3: Try to extract from stop_name first (more reliable than shop_name)
                  if (order.stop_name && order.stop_name.trim() !== '') {
                    const parts = order.stop_name.split(/[-,]/);
                    if (parts.length > 1) {
                      const lastPart = parts[parts.length - 1].trim();
                      // ตรวจสอบว่า lastPart ไม่ใช่ตัวเลข (เพราะอาจเป็นรหัสพื้นที่)
                      if (lastPart && lastPart !== '' && isNaN(Number(lastPart))) {
                        return lastPart;
                      }
                    }
                    // ถ้าไม่มี separator ลอง return ทั้งหมด (อาจเป็นชื่อจังหวัดเดียว)
                    const trimmed = order.stop_name.trim();
                    if (trimmed && isNaN(Number(trimmed))) {
                      return trimmed;
                    }
                  }

                  // Priority 4: Try to extract from shop_name (ชื่อร้าน - จังหวัด)
                  if (order.shop_name && order.shop_name.trim() !== '') {
                    const parts = order.shop_name.split(/[-,]/);
                    if (parts.length > 1) {
                      const lastPart = parts[parts.length - 1].trim();
                      if (lastPart && lastPart !== '' && isNaN(Number(lastPart))) {
                        return lastPart;
                      }
                    }
                  }

                  // Debug: log when province not found
                  console.warn('Province not found for order:', {
                    order_no: order.order_no,
                    customer_id: order.customer_id,
                    order_province: order.province,
                    customer_province: customer?.province,
                    shop_name: order.shop_name,
                    stop_name: order.stop_name
                  });

                  return '-';
                };

                const province = getProvince();
                const isReferencePoint = referenceProvinceIndex === index;

                return (
                  <tr key={order.order_id} className={`hover:bg-gray-50 ${isReferencePoint ? 'bg-yellow-50' : ''}`}>
                    <td className="px-2 py-2 text-gray-900">{index + 1}</td>
                    <td className="px-2 py-2 text-blue-600 font-mono">{order.order_no}</td>
                    <td className="px-2 py-2 text-gray-900 font-mono">{order.customer_id}</td>
                    <td className="px-2 py-2 text-gray-900 font-thai">{order.shop_name || order.stop_name || '-'}</td>
                    <td className="px-2 py-2 text-gray-900 font-thai font-semibold">{province}</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setReferenceProvinceIndex(index);
                          handleLoadRateFromMaster(province);
                        }}
                        disabled={loadingRateFromMaster || province === '-'}
                        className={`px-2 py-1 text-xs rounded font-thai transition-colors ${
                          isReferencePoint
                            ? 'bg-yellow-500 text-white font-semibold'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                        title={`ใช้จังหวัด "${province}" เป็นจุดอ้างอิงราคา`}
                      >
                        {isReferencePoint ? 'จุดอ้างอิง' : 'เลือก'}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900 font-mono">{order.total_qty || 0}</td>
                    <td className="px-2 py-2 text-right text-gray-900 font-mono">{(order.allocated_weight_kg || order.weight || 0).toFixed(1)}</td>
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
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={6} className="px-2 py-2 text-right font-semibold text-gray-900 font-thai">รวม:</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900 font-mono">{allOrders.reduce((sum, order) => sum + order.total_qty, 0)} ชิ้น</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900 font-mono">{allOrders.reduce((sum, order) => sum + (order.allocated_weight_kg || order.weight || 0), 0).toFixed(1)} kg</td>
                <td className="px-2 py-2"></td>
              </tr>
            </tfoot>
          </table>
          </div>
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
              value="formula"
              checked={pricingMode === 'formula'}
              onChange={() => handlePricingModeChange('formula')}
              className="mr-2"
            />
            <span className="text-sm font-thai">แบบคำนวณ (ราคาเริ่มต้น + ค่าเด็ก + ค่าจุดเพิ่ม)</span>
          </label>
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
        </div>
      </div>

      {/* Pricing Fields */}
      {pricingMode === 'flat' ? (
        <div className="space-y-3 mb-4 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
          {/* Main Price Fields - 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ผู้ให้บริการขนส่ง
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => handleChange('supplier_id', e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai bg-white"
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
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ค่าขนส่งเหมา (บาท) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.shipping_cost}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('shipping_cost', value);
                }}
                className="w-full px-2.5 py-2 text-sm border-2 border-yellow-400 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 font-semibold bg-yellow-50"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ค่าแบกน้ำหนัก (บาท)
              </label>
              <input
                type="number"
                value={formData.porterage_fee}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  handleChange('porterage_fee', value);
                }}
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="0"
                step="1"
              />
            </div>
          </div>

          {/* Vehicle & Driver - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ทะเบียนรถ
              </label>
              {!formData.supplier_id ? (
                <div className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 font-thai">
                  กรุณาเลือกผู้ให้บริการขนส่งก่อน
                </div>
              ) : loadingVehicles ? (
                <div className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 font-thai">
                  กำลังโหลดรถ...
                </div>
              ) : vehicles.length === 0 ? (
                <div className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-yellow-50 text-yellow-700 font-thai">
                  ไม่มีรถสำหรับผู้ให้บริการนี้
                </div>
              ) : (
                <select
                  value={formData.vehicle_id?.toString() || ''}
                  onChange={(e) => {
                    const vehicleId = e.target.value ? Number(e.target.value) : null;
                    const selectedVehicle = vehicles.find(v => v.vehicle_id === vehicleId);
                    
                    // Update all fields including driver_id
                    const newFormData = {
                      ...formData,
                      vehicle_id: vehicleId,
                      driver_id: selectedVehicle?.driver_id || null,
                      vehicle_label: selectedVehicle?.plate_number || '',
                      driver_label: selectedVehicle?.driver_name || ''
                    };
                    setFormData(newFormData);
                    
                    // Notify parent
                    onDataChange(trip.trip_id, {
                      pricingMode,
                      ...newFormData,
                      other_fees: otherFees,
                      orderRemarks
                    });
                  }}
                  className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai bg-white"
                >
                  <option value="">เลือกทะเบียนรถ</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      {vehicle.plate_number}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ชื่อผู้ขับ
              </label>
              <input
                type="text"
                value={formData.driver_label}
                readOnly
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-700 font-thai"
                placeholder="เลือกรถเพื่อแสดงชื่อผู้ขับ"
              />
            </div>
          </div>

          {/* Other Fees Section */}
          <div className="pt-2 border-t border-blue-200">
            <label className="block text-xs font-medium text-gray-700 mb-2 font-thai">
              ค่าใช้จ่ายอื่นๆ
            </label>

            {otherFees.map((fee, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={fee.label}
                  onChange={(e) => {
                    const newFees = [...otherFees];
                    newFees[index].label = e.target.value;
                    setOtherFees(newFees);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-thai bg-white"
                  placeholder="หัวข้อค่าใช้จ่าย เช่น ค่าทางด่วน"
                />
                <input
                  type="number"
                  value={fee.amount}
                  onChange={(e) => {
                    const newFees = [...otherFees];
                    newFees[index].amount = parseFloat(e.target.value) || 0;
                    setOtherFees(newFees);
                  }}
                  className="w-28 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="0"
                  step="1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newFees = otherFees.filter((_, i) => i !== index);
                    setOtherFees(newFees);
                  }}
                  className="px-2 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOtherFees([...otherFees, { label: '', amount: 0 }]);
                }}
                className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-thai text-xs"
              >
                + เพิ่มค่าใช้จ่ายอื่นๆ
              </button>

              <button
                type="button"
                onClick={handleSaveToMaster}
                disabled={savingToMaster || !formData.supplier_id || formData.shipping_cost <= 0}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded hover:from-purple-600 hover:to-purple-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-thai text-xs font-semibold shadow-sm"
              >
                {savingToMaster ? 'กำลังบันทึก...' : 'บันทึกเข้ามาสเตอร์'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 mb-4 bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
          {/* Supplier Selection - Full Width */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
              ผู้ให้บริการขนส่ง
            </label>
            <select
              value={formData.supplier_id}
              onChange={(e) => handleChange('supplier_id', e.target.value)}
              className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 font-thai bg-white"
            >
              <option value="">-- เลือกผู้ให้บริการ --</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.supplier_name} ({supplier.supplier_code})
                </option>
              ))}
            </select>
          </div>

          {/* Formula Fields - 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ราคาเริ่มต้น (บาท) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.base_price}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const value = inputValue === '' ? 0 : parseFloat(inputValue);
                  if (!isNaN(value)) {
                    setFormData(prev => ({
                      ...prev,
                      base_price: value,
                      shipping_cost: value + prev.helper_fee + (Math.max(0, totalStops - 1) * prev.extra_stop_fee)
                    }));
                  }
                }}
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                placeholder="1700"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-0.5">ตามจังหวัด</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ค่าเด็กติดรถ (บาท)
              </label>
              <input
                type="number"
                value={formData.helper_fee}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const value = inputValue === '' ? 0 : parseFloat(inputValue);
                  if (!isNaN(value)) {
                    setFormData(prev => ({
                      ...prev,
                      helper_fee: value,
                      shipping_cost: prev.base_price + value + (Math.max(0, totalStops - 1) * prev.extra_stop_fee)
                    }));
                  }
                }}
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                placeholder="500"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-0.5">ไม่มีใส่ 0</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ค่าจุดเพิ่ม (บาท/จุด)
              </label>
              <input
                type="number"
                value={formData.extra_stop_fee}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const value = inputValue === '' ? 0 : parseFloat(inputValue);
                  if (!isNaN(value)) {
                    setFormData(prev => ({
                      ...prev,
                      extra_stop_fee: value,
                      shipping_cost: prev.base_price + prev.helper_fee + (Math.max(0, totalStops - 1) * value)
                    }));
                  }
                }}
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                placeholder="100"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-0.5">จุดที่ 2 ขึ้นไป</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ค่าแบกน้ำหนัก (บาท)
              </label>
              <input
                type="number"
                value={formData.porterage_fee}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    handleChange('porterage_fee', value);
                  }
                }}
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                placeholder="0"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-0.5">ค่าแบกขน</p>
            </div>
          </div>

          {/* Other Fees Section */}
          <div className="pt-2 border-t border-green-200">
            <label className="block text-xs font-medium text-gray-700 mb-2 font-thai">
              ค่าใช้จ่ายอื่นๆ
            </label>

            {otherFees.map((fee, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={fee.label}
                  onChange={(e) => {
                    const newFees = [...otherFees];
                    newFees[index].label = e.target.value;
                    setOtherFees(newFees);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 font-thai bg-white"
                  placeholder="หัวข้อค่าใช้จ่าย เช่น ค่าทางด่วน"
                />
                <input
                  type="number"
                  value={fee.amount}
                  onChange={(e) => {
                    const newFees = [...otherFees];
                    newFees[index].amount = parseFloat(e.target.value) || 0;
                    setOtherFees(newFees);
                  }}
                  className="w-28 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  placeholder="0"
                  step="1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newFees = otherFees.filter((_, i) => i !== index);
                    setOtherFees(newFees);
                  }}
                  className="px-2 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOtherFees([...otherFees, { label: '', amount: 0 }]);
                }}
                className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors font-thai text-xs"
              >
                + เพิ่มค่าใช้จ่ายอื่นๆ
              </button>

              <button
                type="button"
                onClick={handleSaveToMaster}
                disabled={savingToMaster || !formData.supplier_id || formData.base_price <= 0}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded hover:from-purple-600 hover:to-purple-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-thai text-xs font-semibold shadow-sm"
              >
                {savingToMaster ? 'กำลังบันทึก...' : 'บันทึกเข้ามาสเตอร์'}
              </button>
            </div>
          </div>

          {/* Calculation Summary - Compact */}
          <div className="p-3 bg-white border-2 border-green-300 rounded-lg">
            <div className="text-xs font-thai space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">ราคาเริ่มต้น:</span>
                <span className="font-medium">{formData.base_price.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ค่าเด็กติดรถ:</span>
                <span className="font-medium">{formData.helper_fee.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ค่าจุดเพิ่ม ({Math.max(0, totalStops - 1)} จุด × {formData.extra_stop_fee} ฿):</span>
                <span className="font-medium">{(Math.max(0, totalStops - 1) * formData.extra_stop_fee).toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ค่าแบกน้ำหนัก:</span>
                <span className="font-medium">{formData.porterage_fee.toLocaleString()} ฿</span>
              </div>
              {otherFees.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">ค่าใช้จ่ายอื่นๆ:</span>
                  <span className="font-medium">{otherFees.reduce((sum, fee) => sum + fee.amount, 0).toLocaleString()} ฿</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 mt-1.5 border-t-2 border-green-300">
                <span className="text-gray-900 font-bold text-sm">รวมค่าขนส่ง:</span>
                <span className="text-green-700 font-bold text-base">{calculateShippingCost().toLocaleString()} ฿</span>
              </div>
            </div>
          </div>

          {/* Vehicle Info - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-green-200">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ทะเบียนรถ
              </label>
              {!formData.supplier_id ? (
                <div className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 font-thai">
                  กรุณาเลือกผู้ให้บริการขนส่งก่อน
                </div>
              ) : loadingVehicles ? (
                <div className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-500 font-thai">
                  กำลังโหลดรถ...
                </div>
              ) : vehicles.length === 0 ? (
                <div className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-yellow-50 text-yellow-700 font-thai">
                  ไม่มีรถสำหรับผู้ให้บริการนี้
                </div>
              ) : (
                <select
                  value={formData.vehicle_id?.toString() || ''}
                  onChange={(e) => {
                    const vehicleId = e.target.value ? Number(e.target.value) : null;
                    const selectedVehicle = vehicles.find(v => v.vehicle_id === vehicleId);
                    
                    // Update all fields including driver_id
                    const newFormData = {
                      ...formData,
                      vehicle_id: vehicleId,
                      driver_id: selectedVehicle?.driver_id || null,
                      vehicle_label: selectedVehicle?.plate_number || '',
                      driver_label: selectedVehicle?.driver_name || ''
                    };
                    setFormData(newFormData);
                    
                    // Notify parent
                    onDataChange(trip.trip_id, {
                      pricingMode,
                      ...newFormData,
                      other_fees: otherFees,
                      orderRemarks
                    });
                  }}
                  className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 font-thai bg-white"
                >
                  <option value="">เลือกทะเบียนรถ</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      {vehicle.plate_number}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                ชื่อผู้ขับ
              </label>
              <input
                type="text"
                value={formData.driver_label}
                readOnly
                className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded bg-gray-50 text-gray-700 font-thai"
                placeholder="เลือกรถเพื่อแสดงชื่อผู้ขับ"
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
      const { data, error } = await res.json();
      if (!error && data) {
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch plan details with trips
      const res = await fetch(`/api/route-plans/${plan.plan_id}/editor`);
      const { data, error } = await res.json();
      
      if (error) {
        setError(error);
        return;
      }
      
      // Set plan with trips data
      setSelectedPlan({
        ...plan,
        trips: data.trips || []
      });
      setStep('edit');
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลเที่ยว');
      console.error('Error fetching plan details:', err);
    } finally {
      setLoading(false);
    }
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
        // Default to 'formula' (แบบคำนวณ) for trips without saved pricing mode
        const pricingMode = tripData?.pricingMode || (trip as any).pricing_mode || 'formula';
        const basePrice = tripData?.base_price ?? (trip as any).base_price ?? 0;
        const helperFee = tripData?.helper_fee ?? (trip as any).helper_fee ?? 0;
        const extraStopFee = tripData?.extra_stop_fee ?? (trip as any).extra_stop_fee ?? 100;
        const porterage_fee = tripData?.porterage_fee ?? (trip as any).porterage_fee ?? 0;
        const other_fees = tripData?.other_fees ?? (trip as any).other_fees ?? [];
        const supplierId = tripData?.supplier_id || (trip as any).supplier_id || null;
        const vehicleId = tripData?.vehicle_id || trip.vehicle_id || null;
        const driverId = tripData?.driver_id || trip.driver_id || null;
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
          // จำนวนจุดส่ง = จำนวนรหัสลูกค้าที่ไม่ซ้ำกัน (1 จุด = 1 customer_id)
          const allOrdersForTrip = trip.stops?.flatMap(stop => stop.orders || []) || [];
          const uniqueCustomerIdsForTrip = new Set(allOrdersForTrip.map(order => order.customer_id));
          const totalStops = uniqueCustomerIdsForTrip.size;
          const payload: any = {
            notes: JSON.stringify(notesData),
            pricing_mode: pricingMode,
            supplier_id: supplierId,
            vehicle_id: vehicleId,
            driver_id: driverId,
            // Clear the shipping cost update flag when saving
            needs_shipping_cost_update: false,
            shipping_cost_reset_reason: null,
            shipping_cost_reset_at: null
          };

          // Add formula-specific fields if in formula mode
          if (pricingMode === 'formula') {
            payload.base_price = basePrice;
            payload.helper_fee = helperFee;
            payload.extra_stop_fee = extraStopFee;
            payload.porterage_fee = porterage_fee;
            payload.other_fees = other_fees;
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
        alert(`บันทึกสำเร็จทั้งหมด ${successCount} เที่ยว`);
        handleClose();
      } else if (successCount > 0) {
        alert(`บันทึกสำเร็จ ${successCount} เที่ยว\n\nข้อผิดพลาด:\n${errors.join('\n')}`);
      } else {
        alert(`เกิดข้อผิดพลาดทั้งหมด:\n${errors.join('\n')}`);
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
              <span>มีการแก้ไข {Object.keys(tripsFormData).length} เที่ยว</span>
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
                {savingAll ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditShippingCostModal;
