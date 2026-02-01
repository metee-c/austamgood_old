'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Gift as GiftIcon } from 'lucide-react';
import JsBarcode from 'jsbarcode';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface PackingOrderItem {
  id: string;
  parent_sku: string;
  product_name: string;
  quantity: number;
  scanned_quantity: number;
  is_completed: boolean;
  bundle_info?: {
    parent_name: string;
    parent_sku: string;
  };
  freebie_display_name?: string | null;
}

interface PackingOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  tracking_number: string;
  platform: string;
  sample_alert: string | null;
  items: PackingOrderItem[];
}



// =====================================================
// BUNDLE PRODUCTS CONFIGURATION
// =====================================================

const PRODUCT_BUNDLES: Record<string, Array<{ sku: string; name: string; quantity: number }>> = {
  'CATBUNDLE': [
    { sku: 'CAT001', name: 'อาหารแมวเม็ด 1kg', quantity: 1 },
    { sku: 'CAT002', name: 'ขนมแมว 100g', quantity: 2 }
  ],
  'DOGBUNDLE': [
    { sku: 'DOG001', name: 'อาหารหมาเม็ด 2kg', quantity: 1 },
    { sku: 'DOG002', name: 'ขนมหมา 200g', quantity: 1 }
  ]
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const expandBundleProducts = (items: Omit<PackingOrderItem, 'id' | 'scanned_quantity' | 'is_completed'>[]): PackingOrderItem[] => {
  const expandedItems: PackingOrderItem[] = [];

  items.forEach((item) => {
    if (PRODUCT_BUNDLES[item.parent_sku]) {
      const bundleComponents = PRODUCT_BUNDLES[item.parent_sku];
      bundleComponents.forEach((component) => {
        expandedItems.push({
          id: `${item.parent_sku}-${component.sku}`,
          parent_sku: component.sku,
          product_name: component.name,
          quantity: component.quantity * item.quantity,
          scanned_quantity: 0,
          is_completed: false,
          bundle_info: {
            parent_name: item.product_name,
            parent_sku: item.parent_sku
          }
        });
      });
    } else {
      expandedItems.push({
        id: item.parent_sku,
        parent_sku: item.parent_sku,
        product_name: item.product_name,
        quantity: item.quantity,
        scanned_quantity: 0,
        is_completed: false
      });
    }
  });

  return expandedItems;
};


// =====================================================
// MAIN PACKING PAGE COMPONENT
// =====================================================

export default function PackingPage() {
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [availableOrders, setAvailableOrders] = useState<PackingOrder[]>([]);
  const [currentOrder, setCurrentOrder] = useState<PackingOrder | null>(null);
  const [systemStatus, setSystemStatus] = useState('กำลังโหลดข้อมูล...');
  const [trackingInput, setTrackingInput] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [scanError, setScanError] = useState('');
  const [packedOrdersCount, setPackedOrdersCount] = useState(0);
  const [packedByPlatform, setPackedByPlatform] = useState<Record<string, number>>({});
  const [isProcessingCompletion, setIsProcessingCompletion] = useState(false);
  const [orderFreebies, setOrderFreebies] = useState<string[]>([]);
  const [freebieConfirmed, setFreebieConfirmed] = useState(false);


  const trackingInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Load initial data on page load
  useEffect(() => {
    loadInitialData();
    loadPackedOrdersCount();

    const initAudioOnClick = () => {
      initializeAudioContext();
      document.removeEventListener('click', initAudioOnClick);
    };

    const handleWindowFocus = () => {
      console.log('🔄 Window focused - refreshing freebie data');
      loadInitialData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Tab visible - refreshing freebie data');
        loadInitialData();
      }
    };

    document.addEventListener('click', initAudioOnClick);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('click', initAudioOnClick);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (currentOrder && currentOrder.items.every(item => item.is_completed) && (orderFreebies.length === 0 || freebieConfirmed)) {
      setTimeout(() => {
        const input = document.querySelector('#barcode-scanner-input') as HTMLInputElement;
        if (input) {
          input.focus();
        }

        const barcodeCanvas = document.querySelector('#barcode-canvas') as HTMLCanvasElement;
        if (barcodeCanvas && currentOrder) {
          const barcodeValue = `CLOSE${currentOrder.order_number.slice(-8).toUpperCase()}QRP8`;
          try {
            JsBarcode(barcodeCanvas, barcodeValue, {
              format: "CODE128",
              width: 3,
              height: 100,
              displayValue: false,
              margin: 10,
              background: "#ffffff",
              lineColor: "#000000"
            });
          } catch (error) {
            console.error('Error generating barcode:', error);
          }
        }
      }, 500);
    }
  }, [currentOrder, freebieConfirmed, orderFreebies]);

  useEffect(() => {
    if (currentOrder) {
      const freebies = Array.from(new Set(currentOrder.items
        .map(item => item.freebie_display_name)
        .filter((name): name is string => !!name)));
      setOrderFreebies(freebies);
      setFreebieConfirmed(freebies.length === 0);
    } else {
      setOrderFreebies([]);
    }
  }, [currentOrder]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        supabase.from('packing_orders').select('*').not('tracking_number', 'is', null).in('fulfillment_status', ['pending', 'processing']).order('created_at', { ascending: true }),
        supabase.from('master_sku').select('sku_id, barcode').not('barcode', 'is', null)
      ]);

      if (ordersRes.error) throw new Error(`Failed to load orders: ${ordersRes.error.message}`);
      if (productsRes.error) throw new Error(`Failed to load products: ${productsRes.error.message}`);

      const skuToBarcodeMap = new Map<string, string>();
      productsRes.data?.forEach(p => {
        if (p.sku_id && p.barcode) {
          skuToBarcodeMap.set(p.sku_id, p.barcode);
        }
      });

      const { data: freebiesData, error: freebiesError } = await supabase
        .from('packing_promotion_freebies')
        .select('product_barcode, display_name, freebie_skus, random_freebie')
        .eq('is_active', true);

      if (freebiesError) {
        console.warn('Could not load promotion freebies:', freebiesError);
      }

      const freebieMap = new Map<string, any>();
      freebiesData?.forEach(f => {
        if (f.product_barcode && f.display_name) {
          let displayName = f.display_name;
          if (f.random_freebie && f.freebie_skus && Array.isArray(f.freebie_skus) && f.freebie_skus.length > 1) {
            const randomIndex = Math.floor(Math.random() * f.freebie_skus.length);
            const selectedFreebie = f.freebie_skus[randomIndex];
            displayName = selectedFreebie.name || f.display_name;
          }
          freebieMap.set(f.product_barcode, displayName);
        }
      });


      const orderGroups = new Map<string, any[]>();
      ordersRes.data?.forEach(order => {
        if (order.tracking_number && order.parent_sku && order.product_name && order.quantity) {
          const key = order.tracking_number;
          if (!orderGroups.has(key)) orderGroups.set(key, []);
          orderGroups.get(key)?.push(order);
        }
      });

      const packingOrders: PackingOrder[] = Array.from(orderGroups.entries()).map(([trackingNumber, orderList]) => {
        const firstOrder = orderList[0];
        const uniqueItems = new Map<string, any>();
        orderList.forEach(order => {
          const key = order.parent_sku;
          if (uniqueItems.has(key)) {
            uniqueItems.get(key).quantity += order.quantity;
          } else {
            if (order.parent_sku) {
              uniqueItems.set(key, { id: order.parent_sku, parent_sku: order.parent_sku, product_name: order.product_name, quantity: order.quantity, scanned_quantity: 0, is_completed: false });
            }
          }
        });
        const rawItems = Array.from(uniqueItems.values());
        const expandedItems = expandBundleProducts(rawItems);

        const itemsWithCorrectedFreebies = expandedItems.map(item => {
          const barcodeFromMap = skuToBarcodeMap.get(item.parent_sku);
          let freebieDisplayName = null;

          if (barcodeFromMap) {
            freebieDisplayName = freebieMap.get(barcodeFromMap);
          }

          if (!freebieDisplayName) {
            freebieDisplayName = freebieMap.get(item.parent_sku);
          }

          return {
            ...item,
            freebie_display_name: freebieDisplayName
          };
        });

        return {
          id: firstOrder.id,
          order_number: firstOrder.order_number,
          buyer_name: firstOrder.buyer_name,
          tracking_number: trackingNumber,
          platform: firstOrder.platform,
          sample_alert: firstOrder.sample_alert,
          items: itemsWithCorrectedFreebies
        };
      });

      setAvailableOrders(packingOrders);
      setSystemStatus(`พร้อมใช้งาน (${packingOrders.length} ออเดอร์)`);

    } catch (error: any) {
      console.error('Error loading initial data:', error);
      setSystemStatus(`โหมดทดลอง - ${error.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPackedOrdersCount = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const { data: backupOrders, error: backupError } = await supabase
        .from('packing_backup_orders')
        .select('tracking_number, platform')
        .gte('packed_at', todayISO)
        .not('packed_at', 'is', null);
      if (backupError) {
        console.warn('Could not load backup orders:', backupError);
      }
      const uniqueMap = new Map<string, string>();
      (backupOrders || []).forEach(order => {
        if (!uniqueMap.has(order.tracking_number)) {
          uniqueMap.set(order.tracking_number, order.platform || 'Other');
        }
      });
      setPackedOrdersCount(uniqueMap.size);
      const platformCounts: Record<string, number> = {};
      uniqueMap.forEach((platform) => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });
      setPackedByPlatform(platformCounts);
    } catch (error) {
      console.warn('Error loading packed orders count:', error);
      setPackedOrdersCount(0);
    }
  };

  const handleTrackingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;

    await initializeAudioContext();

    const order = availableOrders.find(o => o.tracking_number === trackingInput.trim());
    if (order) {
      setCurrentOrder(order);
      setTrackingInput('');
      setScanError('');

      updatePackingStatus(order.id, 'in_progress');
      setTimeout(() => skuInputRef.current?.focus(), 100);
      playSound('success');
    } else {
      setScanError(`ไม่พบออเดอร์สำหรับ Tracking No: ${trackingInput}`);
      setTrackingInput('');
      playSound('error');
    }
  };

  const handleSkuScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuInput.trim() || !currentOrder) return;

    await initializeAudioContext();

    const scannedSku = skuInput.trim().replace(/\s+/g, '');
    const item = currentOrder.items.find(i => i.parent_sku.replace(/\s+/g, '') === scannedSku);

    if (item) {
      if (item.scanned_quantity < item.quantity) {
        const itemElement = document.getElementById(`item-${item.id}`);
        if (itemElement) {
          itemElement.classList.add('scan-success');
          setTimeout(() => itemElement.classList.remove('scan-success'), 600);
        }
        updateItemScannedQuantity(item.id, item.scanned_quantity + 1);
        setSkuInput('');
        setScanError('');
        playSound('success');
      } else {
        setScanError(`สินค้า ${scannedSku} สแกนครบแล้ว`);
        setSkuInput('');
        playSound('error');
        if (skuInputRef.current) {
          skuInputRef.current.classList.add('shake');
          setTimeout(() => skuInputRef.current?.classList.remove('shake'), 500);
        }
      }
    } else {
      setScanError(`ไม่พบสินค้า SKU: ${scannedSku} ในออเดอร์นี้`);
      setSkuInput('');
      playSound('error');
      if (skuInputRef.current) {
        skuInputRef.current.classList.add('shake');
        setTimeout(() => skuInputRef.current?.classList.remove('shake'), 500);
      }
    }
  };

  const handleManualConfirm = async (itemId: string) => {
    if (!currentOrder) return;
    const item = currentOrder.items.find(item => item.id === itemId);
    if (!item) return;
    const newQuantity = item.quantity;
    try {
      setScanError('');
      playSound('success');
      await updateItemScannedQuantity(itemId, newQuantity);
      const itemElement = document.getElementById(`item-${itemId}`);
      if (itemElement) {
        itemElement.classList.add('flash-success');
        setTimeout(() => itemElement.classList.remove('flash-success'), 1000);
      }
    } catch (error: any) {
      console.error('Error confirming item:', error);
      setScanError(`เกิดข้อผิดพลาดในการยืนยัน: ${error.message}`);
      playSound('error');
    }
  };

  const updateItemScannedQuantity = async (itemId: string, newQuantity: number) => {
    setCurrentOrder(prev => {
      if (!prev) return prev;
      const newItems = prev.items.map(item =>
        item.id === itemId
          ? { ...item, scanned_quantity: newQuantity, is_completed: newQuantity >= item.quantity }
          : item
      );
      return { ...prev, items: newItems };
    });
  };

  const updatePackingStatus = async (orderId: string, status: 'in_progress' | 'completed') => {
    if (!currentOrder) return;
    const now = new Date().toISOString();
    const updates: any = {
      fulfillment_status: status === 'completed' ? 'delivered' : 'processing',
      packing_status: status,
      updated_at: now
    };
    if (status === 'completed') {
      updates.packed_at = now;
      updates.packed_by = 'System User';
      updates.completed_at = now;
    }
    const { error } = await supabase.from('packing_orders').update(updates).eq('tracking_number', currentOrder.tracking_number);
    if (error) console.error('Failed to update packing status:', error);
  };

  const moveOrderToBackup = async (trackingNumber: string) => {
    if (!currentOrder) return;

    const { data: ordersToBackup, error: fetchError } = await supabase
      .from('packing_orders')
      .select('*')
      .eq('tracking_number', trackingNumber);

    if (fetchError) {
      console.error('❌ Error fetching orders for backup:', fetchError);
      throw fetchError;
    }

    if (!ordersToBackup || ordersToBackup.length === 0) {
      console.warn('⚠️ No orders found to backup for tracking:', trackingNumber);
      return;
    }

    const { data: existingBackup } = await supabase
      .from('packing_backup_orders')
      .select('tracking_number')
      .eq('tracking_number', trackingNumber)
      .limit(1);

    if (!existingBackup || existingBackup.length === 0) {
      const { error: insertError } = await supabase
        .from('packing_backup_orders')
        .insert(ordersToBackup.map(o => ({
          original_order_id: o.id,
          order_number: o.order_number,
          buyer_name: o.buyer_name,
          tracking_number: o.tracking_number,
          parent_sku: o.parent_sku,
          product_name: o.product_name,
          quantity: o.quantity,
          fulfillment_status: o.fulfillment_status,
          completed_at: o.completed_at,
          platform: o.platform,
          shipping_provider: o.shipping_provider,
          packing_status: o.packing_status,
          packed_at: o.packed_at,
          packed_by: o.packed_by,
          sample_alert: o.sample_alert,
          moved_to_backup_at: new Date().toISOString()
        })));

      if (insertError && insertError.code !== '23505') {
        console.error('❌ Backup error:', insertError);
        throw insertError;
      }
    }

    const { error: deleteError } = await supabase
      .from('packing_orders')
      .delete()
      .eq('tracking_number', trackingNumber);

    if (deleteError) {
      console.error('❌ Error deleting from orders:', deleteError);
      throw deleteError;
    }
  };


  const completeOrder = async (completedOrder: PackingOrder) => {
    if (!completedOrder) return;
    try {
      // Move stock from E-Commerce to Dispatch for all items
      const stockMoveResult = await moveStockToDispatch(completedOrder);
      if (!stockMoveResult.success) {
        console.warn('Stock movement warning:', stockMoveResult.message);
      }

      await updatePackingStatus(completedOrder.id, 'completed');
      await moveOrderToBackup(completedOrder.tracking_number);

      playSound('complete');
      setAvailableOrders(prev => prev.filter(o => o.tracking_number !== completedOrder.tracking_number));
      setPackedOrdersCount(prev => prev + 1);
      const orderPlatform = completedOrder.platform || 'Other';
      setPackedByPlatform(prev => ({ ...prev, [orderPlatform]: (prev[orderPlatform] || 0) + 1 }));
      setSystemStatus(`พร้อมใช้งาน (${availableOrders.length - 1} ออเดอร์)`);

    } catch (error) {
      console.error('Error completing order:', error);
      setScanError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      throw error;
    }
  };

  // Move stock from E-Commerce to Dispatch when order is complete
  const moveStockToDispatch = async (order: PackingOrder): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch('/api/online-packing/complete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: order.order_number,
          tracking_number: order.tracking_number,
          platform: order.platform,
          items: order.items.map(item => ({
            sku_id: item.parent_sku,
            sku_name: item.product_name,
            quantity: item.quantity
          }))
        })
      });

      const result = await response.json();
      return { success: result.success, message: result.message || '' };
    } catch (error: any) {
      console.error('Error moving stock to Dispatch:', error);
      return { success: false, message: error.message };
    }
  };

  const handleConfirmCompletion = async () => {
    if (!currentOrder) return;
    setIsProcessingCompletion(true);
    try {
      await completeOrder(currentOrder);
      resetInterface();
    } catch (error) {
      console.error("Failed to confirm and complete order:", error);
    } finally {
      setIsProcessingCompletion(false);
    }
  };

  const resetInterface = () => {
    setCurrentOrder(null);
    setScanError('');
    setSkuInput('');
    setTrackingInput('');
    setFreebieConfirmed(false);
    setTimeout(() => trackingInputRef.current?.focus(), 100);
  };

  const playSound = (type: 'success' | 'error' | 'complete') => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      switch (type) {
        case 'success':
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, context.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.3);
          oscillator.start(context.currentTime);
          oscillator.stop(context.currentTime + 0.3);
          break;
        case 'error':
          oscillator.frequency.value = 300;
          oscillator.type = 'sawtooth';
          gainNode.gain.setValueAtTime(0.2, context.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4);
          oscillator.start(context.currentTime);
          oscillator.stop(context.currentTime + 0.4);
          break;
        case 'complete':
          [800, 1000, 1200].forEach((freq, index) => {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, context.currentTime + index * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.8 + index * 0.1);
            osc.start(context.currentTime + index * 0.1);
            osc.stop(context.currentTime + 0.8 + index * 0.1);
          });
          break;
      }
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  };

  const initializeAudioContext = async () => {
    if (!audioInitialized && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        setAudioInitialized(true);
      } catch (error) {
        console.warn('Audio Context initialization failed:', error);
      }
    }
  };


  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-800 font-thai">กำลังโหลดข้อมูลออเดอร์...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-thai">
      {/* Processing Overlay */}
      {isProcessingCompletion && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-base font-semibold text-gray-800 font-thai">กำลังบันทึกข้อมูลการแพ็ค...</p>
            <p className="text-xs text-gray-600 font-thai mt-1">กรุณารอสักครู่</p>
          </div>
        </div>
      )}

      {/* Scanner Section */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="bg-white flex justify-center">
            <form onSubmit={!currentOrder ? handleTrackingSearch : handleSkuScan} className="flex items-end gap-2 w-full max-w-2xl">
              <div className="flex-1">
                <label className="text-base font-bold text-gray-700 font-thai mb-1.5 block">
                  {!currentOrder ? 'ค้นหาหมายเลขติดตามพัสดุ' : 'สแกนบาร์โค้ดสินค้า'}
                </label>
                <div className="relative">
                  <input
                    ref={!currentOrder ? trackingInputRef : skuInputRef}
                    type="text"
                    value={!currentOrder ? trackingInput : skuInput}
                    onChange={(e) => !currentOrder ? setTrackingInput(e.target.value) : setSkuInput(e.target.value)}
                    className={`w-full px-3 py-2 text-sm font-mono rounded-lg border transition-all duration-300 bg-white font-thai ${
                      scanError
                        ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-primary-300 focus:border-primary-500'
                    }`}
                    placeholder={!currentOrder ? "พิมพ์หรือสแกน Tracking Number ..." : "พิมพ์หรือสแกน SKU / บาร์โค้ด ..."}
                    autoFocus
                  />
                </div>
              </div>
              {currentOrder && (
                <button
                  type="button"
                  onClick={resetInterface}
                  className="flex items-center gap-1.5 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg font-semibold text-xs font-thai transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  ยกเลิก
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Main Content - ลด padding bottom */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        <div className="max-w-7xl mx-auto">
          {scanError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
              <div className="flex items-center">
                <div className="bg-red-100 p-1.5 rounded-lg mr-3">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-sm font-thai">{scanError}</p>
              </div>
            </div>
          )}

          {currentOrder && !(currentOrder.items.every(item => item.is_completed) && (orderFreebies.length === 0 || freebieConfirmed)) && (
            <section className="bg-white p-4 mb-4 min-h-[500px] flex flex-col">
              {/* Order Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 font-thai mb-1">รายละเอียดออเดอร์</h2>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 font-thai">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>กำลังดำเนินการ</span>
                  </div>
                </div>
              </div>

              {/* Order Info Cards */}
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-slate-500 p-1.5 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-slate-600 font-thai">หมายเลขคำสั่งซื้อ</p>
                  </div>
                  <p className="font-mono font-bold text-base text-slate-800">{currentOrder.order_number}</p>
                </div>
                <div className="bg-primary-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-primary-500 p-1.5 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-primary-600 font-thai">Tracking No</p>
                  </div>
                  <p className="font-mono font-bold text-base text-primary-700">{currentOrder.tracking_number}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-orange-500 p-1.5 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-orange-600 font-thai">ผู้ซื้อ</p>
                  </div>
                  <p className="font-bold text-base text-orange-700 font-thai">{currentOrder.buyer_name}</p>
                </div>
              </div>

              {currentOrder.sample_alert && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
                  <div className="flex items-center">
                    <div className="bg-yellow-100 p-2 rounded-lg mr-3">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-sm font-thai mb-0.5">ข้อควรระวัง!</p>
                      <p className="text-sm font-thai">{currentOrder.sample_alert}</p>
                    </div>
                  </div>
                </div>
              )}

              {orderFreebies.length > 0 && (
                <div className={`mb-3 p-3 border rounded-lg ${
                  freebieConfirmed
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-pink-50 border-pink-200 text-pink-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${
                        freebieConfirmed ? 'bg-green-100' : 'bg-pink-100'
                      }`}>
                        <GiftIcon className={`w-5 h-5 ${freebieConfirmed ? 'text-green-600' : 'text-pink-600'}`} />
                      </div>
                      <div>
                        <div className={`${freebieConfirmed ? '' : 'bg-pink-500 p-3 rounded-lg'}`}>
                          <p className={`font-thai ${freebieConfirmed ? 'font-bold text-sm' : 'font-black text-2xl text-white text-center animate-bounce'}`}>
                            {freebieConfirmed ? 'ยืนยันของแถมเรียบร้อย' : '🎉 สินค้าของแถมพิเศษ! 🎉'}
                          </p>
                          {!freebieConfirmed && orderFreebies.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {orderFreebies.map((freebie, index) => (
                                <p key={index} className="font-black text-3xl text-yellow-300 text-center animate-pulse">
                                  ✨ {freebie} ✨
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {!freebieConfirmed && (
                      <button
                        onClick={() => setFreebieConfirmed(true)}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold font-thai transition-colors"
                      >
                        ยืนยัน
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col mb-2">
                <div className="overflow-hidden rounded-lg border border-gray-300 flex flex-col">
                  <div className="bg-gray-100 border-b border-gray-300">
                    <div className="grid gap-2 px-2 py-1.5" style={{gridTemplateColumns: '100px 1fr 70px 70px 70px 100px'}}>
                      <div className="text-left text-xs font-bold text-gray-700 font-thai">รหัสสินค้า</div>
                      <div className="text-left text-xs font-bold text-gray-700 font-thai">ชื่อสินค้า</div>
                      <div className="text-center text-xs font-bold text-gray-700 font-thai">จำนวนสั่ง</div>
                      <div className="text-center text-xs font-bold text-gray-700 font-thai">ต้องสแกน</div>
                      <div className="text-center text-xs font-bold text-gray-700 font-thai">สถานะ</div>
                      <div className="text-center text-xs font-bold text-gray-700 font-thai">การดำเนินการ</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {currentOrder.items.map((item) => (
                      <div
                        key={item.id}
                        id={`item-${item.id}`}
                        className={`grid gap-2 px-2 py-2 border-b border-gray-100 transition-all duration-300 ${
                          item.is_completed
                            ? 'bg-green-50 text-green-800'
                            : item.scanned_quantity > 0
                            ? 'bg-yellow-50'
                            : 'bg-white hover:bg-gray-50'
                        }`}
                        style={{gridTemplateColumns: '100px 1fr 70px 70px 70px 100px'}}
                      >
                        <div className="flex items-center"><span className="font-mono text-xs font-medium text-primary-600">{item.parent_sku}</span></div>
                        <div className="flex justify-start items-start text-left">
                          <span className={`text-xs font-medium font-thai ${item.is_completed ? 'line-through' : ''}`}>{item.product_name}</span>
                          {item.bundle_info && (
                            <div className="flex items-center text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md mt-0.5">
                              <svg className="w-2.5 h-2.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5l7 7-7 7" />
                              </svg>
                              <span className="font-medium font-thai">จากเซต: {item.bundle_info.parent_name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center"><span className="text-base font-bold text-primary-600 font-thai">{item.quantity}</span></div>
                        <div className="flex items-center justify-center"><span className={`text-base font-bold ${item.is_completed ? 'text-green-600' : item.scanned_quantity > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{item.scanned_quantity}/{item.quantity}</span></div>
                        <div className="flex items-center justify-center">
                          {item.is_completed ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] font-semibold font-thai rounded-full">
                              <svg className="w-2.5 h-2.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              เสร็จสิ้น
                            </span>
                          ) : item.scanned_quantity > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-semibold font-thai rounded-full">กำลังสแกน</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold font-thai rounded-full">รอสแกน</span>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          {item.is_completed ? (
                            <button className="text-green-600 hover:text-green-800 text-xs font-medium font-thai cursor-not-allowed" disabled>✓ เสร็จแล้ว</button>
                          ) : (
                            <button onClick={() => handleManualConfirm(item.id)} className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium font-thai transition-colors">ยืนยัน</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!currentOrder && (
            <div className="text-center py-8">
              <h2 className="text-2xl font-light text-gray-300 font-thai mb-3">ยินดีต้อนรับสู่ระบบสแกนแพ็คสินค้า</h2>
              <p className="text-gray-300 text-sm font-thai mb-6">กรุณาสแกนหมายเลขติดตามพัสดุเพื่อเริ่มต้นการแพ็คสินค้า</p>
              <div className="max-w-md mx-auto">
                <div className="text-center mb-4">
                  <span className="text-gray-300 text-lg font-light font-thai">1</span>
                  <span className="text-gray-300 text-sm font-light font-thai ml-2">สแกนหมายเลขติดตาม</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-300 text-lg font-light font-thai">2</span>
                  <span className="text-gray-300 text-sm font-light font-thai ml-2">สแกนสินค้าตามรายการ</span>
                </div>
              </div>
            </div>
          )}

          {currentOrder && currentOrder.items.every(item => item.is_completed) && (orderFreebies.length === 0 || freebieConfirmed) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 text-center max-w-lg mx-4">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 font-thai mb-1.5">แพ็คเสร็จเรียบร้อย!</h2>
                  <p className="text-gray-600 text-sm font-thai">สินค้าครบถ้วนแล้ว พร้อมปิดกล่องและจัดส่ง</p>
                </div>
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4 text-left">
                  <div className="space-y-1.5">
                    <div className="flex"><span className="font-semibold text-gray-700 text-sm min-w-[90px] font-thai">Order:</span><span className="text-gray-800 text-sm font-thai">{currentOrder.order_number}</span></div>
                    <div className="flex"><span className="font-semibold text-gray-700 text-sm min-w-[90px] font-thai">Tracking:</span><span className="text-gray-800 text-sm font-thai">{currentOrder.tracking_number}</span></div>
                    <div className="flex"><span className="font-semibold text-gray-700 text-sm min-w-[90px] font-thai">จำนวนสินค้า:</span><span className="text-gray-800 text-sm font-thai">{currentOrder.items.reduce((total, item) => total + item.quantity, 0)} ชิ้น</span></div>
                  </div>
                </div>
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600 font-thai mb-3">สแกนบาร์โค้ดด้านล่างเพื่อปิดหน้าต่างนี้ หรือคลิกปุ่ม</p>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 mb-3">
                    <div className="flex justify-center mb-2">
                      <canvas id="barcode-canvas" className="max-w-full h-auto"/>
                    </div>
                    <div className="text-xs text-gray-600 font-mono tracking-wider text-center">รหัส: CLOSE{currentOrder.order_number.slice(-8).toUpperCase()}QRP8</div>
                  </div>
                  <input
                    id="barcode-scanner-input"
                    type="text"
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      if (value.includes('CLOSE')) {
                        handleConfirmCompletion();
                      }
                      setTimeout(() => {
                        e.target.value = ''
                      }, 100)
                    }}
                    style={{ position: 'absolute', left: '-9999px' }}
                    autoFocus
                    tabIndex={-1}
                  />
                </div>
                <button
                  onClick={handleConfirmCompletion}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 px-6 rounded-lg font-bold font-thai text-base transition-colors"
                >
                  แพ็คออเดอร์ถัดไป
                </button>
                <p className="text-xs text-gray-500 font-thai mt-3">หรือสแกนบาร์โค้ดเพื่อไปต่อแบบอัตโนมัติ</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Statistics - Horizontal Bar Layout */}
      <div className="fixed bottom-0 left-64 right-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-6 shrink-0">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 font-thai">ออเดอร์ทั้งหมด/วัน</span>
                <span className="text-lg font-bold text-gray-800 font-thai">{availableOrders.length + packedOrdersCount}</span>
              </div>
              <div className="w-px h-8 bg-gray-300"></div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-green-600 font-thai">สแกนจัดไปแล้ว</span>
                <span className="text-lg font-bold text-green-700 font-thai">{packedOrdersCount}</span>
              </div>
              <div className="w-px h-8 bg-gray-300"></div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-blue-600 font-thai">คงเหลือ</span>
                <span className="text-lg font-bold text-blue-700 font-thai">{availableOrders.length}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-300 shrink-0"></div>
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <span className="text-xs font-medium text-gray-600 font-thai">ความคืบหน้า</span>
              {(() => {
                const platforms = [
                  { key: 'Shopee Thailand', label: 'Shopee', color: 'bg-orange-500', textColor: 'text-orange-600' },
                  { key: 'TikTok Shop', label: 'TikTok', color: 'bg-gray-800', textColor: 'text-gray-800' },
                  { key: 'Lazada Thailand', label: 'Lazada', color: 'bg-purple-600', textColor: 'text-purple-600' },
                ];
                return platforms.map(p => {
                  const packedCount = packedByPlatform[p.key] || 0;
                  const remainingCount = availableOrders.filter(o => o.platform === p.key).length;
                  const totalCount = packedCount + remainingCount;
                  const percent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;
                  return (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${p.textColor} font-thai w-14 shrink-0`}>{p.label}</span>
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${p.color} transition-all duration-300 rounded-full`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-gray-700 font-thai w-20 text-right shrink-0">
                        {packedCount}/{totalCount} ({percent}%)
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .scan-success {
          animation: pulse-green 0.6s ease-in-out;
        }
        .flash-success {
          animation: flash-green 1s ease-in-out;
        }
        .shake {
          animation: shake 0.5s;
        }
        @keyframes pulse-green {
          0%, 100% { background-color: white; }
          50% { background-color: #dcfce7; }
        }
        @keyframes flash-green {
          0%, 100% { background-color: white; }
          25%, 75% { background-color: #bbf7d0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
