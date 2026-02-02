'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Gift as GiftIcon, Users } from 'lucide-react';
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
  is_locked?: boolean;
  locked_by_device?: string;
}

interface LockedOrder {
  tracking_number: string;
  locked_by_session: string;
  locked_by_device: string | null;
  locked_at: string;
}



// =====================================================
// BUNDLE PRODUCTS CONFIGURATION
// =====================================================

const PRODUCT_BUNDLES: Record<string, Array<{ sku: string; name: string; quantity: number }>> = {
  // Buzz Balanced+ SET 7kg (แตกเป็น 2x3kg + 1x1kg)
  '8854052503703': [
    { sku: '8854052503307', name: 'Buzz Balanced+ แมวโต Hair&Skin | 3 กก.', quantity: 2 },
    { sku: '8854052503109', name: 'Buzz Balanced+ แมวโต Hair&Skin | 1 กก.', quantity: 1 }
  ],
  '8854052501709': [
    { sku: '8854052501303', name: 'Buzz Balanced+ แมวโต Indoor | 3 กก.', quantity: 2 },
    { sku: '8854052501105', name: 'Buzz Balanced+ แมวโต Indoor | 1 กก.', quantity: 1 }
  ],
  '8854052504700': [
    { sku: '8854052504304', name: 'Buzz Balanced+ ลูกและแม่แมว K&P | 3 กก.', quantity: 2 },
    { sku: '8854052504106', name: 'Buzz Balanced+ ลูกและแม่แมว K&P | 1 กก.', quantity: 1 }
  ],
  '8854052502706': [
    { sku: '8854052502300', name: 'Buzz Balanced+ แมวโต Weight+ | 3 กก.', quantity: 2 },
    { sku: '8854052502102', name: 'Buzz Balanced+ แมวโต Weight+ | 1 กก.', quantity: 1 }
  ],
  // Buzz Netura SET (แตกเป็น 4x2.5kg)
  '5424052641014': [
    { sku: '5424052641250', name: 'Buzz Netura สุนัขโต ไก่ เม็ดเล็ก | 2.5 กก.', quantity: 4 }
  ],
  '5424052630018': [
    { sku: '5424052630254', name: 'Buzz Netura สุนัขโต แซลมอน เม็ดใหญ่ | 2.5 กก.', quantity: 4 }
  ]
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const expandBundleProducts = (items: Omit<PackingOrderItem, 'id' | 'scanned_quantity' | 'is_completed'>[]): PackingOrderItem[] => {
  const expandedItems: PackingOrderItem[] = [];
  console.log('📦 expandBundleProducts input:', items.map(i => ({ parent_sku: i.parent_sku, qty: i.quantity })));
  console.log('📦 PRODUCT_BUNDLES keys:', Object.keys(PRODUCT_BUNDLES));

  items.forEach((item) => {
    const isBundle = PRODUCT_BUNDLES[item.parent_sku];
    console.log(`📦 Checking SKU ${item.parent_sku}: isBundle=${!!isBundle}`);
    if (isBundle) {
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

// Generate unique session ID for this browser tab
const generateSessionId = () => {
  if (typeof window !== 'undefined') {
    let sessionId = sessionStorage.getItem('packing_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('packing_session_id', sessionId);
    }
    return sessionId;
  }
  return `session_${Date.now()}`;
};

// Get device info for display
const getDeviceInfo = () => {
  if (typeof window !== 'undefined') {
    const ua = navigator.userAgent;
    if (ua.includes('Mobile')) return 'มือถือ';
    if (ua.includes('Tablet')) return 'แท็บเล็ต';
    return 'คอมพิวเตอร์';
  }
  return 'Unknown';
};

export default function PackingPage() {
  const supabase = createClient();
  const sessionIdRef = useRef<string>(generateSessionId());
  const deviceInfoRef = useRef<string>(getDeviceInfo());

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
  
  // ✅ Multi-scanner support states
  const [lockedOrders, setLockedOrders] = useState<Map<string, LockedOrder>>(new Map());
  const [activeScannersCount, setActiveScannersCount] = useState(0);

  const trackingInputRef = useRef<HTMLInputElement>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // ✅ Load locked orders และ subscribe to real-time updates
  const loadLockedOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_locked_packing_orders');
      if (!error && data) {
        const lockMap = new Map<string, LockedOrder>();
        data.forEach((lock: LockedOrder) => {
          // ไม่แสดง lock ของตัวเอง
          if (lock.locked_by_session !== sessionIdRef.current) {
            lockMap.set(lock.tracking_number, lock);
          }
        });
        setLockedOrders(lockMap);
        setActiveScannersCount(data.length);
      }
    } catch (err) {
      console.warn('Could not load locked orders:', err);
    }
  }, [supabase]);

  // ✅ Lock order เมื่อเริ่มแพ็ค
  const lockOrder = useCallback(async (trackingNumber: string): Promise<boolean> => {
    try {
      console.log('🔒 Attempting to lock order:', trackingNumber, 'Session:', sessionIdRef.current);
      
      const { data, error } = await supabase.rpc('lock_packing_order', {
        p_tracking_number: trackingNumber,
        p_session_id: sessionIdRef.current,
        p_device_info: deviceInfoRef.current,
        p_timeout_seconds: 300 // 5 minutes
      });
      
      console.log('🔒 Lock response:', { data, error });
      
      if (error) {
        console.error('Lock error:', error);
        setScanError(`ไม่สามารถ lock order ได้: ${error.message}`);
        playSound('error');
        return false;
      }
      
      // RPC returns array of rows
      const result = Array.isArray(data) ? data[0] : data;
      console.log('🔒 Lock result:', result);
      
      if (!result || result.success === false) {
        const errorMsg = result?.message || 'ออเดอร์นี้กำลังถูกแพ็คโดยเครื่องอื่น';
        setScanError(errorMsg);
        playSound('error');
        return false;
      }
      
      console.log('🔒 Lock acquired successfully');
      return true;
    } catch (err) {
      console.error('Lock order error:', err);
      setScanError('เกิดข้อผิดพลาดในการ lock order');
      playSound('error');
      return false;
    }
  }, [supabase]);

  // ✅ Release lock เมื่อเสร็จหรือยกเลิก
  const releaseOrderLock = useCallback(async (trackingNumber: string, markCompleted: boolean = false) => {
    try {
      await supabase.rpc('release_packing_order_lock', {
        p_tracking_number: trackingNumber,
        p_session_id: sessionIdRef.current,
        p_mark_completed: markCompleted
      });
    } catch (err) {
      console.warn('Release lock error:', err);
    }
  }, [supabase]);

  // Load initial data on page load
  useEffect(() => {
    loadInitialData();
    loadPackedOrdersCount();
    loadLockedOrders();

    const initAudioOnClick = () => {
      initializeAudioContext();
      document.removeEventListener('click', initAudioOnClick);
    };

    const handleWindowFocus = () => {
      console.log('🔄 Window focused - refreshing data');
      loadInitialData();
      loadLockedOrders();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Tab visible - refreshing data');
        loadInitialData();
        loadLockedOrders();
      }
    };

    // ✅ Real-time subscription for order locks
    const lockChannel = supabase
      .channel('packing_order_locks_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'packing_order_locks' },
        () => {
          console.log('🔒 Lock changed - refreshing');
          loadLockedOrders();
        }
      )
      .subscribe();

    // ✅ Real-time subscription for packing_orders changes
    const ordersChannel = supabase
      .channel('packing_orders_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'packing_orders' },
        () => {
          console.log('📦 Orders changed - refreshing');
          loadInitialData();
        }
      )
      .subscribe();

    // ✅ Periodic refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      loadLockedOrders();
    }, 30000);

    document.addEventListener('click', initAudioOnClick);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ✅ Release lock on page unload
    const handleBeforeUnload = () => {
      if (currentOrder) {
        // Use sendBeacon for reliable unload
        navigator.sendBeacon?.('/api/online-packing/release-lock', JSON.stringify({
          tracking_number: currentOrder.tracking_number,
          session_id: sessionIdRef.current
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('click', initAudioOnClick);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      lockChannel.unsubscribe();
      ordersChannel.unsubscribe();
      clearInterval(refreshInterval);
      
      // Release lock on unmount
      if (currentOrder) {
        releaseOrderLock(currentOrder.tracking_number);
      }
    };
  }, [loadLockedOrders, releaseOrderLock]);

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
      // ✅ แก้ไข: ใช้ UTC date range เหมือน dashboard
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      // ✅ FIX: ใช้ RPC function เพื่อให้ได้ unique tracking numbers
      const { data: backupOrders, error: backupError } = await supabase
        .rpc('get_packed_orders_count_by_date', {
          p_start_date: startOfDay,
          p_end_date: endOfDay
        });

      if (backupError) {
        console.warn('Could not load backup orders (RPC), falling back to direct query:', backupError);

        // Fallback: Direct query with DISTINCT
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('packing_backup_orders')
          .select('tracking_number, platform')
          .gte('packed_at', startOfDay)
          .lte('packed_at', endOfDay)
          .not('packed_at', 'is', null);

        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          setPackedOrdersCount(0);
          return;
        }

        // Deduplicate in JS
        const uniqueMap = new Map<string, string>();
        (fallbackData || []).forEach(order => {
          if (order.tracking_number && !uniqueMap.has(order.tracking_number)) {
            uniqueMap.set(order.tracking_number, order.platform || 'Other');
          }
        });

        setPackedOrdersCount(uniqueMap.size);
        const platformCounts: Record<string, number> = {};
        uniqueMap.forEach((platform) => {
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });
        setPackedByPlatform(platformCounts);
        return;
      }

      // Process RPC result
      const uniqueMap = new Map<string, string>();
      (backupOrders || []).forEach((order: any) => {
        if (order.tracking_number) {
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

    const trackingNo = trackingInput.trim();
    const order = availableOrders.find(o => o.tracking_number === trackingNo);
    
    if (order) {
      // ✅ เช็คว่า order ถูก lock โดยคนอื่นหรือไม่
      const lockedInfo = lockedOrders.get(trackingNo);
      if (lockedInfo) {
        setScanError(`ออเดอร์นี้กำลังถูกแพ็คโดยเครื่องอื่น (${lockedInfo.locked_by_device || 'ไม่ทราบ'})`);
        setTrackingInput('');
        playSound('error');
        return;
      }
      
      // ✅ พยายาม lock order ก่อนเริ่มแพ็ค
      const lockSuccess = await lockOrder(trackingNo);
      if (!lockSuccess) {
        setTrackingInput('');
        return; // Error already set by lockOrder
      }
      
      setCurrentOrder(order);
      setTrackingInput('');
      setScanError('');

      updatePackingStatus(order.id, 'in_progress');
      setTimeout(() => skuInputRef.current?.focus(), 100);
      playSound('success');
    } else {
      setScanError(`ไม่พบออเดอร์สำหรับ Tracking No: ${trackingNo}`);
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
      
      // ✅ Release lock และ mark as completed
      await releaseOrderLock(completedOrder.tracking_number, true);

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

  const resetInterface = async () => {
    // ✅ Release lock เมื่อยกเลิก
    if (currentOrder) {
      await releaseOrderLock(currentOrder.tracking_number, false);
    }
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

      {/* ✅ Active Scanners Indicator */}
      {activeScannersCount > 1 && (
        <div className="bg-blue-50 border-b border-blue-200 px-2 sm:px-4 py-1">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-blue-700">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium font-thai">
              มี {activeScannersCount} เครื่องสแกนกำลังทำงานพร้อมกัน
            </span>
            {lockedOrders.size > 0 && (
              <span className="text-xs text-blue-500 font-thai">
                ({lockedOrders.size} ออเดอร์ถูก lock)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Scanner Section */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-1.5 sm:py-3">
          <div className="bg-white flex justify-center">
            <form onSubmit={!currentOrder ? handleTrackingSearch : handleSkuScan} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-1.5 sm:gap-2 w-full max-w-2xl">
              <div className="flex-1">
                <label className="text-xs sm:text-base font-bold text-gray-700 font-thai mb-0.5 sm:mb-1.5 block">
                  {!currentOrder ? 'สแกนบาร์โค้ดสินค้า' : 'สแกนบาร์โค้ดสินค้า'}
                </label>
                <div className="relative">
                  <input
                    ref={!currentOrder ? trackingInputRef : skuInputRef}
                    type="text"
                    value={!currentOrder ? trackingInput : skuInput}
                    onChange={(e) => !currentOrder ? setTrackingInput(e.target.value) : setSkuInput(e.target.value)}
                    className={`w-full px-2 py-2 sm:py-2 text-sm sm:text-sm font-mono rounded border transition-all duration-300 bg-white font-thai ${
                      scanError
                        ? 'border-red-400 focus:ring-2 focus:ring-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:ring-2 focus:ring-primary-300 focus:border-primary-500'
                    }`}
                    placeholder="พิมพ์หรือสแกน SKU / บาร์โค้ด ..."
                    autoFocus
                  />
                </div>
              </div>
              {currentOrder && (
                <button
                  type="button"
                  onClick={resetInterface}
                  className="flex items-center justify-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 sm:px-3 sm:py-2 rounded font-semibold text-xs font-thai transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  ยกเลิก
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-1.5 sm:px-4 py-1.5 sm:py-4 pb-36 sm:pb-20">
        <div className="max-w-7xl mx-auto">
          {scanError && (
            <div className="bg-red-50 text-red-700 p-2 rounded mb-2">
              <p className="font-semibold text-xs font-thai">{scanError}</p>
            </div>
          )}

          {currentOrder && !(currentOrder.items.every(item => item.is_completed) && (orderFreebies.length === 0 || freebieConfirmed)) && (
            <section className="bg-white p-2 sm:p-4 mb-2 sm:mb-4 flex flex-col">
              {/* Order Header */}
              <div className="flex justify-between items-start mb-2 sm:mb-4">
                <div>
                  <h2 className="text-sm sm:text-xl font-bold text-gray-800 font-thai">รายละเอียดออเดอร์</h2>
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 font-thai">
                    <span>กำลังดำเนินการ</span>
                  </div>
                </div>
              </div>

              {/* Order Info Cards - Compact */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-2 sm:mb-4 text-center">
                <div className="bg-slate-50 p-1.5 sm:p-3 rounded">
                  <p className="text-[10px] sm:text-xs text-slate-500 font-thai">หมายเลขคำสั่งซื้อ</p>
                  <p className="font-mono font-bold text-[11px] sm:text-base text-slate-800 truncate">{currentOrder.order_number}</p>
                </div>
                <div className="bg-primary-50 p-1.5 sm:p-3 rounded">
                  <p className="text-[10px] sm:text-xs text-primary-500 font-thai">Tracking</p>
                  <p className="font-mono font-bold text-[11px] sm:text-base text-primary-700 truncate">{currentOrder.tracking_number}</p>
                </div>
                <div className="bg-orange-50 p-1.5 sm:p-3 rounded">
                  <p className="text-[10px] sm:text-xs text-orange-500 font-thai">ผู้ซื้อ</p>
                  <p className="font-bold text-[11px] sm:text-base text-orange-700 font-thai truncate">{currentOrder.buyer_name}</p>
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
                <div className={`mb-3 p-2 sm:p-3 border rounded-lg ${
                  freebieConfirmed
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-pink-50 border-pink-200 text-pink-800'
                }`}>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className={`p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3 shrink-0 ${
                        freebieConfirmed ? 'bg-green-100' : 'bg-pink-100'
                      }`}>
                        <GiftIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${freebieConfirmed ? 'text-green-600' : 'text-pink-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {freebieConfirmed ? (
                          <p className="font-bold text-sm font-thai">ยืนยันของแถมเรียบร้อย</p>
                        ) : (
                          <div className="bg-pink-500 p-2 sm:p-3 rounded-lg">
                            <p className="font-black text-base sm:text-xl text-white text-center animate-bounce font-thai">
                              � ของแถมพิเศษ!
                            </p>
                            {orderFreebies.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {orderFreebies.map((freebie, index) => (
                                  <p key={index} className="font-bold text-sm sm:text-lg text-yellow-300 text-center">
                                    ✨ {freebie}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {!freebieConfirmed && (
                      <button
                        onClick={() => setFreebieConfirmed(true)}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 sm:px-5 rounded-lg text-sm font-bold font-thai transition-colors w-full sm:w-auto shrink-0"
                      >
                        ยืนยัน
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col mb-2">
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-hidden rounded-lg border border-gray-300 flex flex-col">
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

                {/* Mobile Card View - Compact */}
                <div className="sm:hidden space-y-1.5">
                  {currentOrder.items.map((item) => (
                    <div
                      key={item.id}
                      id={`item-mobile-${item.id}`}
                      className={`rounded border p-2 transition-all duration-300 ${
                        item.is_completed
                          ? 'bg-green-50 border-green-200'
                          : item.scanned_quantity > 0
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium font-thai leading-tight ${item.is_completed ? 'line-through text-green-700' : 'text-gray-800'}`}>
                            {item.product_name}
                          </p>
                          <p className="font-mono text-[10px] text-primary-600">{item.parent_sku}</p>
                          {item.bundle_info && (
                            <span className="text-[9px] text-orange-600 font-thai">จากเซต</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-center">
                            <p className="text-[9px] text-gray-400 font-thai">สั่ง</p>
                            <p className="text-sm font-bold text-primary-600">{item.quantity}</p>
                          </div>
                          <div className="text-center min-w-[32px]">
                            <p className="text-[9px] text-gray-400 font-thai">สแกน</p>
                            <p className={`text-sm font-bold ${item.is_completed ? 'text-green-600' : item.scanned_quantity > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {item.scanned_quantity}/{item.quantity}
                            </p>
                          </div>
                          {item.is_completed ? (
                            <span className="text-green-600 text-xs">✓</span>
                          ) : (
                            <button 
                              onClick={() => handleManualConfirm(item.id)} 
                              className="bg-primary-500 text-white px-2 py-1 rounded text-[10px] font-medium font-thai"
                            >
                              ยืนยัน
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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

      {/* Footer Statistics */}
      <div className="fixed bottom-0 left-0 sm:left-64 right-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-screen-xl mx-auto px-1.5 sm:px-4 py-1.5 sm:py-3">
          {/* Mobile Footer - Compact */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex-1 bg-gray-50 rounded p-1 text-center">
                <span className="text-[9px] text-gray-500 font-thai block">ทั้งหมด</span>
                <span className="text-sm font-bold text-gray-800 font-thai">{availableOrders.length + packedOrdersCount}</span>
              </div>
              <div className="flex-1 bg-green-50 rounded p-1 text-center">
                <span className="text-[9px] text-green-600 font-thai block">สแกนแล้ว</span>
                <span className="text-sm font-bold text-green-700 font-thai">{packedOrdersCount}</span>
              </div>
              <div className="flex-1 bg-blue-50 rounded p-1 text-center">
                <span className="text-[9px] text-blue-600 font-thai block">คงเหลือ</span>
                <span className="text-sm font-bold text-blue-700 font-thai">{availableOrders.length}</span>
              </div>
            </div>
            <div className="space-y-0.5">
              {(() => {
                const platforms = [
                  { key: 'Shopee Thailand', label: 'Sho', color: 'bg-orange-500', textColor: 'text-orange-600' },
                  { key: 'TikTok Shop', label: 'Tik', color: 'bg-gray-800', textColor: 'text-gray-800' },
                  { key: 'Lazada Thailand', label: 'Laz', color: 'bg-purple-600', textColor: 'text-purple-600' },
                ];
                return platforms.map(p => {
                  const packedCount = packedByPlatform[p.key] || 0;
                  const remainingCount = availableOrders.filter(o => o.platform === p.key).length;
                  const totalCount = packedCount + remainingCount;
                  const percent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;
                  return (
                    <div key={p.key} className="flex items-center gap-1">
                      <span className={`text-[9px] font-medium ${p.textColor} font-thai w-6 shrink-0`}>{p.label}</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color} rounded-full`} style={{ width: `${percent}%` }}></div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-600 font-thai w-12 text-right shrink-0">{packedCount}/{totalCount}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Desktop Footer */}
          <div className="hidden sm:flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
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
