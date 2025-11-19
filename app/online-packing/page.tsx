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

interface Box {
  id: string;
  box_code: string;
  box_name: string;
  dimensions_length: number;
  dimensions_width: number;
  dimensions_height: number;
  volume: number;
}

interface ProductWeightProfile {
  product_type_code: string;
  weight_kg: number;
  dimensions_length: number;
  dimensions_width: number;
  dimensions_height: number;
}

interface PackingRule {
  box_code: string;
  primary_product_type_code: string;
  rule_code: string;
  components: Array<{ type: string; qty: number }> | null;
  notes: string | null;
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

const getRecommendedBox = async (
  items: PackingOrderItem[],
  productProfiles: ProductWeightProfile[],
  packingRules: PackingRule[],
  allBoxes: Box[]
): Promise<Box | null> => {
  if (items.length === 0 || allBoxes.length === 0) return null;

  // Simplified box recommendation logic
  const candidateRules = packingRules.filter(rule => rule.components !== null);

  if (candidateRules.length === 0) {
    const fallbackBox = allBoxes.sort((a, b) => a.volume - b.volume)[0];
    return fallbackBox || null;
  }

  const candidateBoxes = candidateRules
    .map(rule => allBoxes.find(box => box.box_code === rule.box_code))
    .filter((box): box is Box => box !== undefined);

  candidateBoxes.sort((a, b) => a.volume - b.volume);

  return candidateBoxes[0] || null;
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
  const [isProcessingCompletion, setIsProcessingCompletion] = useState(false);
  const [orderFreebies, setOrderFreebies] = useState<string[]>([]);
  const [freebieConfirmed, setFreebieConfirmed] = useState(false);

  const [recommendedBox, setRecommendedBox] = useState<Box | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [productProfiles, setProductProfiles] = useState<ProductWeightProfile[]>([]);
  const [packingRules, setPackingRules] = useState<PackingRule[]>([]);

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
      const [boxesRes, profilesRes, rulesRes, ordersRes, productsRes] = await Promise.all([
        supabase.from('packing_boxes').select('*'),
        supabase.from('packing_product_weight_profiles').select('*'),
        supabase.from('packing_rules').select('*'),
        supabase.from('packing_orders').select('*').not('tracking_number', 'is', null).in('fulfillment_status', ['pending', 'processing']).order('created_at', { ascending: true }),
        supabase.from('packing_products').select('parent_sku, barcode')
      ]);

      if (boxesRes.error) throw new Error(`Failed to load boxes: ${boxesRes.error.message}`);
      if (profilesRes.error) throw new Error(`Failed to load profiles: ${profilesRes.error.message}`);
      if (rulesRes.error) throw new Error(`Failed to load rules: ${rulesRes.error.message}`);
      if (ordersRes.error) throw new Error(`Failed to load orders: ${ordersRes.error.message}`);
      if (productsRes.error) throw new Error(`Failed to load products: ${productsRes.error.message}`);

      const skuToBarcodeMap = new Map<string, string>();
      productsRes.data?.forEach(p => {
        if (p.parent_sku && p.barcode) {
          skuToBarcodeMap.set(p.parent_sku, p.barcode);
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

      setBoxes(boxesRes.data || []);
      setProductProfiles(profilesRes.data || []);
      setPackingRules(rulesRes.data || []);

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
        .select('tracking_number')
        .gte('packed_at', todayISO)
        .not('packed_at', 'is', null);
      if (backupError) {
        console.warn('Could not load backup orders:', backupError);
      }
      const uniqueTrackingNumbers = new Set(backupOrders?.map(order => order.tracking_number) || []);
      setPackedOrdersCount(uniqueTrackingNumbers.size);
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
      const recommended = await getRecommendedBox(order.items, productProfiles, packingRules, boxes);
      setRecommendedBox(recommended);

      if (recommended) {
        await playBoxAudio(recommended.box_code);
      } else {
        await playBoxAudio('default');
      }

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

    const scannedSku = skuInput.trim();
    const item = currentOrder.items.find(i => i.parent_sku === scannedSku);

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
        .insert(ordersToBackup.map(o => {
          const { id, ...orderWithoutId } = o;
          return {
            ...orderWithoutId,
            original_order_id: id,
            packed_at: new Date().toISOString()
          };
        }));

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

  const savePackingHistory = async (completedOrder: PackingOrder, usedBox: Box | null) => {
    try {
      if (!usedBox) return;

      const totalWeight = completedOrder.items.reduce((sum, item) => {
        const weightMatch = item.product_name.match(/(\d+(?:\.\d+)?)\s*(?:kg|กก|กิโลกรัม)/i);
        const itemWeight = weightMatch ? parseFloat(weightMatch[1]) : 0.5;
        return sum + (itemWeight * item.quantity);
      }, 0);

      const totalVolume = usedBox.dimensions_length * usedBox.dimensions_width * usedBox.dimensions_height;
      const itemsCount = completedOrder.items.reduce((sum, item) => sum + item.quantity, 0);

      const { error } = await supabase.from('packing_history').insert({
        tracking_number: completedOrder.tracking_number,
        box_id: usedBox.id,
        box_code: usedBox.box_code,
        total_weight: totalWeight,
        total_volume: totalVolume,
        items_count: itemsCount,
        packed_by: 'System User',
        pack_duration: null,
        efficiency_score: 85,
        notes: `แพ็คด้วยระบบอัตโนมัติ - ${itemsCount} รายการ`,
        packed_at: new Date().toISOString()
      });

      if (error) {
        console.warn('Could not save packing history:', error);
      }
    } catch (error) {
      console.warn('Error saving packing history:', error);
    }
  };

  const completeOrder = async (completedOrder: PackingOrder) => {
    if (!completedOrder) return;
    try {
      await updatePackingStatus(completedOrder.id, 'completed');
      await savePackingHistory(completedOrder, recommendedBox);
      await moveOrderToBackup(completedOrder.tracking_number);

      playSound('complete');
      setAvailableOrders(prev => prev.filter(o => o.tracking_number !== completedOrder.tracking_number));
      setPackedOrdersCount(prev => prev + 1);
      setSystemStatus(`พร้อมใช้งาน (${availableOrders.length - 1} ออเดอร์)`);

    } catch (error) {
      console.error('Error completing order:', error);
      setScanError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      throw error;
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
    setRecommendedBox(null);
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

  const playBoxAudio = async (boxCode: string) => {
    try {
      await initializeAudioContext();

      const normalizedCode = boxCode.toLowerCase().replace(/\s+/g, '');

      const audioMap: { [key: string]: string } = {
        'b': 'B.mp3',
        'c': 'C.mp3',
        'd': 'D.mp3',
        'd+11': 'D+11.mp3',
        'e': 'E.mp3',
        'm+': 'M+.mp3',
        'm': 'M+.mp3',
        'ฉ': 'ฉ.mp3',
        'a1': 'B.mp3',
        'b1': 'C.mp3',
        'c1': 'D.mp3',
        'd1': 'E.mp3',
        'm1': 'M+.mp3',
        'default': 'default.mp3'
      };

      const audioFile = audioMap[normalizedCode] || audioMap['default'];
      const audioPath = `/audio/thai/${audioFile}`;

      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 1.0;
      audio.crossOrigin = 'anonymous';

      audio.src = audioPath;

      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (playError: any) {
        console.error('❌ Play failed:', playError);
        console.warn('⚠️ Audio playback failed, no fallback');
      }

    } catch (error) {
      console.error('❌ Box Audio Error:', error);
      console.warn('⚠️ Audio system error, no fallback');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-800 font-thai">กำลังโหลดข้อมูลออเดอร์...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col font-thai">
      {isProcessingCompletion && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100]">
          <div className="text-center text-white">
            <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-semibold font-thai">กำลังบันทึกข้อมูลการแพ็ค...</p>
            <p className="font-thai">กรุณารอสักครู่</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="w-full px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-3 rounded-xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth={2} fill="none" opacity="0.9"/>
                  <line x1="7" y1="9" x2="7" y2="15" strokeWidth={1.5} opacity="0.9"/>
                  <line x1="9" y1="9" x2="9" y2="15" strokeWidth={2} opacity="0.9"/>
                  <line x1="11.5" y1="9" x2="11.5" y2="15" strokeWidth={1.5} opacity="0.9"/>
                  <line x1="13.5" y1="9" x2="13.5" y2="15" strokeWidth={2} opacity="0.9"/>
                  <line x1="16" y1="9" x2="16" y2="15" strokeWidth={1.5} opacity="0.9"/>
                  <line x1="17.5" y1="9" x2="17.5" y2="15" strokeWidth={1.5} opacity="0.9"/>
                  <line x1="3" y1="12" x2="21" y2="12" strokeWidth={1} stroke="#FFE4E1" opacity="0.6"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary-600 font-thai">ระบบสแกนแพ็คสินค้า</h1>
                <p className="text-base text-gray-600 font-thai font-medium">Packing System v2.0 Pro</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm font-thai">สถานะ: <span className="font-semibold text-primary-600">{systemStatus}</span></div>
              <button onClick={() => window.location.href = '/'} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-thai font-medium transition-colors">กลับหน้าหลัก</button>
            </div>
          </div>
        </div>
      </header>

      {/* Scanner Section */}
      <section className="bg-white shadow-lg border-b border-gray-200">
        <div className="w-full max-w-screen-xl mx-auto px-6 py-8">
          <form onSubmit={!currentOrder ? handleTrackingSearch : handleSkuScan} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="flex items-center gap-3 text-base font-semibold text-gray-700 font-thai mb-3">
                {!currentOrder ? (
                  <>
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <span className="text-primary-600 font-thai">ค้นหาหมายเลขติดตามพัสดุ</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg text-white">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4 0h4m-4 0v4m-4-11V9" />
                      </svg>
                    </div>
                    <span className="text-primary-600 font-thai">สแกนบาร์โค้ดสินค้า</span>
                  </>
                )}
              </label>
              <div className="relative">
                <input
                  ref={!currentOrder ? trackingInputRef : skuInputRef}
                  type="text"
                  value={!currentOrder ? trackingInput : skuInput}
                  onChange={(e) => !currentOrder ? setTrackingInput(e.target.value) : setSkuInput(e.target.value)}
                  className={`w-full px-5 py-4 border-2 rounded-2xl text-lg font-mono transition-all duration-300 bg-white font-thai ${
                    scanError
                      ? 'border-red-300 focus:ring-4 focus:ring-red-500/20 focus:border-red-500 shadow-lg shadow-red-500/10'
                      : 'border-gray-300 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 shadow-lg shadow-primary-500/10'
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
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-6 py-4 rounded-2xl font-medium font-thai transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                ยกเลิก
              </button>
            )}
          </form>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-2 py-6 pb-24">
        <div className="w-full max-w-screen-xl mx-auto">
          {scanError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold font-thai">{scanError}</p>
              </div>
            </div>
          )}

          {currentOrder && !(currentOrder.items.every(item => item.is_completed) && (orderFreebies.length === 0 || freebieConfirmed)) && (
            <section className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-4 min-h-[calc(100vh-300px)] flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 font-thai">รายละเอียดออเดอร์</h2>
                </div>
                {recommendedBox && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500 font-thai">กล่องที่แนะนำ</p>
                    <p className="font-bold text-2xl text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                      {recommendedBox.box_code} ({recommendedBox.box_name})
                    </p>
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div><p className="text-sm text-gray-500 font-thai">หมายเลขคำสั่งซื้อ</p><p className="font-mono font-bold text-lg">{currentOrder.order_number}</p></div>
                <div><p className="text-sm text-gray-500 font-thai">Tracking No</p><p className="font-mono font-bold text-lg text-primary-600">{currentOrder.tracking_number}</p></div>
                <div><p className="text-sm text-gray-500 font-thai">ผู้ซื้อ</p><p className="font-bold text-lg font-thai">{currentOrder.buyer_name}</p></div>
              </div>

              {currentOrder.sample_alert && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="font-bold font-thai">ข้อควรระวัง!</p>
                      <p className="font-thai">{currentOrder.sample_alert}</p>
                    </div>
                  </div>
                </div>
              )}

              {orderFreebies.length > 0 && (
                <div className={`mb-3 p-3 border rounded-xl ${freebieConfirmed ? 'bg-green-50 border-green-200 text-green-700' : 'bg-pink-50 border-pink-200 text-pink-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <GiftIcon className={`w-6 h-6 mr-3 ${freebieConfirmed ? 'text-green-500' : 'text-pink-500'}`} />
                      <div>
                        <div className={`${freebieConfirmed ? '' : 'bg-gradient-to-r from-pink-500 to-purple-600 p-4 rounded-xl shadow-lg'}`}>
                          <p className={`font-thai ${freebieConfirmed ? 'font-bold' : 'font-black text-3xl text-white text-center animate-bounce'}`}>
                            {freebieConfirmed ? 'ยืนยันของแถมเรียบร้อย' : '🎉 สินค้าของแถมพิเศษ! 🎉'}
                          </p>
                          {!freebieConfirmed && orderFreebies.length > 0 && (
                            <div className="mt-3">
                              {orderFreebies.map((freebie, index) => (
                                <p key={index} className="font-black text-4xl text-yellow-300 text-center animate-pulse drop-shadow-lg">
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
                        className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium font-thai transition-colors"
                      >
                        ยืนยัน
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col mb-2">
                <div className="overflow-hidden rounded-xl border border-gray-200 flex flex-col">
                  <div className="bg-primary-50 border-b border-gray-200">
                    <div className="grid gap-3 px-3 py-2" style={{gridTemplateColumns: '120px 1fr 80px 80px 80px 120px'}}>
                      <div className="text-left text-sm font-bold text-gray-700 font-thai">รหัสสินค้า</div>
                      <div className="text-left text-sm font-bold text-gray-700 font-thai">ชื่อสินค้า</div>
                      <div className="text-center text-sm font-bold text-gray-700 font-thai">จำนวนสั่ง</div>
                      <div className="text-center text-sm font-bold text-gray-700 font-thai">ต้องสแกน</div>
                      <div className="text-center text-sm font-bold text-gray-700 font-thai">สถานะ</div>
                      <div className="text-center text-sm font-bold text-gray-700 font-thai">การดำเนินการ</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {currentOrder.items.map((item) => (
                      <div
                        key={item.id}
                        id={`item-${item.id}`}
                        className={`grid gap-3 px-3 py-3 border-b border-gray-100 transition-all duration-300 ${
                          item.is_completed
                            ? 'bg-green-50 text-green-800'
                            : item.scanned_quantity > 0
                            ? 'bg-yellow-50'
                            : 'bg-white hover:bg-gray-50'
                        }`}
                        style={{gridTemplateColumns: '120px 1fr 80px 80px 80px 120px'}}
                      >
                        <div className="flex items-center"><span className="font-mono text-sm font-medium text-primary-600">{item.parent_sku}</span></div>
                        <div className="flex items-center flex-col items-start">
                          <span className={`text-sm font-medium font-thai ${item.is_completed ? 'line-through' : ''}`}>{item.product_name}</span>
                          {item.bundle_info && (
                            <div className="flex items-center text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-md mt-1">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 5l7 7-7 7" />
                              </svg>
                              <span className="font-medium font-thai">จากเซต: {item.bundle_info.parent_name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center"><span className="text-lg font-bold text-primary-600 font-thai">{item.quantity}</span></div>
                        <div className="flex items-center justify-center"><span className={`text-xl font-bold ${item.is_completed ? 'text-green-600' : item.scanned_quantity > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{item.scanned_quantity}/{item.quantity}</span></div>
                        <div className="flex items-center justify-center">
                          {item.is_completed ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold font-thai rounded-full">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              เสร็จสิ้น
                            </span>
                          ) : item.scanned_quantity > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold font-thai rounded-full">กำลังสแกน</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold font-thai rounded-full">รอสแกน</span>
                          )}
                        </div>
                        <div className="flex items-center justify-center">
                          {item.is_completed ? (
                            <button className="text-green-600 hover:text-green-800 text-sm font-medium font-thai cursor-not-allowed" disabled>✓ เสร็จแล้ว</button>
                          ) : (
                            <button onClick={() => handleManualConfirm(item.id)} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium font-thai transition-colors">ยืนยัน</button>
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
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-700 font-thai mb-4">ยินดีต้อนรับสู่ระบบสแกนแพ็คสินค้า</h2>
              <p className="text-gray-500 text-lg font-thai mb-6">กรุณาสแกนหมายเลขติดตามพัสดุเพื่อเริ่มต้นการแพ็คสินค้า</p>
              <div className="bg-primary-50 border border-primary-200 p-6 rounded-xl max-w-md mx-auto">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <span className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold font-thai">1</span>
                  <span className="text-primary-700 font-medium font-thai">สแกนหมายเลขติดตาม</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold font-thai">2</span>
                  <span className="text-green-700 font-medium font-thai">สแกนสินค้าตามรายการ</span>
                </div>
              </div>
            </div>
          )}

          {currentOrder && currentOrder.items.every(item => item.is_completed) && (orderFreebies.length === 0 || freebieConfirmed) && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-lg mx-4">
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-gray-800 font-thai mb-2">แพ็คเสร็จเรียบร้อย!</h2>
                  <p className="text-gray-600 text-lg font-thai">สินค้าครบถ้วนแล้ว พร้อมปิดกล่องและจัดส่ง</p>
                </div>
                <div className="bg-green-50 border border-green-200 p-6 rounded-xl mb-6 text-left">
                  <div className="space-y-2">
                    <div className="flex"><span className="font-semibold text-gray-700 min-w-[100px] font-thai">Order:</span><span className="text-gray-800 font-thai">{currentOrder.order_number}</span></div>
                    <div className="flex"><span className="font-semibold text-gray-700 min-w-[100px] font-thai">Tracking:</span><span className="text-gray-800 font-thai">{currentOrder.tracking_number}</span></div>
                    <div className="flex"><span className="font-semibold text-gray-700 min-w-[100px] font-thai">จำนวนสินค้าทั้งหมด:</span><span className="text-gray-800 font-thai">{currentOrder.items.reduce((total, item) => total + item.quantity, 0)} ชิ้น</span></div>
                  </div>
                </div>
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-sm text-gray-600 font-thai mb-4">สแกนบาร์โค้ดด้านล่างเพื่อปิดหน้าต่างนี้ หรือคลิกปุ่ม</p>
                  <div className="bg-white p-6 rounded-lg border border-gray-300 mb-4">
                    <div className="flex justify-center mb-3">
                      <canvas id="barcode-canvas" className="max-w-full h-auto"/>
                    </div>
                    <div className="text-sm text-gray-600 font-mono tracking-wider text-center">รหัส: CLOSE{currentOrder.order_number.slice(-8).toUpperCase()}QRP8</div>
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
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-4 px-8 rounded-xl font-bold font-thai text-lg transition-colors"
                >
                  แพ็คออเดอร์ถัดไป
                </button>
                <p className="text-xs text-gray-500 font-thai mt-4">หรือสแกนบาร์โค้ดเพื่อไปต่อแบบอัตโนมัติ</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Statistics */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-2xl">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700 font-thai">ออเดอร์ทั้งหมด/วัน</h3>
                  <p className="text-xl font-bold text-slate-800 font-thai">{availableOrders.length + packedOrdersCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-xl border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-green-700 font-thai">สแกนจัดไปแล้ว</h3>
                  <p className="text-xl font-bold text-green-800 font-thai">{packedOrdersCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-xl border border-blue-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-blue-700 font-thai">คงเหลือ</h3>
                  <p className="text-xl font-bold text-blue-800 font-thai">{availableOrders.length}</p>
                </div>
              </div>
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
