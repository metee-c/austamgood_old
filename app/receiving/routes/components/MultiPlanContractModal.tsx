'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Printer, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatDateThai, formatWeight, formatCurrency } from '../utils';
import { handleApiError, getErrorMessage, ApiError } from '../utils/errorHandler';

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
  };
  stops?: any[];
}

interface Supplier {
  supplier_id: string;
  supplier_name: string;
  supplier_type?: string;
}

interface Summary {
  total_trips: number;
  total_stops: number;
  total_weight_kg: number;
  total_shipping_cost: number;
  plans_count: number;
}

interface MultiPlanContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateContract: (selectedTrips: Trip[]) => void;
  onExportExcel?: (selectedTrips: Trip[], includePrice: boolean) => void;
}

export function MultiPlanContractModal({
  isOpen,
  onClose,
  onGenerateContract,
  onExportExcel
}: MultiPlanContractModalProps) {
  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<Summary | null>(null);
  
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Set default date range (last 7 days to today)
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(lastWeek.toISOString().split('T')[0]);
      
      fetchSuppliers();
    }
  }, [isOpen]);

  // Fetch suppliers (service_provider type for transport)
  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    setError(null);
    
    try {
      const response = await fetch('/api/master-supplier?type=service_provider');
      
      if (!response.ok) {
        throw { response: { data: await response.json() } };
      }
      
      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Fetch trips by supplier
  const fetchTrips = useCallback(async () => {
    if (!selectedSupplierId) return;
    
    setLoadingTrips(true);
    setError(null);
    setTrips([]);
    setSelectedTripIds(new Set());
    
    try {
      const params = new URLSearchParams({
        supplier_id: selectedSupplierId,
      });
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const response = await fetch(`/api/route-plans/trips-by-supplier?${params}`);
      
      if (!response.ok) {
        throw { response: { data: await response.json() } };
      }
      
      const result = await response.json();
      setTrips(result.data || []);
      setSummary(result.summary || null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingTrips(false);
    }
  }, [selectedSupplierId, startDate, endDate]);

  // Handle search
  const handleSearch = () => {
    if (!selectedSupplierId) {
      setError({ message: 'กรุณาเลือกขนส่งก่อน', code: 'VALIDATION' });
      return;
    }
    fetchTrips();
  };

  // Toggle trip selection
  const handleToggleTrip = (tripId: number) => {
    setSelectedTripIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  // Select all / Deselect all
  const handleSelectAll = () => {
    if (selectedTripIds.size === trips.length) {
      setSelectedTripIds(new Set());
    } else {
      setSelectedTripIds(new Set(trips.map(t => t.trip_id)));
    }
  };

  // Get selected trips
  const getSelectedTrips = (): Trip[] => {
    return trips.filter(t => selectedTripIds.has(t.trip_id));
  };

  // Calculate selected summary
  const getSelectedSummary = () => {
    const selected = getSelectedTrips();
    return {
      count: selected.length,
      stops: selected.reduce((sum, t) => sum + (t.total_stops || 0), 0),
      weight: selected.reduce((sum, t) => sum + (t.total_weight_kg || 0), 0),
      cost: selected.reduce((sum, t) => sum + (t.shipping_cost || 0), 0),
    };
  };

  // Handle generate contract
  const handleGenerateContract = () => {
    const selectedTrips = getSelectedTrips();
    if (selectedTrips.length === 0) {
      setError({ message: 'กรุณาเลือกอย่างน้อย 1 คัน', code: 'VALIDATION' });
      return;
    }
    onGenerateContract(selectedTrips);
  };

  // Handle export
  const handleExport = (includePrice: boolean) => {
    const selectedTrips = getSelectedTrips();
    if (selectedTrips.length === 0) {
      setError({ message: 'กรุณาเลือกอย่างน้อย 1 คัน', code: 'VALIDATION' });
      return;
    }
    onExportExcel?.(selectedTrips, includePrice);
  };

  // Reset state when closing
  const handleClose = () => {
    setSelectedSupplierId('');
    setTrips([]);
    setSelectedTripIds(new Set());
    setSummary(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const selectedSummary = getSelectedSummary();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">รวมใบว่าจ้างข้ามแผน</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="ml-3 flex-1">
                <p className="text-sm text-red-700">{getErrorMessage(error)}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
            {/* Supplier Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ขนส่ง <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loadingSuppliers}
              >
                <option value="">-- เลือกขนส่ง --</option>
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จากวันที่
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={!selectedSupplierId || loadingTrips}
                icon={loadingTrips ? Loader2 : Search}
                loading={loadingTrips}
                className="w-full"
              >
                {loadingTrips ? 'กำลังค้นหา...' : 'ค้นหา'}
              </Button>
            </div>
          </div>

          {/* Summary */}
          {summary && trips.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{summary.total_trips}</p>
                <p className="text-sm text-blue-600">คันทั้งหมด</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{summary.total_stops}</p>
                <p className="text-sm text-green-600">จุดส่งทั้งหมด</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">{formatWeight(summary.total_weight_kg)}</p>
                <p className="text-sm text-orange-600">น้ำหนักรวม</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary.total_shipping_cost)}</p>
                <p className="text-sm text-purple-600">ค่าขนส่งรวม</p>
              </div>
            </div>
          )}

          {/* Trip List */}
          {trips.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTripIds.size === trips.length && trips.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">แผน</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">วันที่</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">คัน</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">จุดส่ง</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">น้ำหนัก (กก.)</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">ค่าขนส่ง</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trips.map(trip => (
                    <tr
                      key={trip.trip_id}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedTripIds.has(trip.trip_id) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleToggleTrip(trip.trip_id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTripIds.has(trip.trip_id)}
                          onChange={() => handleToggleTrip(trip.trip_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">{trip.plan?.plan_code}</td>
                      <td className="px-4 py-3 text-sm">
                        {trip.plan?.plan_date ? formatDateThai(trip.plan.plan_date) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium">
                        {trip.daily_trip_number || trip.trip_sequence}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{trip.total_stops}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {trip.total_weight_kg?.toFixed(0) || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {trip.shipping_cost ? formatCurrency(trip.shipping_cost) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          trip.plan?.status === 'published' ? 'bg-green-100 text-green-700' :
                          trip.plan?.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                          trip.plan?.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {trip.plan?.status || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loadingTrips && trips.length === 0 && selectedSupplierId && (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>ไม่พบข้อมูลเที่ยวรถที่ตรงเงื่อนไข</p>
              <p className="text-sm">กรุณาเลือกขนส่งหรือเปลี่ยนช่วงวันที่แล้วกดค้นหา</p>
            </div>
          )}

          {/* Initial State */}
          {!selectedSupplierId && trips.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Printer className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>เลือกขนส่งและกดค้นหาเพื่อดูรายการเที่ยวรถ</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          {/* Selected Summary */}
          {selectedTripIds.size > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Check className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-800">
                    เลือก {selectedSummary.count} คัน
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-blue-600">
                  <span>{selectedSummary.stops} จุดส่ง</span>
                  <span>{formatWeight(selectedSummary.weight)}</span>
                  <span className="font-medium">{formatCurrency(selectedSummary.cost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              {onExportExcel && (
                <>
                  <Button
                    variant="outline"
                    icon={FileSpreadsheet}
                    onClick={() => handleExport(true)}
                    disabled={selectedTripIds.size === 0}
                  >
                    Export (มีราคา)
                  </Button>
                  <Button
                    variant="outline"
                    icon={FileSpreadsheet}
                    onClick={() => handleExport(false)}
                    disabled={selectedTripIds.size === 0}
                  >
                    Export (ไม่มีราคา)
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                ยกเลิก
              </Button>
              <Button
                icon={Printer}
                onClick={handleGenerateContract}
                disabled={selectedTripIds.size === 0}
              >
                สร้างใบว่าจ้าง ({selectedTripIds.size} คัน)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
