'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Truck, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface RoutePlan {
  plan_id: number;
  plan_code: string;
  plan_name: string;
  plan_date: string;
  status: string;
}

interface Trip {
  trip_id: number;
  plan_id: number;
  supplier_id: string;
  supplier?: { supplier_name: string };
  daily_trip_number: number;
  vehicle_id?: string;
  driver_name?: string;
  shipping_cost: number;
  total_weight?: number;
}

interface CreateContractModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'plan' | 'supplier' | 'trips' | 'confirm';

export function CreateContractModal({ onClose, onSuccess }: CreateContractModalProps) {
  const [step, setStep] = useState<Step>('plan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [plans, setPlans] = useState<RoutePlan[]>([]);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);

  // Selection states
  const [selectedPlans, setSelectedPlans] = useState<Set<number>>(new Set());
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<RoutePlan[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [selectedTrips, setSelectedTrips] = useState<Set<number>>(new Set());

  // Fetch approved route plans
  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/route-plans?status=approved');
      const result = await response.json();
      if (result.data) {
        setPlans(result.data);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('ไม่สามารถโหลดข้อมูลแผนได้');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available trips when plans are selected
  useEffect(() => {
    if (selectedPlans.size > 0) {
      fetchAvailableTripsFromMultiplePlans(Array.from(selectedPlans));
    } else {
      setAvailableTrips([]);
    }
  }, [selectedPlans]);

  const fetchAvailableTripsFromMultiplePlans = async (planIds: number[]) => {
    setLoading(true);
    try {
      const allTrips: Trip[] = [];
      for (const planId of planIds) {
        const response = await fetch(`/api/transport-contracts/available-trips?plan_id=${planId}`);
        const result = await response.json();
        if (result.data) {
          allTrips.push(...result.data);
        }
      }
      setAvailableTrips(allTrips);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError('ไม่สามารถโหลดข้อมูลคันรถได้');
    } finally {
      setLoading(false);
    }
  };

  // Group trips by supplier
  const tripsBySupplier = availableTrips.reduce((acc, trip) => {
    const key = trip.supplier_id;
    if (!acc[key]) {
      acc[key] = {
        supplier_id: trip.supplier_id,
        supplier_name: trip.supplier?.supplier_name || trip.supplier_id,
        trips: [],
        total_cost: 0
      };
    }
    acc[key].trips.push(trip);
    acc[key].total_cost += Number(trip.shipping_cost || 0);
    return acc;
  }, {} as Record<string, { supplier_id: string; supplier_name: string; trips: Trip[]; total_cost: number }>);

  const suppliers = Object.values(tripsBySupplier);

  // Filter trips by selected supplier
  const filteredTrips = selectedSupplier
    ? availableTrips.filter(t => t.supplier_id === selectedSupplier)
    : [];

  // Toggle trip selection
  const toggleTripSelection = (tripId: number) => {
    const newSelected = new Set(selectedTrips);
    if (newSelected.has(tripId)) {
      newSelected.delete(tripId);
    } else {
      newSelected.add(tripId);
    }
    setSelectedTrips(newSelected);
  };

  // Select all trips for a supplier
  const selectAllTrips = () => {
    const tripIds = filteredTrips.map(t => t.trip_id);
    setSelectedTrips(new Set(tripIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTrips(new Set());
  };

  // Calculate totals
  const selectedTripsData = availableTrips.filter(t => selectedTrips.has(t.trip_id));
  const totalCost = selectedTripsData.reduce((sum, t) => sum + Number(t.shipping_cost || 0), 0);

  // Toggle plan selection
  const togglePlanSelection = (plan: RoutePlan) => {
    const newSelected = new Set(selectedPlans);
    const newDetails = [...selectedPlanDetails];

    if (newSelected.has(plan.plan_id)) {
      newSelected.delete(plan.plan_id);
      const idx = newDetails.findIndex(p => p.plan_id === plan.plan_id);
      if (idx > -1) newDetails.splice(idx, 1);
    } else {
      newSelected.add(plan.plan_id);
      newDetails.push(plan);
    }

    setSelectedPlans(newSelected);
    setSelectedPlanDetails(newDetails);
    setSelectedSupplier(null);
    setSelectedTrips(new Set());
  };

  // Select all plans
  const selectAllPlans = () => {
    const allPlanIds = plans.map(p => p.plan_id);
    setSelectedPlans(new Set(allPlanIds));
    setSelectedPlanDetails([...plans]);
    setSelectedSupplier(null);
    setSelectedTrips(new Set());
  };

  // Clear plan selection
  const clearPlanSelection = () => {
    setSelectedPlans(new Set());
    setSelectedPlanDetails([]);
    setSelectedSupplier(null);
    setSelectedTrips(new Set());
  };

  // Handle create contract
  const handleCreate = async () => {
    if (selectedPlans.size === 0 || !selectedSupplier || selectedTrips.size === 0) return;

    setLoading(true);
    setError(null);

    try {
      const planIds = selectedPlanDetails.map(p => p.plan_id);
      const planCodes = selectedPlanDetails.map(p => p.plan_code);

      const response = await fetch('/api/transport-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_multi_plan: selectedPlans.size > 1,
          plan_ids: planIds,
          plan_codes: planCodes,
          trip_ids: Array.from(selectedTrips),
          supplier_id: selectedSupplier,
          supplier_name: suppliers.find(s => s.supplier_id === selectedSupplier)?.supplier_name,
          contract_date: new Date().toISOString().split('T')[0],
          total_trips: selectedTrips.size,
          total_cost: totalCost
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'สร้างใบว่าจ้างไม่สำเร็จ');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating contract:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการสร้างใบว่าจ้าง');
    } finally {
      setLoading(false);
    }
  };

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 'plan': return selectedPlans.size > 0;
      case 'supplier': return selectedSupplier !== null;
      case 'trips': return selectedTrips.size > 0;
      default: return true;
    }
  };

  const nextStep = () => {
    if (step === 'plan' && selectedPlans.size > 0) setStep('supplier');
    else if (step === 'supplier' && selectedSupplier) setStep('trips');
    else if (step === 'trips' && selectedTrips.size > 0) setStep('confirm');
  };

  const prevStep = () => {
    if (step === 'supplier') setStep('plan');
    else if (step === 'trips') setStep('supplier');
    else if (step === 'confirm') setStep('trips');
  };

  // Step indicator
  const steps = [
    { key: 'plan', label: 'เลือกแผน', icon: MapPin },
    { key: 'supplier', label: 'เลือกบริษัท', icon: Truck },
    { key: 'trips', label: 'เลือกคัน', icon: Check },
    { key: 'confirm', label: 'ยืนยัน', icon: Check }
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title="สร้างใบว่าจ้างขนส่งใหม่" size="xl">
      <div className="p-4">
        {/* Step Indicator */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.key;
            const isPast = steps.findIndex(x => x.key === step) > idx;
            return (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  isActive ? 'bg-primary-100 text-primary-700 font-medium' :
                  isPast ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[280px]">
          {/* Step 1: เลือก Route Plan - ตาราง */}
          {step === 'plan' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-700">
                  เลือก Route Plan ({selectedPlans.size} / {plans.length})
                </h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={selectAllPlans} className="text-xs px-2 py-0.5">
                    เลือกทั้งหมด
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearPlanSelection} className="text-xs px-2 py-0.5">
                    ล้าง
                  </Button>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">ไม่พบแผนที่อนุมัติแล้ว</p>
                  <p className="text-xs text-gray-400 mt-1">กรุณาอนุมัติแผนในหน้าจัดเส้นทางก่อน</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left w-8">
                          <input
                            type="checkbox"
                            checked={selectedPlans.size === plans.length && plans.length > 0}
                            onChange={(e) => e.target.checked ? selectAllPlans() : clearPlanSelection()}
                            className="rounded border-gray-300 w-3.5 h-3.5"
                          />
                        </th>
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">รหัสแผน</th>
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">ชื่อแผน</th>
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">วันที่</th>
                        <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plans.map(plan => (
                        <tr
                          key={plan.plan_id}
                          className={`cursor-pointer ${selectedPlans.has(plan.plan_id) ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                          onClick={() => togglePlanSelection(plan)}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selectedPlans.has(plan.plan_id)}
                              onChange={() => togglePlanSelection(plan)}
                              className="rounded border-gray-300 w-3.5 h-3.5"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-2 py-1.5 font-medium text-gray-900">{plan.plan_code}</td>
                          <td className="px-2 py-1.5 text-gray-600">{plan.plan_name}</td>
                          <td className="px-2 py-1.5 text-gray-500">
                            {new Date(plan.plan_date).toLocaleDateString('th-TH')}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Badge variant="success" size="sm">อนุมัติ</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 2: เลือกบริษัทขนส่ง - ตาราง */}
          {step === 'supplier' && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-700">เลือกบริษัทขนส่ง</h3>
              {suppliers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">ไม่พบคันรถที่ว่าง</p>
                  <p className="text-xs text-gray-400 mt-1">คันรถทั้งหมดอยู่ในใบว่าจ้างอื่นแล้ว</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left w-8"></th>
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">บริษัทขนส่ง</th>
                        <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700">จำนวนคัน</th>
                        <th className="px-2 py-1.5 text-right text-[11px] font-semibold text-gray-700">ค่าขนส่งรวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {suppliers.map(supplier => (
                        <tr
                          key={supplier.supplier_id}
                          className={`cursor-pointer ${selectedSupplier === supplier.supplier_id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                          onClick={() => {
                            setSelectedSupplier(supplier.supplier_id);
                            setSelectedTrips(new Set());
                          }}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="radio"
                              name="supplier"
                              checked={selectedSupplier === supplier.supplier_id}
                              onChange={() => {
                                setSelectedSupplier(supplier.supplier_id);
                                setSelectedTrips(new Set());
                              }}
                              className="border-gray-300 w-3.5 h-3.5 text-primary-600"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-medium text-gray-900">{supplier.supplier_name}</td>
                          <td className="px-2 py-1.5 text-center text-gray-700">{supplier.trips.length} คัน</td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{supplier.total_cost.toLocaleString('th-TH')} บาท</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3: เลือกคัน - ตาราง */}
          {step === 'trips' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-gray-700">
                  เลือกคันรถ ({selectedTrips.size} / {filteredTrips.length})
                </h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={selectAllTrips} className="text-xs px-2 py-0.5">
                    เลือกทั้งหมด
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection} className="text-xs px-2 py-0.5">
                    ล้าง
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-8">
                        <input
                          type="checkbox"
                          checked={selectedTrips.size === filteredTrips.length && filteredTrips.length > 0}
                          onChange={(e) => e.target.checked ? selectAllTrips() : clearSelection()}
                          className="rounded border-gray-300 w-3.5 h-3.5"
                        />
                      </th>
                      <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">RP</th>
                      <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700">คันที่</th>
                      <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">ทะเบียน</th>
                      <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700">คนขับ</th>
                      <th className="px-2 py-1.5 text-right text-[11px] font-semibold text-gray-700">ค่าขนส่ง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTrips.map(trip => (
                      <tr
                        key={trip.trip_id}
                        className={`cursor-pointer ${selectedTrips.has(trip.trip_id) ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleTripSelection(trip.trip_id)}
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={selectedTrips.has(trip.trip_id)}
                            onChange={() => toggleTripSelection(trip.trip_id)}
                            className="rounded border-gray-300 w-3.5 h-3.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-gray-500">
                          {plans.find(p => p.plan_id === trip.plan_id)?.plan_code || trip.plan_id}
                        </td>
                        <td className="px-2 py-1.5 text-center font-medium">{trip.daily_trip_number}</td>
                        <td className="px-2 py-1.5 text-gray-900">{trip.vehicle_id || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-600">{trip.driver_name || '-'}</td>
                        <td className="px-2 py-1.5 text-right">
                          {Number(trip.shipping_cost || 0).toLocaleString('th-TH')} บาท
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right text-xs text-gray-600">
                ค่าขนส่งรวม: <span className="font-medium text-gray-900">{totalCost.toLocaleString('th-TH')} บาท</span>
              </div>
            </div>
          )}

          {/* Step 4: ยืนยัน */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-700">ยืนยันการสร้างใบว่าจ้าง</h3>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Route Plans:</span>
                  <span className="font-medium text-right">
                    {selectedPlanDetails.map(p => p.plan_code).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">บริษัทขนส่ง:</span>
                  <span className="font-medium">
                    {suppliers.find(s => s.supplier_id === selectedSupplier)?.supplier_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">จำนวนคัน:</span>
                  <span className="font-medium">{selectedTrips.size} คัน</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">ค่าขนส่งรวม:</span>
                  <span className="text-sm font-bold text-primary-600">{totalCost.toLocaleString('th-TH')} บาท</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                <p className="text-xs text-yellow-800">
                  คันที่เลือกจะไม่สามารถใช้ในใบว่าจ้างอื่นได้จนกว่าจะลบใบว่าจ้างนี้
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between mt-4 pt-3 border-t">
          <Button
            variant="secondary"
            size="sm"
            onClick={step === 'plan' ? onClose : prevStep}
            icon={step === 'plan' ? undefined : ChevronLeft}
          >
            {step === 'plan' ? 'ยกเลิก' : 'ย้อนกลับ'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={step === 'confirm' ? handleCreate : nextStep}
            disabled={!canProceed() || loading}
            icon={step === 'confirm' ? Check : ChevronRight}
            loading={loading}
          >
            {step === 'confirm' ? 'สร้างใบว่าจ้าง' : 'ถัดไป'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
