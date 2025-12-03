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
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

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
        console.log('Loaded face sheet:', faceSheet);
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
            if (existingItem) {
              existingItem.quantity += item.quantity;
            } else {
              order.items.push({
                order_item_id: item.order_item_id,
                product_code: item.product_code,
                product_name: item.product_name,
                quantity: item.quantity,
                weight: item.weight
              });
            }
          });
        });
        
        const reconstructedOrders = Array.from(ordersMap.values());
        setOrders(reconstructedOrders);
        
        // สร้าง packData และ inputValues จากข้อมูลเดิม
        const initialPackData: { [orderId: number]: ItemPackData } = {};
        const initialInputValues: { [key: string]: string } = {};
        
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
                  quantity: pkgItem?.quantity || 0
                };
              });
              
              initialPackData[order.order_id][item.order_item_id] = {
                packs,
                totalQty: packs.reduce((sum, p) => sum + p.quantity, 0)
              };
              
              initialInputValues[key] = packs.map(p => p.pack_no).filter(p => p).join(',');
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
      } else {
        setError(result.error || 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
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
        filteredOrders.forEach((order: Order) => {
          initialPackData[order.order_id] = {};
          order.items.forEach((item) => {
            const key = `${order.order_id}-${item.order_item_id}`;
            initialPackData[order.order_id][item.order_item_id] = {
              packs: [{ pack_no: '', quantity: item.quantity }],
              totalQty: item.quantity
            };
            initialInputValues[key] = '';
          });
        });
        setPackData(initialPackData);
        setInputValues(initialInputValues);
      } else {
        setError(result.error || 'ไม่สามารถโหลดข้อมูลได้');
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handlePackNoChange = (orderId: number, itemId: number, value: string) => {
    const key = `${orderId}-${itemId}`;
    
    // Update input value
    setInputValues(prev => ({ ...prev, [key]: value }));
    
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
        // Multiple packs - distribute evenly or keep existing
        const existingPacks = itemData.packs;
        itemData.packs = packNos.map((packNo) => {
          const existing = existingPacks.find(p => p.pack_no === packNo);
          return {
            pack_no: packNo,
            quantity: existing?.quantity || 0
          };
        });
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
          
          itemData.packs.forEach(pack => {
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
                delivery_type: order.delivery_type,
                sales_territory: order.sales_territory,
                trip_number: order.trip_number,
                pack_no: pack.pack_no,
                items: []
              };
            }

            packGroups[pack.pack_no].items.push({
              order_item_id: item.order_item_id,
              product_code: item.product_code,
              product_name: item.product_name,
              quantity: pack.quantity,
              weight: item.weight
            });
          });
        });

        packages.push(...Object.values(packGroups));
      });

      if (isEditMode && editId) {
        // อัพเดทข้อมูลเดิม
        const response = await fetch(`/api/bonus-face-sheets/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packages })
        });

        const result = await response.json();

        if (result.success) {
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
            packages
          })
        });

        const result = await response.json();

        if (result.success) {
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
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-thai-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0 pt-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              ย้อนกลับ
            </Button>
            <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">
              กรอกข้อมูลแพ็คสินค้าของแถม
            </h1>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-thai-gray-700 font-thai">
            วันส่งของ: <span className="font-semibold text-purple-600">{deliveryDate}</span> | 
            จำนวนออเดอร์: <span className="font-semibold text-purple-600">{orders.length}</span> ออเดอร์
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2 flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-sm text-red-700 font-thai">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 flex-shrink-0">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 shadow-sm flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📌</div>
          <div>
            <h3 className="font-semibold text-purple-900 mb-1 font-thai">หมายเหตุการกรอกข้อมูล</h3>
            <p className="text-purple-800 text-sm leading-relaxed font-thai">
              ระบบจะดึง &quot;เลขที่ใบสั่งส่ง&quot; และ &quot;จำนวน&quot; จากไฟล์ Excel โดยอัตโนมัติ 
              คุณกรอก &quot;แพ็คที่&quot; และ &quot;จำนวนต่อแพ็ค&quot; ให้บวกรวมเท่ากับจำนวนทั้งหมด
            </p>
          </div>
        </div>
      </div>

      {/* Single Combined Table */}
      <div className="flex-1 min-h-0">
        <div className="w-full h-full overflow-x-auto overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-sm">
          <table className="w-full border-collapse text-sm" style={{ minWidth: '1800px' }}>
            <thead className="sticky top-0 z-10 bg-gradient-to-r from-purple-50 to-blue-50 border-b-2 border-purple-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '50px' }}>#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '180px' }}>ชื่อร้านค้า</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '150px' }}>รหัสสินค้า</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '300px' }}>ชื่อสินค้า</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '80px' }}>จำนวน</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '140px' }}>เลขที่ใบสั่งส่ง</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '80px' }}>คันที่</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '180px' }}>
                  แพ็คที่ <span className="text-red-500">*</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '150px' }}>หมายเหตุ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '200px' }}>
                  ประเภทจัดส่ง <span className="text-red-500">*</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-thai-gray-700 border-b whitespace-nowrap" style={{ width: '200px' }}>
                  จำนวนต่อแพ็ค
                </th>
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
                    <tr key={`${order.order_id}-${item.order_item_id}`} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-4 py-2 text-sm text-thai-gray-600 text-center font-medium">{globalIdx}</td>
                      <td className="px-4 py-2 text-sm text-thai-gray-900 bg-purple-50/30 font-medium">{order.shop_name}</td>
                      <td className="px-4 py-2 text-sm font-mono text-purple-600">{item.product_code || '-'}</td>
                      <td className="px-4 py-2 text-sm text-thai-gray-800">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm text-center font-semibold text-purple-600 bg-purple-50/40">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm font-mono text-thai-gray-700 bg-thai-gray-50/50">{order.order_no}</td>
                      <td className="px-4 py-2 text-sm text-thai-gray-700 bg-amber-50/40">{order.trip_number || '-'}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => handlePackNoChange(order.order_id, item.order_item_id, e.target.value)}
                            placeholder="เช่น 1,2"
                            className="flex-1 px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300"
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
                            className="px-3 py-1 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg text-sm font-mono cursor-pointer transition-colors shadow-sm"
                            title="เพิ่มเครื่องหมายจุลภาค"
                          >
                            ,
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-thai-gray-700 bg-green-50/40">{order.delivery_type || '-'}</td>
                      <td className="px-4 py-2">
                        <select
                          className="w-full px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-white/80 text-sm font-thai transition-all duration-300"
                          defaultValue=""
                        >
                          <option value="">-- เลือกประเภทจัดส่ง --</option>
                          <option value="จัดส่งพร้อมออเดอร์">จัดส่งพร้อมออเดอร์</option>
                          <option value="จัดส่งลงออฟฟิศ">จัดส่งลงออฟฟิศ</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        {itemData && itemData.packs.length > 1 ? (
                          <div className="space-y-1">
                            {itemData.packs.map((pack, packIdx) => (
                              <div key={`${order.order_id}-${item.order_item_id}-${packIdx}`} className="flex items-center gap-1">
                                <span className="text-xs text-purple-600 font-medium w-12">P{pack.pack_no}:</span>
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
                                  className="w-16 px-1 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 text-xs font-thai transition-all"
                                />
                              </div>
                            ))}
                            <div className={`text-xs font-semibold pt-1 border-t ${isValid ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}>
                              รวม: {itemData.totalQty}/{item.quantity}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-thai-gray-600 bg-thai-gray-50/50 px-2 py-1 rounded-lg">{item.quantity} ชิ้น</div>
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
      <div className="flex justify-end gap-3 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl p-3 shadow-sm flex-shrink-0">
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          ยกเลิก
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="bg-purple-500 hover:bg-purple-600 shadow-lg"
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
      <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-thai-gray-600 font-thai">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    }>
      <BonusFaceSheetPackFormPage />
    </Suspense>
  );
}

export default BonusFaceSheetPackFormPageWrapper;
