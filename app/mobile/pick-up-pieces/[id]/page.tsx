'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, Loader2, Store, AlertTriangle, Save } from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface PicklistItem {
  id: number;
  sku_id: string;
  sku_name: string;
  uom: string;
  order_no: string;
  order_id: number;
  stop_id: number;
  quantity_to_pick: number;
  quantity_picked: number;
  status: 'pending' | 'picked' | 'shortage' | 'substituted';
  shop_name?: string;
  master_sku?: {
    sku_name: string;
    barcode: string;
    qty_per_pack: number;
  };
}

interface Picklist {
  id: number;
  picklist_code: string;
  status: string;
  total_lines: number;
  total_quantity: number;
  picklist_items: PicklistItem[];
}

interface ShopGroup {
  shopName: string;
  items: PicklistItem[];
  totalItems: number;
  pickedItems: number;
}

type ViewMode = 'shops' | 'scanning';

const DEFAULT_PIECES_PER_PACK = 12;

export default function MobilePickUpPiecesDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('shops');
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanFeedback, setScanFeedback] = useState<'success' | 'error' | null>(null);
  const [overScanWarning, setOverScanWarning] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const pendingSaveRef = useRef<{ item: PicklistItem; qty: number } | null>(null);

  // Audio context for beep sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (id) fetchPicklist();
    // Initialize audio context
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, [id]);

  // Generate beep sound using Web Audio API
  const playBeep = (frequency: number, duration: number, volume: number = 0.5) => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      
      // Resume context if suspended (required for mobile browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error('Audio error:', e);
    }
  };

  const fetchPicklist = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mobile/pick-up-pieces/tasks/${id}`);
      const data = await response.json();
      if (response.ok) setPicklist(data);
    } catch (error) {
      console.error('Error fetching picklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const playSound = (type: 'success' | 'error' | 'overscan') => {
    if (type === 'success') {
      // High pitch short beep for success
      playBeep(880, 0.15, 0.4);
    } else if (type === 'error') {
      // Low pitch beep for error (wrong barcode)
      playBeep(300, 0.3, 0.5);
    } else if (type === 'overscan') {
      // Multiple beeps for over-scan warning
      playBeep(400, 0.2, 0.6);
      setTimeout(() => playBeep(400, 0.2, 0.6), 250);
      setTimeout(() => playBeep(400, 0.2, 0.6), 500);
    }
  };

  const showFeedback = (type: 'success' | 'error') => {
    setScanFeedback(type);
    setTimeout(() => setScanFeedback(null), 200);
  };


  // Group items by shop and sort SKUs A-Z
  const shopGroups: ShopGroup[] = React.useMemo(() => {
    if (!picklist?.picklist_items) return [];
    const groups: Record<string, PicklistItem[]> = {};
    picklist.picklist_items.forEach((item) => {
      const shopKey = item.shop_name || item.order_no || 'ไม่ระบุร้าน';
      if (!groups[shopKey]) groups[shopKey] = [];
      groups[shopKey].push(item);
    });
    return Object.entries(groups)
      .map(([shopName, items]) => ({
        shopName,
        items: [...items].sort((a, b) => a.sku_id.localeCompare(b.sku_id)),
        totalItems: items.length,
        pickedItems: items.filter((i) => i.status === 'picked').length
      }))
      .sort((a, b) => a.shopName.localeCompare(b.shopName));
  }, [picklist]);

  // Get current shop's unpicked items
  const currentShopItems = React.useMemo(() => {
    if (!selectedShop) return [];
    const shop = shopGroups.find((s) => s.shopName === selectedShop);
    return shop?.items.filter((i) => i.status !== 'picked') || [];
  }, [selectedShop, shopGroups]);

  const currentItem = currentShopItems[currentItemIndex] || null;

  // Calculate requirements for current item
  const req = React.useMemo(() => {
    if (!currentItem) return null;
    const piecesPerPack = currentItem.master_sku?.qty_per_pack || DEFAULT_PIECES_PER_PACK;
    const totalPieces = currentItem.quantity_to_pick;
    const fullPacks = Math.floor(totalPieces / piecesPerPack);
    const remainderPieces = totalPieces % piecesPerPack;
    const fullPacksScanned = Math.floor(scannedCount / piecesPerPack);
    const isInRemainderPhase = fullPacksScanned >= fullPacks && remainderPieces > 0;
    const remainderScanned = isInRemainderPhase ? scannedCount - fullPacks * piecesPerPack : 0;
    return {
      piecesPerPack,
      totalPieces,
      fullPacks,
      remainderPieces,
      fullPacksScanned,
      isInRemainderPhase,
      remainderScanned,
      isComplete: scannedCount >= totalPieces
    };
  }, [currentItem, scannedCount]);

  // OPTIMIZED: Handle scan with debounce and queue
  const handleScan = useCallback(
    (barcode: string) => {
      // Debounce: ป้องกันสแกนซ้ำภายใน 100ms
      const now = Date.now();
      if (now - lastScanTime < 100) return;
      setLastScanTime(now);

      if (!currentItem || !req || isProcessingRef.current) return;

      const expectedBarcode = currentItem.master_sku?.barcode || currentItem.sku_id;

      // Validate barcode
      if (barcode !== expectedBarcode) {
        playSound('error');
        showFeedback('error');
        // ไม่ใช้ alert เพราะช้า - แสดง visual feedback แทน
        return;
      }

      // Calculate pieces to add
      const piecesToAdd = req.isInRemainderPhase ? 1 : req.piecesPerPack;
      const newCount = scannedCount + piecesToAdd;

      // Check for over-scan (scanning beyond required quantity)
      if (newCount > req.totalPieces) {
        playSound('overscan');
        showFeedback('error');
        setOverScanWarning(true);
        // Clear warning after 3 seconds
        setTimeout(() => setOverScanWarning(false), 3000);
        return; // Don't add more pieces
      }

      // Update UI immediately (optimistic update)
      setScannedCount(newCount);
      playSound('success');
      showFeedback('success');
      setOverScanWarning(false);

      // NO auto-save - user must click save button manually
    },
    [currentItem, req, scannedCount, lastScanTime]
  );

  // Manual save handler - called when user clicks save button
  const handleManualSave = () => {
    if (!currentItem || !req || scannedCount < req.totalPieces) return;
    saveItemPicked(currentItem, scannedCount);
  };

  // Save item - runs in background, doesn't block scanning
  const saveItemPicked = async (item: PicklistItem, quantityPicked: number) => {
    if (isProcessingRef.current) {
      // Queue the save if already processing
      pendingSaveRef.current = { item, qty: quantityPicked };
      return;
    }

    isProcessingRef.current = true;
    setSaving(true);

    try {
      const response = await fetch('/api/mobile/pick/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picklist_id: picklist?.id,
          item_id: item.id,
          quantity_picked: quantityPicked,
          scanned_code: picklist?.picklist_code
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }

      // Move to next item immediately
      setScannedCount(0);
      if (currentItemIndex < currentShopItems.length - 1) {
        setCurrentItemIndex((prev) => prev + 1);
        // Re-focus input for next scan
        setTimeout(() => scanInputRef.current?.focus(), 50);
      } else {
        // Shop complete
        setViewMode('shops');
        setSelectedShop(null);
        setCurrentItemIndex(0);
        fetchPicklist();
      }
    } catch (error: any) {
      // Show error but don't block - user can retry
      console.error('Save error:', error);
    } finally {
      isProcessingRef.current = false;
      setSaving(false);

      // Process pending save if any
      if (pendingSaveRef.current) {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        saveItemPicked(pending.item, pending.qty);
      }
    }
  };

  // Handle keyboard input
  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget;
      const barcode = input.value.trim();
      if (barcode) {
        handleScan(barcode);
        input.value = '';
      }
    }
  };

  const handleSelectShop = (shopName: string) => {
    setSelectedShop(shopName);
    setViewMode('scanning');
    setCurrentItemIndex(0);
    setScannedCount(0);
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleBackToShops = () => {
    setViewMode('shops');
    setSelectedShop(null);
    setCurrentItemIndex(0);
    setScannedCount(0);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!picklist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-700 font-thai text-lg">ไม่พบข้อมูลใบหยิบ</p>
        <button
          onClick={() => router.push('/mobile/pick-up-pieces')}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg font-thai"
        >
          กลับ
        </button>
      </div>
    );
  }

  // ========== SHOP LIST VIEW ==========
  if (viewMode === 'shops') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-br from-orange-400 to-orange-500 text-white p-4 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center space-x-3 mb-2">
            <button
              onClick={() => router.push('/mobile/pick-up-pieces')}
              className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold font-thai">{picklist.picklist_code}</h1>
              <p className="text-xs opacity-90 font-thai">เลือกร้านที่ต้องการจัด</p>
            </div>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {shopGroups.map((shop) => {
            const isComplete = shop.pickedItems === shop.totalItems;
            return (
              <button
                key={shop.shopName}
                onClick={() => !isComplete && handleSelectShop(shop.shopName)}
                disabled={isComplete}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  isComplete
                    ? 'bg-green-50 border-green-200 opacity-60'
                    : 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-md active:scale-98'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isComplete ? 'bg-green-100' : 'bg-orange-100'}`}>
                      {isComplete ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Store className="w-5 h-5 text-orange-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 font-thai">{shop.shopName}</p>
                      <p className="text-sm text-gray-500 font-thai">{shop.totalItems} รายการ</p>
                    </div>
                  </div>
                  {isComplete ? (
                    <Badge variant="success" size="sm">เสร็จแล้ว</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">{shop.pickedItems}/{shop.totalItems}</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }


  // ========== SCANNING VIEW ==========
  return (
    <div className={`min-h-screen pb-20 text-white transition-colors duration-100 ${
      scanFeedback === 'success' ? 'bg-green-900' : scanFeedback === 'error' ? 'bg-red-900' : 'bg-gray-900'
    }`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-3">
          <button onClick={handleBackToShops} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold font-thai">{selectedShop}</h1>
            <p className="text-xs opacity-90 font-thai">สินค้า {currentItemIndex + 1} / {currentShopItems.length}</p>
          </div>
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
        </div>
      </div>

      {currentItem && req && (
        <div className="p-4 space-y-4">
          {/* SKU Info */}
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-orange-400 text-sm font-thai mb-1">รหัสสินค้า</p>
            <p className="text-2xl font-bold mb-1">{currentItem.sku_id}</p>
            <p className="text-base text-gray-300 font-thai">{currentItem.master_sku?.sku_name || currentItem.sku_name}</p>
          </div>

          {/* Large Count Display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-900/50 rounded-xl p-3 text-center border-2 border-blue-500">
              <p className="text-blue-300 text-xs font-thai mb-1">แพ็ค ({req.piecesPerPack} ชิ้น)</p>
              <p className="text-4xl font-bold text-blue-400">
                {req.fullPacksScanned}<span className="text-xl text-blue-300">/{req.fullPacks}</span>
              </p>
            </div>
            <div className="bg-green-900/50 rounded-xl p-3 text-center border-2 border-green-500">
              <p className="text-green-300 text-xs font-thai mb-1">ชิ้นทั้งหมด</p>
              <p className="text-4xl font-bold text-green-400">
                {scannedCount}<span className="text-xl text-green-300">/{req.totalPieces}</span>
              </p>
            </div>
          </div>

          {/* Remainder Warning */}
          {req.remainderPieces > 0 && req.isInRemainderPhase && (
            <div className="bg-yellow-900/50 rounded-xl p-3 border-2 border-yellow-500 animate-pulse">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-yellow-300 font-bold font-thai">แพ็คเศษ!</p>
                  <p className="text-yellow-200 font-thai text-sm">สแกน {req.remainderPieces - req.remainderScanned} ครั้ง (ชิ้นละครั้ง)</p>
                </div>
              </div>
            </div>
          )}

          {/* Scan Mode Indicator */}
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            {req.isInRemainderPhase ? (
              <p className="text-yellow-400 font-thai text-base">🔸 สแกน 1 ครั้ง = 1 ชิ้น</p>
            ) : (
              <p className="text-blue-400 font-thai text-base">📦 สแกน 1 ครั้ง = {req.piecesPerPack} ชิ้น</p>
            )}
          </div>

          {/* Scan Input - Visible for barcode scanner */}
          <div className="bg-gray-800 rounded-xl p-4">
            <label className="block text-orange-400 text-sm font-thai mb-2">สแกนบาร์โค้ด</label>
            <input
              ref={scanInputRef}
              type="text"
              onKeyDown={handleScanInput}
              placeholder="สแกนหรือพิมพ์บาร์โค้ด..."
              className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 rounded-lg text-white text-lg font-mono focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50 placeholder-gray-500"
              autoFocus
              autoComplete="off"
            />
            <p className="text-gray-500 text-xs font-thai mt-2">กด Enter หลังสแกน</p>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-green-500 h-full transition-all duration-150"
              style={{ width: `${Math.min((scannedCount / req.totalPieces) * 100, 100)}%` }}
            />
          </div>

          {/* Over-scan Warning */}
          {overScanWarning && (
            <div className="bg-red-600 rounded-xl p-4 border-2 border-red-400 animate-pulse">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-8 h-8 text-white flex-shrink-0" />
                <div>
                  <p className="text-white font-bold font-thai text-lg">⚠️ สแกนเกินจำนวน!</p>
                  <p className="text-red-200 font-thai text-sm">จำนวนครบแล้ว กรุณากดบันทึก</p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Save Button - Show when complete */}
          {req.isComplete && (
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold font-thai text-xl flex items-center justify-center space-x-3 shadow-lg hover:from-green-600 hover:to-green-700 active:scale-98 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  <span>บันทึก ({scannedCount} ชิ้น)</span>
                </>
              )}
            </button>
          )}

          {/* Scan Feedback Indicator */}
          {scanFeedback && (
            <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
              w-32 h-32 rounded-full flex items-center justify-center text-6xl
              ${scanFeedback === 'success' ? 'bg-green-500' : 'bg-red-500'} animate-ping`}
            >
              {scanFeedback === 'success' ? '✓' : '✗'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
