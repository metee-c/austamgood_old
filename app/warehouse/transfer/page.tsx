'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { MoveRecord, MoveStatus, MoveType, CreateMovePayload, CreateMoveItemInput, MoveFilters, MoveItemStatus } from '@/lib/database/move';
import { ReceiveRecord, ReceiveItem, ReceiveStatus } from '@/lib/database/receive';
import { useMoves, useCreateMove, useUpdateMoveStatus, useUpdateMoveItemStatus } from '@/hooks/useMoves';
import { useReceives } from '@/hooks/useReceive';
import { useWarehouses } from '@/hooks/useFormOptions';
import { useLocations } from '@/hooks/useLocations';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import ZoneLocationSelect from '@/components/warehouse/ZoneLocationSelect';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { Loader2, Plus, RefreshCw, Search, Package, ArrowRight, MapPin, Truck, ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Edit, Eye, UserPlus, AlertTriangle } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

const MOVE_STATUS_LABELS: Record<MoveStatus, string> = {
  draft: 'ฉบับร่าง',
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก'
};

const MOVE_ITEM_STATUS_LABELS: Record<MoveItemStatus, string> = {
  pending: 'รอดำเนินการ',
  assigned: 'มอบหมายแล้ว',
  in_progress: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก'
};

const MOVE_TYPE_LABELS: Record<MoveType, string> = {
  putaway: 'เก็บเข้าที่จัดเก็บ',
  transfer: 'ย้ายระหว่างตำแหน่ง',
  replenishment: 'เติมสินค้า',
  adjustment: 'ปรับยอดด้วยมือ'
};

function getStatusVariant(status: MoveStatus) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'pending':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'secondary';
  }
}

function getItemStatusVariant(status: MoveItemStatus) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'assigned':
      return 'info';
    case 'pending':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'secondary';
  }
}

interface DraftMoveItemState {
  selected: boolean;
  pieceQty: number;
  toLocationId: string;
  moveMethod: 'pallet' | 'sku';
}

interface TransferSelectedItem {
  key: string;
  sku_id: string;
  sku_name?: string | null;
  pallet_id?: string | null;
  pallet_id_external?: string | null;
  from_location_id: string | null;
  from_location_code?: string | null;
  from_location_type?: string | null;
  piece_qty: number;
  pack_qty: number;
  move_method: 'pallet' | 'sku';
  to_location_id: string;
}

const STATUS_OPTIONS: { value: MoveStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: MOVE_STATUS_LABELS.pending },
  { value: 'in_progress', label: MOVE_STATUS_LABELS.in_progress },
  { value: 'completed', label: MOVE_STATUS_LABELS.completed },
  { value: 'cancelled', label: MOVE_STATUS_LABELS.cancelled }
];

const TYPE_OPTIONS: { value: MoveType | 'all'; label: string }[] = [
  { value: 'all', label: 'ทุกประเภท' },
  { value: 'putaway', label: MOVE_TYPE_LABELS.putaway },
  { value: 'transfer', label: MOVE_TYPE_LABELS.transfer },
  { value: 'replenishment', label: MOVE_TYPE_LABELS.replenishment },
  { value: 'adjustment', label: MOVE_TYPE_LABELS.adjustment }
];

const DEFAULT_RECEIVE_STATUS: ReceiveStatus = 'รับเข้าแล้ว';

const locationCodesMatch = (expectedRaw: string, scannedRaw: string) => {
  if (!expectedRaw || !scannedRaw) return false;

  const expected = expectedRaw.toUpperCase().trim();
  const scanned = scannedRaw.toUpperCase().trim();

  if (expected === scanned) return true;

  const normalize = (value: string) => value.replace(/[^0-9A-Z]/g, '');
  const normalizedExpected = normalize(expected);
  const normalizedScanned = normalize(scanned);

  if (!normalizedExpected || !normalizedScanned) return false;

  if (normalizedExpected === normalizedScanned) return true;

  if (normalizedExpected.endsWith(normalizedScanned)) return true;
  if (normalizedScanned.endsWith(normalizedExpected)) return true;

  const splitSegments = (value: string) => value.split(/[^0-9A-Z]+/).filter(Boolean);
  const expectedSegments = splitSegments(expected);
  const scannedSegments = splitSegments(scanned);

  if (scannedSegments.length === 0) return false;

  if (scannedSegments.length <= expectedSegments.length) {
    const expectedTail = expectedSegments.slice(-scannedSegments.length).join('');
    if (expectedTail === scannedSegments.join('')) {
      return true;
    }
  }

  return false;
};

const TransferPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MoveStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<MoveType | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedMoves, setExpandedMoves] = useState<Set<number>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, startDate, endDate]);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnWidths, setColumnWidths] = useState({
    move_no: 12,
    move_type: 10,
    status: 8,
    locations: 25,
    item_count: 8,
    scheduled_at: 12,
    actions: 15
  });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedReceiveId, setSelectedReceiveId] = useState<number | null>(null);
  const [selectedToWarehouse, setSelectedToWarehouse] = useState<string>('');
  const [moveType, setMoveType] = useState<MoveType>('putaway');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // Employee assignment modal states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedMoveItemIds, setSelectedMoveItemIds] = useState<number[]>([]);
  const [assignmentContext, setAssignmentContext] = useState<{
    mode: 'single' | 'bulk';
    moveNo?: string;
    description?: string;
    total: number;
  }>({ mode: 'single', total: 0 });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [assignmentType, setAssignmentType] = useState<'individual' | 'role' | 'mixed'>('individual');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [requiredCount, setRequiredCount] = useState<number>(1);

  // Transfer mode states
  const [transferSearchMode, setTransferSearchMode] = useState<'pallet' | 'location' | 'sku'>('pallet');
  const [transferSearchTerm, setTransferSearchTerm] = useState<string>('');
  const [transferFromWarehouse, setTransferFromWarehouse] = useState<string>('');
  const [transferSelectedItems, setTransferSelectedItems] = useState<TransferSelectedItem[]>([]);
  const [transferSearchResults, setTransferSearchResults] = useState<TransferSelectedItem[]>([]);
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const [transferSearchError, setTransferSearchError] = useState<string | null>(null);

  useEffect(() => {
    setTransferSearchResults([]);
    setTransferSearchError(null);
  }, [transferSearchMode, transferFromWarehouse]);

  // Scanning modal states
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanningMoveItem, setScanningMoveItem] = useState<any>(null);
  const [scanningStep, setScanningStep] = useState<'pallet' | 'location'>('pallet');
  const [scannedPalletId, setScannedPalletId] = useState<string>('');
  const [scannedLocationId, setScannedLocationId] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isCompletingScan, setIsCompletingScan] = useState(false);

  const filters = useMemo(() => {
    const result: MoveFilters = {};
    if (statusFilter !== 'all') {
      result.status = statusFilter;
    }
    if (typeFilter !== 'all') {
      result.move_type = typeFilter;
    }
    if (searchTerm.trim().length > 0) {
      result.searchTerm = searchTerm.trim();
    }
    if (startDate) {
      result.startDate = startDate;
    }
    if (endDate) {
      result.endDate = endDate;
    }
    return result;
  }, [statusFilter, typeFilter, searchTerm, startDate, endDate]);

  const { moves, loading, error, refetch } = useMoves(filters);
  const { createMove, loading: creatingMove, error: createError } = useCreateMove();
  const { updateStatus, loading: updatingStatus } = useUpdateMoveStatus();
  const { updateItemStatus, loading: updatingItemStatus } = useUpdateMoveItemStatus();
  const { data: employees, loading: employeesLoading } = useEmployees();

  const receiveFilters = useMemo(
    () => ({ status: DEFAULT_RECEIVE_STATUS }),
    []
  );
  const { data: receiveOptions } = useReceives(receiveFilters);
  const { warehouses } = useWarehouses();

  const selectedReceive: ReceiveRecord | undefined = useMemo(() => {
    if (!selectedReceiveId) return undefined;
    return (receiveOptions || []).find((item) => item.receive_id === selectedReceiveId);
  }, [selectedReceiveId, receiveOptions]);

  const locationParams = useMemo(() => ({
    warehouse_id: selectedToWarehouse || selectedReceive?.warehouse_id || undefined,
    status: 'active' as const
  }), [selectedToWarehouse, selectedReceive?.warehouse_id]);
  const { locations: availableLocations, loading: locationsLoading } = useLocations(locationParams);
  const fromLocationParams = useMemo(() => ({
    warehouse_id: transferFromWarehouse || undefined,
    status: 'active' as const
  }), [transferFromWarehouse]);
  const { locations: fromWarehouseLocations } = useLocations(fromLocationParams);


  const [draftItems, setDraftItems] = useState<Record<number, DraftMoveItemState>>({});

  const selectedCount = useMemo(() => {
    return Object.values(draftItems).filter((state) => state.selected).length;
  }, [draftItems]);

  // Calculate location usage to detect duplicates (excluding items with same pallet_id)
  const locationUsage = useMemo(() => {
    const usage: Record<string, { count: number; items: string[]; pallets: Set<string> }> = {};
    
    Object.entries(draftItems).forEach(([itemId, state]) => {
      if (state.selected && state.toLocationId) {
        const item = selectedReceive?.wms_receive_items?.find(i => i.item_id === Number(itemId));
        const palletId = item?.pallet_id || `no-pallet-${itemId}`;
        
        if (!usage[state.toLocationId]) {
          usage[state.toLocationId] = { count: 0, items: [], pallets: new Set() };
        }
        
        // Only count as separate if it's a different pallet
        if (!usage[state.toLocationId].pallets.has(palletId)) {
          usage[state.toLocationId].count++;
          usage[state.toLocationId].pallets.add(palletId);
        }
        usage[state.toLocationId].items.push(itemId);
      }
    });
    
    return usage;
  }, [draftItems, selectedReceive]);

  // Find locations with multiple assignments (different pallets)
  const duplicateLocations = useMemo(() => {
    return Object.entries(locationUsage)
      .filter(([locationId, usage]) => usage.count > 1)
      .map(([locationId]) => locationId);
  }, [locationUsage]);

  useEffect(() => {
    if (!selectedReceive) {
      setDraftItems({});
      return;
    }
    const initialState: Record<number, DraftMoveItemState> = {};
    (selectedReceive.wms_receive_items || []).forEach((item) => {
      initialState[item.item_id] = {
        selected: false,
        pieceQty: item.piece_quantity,
        toLocationId: '',
        moveMethod: item.pallet_id ? 'pallet' : 'sku'
      };
    });
    setDraftItems(initialState);
  }, [selectedReceive]);

  useEffect(() => {
    if (selectedReceive && !selectedToWarehouse) {
      setSelectedToWarehouse(selectedReceive.warehouse_id || '');
    }
  }, [selectedReceive, selectedToWarehouse]);

  const handleToggleItem = (item: ReceiveItem, groupItems?: ReceiveItem[]) => {
    if (groupItems && groupItems.length > 1) {
      // Toggle all items in the group
      const isSelected = !draftItems[item.item_id]?.selected;
      setDraftItems((prev) => {
        const updates: any = {};
        groupItems.forEach(groupItem => {
          updates[groupItem.item_id] = {
            selected: isSelected,
            pieceQty: prev[groupItem.item_id]?.pieceQty ?? groupItem.piece_quantity,
            toLocationId: prev[groupItem.item_id]?.toLocationId ?? prev[item.item_id]?.toLocationId ?? '',
            moveMethod: prev[groupItem.item_id]?.moveMethod ?? (groupItem.pallet_id ? 'pallet' : 'sku')
          };
        });
        return { ...prev, ...updates };
      });
    } else {
      setDraftItems((prev) => ({
        ...prev,
        [item.item_id]: {
          selected: !prev[item.item_id]?.selected,
          pieceQty: prev[item.item_id]?.pieceQty ?? item.piece_quantity,
          toLocationId: prev[item.item_id]?.toLocationId ?? '',
          moveMethod: prev[item.item_id]?.moveMethod ?? (item.pallet_id ? 'pallet' : 'sku')
        }
      }));
    }
  };

  const handleItemChange = (
    item: ReceiveItem,
    field: keyof DraftMoveItemState,
    value: string | number | boolean,
    groupItems?: ReceiveItem[]
  ) => {
    setDraftItems((prev) => {
      // If this is a grouped item and changing location/method, apply to all items in group
      if (groupItems && groupItems.length > 1 && (field === 'toLocationId' || field === 'moveMethod')) {
        const updates: any = {};
        groupItems.forEach(groupItem => {
          const previous = prev[groupItem.item_id] ?? {
            selected: false,
            pieceQty: groupItem.piece_quantity,
            toLocationId: '',
            moveMethod: groupItem.pallet_id ? 'pallet' : 'sku'
          };

          const next: DraftMoveItemState = { ...previous };

          if (field === 'toLocationId') {
            next.toLocationId = String(value);
          }

          if (field === 'moveMethod') {
            const method = value as DraftMoveItemState['moveMethod'];
            next.moveMethod = method;
            if (method === 'pallet') {
              next.pieceQty = groupItem.piece_quantity;
            }
          }

          updates[groupItem.item_id] = next;
        });
        return { ...prev, ...updates };
      }

      // Single item change
      const previous = prev[item.item_id] ?? {
        selected: false,
        pieceQty: item.piece_quantity,
        toLocationId: '',
        moveMethod: item.pallet_id ? 'pallet' : 'sku'
      };

      const next: DraftMoveItemState = {
        ...previous
      };

      if (field === 'pieceQty') {
        const numericValue = Math.max(1, Number(value) || 1);
        next.pieceQty = numericValue;
      }

      if (field === 'toLocationId') {
        const locationId = String(value);
        
        // Check if this location is already selected by another item
        if (locationId) {
          const otherItemsUsingLocation = Object.entries(prev)
            .filter(([key, state]) => 
              key !== String(item.item_id) && 
              state.selected && 
              state.toLocationId === locationId
            );
          
          if (otherItemsUsingLocation.length > 0) {
            // Show warning but allow selection (user might intentionally want to combine รายการ)
            console.warn(`Warning: Location ${locationId} is already selected for other items`);
          }
        }
        
        next.toLocationId = locationId;
      }

      if (field === 'moveMethod') {
        const method = value as DraftMoveItemState['moveMethod'];
        next.moveMethod = method;
        if (method === 'pallet') {
          next.pieceQty = item.piece_quantity;
        }
      }

      return {
        ...prev,
        [item.item_id]: next
      };
    });
  };

  const handleToggleAll = () => {
    const allItems = selectedReceive?.wms_receive_items || [];
    if (allItems.length === 0) return;

    const allCurrentlySelected = allItems.every((item) => draftItems[item.item_id]?.selected);

    const newDraftItems = { ...draftItems };
    allItems.forEach((item) => {
      newDraftItems[item.item_id] = {
        ...(draftItems[item.item_id] || {
          pieceQty: item.piece_quantity,
          toLocationId: '',
          moveMethod: item.pallet_id ? 'pallet' : 'sku',
        }),
        selected: !allCurrentlySelected,
      };
    });
    setDraftItems(newDraftItems);
  };

  const resetCreateForm = () => {
    setSelectedReceiveId(null);
    setSelectedToWarehouse('');
    setNotes('');
    setScheduledAt('');
    setMoveType('putaway');
    setDraftItems({});
    setTransferSelectedItems([]);
    setTransferSearchResults([]);
    setTransferSearchError(null);
    setFormError(null);
  };

  const buildTransferKey = (item: { sku_id?: string | null; pallet_id?: string | null; from_location_id?: string | null }) => {
    const sku = (item.sku_id || '').toUpperCase();
    const pallet = (item.pallet_id || '').toUpperCase();
    const location = (item.from_location_id || '').toUpperCase();
    return [sku, pallet, location].join('::');
  };

  const handleAddTransferItem = (raw: TransferSelectedItem) => {
    const key = raw.key || buildTransferKey(raw);
    const pieceQty = Math.max(1, Number(raw.piece_qty) || 1);
    const item: TransferSelectedItem = {
      ...raw,
      key,
      piece_qty: pieceQty,
      pack_qty: Number.isFinite(raw.pack_qty) ? Number(raw.pack_qty) : 0,
      to_location_id: raw.to_location_id || '',
    };

    setTransferSelectedItems(prev => {
      if (prev.some(existing => existing.key === item.key)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const handleลบTransferItem = (key: string) => {
    setTransferSelectedItems(prev => prev.filter(item => item.key !== key));
  };

  const handleUpdateTransferItem = (key: string, updates: Partial<TransferSelectedItem>) => {
    setTransferSelectedItems(prev =>
      prev.map(item => (item.key === key ? { ...item, ...updates } : item))
    );
  };

  const handleTransferSearch = async () => {
    if (!transferFromWarehouse || !transferSearchTerm.trim()) {
      return;
    }

    setTransferSearchLoading(true);
    setTransferSearchError(null);
    setTransferSearchResults([]);

    try {
      const term = transferSearchTerm.trim();
      const params = new URLSearchParams();
      params.set('warehouse_id', transferFromWarehouse);
      params.set('limit', '100');

      if (transferSearchMode === 'location') {
        const normalized = term.toLowerCase();
        const matchedLocation = (fromWarehouseLocations || []).find((loc) =>
          (loc.location_code || '').toLowerCase() === normalized ||
          (loc.location_id || '').toLowerCase() === normalized
        );

        if (!matchedLocation) {
          setTransferSearchError('ไม่พบโลเคชั่นที่ระบุในคลังต้นทาง');
          return;
        }

        params.set('location_id', matchedLocation.location_id);
      } else if (transferSearchMode === 'pallet') {
        params.set('pallet_id', term);
      } else {
        params.set('sku_id', term);
      }

      const response = await fetch(`/api/inventory/balances?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'ค้นหาข้อมูลไม่สำเร็จ');
      }

      const balances: any[] = Array.isArray(result.data) ? result.data : [];

      const itemsUnderInspection = balances.filter(
        balance => balance.receive_status === 'กำลังตรวจสอบ'
      );

      if (itemsUnderInspection.length > 0) {
        const palletNames = itemsUnderInspection
          .map(b => b.pallet_id || b.master_sku?.sku_name)
          .filter(Boolean)
          .join(', ');
        setTransferSearchError(
          `ไม่สามารถย้ายสินค้าได้: ${palletNames} อยู่ในสถานะ "กำลังตรวจสอบ" กรุณารอให้การตรวจสอบเสร็จสิ้นก่อน`
        );
        setTransferSearchResults([]);
        return;
      }

      const mapped: TransferSelectedItem[] = balances
        .map((balance) => {
          const key = buildTransferKey(balance);
          return {
            key,
            sku_id: balance.sku_id,
            sku_name: balance.master_sku?.sku_name ?? null,
            pallet_id: balance.pallet_id ?? null,
            pallet_id_external: balance.pallet_id_external ?? null,
            from_location_id: balance.location_id ?? null,
            from_location_code: balance.master_location?.location_code ?? balance.location_id ?? null,
            from_location_type: balance.master_location?.location_type ?? null,
            piece_qty: Math.max(1, Number(balance.total_piece_qty ?? balance.total_pack_qty ?? 1)),
            pack_qty: Number(balance.total_pack_qty ?? 0),
            move_method: (balance.pallet_id ? 'pallet' : 'sku') as 'sku' | 'pallet',
            to_location_id: '',
          };
        })
        .filter((item) => {
          if (!item.from_location_id) return false;
          const locationCode = item.from_location_code?.toLowerCase() || '';
          if (locationCode === 'receiving' || item.from_location_type === 'receiving') {
            return false;
          }
          return true;
        });

      setTransferSearchResults(mapped);

      if (mapped.length === 0) {
        setTransferSearchError('ไม่พบข้อมูลตามเงื่อนไข');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ค้นหาข้อมูลไม่สำเร็จ';
      setTransferSearchError(message);
    } finally {
      setTransferSearchLoading(false);
    }
  };
  const handleCreateMove = async () => {
    try {
      // Validation based on move type
      if (moveType === 'putaway') {
        if (!selectedReceive) {
          setFormError('กรุณาเลือกใบรับสินค้าที่ต้องการอ้างอิง');
          return;
        }
      } else {
        if (transferSelectedItems.length === 0) {
          setFormError('กรุณาค้นหาและเลือกสินค้าที่ต้องการย้าย');
          return;
        }
        if (!transferFromWarehouse) {
          setFormError('กรุณาเลือกคลังต้นทาง');
          return;
        }
        if (!selectedToWarehouse) {
          setFormError('กรุณาเลือกคลังปลายทาง');
          return;
        }
      }

      // Validation specific to putaway mode
      if (moveType === 'putaway') {
        const selectedEntries = Object.entries(draftItems).filter(([, state]) => state.selected);
        if (selectedEntries.length === 0) {
          setFormError('กรุณาเลือกสินค้าอย่างน้อยหนึ่งรายการเพื่อย้าย');
          return;
        }

        // Check for missing destination locations
        const itemsWithoutLocation = selectedEntries.filter(([, state]) => !state.toLocationId);
        if (itemsWithoutLocation.length > 0) {
          setFormError('กรุณาระบุตำแหน่งปลายทางให้กับสินค้าทุกรายการที่เลือก');
          return;
        }

        // Check for duplicate locations (show warning but allow)
        if (duplicateLocations.length > 0) {
          const locationNames = duplicateLocations.map(locationId => {
            const location = availableLocations.find(loc => loc.location_id === locationId);
            return location?.location_code || locationId;
          }).join(', ');
          
          const confirmed = window.confirm(
            `คำเตือน: โลเคชั่น ${locationNames} ถูกAddสำหรับหลายitems ` +
            'ต้องการดำเนินการต่อหรือไม่?'
          );
          
          if (!confirmed) {
            return;
          }
        }
      }

      const itemsPayload: CreateMoveItemInput[] = [];
      
      if (moveType === 'putaway') {
        const selectedEntries = Object.entries(draftItems).filter(([, state]) => state.selected);
        selectedEntries.forEach(([key, state]) => {
          const receiveItem = (selectedReceive?.wms_receive_items || []).find((item) => item.item_id === Number(key));
          if (!receiveItem) {
            return;
          }
          const pieceQty = state.pieceQty > 0 ? state.pieceQty : receiveItem.piece_quantity;
          itemsPayload.push({
            receive_item_id: receiveItem.item_id,
            sku_id: receiveItem.sku_id,
            pallet_id: receiveItem.pallet_id ?? null,
            pallet_id_external: receiveItem.pallet_id_external ?? null,
            move_method: state.moveMethod,
            from_location_id: (() => {
              if (!receiveItem.location_id || receiveItem.location_id.trim() === '') {
                return null;
              }
              // Map location codes to actual location_ids
              const locationMapping: Record<string, string> = {
                'RCV': 'WH001',           // Receiving zone
                'SHIP': 'LOC_NEW_SHIP',   // Shipping zone
              };
              
              return locationMapping[receiveItem.location_id] || receiveItem.location_id;
            })(),
            to_location_id: state.toLocationId ? state.toLocationId : null,
            requested_pack_qty: receiveItem.pack_quantity ?? 0,
            requested_piece_qty: pieceQty,
            confirmed_pack_qty: 0,
            confirmed_piece_qty: 0,
            production_date: receiveItem.production_date ?? null,
            expiry_date: receiveItem.expiry_date ?? null,
            remarks: null,
            created_by: null // TODO: Replace with actual user ID from auth context
          });
        });
      } else {
        // Handle transfer-like modes (transfer, replenishment, adjustment)
        // Need to handle partial pallet moves - generate new pallet IDs
        const partialMoveItems: typeof transferSelectedItems = [];

        for (const item of transferSelectedItems) {
          // Check if this is a partial pallet move
          // If item has pallet_id and quantity is less than total, it's partial
          const isPartialMove = item.pallet_id && item.move_method === 'pallet';

          let newPalletId: string | null = null;
          let parentPalletId: string | null = null;

          if (isPartialMove) {
            // Generate new pallet ID for the partial move
            try {
              const response = await fetch('/api/receives/generate-pallet-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              const result = await response.json();

              if (result.data) {
                newPalletId = result.data;
                parentPalletId = item.pallet_id;
              }
            } catch (err) {
              console.error('Failed to generate new pallet ID for partial move:', err);
              // Continue without new pallet ID - will use original
            }
          }

          itemsPayload.push({
            receive_item_id: null,
            sku_id: item.sku_id,
            pallet_id: isPartialMove && newPalletId ? newPalletId : (item.pallet_id || null),
            pallet_id_external: item.pallet_id_external || null,
            parent_pallet_id: parentPalletId,
            new_pallet_id: newPalletId,
            move_method: item.move_method,
            from_location_id: item.from_location_id || null,
            to_location_id: item.to_location_id || null,
            requested_pack_qty: 0, // ให้ API คำนวณจาก piece_qty
            requested_piece_qty: Math.max(1, Number(item.piece_qty) || 1),
            confirmed_pack_qty: 0,
            confirmed_piece_qty: 0,
            production_date: null,
            expiry_date: null,
            remarks: null,
            created_by: null
          });
        }
      }

      if (itemsPayload.length === 0) {
        setFormError('ไม่พบสินค้าที่เลือกสำหรับย้าย');
        return;
      }

      const payload: CreateMovePayload = {
        move_type: moveType,
        status: 'pending',
        source_receive_id: moveType === 'putaway' ? selectedReceive?.receive_id || null : null,
        source_document: moveType === 'putaway' ? selectedReceive?.receive_no || null : null,
        from_warehouse_id: moveType === 'putaway' ? 
          (selectedReceive?.warehouse_id ?? null) : 
          (transferFromWarehouse || null),
        to_warehouse_id: selectedToWarehouse || 
          (moveType === 'putaway' ? selectedReceive?.warehouse_id : transferFromWarehouse) || null,
        scheduled_at: scheduledAt || null,
        notes: notes || null,
        created_by: null, // TODO: Replace with actual user ID from auth context
        items: itemsPayload
      };

      const result = await createMove(payload);
      if (result.error) {
        setFormError(result.error);
        return;
      }

      setIsCreateModalOpen(false);
      resetCreateForm();
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถสร้างใบย้ายสินค้าได้';
      setFormError(message);
    }
  };

  const handleStatusUpdate = async (moveId: number, status: MoveStatus) => {
    await updateStatus(moveId, status);
    refetch();
  };

  const handleItemStatusUpdate = async (moveItemId: number, status: MoveItemStatus) => {
    await updateItemStatus(moveItemId, status);
    refetch();
  };

  const handleStartWork = (moveItem: any) => {
    console.log('handleStartWork called with:', moveItem);
    // เปิด scanning modal ทันที โดยไม่อัพเดทสถานะก่อน
    handleStartScanning(moveItem);
  };

  const handleStartScanning = (moveItem: any) => {
    console.log('handleStartScanning called with:', moveItem);
    console.log('About to set modal open to true');
    setScanningMoveItem(moveItem);
    setScanningStep('pallet');
    setScannedPalletId('');
    setScannedLocationId('');
    setScanError(null);
    setIsScanModalOpen(true);
    console.log('Modal state should be set to true now');
  };

  const handlePalletScan = async () => {
    if (!scannedPalletId.trim()) {
      setScanError('กรุณาสแกนหรือป้อนรหัสพาเลท');
      return;
    }

    // Validate pallet ID matches the expected pallet
    if (scanningMoveItem?.pallet_id && scanningMoveItem.pallet_id !== scannedPalletId.trim()) {
      setScanError(`รหัสพาเลทไม่ตรงกัน คาดหวัง: ${scanningMoveItem.pallet_id}`);
      return;
    }

    // ไม่อัพเดท database ที่นี่ - เฉพาะ validation และไปขั้นตอนต่อไป
    setScanError(null);
    setScanningStep('location');
  };

  const handleLocationScan = async () => {
    if (!scannedLocationId.trim()) {
      setScanError('กรุณาสแกนหรือป้อนรหัสโลเคชั่น');
      return;
    }

    if (isCompletingScan) {
      return;
    }

    // Extract location name from scanned input (remove warehouse prefix if present)
    const scannedInput = scannedLocationId.trim();
    const expectedLocationCodeRaw = (scanningMoveItem?.to_location?.location_code || scanningMoveItem?.to_location_id || '').trim();
    const isMatch = locationCodesMatch(expectedLocationCodeRaw, scannedInput);

    if (!isMatch) {
      setScanError(`รหัสโลเคชั่นไม่ตรงกัน คาดหวัง: ${expectedLocationCodeRaw || '-'} (สแกนได้: ${scannedInput})`);
      return;
    }

    try {
      setIsCompletingScan(true);
      setScanError(null);

      // Find all move items with the same pallet_id in the same move
      const currentMove = moves.find(m => 
        m.wms_move_items?.some(item => item.move_item_id === scanningMoveItem.move_item_id)
      );
      
      const itemsToComplete = currentMove?.wms_move_items?.filter(item =>
        item.pallet_id === scanningMoveItem.pallet_id &&
        item.from_location_id === scanningMoveItem.from_location_id &&
        item.to_location_id === scanningMoveItem.to_location_id &&
        (item.status === 'in_progress' || item.status === 'assigned')
      ) || [scanningMoveItem];

      // Update all move items in the same pallet
      const now = new Date().toISOString();
      const updatePromises = itemsToComplete.map(item =>
        fetch(`/api/moves/items/${item.move_item_id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
            started_at: now,
            pallet_scanned_at: now,
            location_scanned_at: now,
            completed_at: now,
            executed_by: null // TODO: Replace with actual user ID from auth context
          }),
        })
      );

      const responses = await Promise.all(updatePromises);
      
      if (!responses || responses.length === 0) {
        throw new Error('No items to update');
      }

      const failedResponse = responses.find(r => r && !r.ok);
      
      if (failedResponse) {
        const errorData = await failedResponse.json();
        throw new Error(errorData.error || 'Failed to complete move');
      }

      // Use the first response for backward compatibility
      const response = responses[0];

      if (!response || !response.ok) {
        if (response) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to complete scanning');
        } else {
          throw new Error('Invalid response from server');
        }
      }

      setIsScanModalOpen(false);
      setScanningMoveItem(null);
      setScanningStep('pallet');
      setScannedPalletId('');
      setScannedLocationId('');
      setScanError(null);
      refetch();
    } catch (error) {
      setScanError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (error instanceof Error ? error.message : 'Unknown error'));
      console.error('Error completing scan:', error);
    } finally {
      setIsCompletingScan(false);
    }
  };

  const openAssignmentDialog = (
    moveItemIds: number[],
    context: { mode: 'single' | 'bulk'; moveNo?: string; description?: string }
  ) => {
    if (moveItemIds.length === 0) {
      return;
    }

    setSelectedMoveItemIds(moveItemIds);
    setAssignmentContext({
      mode: context.mode,
      moveNo: context.moveNo,
      description: context.description,
      total: moveItemIds.length
    });
    setSelectedEmployeeId(null);
    setAssignmentType('individual');
    setSelectedRole('');
    setRequiredCount(1);
    setIsAssignModalOpen(true);
  };

  const handleBulkAssign = (move: MoveRecord) => {
    const pendingItems = (move.wms_move_items || []).filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      return;
    }

    openAssignmentDialog(
      pendingItems.map(item => item.move_item_id),
      {
        mode: 'bulk',
        moveNo: move.move_no,
        description: 'สินค้าในใบนี้'
      }
    );
  };

  const handleConfirmAssignment = async () => {
    if (selectedMoveItemIds.length === 0) return;

    if (assignmentType === 'individual' && !selectedEmployeeId) return;
    if (assignmentType === 'role' && !selectedRole) return;
    if (assignmentType === 'mixed' && (!selectedEmployeeId || !selectedRole)) return;

    try {
      const assignmentDetails: any = {
        assigned_at: new Date().toISOString(),
        required_count: requiredCount
      };

      if (assignmentType === 'individual') {
        const selectedEmployee = employees?.find(e => e.employee_id === selectedEmployeeId);
        const fullName = selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}`.trim() : '';
        assignmentDetails.employee_name = fullName || null;
      } else if (assignmentType === 'role') {
        const eligibleEmployees = employees?.filter(e => e.wms_role === selectedRole).map(e => e.employee_id) || [];
        assignmentDetails.eligible_employees = eligibleEmployees;
        assignmentDetails.role = selectedRole;
      } else if (assignmentType === 'mixed') {
        assignmentDetails.primary_employee = selectedEmployeeId;
        assignmentDetails.support_role = selectedRole;
        assignmentDetails.support_count = Math.max(0, requiredCount - 1);
      }

      const payload: any = {
        status: 'assigned',
        assignment_type: assignmentType,
        assignment_details: assignmentDetails
      };

      if (assignmentType === 'individual' || assignmentType === 'mixed') {
        payload.assigned_to = selectedEmployeeId;
      }

      if (assignmentType === 'role' || assignmentType === 'mixed') {
        payload.assigned_role = selectedRole;
      }

      for (const moveItemId of selectedMoveItemIds) {
        const response = await fetch(`/api/moves/items/${moveItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || 'Failed to assign employee');
        }
      }

      setIsAssignModalOpen(false);
      setSelectedMoveItemIds([]);
      setAssignmentContext({ mode: 'single', total: 0 });
      setSelectedEmployeeId(null);
      setAssignmentType('individual');
      setSelectedRole('');
      setRequiredCount(1);
      refetch();
    } catch (error) {
      console.error('Error assigning employee:', error);
    }
  };

  const toggleMoveExpansion = (moveId: number) => {
    setExpandedMoves(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moveId)) {
        newSet.delete(moveId);
      } else {
        newSet.add(moveId);
      }
      return newSet;
    });
  };

  // Sort function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort icon component
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-gray-600" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-gray-600" />
    );
  };

  // Column resizing functions
  const handlePointerDown = (e: React.PointerEvent, column: string) => {
    e.preventDefault();
    setIsResizing(column);
    const startX = e.clientX;
    const startWidth = columnWidths[column as keyof typeof columnWidths];

    const handlePointerMove = (e: PointerEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(5, Math.min(50, startWidth + (deltaX / window.innerWidth) * 100));
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };

    const handlePointerUp = () => {
      setIsResizing(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  const availableItems = selectedReceive?.wms_receive_items || [];
  const selectedCountInTable = availableItems.filter(item => draftItems[item.item_id]?.selected).length;
  const allSelected = availableItems.length > 0 && selectedCountInTable === availableItems.length;
  const someSelected = selectedCountInTable > 0 && !allSelected;

  // Sorted moves logic
  const sortedMoves = useMemo(() => {
    if (!moves || moves.length === 0) return [];
    
    let sorted = [...moves];
    
    if (sortField) {
      sorted.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';
        
        switch (sortField) {
          case 'move_no':
            aValue = a.move_no || '';
            bValue = b.move_no || '';
            break;
          case 'move_type':
            aValue = MOVE_TYPE_LABELS[a.move_type] || '';
            bValue = MOVE_TYPE_LABELS[b.move_type] || '';
            break;
          case 'status':
            aValue = MOVE_STATUS_LABELS[a.status] || '';
            bValue = MOVE_STATUS_LABELS[b.status] || '';
            break;
          case 'locations':
            const aFromLocations = a.wms_move_items?.map(item => item.from_location?.location_name || item.from_location?.location_code || 'ไม่ระบุ') || [];
            const bFromLocations = b.wms_move_items?.map(item => item.from_location?.location_name || item.from_location?.location_code || 'ไม่ระบุ') || [];
            aValue = aFromLocations[0] || '';
            bValue = bFromLocations[0] || '';
            break;
          case 'item_count':
            aValue = a.wms_move_items ? a.wms_move_items.length : 0;
            bValue = b.wms_move_items ? b.wms_move_items.length : 0;
            break;
          case 'scheduled_at':
            aValue = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
            bValue = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue, 'th');
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        return 0;
      });
    }
    
    return sorted;
  }, [moves, sortField, sortDirection]);

  const renderMoveItems = (move: MoveRecord) => {
    const items = move.wms_move_items || [];
    if (items.length === 0) {
      return (
        <div className="text-center text-sm text-thai-gray-500 py-4">
          ไม่มีitemsสินค้าในใบย้ายนี้
        </div>
      );
    }

    const pendingItems = items.filter(item => item.status === 'pending');

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <div>
            ทั้งหมด {items.length} รายการ{' '}
            {items.length > 0 && (
              pendingItems.length > 0
                ? `• รอดำเนินการ ${pendingItems.length} รายการ`
                : '• ไม่มีงานรอดำเนินการ'
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pendingItems.length === 0 || updatingItemStatus}
            onClick={() => handleBulkAssign(move)}
            className="flex items-center gap-1 text-xs py-0.5 px-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
          >
            <UserPlus className="w-3.5 h-3.5" />
            มอบหมายทั้งหมด
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <th className="w-[18%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">สินค้า</th>
              <th className="w-[10%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">ต้นทาง</th>
              <th className="w-[10%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">ปลายทาง</th>
              <th className="w-[8%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">ชิ้น</th>
              <th className="w-[8%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">แพ็ค</th>
              <th className="w-[8%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">วิธีย้าย</th>
              <th className="w-[15%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">พาเลท</th>
              <th className="w-[10%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">สถานะ</th>
              <th className="w-[13%] text-left px-1.5 py-1 text-xs font-semibold text-gray-700 uppercase">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Group items by pallet_id
              const groupedItems: any[] = [];
              const processedIds = new Set<number>();

              for (const item of items) {
                if (processedIds.has(item.move_item_id)) continue;

                if (!item.pallet_id) {
                  processedIds.add(item.move_item_id);
                  groupedItems.push(item);
                  continue;
                }

                const sameGroup = items.filter(other =>
                  !processedIds.has(other.move_item_id) &&
                  other.pallet_id === item.pallet_id &&
                  other.from_location_id === item.from_location_id &&
                  other.to_location_id === item.to_location_id
                );

                if (sameGroup.length > 1) {
                  sameGroup.forEach(g => processedIds.add(g.move_item_id));
                  groupedItems.push({
                    ...item,
                    _isGrouped: true,
                    _groupItems: sameGroup
                  });
                } else {
                  processedIds.add(item.move_item_id);
                  groupedItems.push(item);
                }
              }

              return groupedItems.map((item: any) => {
                if (item._isGrouped && item._groupItems) {
                  return item._groupItems.map((subItem: any, idx: number) => (
                    <tr key={`${item.move_item_id}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-1.5 py-1 align-top">
                        <div>
                          <p className="font-semibold text-gray-900 text-xs leading-tight truncate" title={subItem.master_sku?.sku_name || subItem.sku_id}>
                            {subItem.master_sku?.sku_name || subItem.sku_id}
                          </p>
                        </div>
                      </td>
                      {idx === 0 && (
                        <>
                          <td className="px-1.5 py-1 align-middle" rowSpan={item._groupItems.length}>
                            <div className="text-xs text-gray-700 leading-tight truncate">
                              {subItem.from_location?.location_name || subItem.from_location?.location_code || subItem.from_location_id || '-'}
                            </div>
                          </td>
                          <td className="px-1.5 py-1 align-middle" rowSpan={item._groupItems.length}>
                            <div className="text-xs text-gray-700 leading-tight truncate">
                              {subItem.to_location?.location_name || subItem.to_location?.location_code || subItem.to_location_id || '-'}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-1.5 py-1 align-top">
                        <div className="text-xs font-bold text-gray-900 leading-tight">
                          {subItem.requested_piece_qty.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-1.5 py-1 align-top">
                        <div className="text-xs text-gray-700 leading-tight">
                          {subItem.requested_pack_qty > 0 ? subItem.requested_pack_qty.toLocaleString() : '-'}
                        </div>
                      </td>
                      {idx === 0 && (
                        <>
                          <td className="px-1.5 py-1 align-middle" rowSpan={item._groupItems.length}>
                            <div className="text-xs text-gray-700 leading-tight">
                              {subItem.move_method === 'pallet' ? 'ทั้งพาเลท' : 'ตามจำนวน'}
                            </div>
                          </td>
                          <td className="px-1.5 py-1 align-middle" rowSpan={item._groupItems.length}>
                            <div className="font-mono text-xs text-gray-700 leading-tight truncate">
                              {subItem.pallet_id || '-'}
                            </div>
                          </td>
                          <td className="px-1.5 py-1 align-middle" rowSpan={item._groupItems.length}>
                            <Badge 
                              variant={getItemStatusVariant(subItem.status)} 
                              size="sm" 
                              className="whitespace-nowrap text-xs"
                            >
                              {MOVE_ITEM_STATUS_LABELS[subItem.status]}
                            </Badge>
                          </td>
                          <td className="px-1.5 py-1 align-middle" rowSpan={item._groupItems.length}>
                            <div className="flex items-center gap-1">
                              {subItem.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    openAssignmentDialog(
                                      item._groupItems.map((g: any) => g.move_item_id),
                                      {
                                        mode: 'single',
                                        moveNo: move.move_no,
                                        description: `Pallet ${subItem.pallet_id}`
                                      }
                                    )
                                  }
                                  disabled={updatingItemStatus}
                                  className="text-xs py-0.5 px-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                >
                                  มอบหมาย
                                </Button>
                              )}
                              {subItem.status === 'assigned' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartWork(subItem)}
                                  disabled={updatingItemStatus}
                                  className="text-xs py-0.5 px-2 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300"
                                >
                                  เริ่มงาน
                                </Button>
                              )}
                              {subItem.status === 'in_progress' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleStartScanning(subItem)}
                                  disabled={updatingItemStatus}
                                  className="text-xs py-0.5 px-2 bg-green-600 hover:bg-green-700"
                                >
                                  สแกนเพื่อเสร็จงาน
                                </Button>
                              )}
                              {subItem.status === 'completed' && (
                                <span className="text-xs text-green-600 font-medium">เสร็จสิ้น</span>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                }

                return (
                  <tr key={item.move_item_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-1.5 py-1 align-top">
                      <div>
                        <p className="font-semibold text-gray-900 text-xs leading-tight truncate" title={item.master_sku?.sku_name || item.sku_id}>
                          {item.master_sku?.sku_name || item.sku_id}
                        </p>
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="text-xs text-gray-700 leading-tight truncate">
                        {item.from_location?.location_name || item.from_location?.location_code || item.from_location_id || '-'}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="text-xs text-gray-700 leading-tight truncate">
                        {item.to_location?.location_name || item.to_location?.location_code || item.to_location_id || '-'}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="text-xs font-bold text-gray-900 leading-tight">
                        {item.requested_piece_qty.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="text-xs text-gray-700 leading-tight">
                        {item.requested_pack_qty > 0 ? item.requested_pack_qty.toLocaleString() : '-'}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="text-xs text-gray-700 leading-tight">
                        {item.move_method === 'pallet' ? 'ทั้งพาเลท' : 'ตามจำนวน'}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="font-mono text-xs text-gray-700 leading-tight truncate">
                        {item.pallet_id || '-'}
                      </div>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <Badge 
                        variant={getItemStatusVariant(item.status)} 
                        size="sm" 
                        className="whitespace-nowrap text-xs"
                      >
                        {MOVE_ITEM_STATUS_LABELS[item.status]}
                      </Badge>
                    </td>
                    <td className="px-1.5 py-1 align-top">
                      <div className="flex items-center gap-1">
                        {item.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openAssignmentDialog(
                                [item.move_item_id],
                                {
                                  mode: 'single',
                                  moveNo: move.move_no,
                                  description: item.master_sku?.sku_name || item.sku_id
                                }
                              )
                            }
                            disabled={updatingItemStatus}
                            className="text-xs py-0.5 px-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                          >
                            มอบหมาย
                          </Button>
                        )}
                        {item.status === 'assigned' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartWork(item)}
                            disabled={updatingItemStatus}
                            className="text-xs py-0.5 px-2 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300"
                          >
                            เริ่มงาน
                          </Button>
                        )}
                        {item.status === 'in_progress' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStartScanning(item)}
                            disabled={updatingItemStatus}
                            className="text-xs py-0.5 px-2 bg-green-600 hover:bg-green-700"
                          >
                            สแกนเพื่อเสร็จงาน
                          </Button>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-xs text-green-600 font-medium">เสร็จสิ้น</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">ย้ายสินค้าในคลัง</h1>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MoveStatus | 'all')}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MoveType | 'all')}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
            <span className="text-thai-gray-400 text-[10px]">ถึง</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={refetch} disabled={loading || updatingStatus} className="text-xs py-1 px-2">
              รีเฟรช
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsCreateModalOpen(true)} className="text-xs py-1 px-2">
              สร้างใบย้าย
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">กำลังโหลดข้อมูลการย้ายสินค้า...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <p className="text-sm">{error}</p>
              </div>
            ) : moves.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <Package className="w-12 h-12" />
                <div className="text-center">
                  <p className="font-thai text-sm">ยังไม่มีใบย้ายสินค้า</p>
                  <p className="text-xs text-thai-gray-400">เริ่มต้นด้วยการสร้างใบย้ายใหม่</p>
                </div>
              </div>
            ) : (
              <>
              <div className="flex-1 overflow-auto thin-scrollbar">
              <table className="w-full table-fixed text-sm" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 z-10 border-b border-gray-200">
                  <tr>
                    <th 
                      className="relative px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      style={{ width: `${columnWidths.move_no}%` }}
                    >
                      <button
                        onClick={() => handleSort('move_no')}
                        className="flex items-center justify-between w-full text-left hover:text-gray-900 transition-colors"
                      >
                        <span>เลขที่ใบย้าย</span>
                        {getSortIcon('move_no')}
                      </button>
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gray-300 transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, 'move_no')}
                        style={{ cursor: isResizing === 'move_no' ? 'col-resize' : 'col-resize' }}
                      />
                    </th>
                    <th 
                      className="relative px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      style={{ width: `${columnWidths.move_type}%` }}
                    >
                      <button
                        onClick={() => handleSort('move_type')}
                        className="flex items-center justify-between w-full text-left hover:text-gray-900 transition-colors"
                      >
                        <span>ประเภท</span>
                        {getSortIcon('move_type')}
                      </button>
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gray-300 transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, 'move_type')}
                        style={{ cursor: isResizing === 'move_type' ? 'col-resize' : 'col-resize' }}
                      />
                    </th>
                    <th 
                      className="relative px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      style={{ width: `${columnWidths.status}%` }}
                    >
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center justify-between w-full text-left hover:text-gray-900 transition-colors"
                      >
                        <span>สถานะ</span>
                        {getSortIcon('status')}
                      </button>
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gray-300 transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, 'status')}
                        style={{ cursor: isResizing === 'status' ? 'col-resize' : 'col-resize' }}
                      />
                    </th>
                    <th 
                      className="relative px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      style={{ width: `${columnWidths.locations}%` }}
                    >
                      <button
                        onClick={() => handleSort('locations')}
                        className="flex items-center justify-between w-full text-left hover:text-gray-900 transition-colors"
                      >
                        <span>ตำแหน่งต้นทาง → ปลายทาง</span>
                        {getSortIcon('locations')}
                      </button>
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gray-300 transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, 'locations')}
                        style={{ cursor: isResizing === 'locations' ? 'col-resize' : 'col-resize' }}
                      />
                    </th>
                    <th 
                      className="relative px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      style={{ width: `${columnWidths.item_count}%` }}
                    >
                      <button
                        onClick={() => handleSort('item_count')}
                        className="flex items-center justify-between w-full text-left hover:text-gray-900 transition-colors"
                      >
                        <span>จำนวนสินค้า</span>
                        {getSortIcon('item_count')}
                      </button>
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gray-300 transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, 'item_count')}
                        style={{ cursor: isResizing === 'item_count' ? 'col-resize' : 'col-resize' }}
                      />
                    </th>
                    <th 
                      className="relative px-2 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 last:border-r-0"
                      style={{ width: `${columnWidths.scheduled_at}%` }}
                    >
                      <button
                        onClick={() => handleSort('scheduled_at')}
                        className="flex items-center justify-between w-full text-left hover:text-gray-900 transition-colors"
                      >
                        <span>กำหนดดำเนินการ</span>
                        {getSortIcon('scheduled_at')}
                      </button>
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gray-300 transition-colors"
                        onPointerDown={(e) => handlePointerDown(e, 'scheduled_at')}
                        style={{ cursor: isResizing === 'scheduled_at' ? 'col-resize' : 'col-resize' }}
                      />
                    </th>
                    <th 
                      className="relative px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide"
                      style={{ width: `${columnWidths.actions}%` }}
                    >
                      <span>การจัดการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMoves.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((move) => {
                    const itemCount = move.wms_move_items ? move.wms_move_items.length : 0;
                    const isExpanded = expandedMoves.has(move.move_id);
                    return (
                      <React.Fragment key={move.move_id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-1.5 text-xs font-semibold text-gray-900" style={{ width: `${columnWidths.move_no}%` }}>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleMoveExpansion(move.move_id)}
                                className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                              <span className="font-mono text-blue-700">{move.move_no}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-gray-700" style={{ width: `${columnWidths.move_type}%` }}>
                            <span className="text-xs font-medium">
                              {MOVE_TYPE_LABELS[move.move_type]}
                            </span>
                          </td>
                          <td className="px-2 py-1.5" style={{ width: `${columnWidths.status}%` }}>
                            <Badge 
                              variant={getStatusVariant(move.status)} 
                              size="sm" 
                              className="whitespace-nowrap shadow-sm"
                            >
                              {MOVE_STATUS_LABELS[move.status]}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-gray-600" style={{ width: `${columnWidths.locations}%` }}>
                            <div className="flex items-center gap-2 max-w-full overflow-hidden">
                              {(() => {
                                const fromLocations = move.wms_move_items?.map(item => item.from_location?.location_name || item.from_location?.location_code || 'ไม่ระบุ') || [];
                                const toLocations = move.wms_move_items?.map(item => item.to_location?.location_name || item.to_location?.location_code || 'ไม่ระบุ') || [];
                                
                                const uniqueFromLocations = [...new Set(fromLocations)];
                                const uniqueToLocations = [...new Set(toLocations)];
                                
                                const fromText = uniqueFromLocations.length > 1 ? `${uniqueFromLocations[0]} และอื่นๆ` : uniqueFromLocations[0] || 'ไม่ระบุ';
                                const toText = uniqueToLocations.length > 1 ? `${uniqueToLocations[0]} และอื่นๆ` : uniqueToLocations[0] || 'ไม่ระบุ';
                                
                                return (
                                  <>
                                    <span className="text-xs text-gray-700">
                                      {fromText}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-xs text-gray-700">
                                      {toText}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-gray-700 font-medium" style={{ width: `${columnWidths.item_count}%` }}>
                            <span className="text-xs font-semibold text-gray-700">
                              {itemCount} items
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-xs text-gray-600" style={{ width: `${columnWidths.scheduled_at}%` }}>
                            {move.scheduled_at ? (
                              <span className="font-mono">
                                {new Date(move.scheduled_at).toLocaleString('th-TH', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5" style={{ width: `${columnWidths.actions}%` }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                จัดการระดับitems
                              </span>
                            </div>
                          </td>
                      </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={100} className="px-0 py-0 bg-gray-50">
                              <div className="border-t border-gray-200">
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-900">รายละเอียดการย้ายสินค้า</h4>
                                    <Badge variant="info" size="sm">
                                      {move.wms_move_items?.length || 0} items
                                    </Badge>
                                  </div>
                                  {renderMoveItems(move)}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            {/* Pagination Bar */}
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-gray-50 rounded-b-lg text-xs">
                <div className="text-sm text-thai-gray-600 font-thai">
                  แสดง {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedMoves.length)} จาก {sortedMoves.length.toLocaleString()} รายการ
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าแรก"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm font-thai">
                    หน้า {currentPage} / {Math.ceil(sortedMoves.length / pageSize)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(sortedMoves.length / pageSize)}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.ceil(sortedMoves.length / pageSize))}
                    disabled={currentPage >= Math.ceil(sortedMoves.length / pageSize)}
                    className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าสุดท้าย"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Move Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetCreateForm();
        }}
        title="สร้างใบย้ายสินค้าใหม่"
        size="4xl"
        contentClassName="h-[85vh]"
      >
        <div className="space-y-4 flex flex-col h-full">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 mb-1">ประเภทการย้าย</label>
              <select
                value={moveType}
                onChange={(e) => setMoveType(e.target.value as MoveType)}
                className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-sm"
              >
                {TYPE_OPTIONS.filter((option) => option.value !== 'all').map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 mb-1">คลังปลายทาง</label>
              <select
                value={selectedToWarehouse}
                onChange={(e) => setSelectedToWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-sm"
              >
                <option value="">Addคลังปลายทาง</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            {moveType === 'putaway' && (
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 mb-1">อ้างอิงใบรับสินค้า</label>
                <select
                  value={selectedReceiveId ?? ''}
                  onChange={(e) => {
                    const newId = e.target.value ? Number(e.target.value) : null;
                    if (newId) {
                      const selected = receiveOptions?.find(r => r.receive_id === newId);
                      if (selected?.status === 'กำลังตรวจสอบ') {
                        alert('ไม่สามารถสร้างใบย้ายได้: สินค้านี้อยู่ในสถานะ "กำลังตรวจสอบ" กรุณารอให้การตรวจสอบเสร็จสิ้นก่อน');
                        return;
                      }
                    }
                    setSelectedReceiveId(newId);
                  }}
                  className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-sm"
                >
                  <option value="">เลือกใบรับสินค้า</option>
                  {(receiveOptions || []).map((receive) => (
                    <option key={receive.receive_id} value={receive.receive_id}>
                      {receive.receive_no} ({receive.master_supplier?.supplier_name || 'ไม่ระบุ'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 mb-1">กำหนดดำเนินการ</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>



          <div>
            <label className="block text-sm font-medium text-thai-gray-700 mb-1">หมายเหตุ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-thai-gray-200 rounded-lg text-sm"
              placeholder="รายละเอียดเพิ่มเติม, เลขอ้างอิงภายใน หรือคำแนะนำสำหรับพนักงาน"
            />
          </div>

          <div className="border border-thai-gray-200 rounded-lg flex flex-col min-h-0 resize-y overflow-auto" style={{ minHeight: '400px', maxHeight: '800px' }}>
            <div className="px-4 py-3 border-b border-thai-gray-200 bg-thai-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-thai-gray-900">
                  {moveType === 'putaway' ? 'itemsสินค้าที่รับมา' : 'itemsสินค้าที่ต้องการย้าย'}
                </p>
                <p className="text-xs text-thai-gray-500">
                  {moveType === 'putaway' 
                    ? 'Addสินค้าที่ต้องการย้ายและกรอกจำนวนที่ต้องการย้ายในตารางด้านล่าง'
                    : 'ค้นหาและAddสินค้า พาเลท หรือโลเคชั่นที่ต้องการย้าย'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <Badge variant="success" size="sm">เลือก {selectedCount} รายการ</Badge>
                )}
                {selectedReceive && (
                  <Badge variant="info" size="sm">ทั้งหมด {(selectedReceive.wms_receive_items || []).length} items</Badge>
                )}
                {duplicateLocations.length > 0 && (
                  <Badge variant="warning" size="sm">⚠️ โลเคชั่นซ้ำ {duplicateLocations.length} ตำแหน่ง</Badge>
                )}
              </div>
            </div>
            {moveType === 'putaway' ? (
              selectedReceive ? (
                <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
                  <table className="min-w-[1000px] text-xs">
                  <thead className="bg-thai-gray-50">
                    <tr className="text-thai-gray-600">
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={handleToggleAll}
                          className="w-4 h-4 text-primary-600 border-thai-gray-300 rounded focus:ring-primary-500"
                        />
                      </th>
                      <th className="px-2 py-2 text-left">สินค้า</th>
                      <th className="px-2 py-2 text-left">พาเลท</th>
                      <th className="px-2 py-2 text-left">จำนวนรับ</th>
                      <th className="px-2 py-2 text-left">จำนวนย้าย</th>
                      <th className="px-2 py-2 text-left">ตำแหน่งปัจจุบัน</th>
                      <th className="px-2 py-2 text-left w-64">รหัสตำแหน่งปลายทาง</th>
                      <th className="px-2 py-2 text-left">วิธีการย้าย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thai-gray-100">
                    {(() => {
                      const items = selectedReceive.wms_receive_items || [];
                      const groupedItems: any[] = [];
                      const processedIds = new Set<number>();

                      for (const item of items) {
                        if (processedIds.has(item.item_id)) continue;

                        if (!item.pallet_id) {
                          processedIds.add(item.item_id);
                          groupedItems.push(item);
                          continue;
                        }

                        const sameGroup = items.filter(other =>
                          !processedIds.has(other.item_id) &&
                          other.pallet_id === item.pallet_id
                        );

                        if (sameGroup.length > 1) {
                          sameGroup.forEach(g => processedIds.add(g.item_id));
                          groupedItems.push({
                            ...item,
                            _isGrouped: true,
                            _groupItems: sameGroup
                          });
                        } else {
                          processedIds.add(item.item_id);
                          groupedItems.push(item);
                        }
                      }

                      return groupedItems.map((item: any) => {
                        if (item._isGrouped && item._groupItems) {
                          return item._groupItems.map((subItem: any, idx: number) => {
                            const draft = draftItems[subItem.item_id] || {
                              selected: false,
                              pieceQty: subItem.piece_quantity,
                              toLocationId: '',
                              moveMethod: subItem.pallet_id ? 'pallet' : 'sku'
                            };

                            const availableText = `${subItem.piece_quantity.toLocaleString()} ชิ้น` + (subItem.pack_quantity ? ` / ${subItem.pack_quantity.toLocaleString()} แพ็ค` : '');
                            const isPalletMethod = draft.moveMethod === 'pallet';

                            return (
                              <tr key={`${item.item_id}-${idx}`} className={`bg-white ${isPalletMethod ? 'bg-primary-50/40' : ''}`}>
                                {idx === 0 && (
                                  <td className="px-3 py-2 align-middle" rowSpan={item._groupItems.length}>
                                    <input
                                      type="checkbox"
                                      checked={draft.selected}
                                      onChange={() => handleToggleItem(subItem, item._groupItems)}
                                      className="w-4 h-4 text-primary-600 border-thai-gray-300 rounded"
                                    />
                                  </td>
                                )}
                                <td className="px-2 py-2 align-top font-semibold text-thai-gray-900 truncate" title={subItem.product_name || subItem.sku_id}>
                                  <div>{subItem.product_name || subItem.sku_id}</div>
                                  <div className="text-thai-gray-500 text-[11px] mt-1">SKU: {subItem.sku_id}</div>
                                </td>
                                {idx === 0 && (
                                  <td className="px-2 py-2 align-middle text-thai-gray-600" rowSpan={item._groupItems.length}>{subItem.pallet_id || '-'}</td>
                                )}
                                <td className="px-2 py-2 align-top text-thai-gray-700">{availableText}</td>
                                <td className="px-2 py-2 align-top">
                                  <input
                                    type="number"
                                    min={1}
                                    value={draft.pieceQty}
                                    onChange={(e) => handleItemChange(subItem, 'pieceQty', Number(e.target.value))}
                                    className={`w-full px-3 py-1.5 border border-thai-gray-200 rounded-lg text-sm ${isPalletMethod ? 'bg-thai-gray-100 cursor-not-allowed' : ''}`}
                                    disabled={!draft.selected || isPalletMethod}
                                    readOnly={isPalletMethod}
                                  />
                                  <p className="text-[11px] text-thai-gray-400 mt-1">
                                    {isPalletMethod ? 'ย้ายทั้งพาเลท - ระบบจะใช้จำนวนที่รับทั้งหมด' : `สูงสุด ${subItem.piece_quantity.toLocaleString()} ชิ้น`}
                                  </p>
                                </td>
                                {idx === 0 && (
                                  <>
                                    <td className="px-2 py-2 align-middle text-thai-gray-600" rowSpan={item._groupItems.length}>
                                      {subItem.location_id ? (
                                        <span className="inline-flex items-center gap-2">
                                          <MapPin className="w-4 h-4 text-thai-gray-400" />
                                          <span>{subItem.location_id}</span>
                                        </span>
                                      ) : (
                                        <span className="text-thai-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2 align-middle w-64" rowSpan={item._groupItems.length}>
                                      <div className="space-y-1">
                                        <ZoneLocationSelect
                                          warehouseId={selectedToWarehouse || selectedReceive?.warehouse_id || ''}
                                          value={draft.toLocationId}
                                          onChange={(locationId) => handleItemChange(subItem, 'toLocationId', locationId, item._groupItems)}
                                          disabled={!draft.selected}
                                          placeholder="Addรหัสตำแหน่งปลายทาง"
                                        />
                                        {draft.selected && draft.toLocationId && duplicateLocations.includes(draft.toLocationId) && (
                                          <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                                            ⚠️ โลเคชั่นนี้ถูกAddซ้ำ ({locationUsage[draft.toLocationId]?.count || 0} รายการ)
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2 py-2 align-middle" rowSpan={item._groupItems.length}>
                                      <select
                                        value={draft.moveMethod}
                                        onChange={(e) => handleItemChange(subItem, 'moveMethod', e.target.value, item._groupItems)}
                                        className="w-full px-3 py-1.5 border border-thai-gray-200 rounded-lg text-sm"
                                        disabled={!draft.selected}
                                      >
                                        <option value="sku">ย้ายตามจำนวน</option>
                                        <option value="pallet">ย้ายทั้งพาเลท</option>
                                      </select>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          });
                        }

                        const draft = draftItems[item.item_id] || {
                          selected: false,
                          pieceQty: item.piece_quantity,
                          toLocationId: '',
                          moveMethod: item.pallet_id ? 'pallet' : 'sku'
                        };

                        const availableText = `${item.piece_quantity.toLocaleString()} ชิ้น` + (item.pack_quantity ? ` / ${item.pack_quantity.toLocaleString()} แพ็ค` : '');
                        const isPalletMethod = draft.moveMethod === 'pallet';

                        return (
                          <tr key={item.item_id} className={`bg-white ${isPalletMethod ? 'bg-primary-50/40' : ''}`}>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              checked={draft.selected}
                              onChange={() => handleToggleItem(item)}
                              className="w-4 h-4 text-primary-600 border-thai-gray-300 rounded"
                            />
                          </td>
                          <td className="px-2 py-2 align-top font-semibold text-thai-gray-900 truncate" title={item.product_name || item.sku_id}>
                            <div>{item.product_name || item.sku_id}</div>
                            <div className="text-thai-gray-500 text-[11px] mt-1">SKU: {item.sku_id}</div>
                          </td>
                          <td className="px-2 py-2 align-top text-thai-gray-600">{item.pallet_id || '-'}</td>
                          <td className="px-2 py-2 align-top text-thai-gray-700">{availableText}</td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min={1}
                              value={draft.pieceQty}
                              onChange={(e) => handleItemChange(item, 'pieceQty', Number(e.target.value))}
                              className={`w-full px-3 py-1.5 border border-thai-gray-200 rounded-lg text-sm ${isPalletMethod ? 'bg-thai-gray-100 cursor-not-allowed' : ''}`}
                              disabled={!draft.selected || isPalletMethod}
                              readOnly={isPalletMethod}
                            />
                            <p className="text-[11px] text-thai-gray-400 mt-1">
                              {isPalletMethod ? 'ย้ายทั้งพาเลท - ระบบจะใช้จำนวนที่รับทั้งหมด' : `สูงสุด ${item.piece_quantity.toLocaleString()} ชิ้น`}
                            </p>
                          </td>
                          <td className="px-2 py-2 align-top text-thai-gray-600">
                            {item.location_id ? (
                              <span className="inline-flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-thai-gray-400" />
                                <span>{item.location_id}</span>
                              </span>
                            ) : (
                              <span className="text-thai-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top w-64">
                            <div className="space-y-1">
                              <ZoneLocationSelect
                                warehouseId={selectedToWarehouse || selectedReceive?.warehouse_id || ''}
                                value={draft.toLocationId}
                                onChange={(locationId) => handleItemChange(item, 'toLocationId', locationId)}
                                disabled={!draft.selected}
                                placeholder="Addรหัสตำแหน่งปลายทาง"
                              />
                              {draft.selected && draft.toLocationId && duplicateLocations.includes(draft.toLocationId) && (
                                <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                                  ⚠️ โลเคชั่นนี้ถูกAddซ้ำ ({locationUsage[draft.toLocationId]?.count || 0} รายการ)
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-top">
                            <select
                              value={draft.moveMethod}
                              onChange={(e) => handleItemChange(item, 'moveMethod', e.target.value)}
                              className="w-full px-3 py-1.5 border border-thai-gray-200 rounded-lg text-sm"
                              disabled={!draft.selected}
                            >
                              <option value="sku">ย้ายตามจำนวน</option>
                              <option value="pallet">ย้ายทั้งพาเลท</option>
                            </select>
                          </td>
                        </tr>
                        );
                      });
                    })()}
                  </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-thai-gray-500">
                  กรุณาAddใบรับสินค้าเพื่อAddสินค้าที่ต้องการย้าย
                </div>
              )
            ) : (
              <div className="p-4">
                {/* Transfer Mode - Search and Select Items */}
                <div className="space-y-4">
                  {/* Search Controls */}
                  <div className="border border-thai-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-shrink-0">
                        <label className="block text-xs font-medium text-thai-gray-700 mb-1">วิธีค้นหา</label>
                        <select
                          value={transferSearchMode}
                          onChange={(e) => setTransferSearchMode(e.target.value as 'pallet' | 'location' | 'sku')}
                          className="px-2 py-1.5 border border-thai-gray-200 rounded text-sm"
                        >
                          <option value="pallet">พาเลท</option>
                          <option value="location">โลเคชั่น</option>
                          <option value="sku">SKU</option>
                        </select>
                      </div>
                      <div className="flex-shrink-0" style={{ minWidth: '200px' }}>
                        <label className="block text-xs font-medium text-thai-gray-700 mb-1">คลังต้นทาง</label>
                        <select
                          value={transferFromWarehouse}
                          onChange={(e) => setTransferFromWarehouse(e.target.value)}
                          className="w-full px-2 py-1.5 border border-thai-gray-200 rounded text-sm"
                        >
                          <option value="">เลือกคลัง</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                              {warehouse.warehouse_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1" style={{ minWidth: '200px' }}>
                        <label className="block text-xs font-medium text-thai-gray-700 mb-1">
                          {transferSearchMode === 'pallet' && 'รหัสพาเลท'}
                          {transferSearchMode === 'location' && 'รหัสโลเคชั่น'}
                          {transferSearchMode === 'sku' && 'รหัสสินค้า'}
                        </label>
                        <input
                          type="text"
                          value={transferSearchTerm}
                          onChange={(e) => setTransferSearchTerm(e.target.value)}
                          placeholder={
                            transferSearchMode === 'pallet' ? 'เช่น ATG20251002000000002' :
                            transferSearchMode === 'location' ? 'เช่น A01-01-001' :
                            'เช่น SKU001'
                          }
                          className="w-full px-2 py-1.5 border border-thai-gray-200 rounded text-sm"
                        />
                      </div>
                      <div className="flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTransferSearch}
                          disabled={!transferSearchTerm.trim() || !transferFromWarehouse}
                        >
                          ค้นหา
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* ผลการค้นหา */}
                  <div className="border border-thai-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-thai-gray-700 mb-2">ผลการค้นหา</h4>
                    {transferSearchLoading ? (
                      <div className="text-center text-sm text-thai-gray-500 py-8">กำลังค้นหา...</div>
                    ) : transferSearchError ? (
                      <div className="text-center text-sm text-red-600 py-8">{transferSearchError}</div>
                    ) : transferSearchResults.length === 0 ? (
                      <div className="text-center text-sm text-thai-gray-500 py-8">
                        <p>กรุณาเลือกวิธีค้นหาและคลังต้นทาง แล้วคลิก &quot;ค้นหา&quot;</p>
                        <p className="text-xs mt-2 text-thai-gray-400">
                          ระบบจะแสดงสินค้าหรือพาเลทที่ตรงเงื่อนไข เพื่อให้เลือกสำหรับการย้าย
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm table-fixed">
                          <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700">SKU</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700">ชื่อสินค้า</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700">จากโลเคชั่น</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-700">พาเลท</th>
                              <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-700">คงเหลือ</th>
                              <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-700"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {transferSearchResults.map((result, index) => {
                              const alreadySelected = transferSelectedItems.some((item) => item.key === result.key);
                              return (
                                <tr key={`${result.key}-${index}`} className="hover:bg-blue-50">
                                  <td className="px-2 py-1.5 text-xs font-mono text-gray-600">{result.sku_id}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-900">{result.sku_name || '-'}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-700">{result.from_location_code || result.from_location_id || '-'}</td>
                                  <td className="px-2 py-1.5 text-xs font-mono text-blue-600">{result.pallet_id || '-'}</td>
                                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">{result.piece_qty.toLocaleString('th-TH')}</td>
                                  <td className="px-2 py-1.5 text-center">
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      disabled={alreadySelected}
                                      onClick={() => handleAddTransferItem(result)}
                                    >
                                      {alreadySelected ? 'เพิ่มแล้ว' : 'เลือก'}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>


                  {/* Selected Items Summary */}
                  {transferSelectedItems.length > 0 && (
                    <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 flex flex-col">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">
                        รายการที่เลือกสำหรับย้าย ({transferSelectedItems.length} รายการ)
                      </h4>
                      <div className="overflow-x-auto overflow-y-auto bg-white rounded-lg max-h-[48rem] min-h-[32rem]">
                        <table className="min-w-full text-sm">
                          <thead className="bg-blue-100">
                            <tr className="border-b border-blue-200">
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-blue-900">SKU</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-blue-900">ชื่อสินค้า</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-blue-900">จากโลเคชั่น</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-blue-900">พาเลท</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-blue-900">จำนวน</th>
                              <th className="px-2 py-1.5 text-left text-xs font-medium text-blue-900 w-[18rem]">ไปโลเคชั่น</th>
                              <th className="px-2 py-1.5 text-center text-xs font-medium text-blue-900"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {transferSelectedItems.map((item) => {
                              const isPallet = item.move_method === 'pallet';
                              return (
                                <tr key={item.key} className="hover:bg-blue-50">
                                  <td className="px-2 py-1.5 text-xs font-mono text-gray-600">{item.sku_id}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-900">{item.sku_name || '-'}</td>
                                  <td className="px-2 py-1.5 text-xs text-gray-700">{item.from_location_code || item.from_location_id || '-'}</td>
                                  <td className="px-2 py-1.5 text-xs font-mono text-blue-600">{item.pallet_id || '-'}</td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min={1}
                                          value={item.piece_qty}
                                          onChange={(e) =>
                                            handleUpdateTransferItem(item.key, {
                                              piece_qty: Math.max(1, Number(e.target.value) || 1),
                                            })
                                          }
                                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs text-right"
                                        />
                                        {isPallet && (
                                          <span className="text-xs text-blue-600">(ทั้งพาเลท)</span>
                                        )}
                                      </div>
                                      {/* Show warning if partial pallet move */}
                                      {item.pallet_id && item.piece_qty < (item.pack_qty * (item as any).pack_size || item.piece_qty) && (
                                        <div className="text-[10px] text-orange-600 font-medium">
                                          ⚠️ ย้ายบางส่วน - จะสร้างพาเลทใหม่
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 align-top w-[18rem]">
                                    <ZoneLocationSelect
                                      warehouseId={selectedToWarehouse || ''}
                                      value={item.to_location_id}
                                      onChange={(locationId) =>
                                        handleUpdateTransferItem(item.key, {
                                          to_location_id: locationId ? String(locationId) : '',
                                        })
                                      }
                                      placeholder="เลือกโลเคชั่นปลายทาง"
                                      className="w-full"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    <Button variant="outline" size="sm" onClick={() => handleลบTransferItem(item.key)}>
                                      ลบ
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setIsCreateModalOpen(false);
              resetCreateForm();
            }} disabled={creatingMove}>
              ยกเลิก
            </Button>
            <Button variant="primary" onClick={handleCreateMove} disabled={creatingMove}>
              {creatingMove ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังบันทึก...</span>
              ) : (
                'บันทึกใบย้าย'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Employee Assignment Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedMoveItemIds([]);
          setAssignmentContext({ mode: 'single', total: 0 });
          setSelectedEmployeeId(null);
          setAssignmentType('individual');
          setSelectedRole('');
          setRequiredCount(1);
        }}
        title="มอบหมายงานให้พนักงาน"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {assignmentContext.mode === 'bulk'
              ? `มอบหมายสินค้าจำนวน ${assignmentContext.total.toLocaleString()} รายการ ในใบย้าย ${assignmentContext.moveNo || '-'}`
              : `มอบหมายงานสำหรับ ${assignmentContext.description || 'สินค้านี้'} ในใบย้าย ${assignmentContext.moveNo || '-'}`}
          </p>

          {/* Assignment Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">ประเภทการมอบหมาย</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentType('individual')}
                className={`px-3 py-2 text-sm border rounded-lg ${
                  assignmentType === 'individual'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                เจาะจงคน
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('role')}
                className={`px-3 py-2 text-sm border rounded-lg ${
                  assignmentType === 'role'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                ตาม Role
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('mixed')}
                className={`px-3 py-2 text-sm border rounded-lg ${
                  assignmentType === 'mixed'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                ผสม
              </button>
            </div>
          </div>

          {/* Role Selection (for role and mixed types) */}
          {(assignmentType === 'role' || assignmentType === 'mixed') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {assignmentType === 'mixed' ? 'Role สำหรับช่วยงาน' : 'Role ที่ต้องการ'}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Add Role</option>
                <option value="supervisor">หัวหน้าคลัง (Supervisor)</option>
                <option value="operator">พนักงานดำเนินการ (Operator)</option>
                <option value="picker">พนักงานหยิบสินค้า (Picker)</option>
                <option value="driver">พนักงานขับรถ (Driver)</option>
                <option value="forklift">พนักงานขับโฟล์คลิฟท์ (Forklift)</option>
                <option value="other">อื่นๆ (Other)</option>
              </select>
            </div>
          )}

          {/* Required Count (for role type) */}
          {assignmentType === 'role' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">จำนวนคนที่ต้องการ</label>
              <input
                type="number"
                min="1"
                max="10"
                value={requiredCount}
                onChange={(e) => setRequiredCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}

          {/* Employee Selection (for individual and mixed types) */}
          {(assignmentType === 'individual' || assignmentType === 'mixed') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {assignmentType === 'mixed' ? 'หัวหน้าทีม/คนหลัก' : 'Addพนักงาน'}
              </label>
              {employeesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-12 px-3 py-2 text-left">Add</th>
                        <th className="px-3 py-2 text-left">ชื่อพนักงาน</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">อีเมล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(employees || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                            ไม่พบข้อมูลพนักงาน
                          </td>
                        </tr>
                      ) : (
                        (employees || []).map((employee) => (
                          <tr
                            key={employee.employee_id}
                            className={`cursor-pointer hover:bg-gray-50 ${
                              selectedEmployeeId === employee.employee_id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => setSelectedEmployeeId(employee.employee_id)}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="radio"
                                name="employee"
                                checked={selectedEmployeeId === employee.employee_id}
                                onChange={() => setSelectedEmployeeId(employee.employee_id)}
                                className="w-4 h-4 text-blue-600"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {employee.first_name} {employee.last_name}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100">
                                {employee.wms_role || 'ไม่ระบุ'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {employee.email || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Role-based Assignment Summary */}
          {assignmentType === 'role' && selectedRole && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-2">พนักงานที่สามารถทำงานได้</h4>
              <div className="space-y-1">
                {(employees || [])
                  .filter(emp => emp.wms_role === selectedRole)
                  .map(emp => (
                    <div key={emp.employee_id} className="text-sm text-blue-800">
                      • {emp.first_name} {emp.last_name} ({emp.employee_code})
                    </div>
                  ))
                }
                {(employees || []).filter(emp => emp.wms_role === selectedRole).length === 0 && (
                  <div className="text-sm text-orange-600">ไม่มีพนักงานที่มี Role นี้</div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignModalOpen(false);
                setSelectedMoveItemIds([]);
                setAssignmentContext({ mode: 'single', total: 0 });
                setSelectedEmployeeId(null);
                setAssignmentType('individual');
                setSelectedRole('');
                setRequiredCount(1);
              }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmAssignment}
              disabled={
                selectedMoveItemIds.length === 0 ||
                (assignmentType === 'individual' && !selectedEmployeeId) ||
                (assignmentType === 'role' && !selectedRole) ||
                (assignmentType === 'mixed' && (!selectedEmployeeId || !selectedRole))
              }
            >
              มอบหมายงาน
            </Button>
          </div>
        </div>
      </Modal>

      {/* Scanning Modal */}
      <Modal
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setScanningMoveItem(null);
          setScanningStep('pallet');
          setScannedPalletId('');
          setScannedLocationId('');
          setScanError(null);
        }}
        title={`${scanningStep === 'pallet' ? 'ขั้นตอนที่ 1: สแกนพาเลท' : 'ขั้นตอนที่ 2: สแกนโลเคชั่น'}`}
        size="md"
      >
        <div className="space-y-4">
          {scanError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
              {scanError}
            </div>
          )}

          {scanningMoveItem && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">รายละเอียดงาน</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div><strong>สินค้า:</strong> {scanningMoveItem.master_sku?.sku_name || scanningMoveItem.sku_id}</div>
                <div><strong>จำนวน:</strong> {scanningMoveItem.requested_piece_qty.toLocaleString()} ชิ้น</div>
                {scanningMoveItem.pallet_id && (
                  <div><strong>พาเลท:</strong> {scanningMoveItem.pallet_id}</div>
                )}
                <div><strong>ต้นทาง:</strong> {scanningMoveItem.from_location?.location_name || scanningMoveItem.from_location_id || '-'}</div>
                <div>
                  <strong>ปลายทาง:</strong>{' '}
                  {scanningMoveItem.to_location?.location_name || '-'}
                  {scanningMoveItem.to_location?.location_code && (
                    <span className="text-gray-500"> ({scanningMoveItem.to_location.location_code})</span>
                  )}
                  {!scanningMoveItem.to_location?.location_name && scanningMoveItem.to_location_id && !scanningMoveItem.to_location?.location_code && (
                    <span>{scanningMoveItem.to_location_id}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {scanningStep === 'pallet' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  กรุณาสแกนรหัสพาเลทที่จะทำการย้าย เพื่อยืนยันว่าเป็นพาเลทที่ถูกต้อง
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สแกนรหัสพาเลท
                  {scanningMoveItem?.pallet_id && (
                    <span className="text-gray-500"> (คาดหวัง: {scanningMoveItem.pallet_id})</span>
                  )}
                </label>
                <input
                  type="text"
                  value={scannedPalletId}
                  onChange={(e) => setScannedPalletId(e.target.value)}
                  placeholder="สแกนหรือป้อนรหัสพาเลท"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsScanModalOpen(false)}>
                  ยกเลิก
                </Button>
                <Button variant="primary" onClick={handlePalletScan}>
                  ยืนยันพาเลท
                </Button>
              </div>
            </div>
          )}

          {scanningStep === 'location' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">✅ พาเลทยืนยันแล้ว: {scannedPalletId}</span>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  ตอนนี้ให้ย้ายพาเลท <strong>{scannedPalletId}</strong> ไปยังตำแหน่งปลายทาง แล้วสแกนรหัสโลเคชั่นเพื่อยืนยันการวางสินค้าและเสร็จสิ้นงาน
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สแกนรหัสโลเคชั่นปลายทาง
                  {(scanningMoveItem?.to_location?.location_code || scanningMoveItem?.to_location_id) && (
                    <span className="text-gray-500"> (คาดหวัง: {scanningMoveItem?.to_location?.location_code || scanningMoveItem?.to_location_id})</span>
                  )}
                </label>
                <input
                  type="text"
                  value={scannedLocationId}
                  onChange={(e) => setScannedLocationId(e.target.value)}
                  placeholder="สแกนหรือป้อนรหัสโลเคชั่น"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setScanningStep('pallet')} disabled={isCompletingScan}>
                  กลับไปสแกนพาเลท
                </Button>
                <Button
                  variant="primary"
                  onClick={handleLocationScan}
                  disabled={isCompletingScan}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isCompletingScan ? 'กำลังบันทึก...' : 'เสร็จสิ้นงาน'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default function TransferPageWithPermission() {
  return (
    <PermissionGuard 
      permission="warehouse.inventory.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการย้ายสินค้า</p>
          </div>
        </div>
      }
    >
      <TransferPage />
    </PermissionGuard>
  );
}
