'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Route,
    Plus,
    Search,
    TruckIcon,
    Package,
    Eye,
    Edit,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    ChevronDown,
    Play,
    MapPin,
    Printer,
    DollarSign,
    Trash2,
    PlayCircle,
    CheckCircle,
    AlertTriangle,
    FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { OptimizationSettings } from '@/components/vrp/OptimizationSidebar';
import OptimizationSidebar from '@/components/vrp/OptimizationSidebar';
import { PageContainer, PageHeaderWithFilters, SearchInput, FilterSelect } from '@/components/ui/page-components';
import RouteMap from '@/components/maps/RouteMap';
import PrintRoutePlanModal from '@/components/receiving/PrintRoutePlanModal';
import EditShippingCostModal from '@/components/receiving/EditShippingCostModal';
import TransportContractModal from '@/components/receiving/TransportContractModal';
import DraggableStopList from '@/components/receiving/DraggableStopList';
import EditorDraftOrdersPanel from '@/components/receiving/EditorDraftOrdersPanel';

// ===== Import Types & Utils จากไฟล์ที่แยกออกมา =====
import type {
    RoutePlan,
    DraftOrder,
    OrderItemDetail,
    StopOrderDetail,
    EditorStop,
    EditorTrip,
    SplitItemFormPayload,
    SplitFormPayload,
    BadgeVariant
} from './types';
import { MetricCard, SplitStopModal, MultiPlanContractModal, MultiPlanTransportContractModal, CrossPlanTransferModal, ConfirmDialog, RoutesPlanTable, CreatePlanModal, ExcelEditor } from './components';
import { 
    STATUSES, 
    STATUS_BADGE_MAP, 
    VRP_SETTINGS_STORAGE_KEY,
    resequenceTripStops,
    getStatusBadgeInfo,
    calculateTripShippingCost
} from './utils';

// --- Main Page Component ---

const RoutesPage = () => {

    const [searchTerm, setSearchTerm] = useState('');

    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    const [startDate, setStartDate] = useState('');

    const [endDate, setEndDate] = useState('');

    // แก้ไข: ใช้ `keyof` เพื่อความปลอดภัยของ Type

    const [sortField, setSortField] = useState<keyof RoutePlan | ''>( '');

    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');



    const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);

    const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
    const [draftOrderFilter, setDraftOrderFilter] = useState('');

    const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

    const [loading, setLoading] = useState(true);

    const [showCreateModal, setShowCreateModal] = useState(false);

    const [warehouses, setWarehouses] = useState<any[]>([]);



    const [planForm, setPlanForm] = useState({

        planCode: '',

        planName: '',

        planDate: new Date().toISOString().split('T')[0],

        warehouseId: ''

    });



    const [vrpSettings, setVrpSettings] = useState<OptimizationSettings>({

        vehicleCapacityKg: 1000,

        warehouseLat: 13.5838323,

        warehouseLng: 100.7576916,

        maxWorkingHours: 8,

        startTime: '08:00',

        endTime: '17:00',

        maxStops: 20,

        serviceTime: 15,

        zoneMethod: 'kmeans',

        numZones: 0,

        maxStoresPerZone: 10,

        consolidationEnabled: true,

        distanceThreshold: 150,

        detourFactor: 1.5,

        routingAlgorithm: 'insertion',

        localSearchMethod: '2opt',

        stopOrderingMethod: 'optimized',

        maxVehicles: 0,

        enforceVehicleLimit: false,

        avgSpeedKmh: 40,

        respectTimeWindows: 'flexible',

        ignoreSmallDeliveries: false,

        smallDeliveryWeightThreshold: 5,

        useMapboxApi: true,

        costPerKm: 5,

        costPerVehicle: 500,

        driverHourlyRate: 100,

        maxComputationTime: 60,

        optimizationCriteria: 'distance'

    });



    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);



    useEffect(() => {

        try {

            const savedSettings = localStorage.getItem(VRP_SETTINGS_STORAGE_KEY);

            if (savedSettings) {

                const parsedSettings = JSON.parse(savedSettings);

                setVrpSettings(prev => ({ ...prev, ...parsedSettings }));

                setStatusMessage('โหลดการตั้งค่า VRP ที่บันทึกไว้ล่าสุด');

                setTimeout(() => setStatusMessage(''), 3000);

            }

        } catch (error) {

            console.error("Failed to load VRP settings from localStorage", error);

        }

    }, []);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
    const optimizeLockRef = React.useRef<boolean>(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<any | null>(null);
    const [previewTrips, setPreviewTrips] = useState<any[]>([]);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorLoading, setEditorLoading] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [editorPlanId, setEditorPlanId] = useState<number | null>(null);
    const [editorWarehouse, setEditorWarehouse] =
        useState<{ latitude: number; longitude: number; name?: string | null } | null>(null);
    const [editorPlan, setEditorPlan] = useState<any | null>(null);
    const [editorTrips, setEditorTrips] = useState<EditorTrip[]>([]);
    const [selectedEditorTripId, setSelectedEditorTripId] = useState<number | null>(null);
    const [selectedEditorStopId, setSelectedEditorStopId] = useState<number | null>(null);
    const [selectedEditorOrderId, setSelectedEditorOrderId] = useState<number | null>(null);
    const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
    const [transferTripId, setTransferTripId] = useState<number | null>(null);
    const [editingStatusPlanId, setEditingStatusPlanId] = useState<number | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedPlanIdForPrint, setSelectedPlanIdForPrint] = useState<number | null>(null);

    const [showEditShippingCostModal, setShowEditShippingCostModal] = useState(false);
    const [selectedPlanIdForShippingCost, setSelectedPlanIdForShippingCost] = useState<number | null>(null);
    
    const [showTransportContractModal, setShowTransportContractModal] = useState(false);
    const [selectedPlanIdForContract, setSelectedPlanIdForContract] = useState<number | null>(null);
    const [showMultiPlanContractModal, setShowMultiPlanContractModal] = useState(false);
    // State สำหรับ Multi-Plan Transport Contract
    const [showMultiPlanTransportContractModal, setShowMultiPlanTransportContractModal] = useState(false);
    const [multiPlanSelectedTrips, setMultiPlanSelectedTrips] = useState<any[]>([]);
    const [multiPlanSupplierName, setMultiPlanSupplierName] = useState<string>('');
    // State สำหรับ Cross-Plan Transfer (ย้ายออเดอร์ข้ามแผน)
    const [showCrossPlanTransferModal, setShowCrossPlanTransferModal] = useState(false);
    const [crossPlanTransferStop, setCrossPlanTransferStop] = useState<EditorStop | null>(null);
    const [crossPlanTransferTripId, setCrossPlanTransferTripId] = useState<number>(0);
    const [selectedPreviewTripIndex, setSelectedPreviewTripIndex] = useState<number | null>(null);
    const [selectedPreviewTripIndices, setSelectedPreviewTripIndices] = useState<number[]>([]);
    const [editorDraftOrders, setEditorDraftOrders] = useState<DraftOrder[]>([]);

    // Expandable rows state
    const [expandedPlanIds, setExpandedPlanIds] = useState<Set<number>>(new Set());
    const [planTripsData, setPlanTripsData] = useState<Map<number, any[]>>(new Map());
    const [loadingTrips, setLoadingTrips] = useState<Set<number>>(new Set());
    const [editorDraftOrdersLoading, setEditorDraftOrdersLoading] = useState(false);

    // State สำหรับลบแผนจัดเส้นทาง
    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
        isOpen: boolean;
        planId: number;
        planCode: string;
        picklistsCount: number;
        warning: string | null;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchDraftOrders = useCallback(async (warehouseId: string, planDate: string, signal?: AbortSignal) => {
        try {
            const res = await fetch(`/api/route-plans/draft-orders?warehouseId=${warehouseId}&planDate=${planDate}`, { signal });
            if (signal?.aborted) return;
            const { data } = await res.json();
            if (!signal?.aborted) {
                setDraftOrders(data || []);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Error fetching draft orders:', error);
        }
    }, [setDraftOrders]);

    const fetchWarehouses = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch('/api/master-warehouse', { signal });
            if (signal?.aborted) return;
            const data = await res.json();
            const list = Array.isArray(data) ? data : data?.data || [];
            if (signal?.aborted) return;
            setWarehouses(list);

            if (list.length > 0) {
                const defaultWarehouse =
                    list.find((w: any) => w.warehouse_id === 'สินค้าสำเร็จรูป' || w.warehouse_name?.includes('สินค้าสำเร็จรูป')) ||
                    list[0];

                if (!signal?.aborted) {
                    setPlanForm(prev => {
                        if (prev.warehouseId) return prev;
                        return { ...prev, warehouseId: defaultWarehouse.warehouse_id };
                    });

                    setVrpSettings(prev => {
                        if (!defaultWarehouse.latitude || !defaultWarehouse.longitude) return prev;
                        return {
                            ...prev,
                            warehouseLat: Number(defaultWarehouse.latitude),
                            warehouseLng: Number(defaultWarehouse.longitude)
                        };
                    });
                }

                await fetchDraftOrders(defaultWarehouse.warehouse_id, planForm.planDate, signal);
            } else {
                if (!signal?.aborted) {
                    setDraftOrders([]);
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Error fetching warehouses:', error);
        }
    }, [fetchDraftOrders, planForm.planDate]);

    const fetchRoutePlans = useCallback(async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const res = await fetch('/api/route-plans', { signal });
            if (signal?.aborted) return;
            const { data, error } = await res.json();
            
            console.log('Fetched route plans:', { data, error, count: data?.length });
            
            if (error) {
                console.error('Error from API:', error);
            }
            
            if (!signal?.aborted) {
                setRoutePlans(data || []);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Error fetching route plans:', error);
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, []);

    const fetchEditorData = useCallback(async (planId: number, signal?: AbortSignal) => {
        // Bug #2 Fix: Create AbortController if not provided
        const abortController = signal ? null : new AbortController();
        const fetchSignal = signal || abortController!.signal;
        let isMounted = true;

        try {
            setEditorLoading(true);
            setEditorError(null);
            const res = await fetch(`/api/route-plans/${planId}/editor`, { signal: fetchSignal });
            if (fetchSignal?.aborted || !isMounted) return;
            const { data, error } = await res.json();
            if (error) {
                if (!fetchSignal?.aborted && isMounted) {
                    setEditorError(error);
                }
                return;
            }

            if (!fetchSignal?.aborted && isMounted) {
                setEditorPlan(data.plan);
                setEditorWarehouse(data.warehouse);
            }

            // Fetch draft orders for this plan (forEditor=true เพื่อดึงออเดอร์ร่างทั้งหมดไม่กรองตามวันที่)
            if (data.plan?.warehouse_id && !fetchSignal?.aborted && isMounted) {
                setEditorDraftOrdersLoading(true);
                try {
                    const draftRes = await fetch(
                        `/api/route-plans/draft-orders?warehouseId=${data.plan.warehouse_id}&forEditor=true`,
                        { signal: fetchSignal }
                    );
                    if (fetchSignal?.aborted || !isMounted) return;
                    const { data: draftData } = await draftRes.json();
                    if (!fetchSignal?.aborted && isMounted) {
                        setEditorDraftOrders(draftData || []);
                    }
                } catch (err: any) {
                    if (err.name === 'AbortError') return;
                    console.error('Error fetching editor draft orders:', err);
                    if (!fetchSignal?.aborted && isMounted) {
                        setEditorDraftOrders([]);
                    }
                } finally {
                    if (!fetchSignal?.aborted && isMounted) {
                        setEditorDraftOrdersLoading(false);
                    }
                }
            }

            // Debug: Log raw API response to see items
            console.log('📥 Raw API trips data:', {
                tripsCount: data.trips?.length || 0,
                firstTrip: data.trips?.[0] ? {
                    trip_id: data.trips[0].trip_id,
                    stopsCount: data.trips[0].stops?.length || 0,
                    firstStop: data.trips[0].stops?.[0] ? {
                        stop_id: data.trips[0].stops[0].stop_id,
                        ordersCount: data.trips[0].stops[0].orders?.length || 0,
                        firstOrder: data.trips[0].stops[0].orders?.[0] ? {
                            order_id: data.trips[0].stops[0].orders[0].order_id,
                            order_no: data.trips[0].stops[0].orders[0].order_no,
                            items: data.trips[0].stops[0].orders[0].items,
                            itemsCount: data.trips[0].stops[0].orders[0].items?.length || 0
                        } : null
                    } : null
                } : null
            });

            const tripsFromApi: EditorTrip[] = (data.trips || []).map((trip: any, index: number) => {
                const normalizedStops: EditorStop[] = (trip.stops || []).map((stop: any) => {
                    const normalizedOrders: StopOrderDetail[] = Array.isArray(stop.orders)
                        ? stop.orders
                            .map((order: any) => {
                                const orderId = Number(order.order_id);
                                if (!Number.isFinite(orderId)) return null;
                                const orderNo =
                                    typeof order.order_no === 'string'
                                        ? order.order_no
                                        : order.order_no != null
                                            ? String(order.order_no)
                                            : null;
                                const customerId =
                                    typeof order.customer_id === 'string' ? order.customer_id : order.customer_id ?? null;
                                const customerName =
                                    typeof order.customer_name === 'string' ? order.customer_name : order.customer_name ?? null;
                                const shopName =
                                    typeof order.shop_name === 'string' ? order.shop_name : order.shop_name ?? null;
                                const province =
                                    typeof order.province === 'string' ? order.province : order.province ?? null;
                                const allocatedWeight =
                                    order.allocated_weight_kg != null && Number.isFinite(Number(order.allocated_weight_kg))
                                        ? Number(order.allocated_weight_kg)
                                        : null;
                                const totalOrderWeight =
                                    order.total_order_weight_kg != null && Number.isFinite(Number(order.total_order_weight_kg))
                                        ? Number(order.total_order_weight_kg)
                                        : null;
                                const totalQty =
                                    order.total_qty != null && Number.isFinite(Number(order.total_qty))
                                        ? Number(order.total_qty)
                                        : null;
                                const note =
                                    typeof order.note === 'string' ? order.note : order.note ?? null;
                                const textFieldLong1 =
                                    typeof order.text_field_long_1 === 'string' ? order.text_field_long_1 : order.text_field_long_1 ?? null;

                                return {
                                    order_id: orderId,
                                    order_no: orderNo,
                                    customer_id: customerId,
                                    customer_name: customerName,
                                    shop_name: shopName,
                                    province: province,
                                    allocated_weight_kg: allocatedWeight,
                                    total_order_weight_kg: totalOrderWeight,
                                    total_qty: totalQty,
                                    note: note,
                                    text_field_long_1: textFieldLong1,
                                    items: Array.isArray(order.items) ? order.items : []
                                } as StopOrderDetail;
                            })
                            .filter((order: StopOrderDetail | null): order is StopOrderDetail => order !== null)
                        : [];

                    // Debug: Log normalized orders with items
                    if (normalizedOrders.length > 0) {
                        console.log('📋 Normalized orders for stop:', {
                            stop_id: stop.stop_id,
                            ordersCount: normalizedOrders.length,
                            firstOrder: {
                                order_id: normalizedOrders[0].order_id,
                                order_no: normalizedOrders[0].order_no,
                                items: normalizedOrders[0].items,
                                itemsCount: normalizedOrders[0].items?.length || 0
                            }
                        });
                    }

                    return {
                        ...stop,
                        order_ids: normalizedOrders.map(order => order.order_id),
                        orders: normalizedOrders
                    };
                });

                const normalizedTrip: EditorTrip = {
                    ...trip,
                    trip_number: trip.daily_trip_number ?? trip.trip_number ?? trip.trip_sequence ?? index + 1,
                    stops: normalizedStops
                };

                return normalizedTrip;
            });

            if (!fetchSignal?.aborted && isMounted) {
                setEditorTrips(tripsFromApi);

                const firstTrip = tripsFromApi[0];
                setSelectedEditorTripId(firstTrip?.trip_id ?? null);
                setSelectedEditorStopId(firstTrip?.stops?.[0]?.stop_id ?? null);
                setTransferTripId(firstTrip?.trip_id ?? null);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Error loading editor data:', error);
            if (isMounted) {
                setEditorError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            }
        } finally {
            if (isMounted) {
                setEditorLoading(false);
            }
        }

        // Bug #2 Fix: Cleanup function
        return () => {
            isMounted = false;
            if (abortController) {
                abortController.abort();
            }
        };
    }, []);

    useEffect(() => {
        const abortController = new AbortController();
        
        const loadInitialData = async () => {
            await fetchWarehouses(abortController.signal);
            await fetchRoutePlans(abortController.signal);
        };

        loadInitialData();

        return () => {
            abortController.abort();
        };
    }, [fetchWarehouses, fetchRoutePlans]);

    const handleSelectOrder = (orderId: number) => {
        const next = new Set(selectedOrders);
        if (next.has(orderId)) {
            next.delete(orderId);
        } else {
            next.add(orderId);
        }
        setSelectedOrders(next);
    };

    const handleSelectAll = () => {
        if (selectedOrders.size === filteredDraftOrders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(filteredDraftOrders.map(order => order.order_id)));
        }
    };

    const fetchNextPlanCode = useCallback(async (planDate: string) => {
        try {
            const res = await fetch(`/api/route-plans/next-code?date=${planDate}`);
            if (res.ok) {
                const data = await res.json();
                setPlanForm(prev => ({
                    ...prev,
                    planCode: data.plan_code,
                    planName: data.plan_name
                }));
            }
        } catch (error) {
            console.error('Error fetching next plan code:', error);
        }
    }, []);

    const handleWarehouseChange = (warehouseId: string) => {
        setPlanForm(prev => ({ ...prev, warehouseId }));
        const warehouse = warehouses.find(w => w.warehouse_id === warehouseId);
        if (warehouse) {
            setVrpSettings(prev => ({
                ...prev,
                warehouseLat: warehouse.latitude ? Number(warehouse.latitude) : prev.warehouseLat,
                warehouseLng: warehouse.longitude ? Number(warehouse.longitude) : prev.warehouseLng
            }));
        }
        fetchDraftOrders(warehouseId, planForm.planDate);
    };

    const handleCreatePlan = () => {
        fetchNextPlanCode(planForm.planDate);
        setShowCreateModal(true);
    };

    const handlePlanDateChange = (newDate: string) => {
        setPlanForm(prev => ({ ...prev, planDate: newDate }));
        fetchNextPlanCode(newDate);
        if (planForm.warehouseId) {
            fetchDraftOrders(planForm.warehouseId, newDate);
        }
    };

    const handleCloseCreateModal = () => {
        setShowCreateModal(false);
        setSelectedOrders(new Set());
    };

    const handleOpenEditor = async (planId: number) => {
        setEditorPlanId(planId);
        setIsEditorOpen(true);
        await fetchEditorData(planId);
    };

    // Handler ตรวจสอบว่าลบแผนได้หรือไม่
    const handleCheckDeletePlan = async (planId: number) => {
        try {
            const response = await fetch(`/api/route-plans/${planId}/can-delete`);
            const result = await response.json();

            if (!result.can_delete) {
                // แสดง error
                alert(`ไม่สามารถลบได้: ${result.reason}${result.active_orders ? '\n\nOrders ที่ยังไม่ได้ Rollback:\n' + result.active_orders.join(', ') : ''}`);
                return;
            }

            // แสดง confirmation dialog
            setDeleteConfirmDialog({
                isOpen: true,
                planId: planId,
                planCode: result.plan_code,
                picklistsCount: result.picklists_count || 0,
                warning: result.warning
            });
        } catch (error) {
            console.error('Error checking delete:', error);
            alert('เกิดข้อผิดพลาดในการตรวจสอบ');
        }
    };

    // Handler ลบแผนจริง
    const handleDeletePlan = async () => {
        if (!deleteConfirmDialog?.planId) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/route-plans/${deleteConfirmDialog.planId}/delete`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'เกิดข้อผิดพลาด');
            }

            // แสดง success
            alert(`✅ ลบแผน ${deleteConfirmDialog.planCode} สำเร็จ`);

            // Refresh list
            await fetchRoutePlans();

            // ปิด dialog
            setDeleteConfirmDialog(null);
        } catch (error: any) {
            console.error('Error deleting:', error);
            alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle expand/collapse แผนเส้นทาง
    const toggleExpandPlan = async (planId: number) => {
        const newExpanded = new Set(expandedPlanIds);

        if (expandedPlanIds.has(planId)) {
            // Collapse
            newExpanded.delete(planId);
            setExpandedPlanIds(newExpanded);
        } else {
            // Expand - fetch trips if not already loaded
            newExpanded.add(planId);
            setExpandedPlanIds(newExpanded);

            if (!planTripsData.has(planId)) {
                // Fetch trips data
                const newLoadingTrips = new Set(loadingTrips);
                newLoadingTrips.add(planId);
                setLoadingTrips(newLoadingTrips);

                try {
                    const response = await fetch(`/api/route-plans/${planId}/trips`);
                    const result = await response.json();

                    if (result.data) {
                        const newPlanTripsData = new Map(planTripsData);
                        newPlanTripsData.set(planId, result.data);
                        setPlanTripsData(newPlanTripsData);
                    }
                } catch (error) {
                    console.error('Error fetching trips:', error);
                } finally {
                    const newLoadingTrips = new Set(loadingTrips);
                    newLoadingTrips.delete(planId);
                    setLoadingTrips(newLoadingTrips);
                }
            }
        }
    };

    const handleSaveSettings = useCallback(() => {
        setIsSavingSettings(true);
        try {
            // Simulate a short delay for better UX
            setTimeout(() => {
                localStorage.setItem(VRP_SETTINGS_STORAGE_KEY, JSON.stringify(vrpSettings));
                setStatusMessage('บันทึกการตั้งค่า VRP เรียบร้อยแล้ว');
                setIsSavingSettings(false);
                setTimeout(() => setStatusMessage(''), 3000);
            }, 500);
        } catch (error) {
            console.error("Failed to save VRP settings to localStorage", error);
            setStatusMessage('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
            setIsSavingSettings(false);
        }
    }, [vrpSettings]);

    const handleOptimize = async () => {
        if (optimizeLockRef.current) {
            console.warn('⚠️ การคำนวณเส้นทางกำลังทำงานอยู่ กรุณารอให้เสร็จก่อน');
            setStatusMessage('⚠️ การคำนวณเส้นทางกำลังทำงานอยู่ กรุณารอให้เสร็จก่อน');
            setTimeout(() => setStatusMessage(''), 3000);
            return;
        }

        try {
            if (selectedOrders.size === 0) {
                setStatusMessage('❌ กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ');
                setTimeout(() => setStatusMessage(''), 3000);
                return;
            }

            if (!planForm.warehouseId) {
                setStatusMessage('❌ กรุณาเลือกคลังสินค้า');
                setTimeout(() => setStatusMessage(''), 3000);
                return;
            }

            optimizeLockRef.current = true;
            setShowCreateModal(false);
            setIsOptimizing(true);
            setStatusMessage('กำลังเตรียมข้อมูลเพื่อส่งไปคำนวณ...');

            const planPayload = {
                plan_code: planForm.planCode,
                plan_name: planForm.planName,
                plan_date: planForm.planDate,
                warehouse_id: planForm.warehouseId,
                settings: {
                    vehicleCapacityKg: vrpSettings.vehicleCapacityKg,
                    maxWorkingHours: vrpSettings.maxWorkingHours,
                    startTime: vrpSettings.startTime,
                    endTime: vrpSettings.endTime,
                    serviceTime: vrpSettings.serviceTime,
                    avgSpeedKmh: vrpSettings.avgSpeedKmh,
                    zoneMethod: vrpSettings.zoneMethod,
                    numZones: vrpSettings.numZones,
                    maxStoresPerZone: vrpSettings.maxStoresPerZone,
                    consolidationEnabled: vrpSettings.consolidationEnabled,
                    distanceThreshold: vrpSettings.distanceThreshold,
                    detourFactor: vrpSettings.detourFactor,
                    routingAlgorithm: vrpSettings.routingAlgorithm,
                    localSearchMethod: vrpSettings.localSearchMethod,
                    stopOrderingMethod: vrpSettings.stopOrderingMethod,
                    maxVehicles: vrpSettings.maxVehicles,
                    enforceVehicleLimit: vrpSettings.enforceVehicleLimit,
                    respectTimeWindows: vrpSettings.respectTimeWindows,
                    avgSpeed: vrpSettings.avgSpeedKmh,
                    ignoreSmallDeliveries: vrpSettings.ignoreSmallDeliveries,
                    smallDeliveryWeightThreshold: vrpSettings.smallDeliveryWeightThreshold,
                    useMapboxApi: vrpSettings.useMapboxApi,
                    costPerKm: vrpSettings.costPerKm,
                    costPerVehicle: vrpSettings.costPerVehicle,
                    driverHourlyRate: vrpSettings.driverHourlyRate,
                    maxComputationTime: vrpSettings.maxComputationTime,
                    warehouseLat: vrpSettings.warehouseLat,
                    warehouseLng: vrpSettings.warehouseLng,
                    warehouseName:
                        warehouses.find(w => w.warehouse_id === planForm.warehouseId)?.warehouse_name || planForm.warehouseId
                },
                status: 'optimizing'
            };

            setStatusMessage('กำลังสร้างแผนและบันทึกข้อมูล...');
            const createRes = await fetch('/api/route-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(planPayload)
            });

            const { data: createdPlan, error: createError } = await createRes.json();
            if (createError || !createdPlan) {
                throw new Error(createError || 'ไม่สามารถสร้างแผนเส้นทางได้');
            }

            const selectedOrderData = draftOrders.filter(o => selectedOrders.has(o.order_id));
            const inputsPayload: any[] = selectedOrderData.map((order: DraftOrder) => ({
                plan_id: createdPlan.plan_id,
                order_id: order.order_id,
                stop_name: order.shop_name || order.customer?.customer_name || order.customer_id,
                contact_phone: order.phone,
                address: order.address || order.province,
                latitude: order.customer?.latitude,
                longitude: order.customer?.longitude,
                priority: 50,
                service_duration_minutes: vrpSettings.serviceTime,
                is_active: true,
                demand_weight_kg: Number(order.total_weight || 0),
                demand_units: 1
            }));

            await fetch('/api/route-plans/inputs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputsPayload)
            });

            setStatusMessage('ส่งข้อมูลเข้าระบบคำนวณ VRP... กระบวนการนี้อาจใช้เวลาหลายนาที');
            const optimizeRes = await fetch('/api/route-plans/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: createdPlan.plan_id })
            });

            const { data: optimizeData, error: optimizeError } = await optimizeRes.json();
            if (optimizeError) {
                setStatusMessage('❌ เกิดข้อผิดพลาดในการคำนวณเส้นทาง: ' + optimizeError);
                setTimeout(() => setStatusMessage(''), 5000);
            } else {
                const summary = optimizeData?.summary;
                const vehicleText = summary ? `จำนวนเที่ยว ${summary.totalVehicles} เที่ยว` : '';
                const distanceText = summary ? `ระยะทางรวม ${summary.totalDistance.toFixed(2)} กม.` : '';
                const costText = summary ? `ค่าใช้จ่ายรวม ${summary.totalCost.toFixed(2)} บาท` : '';
                const orderText = summary ? `ออเดอร์รวม ${summary.totalDeliveries} รายการ` : '';
                const weightText = summary ? `น้ำหนักสินค้ารวม ${summary.totalWeight.toFixed(2)} กก.` : '';

                const messageParts = [vehicleText, distanceText, costText].filter(Boolean);
                const message = messageParts.join(' • ');
                setStatusMessage(message || 'จัดเส้นทางสำเร็จ!');

                // Create detailed notification message
                const notificationParts = [
                    'จัดเส้นทางสำเร็จ!',
                    vehicleText,
                    orderText,
                    weightText,
                    distanceText,
                    costText
                ].filter(Boolean);
                alert(notificationParts.join('\n'));

                // Open preview modal to show the map
                await fetchRoutePlans();
                if (createdPlan?.plan_id) {
                    handlePreviewPlan(createdPlan.plan_id);
                }
            }

            setSelectedOrders(new Set());
            if (planForm.warehouseId) {
                fetchDraftOrders(planForm.warehouseId, planForm.planDate);
            }
        } catch (error: any) {
            console.error('Error optimizing plan:', error);
            setStatusMessage('❌ เกิดข้อผิดพลาด: ' + error.message);
            setTimeout(() => setStatusMessage(''), 5000);
        } finally {
            setIsOptimizing(false);
            optimizeLockRef.current = false;
        }
    };

    const handlePreviewPlan = useCallback(async (planId: number) => {
        if (typeof planId !== 'number' || isNaN(planId)) {
            console.error('Invalid planId provided to handlePreviewPlan:', planId);
            setPreviewError('ไม่สามารถโหลดข้อมูลแผนได้: รหัสแผนไม่ถูกต้อง');
            setIsPreviewModalOpen(true);
            setPreviewLoading(false);
            return;
        }
        setIsPreviewModalOpen(true);
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewPlan(null);
        setPreviewTrips([]);

        try {
            const [editorRes, metricsRes] = await Promise.all([
                fetch(`/api/route-plans/${planId}/editor`),
                fetch(`/api/route-plans/${planId}/metrics`)
            ]);

            const editorJson = await editorRes.json();
            const metricsJson = await metricsRes.json();

            console.log('🔍 Raw API response:', {
                editorJson,
                metricsJson
            });

            if (editorJson?.error) {
                throw new Error(editorJson.error);
            }

            const editorData = editorJson?.data;
            const planData = editorData?.plan;
            if (!planData) {
                throw new Error('ไม่พบข้อมูลแผนเส้นทาง');
            }
            const tripsData: any[] = editorData?.trips || [];
            const warehouseData = editorData?.warehouse || null;
            
            console.log('📦 Extracted data:', {
                planId: planData.plan_id,
                tripsCount: tripsData.length,
                warehouseData,
                trips: tripsData
            });

            console.log('Preview data received:', {
                planId,
                tripsCount: tripsData.length,
                warehouse: warehouseData,
                firstTrip: tripsData[0] ? {
                    trip_id: tripsData[0].trip_id,
                    stopsCount: tripsData[0].stops?.length,
                    firstStop: tripsData[0].stops?.[0] ? {
                        stop_id: tripsData[0].stops[0].stop_id,
                        stop_name: tripsData[0].stops[0].stop_name,
                        latitude: tripsData[0].stops[0].latitude,
                        longitude: tripsData[0].stops[0].longitude,
                        lat_type: typeof tripsData[0].stops[0].latitude,
                        lng_type: typeof tripsData[0].stops[0].longitude,
                        lat_finite: Number.isFinite(Number(tripsData[0].stops[0].latitude)),
                        lng_finite: Number.isFinite(Number(tripsData[0].stops[0].longitude))
                    } : 'NO STOPS'
                } : 'NO TRIPS'
            });

            // Check if we have valid coordinates in any stop
            const hasAnyCoordinates = tripsData.some(trip =>
                trip.stops?.some((stop: any) =>
                    Number.isFinite(Number(stop.latitude)) &&
                    Number.isFinite(Number(stop.longitude))
                )
            );

            if (!hasAnyCoordinates && tripsData.length > 0) {
                console.warn('⚠️ ไม่พบข้อมูลพิกัดในจุดส่งทั้งหมด - แผนที่จะไม่สามารถแสดงได้');
            }

            const tripsWithStops = tripsData.map((trip, index) => {
                const sanitizedStops: any[] = (trip.stops || []).map((stop: any, stopIdx: number) => {
                    const latitudeValue = Number(stop.latitude);
                    const longitudeValue = Number(stop.longitude);
                    const hasCoordinates = Number.isFinite(latitudeValue) && Number.isFinite(longitudeValue);

                    const normalizedOrders: StopOrderDetail[] = Array.isArray(stop.orders)
                        ? stop.orders
                            .map((order: any) => {
                                const allocatedWeight =
                                    order?.allocated_weight_kg != null && Number.isFinite(Number(order.allocated_weight_kg))
                                        ? Number(order.allocated_weight_kg)
                                        : null;
                                const totalWeight =
                                    order?.total_order_weight_kg != null && Number.isFinite(Number(order.total_order_weight_kg))
                                        ? Number(order.total_order_weight_kg)
                                        : null;
                                return {
                                    order_id: Number.isFinite(Number(order?.order_id)) ? Number(order.order_id) : null,
                                    order_no: order?.order_no ?? null,
                                    customer_name: order?.customer_name ?? null,
                                    allocated_weight_kg: allocatedWeight,
                                    total_order_weight_kg: totalWeight
                                } as StopOrderDetail;
                            })
                            .filter((order: StopOrderDetail | null): order is StopOrderDetail => Boolean(order))
                        : [];

                    const fallbackOrders = normalizedOrders.length > 0
                        ? normalizedOrders
                        : [{
                            order_id: Number.isFinite(Number(stop.order_id)) ? Number(stop.order_id) : null,
                            order_no: stop.order_no ?? null,
                            customer_name: stop.stop_name ?? null,
                            allocated_weight_kg: Number.isFinite(Number(stop.load_weight_kg)) ? Number(stop.load_weight_kg) : null,
                            total_order_weight_kg: Number.isFinite(Number(stop.load_weight_kg)) ? Number(stop.load_weight_kg) : null
                        } as StopOrderDetail];

                    // Flatten first order data for easier access in popups
                    const firstOrder = fallbackOrders[0];

                    return {
                        stop_id: stop.stop_id,
                        trip_id: trip.trip_id, // Add trip_id for move functionality
                        sequence_no: stop.sequence_no ?? stopIdx + 1,
                        stop_name: stop.stop_name || stop.address || `จุดที่ ${stopIdx + 1}`,
                        address: stop.address ?? null,
                        latitude: hasCoordinates ? latitudeValue : null,
                        longitude: hasCoordinates ? longitudeValue : null,
                        service_duration_minutes: stop.service_duration_minutes ?? null,
                        load_weight_kg: stop.load_weight_kg ?? null,
                        load_volume_cbm: stop.load_volume_cbm ?? null,
                        load_units: stop.load_units ?? null,
                        load_pallets: stop.load_pallets ?? null,
                        notes: stop.notes ?? null,
                        orders: fallbackOrders,
                        // Flatten first order for popup display
                        order_id: firstOrder?.order_id ?? null,
                        order_no: firstOrder?.order_no ?? null,
                        order_weight: firstOrder?.total_order_weight_kg ?? firstOrder?.allocated_weight_kg ?? null
                    };
                });

                const driverName = [trip.driver_first_name, trip.driver_last_name].filter(Boolean).join(' ') || null;

                return {
                    ...trip,
                    driver_name: driverName,
                    trip_number: trip.daily_trip_number ?? trip.trip_number ?? trip.trip_sequence ?? index + 1,
                    total_distance_km: Number(trip.total_distance_km ?? 0),
                    warehouse: warehouseData,
                    stops: sanitizedStops
                };
            });

            const metricsData = metricsJson?.error ? null : metricsJson?.data;

            setPreviewPlan({
                ...planData,
                warehouse: warehouseData,
                metrics: metricsData
            });
            setPreviewTrips(tripsWithStops);
        } catch (error: any) {
            console.error('Error loading route plan preview:', error);
            setPreviewError(error?.message || 'ไม่สามารถโหลดข้อมูลแผนได้');
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    const closePreviewModal = useCallback(() => {
        // Bug #3 Fix: Clear all preview-related state
        setIsPreviewModalOpen(false);
        setPreviewPlan(null);
        setPreviewTrips([]);
        setSelectedPreviewTripIndex(null);
        setSelectedPreviewTripIndices([]);
        setPreviewError(null);
        setPreviewLoading(false);
    }, []);

    // ฟังก์ชันสำหรับจัดลำดับ stops ในโหมดดู (drag marker บนแผนที่)
    const handleReorderStopsInPreview = useCallback(async (tripId: number, orderedStopIds: number[]) => {
        if (!previewPlan?.plan_id) {
            console.error('No preview plan ID available');
            return;
        }

        // Check if we're in fallback mode
        const tripIdStr = String(tripId);
        if (tripIdStr.startsWith('fallback-')) {
            alert('⚠️ ไม่สามารถจัดลำดับจุดส่งได้\n\nสาเหตุ: ข้อมูลเที่ยวยังไม่ได้บันทึกในฐานข้อมูล\n\nวิธีแก้ไข:\n1. เปิด Supabase Dashboard > SQL Editor\n2. รัน: ALTER TABLE receiving_route_trips ADD COLUMN IF NOT EXISTS is_overweight boolean DEFAULT false;\n3. จัดเส้นทางใหม่');
            return;
        }

        try {
            console.log('Reordering stops in preview:', { tripId, orderedStopIds });

            const response = await fetch(`/api/route-plans/${previewPlan.plan_id}/reorder-stops`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tripId, orderedStopIds }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to reorder stops');
            }

            console.log('✅ Stops reordered successfully in preview mode');

            // รีเฟรชข้อมูล preview
            await handlePreviewPlan(previewPlan.plan_id);
        } catch (error: any) {
            console.error('Error reordering stops in preview:', error);
            alert(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถจัดลำดับจุดส่งได้'}`);
        }
    }, [previewPlan]);

    const handleMoveOrder = useCallback(async (orderId: number, fromTripId: number, toTripId: number) => {
        // Bug #8 Fix: Use functional update to prevent stale closure
        let currentPlanId: number | null = null;
        
        setPreviewPlan(prev => {
            if (!prev?.plan_id) {
                console.error('No preview plan ID available');
                return prev;
            }
            currentPlanId = prev.plan_id;
            return prev;
        });

        if (!currentPlanId) {
            return;
        }

        // Check if we're in fallback mode (trip_id is string like 'fallback-1')
        const fromTripIdStr = String(fromTripId);
        if (fromTripIdStr.startsWith('fallback-')) {
            alert('⚠️ ไม่สามารถย้ายออเดอร์ได้\n\nสาเหตุ: ข้อมูลเที่ยวยังไม่ได้บันทึกในฐานข้อมูล\n\nวิธีแก้ไข:\n1. เปิด Supabase Dashboard > SQL Editor\n2. รัน: ALTER TABLE receiving_route_trips ADD COLUMN IF NOT EXISTS is_overweight boolean DEFAULT false;\n3. จัดเส้นทางใหม่\n\nดูรายละเอียดใน MIGRATION_INSTRUCTIONS.md');
            return;
        }

        try {
            console.log('Moving order:', { orderId, fromTripId, toTripId });

            const response = await fetch(`/api/route-plans/${currentPlanId}/move-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderId, fromTripId, toTripId }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to move order');
            }

            console.log('Order moved successfully:', result);

            // Reload the preview data to show updated trips
            await handlePreviewPlan(currentPlanId);

        } catch (error: any) {
            console.error('Error moving order:', error);
            setPreviewError(`ไม่สามารถย้ายออเดอร์ได้: ${error.message}`);
        }
    }, [handlePreviewPlan]);

    // ใช้ STATUSES จาก utils แทน local definition
    const statuses = STATUSES;

    const handleSort = (field: keyof RoutePlan) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Handler สำหรับเปลี่ยนสถานะแผน
    const handleStatusChange = useCallback(async (planId: number, newStatus: string) => {
        try {
            setEditingStatusPlanId(planId);
            const response = await fetch(`/api/route-plans/${planId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const result = await response.json();
            if (result.error) {
                console.error('Error updating status:', result.error);
                alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + result.error);
            } else {
                await fetchRoutePlans();
            }
        } catch (error: any) {
            console.error('Error updating status:', error);
            alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message);
        } finally {
            setEditingStatusPlanId(null);
        }
    }, []);

    // Handler สำหรับแก้ไขค่าขนส่ง
    const handleEditShippingCost = useCallback(async (planId: number) => {
        const plan = routePlans.find(p => p.plan_id === planId);
        if (plan && plan.status === 'draft') {
            try {
                const res = await fetch(`/api/route-plans/${planId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'optimizing' })
                });
                if (res.ok) {
                    await fetchRoutePlans();
                }
            } catch (error) {
                console.error('Error updating status:', error);
            }
        }
        setSelectedPlanIdForShippingCost(planId);
        setShowEditShippingCostModal(true);
    }, [routePlans]);

    // Handler สำหรับอนุมัติแผน
    const handleApprovePlan = useCallback(async (planId: number) => {
        if (confirm('อนุมัติใบว่าจ้างนี้หรือไม่?')) {
            try {
                const response = await fetch(`/api/route-plans/${planId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'approved',
                        approved_at: new Date().toISOString()
                    })
                });
                if (response.ok) {
                    alert('✅ อนุมัติเรียบร้อยแล้ว');
                    await fetchRoutePlans();
                } else {
                    const result = await response.json();
                    alert('❌ เกิดข้อผิดพลาด: ' + (result.error || 'Unknown error'));
                }
            } catch (err: any) {
                alert('เกิดข้อผิดพลาด: ' + err.message);
            }
        }
    }, []);

    // ใช้ resequenceTripStops จาก utils แทน local definition

    const updateTripState = (updater: (trips: EditorTrip[]) => EditorTrip[]) => {
        setEditorTrips(prev => updater(prev.map(trip => ({ ...trip, stops: trip.stops.map(stop => ({ ...stop })) }))));
    };

    const handleSelectEditorStop = (tripId: number, stopId: number, orderId?: number | null) => {
        setSelectedEditorTripId(tripId);
        setSelectedEditorStopId(stopId);
        setSelectedEditorOrderId(orderId ?? null);
        setTransferTripId(tripId);
    };

    const handleMoveStop = (tripId: number, stopId: number, direction: 'up' | 'down') => {
        setEditorError(null);
        updateTripState(prevTrips => {
            return prevTrips.map(trip => {
                if (trip.trip_id !== tripId) return trip;
                const stops = [...trip.stops];
                const index = stops.findIndex(stop => stop.stop_id === stopId);
                if (index < 0) return trip;
                const newIndex = direction === 'up' ? index - 1 : index + 1;
                if (newIndex < 0 || newIndex >= stops.length) return trip;
                const [moved] = stops.splice(index, 1);
                stops.splice(newIndex, 0, moved);
                return { ...trip, stops: resequenceTripStops(stops) };
            });
        });
    };

    // ฟังก์ชันสำหรับจัดลำดับ stops ใหม่ (drag and drop)
    const handleReorderStops = async (tripId: number, reorderedStops: EditorStop[]) => {
        setEditorError(null);

        // อัพเดท state ในหน้าจอทันที (optimistic update)
        updateTripState(prevTrips => {
            return prevTrips.map(trip => {
                if (trip.trip_id !== tripId) return trip;
                return { ...trip, stops: reorderedStops };
            });
        });

        // เรียก API เพื่อบันทึกลงฐานข้อมูล
        try {
            const response = await fetch(`/api/route-plans/${editorPlanId}/reorder-stops`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tripId,
                    orderedStopIds: reorderedStops.map(s => s.stop_id)
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to reorder stops');
            }

            // แสดงข้อความสำเร็จ (optional)
            console.log('Stops reordered successfully:', result);

            // รีเฟรชข้อมูลเพื่อให้แน่ใจว่าข้อมูลตรงกับฐานข้อมูล
            await fetchEditorData(editorPlanId);
        } catch (error: any) {
            console.error('Error reordering stops:', error);
            setEditorError(error.message || 'เกิดข้อผิดพลาดในการจัดลำดับจุดส่ง');

            // ย้อนกลับ state ถ้ามี error
            await fetchEditorData(editorPlanId);
        }
    };

    const handleTransferOrder = (stopId: number, orderId: number | null, targetTripId: number) => {
        if (!orderId) return;

        setEditorError(null);
        setEditorLoading(true);

        updateTripState(prevTrips => {
            let movingOrder: StopOrderDetail | null = null;
            let sourceStop: EditorStop | null = null;

            const updatedTrips = prevTrips.map(trip => {
                if (trip.stops.some(stop => stop.stop_id === stopId)) {
                    const newStops = trip.stops.map(stop => {
                        if (stop.stop_id === stopId) {
                            sourceStop = { ...stop };
                            if (stop.orders && stop.orders.length > 1) {
                                movingOrder = stop.orders.find(o => o.order_id === orderId) || null;
                                const remainingOrders = stop.orders.filter(o => o.order_id !== orderId);
                                return { ...stop, orders: remainingOrders };
                            } else {
                                return stop;
                            }
                        }
                        return stop;
                    }).filter(stop => {
                        if (stop.stop_id === stopId && (!stop.orders || stop.orders.length === 0)) {
                            movingOrder = stop.orders?.[0] || { order_id: stop.order_id, order_no: stop.order_no, customer_name: stop.stop_name } as StopOrderDetail;
                            return false;
                        }
                        return true;
                    });
                    return { ...trip, stops: resequenceTripStops(newStops) };
                }
                return trip;
            });

            if (movingOrder && sourceStop) {
                return updatedTrips.map(trip => {
                    if (trip.trip_id === targetTripId) {
                        const newStop: EditorStop = {
                            stop_id: Date.now(),
                            sequence_no: trip.stops.length + 1,
                            stop_name: sourceStop!.stop_name,
                            address: sourceStop!.address,
                            latitude: sourceStop!.latitude,
                            longitude: sourceStop!.longitude,
                            service_duration_minutes: sourceStop!.service_duration_minutes,
                            load_weight_kg: movingOrder!.allocated_weight_kg || movingOrder!.total_order_weight_kg,
                            order_id: movingOrder!.order_id,
                            order_no: movingOrder!.order_no,
                            orders: movingOrder ? [movingOrder] : []
                        };
                        const stops = [...trip.stops, newStop];
                        return { ...trip, stops: resequenceTripStops(stops) };
                    }
                    return trip;
                });
            }

            return updatedTrips;
        });

        setSelectedEditorTripId(targetTripId);
        setTransferTripId(targetTripId);
        setEditorLoading(false);
    };

    const handleTransferStop = (stopId: number, targetTripId: number) => {
        if (selectedEditorOrderId) {
            handleTransferOrder(stopId, selectedEditorOrderId, targetTripId);
            return;
        }

        setEditorError(null);
        setEditorLoading(true);
        updateTripState(prevTrips => {
            let movingStop: EditorStop | null = null;
            const updatedTrips = prevTrips.map(trip => {
                if (trip.stops.some(stop => stop.stop_id === stopId)) {
                    const remainingStops = trip.stops.filter(stop => {
                        if (stop.stop_id === stopId) {
                            movingStop = { ...stop };
                            return false;
                        }
                        return true;
                    });
                    return { ...trip, stops: resequenceTripStops(remainingStops) };
                }
                return trip;
            });

            if (movingStop) {
                return updatedTrips.map(trip => {
                    if (trip.trip_id === targetTripId) {
                        const stops = [...trip.stops, { ...movingStop!, sequence_no: trip.stops.length + 1 }];
                        return { ...trip, stops: resequenceTripStops(stops) };
                    }
                    return trip;
                });
            }

            return updatedTrips;
        });

        setSelectedEditorTripId(targetTripId);
        setSelectedEditorStopId(stopId);
        setTransferTripId(targetTripId);
        setEditorLoading(false);
    };

    const handleSaveEditor = async () => {
        if (!editorPlanId) return;
        try {
            setEditorLoading(true);
            const payload = {
                trips: editorTrips.map(trip => ({
                    trip_id: trip.trip_id,
                    stops: trip.stops.map((stop, index) => ({
                        stop_id: stop.stop_id,
                        sequence_no: index + 1
                    }))
                }))
            };

            const res = await fetch(`/api/route-plans/${editorPlanId}/resequence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const { error } = await res.json();
            if (error) {
                setEditorError(error);
                return;
            }

            await fetchEditorData(editorPlanId);
            await fetchRoutePlans();
            setStatusMessage('บันทึกการแก้ไขเส้นทางเรียบร้อย');
        } catch (error) {
            console.error('Error saving manual route changes:', error);
            setEditorError('ไม่สามารถบันทึกการเปลี่ยนแปลงได้');
        } finally {
            setEditorLoading(false);
        }
    };

    const handleOpenSplitModal = () => {
        setIsSplitModalOpen(true);
    };

    const handleSplitSubmit = async (payload: SplitFormPayload) => {
        if (!editorPlanId || !payload.stopId) return;
        try {
            setEditorLoading(true);
            setEditorError(null);
            const res = await fetch(`/api/route-plans/${editorPlanId}/split-stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceStopId: payload.stopId,
                    targetTripId: payload.targetTripId ?? null,
                    newTrip: payload.newTrip,
                    items: payload.items.map(item => ({
                        orderItemId: item.orderItemId,
                        moveWeightKg: item.moveWeightKg,
                        moveQuantity: item.moveQuantity,
                        moveVolumeCbm: item.moveVolumeCbm,
                        movePallets: item.movePallets
                    })),
                    serviceDurationMinutes: payload.serviceMinutes,
                    note: payload.note
                })
            });

            const { error } = await res.json();
            if (error) {
                setEditorError(error);
                return;
            }

            setIsSplitModalOpen(false);
            await fetchEditorData(editorPlanId);
            await fetchRoutePlans();
        } catch (error) {
            console.error('Error splitting stop:', error);
            setEditorError('ไม่สามารถแยกออเดอร์ได้');
        } finally {
            setEditorLoading(false);
        }
    };

    const handleCancelStop = async (stop: EditorStop) => {
        if (!editorPlanId || !stop) return;
        const stopId = stop.stop_id;
        const orderId = stop.order_id;

        if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการยกเลิกจุดส่งนี้ออกจากแผน? การกระทำนี้จะเปลี่ยนสถานะออเดอร์กลับเป็น "แบบร่าง" และต้องมีการวางแผนใหม่')) {
            try {
                setEditorLoading(true);
                setEditorError(null);

                const res = await fetch(`/api/route-plans/stops/${stopId}/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: orderId })
                });

                const result = await res.json();

                if (result.error) {
                    throw new Error(result.error.message || 'Unknown error');
                }

                await fetchEditorData(editorPlanId);
                await fetchRoutePlans();

            } catch (error: any) {
                console.error('Error cancelling stop:', error);
                setEditorError(`เกิดข้อผิดพลาดในการยกเลิกจุดส่ง: ${error.message}`);
            } finally {
                setEditorLoading(false);
            }
        }
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setEditorPlanId(null);
        setEditorPlan(null);
        setEditorWarehouse(null);
        setEditorTrips([]);
        setSelectedEditorTripId(null);
        setSelectedEditorStopId(null);
        setEditorError(null);
        setTransferTripId(null);
        setEditorDraftOrders([]);
    };

    const handleAddOrderToEditor = async (orderId: number, tripId: number, sequence: number) => {
        if (!editorPlanId) {
            throw new Error('No plan is currently being edited');
        }

        try {
            setEditorLoading(true);
            const response = await fetch(`/api/route-plans/${editorPlanId}/add-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    tripId,
                    sequencePosition: sequence
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to add order to plan');
            }

            // Refresh editor data and draft orders
            await fetchEditorData(editorPlanId);
            await fetchRoutePlans();
        } catch (error) {
            console.error('Error adding order to editor:', error);
            throw error;
        } finally {
            setEditorLoading(false);
        }
    };

    const handlePrintPlan = async (planId: number) => {
        // Open Transport Contract Modal with planId
        setSelectedPlanIdForContract(planId);
        setShowTransportContractModal(true);
        
        // เปลี่ยนสถานะเป็น pending_approval หลังจากพิมพ์ใบว่าจ้าง
        try {
            const response = await fetch(`/api/route-plans/${planId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'pending_approval' })
            });
            
            if (response.ok) {
                console.log('✅ เปลี่ยนสถานะเป็น pending_approval แล้ว');
                await fetchRoutePlans(); // Refresh data
            }
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    // Handler สำหรับเปิด Cross-Plan Transfer Modal
    const handleOpenCrossPlanTransfer = (stop: EditorStop, tripId: number) => {
        setCrossPlanTransferStop(stop);
        setCrossPlanTransferTripId(tripId);
        setShowCrossPlanTransferModal(true);
    };

    // Handler สำหรับย้ายออเดอร์ข้ามแผน
    const handleCrossPlanTransfer = async (payload: {
        targetPlanId: number;
        targetTripId: number | 'new';
        sequence: number;
        items: { orderItemId: number; moveWeightKg: number; moveQuantity: number }[];
        note?: string;
    }) => {
        if (!crossPlanTransferStop || !editorPlanId) {
            throw new Error('ไม่พบข้อมูลจุดส่งที่ต้องการย้าย');
        }

        // คำนวณว่าเป็น full หรือ partial transfer
        const totalItems = payload.items.length;
        const transferType = totalItems > 0 ? 'partial' : 'full';

        const response = await fetch('/api/route-plans/cross-plan-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_plan_id: editorPlanId,
                source_trip_id: crossPlanTransferTripId,
                source_stop_id: crossPlanTransferStop.stop_id,
                target_plan_id: payload.targetPlanId,
                target_trip_id: payload.targetTripId === 'new' ? null : payload.targetTripId,
                create_new_trip: payload.targetTripId === 'new',
                target_sequence: payload.sequence,
                order_id: crossPlanTransferStop.order_id,
                transfer_type: transferType,
                items: payload.items,
                note: payload.note
            })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'ไม่สามารถย้ายออเดอร์ได้');
        }

        // Refresh editor data
        if (editorPlanId) {
            await fetchEditorData(editorPlanId);
        }
        await fetchRoutePlans();
        
        alert('✅ ย้ายออเดอร์ข้ามแผนสำเร็จ');
    };

    // Handler สำหรับสร้างใบว่าจ้างข้ามแผน
    const handleGenerateMultiPlanContract = (selectedTrips: any[]) => {
        // เก็บ trips ที่เลือกและเปิด modal พิมพ์ใบว่าจ้าง
        setMultiPlanSelectedTrips(selectedTrips);
        // ดึงชื่อ supplier จาก trip แรก (ทุก trip ควรเป็น supplier เดียวกัน)
        const supplierName = selectedTrips[0]?.supplier?.supplier_name || 'ไม่ระบุขนส่ง';
        setMultiPlanSupplierName(supplierName);
        setShowMultiPlanContractModal(false);
        setShowMultiPlanTransportContractModal(true);
    };

    // Handler สำหรับ Export Excel ข้ามแผน
    const handleMultiPlanExport = async (selectedTrips: any[], includePrice: boolean) => {
        try {
            // สร้างข้อมูลสำหรับ Excel
            const excelData: any[] = [];
            
            for (const trip of selectedTrips) {
                const row: any = {
                    'แผน': trip.plan?.plan_code || '-',
                    'วันที่': trip.plan?.plan_date || '-',
                    'คันที่': trip.daily_trip_number || trip.trip_sequence || '-',
                    'จุดส่ง': trip.total_stops || 0,
                    'น้ำหนัก (กก.)': trip.total_weight_kg?.toFixed(0) || '-',
                    'ระยะทาง (กม.)': trip.total_distance_km?.toFixed(1) || '-',
                };
                
                if (includePrice) {
                    row['ค่าขนส่ง'] = trip.shipping_cost || 0;
                    row['ค่าฐาน'] = trip.base_price || 0;
                    row['ค่าคนช่วย'] = trip.helper_fee || 0;
                    row['ค่าจุดเพิ่ม'] = trip.extra_stop_fee || 0;
                    row['ค่าขนของ'] = trip.porterage_fee || 0;
                }
                
                excelData.push(row);
            }
            
            // สร้าง workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, 'รวมเที่ยวรถ');
            
            // Download
            const fileName = `รวมใบว่าจ้าง_${includePrice ? 'มีราคา' : 'ไม่มีราคา'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            setShowMultiPlanContractModal(false);
        } catch (error) {
            console.error('Error exporting multi-plan:', error);
            alert('เกิดข้อผิดพลาดในการ Export');
        }
    };

    // Export TMS Excel สำหรับระบบจัดส่ง
    const handleExportTMS = async (planId: number, planCode: string, planDate: string) => {
        try {
            // Fetch plan details with trips and stops
            const [editorRes, bonusRes] = await Promise.all([
                fetch(`/api/route-plans/${planId}/editor`),
                fetch(`/api/route-plans/${planId}/bonus-orders`)
            ]);
            
            const { data, error } = await editorRes.json();
            const { data: bonusData } = await bonusRes.json();
            
            if (error || !data?.trips) {
                alert('ไม่สามารถโหลดข้อมูลแผนได้');
                return;
            }

            // bonusData format: { bonusOrders: { trip_id: { customer_id: [order_no, ...] } }, deliveryNumbers: { trip_id: delivery_number } }
            const bonusOrdersByTrip: Record<number, Record<string, string[]>> = bonusData?.bonusOrders || {};
            const deliveryNumbersByTrip: Record<number, string> = bonusData?.deliveryNumbers || {};

            // สร้างข้อมูลสำหรับ Excel
            const excelData: any[] = [];
            
            for (const trip of data.trips) {
                const tripId = trip.trip_id;
                const tripNumber = trip.daily_trip_number || trip.trip_sequence;
                
                // ดึง delivery_number จาก loadlist (ผ่าน trip.delivery_number) หรือ fallback จาก bonus-orders API
                const deliveryNumber = trip.delivery_number || deliveryNumbersByTrip[tripId] || '';
                
                // ดึง bonus orders สำหรับ trip นี้
                const tripBonusOrders = bonusOrdersByTrip[tripId] || {};
                
                // รวบรวมข้อมูลตาม customer_id (1 customer = 1 แถว)
                const customerDataMap = new Map<string, {
                    stopName: string;
                    latitude: number | null;
                    longitude: number | null;
                    totalWeight: number;
                    orderNos: string[];
                    stopSequence: number;
                }>();
                
                let customerStopCounter = 0;
                
                for (const stop of trip.stops || []) {
                    // ดึง customer_id จาก order แรกของ stop
                    let customerId = '';
                    const stopOrderNos: string[] = [];
                    
                    if (stop.orders && Array.isArray(stop.orders)) {
                        for (const order of stop.orders) {
                            if (order.order_no) {
                                stopOrderNos.push(order.order_no);
                            }
                            if (!customerId && order.customer_id) {
                                customerId = String(order.customer_id);
                            }
                        }
                    } else if (stop.order_no) {
                        stopOrderNos.push(stop.order_no);
                        if (stop.customer_id) {
                            customerId = String(stop.customer_id);
                        }
                    }
                    
                    if (!customerId) {
                        customerId = `unknown_${stop.stop_id}`;
                    }
                    
                    // ถ้า customer นี้มีอยู่แล้ว ให้รวม order และน้ำหนัก
                    if (customerDataMap.has(customerId)) {
                        const existing = customerDataMap.get(customerId)!;
                        // รวม order_no ที่ยังไม่มี
                        for (const orderNo of stopOrderNos) {
                            if (!existing.orderNos.includes(orderNo)) {
                                existing.orderNos.push(orderNo);
                            }
                        }
                        // รวมน้ำหนัก
                        existing.totalWeight += (stop.load_weight_kg || 0);
                    } else {
                        // customer ใหม่
                        customerStopCounter++;
                        customerDataMap.set(customerId, {
                            stopName: stop.stop_name || '-',
                            latitude: stop.latitude || null,
                            longitude: stop.longitude || null,
                            totalWeight: stop.load_weight_kg || 0,
                            orderNos: [...stopOrderNos],
                            stopSequence: customerStopCounter
                        });
                    }
                }
                
                // เพิ่ม bonus order_no สำหรับแต่ละ customer
                for (const [customerId, customerData] of customerDataMap) {
                    if (tripBonusOrders[customerId]) {
                        for (const bonusOrderNo of tripBonusOrders[customerId]) {
                            if (!customerData.orderNos.includes(bonusOrderNo)) {
                                customerData.orderNos.push(bonusOrderNo);
                            }
                        }
                    }
                }
                
                // Format วันที่จัดส่ง (DD/MM/YYYY)
                const deliveryDate = planDate ? new Date(planDate) : new Date();
                const formattedDate = `${deliveryDate.getDate()}/${deliveryDate.getMonth() + 1}/${deliveryDate.getFullYear()}`;
                
                // สร้างแถวสำหรับแต่ละ customer
                for (const [customerId, customerData] of customerDataMap) {
                    excelData.push({
                        'รหัสงานจัดส่ง': deliveryNumber,
                        'ชื่อร้านค้า': customerData.stopName,
                        'ละติจูดของร้านค้า': customerData.latitude || '',
                        'ลองจิจูดของร้านค้า': customerData.longitude || '',
                        'น้ำหนักสินค้ารวม': customerData.totalWeight,
                        'กำหนด - วันที่จัดส่ง': formattedDate,
                        'คันที่': tripNumber,
                        'จุดส่ง': customerData.stopSequence,
                        'วันเวลาที่ปิดงาน': '', // I - ปล่อยว่าง
                        'ลิงก์รูปภาพยืนยัน': '', // J - ปล่อยว่าง
                        'รูปภาพยืนยัน': '', // K - ปล่อยว่าง
                        'สถานะบันทึกรูป': '', // L - ปล่อยว่าง
                        'บริษัทขนส่ง': trip.supplier_name || '', // M - จากหน้าจัดเส้นทาง
                        'ชื่อพนักงานขับ': '', // N - ปล่อยว่าง
                        'ทะเบียน': '', // O - ปล่อยว่าง
                        'พนักงานเช็ค': trip.checker_employee_name || '', // P - จากใบโหลด
                        'เลขที่เอกสาร': customerData.orderNos.join(',') // Q - ตามเดิม
                    });
                }
            }

            if (excelData.length === 0) {
                alert('ไม่มีข้อมูลจุดส่งในแผนนี้');
                return;
            }

            // สร้าง workbook และ worksheet
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'TMS Export');

            // ปรับความกว้างคอลัมน์
            ws['!cols'] = [
                { wch: 20 }, // A - รหัสงานจัดส่ง
                { wch: 35 }, // B - ชื่อร้านค้า
                { wch: 15 }, // C - ละติจูด
                { wch: 15 }, // D - ลองจิจูด
                { wch: 15 }, // E - น้ำหนัก
                { wch: 18 }, // F - วันที่จัดส่ง
                { wch: 8 },  // G - คันที่
                { wch: 8 },  // H - จุดส่ง
                { wch: 18 }, // I - วันเวลาที่ปิดงาน
                { wch: 30 }, // J - ลิงก์รูปภาพยืนยัน
                { wch: 15 }, // K - รูปภาพยืนยัน
                { wch: 15 }, // L - สถานะบันทึกรูป
                { wch: 25 }, // M - บริษัทขนส่ง
                { wch: 20 }, // N - ชื่อพนักงานขับ
                { wch: 12 }, // O - ทะเบียน
                { wch: 20 }, // P - พนักงานเช็ค
                { wch: 50 }  // Q - เลขที่เอกสาร
            ];

            // Download file
            const fileName = `TMS_${planCode}_${planDate}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            alert(`✅ ส่งออกไฟล์ ${fileName} สำเร็จ`);
        } catch (err: any) {
            console.error('Error exporting TMS:', err);
            alert('เกิดข้อผิดพลาดในการส่งออกไฟล์: ' + err.message);
        }
    };

    const editorActiveTrip = useMemo(() => {
        if (!selectedEditorTripId) return null;
        return editorTrips.find(trip => trip.trip_id === selectedEditorTripId) ?? null;
    }, [editorTrips, selectedEditorTripId]);

    const editorActiveStop = useMemo(() => {
        if (!editorActiveTrip || !selectedEditorStopId) return null;
        return editorActiveTrip.stops.find(stop => stop.stop_id === selectedEditorStopId) ?? null;
    }, [editorActiveTrip, selectedEditorStopId]);

    const editorActiveOrder = useMemo(() => {
        if (!editorActiveStop || !selectedEditorOrderId) return null;
        if (editorActiveStop.orders && editorActiveStop.orders.length > 0) {
            return editorActiveStop.orders.find(o => o.order_id === selectedEditorOrderId) ?? null;
        }
        return null;
    }, [editorActiveStop, selectedEditorOrderId]);

    const editorTripsForMap = useMemo(() => {
        return editorTrips.map(trip => ({
            ...trip,
            trip_id: String(trip.trip_id),
            trip_number: trip.daily_trip_number ?? trip.trip_number ?? trip.trip_sequence,
            total_distance_km: trip.total_distance_km ?? 0,
            total_drive_minutes: trip.total_drive_minutes ?? undefined,
            total_service_minutes: trip.total_service_minutes ?? undefined,
            total_weight_kg: trip.total_weight_kg ?? undefined,
            total_volume_cbm: trip.total_volume_cbm ?? undefined,
            stops: trip.stops
                .filter(stop => stop.latitude != null && stop.longitude != null)
                .map(stop => ({
                    ...stop,
                    stop_id: String(stop.stop_id),
                    location_name: stop.stop_name,
                    sequence_no: stop.sequence_no,
                    latitude: stop.latitude as number,
                    longitude: stop.longitude as number,
                    service_duration_minutes: stop.service_duration_minutes ?? undefined,
                    load_weight_kg: stop.load_weight_kg ?? undefined,
                    load_volume_cbm: stop.load_volume_cbm ?? undefined
                }))
        }));
    }, [editorTrips]);

    const getSortIcon = (field: string) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
        ) : (
            <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />
        );
    };

    // ใช้ getStatusBadgeInfo จาก utils แทน local definition
    const getStatusBadge = (status: string) => {
        const match = getStatusBadgeInfo(status);
        return (
            <Badge variant={match.variant} size="sm">
                {match.label}
            </Badge>
        );
    };

    const filteredPlans = useMemo(() => {
        return routePlans
            .filter(plan => {
                if (selectedStatus !== 'all' && plan.status !== selectedStatus) {
                    return false;
                }
                if (startDate && new Date(plan.plan_date) < new Date(startDate)) {
                    return false;
                }
                if (endDate && new Date(plan.plan_date) > new Date(endDate)) {
                    return false;
                }
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const matches = [plan.plan_code, plan.plan_name, plan.warehouse?.warehouse_name]
                        .filter(Boolean)
                        .some(value => String(value).toLowerCase().includes(term));
                    if (!matches) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (!sortField) return new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime();
                // แก้ไข: เข้าถึง property อย่างปลอดภัย
                const aValue = a[sortField];
                const bValue = b[sortField];
                if (aValue === bValue) return 0;
                if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
                if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1;
                if (sortDirection === 'asc') {
                    return aValue > bValue ? 1 : -1;
                }
                return aValue < bValue ? 1 : -1;
            });
    }, [routePlans, searchTerm, selectedStatus, startDate, endDate, sortField, sortDirection]);

    const metrics = useMemo(() => {
        const totalTrips = routePlans.reduce((acc, plan) => acc + (plan.total_trips || 0), 0);
        const totalDistance = routePlans.reduce((acc, plan) => acc + (plan.total_distance_km || 0), 0);
        const totalOrdersSelected = selectedOrders.size;
        return {
            totalPlans: routePlans.length,
            totalDraftOrders: draftOrders.length,
            totalSelectedOrders: totalOrdersSelected,
            totalTrips,
            totalDistance
        };
    }, [routePlans, draftOrders, selectedOrders]);

    // กรอง draftOrders ตามคำค้นหา (จังหวัด, ชื่อร้าน, เลขออเดอร์)
    const filteredDraftOrders = useMemo(() => {
        if (!draftOrderFilter.trim()) return draftOrders;
        
        const filterText = draftOrderFilter.trim().toLowerCase();
        // รองรับการค้นหาหลายเลขออเดอร์คั่นด้วย comma
        const orderNos = filterText.split(',').map(s => s.trim()).filter(Boolean);
        
        return draftOrders.filter(order => {
            // ค้นหาเลขออเดอร์ (รองรับ comma-separated)
            if (orderNos.length > 0) {
                const orderNoMatch = orderNos.some(no => 
                    order.order_no?.toLowerCase().includes(no)
                );
                if (orderNoMatch) return true;
            }
            
            // ค้นหาจังหวัด
            if (order.province?.toLowerCase().includes(filterText)) return true;
            
            // ค้นหาชื่อร้าน
            if (order.shop_name?.toLowerCase().includes(filterText)) return true;
            
            return false;
        });
    }, [draftOrders, draftOrderFilter]);

    const previewWarehouse = useMemo(() => {
        if (!previewPlan) return null;
        const latCandidate = Number(
            previewPlan?.warehouse?.latitude ??
            previewPlan?.settings?.warehouseLat ??
            vrpSettings.warehouseLat
        );
        const lngCandidate = Number(
            previewPlan?.warehouse?.longitude ??
            previewPlan?.settings?.warehouseLng ??
            vrpSettings.warehouseLng
        );
        const latitude = Number.isFinite(latCandidate) ? latCandidate : vrpSettings.warehouseLat;
        const longitude = Number.isFinite(lngCandidate) ? lngCandidate : vrpSettings.warehouseLng;
        return {
            latitude,
            longitude,
            name: previewPlan?.warehouse?.warehouse_name || previewPlan?.plan_name || previewPlan?.plan_code
        };
    }, [previewPlan, vrpSettings]);

    const previewTripsForMap = useMemo(() => {
        return previewTrips.map(trip => {
            const stopsForMap = (trip.stops || []).reduce((acc: any[], stop: any, idx: number) => {
                const latitude = Number(stop.latitude);
                const longitude = Number(stop.longitude);
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    console.log('Skipping stop due to invalid coordinates:', {
                        stop_id: stop.stop_id,
                        latitude: stop.latitude,
                        longitude: stop.longitude,
                        lat_finite: Number.isFinite(latitude),
                        lng_finite: Number.isFinite(longitude)
                    });
                    return acc;
                }

                // Extract all orders for this stop (consolidated or single)
                const orderIds = stop.tags?.order_ids || (stop.order_id ? [stop.order_id] : []);
                const orders = orderIds.map((orderId: number) => {
                    // Try to find order details from stop_items or use stop-level data
                    const orderNo = stop.order_no || `Order-${orderId}`;
                    const allocatedWeight = Number(stop.load_weight_kg || 0) / orderIds.length; // Distribute weight evenly if not specified
                    
                    return {
                        order_id: orderId,
                        order_no: orderNo,
                        allocated_weight_kg: allocatedWeight,
                        total_order_weight_kg: allocatedWeight
                    };
                });

                acc.push({
                    ...stop,
                    sequence_no: stop.sequence_no ?? idx + 1,
                    location_name: stop.stop_name || stop.location_name || `จุดที่ ${idx + 1}`,
                    latitude,
                    longitude,
                    orders // Add orders array for StopDetailPopup
                });
                return acc;
            }, []);

            return {
                ...trip,
                trip_id: String(trip.trip_id),
                trip_number: trip.daily_trip_number ?? trip.trip_number ?? trip.trip_sequence ?? 1,
                total_distance_km: Number(trip.total_distance_km ?? 0),
                stops: stopsForMap
            };
        });
    }, [previewTrips]);

    const hasPreviewMapData = useMemo(
        () => previewTripsForMap.some(trip => (trip.stops || []).length > 0),
        [previewTripsForMap]
    );

    const previewModalTitle = previewPlan
        ? `แผนที่: ${previewPlan.plan_name || previewPlan.plan_code}`
        : 'แผนที่เส้นทางรับสินค้า';

    const previewSummaryMetrics = useMemo(() => {
        if (!previewPlan) return null;
        
        // If a specific trip is selected, show only that trip's metrics
        if (selectedPreviewTripIndex !== null && previewTripsForMap[selectedPreviewTripIndex]) {
            const selectedTrip = previewTripsForMap[selectedPreviewTripIndex];
            return {
                totalTrips: 1,
                totalDistance: Number(selectedTrip.total_distance_km || 0),
                totalOrders: selectedTrip.stops?.length || 0,
                totalDurationMinutes: Number(selectedTrip.total_drive_minutes || 0) + Number(selectedTrip.total_service_minutes || 0),
                totalCost: null
            };
        }
        
        // Otherwise show all trips metrics
        const metrics = previewPlan.metrics || {};
        const totalTrips = metrics.total_trips ?? previewTripsForMap.length;
        const totalDistance =
            metrics.total_distance_km ??
            previewTripsForMap.reduce((sum, trip) => sum + Number(trip.total_distance_km || 0), 0);
        const totalOrders =
            metrics.total_orders ?? previewTripsForMap.reduce((sum, trip) => sum + (trip.stops?.length || 0), 0);
        const totalDurationMinutes = metrics.total_duration_minutes ?? null;
        const totalCost = metrics.total_cost ?? null;
        return {
            totalTrips,
            totalDistance,
            totalOrders,
            totalDurationMinutes,
            totalCost
        };
    }, [previewPlan, previewTripsForMap, selectedPreviewTripIndex]);

    const getSortCellProps = (field: keyof RoutePlan) => ({
        onClick: () => handleSort(field),
        className:
            'px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-r border-gray-200 cursor-pointer'
    });

    return (
        <PageContainer>
            <PageHeaderWithFilters title="จัดเส้นทางส่งสินค้า">
                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="ค้นหาเลขเส้นทาง, ชื่อเส้นทาง, ทะเบียนรถ..."
                />
                <input
                    type="date"
                    className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 min-w-28"
                    value={startDate}
                    onChange={event => setStartDate(event.target.value)}
                />
                <span className="text-xs text-thai-gray-500">ถึง</span>
                <input
                    type="date"
                    className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50 min-w-28"
                    value={endDate}
                    onChange={event => setEndDate(event.target.value)}
                />
                <FilterSelect
                    value={selectedStatus}
                    onChange={setSelectedStatus}
                    options={statuses}
                />
                <Button
                    variant="primary"
                    icon={Plus}
                    onClick={handleCreatePlan}
                    className="text-xs py-1 px-2"
                >
                    สร้างแผนใหม่
                </Button>
                <Button
                    variant="outline"
                    icon={FileSpreadsheet}
                    onClick={() => setShowMultiPlanContractModal(true)}
                    className="text-xs py-1 px-2"
                >
                    รวมใบว่าจ้างข้ามแผน
                </Button>
            </PageHeaderWithFilters>

            <div className="flex flex-1 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto">
                            <RoutesPlanTable
                                plans={filteredPlans}
                                isLoading={loading}
                                expandedPlanIds={expandedPlanIds}
                                planTripsData={planTripsData}
                                loadingTrips={loadingTrips}
                                editingStatusPlanId={editingStatusPlanId}
                                onToggleExpand={toggleExpandPlan}
                                onStatusChange={handleStatusChange}
                                onPreviewPlan={handlePreviewPlan}
                                onOpenEditor={handleOpenEditor}
                                onEditShippingCost={handleEditShippingCost}
                                onPrintPlan={handlePrintPlan}
                                onExportTMS={handleExportTMS}
                                onApprovePlan={handleApprovePlan}
                                onDeletePlan={handleCheckDeletePlan}
                                sortField={sortField}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                            />
                        </div>
                    </div>
                </div>

                <OptimizationSidebar
                    settings={vrpSettings}
                    onChange={changes => setVrpSettings(prev => ({ ...prev, ...changes }))}
                    onSave={handleSaveSettings}
                    disabled={isOptimizing}
                    isSaving={isSavingSettings}
                    statusMessage={statusMessage}
                />
            </div>

            <CreatePlanModal
                isOpen={showCreateModal}
                onClose={handleCloseCreateModal}
                planCode={planForm.planCode}
                planName={planForm.planName}
                planDate={planForm.planDate}
                warehouseId={planForm.warehouseId}
                onPlanDateChange={handlePlanDateChange}
                warehouses={warehouses}
                onWarehouseChange={handleWarehouseChange}
                draftOrders={filteredDraftOrders}
                selectedOrders={selectedOrders}
                draftOrderFilter={draftOrderFilter}
                onDraftOrderFilterChange={setDraftOrderFilter}
                onSelectOrder={handleSelectOrder}
                onSelectAll={handleSelectAll}
                vrpSettings={vrpSettings}
                onVrpSettingsChange={(changes) => setVrpSettings(prev => ({ ...prev, ...changes }))}
                onSaveSettings={handleSaveSettings}
                isSavingSettings={isSavingSettings}
                isOptimizing={isOptimizing}
                statusMessage={statusMessage}
                onOptimize={handleOptimize}
            />

            <Modal
                isOpen={isPreviewModalOpen}
                onClose={closePreviewModal}
                title={previewModalTitle}
                size="4xl"
                contentClassName="max-h-[70vh]"
            >
                {previewLoading ? (
                    <div className="py-10 text-center text-gray-500">กำลังโหลดข้อมูลแผนที่...</div>
                ) : previewError ? (
                    <div className="py-6 text-center text-red-500">{previewError}</div>
                ) : previewPlan ? (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="text-sm text-gray-500">{previewPlan.plan_code}</div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {previewPlan.plan_name || 'แผนรับสินค้า'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {previewPlan.plan_date ? new Date(previewPlan.plan_date).toLocaleDateString('th-TH') : '-'}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 md:items-end">
                                <div>{getStatusBadge(previewPlan.status)}</div>
                                <div className="text-xs text-gray-500">
                                    คลัง: {previewPlan.warehouse?.warehouse_name || previewPlan.warehouse_id || '-'}
                                </div>
                            </div>
                        </div>

                        {previewTrips.length > 0 && (() => {
                            // Filter trips based on selection
                            const displayTrips = selectedPreviewTripIndices.length > 0
                                ? previewTrips.filter((_, index) => selectedPreviewTripIndices.includes(index))
                                : previewTrips;

                            // คำนวณข้อมูลสรุปของแต่ละเที่ยว
                            const tripsSummary = displayTrips.map((trip, displayIndex) => {
                                const originalIndex = previewTrips.indexOf(trip);
                                const totalStops = trip.stops?.length || 0;
                                const totalOrders = trip.stops?.reduce((sum: number, stop: any) => {
                                    const orders = Array.isArray(stop.orders) && stop.orders.length > 0
                                        ? stop.orders.length
                                        : 1;
                                    return sum + orders;
                                }, 0) || 0;
                                const totalWeight = trip.total_weight_kg || trip.stops?.reduce((sum: number, stop: any) => {
                                    return sum + (Number(stop.load_weight_kg) || 0);
                                }, 0) || 0;
                                const totalUnits = trip.stops?.reduce((sum: number, stop: any) => {
                                    return sum + (Number(stop.load_units) || 0);
                                }, 0) || 0;
                                const vehicleCapacity = previewPlan?.settings?.vehicleCapacityKg || vrpSettings.vehicleCapacityKg || 1000;
                                const capacityPercent = vehicleCapacity > 0 ? (totalWeight / vehicleCapacity * 100) : 0;
                                const isOverweight = trip.is_overweight || capacityPercent > 100;
                                const distance = Number(trip.total_distance_km ?? 0);

                                return {
                                    tripNumber: trip.trip_number || originalIndex + 1,
                                    distance,
                                    totalStops,
                                    totalOrders,
                                    totalUnits,
                                    totalWeight,
                                    capacityPercent,
                                    isOverweight
                                };
                            });

                            return (
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        เที่ยวที่
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        ระยะทาง (km)
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        จุดส่ง
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        ออเดอร์
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        จำนวน (ชิ้น)
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        น้ำหนัก (kg)
                                                    </th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                        % การใช้รถ
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                                {tripsSummary.map((trip, index) => (
                                                    <tr
                                                        key={index}
                                                        className={`hover:bg-gray-50 transition-colors ${
                                                            trip.isOverweight ? 'bg-red-50' : ''
                                                        }`}
                                                    >
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-gray-900">
                                                                    เที่ยวที่ {trip.tripNumber}
                                                                </span>
                                                                {trip.isOverweight && (
                                                                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                                                        ⚠️ เกิน
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-sm font-medium text-blue-600">
                                                                {trip.distance.toFixed(1)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-sm text-gray-900">
                                                                {trip.totalStops}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-sm text-gray-900">
                                                                {trip.totalOrders}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-sm text-gray-900">
                                                                {trip.totalUnits}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {trip.totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className={`text-sm font-bold ${
                                                                trip.capacityPercent > 100 ? 'text-red-600' :
                                                                trip.capacityPercent > 90 ? 'text-orange-600' :
                                                                'text-green-600'
                                                            }`}>
                                                                {trip.capacityPercent.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Trip Selector */}
                        {previewTrips.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            const allIndices = previewTrips.map((_, idx) => idx);
                                            const newSelection = selectedPreviewTripIndices.length === previewTrips.length ? [] : allIndices;
                                            setSelectedPreviewTripIndices(newSelection);
                                        }}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                            selectedPreviewTripIndices.length === previewTrips.length
                                                ? 'bg-blue-600 text-white'
                                                : selectedPreviewTripIndices.length > 0
                                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {selectedPreviewTripIndices.length === previewTrips.length
                                            ? `ยกเลิกทั้งหมด`
                                            : selectedPreviewTripIndices.length > 0
                                            ? `เลือกทั้งหมด (${selectedPreviewTripIndices.length}/${previewTrips.length})`
                                            : `ทั้งหมด (${previewTrips.length} เที่ยว)`
                                        }
                                    </button>
                                    {previewTrips.map((trip, index) => {
                                        const isSelected = selectedPreviewTripIndices.includes(index);
                                        // Use same colors as RouteMap (20 distinct colors)
                                        const tripColor = [
                                            '#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77', '#4D96FF',
                                            '#FF8C42', '#A78BFA', '#F472B6', '#34D399', '#FBBF24',
                                            '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
                                            '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
                                        ][index % 20];
                                        return (
                                            <button
                                                key={trip.trip_id || index}
                                                onClick={() => {
                                                    const newSelection = isSelected
                                                        ? selectedPreviewTripIndices.filter(i => i !== index)
                                                        : [...selectedPreviewTripIndices, index].sort((a, b) => a - b);
                                                    setSelectedPreviewTripIndices(newSelection);
                                                }}
                                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                                                    isSelected
                                                        ? 'bg-white text-gray-900 ring-2 ring-offset-0'
                                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                                }`}
                                                style={
                                                    isSelected
                                                        ? { borderColor: tripColor, borderWidth: '2px' }
                                                        : undefined
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}} // Handled by button onClick
                                                    className="w-4 h-4 rounded"
                                                    style={{ accentColor: tripColor }}
                                                />
                                                <span
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: tripColor }}
                                                />
                                                เที่ยวที่ {trip.trip_number || index + 1}
                                                <span className="text-xs text-gray-500">
                                                    ({trip.stops?.length || 0} จุด)
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {hasPreviewMapData && previewWarehouse ? (
                            <RouteMap
                                warehouse={previewWarehouse}
                                trips={previewTripsForMap}
                                height="500px"
                                selectedTripIndices={selectedPreviewTripIndices}
                                onTripSelectMulti={setSelectedPreviewTripIndices}
                                onMoveOrder={handleMoveOrder}
                                onReorderStops={handleReorderStopsInPreview}
                            />
                        ) : (
                            <div className="h-72 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-500 bg-gray-50">
                                <MapPin className="w-12 h-12 text-gray-400 mb-3" />
                                <div className="text-center">
                                    <div className="font-medium text-gray-700 mb-1">ไม่มีข้อมูลพิกัดสำหรับแผนนี้</div>
                                    <div className="text-sm text-gray-500">กรุณาตรวจสอบว่าลูกค้ามีข้อมูล Latitude และ Longitude ในระบบ</div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {previewTrips.map(trip => (
                                <div key={`preview-trip-${trip.trip_id}`} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className={`px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-2 ${
                                        trip.is_overweight ? 'bg-red-50' : 'bg-gray-50'
                                    }`}>
                                        <div>
                                            <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                                เที่ยวที่ {trip.trip_number}
                                                {trip.is_overweight && (
                                                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                                        ⚠️ น้ำหนักเกิน
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 space-x-2">
                                                <span>รถ: {trip.vehicle_label || trip.vehicle_name || '-'}</span>
                                                <span>| คนขับ: {trip.driver_label || trip.driver_name || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {Number(trip.total_distance_km ?? 0).toFixed(1)} km • {trip.stops?.length || 0} จุด
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {trip.stops && trip.stops.length > 0 ? (
                                            <table className="min-w-full text-xs">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">ลำดับ</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">เลขที่ออเดอร์</th>
                                                        <th className="px-3 py-2 text-left font-medium text-gray-600">จุดแวะ</th>
                                                        <th className="px-3 py-2 text-right font-medium text-gray-600">น้ำหนัก (kg)</th>
                                                        <th className="px-3 py-2 text-right font-medium text-gray-600">เวลาบริการ (นาที)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {trip.stops.map((stop: any, stopIndex: number) => {
                                                        // Check if stop has orders array with data
                                                        const hasOrders = Array.isArray(stop.orders) && stop.orders.length > 0;
                                                        const isConsolidated = hasOrders && stop.orders.length > 1;
                                                        
                                                        // Get all order numbers for this stop
                                                        const orderNumbers = hasOrders
                                                            ? stop.orders.map((o: any) => o.order_no).filter(Boolean).join(', ')
                                                            : (stop.order_no || '-');
                                                        
                                                        // Calculate total weight for this stop
                                                        const totalWeight = hasOrders
                                                            ? stop.orders.reduce((sum: number, order: any) => {
                                                                const weight = (order.allocated_weight_kg != null && Number.isFinite(Number(order.allocated_weight_kg)))
                                                                    ? Number(order.allocated_weight_kg)
                                                                    : (order.total_order_weight_kg != null && Number.isFinite(Number(order.total_order_weight_kg)))
                                                                        ? Number(order.total_order_weight_kg)
                                                                        : 0;
                                                                return sum + weight;
                                                            }, 0)
                                                            : (Number.isFinite(Number(stop.load_weight_kg)) ? Number(stop.load_weight_kg) : 0);
                                                        
                                                        const formattedWeight = totalWeight > 0
                                                            ? totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                                            : '-';
                                                        
                                                        const serviceDurationDisplay =
                                                            stop.service_duration_minutes != null
                                                                ? stop.service_duration_minutes
                                                                : '-';

                                                        return (
                                                            <tr key={`preview-stop-${stop.stop_id}`} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2 font-mono text-gray-600">{stop.sequence_no}</td>
                                                                <td className="px-3 py-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-blue-600">{orderNumbers}</span>
                                                                        {isConsolidated && (
                                                                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                                                                {stop.orders.length} ออเดอร์
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <div className="font-semibold text-gray-800">{stop.stop_name || '-'}</div>
                                                                    <div className="text-xs text-gray-500 truncate" style={{ maxWidth: '260px' }}>
                                                                        {stop.address || '-'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono text-gray-600">{formattedWeight}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-gray-600">{serviceDurationDisplay}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-thai-blue-50 border-t-2 border-thai-blue-200">
                                                    <tr>
                                                        <td className="px-3 py-3 text-center font-bold text-thai-blue-900 font-mono">
                                                            {trip.stops.length}
                                                        </td>
                                                        <td colSpan={2} className="px-3 py-3 text-right font-semibold text-thai-blue-900">
                                                            รวมทั้งหมด:
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-bold text-thai-blue-900 font-mono">
                                                            {(() => {
                                                                const totalWeight = trip.stops.reduce((sum: number, stop: any) => {
                                                                    const orderRows: StopOrderDetail[] =
                                                                        Array.isArray(stop.orders) && stop.orders.length > 0
                                                                            ? stop.orders
                                                                            : [{
                                                                                order_id: stop.order_id ?? null,
                                                                                order_no: stop.order_no ?? null,
                                                                                customer_name: stop.stop_name ?? null,
                                                                                allocated_weight_kg: Number.isFinite(Number(stop.load_weight_kg)) ? Number(stop.load_weight_kg) : null,
                                                                                total_order_weight_kg: Number.isFinite(Number(stop.load_weight_kg)) ? Number(stop.load_weight_kg) : null
                                                                            }];
                                                                    
                                                                    const stopWeight = orderRows.reduce((orderSum, order) => {
                                                                        const weight = (order.allocated_weight_kg != null && Number.isFinite(Number(order.allocated_weight_kg)))
                                                                            ? Number(order.allocated_weight_kg)
                                                                            : (order.total_order_weight_kg != null && Number.isFinite(Number(order.total_order_weight_kg)))
                                                                                ? Number(order.total_order_weight_kg)
                                                                                : 0;
                                                                        return orderSum + weight;
                                                                    }, 0);
                                                                    
                                                                    return sum + stopWeight;
                                                                }, 0);
                                                                
                                                                return totalWeight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                                                            })()}
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-bold text-thai-blue-900 font-mono">
                                                            {(() => {
                                                                const totalServiceTime = trip.stops.reduce((sum: number, stop: any) => {
                                                                    const serviceTime = stop.service_duration_minutes != null && Number.isFinite(Number(stop.service_duration_minutes))
                                                                        ? Number(stop.service_duration_minutes)
                                                                        : 0;
                                                                    return sum + serviceTime;
                                                                }, 0);
                                                                
                                                                return totalServiceTime;
                                                            })()}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        ) : (
                                            <div className="px-4 py-3 text-xs text-gray-500">ไม่มีจุดในเที่ยวนี้</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="text-xs text-gray-400 text-right">
                            อัปเดตล่าสุด:{' '}
                            {previewPlan.updated_at ? new Date(previewPlan.updated_at).toLocaleString('th-TH') : '-'}
                        </div>
                    </div>
                ) : (
                    <div className="py-6 text-center text-gray-500">ไม่พบข้อมูลแผนเส้นทาง</div>
                )}
            </Modal>

            {/* Excel-Style Route Editor Modal */}
            <ExcelEditor
                isOpen={isEditorOpen}
                onClose={handleCloseEditor}
                planId={editorPlanId}
                planName={editorPlan?.plan_name || editorPlan?.plan_code || ''}
                trips={editorTrips}
                draftOrders={editorDraftOrders}
                draftOrdersLoading={editorDraftOrdersLoading}
                onRefreshDraftOrders={async () => {
                    if (editorPlan?.warehouse_id) {
                        setEditorDraftOrdersLoading(true);
                        try {
                            const draftRes = await fetch(
                                `/api/route-plans/draft-orders?warehouseId=${editorPlan.warehouse_id}&forEditor=true`
                            );
                            const { data: draftData } = await draftRes.json();
                            setEditorDraftOrders(draftData || []);
                        } catch (err) {
                            console.error('Error refreshing draft orders:', err);
                        } finally {
                            setEditorDraftOrdersLoading(false);
                        }
                    }
                }}
                loading={editorLoading}
                error={editorError}
                onSave={async (changes) => {
                    try {
                        setEditorLoading(true);
                        setEditorError(null);
                        
                        const res = await fetch(`/api/route-plans/${editorPlanId}/batch-update`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(changes)
                        });
                        
                        const result = await res.json();
                        
                        if (result.error) {
                            throw new Error(result.error);
                        }
                        
                        // Refresh data
                        await fetchEditorData(editorPlanId);
                        await fetchRoutePlans();
                        setStatusMessage('บันทึกการแก้ไขเส้นทางเรียบร้อย');
                    } catch (error: any) {
                        console.error('Error saving changes:', error);
                        setEditorError(error.message || 'ไม่สามารถบันทึกการเปลี่ยนแปลงได้');
                        throw error;
                    } finally {
                        setEditorLoading(false);
                    }
                }}
                onCrossPlanTransfer={(row, tripId) => {
                    // แปลง OrderRow เป็น EditorStop
                    const stop: EditorStop = {
                        stop_id: row.stopId as number,
                        order_id: row.orderId,
                        order_no: row.orderNo,
                        stop_name: row.customerName,
                        load_weight_kg: row.weightKg,
                        sequence_no: row.stopSequence,
                        address: null,
                        latitude: null,
                        longitude: null,
                        load_volume_cbm: null,
                        load_units: row.totalQty,
                        service_duration_minutes: null,
                        tags: row.customerId ? { customer_id: row.customerId } : undefined,
                        notes: row.note,
                        orders: []
                    };
                    handleOpenCrossPlanTransfer(stop, Number(tripId));
                }}
            />

            <SplitStopModal
                isOpen={isSplitModalOpen}
                stop={editorActiveStop}
                orderId={selectedEditorOrderId}
                trips={editorTrips}
                currentTripId={editorActiveTrip?.trip_id ?? null}
                onClose={() => setIsSplitModalOpen(false)}
                onSubmit={handleSplitSubmit}
            />

            <Modal isOpen={isOptimizing} onClose={() => { }} title="กำลังคำนวณเส้นทาง" size="sm" hideCloseButton>
                <div className="flex flex-col items-center justify-center p-8">
                    <svg
                        className="animate-spin h-12 w-12 text-blue-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    <p className="mt-4 text-lg font-medium text-gray-800">กำลังประมวลผล...</p>
                    <p className="mt-2 text-sm text-gray-600 text-center">{statusMessage}</p>
                    <p className="mt-1 text-xs text-gray-500">กรุณารอสักครู่ ระบบอาจใช้เวลาหลายนาที</p>
                </div>
            </Modal>

            <PrintRoutePlanModal
                isOpen={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                planId={selectedPlanIdForPrint}
            />
            <EditShippingCostModal
                isOpen={showEditShippingCostModal}
                onClose={() => {
                    setShowEditShippingCostModal(false);
                    setSelectedPlanIdForShippingCost(null);
                    fetchRoutePlans(); // Refresh data after potential save
                }}
                planId={selectedPlanIdForShippingCost}
            />
            <TransportContractModal
                isOpen={showTransportContractModal}
                onClose={() => {
                    setShowTransportContractModal(false);
                    setSelectedPlanIdForContract(null);
                }}
                planId={selectedPlanIdForContract}
            />
            <MultiPlanContractModal
                isOpen={showMultiPlanContractModal}
                onClose={() => setShowMultiPlanContractModal(false)}
                onGenerateContract={handleGenerateMultiPlanContract}
                onExportExcel={handleMultiPlanExport}
            />
            <MultiPlanTransportContractModal
                isOpen={showMultiPlanTransportContractModal}
                onClose={() => {
                    setShowMultiPlanTransportContractModal(false);
                    setMultiPlanSelectedTrips([]);
                    setMultiPlanSupplierName('');
                }}
                selectedTrips={multiPlanSelectedTrips}
                supplierName={multiPlanSupplierName}
            />
            <CrossPlanTransferModal
                isOpen={showCrossPlanTransferModal}
                onClose={() => {
                    setShowCrossPlanTransferModal(false);
                    setCrossPlanTransferStop(null);
                    setCrossPlanTransferTripId(0);
                }}
                sourceStop={crossPlanTransferStop}
                sourcePlanId={editorPlanId || 0}
                sourceTripId={crossPlanTransferTripId}
                onTransfer={handleCrossPlanTransfer}
            />

            {/* Delete Confirmation Dialog */}
            {deleteConfirmDialog && (
                <ConfirmDialog
                    isOpen={deleteConfirmDialog.isOpen}
                    title="ยืนยันการลบแผนจัดเส้นทาง"
                    message={`คุณต้องการลบแผน "${deleteConfirmDialog.planCode}" หรือไม่?${
                        deleteConfirmDialog.picklistsCount > 0
                            ? `\n\n⚠️ จะลบ ${deleteConfirmDialog.picklistsCount} ใบหยิบ (Picklist) ที่สร้างจากแผนนี้ด้วย`
                            : ''
                    }${
                        deleteConfirmDialog.warning
                            ? `\n${deleteConfirmDialog.warning}`
                            : ''
                    }\n\n🚨 การลบไม่สามารถยกเลิกได้!`}
                    variant="danger"
                    confirmText="ลบแผน"
                    cancelText="ยกเลิก"
                    onConfirm={handleDeletePlan}
                    onCancel={() => setDeleteConfirmDialog(null)}
                    loading={isDeleting}
                />
            )}
        </PageContainer>
    );
};

export default function RoutesPageWithPermission() {
  return (
    <PermissionGuard 
      permission="order_management.orders.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการดูเส้นทางรับสินค้า</p>
          </div>
        </div>
      }
    >
      <RoutesPage />
    </PermissionGuard>
  );
}
