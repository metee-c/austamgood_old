'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Printer,
  Loader2,
  AlertCircle,
  Package,
  CheckCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Layers,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import DeliveryOrderDocument from '@/components/receiving/DeliveryOrderDocument';
import {
  PageContainer,
  PageHeaderWithFilters,
  SearchInput,
  PaginationBar
} from '@/components/ui/page-components';

interface Loadlist {
  id: number;
  loadlist_code: string;
  status: string;
  loading_door_number?: string;
  loading_queue_number?: string;
  vehicle_type?: string;
  delivery_number?: string;
  driver_phone?: string;
  checker_employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  helper_employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  plan_id?: number;
  route_plan?: {
    plan_code: string;
    plan_date: string;
  };
  trip_id?: number;
  trip?: {
    trip_code: string;
    daily_trip_number?: number | null;
  };
  total_picklists: number;
  total_face_sheets?: number;
  total_packages: number;
  created_at: string;
  created_by: string;
  vehicle?: {
    vehicle_id: string;
    plate_number: string;
    vehicle_type: string;
    model?: string;
  };
  driver?: {
    employee_id: number;
    first_name: string;
    last_name: string;
  };
  picklists: Array<{
    id: number;
    picklist_code: string;
    status: string;
    total_lines: number;
    loading_door_number?: string;
    trip: {
      trip_code: string;
      vehicle?: { plate_number: string };
    };
    orders?: Array<{
      order_no: string;
      shop_name: string;
      total_weight?: number;
    }>;
  }>;
  face_sheets?: Array<{
    id: number;
    face_sheet_no: string;
    status: string;
    total_packages: number;
    total_items: number;
  }>;
}

interface AvailablePicklist {
  id: number;
  picklist_code: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  total_stops?: number;
  total_weight?: number;
  loading_door_number?: string;
  created_at: string;
  province?: string;
  trip?: {
    trip_id: number;
    trip_code: string;
    vehicle_id?: number;
    driver_id?: number;
    vehicle?: {
      plate_number: string;
    };
    driver_name?: string;
  };
}

interface AvailableFaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  warehouse_id: string;
  created_at: string;
  picking_completed_at?: string;
  picking_started_at?: string;
  // ข้อมูล trips
  daily_trip_numbers?: number[];
  daily_trip_numbers_display?: string;
  // สถานะการใช้งาน
  is_used?: boolean;
  used_in_loadlist_id?: number | null;
}

interface AvailableBonusFaceSheet {
  id: number;
  face_sheet_no: string;
  status: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  warehouse_id: string;
  created_at: string;
  picking_completed_at?: string;
  delivery_date?: string;
  daily_trip_numbers?: number[];
  daily_trip_numbers_display?: string;
  trip_infos?: Array<{
    trip_number: string;
    daily_trip_number: number | null;
    vehicle_id: number | null;
    plate_number: string | null;
  }>;
  // ✅ NEW: ข้อมูล packages ที่แมพสายรถแล้ว vs ยังไม่แมพ
  mapped_packages?: number;
  mapped_items?: number;
  mapped_orders?: number;
  unmapped_packages?: number;
  has_unmapped_packages?: boolean;
  // ✅ NEW: category สำหรับแยกแสดง
  category?: 'with_trip' | 'no_trip';
  category_label?: string;
  // ✅ NEW: สถานะการใช้งานใน loadlist
  is_used?: boolean;
  used_in_loadlist_id?: number | null;
}

interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
  employee_code: string;
  position?: string;
}

interface Vehicle {
  vehicle_id: number;
  plate_number: string;
  vehicle_type: string;
  model?: string;
  driver_id?: number;
}

// Interface สำหรับเก็บค่าแยกต่างหากแต่ละ picklist
interface PicklistFormData {
  checkerEmployeeId: number | '';
  vehicleType: string;
  vehicleId: string;
  driverEmployeeId: number | '';
  driverName: string;
  loadingDoorNumber: string;
  loadingQueueNumber: string;
  deliveryNumber: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'รอโหลด', variant: 'warning' },
  loaded: { label: 'โหลดเสร็จ', variant: 'success' },
  cancelled: { label: 'ยกเลิก', variant: 'danger' }
};

const LoadlistsPage = () => {
  const [loadlists, setLoadlists] = useState<Loadlist[]>([]);
  const [availablePicklists, setAvailablePicklists] = useState<AvailablePicklist[]>([]);
  const [availableFaceSheets, setAvailableFaceSheets] = useState<AvailableFaceSheet[]>([]);
  const [availableBonusFaceSheets, setAvailableBonusFaceSheets] = useState<AvailableBonusFaceSheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPicklists, setSelectedPicklists] = useState<number[]>([]);
  const [selectedFaceSheets, setSelectedFaceSheets] = useState<number[]>([]);
  const [selectedBonusFaceSheets, setSelectedBonusFaceSheets] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'picklists' | 'face-sheets' | 'bonus-face-sheets'>('picklists');

  // ✅ NEW: เก็บค่าแยกต่างหากแต่ละ picklist (key = picklist_id)
  const [picklistFormData, setPicklistFormData] = useState<Record<number, PicklistFormData>>({});

  // ✅ NEW: เก็บค่า checker แยกต่างหากแต่ละ bonus face sheet (key = bonus_face_sheet_id)
  const [bonusFaceSheetCheckers, setBonusFaceSheetCheckers] = useState<Record<number, number | ''>>({});

  // ✅ NEW: เก็บการแมพ bonus face sheet กับ picklist และ face sheet (key = bonus_face_sheet_id)
  const [bonusFaceSheetMappings, setBonusFaceSheetMappings] = useState<Record<number, {
    selectedPicklistId: number | null;  // picklist_id ที่เลือก
    selectedFaceSheetId: number | null;  // face_sheet_id ที่เลือกแมพ
  }>>({});

  // ✅ NEW: รายการ picklists ทั้งหมดสำหรับ dropdown ในแทบ bonus face sheets
  const [allPicklistsForDropdown, setAllPicklistsForDropdown] = useState<Array<{
    id: number;
    picklist_code: string;
    daily_trip_number: number | null;
    trip_code: string;
    plan_code: string;
    vehicle_plate?: string;
  }>>([]);

  // Form fields (ใช้สำหรับ face sheets และ bonus face sheets)
  const [checkerEmployeeId, setCheckerEmployeeId] = useState<number | ''>('');
  const [vehicleType, setVehicleType] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [driverEmployeeId, setDriverEmployeeId] = useState<number | ''>('');
  const [driverName, setDriverName] = useState<string>(''); // Driver name from vehicle.model
  const [loadingQueueNumber, setLoadingQueueNumber] = useState<string>('');
  const [loadingDoorNumber, setLoadingDoorNumber] = useState<string>('');

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingLoadlist, setViewingLoadlist] = useState<Loadlist | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printLoadlist, setPrintLoadlist] = useState<Loadlist | null>(null);
  
  const [showDeliveryDocModal, setShowDeliveryDocModal] = useState(false);
  const [createdLoadlistId, setCreatedLoadlistId] = useState<number | null>(null);

  // State สำหรับ modal เลือกใบปะหน้าที่จะปริ้นใบเช็คของแถม
  const [isBonusPrintModalOpen, setIsBonusPrintModalOpen] = useState(false);
  const [bonusFaceSheetToPrint, setBonusFaceSheetToPrint] = useState<{ id: number; face_sheet_no: string } | null>(null);
  const [currentLoadlistIdForPrint, setCurrentLoadlistIdForPrint] = useState<number | null>(null);
  const [mappedFaceSheets, setMappedFaceSheets] = useState<Array<{ face_sheet_id: number; face_sheet_no: string; created_date: string | null; total_orders: number; total_packages: number; bonus_package_count: number; bonus_order_count: number }>>([]);
  const [selectedFaceSheetsForPrint, setSelectedFaceSheetsForPrint] = useState<number[]>([]); // เก็บ face_sheet_id สำหรับ filter
  const [printingPickListId, setPrintingPickListId] = useState<number | null>(null);
  const [confirmingPickId, setConfirmingPickId] = useState<number | null>(null); // สำหรับปุ่มยืนยันหยิบ
  const fetchLoadlists = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/loadlists?_=${Date.now()}`);
      if (!response.ok) {
        throw new Error('Unable to load loadlists');
      }
      const data = await response.json();
      console.log('📦 Fetched loadlists:', data.map((l: any) => ({
        code: l.loadlist_code,
        loading_door: l.loading_door_number,
        vehicle: l.vehicle,
        driver: l.driver
      })));
      setLoadlists(data);
    } catch (err: any) {
      setError(err.message ?? 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoadlists();
    fetchEmployees();
    fetchVehicles();
  }, []);

  // Auto-fill form fields from selected picklists
  useEffect(() => {
    if (selectedPicklists.length > 0 && availablePicklists.length > 0) {
      // Get the first selected picklist
      const firstSelectedPicklist = availablePicklists.find(p => p.id === selectedPicklists[0]);
      
      if (firstSelectedPicklist) {
        console.log('🔄 Auto-filling from picklist:', {
          picklist_code: firstSelectedPicklist.picklist_code,
          loading_door: firstSelectedPicklist.loading_door_number,
          vehicle_id: firstSelectedPicklist.trip?.vehicle_id,
          driver_id: firstSelectedPicklist.trip?.driver_id,
          current_state: {
            loadingDoorNumber,
            vehicleId,
            driverEmployeeId
          }
        });

        // Set loading door number from picklist (always override)
        if (firstSelectedPicklist.loading_door_number) {
          setLoadingDoorNumber(firstSelectedPicklist.loading_door_number);
          console.log('✅ Set loading door:', firstSelectedPicklist.loading_door_number);
        }
        
        // Set vehicle and driver from trip
        if (firstSelectedPicklist.trip) {
          // Set vehicle if available (always override)
          if (firstSelectedPicklist.trip.vehicle_id) {
            const vehicleIdStr = String(firstSelectedPicklist.trip.vehicle_id);
            setVehicleId(vehicleIdStr);
            console.log('✅ Set vehicle ID:', vehicleIdStr);
          }
          
          // Set driver if available (always override)
          if (firstSelectedPicklist.trip.driver_id) {
            setDriverEmployeeId(firstSelectedPicklist.trip.driver_id);
            console.log('✅ Set driver ID:', firstSelectedPicklist.trip.driver_id);
          } else {
            console.log('⚠️ No driver_id in trip (driver_id is null)');
          }
        }
      }
    }
  }, [selectedPicklists, availablePicklists]);

  const fetchAvailablePicklists = async () => {
    try {
      const response = await fetch('/api/loadlists/available-picklists');
      if (!response.ok) {
        throw new Error('Unable to load available picklists');
      }
      const data = await response.json();
      console.log('📋 Available picklists:', JSON.stringify(data.map((p: any) => ({
        code: p.picklist_code,
        loading_door: p.loading_door_number,
        trip: p.trip ? {
          vehicle_id: p.trip.vehicle_id,
          driver_id: p.trip.driver_id,
          vehicle_plate: p.trip.vehicle?.plate_number,
          driver_name: p.trip.driver_name
        } : null
      })), null, 2));
      setAvailablePicklists(data);
    } catch (err: any) {
      setCreateError('Unable to load picklists: ' + (err.message ?? 'unknown error'));
    }
  };

  const fetchAvailableFaceSheets = async () => {
    try {
      const response = await fetch('/api/loadlists/available-face-sheets');
      if (!response.ok) {
        throw new Error('Unable to load available face sheets');
      }
      const result = await response.json();
      if (result.success) {
        setAvailableFaceSheets(result.data || []);
      }
    } catch (err: any) {
      setCreateError('Unable to load face sheets: ' + (err.message ?? 'unknown error'));
    }
  };

  const fetchAvailableBonusFaceSheets = async () => {
    try {
      const response = await fetch('/api/loadlists/available-bonus-face-sheets');
      if (!response.ok) {
        throw new Error('Unable to load available bonus face sheets');
      }
      const result = await response.json();
      if (result.success) {
        setAvailableBonusFaceSheets(result.data || []);
      }
    } catch (err: any) {
      setCreateError('Unable to load bonus face sheets: ' + (err.message ?? 'unknown error'));
    }
  };

  // ✅ NEW: ดึงรายการ picklists ทั้งหมดสำหรับ dropdown ในแทบ bonus face sheets
  const fetchAllPicklistsForDropdown = async () => {
    try {
      const response = await fetch('/api/picklists');
      if (!response.ok) {
        throw new Error('Unable to load picklists');
      }
      const result = await response.json();
      
      if (result.data) {
        // แปลงข้อมูลเป็น format ที่ต้องการ
        const picklists = result.data.map((p: any) => ({
          id: p.id,
          picklist_code: p.picklist_code,
          daily_trip_number: p.receiving_route_trips?.daily_trip_number || null,
          trip_code: p.receiving_route_trips?.trip_sequence ? `TRIP-${String(p.receiving_route_trips.trip_sequence).padStart(3, '0')}` : '',
          plan_code: p.receiving_route_trips?.receiving_route_plans?.plan_code || '',
          vehicle_plate: null // จะดึงเพิ่มถ้าต้องการ
        }));
        
        // Sort by daily_trip_number
        picklists.sort((a: any, b: any) => (a.daily_trip_number || 0) - (b.daily_trip_number || 0));
        setAllPicklistsForDropdown(picklists);
      } else {
        setAllPicklistsForDropdown([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch picklists for dropdown:', err);
      setAllPicklistsForDropdown([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/master-employee');
      if (!response.ok) {
        throw new Error('Unable to load employees');
      }
      const result = await response.json();
      // API returns array directly
      const employeeData = Array.isArray(result) ? result : [];
      console.log('👥 Fetched employees:', employeeData.length, employeeData.slice(0, 3));
      setEmployees(employeeData);
      setDrivers(employeeData); // Use same employee list for drivers
    } catch (err: any) {
      console.error('Failed to fetch employees:', err);
      setEmployees([]);
      setDrivers([]);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch('/api/master-vehicle');
      if (!response.ok) {
        throw new Error('Unable to load vehicles');
      }
      const result = await response.json();
      const vehicleData = Array.isArray(result.data) ? result.data : [];
      console.log('🚗 Fetched vehicles:', vehicleData.length, vehicleData.slice(0, 3));
      setVehicles(vehicleData);
    } catch (err: any) {
      console.error('Failed to fetch vehicles:', err);
      setVehicles([]);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Loadlist>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const handleSort = (field: keyof Loadlist) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Loadlist) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 inline-block" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 inline-block" />
      : <ChevronDown className="w-3 h-3 ml-1 inline-block" />;
  };

  const getStatusBadge = (status: string) => {
    const { label, variant } = statusMap[status] || { label: status, variant: 'default' };
    return <Badge variant={variant} size="sm"><span className="text-[10px]">{label}</span></Badge>;
  };

  const filteredLoadlists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = loadlists.filter(l =>
      l.loadlist_code.toLowerCase().includes(term) ||
      l.vehicle?.plate_number?.toLowerCase().includes(term) ||
      l.driver?.first_name?.toLowerCase().includes(term) ||
      l.driver?.last_name?.toLowerCase().includes(term)
    );
    return filtered.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? '';
      const bVal = (b as any)[sortField] ?? '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [loadlists, searchTerm, sortField, sortDirection]);

  const handleOpenCreateModal = async () => {
    console.log('🔓 Opening create modal...');
    setIsCreateModalOpen(true);
    setCreateError(null);
    setSelectedPicklists([]);
    setSelectedFaceSheets([]);
    setSelectedBonusFaceSheets([]);
    setActiveTab('picklists');
    // Reset form fields
    setCheckerEmployeeId('');
    setVehicleType('');
    setDeliveryNumber('');
    setVehicleId('');
    setDriverEmployeeId('');
    setDriverName('');
    setLoadingQueueNumber('');
    setLoadingDoorNumber('');
    setPicklistFormData({}); // ✅ Reset picklist form data
    setBonusFaceSheetCheckers({}); // ✅ Reset bonus face sheet checkers
    setBonusFaceSheetMappings({}); // ✅ Reset bonus face sheet mappings
    await Promise.all([
      fetchAvailablePicklists(),
      fetchAvailableFaceSheets(),
      fetchAvailableBonusFaceSheets(),
      fetchAllPicklistsForDropdown(), // ✅ NEW: ดึงรายการ picklists สำหรับ dropdown
      fetchEmployees(),
      fetchVehicles()
    ]);
    console.log('✅ Modal data loaded:', {
      vehicles: vehicles.length,
      employees: employees.length,
      availablePicklists: availablePicklists.length
    });
  };

  // ✅ Helper function สำหรับอัปเดตค่าแต่ละ picklist
  const updatePicklistFormData = (picklistId: number, field: keyof PicklistFormData, value: any) => {
    setPicklistFormData(prev => ({
      ...prev,
      [picklistId]: {
        ...prev[picklistId],
        [field]: value
      }
    }));
  };

  // ✅ Helper function สำหรับดึงค่าของ picklist (ใช้ค่า default จาก picklist ถ้ายังไม่ได้เลือก)
  const getPicklistFormValue = (picklist: AvailablePicklist, field: keyof PicklistFormData): any => {
    const formData = picklistFormData[picklist.id];
    if (formData && formData[field] !== undefined && formData[field] !== '') {
      return formData[field];
    }
    // Default values from picklist data
    switch (field) {
      case 'vehicleId':
        return picklist.trip?.vehicle_id ? String(picklist.trip.vehicle_id) : '';
      case 'driverName':
        return picklist.trip?.driver_name || '';
      case 'loadingDoorNumber':
        return (picklist as any).loading_door_number || '';
      default:
        return '';
    }
  };

  const handleTogglePicklist = (picklistId: number) => {
    setSelectedPicklists(prev =>
      prev.includes(picklistId)
        ? prev.filter(id => id !== picklistId)
        : [...prev, picklistId]
    );
  };

  const handleToggleAllPicklists = () => {
    if (selectedPicklists.length === availablePicklists.length) {
      setSelectedPicklists([]);
    } else {
      setSelectedPicklists(availablePicklists.map(p => p.id));
    }
  };

  const handleCreateLoadlist = async () => {
    const hasPicklists = selectedPicklists.length > 0;
    const hasFaceSheets = selectedFaceSheets.length > 0;
    const hasBonusFaceSheets = selectedBonusFaceSheets.length > 0;
    
    if (!hasPicklists && !hasFaceSheets && !hasBonusFaceSheets) {
      setCreateError('กรุณาเลือกใบจัดสินค้า, ใบปะหน้า หรือใบปะหน้าของแถมอย่างน้อย 1 รายการ');
      return;
    }

    // For picklists: validate each selected picklist has required fields
    if (hasPicklists) {
      for (const picklistId of selectedPicklists) {
        const picklist = availablePicklists.find(p => p.id === picklistId);
        const formData: PicklistFormData = picklistFormData[picklistId] || {
          checkerEmployeeId: '',
          vehicleType: '',
          vehicleId: '',
          driverEmployeeId: '',
          driverName: '',
          loadingDoorNumber: '',
          loadingQueueNumber: '',
          deliveryNumber: ''
        };
        const picklistCode = picklist?.picklist_code || `ID:${picklistId}`;
        
        // Check checker employee
        if (!formData.checkerEmployeeId) {
          setCreateError(`กรุณาเลือกผู้เช็คโหลดสินค้าสำหรับ ${picklistCode}`);
          return;
        }
        // Check vehicle type
        if (!formData.vehicleType) {
          setCreateError(`กรุณาเลือกประเภทรถสำหรับ ${picklistCode}`);
          return;
        }
        // Check delivery number
        if (!formData.deliveryNumber) {
          setCreateError(`กรุณาระบุเลขงานจัดส่งสำหรับ ${picklistCode}`);
          return;
        }
      }
    }

    // For face sheets and bonus face sheets: use shared checkerEmployeeId
    if (hasFaceSheets && !hasPicklists) {
      if (!checkerEmployeeId) {
        setCreateError('กรุณาเลือกผู้เช็คโหลดสินค้า');
        return;
      }
    }

    // For bonus face sheets: validate each selected bonus face sheet has checker
    if (hasBonusFaceSheets && !hasPicklists) {
      for (const bfsId of selectedBonusFaceSheets) {
        const bfs = availableBonusFaceSheets.find(b => b.id === bfsId);
        const checkerId = bonusFaceSheetCheckers[bfsId];
        if (!checkerId) {
          setCreateError(`กรุณาเลือกผู้เช็คสำหรับ ${bfs?.face_sheet_no || `ID:${bfsId}`}`);
          return;
        }
      }
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // For picklists: create one loadlist per picklist (each has different values)
      if (hasPicklists) {
        const results = [];
        for (const picklistId of selectedPicklists) {
          const picklist = availablePicklists.find(p => p.id === picklistId);
          const formData: PicklistFormData = picklistFormData[picklistId] || {
            checkerEmployeeId: '',
            vehicleType: '',
            vehicleId: '',
            driverEmployeeId: '',
            driverName: '',
            loadingDoorNumber: '',
            loadingQueueNumber: '',
            deliveryNumber: ''
          };
          
          const requestBody: any = {
            checker_employee_id: formData.checkerEmployeeId,
            vehicle_type: formData.vehicleType || 'N/A',
            delivery_number: formData.deliveryNumber || `PL-${Date.now()}`,
            vehicle_id: formData.vehicleId || picklist?.trip?.vehicle_id || null,
            driver_employee_id: formData.driverEmployeeId || null,
            loading_queue_number: formData.loadingQueueNumber || null,
            loading_door_number: formData.loadingDoorNumber || picklist?.loading_door_number || null,
            picklist_ids: [picklistId]
          };

          console.log(`🚀 Creating loadlist for ${picklist?.picklist_code}:`, {
            vehicle_id: requestBody.vehicle_id,
            driver_employee_id: requestBody.driver_employee_id,
            loading_door_number: requestBody.loading_door_number,
            checker_employee_id: requestBody.checker_employee_id
          });

          const response = await fetch('/api/loadlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || `ไม่สามารถสร้างใบโหลดสำหรับ ${picklist?.picklist_code}`);
          }
          results.push(result);
        }
        
        setIsCreateModalOpen(false);
        setSelectedPicklists([]);
        setPicklistFormData({});
        await fetchLoadlists();
        return;
      }

      // For bonus face sheets only: create one loadlist per bonus face sheet (each has different checker)
      if (hasBonusFaceSheets && !hasFaceSheets) {
        const results = [];
        for (const bfsId of selectedBonusFaceSheets) {
          const bfs = availableBonusFaceSheets.find(b => b.id === bfsId);
          const checkerId = bonusFaceSheetCheckers[bfsId];
          const mapping = bonusFaceSheetMappings[bfsId] || { selectedPicklistId: null, selectedFaceSheetId: null };
          
          const requestBody: any = {
            checker_employee_id: checkerId,
            vehicle_type: vehicleType || 'N/A',
            delivery_number: deliveryNumber || `BFS-${Date.now()}`,
            vehicle_id: vehicleId || null,
            driver_employee_id: driverEmployeeId || null,
            loading_queue_number: loadingQueueNumber || null,
            loading_door_number: loadingDoorNumber || null,
            bonus_face_sheet_ids: [bfsId],
            // ✅ NEW: ส่ง mapping ของ picklist และ face sheet ที่ผู้ใช้เลือก
            bonus_face_sheet_mappings: [{
              bonus_face_sheet_id: bfsId,
              picklist_id: mapping.selectedPicklistId,
              face_sheet_id: mapping.selectedFaceSheetId
            }]
          };

          console.log(`🚀 Creating loadlist for ${bfs?.face_sheet_no}:`, {
            checker_employee_id: requestBody.checker_employee_id,
            mapping: requestBody.bonus_face_sheet_mappings[0]
          });

          const response = await fetch('/api/loadlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || `ไม่สามารถสร้างใบโหลดสำหรับ ${bfs?.face_sheet_no}`);
          }
          results.push(result);
        }
        
        setIsCreateModalOpen(false);
        setSelectedBonusFaceSheets([]);
        setBonusFaceSheetCheckers({});
        setBonusFaceSheetMappings({});
        await fetchLoadlists();
        return;
      }

      // For face sheets (and mixed with bonus face sheets): create single loadlist with shared values
      const requestBody: any = {
        checker_employee_id: checkerEmployeeId,
        vehicle_type: vehicleType || 'N/A',
        delivery_number: deliveryNumber || `FS-${Date.now()}`,
        vehicle_id: vehicleId || null,
        driver_employee_id: driverEmployeeId || null,
        loading_queue_number: loadingQueueNumber || null,
        loading_door_number: loadingDoorNumber || null
      };

      console.log('🚀 Creating loadlist with data:', {
        vehicle_id: requestBody.vehicle_id,
        driver_employee_id: requestBody.driver_employee_id,
        loading_door_number: requestBody.loading_door_number,
        checker_employee_id: requestBody.checker_employee_id
      });
      
      if (hasFaceSheets) {
        requestBody.face_sheet_ids = selectedFaceSheets;
      }

      if (hasBonusFaceSheets) {
        requestBody.bonus_face_sheet_ids = selectedBonusFaceSheets;
      }

      const response = await fetch('/api/loadlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create loadlist');
      }
      
      setIsCreateModalOpen(false);
      setSelectedFaceSheets([]);
      setSelectedBonusFaceSheets([]);
      setBonusFaceSheetCheckers({});
      await fetchLoadlists();
      
      // If created from face sheets or bonus face sheets, show delivery document option
      if ((hasFaceSheets || hasBonusFaceSheets) && result.id) {
        setCreatedLoadlistId(result.id);
        setShowDeliveryDocModal(true);
      }
    } catch (err: any) {
      setCreateError(err.message ?? 'Unable to create loadlist');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePrintLoadlist = async (loadlist: Loadlist) => {
    // Check if this loadlist has any items
    const hasPicklists = loadlist.picklists && loadlist.picklists.length > 0;
    const hasFaceSheets = (loadlist as any).face_sheets && (loadlist as any).face_sheets.length > 0;
    const hasBonusFaceSheets = (loadlist as any).bonus_face_sheets && (loadlist as any).bonus_face_sheets.length > 0;

    // Check if loadlist is empty
    if (!hasPicklists && !hasFaceSheets && !hasBonusFaceSheets) {
      alert('ใบโหลดนี้ไม่มีรายการสินค้า ไม่สามารถพิมพ์ได้');
      return;
    }

    // Priority: Check Bonus Face Sheets FIRST (ตรวจสอบของแถมก่อน)
    if (hasBonusFaceSheets) {
      // แสดง modal ให้เลือก trip ที่จะปริ้น (1 trip = 1 ใบ)
      const firstBonusFaceSheet = (loadlist as any).bonus_face_sheets[0];
      setBonusFaceSheetToPrint({
        id: firstBonusFaceSheet.id,
        face_sheet_no: firstBonusFaceSheet.face_sheet_no
      });
      
      // ดึงรายการใบปะหน้าที่แมพกับ loadlist นี้
      setSelectedFaceSheetsForPrint([]);
      setMappedFaceSheets([]);
      setCurrentLoadlistIdForPrint(loadlist.id);
      
      fetch(`/api/bonus-face-sheets/mapped-face-sheets?loadlist_id=${loadlist.id}&bonus_face_sheet_id=${firstBonusFaceSheet.id}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setMappedFaceSheets(result.data);
          }
        })
        .catch(err => console.error('Failed to fetch mapped face sheets:', err));
      
      setIsBonusPrintModalOpen(true);
      return;
    }

    if (hasFaceSheets) {
      // Open delivery document for face sheets
      const faceSheetIds = (loadlist as any).face_sheets.map((fs: any) => fs.id).join(',');
      window.open(
        `/api/face-sheets/delivery-document?face_sheet_ids=${faceSheetIds}`,
        '_blank'
      );
      return;
    }
    
    // Original print logic for picklists
    console.log('Printing loadlist:', loadlist);
    console.log('Loading door:', loadlist.loading_door_number);
    console.log('Loading queue:', loadlist.loading_queue_number);
    console.log('Picklists:', loadlist.picklists);
    console.log('Orders in picklists:', loadlist.picklists?.map(p => ({ 
      picklist_code: p.picklist_code, 
      orders_count: p.orders?.length || 0,
      orders: p.orders 
    })));
    setPrintLoadlist(loadlist);
    setIsPrintModalOpen(true);

    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('กรุณาอนุญาตให้เปิดหน้าต่างใหม่สำหรับการพิมพ์');
        return;
      }

      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);

      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(tempDiv);
        root.render(
          <DeliveryOrderDocument
            loadlist={loadlist}
            generatedAt={new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
          />
        );

        setTimeout(() => {
          const printContent = tempDiv.innerHTML;
          const cssContent = `
            @page { size: A4 portrait; margin: 10mm; }
            body {
              font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
              font-size: 12pt;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
            }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
          `;

          printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="th">
              <head>
                <meta charset="UTF-8">
                <title>ใบโหลดสินค้า: ${loadlist.loadlist_code}</title>
                <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap" rel="stylesheet">
                <style>${cssContent}</style>
              </head>
              <body>${printContent}</body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
          document.body.removeChild(tempDiv);
          setIsPrintModalOpen(false);
        }, 500);
      });
    }, 100);
  };

  // ฟังก์ชันปริ้นใบปะหน้าของแถมตามใบปะหน้าที่เลือก
  const handlePrintBonusFaceSheetByFaceSheets = () => {
    if (!bonusFaceSheetToPrint || selectedFaceSheetsForPrint.length === 0) {
      alert('กรุณาเลือกใบปะหน้าอย่างน้อย 1 รายการ');
      return;
    }

    // เปิดหน้าปริ้นสำหรับแต่ละ face_sheet ที่เลือก
    selectedFaceSheetsForPrint.forEach((faceSheetId) => {
      window.open(
        `/api/bonus-face-sheets/print?id=${bonusFaceSheetToPrint.id}&face_sheet_id=${faceSheetId}`,
        '_blank'
      );
    });

    setIsBonusPrintModalOpen(false);
    setBonusFaceSheetToPrint(null);
    setSelectedFaceSheetsForPrint([]);
    setCurrentLoadlistIdForPrint(null);
  };

  // ฟังก์ชันปริ้นใบหยิบสินค้า (Pick List) สำหรับ bonus face sheet
  const handlePrintPickList = async (loadlist: Loadlist) => {
    const hasBonusFaceSheets = (loadlist as any).bonus_face_sheets && (loadlist as any).bonus_face_sheets.length > 0;
    if (!hasBonusFaceSheets) {
      alert('ใบโหลดนี้ไม่มีใบปะหน้าของแถม');
      return;
    }

    const bonusFaceSheet = (loadlist as any).bonus_face_sheets[0];
    setPrintingPickListId(loadlist.id);

    let printWindow: Window | null = null;

    try {
      // Fetch pick list data
      const response = await fetch(`/api/bonus-face-sheets/pick-list?id=${bonusFaceSheet.id}&loadlist_id=${loadlist.id}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || 'ไม่สามารถดึงข้อมูลใบหยิบสินค้าได้');
        return;
      }

      const data = result.data;

      // Create print window
      printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('กรุณาอนุญาตป๊อปอัพเพื่อใช้งานการพิมพ์');
        return;
      }

      // Render component
      const tempContainer = document.createElement('div');
      document.body.appendChild(tempContainer);

      const { createRoot } = await import('react-dom/client');
      const BonusPickListDocument = (await import('@/components/receiving/BonusPickListDocument')).default;
      
      const root = createRoot(tempContainer);
      root.render(
        <BonusPickListDocument
          faceSheetNo={data.face_sheet_no}
          createdDate={data.created_date}
          tripGroups={data.trip_groups}
          loadlistCode={data.loadlist_code}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 300));

      const printContent = tempContainer.innerHTML;
      const cssContent = `
        @page { size: A4 portrait; margin: 10mm; }
        body {
          font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        table { page-break-inside: avoid; }
      `;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="th">
          <head>
            <meta charset="UTF-8">
            <title>ใบหยิบสินค้า: ${data.face_sheet_no}</title>
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>${cssContent}</style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      printWindow.document.close();

      setTimeout(() => {
        printWindow?.print();
      }, 500);

      // Cleanup
      root.unmount();
      document.body.removeChild(tempContainer);
    } catch (err: any) {
      console.error('Error printing pick list:', err);
      alert(err.message || 'ไม่สามารถพิมพ์ใบหยิบสินค้าได้');
      if (printWindow && !printWindow.closed) {
        printWindow.close();
      }
    } finally {
      setPrintingPickListId(null);
    }
  };

  // ฟังก์ชันยืนยันหยิบของแถมไป PQTD/MRTD
  const handleConfirmPickToStaging = async (loadlist: Loadlist) => {
    const hasBonusFaceSheets = (loadlist as any).bonus_face_sheets && (loadlist as any).bonus_face_sheets.length > 0;
    if (!hasBonusFaceSheets) {
      alert('ใบโหลดนี้ไม่มีใบปะหน้าของแถม');
      return;
    }

    const bonusFaceSheet = (loadlist as any).bonus_face_sheets[0];
    
    // ดึงจำนวน packages ที่มี trip_number (แมพสายรถแล้ว)
    let mappedPackagesCount = bonusFaceSheet.total_packages;
    try {
      const countResponse = await fetch(`/api/bonus-face-sheets/pick-list?id=${bonusFaceSheet.id}&loadlist_id=${loadlist.id}`);
      const countResult = await countResponse.json();
      if (countResult.success && countResult.data) {
        // นับจำนวน packages จาก trip_groups
        mappedPackagesCount = countResult.data.trip_groups?.reduce(
          (sum: number, group: any) => sum + (group.packages?.length || 0), 0
        ) || 0;
      }
    } catch (err) {
      console.error('Error fetching mapped packages count:', err);
    }
    
    if (mappedPackagesCount === 0) {
      alert('ไม่พบแพ็คที่แมพสายรถแล้ว กรุณาสร้างใบโหลดก่อน');
      return;
    }
    
    // Confirm before proceeding
    const confirmed = window.confirm(
      `ยืนยันหยิบของแถมไปจุดพักรอโหลด?\n\n` +
      `ใบปะหน้า: ${bonusFaceSheet.face_sheet_no}\n` +
      `จำนวนแพ็คที่มีสายรถ: ${mappedPackagesCount} แพ็ค\n\n` +
      `ระบบจะย้ายสต็อกจาก PQ01-PQ10, MR01-MR10 ไปยัง PQTD/MRTD`
    );

    if (!confirmed) return;

    setConfirmingPickId(loadlist.id);

    try {
      const response = await fetch('/api/bonus-face-sheets/confirm-pick-to-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadlist_id: loadlist.id,
          bonus_face_sheet_id: bonusFaceSheet.id
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || 'ไม่สามารถยืนยันหยิบได้');
        return;
      }

      alert(`✅ ${result.message}`);
      
      // Refresh loadlists
      await fetchLoadlists();
    } catch (err: any) {
      console.error('Error confirming pick:', err);
      alert(err.message || 'เกิดข้อผิดพลาดในการยืนยันหยิบ');
    } finally {
      setConfirmingPickId(null);
    }
  };

  return (
    <>
      <PageContainer>
        <PageHeaderWithFilters title="ใบโหลดสินค้า (Loadlists)">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="ค้นหารหัสใบโหลด, ทะเบียนรถ, ชื่อคนขับ..."
          />
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="text-xs py-1 px-2 bg-green-500 hover:bg-green-600"
            onClick={handleOpenCreateModal}
          >
            สร้างใบโหลดใหม่
          </Button>
        </PageHeaderWithFilters>

        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-thai-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-sm font-thai">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchLoadlists} className="mt-4">
                ลองอีกครั้ง
              </Button>
            </div>
          ) : filteredLoadlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-thai-gray-500">
              <Truck className="w-12 h-12 mb-2" />
              <p className="text-sm font-thai">ไม่พบใบโหลดสินค้า</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto thin-scrollbar">
              <table className="min-w-full border-collapse text-sm table-fixed">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="w-[10%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('loadlist_code')}>
                        รหัสใบโหลด{getSortIcon('loadlist_code')}
                      </th>
                      <th className="w-[8%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        รหัสแผนส่ง
                      </th>
                      <th className="w-[8%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        คันที่
                      </th>
                      <th className="w-[8%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        เลขงานจัดส่ง
                      </th>
                      <th className="w-[6%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        ประตูโหลด
                      </th>
                      <th className="w-[5%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        คิว
                      </th>
                      <th className="w-[10%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        ผู้เช็คโหลด
                      </th>
                      <th className="w-[7%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        ประเภทรถ
                      </th>
                      <th className="w-[8%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        ทะเบียนรถ
                      </th>
                      <th className="w-[10%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        คนขับ
                      </th>
                      <th className="w-[11%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('created_at')}>
                        วันที่สร้าง{getSortIcon('created_at')}
                      </th>
                      <th className="w-[6%] px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">
                        สถานะ
                      </th>
                      <th className="w-[3%] px-2 py-2 text-center text-xs font-semibold border-b">
                        ดำเนินการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {filteredLoadlists.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((loadlist) => {
                      // ตรวจสอบประเภทเอกสารและแสดงเลขงานจัดส่งที่เหมาะสม
                      const hasPicklists = loadlist.picklists && loadlist.picklists.length > 0;
                      const hasFaceSheets = (loadlist as any).face_sheets && (loadlist as any).face_sheets.length > 0;
                      const hasBonusFaceSheets = (loadlist as any).bonus_face_sheets && (loadlist as any).bonus_face_sheets.length > 0;
                      
                      // แสดงเลขงานจัดส่งตามประเภท
                      let displayDeliveryNumber = '-';
                      let deliveryNumberStyle = 'text-gray-700 font-medium';
                      
                      if (hasPicklists) {
                        // Picklist: แสดง delivery_number จริง
                        displayDeliveryNumber = loadlist.delivery_number || '-';
                      } else if (hasFaceSheets) {
                        // Face Sheet: แสดง face_sheet_no
                        const faceSheet = (loadlist as any).face_sheets[0];
                        displayDeliveryNumber = faceSheet?.face_sheet_no || loadlist.delivery_number || '-';
                        deliveryNumberStyle = 'text-orange-600 font-medium';
                      } else if (hasBonusFaceSheets) {
                        // Bonus Face Sheet: แสดง face_sheet_no
                        const bonusFaceSheet = (loadlist as any).bonus_face_sheets[0];
                        displayDeliveryNumber = bonusFaceSheet?.face_sheet_no || loadlist.delivery_number || '-';
                        deliveryNumberStyle = 'text-pink-600 font-medium';
                      }
                      
                      return (
                      <tr key={loadlist.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-semibold text-green-600">
                          {loadlist.loadlist_code}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-blue-600 font-mono text-xs">
                          {loadlist.route_plan?.plan_code || '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-purple-600 font-mono text-xs">
                          {loadlist.trip?.daily_trip_number ? `คันที่ ${loadlist.trip.daily_trip_number}` : '-'}
                        </td>
                        <td className={`px-2 py-0.5 border-r border-gray-100 whitespace-nowrap ${deliveryNumberStyle}`}>
                          {displayDeliveryNumber}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.loading_door_number || (loadlist.picklists && loadlist.picklists.length > 0 ? loadlist.picklists[0].loading_door_number : '') || ''}
                            onChange={async (e) => {
                              const newDoorNumber = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ loading_door_number: newDoorNumber })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update door number:', err);
                              }
                            }}
                            className="w-20 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="D01">D01</option>
                            <option value="D02">D02</option>
                            <option value="D03">D03</option>
                            <option value="D04">D04</option>
                            <option value="D05">D05</option>
                            <option value="D06">D06</option>
                            <option value="D07">D07</option>
                            <option value="D08">D08</option>
                            <option value="D09">D09</option>
                            <option value="D10">D10</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.loading_queue_number || ''}
                            onChange={async (e) => {
                              const newQueueNumber = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ loading_queue_number: newQueueNumber })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update queue number:', err);
                              }
                            }}
                            className="w-20 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="Q-01">Q-01</option>
                            <option value="Q-02">Q-02</option>
                            <option value="Q-03">Q-03</option>
                            <option value="Q-04">Q-04</option>
                            <option value="Q-05">Q-05</option>
                            <option value="Q-06">Q-06</option>
                            <option value="Q-07">Q-07</option>
                            <option value="Q-08">Q-08</option>
                            <option value="Q-09">Q-09</option>
                            <option value="Q-10">Q-10</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {loadlist.checker_employee
                            ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}`
                            : '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.vehicle_type || ''}
                            onChange={async (e) => {
                              const newVehicleType = e.target.value || null;
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ vehicle_type: newVehicleType })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update vehicle type:', err);
                              }
                            }}
                            className="w-24 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="4 ล้อ">4 ล้อ</option>
                            <option value="6 ล้อ">6 ล้อ</option>
                            <option value="10 ล้อ">10 ล้อ</option>
                            <option value="กระบะ">กระบะ</option>
                            <option value="ตู้">ตู้</option>
                            <option value="เทรลเลอร์">เทรลเลอร์</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.vehicle?.vehicle_id || ''}
                            onChange={async (e) => {
                              const newVehicleId = e.target.value || null;
                              console.log('🚗 Updating vehicle:', { loadlist_id: loadlist.id, new_vehicle_id: newVehicleId });
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ vehicle_id: newVehicleId })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update vehicle:', err);
                              }
                            }}
                            className="w-28 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                            title={`Vehicles available: ${vehicles.length}, Current: ${loadlist.vehicle?.vehicle_id || 'none'}`}
                          >
                            <option value="">-- เลือก --</option>
                            {vehicles.length === 0 ? (
                              <option disabled>ไม่มีข้อมูลรถ</option>
                            ) : (
                              vehicles.map((vehicle) => (
                                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                                  {vehicle.plate_number}
                                </option>
                              ))
                            )}
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={loadlist.driver?.employee_id || ''}
                            onChange={async (e) => {
                              const newDriverId = e.target.value ? Number(e.target.value) : null;
                              console.log('👤 Updating driver:', { loadlist_id: loadlist.id, new_driver_id: newDriverId });
                              try {
                                const response = await fetch(`/api/loadlists/${loadlist.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ driver_employee_id: newDriverId })
                                });
                                if (response.ok) {
                                  await fetchLoadlists();
                                }
                              } catch (err) {
                                console.error('Failed to update driver:', err);
                              }
                            }}
                            className="w-32 px-1 py-0.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700"
                            title={`Drivers available: ${drivers.length}, Current: ${loadlist.driver?.employee_id || 'none'}`}
                          >
                            <option value="">
                              {loadlist.driver 
                                ? `${loadlist.driver.first_name} ${loadlist.driver.last_name}`.trim()
                                : (loadlist.vehicle?.model || '-- เลือก --')
                              }
                            </option>
                            {drivers
                              .filter(emp => emp.position?.includes('ขับ') || emp.position?.toLowerCase().includes('driver'))
                              .map((driver) => (
                                <option key={driver.employee_id} value={driver.employee_id}>
                                  {driver.first_name} {driver.last_name}
                                </option>
                              ))
                            }
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                          {new Date(loadlist.created_at).toLocaleString()}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          {getStatusBadge(loadlist.status)}
                        </td>
                        <td className="px-2 py-0.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handlePrintLoadlist(loadlist)}
                              className="p-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors"
                              title="พิมพ์ใบโหลด"
                            >
                              <Printer className="w-3 h-3" />
                            </button>
                            {/* ปุ่มพิมพ์ใบหยิบสินค้า - แสดงเฉพาะ loadlist ที่มี bonus face sheet */}
                            {hasBonusFaceSheets && (
                              <button
                                onClick={() => handlePrintPickList(loadlist)}
                                className="p-1 rounded hover:bg-cyan-50 hover:text-cyan-600 transition-colors disabled:opacity-60"
                                title="พิมพ์ใบหยิบสินค้า"
                                disabled={printingPickListId === loadlist.id}
                              >
                                {printingPickListId === loadlist.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <FileText className="w-3 h-3" />
                                )}
                              </button>
                            )}
                            {/* ปุ่มยืนยันหยิบไป PQTD/MRTD - แสดงเฉพาะ loadlist ที่มี bonus face sheet */}
                            {hasBonusFaceSheets && (
                              <button
                                onClick={() => handleConfirmPickToStaging(loadlist)}
                                className="p-1 rounded hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-60"
                                title="ยืนยันหยิบไปจุดพักรอโหลด"
                                disabled={confirmingPickId === loadlist.id}
                              >
                                {confirmingPickId === loadlist.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
            </div>
          )}
          <PaginationBar
            currentPage={currentPage}
            totalItems={filteredLoadlists.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </PageContainer>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="สร้างใบโหลดสินค้า"
        size="4xl"
      >
        <div className="space-y-4">
          {createError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">ข้อผิดพลาด:</strong>
              <span className="block sm:inline ml-2">{createError}</span>
            </div>
          )}

          {/* Tabs for Picklists, Face Sheets, and Bonus Face Sheets */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('picklists')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'picklists'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Package className="w-4 h-4 inline-block mr-2" />
                ใบจัดสินค้า ({selectedPicklists.length})
              </button>
              <button
                onClick={() => setActiveTab('face-sheets')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'face-sheets'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-4 h-4 inline-block mr-2" />
                ใบปะหน้า ({selectedFaceSheets.length})
              </button>
              <button
                onClick={() => setActiveTab('bonus-face-sheets')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'bonus-face-sheets'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-4 h-4 inline-block mr-2" />
                ใบปะหน้าของแถม ({selectedBonusFaceSheets.length})
              </button>
            </div>
          </div>

          {/* Picklists Tab */}
          {activeTab === 'picklists' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPicklists.length === availablePicklists.length && availablePicklists.length > 0}
                    onChange={handleToggleAllPicklists}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    เลือกใบจัดสินค้าทั้งหมด ({selectedPicklists.length}/{availablePicklists.length})
                  </span>
                </label>
              </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                      <span className="sr-only">เลือก</span>
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบจัด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เที่ยวรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จังหวัด</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">จุดส่ง</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">น้ำหนักรวม (kg)</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผู้เช็ค</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประเภทรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทะเบียนรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คนขับ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ประตูโหลด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คิว</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขงานจัดส่ง</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                  {availablePicklists.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                        ไม่พบใบจัดสินค้าที่สถานะ "เสร็จสิ้น"
                      </td>
                    </tr>
                  ) : (
                    availablePicklists.map((picklist) => (
                      <tr
                        key={picklist.id}
                        className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                          selectedPicklists.includes(picklist.id) ? 'bg-green-50' : ''
                        }`}
                      >
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedPicklists.includes(picklist.id)}
                            onChange={() => handleTogglePicklist(picklist.id)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">{picklist.picklist_code}</td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">{picklist.trip.trip_code}</td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700 font-medium">
                          {picklist.province || '-'}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                          {picklist.total_stops?.toLocaleString('en-US') || '-'}
                        </td>
                        <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-purple-600">
                          {picklist.total_weight ? picklist.total_weight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={getPicklistFormValue(picklist, 'checkerEmployeeId')}
                            onChange={(e) => updatePicklistFormData(picklist.id, 'checkerEmployeeId', e.target.value ? Number(e.target.value) : '')}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="">-- เลือก --</option>
                            {employees.map((emp) => (
                              <option key={emp.employee_id} value={emp.employee_id}>
                                {emp.first_name} {emp.last_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={getPicklistFormValue(picklist, 'vehicleType')}
                            onChange={(e) => updatePicklistFormData(picklist.id, 'vehicleType', e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="4 ล้อ">4 ล้อ</option>
                            <option value="6 ล้อ">6 ล้อ</option>
                            <option value="10 ล้อ">10 ล้อ</option>
                            <option value="กระบะ">กระบะ</option>
                            <option value="ตู้">ตู้</option>
                            <option value="เทรลเลอร์">เทรลเลอร์</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={getPicklistFormValue(picklist, 'vehicleId')}
                            onChange={(e) => {
                              const selectedVehicleId = e.target.value;
                              updatePicklistFormData(picklist.id, 'vehicleId', selectedVehicleId);
                              // Auto-update driver name from vehicle.model when vehicle is selected
                              if (selectedVehicleId) {
                                const selectedVehicle = vehicles.find(v => String(v.vehicle_id) === selectedVehicleId);
                                if (selectedVehicle) {
                                  const driverNameFromVehicle = selectedVehicle.model || '';
                                  updatePicklistFormData(picklist.id, 'driverName', driverNameFromVehicle);
                                  
                                  // Try to find matching employee by name
                                  if (driverNameFromVehicle) {
                                    const matchingEmployee = employees.find(emp => {
                                      const fullName = `${emp.first_name} ${emp.last_name}`.trim();
                                      return fullName.includes(driverNameFromVehicle) || driverNameFromVehicle.includes(emp.first_name);
                                    });
                                    if (matchingEmployee) {
                                      updatePicklistFormData(picklist.id, 'driverEmployeeId', matchingEmployee.employee_id);
                                    } else {
                                      updatePicklistFormData(picklist.id, 'driverEmployeeId', '');
                                    }
                                  } else {
                                    updatePicklistFormData(picklist.id, 'driverEmployeeId', '');
                                  }
                                }
                              } else {
                                updatePicklistFormData(picklist.id, 'driverName', '');
                                updatePicklistFormData(picklist.id, 'driverEmployeeId', '');
                              }
                            }}
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="">-- เลือก --</option>
                            {vehicles.map((vehicle) => (
                              <option key={vehicle.vehicle_id} value={String(vehicle.vehicle_id)}>
                                {vehicle.plate_number}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={getPicklistFormValue(picklist, 'driverEmployeeId')}
                            onChange={(e) => {
                              const selectedDriverId = e.target.value ? parseInt(e.target.value, 10) : '';
                              updatePicklistFormData(picklist.id, 'driverEmployeeId', selectedDriverId);
                              if (selectedDriverId) {
                                const selectedEmployee = employees.find(emp => emp.employee_id === selectedDriverId);
                                if (selectedEmployee) {
                                  updatePicklistFormData(picklist.id, 'driverName', `${selectedEmployee.first_name} ${selectedEmployee.last_name}`.trim());
                                }
                              }
                            }}
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="">
                              {getPicklistFormValue(picklist, 'driverName') || picklist.trip?.driver_name || '-- เลือก --'}
                            </option>
                            {employees
                              .filter(emp => emp.position?.includes('ขับ') || emp.position?.toLowerCase().includes('driver'))
                              .map((employee) => (
                                <option key={employee.employee_id} value={employee.employee_id}>
                                  {`${employee.first_name} ${employee.last_name}`.trim()}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={getPicklistFormValue(picklist, 'loadingDoorNumber')}
                            onChange={(e) => updatePicklistFormData(picklist.id, 'loadingDoorNumber', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="D01">D01</option>
                            <option value="D02">D02</option>
                            <option value="D03">D03</option>
                            <option value="D04">D04</option>
                            <option value="D05">D05</option>
                            <option value="D06">D06</option>
                            <option value="D07">D07</option>
                            <option value="D08">D08</option>
                            <option value="D09">D09</option>
                            <option value="D10">D10</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <select
                            value={getPicklistFormValue(picklist, 'loadingQueueNumber')}
                            onChange={(e) => updatePicklistFormData(picklist.id, 'loadingQueueNumber', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="">-- เลือก --</option>
                            <option value="Q-01">Q-01</option>
                            <option value="Q-02">Q-02</option>
                            <option value="Q-03">Q-03</option>
                            <option value="Q-04">Q-04</option>
                            <option value="Q-05">Q-05</option>
                            <option value="Q-06">Q-06</option>
                            <option value="Q-07">Q-07</option>
                            <option value="Q-08">Q-08</option>
                            <option value="Q-09">Q-09</option>
                            <option value="Q-10">Q-10</option>
                          </select>
                        </td>
                        <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                          <input
                            type="text"
                            value={getPicklistFormValue(picklist, 'deliveryNumber')}
                            onChange={(e) => updatePicklistFormData(picklist.id, 'deliveryNumber', e.target.value)}
                            placeholder="S002855"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          <Badge variant="success" size="sm">เสร็จสิ้น</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {/* Face Sheets Tab */}
          {activeTab === 'face-sheets' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFaceSheets.length === availableFaceSheets.length && availableFaceSheets.length > 0}
                    onChange={() => {
                      if (selectedFaceSheets.length === availableFaceSheets.length) {
                        setSelectedFaceSheets([]);
                      } else {
                        setSelectedFaceSheets(availableFaceSheets.map(fs => fs.id));
                      }
                    }}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    เลือกใบปะหน้าทั้งหมด ({selectedFaceSheets.length}/{availableFaceSheets.length})
                  </span>
                </label>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                        <span className="sr-only">เลือก</span>
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบปะหน้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เลขคัน</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ชิ้น</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ออเดอร์</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">คลัง</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ผู้เช็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {availableFaceSheets.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          ไม่พบใบปะหน้าที่สถานะ "เสร็จสิ้น"
                        </td>
                      </tr>
                    ) : (
                      availableFaceSheets.map((faceSheet, index) => (
                        <tr
                          key={faceSheet.id}
                          className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                            selectedFaceSheets.includes(faceSheet.id) ? 'bg-green-50' : ''
                          }`}
                        >
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedFaceSheets.includes(faceSheet.id)}
                              onChange={() => {
                                if (selectedFaceSheets.includes(faceSheet.id)) {
                                  setSelectedFaceSheets(selectedFaceSheets.filter(id => id !== faceSheet.id));
                                } else {
                                  setSelectedFaceSheets([...selectedFaceSheets, faceSheet.id]);
                                }
                              }}
                              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                            />
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">
                            {faceSheet.face_sheet_no}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            {faceSheet.daily_trip_numbers_display && faceSheet.daily_trip_numbers_display !== '-' ? (
                              <span className="text-green-600 font-semibold">{faceSheet.daily_trip_numbers_display}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                            {faceSheet.total_packages}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-purple-600">
                            {faceSheet.total_items}
                          </td>
                          <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-green-600">
                            {faceSheet.total_orders}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                            {faceSheet.warehouse_id}
                          </td>
                          <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap">
                            {index === 0 ? (
                              <select
                                value={checkerEmployeeId}
                                onChange={(e) => setCheckerEmployeeId(e.target.value ? Number(e.target.value) : '')}
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                              >
                                <option value="">-- เลือก --</option>
                                {employees.map((emp) => (
                                  <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.first_name} {emp.last_name}
                                  </option>
                                ))}
                              </select>
                            ) : checkerEmployeeId ? (
                              <span className="text-gray-400 text-xs">
                                {employees.find(e => e.employee_id === checkerEmployeeId)?.first_name || '-'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="success" size="sm">เสร็จสิ้น</Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bonus Face Sheets Tab - ให้ผู้ใช้เลือกแมพสายรถและใบปะหน้าเอง */}
          {activeTab === 'bonus-face-sheets' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
                <span className="text-sm font-medium text-gray-700">
                  เลือกใบปะหน้าของแถมและแมพกับสายรถ/ใบปะหน้า ({selectedBonusFaceSheets.length}/{availableBonusFaceSheets.length})
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto border rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap w-12">
                        <span className="sr-only">เลือก</span>
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบปะหน้าของแถม</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">แพ็ค</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[180px]">เลือกใบหยิบ</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[180px]">เลือกใบปะหน้า</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap min-w-[140px]">ผู้เช็ค</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                    {availableBonusFaceSheets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          ไม่พบใบปะหน้าของแถมที่สถานะ "เสร็จสิ้น"
                        </td>
                      </tr>
                    ) : (
                      availableBonusFaceSheets.map((bonusFaceSheet) => {
                        const isUsed = bonusFaceSheet.is_used === true;
                        const isSelected = selectedBonusFaceSheets.includes(bonusFaceSheet.id);
                        const mapping = bonusFaceSheetMappings[bonusFaceSheet.id] || { selectedPicklistId: null, selectedFaceSheetId: null };
                        
                        return (
                          <tr
                            key={bonusFaceSheet.id}
                            className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                              isSelected 
                                ? 'bg-green-50' 
                                : isUsed 
                                  ? 'bg-gray-100 opacity-60' 
                                  : ''
                            }`}
                          >
                            <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedBonusFaceSheets(selectedBonusFaceSheets.filter(id => id !== bonusFaceSheet.id));
                                  } else {
                                    if (isUsed) {
                                      const confirmSelect = window.confirm(
                                        `ใบปะหน้าของแถม ${bonusFaceSheet.face_sheet_no} ถูกใช้ในใบโหลดแล้ว\nต้องการเลือกหรือไม่?`
                                      );
                                      if (!confirmSelect) return;
                                    }
                                    setSelectedBonusFaceSheets([...selectedBonusFaceSheets, bonusFaceSheet.id]);
                                  }
                                }}
                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                              />
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-mono text-purple-600 font-semibold">{bonusFaceSheet.face_sheet_no}</span>
                                <span className="text-[10px] text-gray-500">
                                  {bonusFaceSheet.delivery_date ? `ส่ง: ${bonusFaceSheet.delivery_date}` : ''}
                                </span>
                                {isUsed && (
                                  <Badge variant="warning" size="sm" className="mt-0.5 w-fit">
                                    <span className="text-[9px]">ใช้แล้ว</span>
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                              <span className="font-semibold text-blue-600">{bonusFaceSheet.total_packages}</span>
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100">
                              <select
                                value={mapping.selectedPicklistId || ''}
                                onChange={(e) => setBonusFaceSheetMappings(prev => ({
                                  ...prev,
                                  [bonusFaceSheet.id]: {
                                    ...prev[bonusFaceSheet.id],
                                    selectedPicklistId: e.target.value ? Number(e.target.value) : null
                                  }
                                }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                disabled={!isSelected}
                              >
                                <option value="">-- เลือกใบหยิบ --</option>
                                {allPicklistsForDropdown.map((pl) => (
                                  <option key={pl.id} value={pl.id}>
                                    {pl.picklist_code}
                                    {pl.daily_trip_number ? ` (คัน ${pl.daily_trip_number})` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100">
                              <select
                                value={mapping.selectedFaceSheetId || ''}
                                onChange={(e) => setBonusFaceSheetMappings(prev => ({
                                  ...prev,
                                  [bonusFaceSheet.id]: {
                                    ...prev[bonusFaceSheet.id],
                                    selectedFaceSheetId: e.target.value ? Number(e.target.value) : null
                                  }
                                }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                disabled={!isSelected}
                              >
                                <option value="">-- เลือกใบปะหน้า --</option>
                                {availableFaceSheets.map((fs) => (
                                  <option key={fs.id} value={fs.id}>
                                    {fs.face_sheet_no} ({fs.total_packages} แพ็ค)
                                    {fs.daily_trip_numbers_display && fs.daily_trip_numbers_display !== '-' 
                                      ? ` - คัน ${fs.daily_trip_numbers_display}` 
                                      : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 border-r border-gray-100">
                              <select
                                value={bonusFaceSheetCheckers[bonusFaceSheet.id] ?? ''}
                                onChange={(e) => setBonusFaceSheetCheckers(prev => ({
                                  ...prev,
                                  [bonusFaceSheet.id]: e.target.value ? Number(e.target.value) : ''
                                }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                disabled={!isSelected}
                              >
                                <option value="">-- เลือกผู้เช็ค --</option>
                                {employees.map((emp) => (
                                  <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.first_name} {emp.last_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1 text-center">
                              {isUsed ? (
                                <Badge variant="default" size="sm">
                                  <span className="text-[10px]">ใช้แล้ว</span>
                                </Badge>
                              ) : isSelected && mapping.selectedPicklistId && mapping.selectedFaceSheetId ? (
                                <Badge variant="success" size="sm">
                                  <span className="text-[10px]">พร้อม</span>
                                </Badge>
                              ) : isSelected ? (
                                <Badge variant="warning" size="sm">
                                  <span className="text-[10px]">รอเลือก</span>
                                </Badge>
                              ) : (
                                <Badge variant="info" size="sm">
                                  <span className="text-[10px]">รอเลือก</span>
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* แสดงสรุปการเลือก */}
              {selectedBonusFaceSheets.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg text-xs">
                  <div className="font-semibold text-blue-700 mb-2">สรุปการเลือก:</div>
                  <div className="space-y-1">
                    {selectedBonusFaceSheets.map(bfsId => {
                      const bfs = availableBonusFaceSheets.find(b => b.id === bfsId);
                      const mapping = bonusFaceSheetMappings[bfsId] || { selectedPicklistId: null, selectedFaceSheetId: null };
                      const selectedPicklist = allPicklistsForDropdown.find(p => p.id === mapping.selectedPicklistId);
                      const selectedFs = availableFaceSheets.find(f => f.id === mapping.selectedFaceSheetId);
                      
                      return (
                        <div key={bfsId} className="flex items-center gap-2 text-gray-700">
                          <span className="font-mono text-purple-600">{bfs?.face_sheet_no}</span>
                          <span>→</span>
                          <span className={selectedPicklist ? 'text-green-600' : 'text-red-500'}>
                            {selectedPicklist ? `${selectedPicklist.picklist_code}` : 'ยังไม่เลือกใบหยิบ'}
                          </span>
                          <span>+</span>
                          <span className={selectedFs ? 'text-green-600' : 'text-red-500'}>
                            {selectedFs ? selectedFs.face_sheet_no : 'ยังไม่เลือกใบปะหน้า'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={isCreating}>
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateLoadlist}
              disabled={isCreating || (selectedPicklists.length === 0 && selectedFaceSheets.length === 0 && selectedBonusFaceSheets.length === 0)}
              className="bg-green-500 hover:bg-green-600"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isCreating ? 'กำลังสร้าง...' : `สร้าง (${selectedPicklists.length + selectedFaceSheets.length + selectedBonusFaceSheets.length} รายการ)`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`รายละเอียดใบโหลด: ${viewingLoadlist?.loadlist_code || '-'}`}
        size="4xl"
      >
        {viewingLoadlist && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div>
                  <div className="text-xs text-gray-500">รหัสใบโหลด</div>
                  <div className="font-semibold text-green-600 break-all">{viewingLoadlist.loadlist_code}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">ทะเบียนรถ</div>
                  <div className="font-medium">{viewingLoadlist.vehicle?.plate_number || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">จำนวนใบจัด</div>
                  <div className="font-semibold text-blue-600">{viewingLoadlist.total_picklists.toLocaleString('en-US')}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">จำนวนพัสดุ</div>
                  <div className="font-semibold text-purple-600">{viewingLoadlist.total_packages.toLocaleString('en-US')}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                  ปิด
                </Button>
                <Button
                  variant="primary"
                  icon={Printer}
                  onClick={() => handlePrintLoadlist(viewingLoadlist)}
                  className="bg-green-500 hover:bg-green-600"
                >
                  พิมพ์ใบโหลด
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
              <table className="w-auto border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รหัสใบจัด</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">เที่ยวรถ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">ทะเบียนรถ</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">รายการ</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold border-b whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                  {viewingLoadlist.picklists.map(picklist => (
                    <tr key={picklist.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap font-mono text-blue-600">{picklist.picklist_code}</td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">{picklist.trip.trip_code}</td>
                      <td className="px-2 py-0.5 border-r border-gray-100 whitespace-nowrap text-gray-700">
                        {picklist.trip.vehicle?.plate_number || '-'}
                      </td>
                      <td className="px-2 py-0.5 text-center border-r border-gray-100 whitespace-nowrap font-semibold text-blue-600">
                        {picklist.total_lines.toLocaleString('en-US')}
                      </td>
                      <td className="px-2 py-0.5 whitespace-nowrap">
                        {getStatusBadge(picklist.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={printLoadlist ? `พิมพ์ใบโหลดสินค้า: ${printLoadlist.loadlist_code}` : 'พิมพ์ใบโหลดสินค้า'}
        size="4xl"
      >
        <div className="flex flex-col items-center justify-center py-10 text-gray-600">
          <p className="mb-4">เอกสารกำลังเปิดในหน้าต่างใหม่</p>
          <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>
            ปิด
          </Button>
        </div>
      </Modal>

      {/* Delivery Document Modal for Face Sheets */}
      <Modal
        isOpen={showDeliveryDocModal}
        onClose={() => {
          setShowDeliveryDocModal(false);
          setCreatedLoadlistId(null);
        }}
        title="สร้างใบโหลดสำเร็จ"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              สร้างใบโหลดสินค้าสำเร็จ
            </p>
            <p className="text-sm text-gray-600">
              ต้องการพิมพ์ใบส่งมอบหรือไม่?
            </p>
          </div>
          
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeliveryDocModal(false);
                setCreatedLoadlistId(null);
              }}
            >
              ไม่พิมพ์
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (createdLoadlistId && selectedFaceSheets.length > 0) {
                  // Open delivery document in new window
                  const faceSheetIds = selectedFaceSheets.join(',');
                  window.open(
                    `/api/face-sheets/delivery-document?face_sheet_ids=${faceSheetIds}`,
                    '_blank'
                  );
                }
                setShowDeliveryDocModal(false);
                setCreatedLoadlistId(null);
              }}
              className="bg-green-500 hover:bg-green-600"
            >
              พิมพ์ใบส่งมอบ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal เลือก Trip สำหรับปริ้นใบปะหน้าของแถม */}
      <Modal
        isOpen={isBonusPrintModalOpen}
        onClose={() => {
          setIsBonusPrintModalOpen(false);
          setBonusFaceSheetToPrint(null);
          setSelectedFaceSheetsForPrint([]);
          setCurrentLoadlistIdForPrint(null);
        }}
        title={`พิมพ์ใบเช็คของแถม: ${bonusFaceSheetToPrint?.face_sheet_no || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>คำแนะนำ:</strong> เลือกใบปะหน้าที่ต้องการปริ้นใบเช็คของแถม แต่ละใบปะหน้าจะปริ้นแยก 1 ใบ โดยแสดงเฉพาะรายการของแถมที่อยู่ในใบปะหน้านั้น
            </p>
            <p className="text-sm text-blue-600 mt-2">
              <strong>หมายเหตุ:</strong> ใบปะหน้าถูกแมพตอนสร้างใบโหลดสินค้า
            </p>
          </div>

          <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  mappedFaceSheets.length > 0 &&
                  selectedFaceSheetsForPrint.length === mappedFaceSheets.length
                }
                onChange={() => {
                  if (selectedFaceSheetsForPrint.length === mappedFaceSheets.length) {
                    setSelectedFaceSheetsForPrint([]);
                  } else {
                    setSelectedFaceSheetsForPrint(mappedFaceSheets.map(fs => fs.face_sheet_id));
                  }
                }}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">
                เลือกทั้งหมด ({selectedFaceSheetsForPrint.length}/{mappedFaceSheets.length})
              </span>
            </label>
          </div>

          <div className="max-h-80 overflow-y-auto border rounded-lg">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 w-12"></th>
                  <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200">เลขใบปะหน้า</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200">จำนวนแพ็คของแถม</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold border-b">จำนวนร้าน</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-[11px]">
                {mappedFaceSheets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : (
                  mappedFaceSheets.map((fs) => (
                    <tr
                      key={fs.face_sheet_id}
                      className={`hover:bg-blue-50/30 transition-colors duration-150 ${
                        selectedFaceSheetsForPrint.includes(fs.face_sheet_id) ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-2 py-1 border-r border-gray-100">
                        <input
                          type="checkbox"
                          checked={selectedFaceSheetsForPrint.includes(fs.face_sheet_id)}
                          onChange={() => {
                            if (selectedFaceSheetsForPrint.includes(fs.face_sheet_id)) {
                              setSelectedFaceSheetsForPrint(selectedFaceSheetsForPrint.filter(id => id !== fs.face_sheet_id));
                            } else {
                              setSelectedFaceSheetsForPrint([...selectedFaceSheetsForPrint, fs.face_sheet_id]);
                            }
                          }}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-gray-100 font-mono text-purple-600 font-semibold">
                        {fs.face_sheet_no}
                      </td>
                      <td className="px-2 py-1 text-center border-r border-gray-100 font-semibold text-blue-600">
                        {fs.bonus_package_count} แพ็ค
                      </td>
                      <td className="px-2 py-1 text-center font-semibold text-green-600">
                        {fs.bonus_order_count} ร้าน
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                // ปริ้นใบเช็คของแถมทั้งหมด (ไม่กรองตาม face sheet)
                if (bonusFaceSheetToPrint) {
                  window.open(
                    `/api/bonus-face-sheets/print?id=${bonusFaceSheetToPrint.id}`,
                    '_blank'
                  );
                }
              }}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              พิมพ์ทั้งหมด (ไม่กรอง)
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBonusPrintModalOpen(false);
                  setBonusFaceSheetToPrint(null);
                  setSelectedFaceSheetsForPrint([]);
                  setCurrentLoadlistIdForPrint(null);
                }}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                onClick={handlePrintBonusFaceSheetByFaceSheets}
                disabled={selectedFaceSheetsForPrint.length === 0}
                className="bg-green-500 hover:bg-green-600"
              >
                พิมพ์ ({selectedFaceSheetsForPrint.length} ใบ)
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default function LoadlistsPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.loadlists.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูรายการขนส่ง</p>
          </div>
        </div>
      }
    >
      <LoadlistsPage />
    </PermissionGuard>
  );
}
