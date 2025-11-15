'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useId } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Layers,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Box,
  Package,
  Warehouse,
  Settings,
  Download,
  Upload
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ComboBox from '@/components/ui/ComboBox';
import ImportStorageStrategyForm from '@/components/forms/ImportStorageStrategyForm';

type StorageStrategyStatus = 'draft' | 'active' | 'inactive' | 'archived';
type StorageRotation = 'FIFO' | 'LIFO' | 'FEFO' | 'LEFO' | 'custom';

interface WarehouseOption {
  warehouse_id: string;
  warehouse_name: string;
}

interface StorageStrategyRecord {
  strategy_id: string;
  strategy_code: string;
  strategy_name: string;
  description: string | null;
  warehouse_id: string;
  default_zone: string | null;
  default_location_type: string | null;
  priority: number;
  status: StorageStrategyStatus;
  allow_auto_assign: boolean;
  putaway_rotation: StorageRotation | null;
  effective_from: string | null;
  effective_to: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  master_warehouse?: {
    warehouse_name: string | null;
  } | null;
}

interface StorageStrategyView extends StorageStrategyRecord {
  id: string;
  zone: string;
  location_type: string;
  is_active: boolean;
  warehouse?: {
    warehouse_name: string | null;
  } | null;
}

interface StrategyFormValues {
  strategy_code: string;
  strategy_name: string;
  description: string;
  warehouse_id: string;
  default_zone: string;
  default_location_type: string;
  priority: number;
  status: StorageStrategyStatus;
  allow_auto_assign: boolean;
  putaway_rotation: StorageRotation;
  effective_from: string;
  effective_to: string;
}

interface StrategyFormProps {
  initialValues: StrategyFormValues;
  warehouses: WarehouseOption[];
  availableZones: string[];
  locationTypes: Array<{ value: string; label: string }>;
  onSubmit: (values: StrategyFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
}

interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

type SortField =
  | 'strategy_code'
  | 'strategy_name'
  | 'description'
  | 'default_zone'
  | 'default_location_type'
  | 'priority'
  | 'status';

const LOCATION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'ไม่ระบุ' },
  { value: 'rack', label: 'ชั้นวาง (Rack)' },
  { value: 'floor', label: 'กองพื้น (Floor)' },
  { value: 'bulk', label: 'พื้นที่รวม (Bulk)' },
  { value: 'storage', label: 'Storage' },
  { value: 'receiving', label: 'Receiving' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'staging', label: 'Staging' },
  { value: 'apf_zone', label: 'APF Zone' },
  { value: 'pf_zone', label: 'PF Zone' },
  { value: 'qc_hold', label: 'QC Hold' },
  { value: 'returns', label: 'Returns' },
  { value: 'damage', label: 'Damage' },
  { value: 'other', label: 'อื่นๆ' }
];


const ROTATION_OPTIONS: Array<{ value: StorageRotation; label: string }> = [
  { value: 'FIFO', label: 'FIFO - First In First Out' },
  { value: 'LIFO', label: 'LIFO - Last In First Out' },
  { value: 'FEFO', label: 'FEFO - First Expire First Out' },
  { value: 'LEFO', label: 'LEFO - Last Expire First Out' },
  { value: 'custom', label: 'Custom' }
];

const STATUS_OPTIONS: Array<{ value: StorageStrategyStatus; label: string }> = [
  { value: 'active', label: 'ใช้งาน' },
  { value: 'inactive', label: 'ไม่ใช้งาน' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'archived', label: 'เก็บถาวร' }
];

const DEFAULT_PRIORITY = 50;
const ZONE_ALL_OPTION = 'ทั้งหมด';

const StorageStrategyPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>(ZONE_ALL_OPTION);
  const [strategies, setStrategies] = useState<StorageStrategyView[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [zones, setZones] = useState<string[]>([ZONE_ALL_OPTION]);
  const [locationTypes, setLocationTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StorageStrategyView | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchWarehouses = useCallback(async () => {
    try {
      const response = await fetch('/api/master-warehouse?status=active');
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload && payload.error) || 'ไม่สามารถดึงข้อมูลคลังสินค้าได้'
        );
      }

      const records = Array.isArray(payload) ? payload : [];
      const normalized: WarehouseOption[] = records.map((warehouse: any) => ({
        warehouse_id: warehouse.warehouse_id,
        warehouse_name: warehouse.warehouse_name
      }));

      setWarehouses(normalized);
    } catch (err) {
      console.error('[storage-strategy] fetchWarehouses error', err);
      setError((prev) => prev ?? 'ไม่สามารถดึงข้อมูลคลังสินค้าได้');
    }
  }, []);

  // Fetch zones from master_location API
  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch('/api/master-location/zones');
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload && payload.error) || 'ไม่สามารถดึงข้อมูลโซนได้'
        );
      }

      const zoneList: string[] = Array.isArray(payload) ? payload : [];
      const zoneOptions = [ZONE_ALL_OPTION, ...zoneList.sort()];
      setZones(zoneOptions);
    } catch (err) {
      console.error('[storage-strategy] fetchZones error', err);
      // Fallback to default zones if API fails
      setZones([ZONE_ALL_OPTION]);
    }
  }, []);

  // Fetch location types from master_location API
  const fetchLocationTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/master-location/location-types');
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload && payload.error) || 'ไม่สามารถดึงข้อมูลประเภทพื้นที่ได้'
        );
      }

      const typeList: string[] = Array.isArray(payload) ? payload : [];
      const normalizedTypes = typeList.map((type) => ({
        value: type,
        label: getLocationTypeText(type)
      }));
      setLocationTypes(normalizedTypes);
    } catch (err) {
      console.error('[storage-strategy] fetchLocationTypes error', err);
      // Fallback to default location types if API fails
      setLocationTypes(LOCATION_TYPE_OPTIONS);
    }
  }, []);

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (selectedWarehouse) {
        params.set('warehouse_id', selectedWarehouse);
      }
      if (selectedZone && selectedZone !== ZONE_ALL_OPTION) {
        params.set('zone', selectedZone);
      }

      const queryString = params.toString();
      const response = await fetch(
        `/api/storage-strategies${queryString ? `?${queryString}` : ''}`
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (payload && payload.error) || 'ไม่สามารถดึงข้อมูลกลยุทธ์ได้'
        );
      }

      const records: StorageStrategyRecord[] = Array.isArray(payload?.data)
        ? payload.data
        : [];

      const normalized: StorageStrategyView[] = records.map((item) => ({
        ...item,
        id: item.strategy_id,
        zone: item.default_zone ?? '',
        location_type: item.default_location_type ?? '',
        is_active: item.status === 'active',
        warehouse: item.master_warehouse ?? null
      }));

      setStrategies(normalized);


      setError(null);
    } catch (err) {
      console.error('[storage-strategy] fetchStrategies error', err);
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลกลยุทธ์ได้'
      );
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedWarehouse, selectedZone]);

  useEffect(() => {
    fetchWarehouses();
    fetchZones();
    fetchLocationTypes();
  }, [fetchWarehouses, fetchZones, fetchLocationTypes]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStrategies();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [fetchStrategies]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 inline text-blue-600" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 inline text-blue-600" />
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedStrategies = useMemo(() => {
    if (!sortField) return strategies;

    const getComparableValue = (
      strategy: StorageStrategyView
    ): string | number => {
      switch (sortField) {
        case 'strategy_code':
          return strategy.strategy_code ?? '';
        case 'strategy_name':
          return strategy.strategy_name ?? '';
        case 'description':
          return strategy.description ?? '';
        case 'default_zone':
          return strategy.default_zone ?? '';
        case 'default_location_type':
          return strategy.default_location_type ?? '';
        case 'priority':
          return strategy.priority ?? 0;
        case 'status':
          return strategy.status ?? 'draft';
        default:
          return '';
      }
    };

    return [...strategies].sort((a, b) => {
      const aValue = getComparableValue(a);
      const bValue = getComparableValue(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue ?? '').toLowerCase();
      const bStr = String(bValue ?? '').toLowerCase();

      if (aStr === bStr) return 0;

      return sortDirection === 'asc'
        ? aStr < bStr
          ? -1
          : 1
        : aStr > bStr
        ? -1
        : 1;
    });
  }, [strategies, sortField, sortDirection]);

  const mapFormValuesToPayload = (values: StrategyFormValues) => {
    const priorityValue = Number(values.priority);
    const safePriority = Number.isFinite(priorityValue)
      ? Math.max(priorityValue, 0)
      : DEFAULT_PRIORITY;

    return {
      strategy_code: values.strategy_code.trim(),
      strategy_name: values.strategy_name.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      warehouse_id: values.warehouse_id,
      default_zone: values.default_zone.trim()
        ? values.default_zone.trim()
        : null,
      default_location_type: values.default_location_type || null,
      priority: safePriority,
      status: values.status,
      allow_auto_assign: values.allow_auto_assign,
      putaway_rotation: values.putaway_rotation,
      effective_from: values.effective_from ? values.effective_from : null,
      effective_to: values.effective_to ? values.effective_to : null
    };
  };

  const handleEdit = (strategy: StorageStrategyView) => {
    // Fetch fresh zones data before opening edit modal
    const refreshZones = async () => {
      try {
        const response = await fetch('/api/master-location/zones');
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            (payload && payload.error) || 'ไม่สามารถดึงข้อมูลโซนได้'
          );
        }

        const zoneList: string[] = Array.isArray(payload) ? payload : [];
        const zoneOptions = [ZONE_ALL_OPTION, ...zoneList.sort()];
        setZones(zoneOptions);
      } catch (err) {
        console.error('[storage-strategy] refreshZones error in handleEdit', err);
      }
    };
    
    refreshZones().then(() => {
      setSelectedStrategy(strategy);
      setShowEditModal(true);
    });
  };

  const handleCreate = async (values: StrategyFormValues) => {
    setIsSaving(true);
    try {
      const payload = {
        ...mapFormValuesToPayload(values),
        created_by: 'system',
        updated_by: 'system'
      };

      const response = await fetch('/api/storage-strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (data && data.error) || 'ไม่สามารถบันทึกกลยุทธ์ใหม่ได้'
        );
      }

      await fetchStrategies();
      setShowAddModal(false);
      setError(null);
    } catch (err) {
      console.error('[storage-strategy] create error', err);
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถบันทึกกลยุทธ์ใหม่ได้'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (
    strategyId: string,
    values: StrategyFormValues
  ) => {
    setIsUpdating(true);
    try {
      const payload = {
        ...mapFormValuesToPayload(values),
        updated_by: 'system'
      };

      const response = await fetch(`/api/storage-strategies/${strategyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (data && data.error) || 'ไม่สามารถแก้ไขกลยุทธ์ได้'
        );
      }

      await fetchStrategies();
      setShowEditModal(false);
      setSelectedStrategy(null);
      setError(null);
    } catch (err) {
      console.error('[storage-strategy] update error', err);
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถแก้ไขกลยุทธ์ได้'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (strategy: StorageStrategyView) => {
    if (
      !window.confirm(
        `คุณต้องการลบกลยุทธ์ "${strategy.strategy_name}" หรือไม่?`
      )
    ) {
      return;
    }

    setDeletingId(strategy.strategy_id);
    try {
      const response = await fetch(
        `/api/storage-strategies/${strategy.strategy_id}`,
        { method: 'DELETE' }
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (data && data.error) || 'ไม่สามารถลบกลยุทธ์ได้'
        );
      }

      await fetchStrategies();
      setError(null);
    } catch (err) {
      console.error('[storage-strategy] delete error', err);
      setError(err instanceof Error ? err.message : 'ไม่สามารถลบกลยุทธ์ได้');
    } finally {
      setDeletingId(null);
    }
  };

  const getLocationTypeBadgeClass = (value: string) => {
    switch (value) {
      case 'rack':
        return 'bg-blue-100 text-blue-700';
      case 'floor':
        return 'bg-green-100 text-green-700';
      case 'bulk':
        return 'bg-yellow-100 text-yellow-700';
      case 'receiving':
        return 'bg-indigo-100 text-indigo-700';
      case 'shipping':
        return 'bg-orange-100 text-orange-700';
      case 'storage':
        return 'bg-slate-100 text-slate-700';
      case 'staging':
        return 'bg-cyan-100 text-cyan-700';
      case 'qc_hold':
        return 'bg-amber-100 text-amber-700';
      case 'returns':
        return 'bg-pink-100 text-pink-700';
      case 'damage':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusBadgeClass = (status: StorageStrategyStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'inactive':
        return 'bg-gray-200 text-gray-700';
      case 'draft':
        return 'bg-yellow-100 text-yellow-700';
      case 'archived':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const zoneOptions = useMemo(
    () => zones.filter((zone) => zone !== ZONE_ALL_OPTION),
    [zones]
  );

  const getLocationTypeText = (locationType: string) => {
    switch (locationType) {
      case 'rack': return 'ชั้นวาง (Rack)';
      case 'floor': return 'กองพื้น (Floor)';
      case 'bulk': return 'พื้นที่รวม (Bulk)';
      case 'storage': return 'Storage';
      case 'receiving': return 'Receiving';
      case 'shipping': return 'Shipping';
      case 'staging': return 'Staging';
      case 'apf_zone': return 'APF Zone';
      case 'pf_zone': return 'PF Zone';
      case 'qc_hold': return 'QC Hold';
      case 'returns': return 'Returns';
      case 'damage': return 'Damage';
      case 'other': return 'อื่นๆ';
      default: return locationType;
    }
  };

  const addInitialValues: StrategyFormValues = {
    strategy_code: '',
    strategy_name: '',
    description: '',
    warehouse_id:
      selectedWarehouse ||
      (warehouses.length === 1 ? warehouses[0].warehouse_id : ''),
    default_zone:
      selectedZone && selectedZone !== ZONE_ALL_OPTION ? selectedZone : '',
    default_location_type: '',
    priority: DEFAULT_PRIORITY,
    status: 'active',
    allow_auto_assign: true,
    putaway_rotation: 'FIFO',
    effective_from: '',
    effective_to: ''
  };

  const editInitialValues: StrategyFormValues | null = selectedStrategy
    ? {
        strategy_code: selectedStrategy.strategy_code,
        strategy_name: selectedStrategy.strategy_name,
        description: selectedStrategy.description ?? '',
        warehouse_id: selectedStrategy.warehouse_id,
        default_zone: selectedStrategy.default_zone ?? '',
        default_location_type: selectedStrategy.default_location_type ?? '',
        priority: selectedStrategy.priority ?? DEFAULT_PRIORITY,
        status: selectedStrategy.status,
        allow_auto_assign: selectedStrategy.allow_auto_assign,
        putaway_rotation: selectedStrategy.putaway_rotation ?? 'FIFO',
        effective_from: selectedStrategy.effective_from ?? '',
        effective_to: selectedStrategy.effective_to ?? ''
      }
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-thai-gray-25 to-white">
      <div className="space-y-3">
        {/* Modern Page Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-thai-gray-900 font-thai">กลยุทธ์การเก็บสินค้า</h1>
              <p className="text-thai-gray-600 font-thai mt-1">จัดการกลยุทธ์การเก็บสินค้าในคลังสินค้า</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                icon={Package}
                className="bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-sm"
                onClick={() => {
                  setImportSummary(null);
                  setImportErrorMessage(null);
                  setImportFile(null);
                  setShowImportModal(true);
                }}
              >
                นำเข้าข้อมูล
              </Button>
              <Button 
                variant="primary" 
                icon={Plus}
                onClick={() => {
                  // Fetch fresh zones data before opening add modal
                  const refreshZones = async () => {
                    try {
                      const response = await fetch('/api/master-location/zones');
                      const payload = await response.json().catch(() => null);

                      if (!response.ok) {
                        throw new Error(
                          (payload && payload.error) || 'ไม่สามารถดึงข้อมูลโซนได้'
                        );
                      }

                      const zoneList: string[] = Array.isArray(payload) ? payload : [];
                      const zoneOptions = [ZONE_ALL_OPTION, ...zoneList.sort()];
                      setZones(zoneOptions);
                    } catch (err) {
                      console.error('[storage-strategy] refreshZones error in add modal', err);
                    }
                  };
                  
                  refreshZones().then(() => {
                    setShowAddModal(true);
                  });
                }}
                className="bg-blue-500 hover:bg-blue-600 shadow-lg"
              >
                เพิ่มกลยุทธ์
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="font-thai text-sm">เกิดข้อผิดพลาด: {error}</span>
            </div>
          </div>
        )}

        {/* Modern Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-thai-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหากลยุทธ์ รหัส หรือชื่อ..."
                  className="
                    w-full pl-10 pr-4 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                    text-sm font-thai transition-all duration-300 backdrop-blur-sm
                    placeholder:text-thai-gray-400
                  "
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex space-x-2">
              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-28
                "
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>

              <select
                className="
                  px-3 py-2 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/80
                  text-sm font-thai transition-all duration-300 backdrop-blur-sm min-w-24
                "
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-[74vh] bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('strategy_code')}>รหัสกลยุทธ์{getSortIcon('strategy_code')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('strategy_name')}>ชื่อกลยุทธ์{getSortIcon('strategy_name')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('description')}>รายละเอียด{getSortIcon('description')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">คลังสินค้า</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('default_zone')}>โซน{getSortIcon('default_zone')}</th>
                <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('default_location_type')}>ประเภทพื้นที่{getSortIcon('default_location_type')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('priority')}>ลำดับความสำคัญ{getSortIcon('priority')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>สถานะ{getSortIcon('status')}</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">รูปแบบการหมุนสินค้า</th>
                <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-red-500">
                    เกิดข้อผิดพลาด: {error}
                  </td>
                </tr>
              ) : sortedStrategies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                sortedStrategies.map((strategy) => {
                  const statusLabel =
                    STATUS_OPTIONS.find(
                      (option) => option.value === strategy.status
                    )?.label ?? strategy.status;
                  const locationLabel =
                    LOCATION_TYPE_OPTIONS.find(
                      (option: { value: string; label: string }) => option.value === strategy.location_type
                    )?.label ?? (strategy.location_type || 'ไม่ระบุ');

                  return (
                    <tr
                      key={strategy.strategy_id}
                      className="hover:bg-blue-50/30 transition-colors duration-150"
                    >
                    <td className="px-2 py-0.5 text-xs border-r border-gray-100 whitespace-nowrap">
                      <div className="font-semibold text-blue-600 font-mono text-[11px]">{strategy.strategy_code}</div>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{strategy.strategy_name}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-600 max-w-xs truncate">{strategy.description}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">
                      {strategy.warehouse?.warehouse_name || '-'}
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-gray-700 whitespace-nowrap">{strategy.zone || '-'}</td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getLocationTypeBadgeClass(strategy.location_type)}`}
                      >
                        {locationLabel}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                        {strategy.priority}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeClass(strategy.status)}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 text-[11px] border-r border-gray-100 text-center whitespace-nowrap">
                      {strategy.putaway_rotation ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                          {ROTATION_OPTIONS.find(opt => opt.value === strategy.putaway_rotation)?.label || strategy.putaway_rotation}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="px-2 py-0.5 text-xs border-gray-100 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          className="p-0.5 rounded hover:bg-blue-100 text-blue-600 transition-all"
                          disabled={Boolean(deletingId) || isUpdating}
                          onClick={() => handleEdit(strategy)}
                          title="แก้ไข"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-0.5 rounded hover:bg-red-100 text-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={deletingId === strategy.strategy_id}
                          onClick={() => handleDelete(strategy)}
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add Strategy Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            // Refresh zones when modal is closed to ensure fresh data next time
            fetchZones();
          }}
          title="เพิ่มกลยุทธ์ใหม่"
          size="xl"
        >
          <div className="p-4">
            <StrategyForm
              initialValues={addInitialValues}
              warehouses={warehouses}
              availableZones={zoneOptions}
              locationTypes={locationTypes}
              onSubmit={handleCreate}
              onCancel={() => setShowAddModal(false)}
              submitting={isSaving}
            />
          </div>
        </Modal>

        {/* Edit Strategy Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStrategy(null);
            // Refresh zones when modal is closed to ensure fresh data next time
            fetchZones();
          }}
          title="แก้ไขกลยุทธ์"
          size="xl"
        >
          {selectedStrategy && editInitialValues && (
            <div className="p-4">
              <StrategyForm
                initialValues={editInitialValues}
                warehouses={warehouses}
                availableZones={zoneOptions}
                locationTypes={locationTypes}
                onSubmit={(values) =>
                  handleUpdate(selectedStrategy.strategy_id, values)
                }
                onCancel={() => {
                  setShowEditModal(false);
                  setSelectedStrategy(null);
                }}
                submitting={isUpdating}
              />
            </div>
          )}
        </Modal>

        {/* Import Modal */}
        <Modal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
          }}
          title="นำเข้าข้อมูลกลยุทธ์"
          size="xl"
        >
          <ImportStorageStrategyForm
            onSuccess={() => {
              setShowImportModal(false);
              fetchStrategies();
            }}
            onCancel={() => setShowImportModal(false)}
          />
        </Modal>
      </div>
    </div>
  );
};

export default StorageStrategyPage;

const StrategyForm: React.FC<StrategyFormProps> = ({
  initialValues,
  warehouses,
  availableZones,
  locationTypes,
  onSubmit,
  onCancel,
  submitting
}) => {
  const zoneListId = useId();
  const [formValues, setFormValues] = useState<StrategyFormValues>(initialValues);

  useEffect(() => {
    setFormValues(initialValues);
  }, [initialValues]);

  const handleFieldChange = (
    field: keyof StrategyFormValues
  ) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [field]:
        field === 'priority'
          ? Number(value)
          : value
    }));
  };

  const handleAllowAutoAssignChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormValues((prev) => ({
      ...prev,
      allow_auto_assign: event.target.checked
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const normalizedPriority =
      Number.isFinite(formValues.priority) && formValues.priority >= 0
        ? formValues.priority
        : DEFAULT_PRIORITY;

    await onSubmit({
      ...formValues,
      priority: normalizedPriority,
      effective_from: formValues.effective_from || '',
      effective_to: formValues.effective_to || ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            รหัสกลยุทธ์ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formValues.strategy_code}
            onChange={handleFieldChange('strategy_code')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="เช่น FIFO-PUTAWAY"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            ชื่อกลยุทธ์ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formValues.strategy_name}
            onChange={handleFieldChange('strategy_name')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="ชื่อกลยุทธ์"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">รายละเอียด</label>
        <textarea
          value={formValues.description}
          onChange={handleFieldChange('description')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]"
          placeholder="รายละเอียดหรือข้อกำหนดพิเศษ"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            คลังสินค้า <span className="text-red-500">*</span>
          </label>
          <select
            value={formValues.warehouse_id}
            onChange={handleFieldChange('warehouse_id')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          >
            <option value="">เลือกคลังสินค้า</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                {warehouse.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">โซนเริ่มต้น</label>
          <ComboBox
            name="default_zone"
            value={formValues.default_zone}
            onChange={(e) => handleFieldChange('default_zone')(e as React.ChangeEvent<HTMLInputElement>)}
            options={availableZones}
            placeholder="เลือกโซน"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">ประเภทพื้นที่</label>
          <select
            value={formValues.default_location_type}
            onChange={handleFieldChange('default_location_type')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {locationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            ลำดับความสำคัญ
          </label>
          <input
            type="number"
            min={0}
            max={999}
            value={formValues.priority}
            onChange={handleFieldChange('priority')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">สถานะ</label>
          <select
            value={formValues.status}
            onChange={handleFieldChange('status')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">รูปแบบการหมุนสินค้า</label>
          <select
            value={formValues.putaway_rotation}
            onChange={handleFieldChange('putaway_rotation')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {ROTATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">มีผลตั้งแต่</label>
          <input
            type="date"
            value={formValues.effective_from}
            onChange={handleFieldChange('effective_from')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">สิ้นสุดวันที่</label>
          <input
            type="date"
            value={formValues.effective_to}
            onChange={handleFieldChange('effective_to')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
        <input
          id={`${zoneListId}-auto-assign`}
          type="checkbox"
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          checked={formValues.allow_auto_assign}
          onChange={handleAllowAutoAssignChange}
        />
        <label
          htmlFor={`${zoneListId}-auto-assign`}
          className="text-sm text-gray-700 select-none"
        >
          อนุญาตให้ระบบแนะนำตำแหน่งจัดเก็บอัตโนมัติ
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          บันทึก
        </Button>
      </div>
    </form>
  );
};
