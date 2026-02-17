'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Package, AlertCircle, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface OrderItem {
  order_item_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  weight?: number;
}

interface Order {
  order_id: number;
  order_no: string;
  customer_code: string;
  shop_name: string;
  province?: string;
  address: string;
  contact_info: string;
  phone: string;
  hub: string;
  remark: string;
  notes_additional?: string;
  delivery_type: string;
  sales_territory: string;
  trip_number: string;
  total_items: number;
  total_qty: number;
  items: OrderItem[];
}

interface PackData {
  pack_no: string;
  quantity: number;
}

interface ItemPackData {
  [itemId: number]: {
    packs: PackData[];
    totalQty: number;
  };
}

// Master data: SKU to max quantity per pack mapping
const SKU_MAX_QTY_PER_PACK: { [sku: string]: number } = {
  'PRE-BIB-PURPLE-M': 100,
  'PRE-BAG|SPB|MARKET': 50,
  'PRE-BRUSH': 30,
  'PRE-SPO': 100,
  'PRE-BOW|D|NEW': 25,
  'MKT-APRON-|CARTOON': 50,
  'PRE-BAG|CAV-PROTEINX': 50,
  'PRE-PWD|S': 25,
  'PRE-UMBRELLA|BEYOND': 30,
  'PRE-BOTTLE|CREAM|CAR': 25,
  'PRE-BAG|CAV-9BOX': 50,
  'PRE-BOTTLE|BLUE': 25,
  'PRE-BKT|BEYOND': 20,
  'PRE-PWD|L': 25,
  'PRE-BKT|PROTEINX': 20,
  'PRE-mug-dog&cat': 20,
  'PRE-BOW|CATFACE': 25,
  'PRE-tumbler-proteinx': 15,
  'PRE-tumbler-Blue': 15,
  'PRE-BAG|CAV-NOODMI': 50,
  'PRE-tumbler-green': 15,
  'PRE-CTS': 100,
  'PRE-BEANS': 100,
  'PRE-CHO|GRE': 8,
  'PRE-CHO|PROTEINX': 8,
  'PRE-POOPCASE': 100,
  'PRE-PET-CUSHION': 20,
  'PRE-POL|25|XXL': 20,
  'PRE-POL|25|3XL': 20,
  'PRE-POL|25|L': 20,
  'PRE-POL|25|M': 20,
  'PRE-POL|25|S': 20,
  'PRE-POL|25|XL': 20,
  'PRE-POL|GRE-M|L': 20,
  'PRE-POL|GRE-W|L': 20,
  'PRE-POL|GRE-M|M': 20,
  'PRE-POL|GRE-W|M': 20,
  'PRE-POL|GRE-W|S': 20,
  'PRE-POL|GRE-M|XL': 20,
  'PRE-POL|GRE-W|XL': 20,
  'PRE-POL|GRE-M|XXL': 20,
  'PRE-POL|BLU-M|L': 20,
  'PRE-POL|BLU-M|M': 20,
  'PRE-POL|BLU-W|XL': 20,
  'PRE-POL|BLU-W|XXL': 20,
  'PRE-BAG|CAV|CM|R': 50,
  'PRE-BAG|CAV|CM|W': 50,
  'PRE-BAG|CAV-G': 50,
  'PRE-BAG|CAV-B': 50,
  'PRE-BOTTLE|CREAM': 25,
  'PRE-BOW|C': 25,
  'PRE-BOW|D': 30,
  'PRE-CHO|BLU': 8,
  'PRE-BIB-BLUE-L': 10,
  'PRE-BIB-BLUE-M': 10,
  'PRE-BIB-PURPLE-L': 10,
  'PRE-BKT|NOODMI': 20,
  'PRE-BKT|B': 20,
  'PRE-PLW|PX': 8,
  'PRE-PLW|G': 8,
  'PRE-PLW|B': 8,
  'PRE-BOTTLE|BUZZ|BLUE': 25,
  'MKT-WRAP-SHELF-65*65': 1,
  'MKT-WRAP-SHELF-90*90': 1,
  'PRE-BOW|TILT|CAT': 30,
  'PRE-TSH|PX|NB-3XL|B': 20,
  'PRE-TSH|PX|NB-2XL|B': 20,
  'PRE-TSH|PX|NB-XL|B': 20,
  'PRE-TSH|PX|NB-L|B': 20,
  'PRE-TSH|PX|NB-M|B': 20,
  'PRE-TSH|PX|NB-S|B': 20,
  'PRE-TSH|PX|NB-3XL': 20,
  'PRE-TSH|PX|NB-2XL': 20,
  'MKT-VIN|ALL': 10,
  'MKT-PTR': 30,
};

// Helper function to get max qty per pack for a SKU
const getMaxQtyPerPack = (sku: string): number | null => {
  if (SKU_MAX_QTY_PER_PACK[sku]) return SKU_MAX_QTY_PER_PACK[sku];
  if (sku.startsWith('TT-')) return 350;
  return null;
};

const BonusFaceSheetPackFormPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deliveryDate = searchParams.get('delivery_date');
  const orderIds = searchParams.get('order_ids')?.split(',').map(Number) || [];
  const editId = searchParams.get('id'); // ID ของ face sheet ที่จะแก้ไข

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packData, setPackData] = useState<{ [orderId: number]: ItemPackData }>({});
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const [deliveryTypes, setDeliveryTypes] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftReady, setDraftReady] = useState(false); // flag to start auto-saving

  // localStorage draft key based on URL params
  const draftKey = editId
    ? `bfs-pack-draft-edit-${editId}`
    : `bfs-pack-draft-${deliveryDate}-${orderIds.sort().join(',')}`;
  // State for cumulative sum floating circle (follows cursor)
  const [cumulativeTooltip, setCumulativeTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    packNo: string;
    sum: number;
  }>({ visible: false, x: 0, y: 0, packNo: '', sum: 0 });
  const activePackRef = React.useRef<string | null>(null);

  // Calculate cumulative sum for a pack number across all items
  const calculateCumulativeSum = (targetPackNo: string): number => {
    let sum = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        const itemData = packData[order.order_id]?.[item.order_item_id];
        if (itemData) {
          itemData.packs.forEach(pack => {
            if (pack.pack_no === targetPackNo) {
              sum += pack.quantity;
            }
          });
        }
      });
    });
    return sum;
  };

  // Handle pack input click to show cumulative sum circle
  const handlePackInputClick = (e: React.MouseEvent, packNos: string) => {
    e.stopPropagation();
    const packList = packNos.split(',').map(p => p.trim()).filter(p => p);
    if (packList.length === 0) {
      activePackRef.current = null;
      setCumulativeTooltip(prev => ({ ...prev, visible: false }));
      return;
    }

    const lastPackNo = packList[packList.length - 1];
    activePackRef.current = lastPackNo;
    const sum = calculateCumulativeSum(lastPackNo);

    setCumulativeTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      packNo: lastPackNo,
      sum
    });
  };

  // Follow cursor only within pack-column cells, hide when leaving
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activePackRef.current) return;
      const target = e.target as HTMLElement;
      const inPackColumn = target.closest('[data-pack-column]');
      if (inPackColumn) {
        setCumulativeTooltip(prev => ({
          ...prev,
          visible: true,
          x: e.clientX,
          y: e.clientY,
        }));
      } else {
        setCumulativeTooltip(prev => ({ ...prev, visible: false }));
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-pack-input]')) {
        activePackRef.current = null;
        setCumulativeTooltip(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Recalculate sum when packData changes while tooltip is visible
  useEffect(() => {
    if (activePackRef.current) {
      const sum = calculateCumulativeSum(activePackRef.current);
      setCumulativeTooltip(prev => ({ ...prev, sum }));
    }
  }, [packData]);

  // Auto-save draft to localStorage when user edits
  useEffect(() => {
    if (!draftReady) return;
    try {
      const draft = { inputValues, packData, deliveryTypes, savedAt: Date.now() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch { /* ignore quota errors */ }
  }, [inputValues, packData, deliveryTypes, draftReady, draftKey]);

  // Helper: restore draft from localStorage onto initialized data
  const restoreDraft = (initialPackData: { [orderId: number]: ItemPackData }, ordersData: Order[]) => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) { setDraftReady(true); return; }
      const draft = JSON.parse(saved);
      // Skip drafts older than 24 hours
      if (draft.savedAt && Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(draftKey);
        setDraftReady(true);
        return;
      }
      if (draft.inputValues) setInputValues(draft.inputValues);
      if (draft.deliveryTypes) setDeliveryTypes(draft.deliveryTypes);
      if (draft.packData) {
        setPackData(draft.packData);
      }
    } catch { /* ignore parse errors */ }
    setDraftReady(true);
  };

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (editId) {
      // โหลดข้อมูลเดิมเพื่อแก้ไข
      fetchExistingData();
    } else if (deliveryDate) {
      // สร้างใหม่
      fetchOrders();
    }
  }, [deliveryDate, editId]);

  const fetchExistingData = async () => {
    try {
      setLoading(true);
      setIsEditMode(true);
      
      const response = await fetch(`/api/bonus-face-sheets/${editId}`);
      const result = await response.json();

      if (result.success) {
        const faceSheet = result.data;
        const originalQuantities = faceSheet.originalQuantities || {};
        console.log('Loaded face sheet:', faceSheet);
        console.log('Original quantities:', originalQuantities);
        console.log('Packages:', faceSheet.packages);
        
        // แปลง packages กลับเป็น orders format
        const ordersMap = new Map<number, Order>();
        
        faceSheet.packages.forEach((pkg: any) => {
          if (!ordersMap.has(pkg.order_id)) {
            ordersMap.set(pkg.order_id, {
              order_id: pkg.order_id,
              order_no: pkg.order_no,
              customer_code: pkg.customer_code,
              shop_name: pkg.shop_name,
              province: pkg.province,
              address: pkg.address,
              contact_info: pkg.contact_info,
              phone: pkg.phone,
              hub: pkg.hub,
              remark: pkg.remark,
              delivery_type: pkg.delivery_type,
              sales_territory: pkg.sales_territory,
              trip_number: pkg.trip_number,
              total_items: 0,
              total_qty: 0,
              items: []
            });
          }
          
          const order = ordersMap.get(pkg.order_id)!;
          pkg.items.forEach((item: any) => {
            const existingItem = order.items.find(i => i.order_item_id === item.order_item_id);
            if (!existingItem) {
              // ใช้ original quantity จาก wms_order_items แทน quantity ที่แบ่งแล้ว
              const originalQty = originalQuantities[item.order_item_id] || item.quantity;
              order.items.push({
                order_item_id: item.order_item_id,
                product_code: item.product_code,
                product_name: item.product_name,
                quantity: originalQty,
                weight: item.weight
              });
            }
            // ไม่ต้อง += quantity อีกแล้ว เพราะใช้ original quantity
          });
        });
        
        const reconstructedOrders = Array.from(ordersMap.values());
        setOrders(reconstructedOrders);
        
        // สร้าง packData, inputValues และ deliveryTypes จากข้อมูลเดิม
        const initialPackData: { [orderId: number]: ItemPackData } = {};
        const initialInputValues: { [key: string]: string } = {};
        const initialDeliveryTypes: { [key: string]: string } = {};
        
        reconstructedOrders.forEach((order) => {
          initialPackData[order.order_id] = {};
          
          order.items.forEach((item) => {
            const key = `${order.order_id}-${item.order_item_id}`;
            
            // หา packs ที่เกี่ยวข้องกับ item นี้
            const relatedPacks = faceSheet.packages.filter((pkg: any) => 
              pkg.order_id === order.order_id && 
              pkg.items.some((i: any) => i.order_item_id === item.order_item_id)
            );
            
            if (relatedPacks.length > 0) {
              const packs = relatedPacks.map((pkg: any, idx: number) => {
                const pkgItem = pkg.items.find((i: any) => i.order_item_id === item.order_item_id);
                // ใช้ pack_no ถ้ามี ไม่งั้นใช้ package_number หรือ index
                const packNo = pkg.pack_no || pkg.package_number?.toString() || (idx + 1).toString();
                console.log('Pack data:', { pack_no: pkg.pack_no, package_number: pkg.package_number, used: packNo, quantity: pkgItem?.quantity });
                return {
                  pack_no: packNo,
                  quantity: parseFloat(pkgItem?.quantity) || 0
                };
              });
              
              const savedTotalQty = packs.reduce((sum, p) => sum + p.quantity, 0);
              const originalQty = item.quantity; // นี่คือ original quantity จาก wms_order_items แล้ว
              
              // ถ้า savedTotalQty ไม่ตรงกับ originalQty แสดงว่ามี pack ที่หายไป
              // ให้ปรับ quantity ของ pack แรกให้รวมแล้วเท่ากับ originalQty
              if (savedTotalQty !== originalQty && packs.length > 0) {
                console.log('⚠️ Quantity mismatch:', { savedTotalQty, originalQty, diff: originalQty - savedTotalQty });
                // เพิ่ม quantity ที่หายไปให้ pack แรก
                packs[0].quantity += (originalQty - savedTotalQty);
              }
              
              initialPackData[order.order_id][item.order_item_id] = {
                packs,
                totalQty: packs.reduce((sum, p) => sum + p.quantity, 0)
              };
              
              initialInputValues[key] = packs.map(p => p.pack_no).filter(p => p).join(',');
              
              // เก็บ delivery_type จาก package แรก
              if (relatedPacks[0]?.delivery_type) {
                initialDeliveryTypes[key] = relatedPacks[0].delivery_type;
              }
            } else {
              initialPackData[order.order_id][item.order_item_id] = {
                packs: [{ pack_no: '', quantity: item.quantity }],
                totalQty: item.quantity
              };
              initialInputValues[key] = '';
            }
          });
        });
        
        setPackData(initialPackData);
        setInputValues(initialInputValues);
        setDeliveryTypes(initialDeliveryTypes);

        // Restore draft for edit mode too
        restoreDraft(initialPackData, reconstructedOrders);
      } else {
        setError(result.error || 'ไม่สามารถโหลดข้อมูลได้');
        setDraftReady(true);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setDraftReady(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bonus-face-sheets/orders?delivery_date=${deliveryDate}`);
      const result = await response.json();

      if (result.success) {
        const filteredOrders = result.data.filter((o: Order) => orderIds.includes(o.order_id));
        setOrders(filteredOrders);
        
        // Initialize pack data with empty pack_no
        const initialPackData: { [orderId: number]: ItemPackData } = {};
        const initialInputValues: { [key: string]: string } = {};
        const initialDeliveryTypes: { [key: string]: string } = {};
        filteredOrders.forEach((order: Order) => {
          initialPackData[order.order_id] = {};
          order.items.forEach((item) => {
            const key = `${order.order_id}-${item.order_item_id}`;
            initialPackData[order.order_id][item.order_item_id] = {
              packs: [{ pack_no: '', quantity: item.quantity }],
              totalQty: item.quantity
            };
            initialInputValues[key] = '';
            initialDeliveryTypes[key] = '';
          });
        });
        setPackData(initialPackData);
        setInputValues(initialInputValues);
        setDeliveryTypes(initialDeliveryTypes);

        // Restore draft from localStorage if exists
        restoreDraft(initialPackData, filteredOrders);
      } else {
        setError(result.error || 'ไม่สามารถโหลดข้อมูลได้');
        setDraftReady(true);
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setDraftReady(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePackNoChange = (orderId: number, itemId: number, value: string) => {
    const key = `${orderId}-${itemId}`;

    // Update input value
    setInputValues(prev => ({ ...prev, [key]: value }));

    // Show/update floating circle immediately on typing
    const packList = value.split(',').map(p => p.trim()).filter(p => p);
    if (packList.length > 0) {
      const lastPackNo = packList[packList.length - 1];
      activePackRef.current = lastPackNo;
      // sum will be recalculated by the packData useEffect after setPackData below
      setCumulativeTooltip(prev => ({ ...prev, visible: true, packNo: lastPackNo }));
    } else {
      activePackRef.current = null;
      setCumulativeTooltip(prev => ({ ...prev, visible: false }));
    }
    
    // Parse and update pack data
    const packNos = value.split(',').map(p => p.trim()).filter(p => p);
    
    setPackData(prev => {
      const newData = { ...prev };
      const itemData = newData[orderId][itemId];
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.order_item_id === itemId);
      
      if (!item) return prev;

      if (packNos.length === 1) {
        // Single pack - use full quantity
        itemData.packs = [{ pack_no: packNos[0], quantity: item.quantity }];
        itemData.totalQty = item.quantity;
      } else {
        // Multiple packs - distribute evenly or keep existing quantities
        const existingPacks = itemData.packs;
        const totalQty = item.quantity;
        
        // Check if we have existing quantities that sum correctly
        const existingTotal = existingPacks
          .filter(p => packNos.includes(p.pack_no))
          .reduce((sum, p) => sum + p.quantity, 0);
        
        if (existingTotal === totalQty) {
          // Keep existing distribution
          itemData.packs = packNos.map((packNo) => {
            const existing = existingPacks.find(p => p.pack_no === packNo);
            return {
              pack_no: packNo,
              quantity: existing?.quantity || 0
            };
          });
        } else {
          // Auto-distribute evenly
          const baseQty = Math.floor(totalQty / packNos.length);
          const remainder = totalQty % packNos.length;
          
          itemData.packs = packNos.map((packNo, idx) => {
            const existing = existingPacks.find(p => p.pack_no === packNo);
            // If existing has a non-zero quantity, keep it; otherwise distribute
            if (existing && existing.quantity > 0) {
              return { pack_no: packNo, quantity: existing.quantity };
            }
            // Give remainder to first packs
            return {
              pack_no: packNo,
              quantity: baseQty + (idx < remainder ? 1 : 0)
            };
          });
        }
        
        itemData.totalQty = itemData.packs.reduce((sum, p) => sum + p.quantity, 0);
      }

      return newData;
    });
  };

  const handlePackQtyChange = (orderId: number, itemId: number, packNo: string, quantity: number) => {
    setPackData(prev => {
      const newData = { ...prev };
      const itemData = newData[orderId][itemId];
      const pack = itemData.packs.find(p => p.pack_no === packNo);
      
      if (pack) {
        pack.quantity = quantity;
        itemData.totalQty = itemData.packs.reduce((sum, p) => sum + p.quantity, 0);
      }

      return newData;
    });
  };

  const handleDeliveryTypeChange = (orderId: number, itemId: number, value: string) => {
    const key = `${orderId}-${itemId}`;
    const itemData = packData[orderId]?.[itemId];
    
    if (!itemData) return;

    // อัปเดต delivery type ของแถวปัจจุบัน
    setDeliveryTypes(prev => {
      const newTypes = { ...prev };
      newTypes[key] = value;

      // หา pack_no ทั้งหมดของแถวนี้
      const currentPackNos = itemData.packs.map(p => p.pack_no).filter(p => p);

      if (currentPackNos.length > 0) {
        // อัปเดตแถวอื่นๆ ที่มี pack_no เดียวกัน
        orders.forEach(order => {
          order.items.forEach(item => {
            const otherKey = `${order.order_id}-${item.order_item_id}`;
            const otherItemData = packData[order.order_id]?.[item.order_item_id];
            
            if (otherItemData && otherKey !== key) {
              const otherPackNos = otherItemData.packs.map(p => p.pack_no).filter(p => p);
              
              // ตรวจสอบว่ามี pack_no ที่ตรงกันหรือไม่
              const hasMatchingPack = otherPackNos.some(packNo => currentPackNos.includes(packNo));
              
              if (hasMatchingPack) {
                newTypes[otherKey] = value;
              }
            }
          });
        });
      }

      return newTypes;
    });
  };

  const validatePackData = (): boolean => {
    for (const order of orders) {
      for (const item of order.items) {
        const itemData = packData[order.order_id]?.[item.order_item_id];
        
        if (!itemData) {
          setError(`กรุณากรอกข้อมูลแพ็คสำหรับสินค้า: ${item.product_name}`);
          return false;
        }

        if (itemData.packs.length === 0) {
          setError(`กรุณากรอกแพ็คที่สำหรับสินค้า: ${item.product_name}`);
          return false;
        }

        if (itemData.packs.length > 1 && itemData.totalQty !== item.quantity) {
          setError(
            `สินค้า "${item.product_name}" จำนวนรวมต้องเท่ากับ ${item.quantity} (ปัจจุบัน: ${itemData.totalQty})`
          );
          return false;
        }

        for (const pack of itemData.packs) {
          if (!pack.pack_no) {
            setError(`กรุณากรอกแพ็คที่สำหรับสินค้า: ${item.product_name}`);
            return false;
          }
          if (itemData.packs.length > 1 && pack.quantity <= 0) {
            setError(`กรุณากรอกจำนวนสำหรับแพ็ค ${pack.pack_no} ของสินค้า: ${item.product_name}`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validatePackData()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Transform data to packages format
      const packages: any[] = [];

      orders.forEach(order => {
        // Group items by pack_no
        const packGroups: { [packNo: string]: any } = {};

        order.items.forEach(item => {
          const itemData = packData[order.order_id][item.order_item_id];
          const key = `${order.order_id}-${item.order_item_id}`;
          const itemDeliveryType = deliveryTypes[key] || order.delivery_type;
          
          console.log('📦 Processing item:', {
            order_no: order.order_no,
            item_id: item.order_item_id,
            product_name: item.product_name,
            total_qty: item.quantity,
            packs: itemData.packs
          });
          
          itemData.packs.forEach(pack => {
            if (!pack.pack_no) {
              console.warn('⚠️ Skipping pack with empty pack_no');
              return;
            }
            
            if (!packGroups[pack.pack_no]) {
              packGroups[pack.pack_no] = {
                order_id: order.order_id,
                order_no: order.order_no,
                customer_code: order.customer_code,
                shop_name: order.shop_name,
                address: order.address,
                province: order.province,
                contact_info: order.contact_info,
                phone: order.phone,
                hub: order.hub,
                remark: order.remark,
                delivery_type: itemDeliveryType,
                sales_territory: order.sales_territory,
                trip_number: order.trip_number,
                pack_no: pack.pack_no,
                items: []
              };
            }

            // Only add item if quantity > 0
            if (pack.quantity > 0) {
              packGroups[pack.pack_no].items.push({
                order_item_id: item.order_item_id,
                product_code: item.product_code,
                product_name: item.product_name,
                quantity: pack.quantity,
                weight: item.weight
              });
              
              console.log('✅ Added item to pack:', {
                pack_no: pack.pack_no,
                product_name: item.product_name,
                quantity: pack.quantity
              });
            } else {
              console.warn('⚠️ Skipping item with 0 quantity:', {
                pack_no: pack.pack_no,
                product_name: item.product_name
              });
            }
          });
        });

        console.log('📋 Pack groups for order', order.order_no, ':', 
          Object.entries(packGroups).map(([k, v]: [string, any]) => ({
            pack_no: k,
            items_count: v.items.length,
            items: v.items.map((i: any) => ({ name: i.product_name, qty: i.quantity }))
          }))
        );

        packages.push(...Object.values(packGroups));
      });

      console.log('📦 Final packages to save:', packages.length, packages.map(p => ({
        order_no: p.order_no,
        pack_no: p.pack_no,
        items_count: p.items.length
      })));

      // Filter out packages with no items
      const validPackages = packages.filter(pkg => pkg.items && pkg.items.length > 0);
      
      if (validPackages.length !== packages.length) {
        console.warn('⚠️ Filtered out', packages.length - validPackages.length, 'packages with no items');
      }

      if (validPackages.length === 0) {
        setError('ไม่มีแพ็คที่มีสินค้า กรุณาตรวจสอบการกรอกข้อมูล');
        setSaving(false);
        return;
      }

      if (isEditMode && editId) {
        // อัพเดทข้อมูลเดิม
        const response = await fetch(`/api/bonus-face-sheets/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packages: validPackages })
        });

        const result = await response.json();

        if (result.success) {
          clearDraft();
          router.push('/receiving/picklists/bonus-face-sheets?success=updated');
        } else {
          setError(result.error || 'ไม่สามารถอัพเดทใบปะหน้าได้');
        }
      } else {
        // สร้างใหม่
        const response = await fetch('/api/bonus-face-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouse_id: 'WH001',
            created_by: 'System',
            delivery_date: deliveryDate,
            packages: validPackages
          })
        });

        const result = await response.json();

        if (result.success) {
          clearDraft();
          router.push('/receiving/picklists/bonus-face-sheets?success=created');
        } else {
          setError(result.error || 'ไม่สามารถสร้างใบปะหน้าได้');
        }
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1800px] mx-auto p-0">
        {/* Header */}
        <div className="px-6 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.back()}
                className="bg-white hover:bg-gray-50 border-gray-200 h-8"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs">ย้อนกลับ</span>
              </Button>
              <h1 className="text-lg font-bold text-gray-800 font-thai">
                กรอกข้อมูลแพ็คสินค้าของแถม
              </h1>
              <span className="text-xs text-gray-500">|</span>
              <span className="text-xs text-gray-600">
                วันส่งของ: <span className="font-semibold text-blue-600">{deliveryDate}</span>
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-600">
                จำนวนออเดอร์: <span className="font-semibold text-blue-600">{orders.length}</span> ออเดอร์
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs text-red-700 font-thai">{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-2">
            <div className="flex items-start gap-1.5">
              <Package className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-700 text-xs leading-relaxed font-thai">
                <span className="font-semibold">คำแนะนำ:</span> กรอก &quot;แพ็คที่&quot; (เช่น 1,2,3) ถ้าแยกหลายแพ็ค ให้กรอก &quot;จำนวนต่อแพ็ค&quot; ให้รวมเท่ากับจำนวนทั้งหมด
              </p>
            </div>
          </div>
        </div>

        {/* Cumulative Sum Floating Circle (follows cursor) */}
        {cumulativeTooltip.visible && (
          <div
            className="fixed z-50 pointer-events-none transition-all duration-75 ease-out"
            style={{
              left: cumulativeTooltip.x + 18,
              top: cumulativeTooltip.y - 18,
            }}
          >
            <div className="bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center font-bold"
              style={{ width: 44, height: 44 }}
            >
              <div className="text-center leading-none">
                <div className="text-[9px] font-normal opacity-80">P{cumulativeTooltip.packNo}</div>
                <div className="text-sm">{cumulativeTooltip.sum}</div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="mx-6 bg-white rounded-lg shadow border border-gray-200 overflow-hidden" style={{ height: '74vh' }}>
          <div className="overflow-x-auto overflow-y-auto h-full">
            <table className="w-full border-collapse" style={{ minWidth: '1600px', fontSize: '0.8125rem' }}>
              <thead className="bg-blue-50/50 border-b-2 border-blue-200 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '40px' }}>#</th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '160px' }}>ชื่อร้านค้า</th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '130px' }}>รหัสสินค้า</th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '280px' }}>ชื่อสินค้า</th>
                  <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '60px' }}>จำนวน</th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '130px' }}>เลขที่ใบสั่งส่ง</th>
                  <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '60px' }}>คันที่</th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '200px' }}>หมายเหตุ</th>
                  <th className="px-2 py-1.5 text-center text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '80px' }}>
                    จำนวนมากสุด<br/>ต่อแพ็ค
                  </th>
                  <th data-pack-column className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '160px' }}>
                    แพ็คที่ <span className="text-red-500">*</span>
                  </th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '150px' }}>ประเภทจัดส่ง</th>
                  <th className="px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 whitespace-nowrap" style={{ width: '180px' }}>จำนวนต่อแพ็ค</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
              {orders.map((order, orderIdx) =>
                order.items.map((item, itemIdx) => {
                  const key = `${order.order_id}-${item.order_item_id}`;
                  const itemData = packData[order.order_id]?.[item.order_item_id];
                  const inputValue = inputValues[key] || '';
                  const isValid = itemData?.packs.length === 1 || itemData?.totalQty === item.quantity;
                  const globalIdx = orders.slice(0, orderIdx).reduce((sum, o) => sum + o.items.length, 0) + itemIdx + 1;

                  return (
                    <tr
                      key={`${order.order_id}-${item.order_item_id}`}
                      className={`hover:bg-blue-50 transition-colors ${globalIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-2 py-1.5 text-xs text-gray-600 text-center">{globalIdx}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-900 font-medium">{order.shop_name}</td>
                      <td className="px-2 py-1.5 text-xs font-mono text-blue-600">{item.product_code || '-'}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-800">{item.product_name}</td>
                      <td className="px-2 py-1.5 text-xs text-center font-semibold text-blue-600">{item.quantity}</td>
                      <td className="px-2 py-1.5 text-xs font-mono text-gray-700">{order.order_no}</td>
                      <td className="px-2 py-1.5 text-xs text-center text-gray-700">{order.trip_number || '-'}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-700">
                        {order.notes_additional ? (
                          <span className="text-gray-800" title={order.notes_additional}>{order.notes_additional}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {(() => {
                          const maxQty = getMaxQtyPerPack(item.product_code);
                          return maxQty ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                              {maxQty}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          );
                        })()}
                      </td>
                      <td data-pack-column className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            data-pack-input
                            value={inputValue}
                            onChange={(e) => handlePackNoChange(order.order_id, item.order_item_id, e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePackInputClick(e, inputValue);
                            }}
                            placeholder="เช่น 1,2,3"
                            className="flex-1 px-1.5 py-1 bg-white border border-gray-300 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              if (input) {
                                const start = input.selectionStart || input.value.length;
                                const end = input.selectionEnd || input.value.length;
                                const newValue = input.value.substring(0, start) + ',' + input.value.substring(end);
                                handlePackNoChange(order.order_id, item.order_item_id, newValue);
                                setTimeout(() => {
                                  input.focus();
                                  input.setSelectionRange(start + 1, start + 1);
                                }, 0);
                              }
                            }}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded text-xs font-mono cursor-pointer transition-colors"
                            title="เพิ่มเครื่องหมายจุลภาค"
                          >
                            ,
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="w-full px-1.5 py-1 bg-white border border-gray-300 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          value={deliveryTypes[key] || ''}
                          onChange={(e) => handleDeliveryTypeChange(order.order_id, item.order_item_id, e.target.value)}
                        >
                          <option value="">-- เลือก --</option>
                          <option value="จัดส่งพร้อมออเดอร์">พร้อมออเดอร์</option>
                          <option value="จัดส่งลงออฟฟิศ">ลงออฟฟิศ</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        {itemData && itemData.packs.length > 1 ? (
                          <div className="space-y-0.5">
                            {itemData.packs.map((pack, packIdx) => (
                              <div key={`${order.order_id}-${item.order_item_id}-${packIdx}`} className="flex items-center gap-1">
                                <span className="text-[10px] text-blue-600 font-medium w-8">P{pack.pack_no}:</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={pack.quantity}
                                  onChange={(e) =>
                                    handlePackQtyChange(
                                      order.order_id,
                                      item.order_item_id,
                                      pack.pack_no,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-14 px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            ))}
                            <div className={`text-[10px] font-semibold pt-0.5 border-t ${isValid ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}>
                              รวม: {itemData.totalQty}/{item.quantity}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{item.quantity} ชิ้น</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mx-6 mt-4 flex justify-end gap-3 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <Button variant="outline" onClick={() => router.back()} disabled={saving}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                บันทึกและสร้างใบปะหน้า
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

function BonusFaceSheetPackFormPageWrapper() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    }>
      <BonusFaceSheetPackFormPage />
    </Suspense>
  );
}

export default BonusFaceSheetPackFormPageWrapper;
