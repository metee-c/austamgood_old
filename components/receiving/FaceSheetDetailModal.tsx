'use client';

import React, { useState } from 'react';
import { X, Package, ShoppingBag, Warehouse, MapPin, Phone, User, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface FaceSheetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  faceSheet?: any;
  details?: any;
  loading?: boolean;
}

const FaceSheetDetailModal: React.FC<FaceSheetDetailModalProps> = ({
  isOpen,
  onClose,
  faceSheet,
  details,
  loading
}) => {
  const [expandedPackages, setExpandedPackages] = useState<Set<number>>(new Set());
  const data = faceSheet || details;

  if (!isOpen) return null;

  const togglePackage = (packageId: number) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(packageId)) {
      newExpanded.delete(packageId);
    } else {
      newExpanded.add(packageId);
    }
    setExpandedPackages(newExpanded);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600 font-thai">กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const packages = data.packages || [];
  const smallPackages = packages.filter((pkg: any) => pkg.size_category === 'small');
  const largePackages = packages.filter((pkg: any) => pkg.size_category === 'large');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold font-thai">รายละเอียดใบปะหน้าสินค้า</h2>
              <p className="text-sm text-blue-100 font-mono">{data.face_sheet_no}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center space-x-2 text-blue-600 mb-2">
                <Package className="w-4 h-4" />
                <label className="text-xs font-semibold font-thai">แพ็คทั้งหมด</label>
              </div>
              <p className="text-2xl font-bold text-blue-900">{data.total_packages || 0}</p>
              <p className="text-xs text-blue-600 mt-1 font-thai">
                เล็ก: {data.small_size_count || 0} | ใหญ่: {data.large_size_count || 0}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center space-x-2 text-green-600 mb-2">
                <ShoppingBag className="w-4 h-4" />
                <label className="text-xs font-semibold font-thai">จำนวนชิ้น</label>
              </div>
              <p className="text-2xl font-bold text-green-900">{data.total_items || 0}</p>
              <p className="text-xs text-green-600 mt-1 font-thai">ชิ้น</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center space-x-2 text-purple-600 mb-2">
                <FileText className="w-4 h-4" />
                <label className="text-xs font-semibold font-thai">ออเดอร์</label>
              </div>
              <p className="text-2xl font-bold text-purple-900">{data.total_orders || 0}</p>
              <p className="text-xs text-purple-600 mt-1 font-thai">รายการ</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center space-x-2 text-orange-600 mb-2">
                <Warehouse className="w-4 h-4" />
                <label className="text-xs font-semibold font-thai">สถานะ</label>
              </div>
              <p className="text-lg font-bold text-orange-900 capitalize">{data.status || 'N/A'}</p>
              <p className="text-xs text-orange-600 mt-1 font-thai">
                {new Date(data.created_date).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>

          {/* Packages Section */}
          {packages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 font-thai flex items-center space-x-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span>รายการแพ็คเกจ ({packages.length} แพ็ค)</span>
                </h3>
                <div className="flex items-center space-x-4 text-sm font-thai">
                  <span className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-green-400 rounded"></div>
                    <span className="text-gray-600">เล็ก: {smallPackages.length}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <div className="w-3 h-3 bg-orange-400 rounded"></div>
                    <span className="text-gray-600">ใหญ่: {largePackages.length}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {packages.map((pkg: any) => {
                  const isExpanded = expandedPackages.has(pkg.id);
                  const isSmall = pkg.size_category === 'small';
                  const productItems = pkg.product_items || [];

                  return (
                    <div
                      key={pkg.id}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        isSmall
                          ? 'border-green-200 bg-green-50'
                          : 'border-orange-200 bg-orange-50'
                      }`}
                    >
                      {/* Package Header */}
                      <div
                        className={`px-4 py-3 cursor-pointer hover:bg-opacity-80 transition-colors ${
                          isSmall ? 'bg-green-100' : 'bg-orange-100'
                        }`}
                        onClick={() => togglePackage(pkg.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isSmall ? 'bg-green-200 text-green-700' : 'bg-orange-200 text-orange-700'
                            }`}>
                              <span className="font-bold text-sm">#{pkg.package_number}</span>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <p className="text-xs text-gray-500 font-thai">ร้านค้า</p>
                                <p className="font-semibold text-sm font-thai">{pkg.shop_name}</p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500 font-thai">ประเภท</p>
                                <p className="font-semibold text-sm font-thai">{pkg.package_type}</p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-500 font-thai">จำนวน</p>
                                <p className="font-semibold text-sm">
                                  {pkg.pieces_per_pack} ชิ้น ({pkg.size} kg)
                                </p>
                              </div>
                            </div>
                          </div>

                          <button className="ml-4 p-1">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-600" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Package Details (Expanded) */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-white space-y-3 border-t">
                          {/* Product Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <div className="flex items-start space-x-2">
                                <ShoppingBag className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 font-thai">สินค้า</p>
                                  <p className="font-medium text-sm font-thai">{pkg.product_name}</p>
                                  <p className="text-xs text-gray-500 font-mono">{pkg.product_code}</p>
                                </div>
                              </div>

                              <div className="flex items-start space-x-2">
                                <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 font-thai">บาร์โค้ด</p>
                                  <p className="font-mono text-sm font-semibold text-blue-600">{pkg.barcode_id}</p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-start space-x-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 font-thai">ที่อยู่</p>
                                  <p className="text-sm font-thai">{pkg.address || '-'}</p>
                                  <p className="text-xs text-gray-500 font-thai">{pkg.province}</p>
                                </div>
                              </div>

                              <div className="flex items-start space-x-2">
                                <User className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 font-thai">ผู้รับ</p>
                                  <p className="text-sm font-thai">{pkg.contact_name || '-'}</p>
                                  {pkg.phone && (
                                    <p className="text-xs text-gray-500 flex items-center space-x-1">
                                      <Phone className="w-3 h-3" />
                                      <span className="font-mono">{pkg.phone}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Product Items Breakdown */}
                          {productItems.length > 0 && (
                            <div className="border-t pt-3">
                              <p className="text-xs font-semibold text-gray-700 mb-2 font-thai">
                                รายการสินค้าในแพ็ค:
                              </p>
                              <div className="space-y-1">
                                {productItems.map((item: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs bg-gray-50 px-3 py-2 rounded"
                                  >
                                    <div className="flex-1">
                                      <span className="font-medium font-thai">{item.product_name}</span>
                                      <span className="text-gray-500 ml-2 font-mono">({item.product_code})</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-semibold text-blue-600">
                                        {item.quantity} ชิ้น
                                      </span>
                                      <span className="text-gray-500 ml-2">
                                        × {item.size} kg
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Hub & Notes */}
                          {(pkg.hub || pkg.notes) && (
                            <div className="border-t pt-3 space-y-2">
                              {pkg.hub && (
                                <div>
                                  <p className="text-xs text-gray-500 font-thai">Hub</p>
                                  <p className="text-sm font-semibold text-purple-600 font-thai">{pkg.hub}</p>
                                </div>
                              )}
                              {pkg.notes && (
                                <div>
                                  <p className="text-xs text-gray-500 font-thai">หมายเหตุ</p>
                                  <p className="text-sm text-gray-700 font-thai">{pkg.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {packages.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-3 text-gray-300" />
              <p className="font-thai">ไม่พบข้อมูลแพ็คเกจ</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
          <div className="text-sm text-gray-600 font-thai">
            สร้างเมื่อ: {new Date(data.created_date).toLocaleString('th-TH')}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-thai"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceSheetDetailModal;
