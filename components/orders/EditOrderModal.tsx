'use client';
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Save, X, Package, Calendar, MapPin, FileText, Truck, Trash2, Plus } from 'lucide-react';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}

interface OrderItem {
  order_item_id?: string;
  sku_id: string;
  sku_name?: string;
  order_qty: number;
  order_weight?: number;
  pack_all?: number;
  pack_12_bags?: number;
  pack_4?: number;
  pack_6?: number;
  pack_2?: number;
  pack_1?: number;
  picked_qty?: number;
}

interface OrderData {
  order_id: string;
  order_no: string;
  order_type: string;
  customer_id: string;
  shop_name?: string;
  province?: string;
  order_date: string;
  delivery_date: string;
  status: string;
  text_field_long_1?: string; // ที่อยู่จัดส่ง
  text_field_additional_4?: string; // คำแนะนำการจัดส่ง
  total_qty?: number;
  total_weight?: number;
  items?: OrderItem[];
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({ isOpen, onClose, orderId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [formData, setFormData] = useState<Partial<OrderData>>({});
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);

  // Fetch order data when modal opens
  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderData();
    }
  }, [isOpen, orderId]);

  const fetchOrderData = async () => {
    setLoading(true);
    try {
      // Fetch order with items - fetch all orders first, then filter
      const response = await fetch(`/api/orders/with-items`);
      const result = await response.json();

      if (result.error) {
        console.error('Error from API:', result.error);
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        setLoading(false);
        return;
      }

      // Find the specific order by order_id (convert to number for comparison)
      const orderIdNum = parseInt(orderId);
      const order = result.data?.find((o: any) => o.order_id === orderIdNum);

      if (order) {
        console.log('Order found:', order);
        setOrderData(order);
        setEditableItems(order.items || []);
        setFormData({
          order_type: order.order_type,
          customer_id: order.customer_id,
          shop_name: order.shop_name,
          province: order.province,
          order_date: order.order_date,
          delivery_date: order.delivery_date,
          status: order.status,
          text_field_long_1: order.text_field_long_1 || '',
          text_field_additional_4: order.text_field_additional_4 || '',
        });
      } else {
        console.error('Order not found with ID:', orderId);
        alert('ไม่พบข้อมูลออเดอร์');
        onClose();
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!orderData) return;

    // Validate items
    const hasEmptyItems = editableItems.some(item => !item.sku_id || item.order_qty <= 0);
    if (hasEmptyItems) {
      alert('กรุณากรอกข้อมูลสินค้าให้ครบถ้วน (SKU และจำนวนต้องมีค่า)');
      return;
    }

    setSaving(true);
    try {
      // Use PUT method to update both order and items
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          items: editableItems.map(item => ({
            sku_id: item.sku_id,
            ordered_qty: item.order_qty,
            unit_price: 0, // Set default or calculate if needed
            picked_qty: item.picked_qty || 0,
            shipped_qty: item.picked_qty || 0
          }))
        }),
      });

      const result = await response.json();

      if (result.error) {
        alert(`เกิดข้อผิดพลาด: ${result.error}`);
        return;
      }

      alert('บันทึกข้อมูลสำเร็จ');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof OrderData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle item quantity change
  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const updatedItems = [...editableItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: field === 'order_qty' || field === 'order_weight' ? parseFloat(value) || 0 : value
    };
    setEditableItems(updatedItems);
  };

  // Delete item
  const handleDeleteItem = (index: number) => {
    if (confirm('ต้องการลบรายการสินค้านี้หรือไม่?')) {
      const updatedItems = editableItems.filter((_, i) => i !== index);
      setEditableItems(updatedItems);
    }
  };

  // Add new item
  const handleAddItem = () => {
    const newItem: OrderItem = {
      sku_id: '',
      sku_name: '',
      order_qty: 0,
      order_weight: 0,
      picked_qty: 0
    };
    setEditableItems([...editableItems, newItem]);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="แก้ไขคำสั่งซื้อ" size="xl">
      <div className="space-y-4">
        {/* Order Info */}
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
          <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-thai">
              {orderData?.order_no || 'กำลังโหลด...'}
            </h3>
            <p className="text-sm text-gray-600 font-thai">
              {orderData?.shop_name || '-'}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-thai">กำลังโหลดข้อมูล...</p>
          </div>
        ) : orderData ? (
          <>
            {/* Form Content */}
            <div className="space-y-4">
              {/* Order Type & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 font-thai mb-1">
                    ประเภทคำสั่งซื้อ
                  </label>
                  <select
                    value={formData.order_type || ''}
                    onChange={(e) => handleInputChange('order_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="route_planning">จัดเส้นทาง</option>
                    <option value="express">ส่งรายชิ้น</option>
                    <option value="special">สินค้าพิเศษ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 font-thai mb-1">
                    สถานะ
                  </label>
                  <select
                    value={formData.status || ''}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="draft">ร่าง</option>
                    <option value="confirmed">ยืนยันแล้ว</option>
                    <option value="in_picking">กำลังหยิบ</option>
                    <option value="picked">หยิบเสร็จแล้ว</option>
                    <option value="loaded">ขึ้นรถแล้ว</option>
                    <option value="in_transit">กำลังจัดส่ง</option>
                    <option value="delivered">ส่งถึงแล้ว</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 font-thai mb-1">
                    รหัสลูกค้า
                  </label>
                  <input
                    type="text"
                    value={formData.customer_id || ''}
                    onChange={(e) => handleInputChange('customer_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 font-thai mb-1">
                    ชื่อลูกค้า/ร้าน
                  </label>
                  <input
                    type="text"
                    value={formData.shop_name || ''}
                    onChange={(e) => handleInputChange('shop_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Province */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 font-thai mb-1">
                  จังหวัด
                </label>
                <input
                  type="text"
                  value={formData.province || ''}
                  onChange={(e) => handleInputChange('province', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 font-thai mb-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    วันที่สั่ง
                  </label>
                  <input
                    type="date"
                    value={formData.order_date || ''}
                    onChange={(e) => handleInputChange('order_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 font-thai mb-1 flex items-center">
                    <Truck className="w-4 h-4 mr-1" />
                    วันที่แผนส่ง
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date || ''}
                    onChange={(e) => handleInputChange('delivery_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 font-thai mb-1 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  ที่อยู่จัดส่ง
                </label>
                <textarea
                  value={formData.text_field_long_1 || ''}
                  onChange={(e) => handleInputChange('text_field_long_1', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="กรอกที่อยู่จัดส่ง..."
                />
              </div>

              {/* Delivery Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 font-thai mb-1 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  คำแนะนำการจัดส่ง / หมายเหตุ
                </label>
                <textarea
                  value={formData.text_field_additional_4 || ''}
                  onChange={(e) => handleInputChange('text_field_additional_4', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-thai
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="กรอกคำแนะนำการจัดส่งหรือหมายเหตุ..."
                />
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 font-thai mb-3">
                  สรุปคำสั่งซื้อ
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-thai">จำนวนรายการ</p>
                    <p className="text-gray-900 font-mono font-semibold">{orderData.items?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-thai">จำนวนรวม</p>
                    <p className="text-gray-900 font-mono font-semibold">{orderData.total_qty || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-thai">น้ำหนักรวม (กก.)</p>
                    <p className="text-gray-900 font-mono font-semibold">{orderData.total_weight || 0}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 font-thai">
                    รายการสินค้า ({editableItems.length} รายการ)
                  </h4>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-thai transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>เพิ่มรายการ</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 font-thai">SKU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 font-thai">ชื่อสินค้า</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">จำนวนสั่ง</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">น้ำหนัก</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">หยิบแล้ว</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 font-thai">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {editableItems.map((item, index) => (
                        <tr key={item.order_item_id || index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.sku_id}
                              onChange={(e) => handleItemChange(index, 'sku_id', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.sku_name || ''}
                              onChange={(e) => handleItemChange(index, 'sku_name', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-thai
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.order_qty}
                              onChange={(e) => handleItemChange(index, 'order_qty', e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-xs font-mono text-center
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.order_weight || 0}
                              onChange={(e) => handleItemChange(index, 'order_weight', e.target.value)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-xs font-mono text-center
                                       focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-center text-gray-900 font-mono text-xs">
                            <span className={item.picked_qty === item.order_qty ? 'text-green-600 font-semibold' : ''}>
                              {item.picked_qty || 0}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteItem(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {editableItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm font-thai">
                            ไม่มีรายการสินค้า - กดปุ่ม "เพิ่มรายการ" เพื่อเพิ่มสินค้า
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                icon={Save}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <p className="text-sm font-thai">ไม่พบข้อมูล</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EditOrderModal;
