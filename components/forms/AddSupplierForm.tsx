'use client';

import React, { useState } from 'react';
import { Save, X, AlertCircle, Building, User, Mail, Phone, Star, CreditCard } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CreateSupplierRequest } from '@/types/supplier';

interface AddSupplierFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<CreateSupplierRequest>;
}

const AddSupplierForm: React.FC<AddSupplierFormProps> = ({ onSuccess, onCancel, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateSupplierRequest>({
    supplier_id: initialData?.supplier_id || '',
    supplier_code: initialData?.supplier_code || '',
    supplier_name: initialData?.supplier_name || '',
    supplier_type: initialData?.supplier_type || 'vendor',
    business_reg_no: initialData?.business_reg_no || '',
    tax_id: initialData?.tax_id || '',
    contact_person: initialData?.contact_person || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    website: initialData?.website || '',
    billing_address: initialData?.billing_address || '',
    shipping_address: initialData?.shipping_address || '',
    payment_terms: initialData?.payment_terms || '',
    service_category: initialData?.service_category || '',
    product_category: initialData?.product_category || '',
    rating: initialData?.rating || 0,
    status: initialData?.status || 'active',
    created_by: initialData?.created_by || 'admin@austamgood.com', // TODO: Get from auth context
    remarks: initialData?.remarks || ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const generateSupplierId = () => {
    const prefix = formData.supplier_type === 'vendor' ? 'VND' : 
                   formData.supplier_type === 'service_provider' ? 'SVC' : 'BTH';
    const timestamp = Date.now().toString().slice(-6);
    return `SUP${timestamp}`;
  };

  const generateSupplierCode = () => {
    const prefix = formData.supplier_type === 'vendor' ? 'VND' : 
                   formData.supplier_type === 'service_provider' ? 'SVC' : 'BTH';
    const timestamp = Date.now().toString().slice(-3);
    return `${prefix}${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Auto-generate IDs if not provided
      const submitData = {
        ...formData,
        supplier_id: formData.supplier_id || generateSupplierId(),
        supplier_code: formData.supplier_code || generateSupplierCode(),
      };

      // Validate required fields
      if (!submitData.supplier_id || !submitData.supplier_code || !submitData.supplier_name || !submitData.created_by) {
        throw new Error('กรุณากรอกข้อมูลที่จำเป็น: ชื่อผู้จำหน่าย');
      }

      const response = await fetch('/api/master-supplier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'เกิดข้อผิดพลาดในการเพิ่มผู้จำหน่าย');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเพิ่มผู้จำหน่าย');
    } finally {
      setLoading(false);
    }
  };

  const copyBillingToShipping = () => {
    setFormData(prev => ({
      ...prev,
      shipping_address: prev.billing_address
    }));
  };

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-thai text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-thai-gray-900 font-thai flex items-center">
            <Building className="w-5 h-5 mr-2 text-primary-600" />
            ข้อมูลพื้นฐาน
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                รหัสผู้จำหน่าย
              </label>
              <input
                type="text"
                name="supplier_code"
                value={formData.supplier_code}
                onChange={handleInputChange}
                placeholder="ระบบจะสร้างให้อัตโนมัติ"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ชื่อผู้จำหน่าย <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="supplier_name"
                value={formData.supplier_name}
                onChange={handleInputChange}
                placeholder="เช่น บริษัท ผลิตภัณฑ์อุตสาหกรรม จำกัด"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ประเภทผู้จำหน่าย
              </label>
              <select
                name="supplier_type"
                value={formData.supplier_type}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              >
                <option value="vendor">ผู้จำหน่าย</option>
                <option value="service_provider">ผู้ให้บริการ</option>
                <option value="both">ทั้งสองอย่าง</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                สถานะ
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              >
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เลขที่นิติบุคคล
              </label>
              <input
                type="text"
                name="business_reg_no"
                value={formData.business_reg_no}
                onChange={handleInputChange}
                placeholder="เช่น 0105558123456"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เลขที่ผู้เสียภาษี
              </label>
              <input
                type="text"
                name="tax_id"
                value={formData.tax_id}
                onChange={handleInputChange}
                placeholder="เช่น 0105558123456"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-thai-gray-900 font-thai flex items-center">
            <User className="w-5 h-5 mr-2 text-primary-600" />
            ข้อมูลการติดต่อ
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                ผู้ติดต่อ
              </label>
              <input
                type="text"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleInputChange}
                placeholder="ชื่อผู้ติดต่อ"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เบอร์โทรศัพท์
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="เช่น 02-345-6789"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                อีเมล
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="เช่น contact@company.com"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เว็บไซต์
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="เช่น https://www.company.com"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-thai-gray-900 font-thai">
            ข้อมูลที่อยู่
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
              ที่อยู่สำหรับออกบิล
            </label>
            <textarea
              name="billing_address"
              value={formData.billing_address}
              onChange={handleInputChange}
              placeholder="ระบุที่อยู่สำหรับออกบิล"
              rows={3}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                font-thai text-sm resize-none
              "
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-thai-gray-700 font-thai">
                ที่อยู่สำหรับจัดส่ง
              </label>
              <button
                type="button"
                onClick={copyBillingToShipping}
                className="text-sm text-primary-600 hover:text-primary-700 font-thai"
              >
                คัดลอกจากที่อยู่บิล
              </button>
            </div>
            <textarea
              name="shipping_address"
              value={formData.shipping_address}
              onChange={handleInputChange}
              placeholder="ระบุที่อยู่สำหรับจัดส่ง"
              rows={3}
              className="
                w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                font-thai text-sm resize-none
              "
            />
          </div>
        </div>

        {/* Business Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-thai-gray-900 font-thai flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-primary-600" />
            ข้อมูลทางธุรกิจ
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                เงื่อนไขการชำระเงิน
              </label>
              <input
                type="text"
                name="payment_terms"
                value={formData.payment_terms}
                onChange={handleInputChange}
                placeholder="เช่น 30 วัน, เงินสด"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                คะแนนประเมิน (1-5)
              </label>
              <input
                type="number"
                name="rating"
                value={formData.rating}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
                max="5"
                step="0.1"
                className="
                  w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                  font-thai text-sm
                "
              />
            </div>

            {(formData.supplier_type === 'vendor' || formData.supplier_type === 'both') && (
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  หมวดหมู่สินค้า
                </label>
                <input
                  type="text"
                  name="product_category"
                  value={formData.product_category}
                  onChange={handleInputChange}
                  placeholder="เช่น วัตถุดิบอุตสาหกรรม, อุปกรณ์อิเล็กทรอนิกส์"
                  className="
                    w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    font-thai text-sm
                  "
                />
              </div>
            )}

            {(formData.supplier_type === 'service_provider' || formData.supplier_type === 'both') && (
              <div>
                <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
                  หมวดหมู่บริการ
                </label>
                <input
                  type="text"
                  name="service_category"
                  value={formData.service_category}
                  onChange={handleInputChange}
                  placeholder="เช่น ขนส่งและโลจิสติกส์, ผลิตและประกอบ"
                  className="
                    w-full px-3 py-2 border border-thai-gray-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    font-thai text-sm
                  "
                />
              </div>
            )}
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium text-thai-gray-700 font-thai mb-2">
            หมายเหตุ
          </label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleInputChange}
            placeholder="หมายเหตุเพิ่มเติม"
            rows={3}
            className="
              w-full px-3 py-2 border border-thai-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              font-thai text-sm resize-none
            "
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-thai-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            icon={X}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={Save}
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddSupplierForm;