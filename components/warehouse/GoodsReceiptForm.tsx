'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, AlertCircle, Package, Truck } from 'lucide-react';
import Button from '@/components/ui/Button';
import ComboBox from '@/components/ui/ComboBox';
import { 
  CreateReceiptRequest,
  CreateReceiptLineRequest, 
  ReceiptType,
  RECEIPT_TYPES,
  validateCreateReceipt 
} from '@/types/inbound-schema';

interface GoodsReceiptFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  warehouseOptions?: Array<{ value: string; label: string }>;
  supplierOptions?: Array<{ value: string; label: string }>;
  employeeOptions?: Array<{ value: number; label: string }>;
  skuOptions?: Array<{ value: string; label: string }>;
  locationOptions?: Array<{ value: string; label: string }>;
}

interface ReceiptLineFormData extends CreateReceiptLineRequest {
  id: string; // Temporary ID for form management
}

const GoodsReceiptForm: React.FC<GoodsReceiptFormProps> = ({
  onSuccess,
  onCancel,
  warehouseOptions = [],
  supplierOptions = [],
  employeeOptions = [],
  skuOptions = [],
  locationOptions = []
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CreateReceiptRequest, 'items'>>({
    receipt_no: '',
    receipt_date: '',
    receipt_type: 'ซื้อ',
    warehouse_id: '',
    supplier_id: '',
    received_by: undefined,
    po_no: '',
    invoice_no: '',
    remarks: ''
  });

  const [lines, setLines] = useState<ReceiptLineFormData[]>([
    {
      id: '1',
      sku_id: '',
      quantity: 0,
      unit_cost: undefined,
      location_id: undefined,
      lot_no: undefined,
      expiry_date: undefined,
      remarks: undefined
    }
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? undefined : value
    }));
  };

  const handleReceiptTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ReceiptType;
    setFormData(prev => ({
      ...prev,
      receipt_type: newType,
      // Clear supplier for return type  
      supplier_id: newType === 'ส่งคืน' ? undefined : prev.supplier_id
    }));
  };

  const handleLineChange = (lineId: string, field: keyof ReceiptLineFormData, value: any) => {
    setLines(prev => prev.map(line => 
      line.id === lineId 
        ? { ...line, [field]: value === '' ? undefined : value }
        : line
    ));
  };

  const addLine = () => {
    const newLine: ReceiptLineFormData = {
      id: Date.now().toString(),
      sku_id: '',
      quantity: 0,
      unit_cost: undefined,
      location_id: undefined,
      lot_no: undefined,
      expiry_date: undefined,
      remarks: undefined
    };
    setLines(prev => [...prev, newLine]);
  };

  const removeLine = (lineId: string) => {
    if (lines.length > 1) {
      setLines(prev => prev.filter(line => line.id !== lineId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Prepare request data
      const requestData: CreateReceiptRequest = {
        ...formData,
        items: lines.map(({ id, ...line }) => line)
      };

      // Validate data
      const validatedData = validateCreateReceipt(requestData);

      // TODO: Call API to create receipt
      console.log('Creating receipt:', validatedData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('เกิดข้อผิดพลาดในการสร้างใบรับสินค้า');
      }
    } finally {
      setLoading(false);
    }
  };

  const isSupplierRequired = formData.receipt_type !== 'ปรับ';
  const isPalletGenerationVisible = formData.receipt_type !== 'ปรับ';

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm font-thai">{error}</p>
          </div>
        )}

        {/* Receipt Header */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <Package className="w-5 h-5 text-blue-500" />
            <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">ข้อมูลการรับสินค้า</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                ประเภทการรับ <span className="text-red-500">*</span>
              </label>
              <select
                name="receipt_type"
                value={formData.receipt_type}
                onChange={handleReceiptTypeChange}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                "
                required
              >
                {RECEIPT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                คลังสินค้า <span className="text-red-500">*</span>
              </label>
              <ComboBox
                name="warehouse_id"
                value={formData.warehouse_id || ''}
                onChange={handleInputChange}
                options={warehouseOptions}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                "
                placeholder="เลือกคลังสินค้า"
                required
              />
            </div>

            {isSupplierRequired && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                  ผู้จำหน่าย <span className="text-red-500">*</span>
                </label>
                <ComboBox
                  name="supplier_id"
                  value={formData.supplier_id || ''}
                  onChange={handleInputChange}
                  options={supplierOptions}
                  className="
                    w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                    text-sm font-thai transition-all duration-200
                  "
                  placeholder="เลือกผู้จำหน่าย"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                ผู้รับสินค้า
              </label>
              <ComboBox
                name="received_by"
                value={formData.received_by?.toString() || ''}
                onChange={handleInputChange}
                options={employeeOptions.map(emp => ({ value: emp.value.toString(), label: emp.label }))}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                "
                placeholder="เลือกผู้รับสินค้า"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                หมายเหตุ
              </label>
              <textarea
                name="remarks"
                value={formData.remarks || ''}
                onChange={handleInputChange}
                rows={3}
                className="
                  w-full px-4 py-3 bg-thai-gray-50 border border-thai-gray-200 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white
                  text-sm font-thai transition-all duration-200
                  placeholder:text-thai-gray-400 resize-none
                "
                placeholder="หมายเหตุเพิ่มเติม"
              />
            </div>
          </div>
        </div>

        {/* Receipt Lines */}
        <div className="bg-white border border-thai-gray-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Truck className="w-5 h-5 text-green-500" />
              <h4 className="text-lg font-semibold text-thai-gray-900 font-thai">รายการสินค้า</h4>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addLine}
              icon={Plus}
              size="sm"
            >
              เพิ่มรายการ
            </Button>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={line.id} className="border border-thai-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-thai-gray-800 font-thai">
                    รายการที่ {index + 1}
                  </h5>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                      สินค้า <span className="text-red-500">*</span>
                    </label>
                    <ComboBox
                      name={`sku_id_${line.id}`}
                      value={line.sku_id}
                      onChange={(e) => handleLineChange(line.id, 'sku_id', e.target.value)}
                      options={skuOptions}
                      className="
                        w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm font-thai
                      "
                      placeholder="เลือกสินค้า"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                      จำนวนที่รับ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => handleLineChange(line.id, 'quantity', Number(e.target.value))}
                      min="1"
                      className="
                        w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm font-thai
                      "
                      placeholder="จำนวน"
                      required
                    />
                  </div>


                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                      หมายเลข Lot
                    </label>
                    <input
                      type="text"
                      value={line.lot_no || ''}
                      onChange={(e) => handleLineChange(line.id, 'lot_no', e.target.value)}
                      className="
                        w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm font-thai
                      "
                      placeholder="LOT001"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                      วันหมดอายุ
                    </label>
                    <input
                      type="date"
                      value={line.expiry_date || ''}
                      onChange={(e) => handleLineChange(line.id, 'expiry_date', e.target.value)}
                      className="
                        w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm font-thai
                      "
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                      Location รับ <span className="text-red-500">*</span>
                    </label>
                    <ComboBox
                      name={`receiving_location_id_${line.id}`}
                      value={line.location_id || ''}
                      onChange={(e) => handleLineChange(line.id, 'location_id', e.target.value)}
                      options={locationOptions}
                      className="
                        w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm font-thai
                      "
                      placeholder="เลือก Location"
                      required
                    />
                  </div>

                  {isPalletGenerationVisible && (
                    <>


                    </>
                  )}

                  <div className="md:col-span-3 space-y-2">
                    <label className="block text-xs font-semibold text-thai-gray-600 uppercase tracking-wider font-thai">
                      หมายเหตุรายการ
                    </label>
                    <input
                      type="text"
                      value={line.remarks || ''}
                      onChange={(e) => handleLineChange(line.id, 'remarks', e.target.value)}
                      className="
                        w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm font-thai
                      "
                      placeholder="หมายเหตุสำหรับรายการนี้"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-thai-gray-50 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              icon={X}
              className="sm:order-1"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={Save}
              className="sm:order-2 shadow-lg"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกการรับสินค้า'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default GoodsReceiptForm;