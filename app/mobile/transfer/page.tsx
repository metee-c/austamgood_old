'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import MobileLayout from '@/components/layout/MobileLayout';
import MobileButton from '@/components/mobile/MobileButton';
import MobileBadge from '@/components/mobile/MobileBadge';
import {
  Package,
  Search,
  Filter,
  Clock,
  MapPin,
  ArrowRight,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  PlayCircle,
  Users,
  ChevronRight,
  X,
  User,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Maximize,
  Minimize,
} from 'lucide-react';
import { useMoves } from '@/hooks/useMoves';
import { MoveRecord, MoveStatus, MoveType } from '@/lib/database/move';
import { useReplenishmentTasks, ReplenishmentStatus } from '@/hooks/useReplenishmentTasks';
import { ReplenishmentTaskCard } from '@/components/mobile/ReplenishmentTaskCard';
import { Utensils } from 'lucide-react';
import { useOfflineTransfer } from '@/hooks/useOfflineTransfer';
import { OfflineIndicator, OfflineBanner } from '@/components/mobile/OfflineIndicator';

// Type labels
const MOVE_TYPE_LABELS: Record<MoveType, string> = {
  'putaway': 'จัดเก็บสินค้า',
  'transfer': 'ย้ายสินค้า',
  'replenishment': 'เติมสินค้า',
  'adjustment': 'ปรับสต๊อก'
};

const MOVE_STATUS_LABELS: Record<MoveStatus, string> = {
  'draft': 'ร่าง',
  'pending': 'รอดำเนินการ',
  'in_progress': 'กำลังดำเนินการ',
  'completed': 'เสร็จสิ้น',
  'cancelled': 'ยกเลิก'
};

// Badge variant mapping
const STATUS_BADGE_VARIANTS: Record<MoveStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  'draft': 'default',
  'pending': 'default',
  'in_progress': 'warning',
  'completed': 'success',
  'cancelled': 'danger'
};

// Status icons
const STATUS_ICONS: Record<MoveStatus, any> = {
  'draft': Clock,
  'pending': Clock,
  'in_progress': PlayCircle,
  'completed': CheckCircle2,
  'cancelled': AlertCircle
};

function MobileTransferListPage() {
  const router = useRouter();

  // Offline support
  const {
    isOnline,
    isSyncing,
    syncStatus,
    pendingCount,
    pendingMoves,
    fetchPalletData,
    fetchLocations,
    validateLocation,
    executeQuickMove,
    triggerSync,
    preCacheLocations,
  } = useOfflineTransfer({ autoSync: true, syncInterval: 30000 });

  // Pre-cache locations on mount for offline use
  useEffect(() => {
    if (isOnline) {
      preCacheLocations();
    }
  }, [isOnline, preCacheLocations]);

  // Data fetching
  const { data: allMoves, loading, error, refetch } = useMoves();

  // Regular replenishment tasks (auto-replenishment, etc.)
  const { tasks: replenishmentTasks, isLoading: tasksLoading, updateTaskStatus, mutate: mutateTasks } = useReplenishmentTasks({
    status: 'all',
    refreshInterval: 30000 // Auto-refresh every 30 seconds
  });

  // Food material replenishment tasks (from production orders)
  // Only show tasks assigned to current user (showAll: false)
  const {
    tasks: foodMaterialTasks,
    isLoading: foodMaterialLoading,
    updateTaskStatus: updateFoodMaterialStatus,
    mutate: mutateFoodMaterial
  } = useReplenishmentTasks({
    status: 'all',
    triggerSource: 'production_order',
    showAll: false, // Only show tasks assigned to current user
    refreshInterval: 30000
  });

  // State
  const [activeTab, setActiveTab] = useState<'alerts' | 'moves' | 'food_material'>('alerts'); // เริ่มต้นที่ tab alerts
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MoveStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<MoveType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen handlers
  useEffect(() => {
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', checkFullscreen);
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  // State for Alerts tab
  const [alertsSearchTerm, setAlertsSearchTerm] = useState('');
  const [alertsStatusFilter, setAlertsStatusFilter] = useState<ReplenishmentStatus | 'all'>('all');
  const [showAlertsFilter, setShowAlertsFilter] = useState(false);

  // State for Food Material tab
  const [foodSearchTerm, setFoodSearchTerm] = useState('');
  const [foodStatusFilter, setFoodStatusFilter] = useState<ReplenishmentStatus | 'all'>('all');
  const [showFoodFilter, setShowFoodFilter] = useState(false);

  // Quick Move Modal State
  const [showQuickMoveModal, setShowQuickMoveModal] = useState(false);
  const [quickMoveStep, setQuickMoveStep] = useState<'pallet' | 'location'>('pallet');
  const [palletId, setPalletId] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [quickMoveError, setQuickMoveError] = useState<string | null>(null);
  const [savingQuickMove, setSavingQuickMove] = useState(false);
  const [palletDetails, setPalletDetails] = useState<any[]>([]);
  const [loadingPalletDetails, setLoadingPalletDetails] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [showCapacityError, setShowCapacityError] = useState(false);
  const [capacityErrorMessage, setCapacityErrorMessage] = useState('');
  
  // Partial Move State - ย้ายแบบแบ่งชิ้น
  const [isPartialMove, setIsPartialMove] = useState(false);
  const [partialQty, setPartialQty] = useState<{ [skuId: string]: number }>({});
  
  // Picking Home Error Modal State
  const [pickingHomeError, setPickingHomeError] = useState<{
    skuId: string;
    skuName: string;
    destinationLocation: string;
    correctLocation: string;
  } | null>(null);

  // Audio feedback - with graceful fallback if files don't exist
  const playTapSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const audio = new Audio('/audio/tap.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Silent fail - audio file may not exist
      });
    } catch {
      // Silent fail
    }
  };

  const playSuccessSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const audio = new Audio('/audio/success.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Silent fail - audio file may not exist
      });
    } catch {
      // Silent fail
    }
  };

  const playErrorSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const audio = new Audio('/audio/error.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Silent fail - audio file may not exist
      });
    } catch {
      // Silent fail
    }
  };

  // Quick Move handlers
  const handleOpenQuickMove = () => {
    setShowQuickMoveModal(true);
    setQuickMoveStep('pallet');
    setPalletId('');
    setLocationCode('');
    setQuickMoveError(null);
    setPalletDetails([]);
    playTapSound();
  };

  const handleCloseQuickMove = () => {
    setShowQuickMoveModal(false);
    setQuickMoveStep('pallet');
    setPalletId('');
    setLocationCode('');
    setQuickMoveError(null);
    setPalletDetails([]);
    setIsPartialMove(false);
    setPartialQty({});
  };

  const handleScanPallet = async () => {
    // Clean pallet ID - remove any extra text that might come from barcode scanner
    const cleanPalletId = palletId.trim().split(/\s+/)[0]; // Take only first word/token

    if (!cleanPalletId) {
      setQuickMoveError('กรุณาสแกน Pallet ID');
      playErrorSound();
      return;
    }

    try {
      setLoadingPalletDetails(true);
      setQuickMoveError(null);

      // Use offline-capable fetch with cleaned pallet ID
      const { data, fromCache, error: fetchError } = await fetchPalletData(cleanPalletId);

      if (fetchError || !data || data.length === 0) {
        setQuickMoveError(fetchError || `ไม่พบ Pallet ID: ${palletId} หรือสต็อกเป็น 0`);
        playErrorSound();
        return;
      }

      // Show cache indicator if data is from cache
      if (fromCache) {
        console.log('Using cached pallet data (offline mode)');
      }

      // Filter only items with stock > 0 and group by SKU (keep only latest location)
      const filteredData = data
        .filter((item: any) => item.total_piece_qty > 0)
        .reduce((acc: any[], item: any) => {
          // Check if SKU already exists
          const existingIndex = acc.findIndex(x => x.sku_id === item.sku_id);
          if (existingIndex === -1) {
            // New SKU, add it
            acc.push(item);
          } else {
            // SKU exists, keep the one with more recent updated_at or higher qty
            const existing = acc[existingIndex];
            const itemDate = new Date(item.updated_at || item.created_at).getTime();
            const existingDate = new Date(existing.updated_at || existing.created_at).getTime();

            if (itemDate > existingDate || item.total_piece_qty > existing.total_piece_qty) {
              acc[existingIndex] = item;
            }
          }
          return acc;
        }, []);

      if (filteredData.length === 0) {
        setQuickMoveError(`Pallet ID: ${palletId} ไม่มีสต็อกคงเหลือ`);
        playErrorSound();
        return;
      }

      setPalletDetails(filteredData);
      setQuickMoveError(null);

      // Fetch locations for next step (with offline support)
      await handleFetchLocations();

      setQuickMoveStep('location');
      playSuccessSound();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการค้นหา Pallet';
      setQuickMoveError(message);
      playErrorSound();
    } finally {
      setLoadingPalletDetails(false);
    }
  };

  // Offline-capable fetch locations
  const handleFetchLocations = async () => {
    try {
      setLoadingLocations(true);
      const { data, fromCache, error: fetchError } = await fetchLocations();

      if (fetchError) {
        console.error('Error fetching locations:', fetchError);
        return;
      }

      if (fromCache) {
        console.log('Using cached locations (offline mode)');
      }

      setLocations(data || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchLocationsOriginal = async () => {
    try {
      setLoadingLocations(true);
      const response = await fetch('/api/master-location');
      const result = await response.json();

      if (result.error) {
        console.error('Error fetching locations:', result.error);
        return;
      }

      setLocations(result.data || result || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleConfirmQuickMove = async () => {
    if (!locationCode.trim()) {
      setQuickMoveError('กรุณาเลือก Location ปลายทาง');
      playErrorSound();
      return;
    }

    try {
      setSavingQuickMove(true);
      setQuickMoveError(null);

      // Find selected location details (support both location_id and location_code)
      let selectedLocation = locations.find(
        loc => loc.location_id === locationCode || loc.location_code === locationCode
      );

      if (!selectedLocation) {
        setQuickMoveError('ไม่พบข้อมูล Location ที่เลือก');
        playErrorSound();
        setSavingQuickMove(false);
        return;
      }

      // Use location_id for API call
      const locationIdToUse = selectedLocation.location_id;

      // Fetch latest location data to get current quantities
      try {
        const locationResponse = await fetch(`/api/master-location?location_id=${locationIdToUse}`);
        const locationResult = await locationResponse.json();

        if (locationResult.data && locationResult.data.length > 0) {
          selectedLocation = locationResult.data[0];
        }
      } catch (err) {
        console.error('Error fetching latest location data:', err);
        // Continue with cached data if fetch fails
      }

      // Calculate total quantity and weight from pallet (use partial qty if enabled)
      const palletQty = isPartialMove
        ? Object.values(partialQty).reduce((sum, qty) => sum + qty, 0)
        : palletDetails.reduce((sum, item) => sum + (item.total_piece_qty || 0), 0);
      const palletWeight = palletDetails.reduce((sum, item) => {
        const weightPerPiece = item.master_sku?.weight_per_piece_kg || 0;
        const qty = isPartialMove ? (partialQty[item.sku_id] || 0) : (item.total_piece_qty || 0);
        return sum + (qty * weightPerPiece);
      }, 0);

      // Get current quantity and weight in the location
      const currentQty = selectedLocation.current_qty || 0;
      const currentWeight = selectedLocation.current_weight_kg || 0;

      // Calculate total after adding this pallet
      const totalQtyAfter = currentQty + palletQty;
      const totalWeightAfter = currentWeight + palletWeight;

      // Check capacity constraints
      if (selectedLocation.max_capacity_qty && totalQtyAfter > selectedLocation.max_capacity_qty) {
        // Fetch pallets in this location to show what's taking up space
        let existingPalletsInfo = '';
        try {
          const existingResponse = await fetch(`/api/inventory/balances?location_id=${locationIdToUse}`);
          const existingResult = await existingResponse.json();
          if (existingResult.data && existingResult.data.length > 0) {
            const palletList = existingResult.data
              .filter((item: any) => item.total_piece_qty > 0)
              .map((item: any) => `  • ${item.pallet_id_external || item.pallet_id || 'N/A'} (${item.total_piece_qty} ชิ้น)`)
              .slice(0, 5) // Show max 5 pallets
              .join('\n');
            existingPalletsInfo = `\n\nพาเลทที่เก็บอยู่ใน Location นี้:\n${palletList}${existingResult.data.length > 5 ? '\n  ... และอื่นๆ' : ''}`;
          }
        } catch (err) {
          // Ignore error, just don't show pallet list
        }

        setCapacityErrorMessage(
          `📦 พาเลท: ${palletId}\n` +
          `📍 Location: ${selectedLocation.location_code}\n\n` +
          `ความจุ: ${selectedLocation.max_capacity_qty} ชิ้น\n` +
          `ปัจจุบัน: ${currentQty} ชิ้น\n` +
          `+ พาเลทนี้: ${palletQty} ชิ้น\n` +
          `= รวม: ${totalQtyAfter} ชิ้น ❌\n` +
          `(เกิน ${totalQtyAfter - selectedLocation.max_capacity_qty} ชิ้น)` +
          existingPalletsInfo
        );
        setShowCapacityError(true);
        playErrorSound();
        setSavingQuickMove(false);
        return;
      }

      if (selectedLocation.max_capacity_weight_kg && totalWeightAfter > selectedLocation.max_capacity_weight_kg) {
        // Fetch pallets in this location to show what's taking up space
        let existingPalletsInfo = '';
        try {
          const existingResponse = await fetch(`/api/inventory/balances?location_id=${locationIdToUse}`);
          const existingResult = await existingResponse.json();
          if (existingResult.data && existingResult.data.length > 0) {
            const palletList = existingResult.data
              .filter((item: any) => item.total_piece_qty > 0)
              .map((item: any) => {
                const weight = (item.total_piece_qty || 0) * (item.master_sku?.weight_per_piece_kg || 0);
                return `  • ${item.pallet_id_external || item.pallet_id || 'N/A'} (${weight.toFixed(2)} กก.)`;
              })
              .slice(0, 5) // Show max 5 pallets
              .join('\n');
            existingPalletsInfo = `\n\nพาเลทที่เก็บอยู่ใน Location นี้:\n${palletList}${existingResult.data.length > 5 ? '\n  ... และอื่นๆ' : ''}`;
          }
        } catch (err) {
          // Ignore error, just don't show pallet list
        }

        setCapacityErrorMessage(
          `📦 พาเลท: ${palletId}\n` +
          `📍 Location: ${selectedLocation.location_code}\n\n` +
          `ความจุ: ${selectedLocation.max_capacity_weight_kg} กก.\n` +
          `ปัจจุบัน: ${currentWeight.toFixed(2)} กก.\n` +
          `+ พาเลทนี้: ${palletWeight.toFixed(2)} กก.\n` +
          `= รวม: ${totalWeightAfter.toFixed(2)} กก. ❌\n` +
          `(เกิน ${(totalWeightAfter - selectedLocation.max_capacity_weight_kg).toFixed(2)} กก.)` +
          existingPalletsInfo
        );
        setShowCapacityError(true);
        playErrorSound();
        setSavingQuickMove(false);
        return;
      }

      // Picking Home Validation using sku_preparation_area_mapping
      // Logic: Check if destination is a picking home, and if SKU has a designated home that doesn't match
      try {
        const destLocationCode = selectedLocation.location_code;

        console.log('=== VALIDATION START ===');
        console.log('Destination:', destLocationCode);
        console.log('Pallet Details:', palletDetails);

        // Step 1: Check if destination location is in preparation_area table (is it a picking home?)
        const prepAreaCheckResponse = await fetch(`/api/sku-preparation-area-mapping?location_code=${destLocationCode}`);
        const prepAreaCheckResult = await prepAreaCheckResponse.json();

        console.log('Prep Area Check Result:', prepAreaCheckResult);

        const isDestinationPickingHome = prepAreaCheckResult.is_picking_home === true;
        const allowedSkus = prepAreaCheckResult.allowed_skus || [];

        console.log('Is Destination Picking Home?', isDestinationPickingHome);
        console.log('Allowed SKUs for this location:', allowedSkus);

        if (isDestinationPickingHome) {
          // Destination IS a picking home - need to validate
          console.log(`✓ Destination ${destLocationCode} is a picking home - validating...`);

          // Step 2: For each SKU in pallet, check if it's allowed in this picking home
          for (const item of palletDetails) {
            console.log('Checking item:', item);
            console.log('SKU ID:', item.sku_id);

            // Check if SKU has a designated picking home via API
            const skuMappingResponse = await fetch(`/api/sku-preparation-area-mapping?sku_id=${item.sku_id}`);
            const skuMappingResult = await skuMappingResponse.json();

            console.log('SKU Mapping Result:', skuMappingResult);

            const allValidHomes = skuMappingResult.data?.map((m: any) => m.location_code) || [];
            console.log('All Valid Picking Homes:', allValidHomes);

            if (allValidHomes.length > 0) {
              // SKU has designated picking homes from sku_preparation_area_mapping
              console.log(`SKU ${item.sku_id} has valid homes: ${allValidHomes.join(', ')}`);

              if (!allValidHomes.includes(destLocationCode)) {
                // Trying to move to location that's NOT in the valid picking homes list!
                console.log(`❌ BLOCKING: ${destLocationCode} not in valid homes [${allValidHomes.join(', ')}]`);

                const skuName = item.master_sku?.sku_name || item.sku_id;
                const primaryHome = allValidHomes[0]; // First one is primary

                setPickingHomeError({
                  skuId: item.sku_id,
                  skuName: skuName,
                  destinationLocation: destLocationCode,
                  correctLocation: primaryHome
                });
                playErrorSound();
                setSavingQuickMove(false);
                return;
              } else {
                console.log(`✓ ALLOW: ${destLocationCode} is in valid picking homes`);
              }
            } else {
              // SKU has no designated home in sku_preparation_area_mapping
              // Check if destination is assigned to OTHER SKUs
              if (allowedSkus.length > 0 && !allowedSkus.includes(item.sku_id)) {
                // Destination is assigned to specific SKUs, but this SKU is not one of them
                console.log(`❌ BLOCKING: ${destLocationCode} is assigned to ${allowedSkus.join(', ')}, not ${item.sku_id}`);

                const skuName = item.master_sku?.sku_name || item.sku_id;

                setPickingHomeError({
                  skuId: item.sku_id,
                  skuName: skuName,
                  destinationLocation: destLocationCode,
                  correctLocation: `สินค้านี้ไม่มีบ้านหยิบที่กำหนด\n${destLocationCode} เป็นบ้านหยิบของ: ${allowedSkus.slice(0, 3).join(', ')}${allowedSkus.length > 3 ? '...' : ''}`
                });
                playErrorSound();
                setSavingQuickMove(false);
                return;
              }
              console.log(`✓ ALLOW: SKU has no designated home`);
            }
          }
        } else {
          // Destination is NOT a picking home (bulk storage) - always allow
          console.log(`✓ ALLOW: Destination ${destLocationCode} is bulk storage`);
        }

        console.log('=== VALIDATION END: PASSED ===');
      } catch (err) {
        console.error('Error validating preparation area:', err);
        // Fallback: If check fails, allow the move but log the error
      }

      // Execute quick move with offline support
      const { success, offline, error: moveError } = await executeQuickMove(
        palletId.trim(),
        locationIdToUse,
        selectedLocation.location_code,
        palletDetails,
        'Quick move from mobile',
        isPartialMove ? partialQty : undefined // ส่ง partial quantities ถ้าเป็นการย้ายบางส่วน
      );

      if (!success) {
        setQuickMoveError(moveError || 'เกิดข้อผิดพลาดในการบันทึก');
        playErrorSound();
        return;
      }

      // Show different message for offline vs online
      if (offline) {
        // Queued for later sync
        playSuccessSound();
        alert('✅ บันทึกสำเร็จ (Offline)\n\nข้อมูลจะถูก sync เมื่อกลับมา online');
      } else {
        playSuccessSound();
      }

      handleCloseQuickMove();
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
      setQuickMoveError(message);
      playErrorSound();
    } finally {
      setSavingQuickMove(false);
    }
  };

  // Filter and search logic for Moves
  const filteredMoves = useMemo(() => {
    if (!allMoves) return [];

    let result = [...allMoves];

    // Filter by status
    if (selectedStatus !== 'all') {
      result = result.filter(move => move.status === selectedStatus);
    }

    // Filter by type
    if (selectedType !== 'all') {
      result = result.filter(move => move.move_type === selectedType);
    }

    // Search by move_no or source_document
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(move =>
        move.move_no?.toLowerCase().includes(term) ||
        move.source_document?.toLowerCase().includes(term)
      );
    }

    // Sort by scheduled_at (newest first), then by created_at
    result.sort((a, b) => {
      const dateA = new Date(a.scheduled_at || a.created_at).getTime();
      const dateB = new Date(b.scheduled_at || b.created_at).getTime();
      return dateB - dateA;
    });

    return result;
  }, [allMoves, selectedStatus, selectedType, searchTerm]);

  // Filter and search logic for Alerts (Replenishment Tasks)
  const filteredReplenishmentTasks = useMemo(() => {
    let result = [...replenishmentTasks];

    // Filter by status
    if (alertsStatusFilter !== 'all') {
      result = result.filter(task => task.status === alertsStatusFilter);
    }

    // Search by sku_id or location
    if (alertsSearchTerm.trim()) {
      const term = alertsSearchTerm.toLowerCase().trim();
      result = result.filter(task =>
        task.sku_id?.toLowerCase().includes(term) ||
        task.from_location_code?.toLowerCase().includes(term) ||
        task.pick_location_code?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [replenishmentTasks, alertsStatusFilter, alertsSearchTerm]);

  // Filter and search logic for Food Material Tasks
  const filteredFoodMaterialTasks = useMemo(() => {
    let result = [...foodMaterialTasks];

    // Filter by status
    if (foodStatusFilter !== 'all') {
      result = result.filter(task => task.status === foodStatusFilter);
    }

    // Search by sku_id or location
    if (foodSearchTerm.trim()) {
      const term = foodSearchTerm.toLowerCase().trim();
      result = result.filter(task =>
        task.sku_id?.toLowerCase().includes(term) ||
        task.from_location_code?.toLowerCase().includes(term) ||
        task.pick_location_code?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [foodMaterialTasks, foodStatusFilter, foodSearchTerm]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    playTapSound();
    if (activeTab === 'alerts') {
      await mutateTasks();
    } else if (activeTab === 'food_material') {
      await mutateFoodMaterial();
    } else {
      await refetch();
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  // Handle replenishment task status update
  const handleTaskStatusUpdate = async (queueId: string, status: ReplenishmentStatus, data?: { confirmed_qty?: number; notes?: string }) => {
    try {
      const result = await updateTaskStatus(queueId, status, data);
      if (result.success) {
        playSuccessSound();
      } else {
        playErrorSound();
      }
      return result;
    } catch (err) {
      playErrorSound();
      console.error('Error updating task status:', err);
      return { success: false, error: 'Unknown error' };
    }
  };

  // Handle food material task status update
  const handleFoodMaterialStatusUpdate = async (queueId: string, status: ReplenishmentStatus, data?: { confirmed_qty?: number; notes?: string }) => {
    try {
      const result = await updateFoodMaterialStatus(queueId, status, data);
      if (result.success) {
        playSuccessSound();
      } else {
        playErrorSound();
      }
      return result;
    } catch (err) {
      playErrorSound();
      console.error('Error updating food material task status:', err);
      return { success: false, error: 'Unknown error' };
    }
  };

  // Handle move card click
  const handleMoveClick = (move: MoveRecord) => {
    playTapSound();
    router.push(`/mobile/transfer/${move.move_no}`);
  };

  // Calculate progress for a move
  const calculateProgress = (move: MoveRecord) => {
    const items = move.wms_move_items || [];
    if (items.length === 0) return 0;

    const completedCount = items.filter(item => item.status === 'completed').length;
    return Math.round((completedCount / items.length) * 100);
  };

  // Get first from/to locations
  const getLocationSummary = (move: MoveRecord) => {
    const items = move.wms_move_items || [];
    if (items.length === 0) return { from: '-', to: '-' };

    const fromLocations = items
      .map(item => item.from_location?.location_name || item.from_location?.location_code || item.from_location_id)
      .filter(Boolean);

    const toLocations = items
      .map(item => item.to_location?.location_name || item.to_location?.location_code || item.to_location_id)
      .filter(Boolean);

    const uniqueFroms = [...new Set(fromLocations)];
    const uniqueTos = [...new Set(toLocations)];

    const fromText = uniqueFroms.length > 1
      ? `${uniqueFroms[0]} และอื่นๆ`
      : uniqueFroms[0] || '-';

    const toText = uniqueTos.length > 1
      ? `${uniqueTos[0]} และอื่นๆ`
      : uniqueTos[0] || '-';

    return { from: fromText, to: toText };
  };

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // If today
    if (diffDays === 0) {
      if (diffMins < 60) {
        return `${diffMins} นาทีที่แล้ว`;
      }
      return `${diffHours} ชั่วโมงที่แล้ว`;
    }

    // If within 7 days
    if (diffDays < 7) {
      return `${diffDays} วันที่แล้ว`;
    }

    // Format as date
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <MobileLayout>
      {/* Offline Banner */}
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

      <div className={`min-h-screen bg-gray-50 pb-16 ${!isOnline || pendingCount > 0 ? 'pt-6' : ''}`}>
        {/* Header with Statistics - Compact */}
        <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white sticky top-0 z-10 shadow-lg mobile-header">
          <div className="p-2">
            {/* Title and Action Buttons */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold font-thai">ย้าย & เติมสต็อก</h1>
                {/* Offline Indicator */}
                <OfflineIndicator
                  isOnline={isOnline}
                  isSyncing={isSyncing}
                  syncStatus={syncStatus}
                  pendingCount={pendingCount}
                  onSync={triggerSync}
                  compact={true}
                />
              </div>
              <div className="flex items-center gap-1">
                {activeTab === 'moves' && (
                  <button
                    onClick={handleOpenQuickMove}
                    className="px-2 py-1 bg-white text-sky-600 rounded font-thai text-xs font-semibold hover:bg-sky-50 transition-colors active:scale-95 flex items-center gap-0.5 shadow-sm mobile-btn-sm"
                  >
                    <Package className="w-3 h-3" />
                    ย้าย
                  </button>
                )}
                <button
                  onClick={toggleFullscreen}
                  className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors active:scale-95 mobile-icon-btn"
                  title={isFullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ'}
                >
                  {isFullscreen ? (
                    <Minimize className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors active:scale-95 disabled:opacity-50 mobile-icon-btn"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors active:scale-95 mobile-icon-btn"
                >
                  <User className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tabs - Compact */}
            <div className="flex gap-1 mb-2 mobile-tabs">
              <button
                onClick={() => {
                  setActiveTab('alerts');
                  playTapSound();
                }}
                className={`flex-1 py-1.5 px-2 rounded font-thai text-xs font-semibold transition-all ${activeTab === 'alerts'
                  ? 'bg-white text-sky-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>เติมสต็อก</span>
                  {replenishmentTasks.length > 0 && (
                    <span className="bg-red-500 text-white rounded-full px-1 py-0.5 text-[8px] font-bold min-w-[14px] text-center">
                      {replenishmentTasks.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('food_material');
                  playTapSound();
                }}
                className={`flex-1 py-1.5 px-2 rounded font-thai text-xs font-semibold transition-all ${activeTab === 'food_material'
                  ? 'bg-white text-sky-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Utensils className="w-3 h-3" />
                  <span>วัตถุดิบ</span>
                  {foodMaterialTasks.length > 0 && (
                    <span className="bg-orange-500 text-white rounded-full px-1 py-0.5 text-[8px] font-bold min-w-[14px] text-center">
                      {foodMaterialTasks.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('moves');
                  playTapSound();
                }}
                className={`flex-1 py-1.5 px-2 rounded font-thai text-xs font-semibold transition-all ${activeTab === 'moves'
                  ? 'bg-white text-sky-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>ย้าย</span>
                </div>
              </button>
            </div>

            {/* Search and Filter - Show only for Moves tab */}
            {activeTab === 'moves' && (
              <>
                {/* Search and Filter - Same Row - Compact */}
                <div className="flex items-center gap-1.5 mb-1.5 mobile-search">
                  {/* Search Box */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหา..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-7 pr-6 py-1.5 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-xs"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Button - Compact */}
                  <button
                    onClick={() => {
                      setShowFilters(!showFilters);
                      playTapSound();
                    }}
                    className="relative bg-white/20 rounded-lg p-2 hover:bg-white/30 transition-colors flex-shrink-0"
                  >
                    <Filter className="w-5 h-5" />
                    {(selectedStatus !== 'all' || selectedType !== 'all') && (
                      <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                        {(selectedStatus !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0)}
                      </span>
                    )}
                  </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                  <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 space-y-3">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5 font-thai">สถานะ</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => {
                          setSelectedStatus(e.target.value as MoveStatus | 'all');
                          playTapSound();
                        }}
                        className="w-full px-2.5 py-2 bg-white/90 text-gray-900 border-0 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-white/50 font-thai"
                      >
                        <option value="all">ทุกสถานะ</option>
                        <option value="draft">ร่าง</option>
                        <option value="pending">รอดำเนินการ</option>
                        <option value="in_progress">กำลังดำเนินการ</option>
                        <option value="completed">เสร็จสิ้น</option>
                        <option value="cancelled">ยกเลิก</option>
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5 font-thai">ประเภท</label>
                      <select
                        value={selectedType}
                        onChange={(e) => {
                          setSelectedType(e.target.value as MoveType | 'all');
                          playTapSound();
                        }}
                        className="w-full px-2.5 py-2 bg-white/90 text-gray-900 border-0 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-white/50 font-thai"
                      >
                        <option value="all">ทุกประเภท</option>
                        <option value="putaway">จัดเก็บสินค้า</option>
                        <option value="transfer">ย้ายสินค้า</option>
                        <option value="replenishment">เติมสินค้า</option>
                        <option value="adjustment">ปรับสต๊อก</option>
                      </select>
                    </div>

                    {/* Clear Filters */}
                    {(selectedStatus !== 'all' || selectedType !== 'all') && (
                      <button
                        onClick={() => {
                          setSelectedStatus('all');
                          setSelectedType('all');
                          playTapSound();
                        }}
                        className="w-full px-3 py-1.5 bg-white/20 text-white text-xs font-medium rounded-lg hover:bg-white/30 transition-colors font-thai"
                      >
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Search and Filter - Show for Alerts tab */}
            {activeTab === 'alerts' && (
              <>
                {/* Search and Filter - Same Row */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Search Box */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหา..."
                      value={alertsSearchTerm}
                      onChange={(e) => setAlertsSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-sm"
                    />
                    {alertsSearchTerm && (
                      <button
                        onClick={() => setAlertsSearchTerm('')}
                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Button - Compact */}
                  <button
                    onClick={() => {
                      setShowAlertsFilter(!showAlertsFilter);
                      playTapSound();
                    }}
                    className="relative bg-white/20 rounded-lg p-2 hover:bg-white/30 transition-colors flex-shrink-0"
                  >
                    <Filter className="w-5 h-5" />
                    {alertsStatusFilter !== 'all' && (
                      <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                        1
                      </span>
                    )}
                  </button>
                </div>

                {/* Filter Panel */}
                {showAlertsFilter && (
                  <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 space-y-3">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5 font-thai">สถานะ</label>
                      <select
                        value={alertsStatusFilter}
                        onChange={(e) => {
                          setAlertsStatusFilter(e.target.value as ReplenishmentStatus | 'all');
                          playTapSound();
                        }}
                        className="w-full px-2.5 py-2 bg-white/90 text-gray-900 border-0 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-white/50 font-thai"
                      >
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending">รอดำเนินการ</option>
                        <option value="assigned">มอบหมายแล้ว</option>
                        <option value="in_progress">กำลังดำเนินการ</option>
                        <option value="completed">เสร็จสิ้น</option>
                      </select>
                    </div>

                    {/* Clear Filters */}
                    {alertsStatusFilter !== 'all' && (
                      <button
                        onClick={() => {
                          setAlertsStatusFilter('all');
                          playTapSound();
                        }}
                        className="w-full px-3 py-1.5 bg-white/20 text-white text-xs font-medium rounded-lg hover:bg-white/30 transition-colors font-thai"
                      >
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Search and Filter - Show for Food Material tab */}
            {activeTab === 'food_material' && (
              <>
                {/* Search and Filter - Same Row */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Search Box */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหา..."
                      value={foodSearchTerm}
                      onChange={(e) => setFoodSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-300 font-thai text-sm"
                    />
                    {foodSearchTerm && (
                      <button
                        onClick={() => setFoodSearchTerm('')}
                        className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Filter Button - Compact */}
                  <button
                    onClick={() => {
                      setShowFoodFilter(!showFoodFilter);
                      playTapSound();
                    }}
                    className="relative bg-white/20 rounded-lg p-2 hover:bg-white/30 transition-colors flex-shrink-0"
                  >
                    <Filter className="w-5 h-5" />
                    {foodStatusFilter !== 'all' && (
                      <span className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                        1
                      </span>
                    )}
                  </button>
                </div>

                {/* Filter Panel */}
                {showFoodFilter && (
                  <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 space-y-3">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5 font-thai">สถานะ</label>
                      <select
                        value={foodStatusFilter}
                        onChange={(e) => {
                          setFoodStatusFilter(e.target.value as ReplenishmentStatus | 'all');
                          playTapSound();
                        }}
                        className="w-full px-2.5 py-2 bg-white/90 text-gray-900 border-0 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-white/50 font-thai"
                      >
                        <option value="all">ทุกสถานะ</option>
                        <option value="pending">รอดำเนินการ</option>
                        <option value="assigned">มอบหมายแล้ว</option>
                        <option value="in_progress">กำลังดำเนินการ</option>
                        <option value="completed">เสร็จสิ้น</option>
                      </select>
                    </div>

                    {/* Clear Filters */}
                    {foodStatusFilter !== 'all' && (
                      <button
                        onClick={() => {
                          setFoodStatusFilter('all');
                          playTapSound();
                        }}
                        className="w-full px-3 py-1.5 bg-white/20 text-white text-xs font-medium rounded-lg hover:bg-white/30 transition-colors font-thai"
                      >
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* Content Area */}
        <div className="p-3 space-y-3">
          {/* Replenishment Tasks Tab Content */}
          {activeTab === 'alerts' && (
            <>
              {tasksLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm font-thai">กำลังโหลดงานเติมสต็อก...</p>
                </div>
              ) : filteredReplenishmentTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <CheckCircle2 className="w-16 h-16 mb-3 text-green-400" />
                  <p className="text-lg font-bold text-green-600 mb-2 font-thai">ไม่มีงานเติมสต็อก</p>
                  <p className="text-sm text-gray-500 font-thai">
                    {alertsSearchTerm || alertsStatusFilter !== 'all'
                      ? 'ไม่พบงานที่ตรงกับเงื่อนไขการค้นหา'
                      : 'ยังไม่มีงานเติมสต็อกที่ต้องดำเนินการ'}
                  </p>
                </div>
              ) : (
                <>
                  {filteredReplenishmentTasks.map((task) => (
                    <ReplenishmentTaskCard
                      key={task.queue_id}
                      task={task}
                      onStatusUpdate={handleTaskStatusUpdate}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* Food Material Tab Content */}
          {activeTab === 'food_material' && (
            <>
              {foodMaterialLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm font-thai">กำลังโหลดงานเติมวัตถุดิบอาหาร...</p>
                </div>
              ) : filteredFoodMaterialTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Utensils className="w-16 h-16 mb-3 text-orange-300" />
                  <p className="text-lg font-bold text-orange-600 mb-2 font-thai">ไม่มีงานเติมวัตถุดิบ</p>
                  <p className="text-sm text-gray-500 font-thai">
                    {foodSearchTerm || foodStatusFilter !== 'all'
                      ? 'ไม่พบงานที่ตรงกับเงื่อนไขการค้นหา'
                      : 'ยังไม่มีงานเติมวัตถุดิบอาหารที่ต้องดำเนินการ'}
                  </p>
                </div>
              ) : (
                <>
                  {filteredFoodMaterialTasks.map((task) => (
                    <ReplenishmentTaskCard
                      key={task.queue_id}
                      task={task}
                      onStatusUpdate={handleFoodMaterialStatusUpdate}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* Moves Tab Content */}
          {activeTab === 'moves' && (
            <>
              {loading && !refreshing ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">กำลังโหลดข้อมูล...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-64 text-red-500 px-4">
                  <AlertCircle className="w-12 h-12 mb-3" />
                  <p className="text-sm text-center font-medium">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="mt-4 px-6 py-2 bg-red-500 text-white text-sm font-medium rounded-lg active:bg-red-600"
                  >
                    ลองใหม่
                  </button>
                </div>
              ) : filteredMoves.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Package className="w-16 h-16 mb-3" />
                  <p className="text-sm font-medium">ไม่พบรายการย้ายสินค้า</p>
                  <p className="text-xs mt-1">
                    {searchTerm || selectedStatus !== 'all' || selectedType !== 'all'
                      ? 'ลองปรับเงื่อนไขการค้นหา'
                      : 'ยังไม่มีใบย้ายในระบบ'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMoves.map((move) => {
                    const items = move.wms_move_items || [];
                    const locations = getLocationSummary(move);
                    const totalPieces = items.reduce((sum, item) => sum + (item.confirmed_piece_qty || item.requested_piece_qty || 0), 0);
                    const totalPacks = items.reduce((sum, item) => sum + (item.confirmed_pack_qty || item.requested_pack_qty || 0), 0);

                    return (
                      <div
                        key={move.move_id}
                        onClick={() => handleMoveClick(move)}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 active:scale-98 transition-all cursor-pointer"
                      >
                        {/* Header Row - Compact */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 font-mono text-sm">
                              {move.move_no}
                            </h3>
                            <span className="text-[11px] text-gray-500 font-thai">
                              {formatDate(move.scheduled_at || move.created_at)}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>

                        {/* Reference Doc - Inline if exists */}
                        {move.source_document && (
                          <div className="text-[11px] text-gray-500 font-thai mb-1.5">
                            อ้างอิง: {move.source_document}
                          </div>
                        )}

                        {/* Type and Status - Single Row */}
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <MobileBadge variant={STATUS_BADGE_VARIANTS[move.status]} size="sm">
                            {MOVE_STATUS_LABELS[move.status]}
                          </MobileBadge>
                          <span className="text-[11px] text-gray-600 font-thai">
                            • {MOVE_TYPE_LABELS[move.move_type]}
                          </span>
                        </div>

                        {/* Locations - Compact Inline */}
                        <div className="flex items-center gap-1 mb-1.5 text-[11px]">
                          <span className="text-gray-600 font-thai truncate">{locations.from}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-600 font-thai truncate">{locations.to}</span>
                        </div>

                        {/* Stats - Compact Inline */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-gray-600 font-thai">
                              <span className="font-semibold text-gray-900">{items.length}</span> รายการ
                            </span>
                            {totalPacks > 0 && (
                              <span className="text-green-600 font-thai">
                                <span className="font-semibold">{totalPacks}</span> แพ็ค
                              </span>
                            )}
                            {totalPieces > 0 && (
                              <span className="text-sky-600 font-thai">
                                <span className="font-semibold">{totalPieces}</span> ชิ้น
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Completed Badge - Compact */}
                        {move.status === 'completed' && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                            <div className="flex items-center justify-center gap-1 text-green-600 text-[11px] font-semibold font-thai">
                              <CheckCircle2 className="w-3 h-3" />
                              เสร็จสิ้นแล้ว
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Results Count */}
        {!loading && (
          <>
            {activeTab === 'alerts' && filteredReplenishmentTasks.length > 0 && (
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <p className="text-sm text-center text-gray-600 font-thai">
                  แสดง <span className="font-semibold text-gray-900">{filteredReplenishmentTasks.length}</span> งานเติมสต็อก
                  {(alertsSearchTerm || alertsStatusFilter !== 'all') && (
                    <span> จากทั้งหมด <span className="font-semibold text-gray-900">{replenishmentTasks.length}</span> งาน</span>
                  )}
                </p>
              </div>
            )}
            {activeTab === 'food_material' && filteredFoodMaterialTasks.length > 0 && (
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <p className="text-sm text-center text-gray-600 font-thai">
                  แสดง <span className="font-semibold text-gray-900">{filteredFoodMaterialTasks.length}</span> งานเติมวัตถุดิบอาหาร
                  {(foodSearchTerm || foodStatusFilter !== 'all') && (
                    <span> จากทั้งหมด <span className="font-semibold text-gray-900">{foodMaterialTasks.length}</span> งาน</span>
                  )}
                </p>
              </div>
            )}
            {activeTab === 'moves' && filteredMoves.length > 0 && (
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <p className="text-sm text-center text-gray-600 font-thai">
                  แสดง <span className="font-semibold text-gray-900">{filteredMoves.length}</span> รายการ
                  {(searchTerm || selectedStatus !== 'all' || selectedType !== 'all') && (
                    <span> จากทั้งหมด <span className="font-semibold text-gray-900">{allMoves?.length || 0}</span> รายการ</span>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capacity Error Modal */}
      {showCapacityError && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-slide-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-red-400 to-red-500 text-white p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold font-thai flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  เกินความจุ Location
                </h2>
                <button
                  onClick={() => setShowCapacityError(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                <div className="whitespace-pre-line text-sm text-gray-800 font-thai leading-relaxed">
                  {capacityErrorMessage}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowCapacityError(false)}
                className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors active:scale-95 font-thai text-base"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picking Home Error Modal */}
      {pickingHomeError && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-slide-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-orange-400 to-orange-500 text-white p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold font-thai flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  ไม่สามารถย้ายได้
                </h2>
                <button
                  onClick={() => setPickingHomeError(null)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-orange-500" />
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <p className="text-base font-semibold text-gray-900 font-thai">
                  ❌ ไม่สามารถย้ายเข้า {pickingHomeError.destinationLocation} ได้
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-left space-y-2">
                  <p className="text-sm text-gray-700 font-thai">
                    <span className="font-semibold">สินค้า:</span> {pickingHomeError.skuName}
                  </p>
                  <p className="text-sm text-gray-600 font-thai">
                    <span className="font-semibold">รหัส:</span> {pickingHomeError.skuId}
                  </p>
                  <div className="border-t border-orange-200 pt-2 mt-2">
                    <p className="text-sm text-gray-700 font-thai">
                      <span className="font-semibold text-green-600">✓ บ้านหยิบที่ถูกต้อง:</span>
                    </p>
                    <p className="text-lg font-bold text-green-600 font-thai mt-1">
                      {pickingHomeError.correctLocation}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-thai mt-2">
                  กรุณาย้ายไปยัง <span className="font-semibold text-green-600">{pickingHomeError.correctLocation}</span> หรือเลือก location เก็บสต็อกทั่วไป
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setPickingHomeError(null)}
                className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors active:scale-95 font-thai text-base"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Move Modal - Opens from top for small screens */}
      {showQuickMoveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start pt-2 animate-fade-in">
          <div className="bg-white w-full mx-2 rounded-xl shadow-2xl animate-slide-down max-h-[85vh] flex flex-col">
            {/* Modal Header - Compact */}
            <div className="bg-gradient-to-br from-sky-400 to-sky-500 text-white p-3 rounded-t-xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold font-thai">
                  {quickMoveStep === 'pallet' ? 'สแกน Pallet ID' : 'สแกน Location'}
                </h2>
                <button
                  onClick={handleCloseQuickMove}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Error Message */}
              {quickMoveError && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-600 font-thai">{quickMoveError}</p>
                </div>
              )}

              {/* Step 1: Scan Pallet */}
              {quickMoveStep === 'pallet' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center py-4">
                    <Package className="w-14 h-14 text-sky-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                      Pallet ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={palletId}
                      onChange={(e) => setPalletId(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleScanPallet()}
                      placeholder="สแกนหรือพิมพ์ Pallet ID"
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm font-thai"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleScanPallet}
                    disabled={loadingPalletDetails}
                    className="w-full px-3 py-2.5 bg-sky-500 text-white rounded font-semibold hover:bg-sky-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-thai text-sm"
                  >
                    {loadingPalletDetails ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        กำลังตรวจสอบ...
                      </>
                    ) : (
                      'ถัดไป'
                    )}
                  </button>
                </div>
              )}

              {/* Step 2: Scan Location */}
              {quickMoveStep === 'location' && (
                <div className="space-y-3">
                  {/* Show scanned pallet - Compact */}
                  <div className="bg-sky-50 border border-sky-200 rounded p-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Package className="w-4 h-4 text-sky-600" />
                      <div>
                        <p className="text-[10px] text-sky-600 font-thai">Pallet ID</p>
                        <p className="text-xs font-semibold text-gray-900 font-mono">{palletId}</p>
                      </div>
                    </div>

                    {/* Pallet Details - Compact */}
                    {palletDetails.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-sky-200">
                        {/* Partial Move Toggle */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-sky-700 font-thai">รายละเอียด:</p>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isPartialMove}
                              onChange={(e) => {
                                setIsPartialMove(e.target.checked);
                                if (!e.target.checked) {
                                  setPartialQty({});
                                } else {
                                  // Initialize with current quantities
                                  const initialQty: { [key: string]: number } = {};
                                  palletDetails.forEach(item => {
                                    initialQty[item.sku_id] = item.total_piece_qty || 0;
                                  });
                                  setPartialQty(initialQty);
                                }
                              }}
                              className="w-3.5 h-3.5 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                            />
                            <span className="text-[10px] text-sky-700 font-thai font-medium">ย้ายบางส่วน</span>
                          </label>
                        </div>
                        
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {palletDetails.map((item, idx) => (
                            <div key={idx} className="bg-white rounded p-1.5 text-[10px]">
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 truncate font-thai">
                                    {item.master_sku?.sku_name || item.sku_id}
                                  </p>
                                  <p className="text-gray-500 font-thai">
                                    ตำแหน่ง: {item.master_location?.location_name || item.location_id}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {isPartialMove ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="1"
                                        max={item.total_piece_qty}
                                        value={partialQty[item.sku_id] || 0}
                                        onChange={(e) => {
                                          const val = Math.min(
                                            Math.max(1, parseInt(e.target.value) || 0),
                                            item.total_piece_qty
                                          );
                                          setPartialQty(prev => ({
                                            ...prev,
                                            [item.sku_id]: val
                                          }));
                                        }}
                                        className="w-14 px-1 py-0.5 text-center border border-gray-300 rounded text-[10px] font-bold text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                      />
                                      <span className="text-gray-500">/ {item.total_piece_qty}</span>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="font-bold text-green-600">{item.total_piece_qty}</p>
                                      <p className="text-gray-500">ชิ้น</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-sky-200">
                          <p className="text-[10px] text-sky-700 font-thai">
                            {isPartialMove ? (
                              <>
                                ย้าย: <span className="font-bold text-sky-600">
                                  {Object.values(partialQty).reduce((sum, qty) => sum + qty, 0)}
                                </span> / {palletDetails.reduce((sum, item) => sum + (item.total_piece_qty || 0), 0)} ชิ้น
                              </>
                            ) : (
                              <>
                                รวม: <span className="font-bold">{palletDetails.length}</span> รายการ,
                                <span className="font-bold ml-1">
                                  {palletDetails.reduce((sum, item) => sum + (item.total_piece_qty || 0), 0)}
                                </span> ชิ้น
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <MapPin className="w-12 h-12 text-sky-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 font-thai">
                      Location ปลายทาง <span className="text-red-500">*</span>
                    </label>

                    {loadingLocations ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                        <span className="ml-2 text-xs text-gray-600 font-thai">กำลังโหลด...</span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          list="location-list"
                          value={locationCode}
                          onChange={(e) => setLocationCode(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleConfirmQuickMove()}
                          placeholder="สแกนหรือพิมพ์ Location Code"
                          className="w-full px-3 py-2.5 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm font-thai"
                          autoFocus
                        />
                        <datalist id="location-list">
                          {locations.map((loc) => (
                            <option key={loc.location_id} value={loc.location_code}>
                              {loc.location_name} {loc.zone ? `(${loc.zone})` : ''}
                            </option>
                          ))}
                        </datalist>

                        {/* Show selected location info - Compact */}
                        {locationCode && locations.find(loc => loc.location_code === locationCode || loc.location_id === locationCode) && (
                          <div className="mt-1.5 p-1.5 bg-green-50 border border-green-200 rounded">
                            {(() => {
                              const selectedLoc = locations.find(loc => loc.location_code === locationCode || loc.location_id === locationCode);
                              if (!selectedLoc) return null;

                              return (
                                <div className="text-[10px]">
                                  <p className="font-semibold text-green-700 font-thai">
                                    ✓ {selectedLoc.location_code} - {selectedLoc.location_name}
                                  </p>
                                  {selectedLoc.zone && (
                                    <p className="text-green-600 font-thai">โซน: {selectedLoc.zone}</p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Fixed buttons */}
            {quickMoveStep === 'location' && (
              <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setQuickMoveStep('pallet');
                      setLocationCode('');
                      setQuickMoveError(null);
                    }}
                    className="flex-1 px-3 py-2.5 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition-colors active:scale-95 font-thai text-sm"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    onClick={handleConfirmQuickMove}
                    disabled={savingQuickMove}
                    className="flex-1 px-3 py-2.5 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-thai text-sm"
                  >
                    {savingQuickMove ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        บันทึก...
                      </>
                    ) : (
                      'บันทึก'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MobileLayout>
  );
}

export default function MobileTransferListPageWithPermission() {
  return (
    <PermissionGuard
      permission="mobile.transfer"
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-gray-600">คุณไม่มีสิทธิ์ในการย้ายและเติมสต็อก</p>
          </div>
        </div>
      }
    >
      <MobileTransferListPage />
    </PermissionGuard>
  );
}
