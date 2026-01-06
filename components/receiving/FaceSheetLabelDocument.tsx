'use client';

import React from 'react';
import Barcode from 'react-barcode';

// Helper function: ดึงขนาด (กก.) จากชื่อสินค้า เช่น "Buzz Beyond แม่และลูกแมว | 7 กก." -> "7"
const extractSizeFromProductName = (productName: string | null | undefined): string | null => {
  if (!productName) return null;
  
  // Pattern: หาตัวเลขที่ตามด้วย "กก." หรือ "kg"
  const match = productName.match(/(\d+(?:\.\d+)?)\s*(?:กก\.|kg)/i);
  if (match) {
    return match[1];
  }
  return null;
};

interface PackageDetails {
  id: number;
  package_number: number;
  barcode_id: string;
  order_no: string;
  shop_name: string;
  product_code: string;
  product_name: string;
  size: string;
  size_category: string;
  package_type: string;
  pieces_per_pack: number;
  address: string;
  province: string;
  contact_name: string;
  phone: string;
  hub: string;
  notes?: string;
  product_items?: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    size: number;
  }>;
}

interface FaceSheetLabelDocumentProps {
  faceSheet?: any;
  details?: {
    face_sheet_no: string;
    status: string;
    created_date: string;
    total_packages: number;
    total_items: number;
    total_orders: number;
    small_size_count: number;
    large_size_count: number;
    packages: PackageDetails[];
  };
}

const FaceSheetLabelDocument: React.FC<FaceSheetLabelDocumentProps> = ({ faceSheet, details }) => {
  const data = faceSheet || details;

  if (!data || !data.packages || data.packages.length === 0) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Sarabun, sans-serif' }}>
        <p>ไม่พบข้อมูลแพ็คเกจ</p>
      </div>
    );
  }

  const packages = data.packages || [];

  return (
    <div style={{ fontFamily: 'Sarabun, Noto Sans Thai, sans-serif' }}>
      {packages.map((pkg: PackageDetails, index: number) => (
        <div
          key={pkg.id}
          style={{
            width: '4in',
            height: '6in',
            padding: '0.15in',
            pageBreakAfter: index < packages.length - 1 ? 'always' : 'auto',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            border: '3px solid #000',
            position: 'relative',
            backgroundColor: '#fff'
          }}
        >
          {/* Company Header */}
          <div style={{ borderBottom: '2px solid #000', paddingBottom: '4px', marginBottom: '5px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '2px' }}>
              บริษัท ออสแทม กู๊ดส์ จำกัด
            </div>
            <div style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.3' }}>
              350,352 ถนนอุดมสุข แขวงบางนาเหนือ เขตบางนา กทม. 10260
            </div>
            <div style={{ fontSize: '9px', textAlign: 'center', lineHeight: '1.3' }}>
              โทร: 02 749 4667-72 แฟ็กซ์: 02 743 2057
            </div>
          </div>

          {/* Customer Name & Package Number */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', flex: 1 }}>
              {pkg.shop_name}
            </div>
            <div style={{
              fontSize: '30px',
              fontWeight: 'bold',
              backgroundColor: '#000',
              color: '#fff',
              padding: '5px 13px',
              borderRadius: '4px',
              minWidth: '65px',
              textAlign: 'center'
            }}>
              #{pkg.package_number}
            </div>
          </div>

          {/* Reference Info */}
          <div style={{ fontSize: '9px', color: '#666', marginBottom: '5px', borderBottom: '1px solid #ddd', paddingBottom: '3px' }}>
            Face Sheet: {data.face_sheet_no} | Order: {pkg.order_no}
          </div>

          {/* Barcode Section */}
          <div style={{ textAlign: 'center', margin: '5px 0', borderBottom: '2px solid #000', paddingBottom: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Barcode
                value={pkg.barcode_id}
                width={1.6}
                height={38}
                fontSize={13}
                margin={0}
                displayValue={true}
              />
            </div>
          </div>

          {/* Hub Section - Black Background */}
          {pkg.hub && (
            <div style={{
              marginBottom: '6px',
              padding: '10px',
              backgroundColor: '#000',
              color: '#fff',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}>
              HUB {pkg.hub}
            </div>
          )}

          {/* Product Details */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '3px', paddingBottom: '2px', borderBottom: '1px solid #000' }}>
              สินค้า:
            </div>
            {pkg.product_items && pkg.product_items.length > 0 ? (
              <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
                {pkg.product_items.map((item, idx) => (
                  <div key={idx} style={{
                    padding: '2px 0',
                    borderBottom: idx < pkg.product_items!.length - 1 ? '1px solid #eee' : '1px solid #000'
                  }}>
                    {item.product_name} | {item.size} กก. ({item.product_code})
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '10px', padding: '2px 0', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
                {pkg.product_name} ({pkg.product_code})
              </div>
            )}
          </div>

          {/* Package Info Table */}
          <div style={{ marginBottom: '6px' }}>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '3px 0', fontWeight: 'bold', width: '85px' }}>ขนาด/ชิ้น:</td>
                  <td style={{ padding: '3px 0' }}>
                    {(() => {
                      // ลำดับความสำคัญ: 1. ดึงจากชื่อสินค้า 2. คำนวณจาก package_weight/pieces_per_pack
                      const sizeFromName = extractSizeFromProductName(pkg.product_name);
                      if (sizeFromName) {
                        return `${sizeFromName} กก.`;
                      }
                      // Fallback: คำนวณจาก package_weight หารด้วยจำนวนชิ้น
                      const packageWeight = pkg.product_items?.[0]?.size || parseFloat(pkg.size);
                      const perPieceWeight = packageWeight / pkg.pieces_per_pack;
                      return `${perPieceWeight.toFixed(1)} กก.`;
                    })()}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ padding: '3px 0', fontWeight: 'bold' }}>จำนวน:</td>
                  <td style={{ padding: '3px 0' }}>{pkg.pieces_per_pack} ชิ้น</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Delivery Address */}
          <div style={{ marginBottom: '6px', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>
              ที่อยู่จัดส่ง:
            </div>
            <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
              {pkg.address}
            </div>
            <div style={{ fontSize: '10px', fontWeight: '600', marginTop: '2px' }}>
              จังหวัด: {pkg.province}
            </div>
          </div>

          {/* Contact Info */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
              <div style={{ marginBottom: '2px' }}>
                <strong>ผู้รับ:</strong> {pkg.contact_name}
              </div>
              <div>
                <strong>โทร:</strong> {pkg.phone}
              </div>
            </div>
          </div>

          {/* Notes - Black Background if exists */}
          {pkg.notes && (
            <div style={{
              marginBottom: '6px',
              padding: '6px',
              backgroundColor: '#000',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              หมายเหตุ: {pkg.notes}
            </div>
          )}

          {/* Footer - Summary */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '4px',
            borderTop: '2px solid #000',
            fontSize: '9px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div>
              พิมพ์: {new Date().toLocaleString('th-TH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div>
              แพ็ค {pkg.package_number} / {data.total_packages}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FaceSheetLabelDocument;
