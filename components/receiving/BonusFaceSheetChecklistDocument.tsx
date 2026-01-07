'use client';

import React from 'react';

// Inline styles for print-friendly document
import { QRCodeSVG } from 'qrcode.react';

interface BonusFaceSheetItem {
  id: number;
  sku_id: string;
  product_name: string;
  quantity_to_pick: number;
  quantity_picked: number;
  status: string;
  source_location_id?: string;
}

interface BonusFaceSheetPackage {
  id: number;
  package_number: string;
  order_id: number;
  order_no: string;
  shop_name: string;
  barcode_id: string;
  trip_number?: string; // เพิ่ม trip_number สำหรับแต่ละ package
  bonus_face_sheet_items: BonusFaceSheetItem[];
}

interface BonusFaceSheetData {
  id: number;
  face_sheet_no: string;
  warehouse_id: string;
  status: string;
  delivery_date: string;
  total_packages: number;
  total_items: number;
  total_orders: number;
  created_date: string;
  created_by: string;
  trip_number?: string; // เพิ่ม trip_number สำหรับแสดงใน header
}

interface ChecklistData {
  bonusFaceSheet: BonusFaceSheetData;
  packages: BonusFaceSheetPackage[];
  summary: {
    totalPackages: number;
    totalItems: number;
    totalOrders: number;
    totalQuantityToPick: number;
    totalQuantityPicked: number;
  };
}

interface Props {
  data: ChecklistData;
}

const BonusFaceSheetChecklistDocument: React.FC<Props> = ({ data }) => {
  const { bonusFaceSheet, packages, summary } = data;

  return (
    <div style={{
      width: '210mm',
      minHeight: '297mm',
      padding: '15mm',
      backgroundColor: '#ffffff',
      fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#000000'
    }}>
      {/* Header with QR Code */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px', 
        borderBottom: '2px solid #000', 
        paddingBottom: '8px' 
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ 
            fontSize: '22px', 
            fontWeight: 'bold', 
            margin: '0',
            color: '#000'
          }}>
            ใบเช็คสินค้าของแถม
          </h1>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
            Bonus Items Checklist
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <QRCodeSVG 
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/mobile/bonus-face-sheet/${bonusFaceSheet.id}`}
            size={80}
            level="M"
          />
          <div style={{ fontSize: '10px', marginTop: '4px', color: '#666' }}>
            สแกนเพื่อหยิบสินค้า
          </div>
        </div>
      </div>

      {/* Face Sheet Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '12px',
        fontSize: '13px',
        padding: '8px 10px',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ccc'
      }}>
        <div>
          <div style={{ marginBottom: '5px' }}>
            <strong>เลขที่ใบปะหน้า:</strong> <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{bonusFaceSheet.face_sheet_no}</span>
          </div>
          <div style={{ marginBottom: '5px' }}>
            <strong>สายรถ:</strong> <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb' }}>{bonusFaceSheet.trip_number || '-'}</span>
          </div>
          <div style={{ marginBottom: '5px' }}>
            <strong>คลังสินค้า:</strong> {bonusFaceSheet.warehouse_id}
          </div>
          <div>
            <strong>วันที่สร้าง:</strong> {bonusFaceSheet.created_date}
          </div>
        </div>
        <div>
          <div style={{ marginBottom: '5px' }}>
            <strong>วันที่ส่งของ:</strong> {bonusFaceSheet.delivery_date}
          </div>
          <div style={{ marginBottom: '5px' }}>
            <strong>สถานะ:</strong> {bonusFaceSheet.status === 'completed' ? 'เสร็จสิ้น' :
             bonusFaceSheet.status === 'picking' ? 'กำลังหยิบ' : 'สร้างแล้ว'}
          </div>
          <div>
            <strong>ผู้สร้าง:</strong> {bonusFaceSheet.created_by}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        backgroundColor: '#e0e0e0',
        padding: '10px',
        marginBottom: '15px',
        border: '1px solid #000'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          textAlign: 'center',
          fontSize: '13px'
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{summary.totalPackages}</div>
            <div>แพ็ค</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{summary.totalItems}</div>
            <div>รายการ</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{summary.totalOrders}</div>
            <div>ออเดอร์</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{summary.totalQuantityToPick}</div>
            <div>ชิ้นรวม</div>
          </div>
        </div>
      </div>

      {/* Packages and Items */}
      {packages.map((pkg, pkgIndex) => (
        <div key={pkg.id} style={{ 
          marginBottom: '20px',
          pageBreakInside: 'avoid'
        }}>
          {/* Package Header */}
          <div style={{
            backgroundColor: '#f0f0f0',
            padding: '8px 10px',
            marginBottom: '0',
            border: '1px solid #000',
            borderBottom: 'none',
            fontSize: '12px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                แพ็คที่ {pkgIndex + 1}/{packages.length} - {pkg.package_number}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {pkg.bonus_face_sheet_items?.length || 0} รายการ
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              <div>
                <strong>ออเดอร์:</strong> {pkg.order_no}
              </div>
              <div>
                <strong>ร้านค้า:</strong> {pkg.shop_name}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>บาร์โค้ด:</strong> <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{pkg.barcode_id}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #000',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#e0e0e0' }}>
                <th style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  width: '5%'
                }}>#</th>
                <th style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  width: '20%'
                }}>รหัสสินค้า</th>
                <th style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  width: '45%'
                }}>ชื่อสินค้า</th>
                <th style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  width: '12%'
                }}>จำนวน</th>
                <th style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  width: '10%'
                }}>สถานะ</th>
                <th style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  width: '8%'
                }}>เช็ค</th>
              </tr>
            </thead>
            <tbody>
              {pkg.bonus_face_sheet_items.map((item, itemIndex) => (
                <tr key={item.id}>
                  <td style={{
                    border: '1px solid #000',
                    padding: '5px 4px',
                    textAlign: 'center'
                  }}>{itemIndex + 1}</td>
                  <td style={{
                    border: '1px solid #000',
                    padding: '5px 4px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    wordBreak: 'break-all',
                    lineHeight: '1.2'
                  }}>{item.sku_id}</td>
                  <td style={{
                    border: '1px solid #000',
                    padding: '5px 4px',
                    fontSize: '11px',
                    wordBreak: 'break-word',
                    lineHeight: '1.3'
                  }}>
                    {item.product_name}
                  </td>
                  <td style={{
                    border: '1px solid #000',
                    padding: '5px 4px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '15px'
                  }}>{item.quantity_to_pick}</td>
                  <td style={{
                    border: '1px solid #000',
                    padding: '5px 4px',
                    textAlign: 'center',
                    fontSize: '11px'
                  }}>
                    {item.status === 'picked' ? 'หยิบแล้ว' :
                     item.status === 'picking' ? 'กำลังหยิบ' : 'รอหยิบ'}
                  </td>
                  <td style={{
                    border: '1px solid #000',
                    padding: '5px 4px',
                    backgroundColor: '#f9f9f9'
                  }}></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                <td colSpan={3} style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'right',
                  fontSize: '12px'
                }}>รวมแพ็คนี้:</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontSize: '15px'
                }}>
                  {pkg.bonus_face_sheet_items.reduce((sum, item) => sum + item.quantity_to_pick, 0)}
                </td>
                <td colSpan={2} style={{ border: '1px solid #000' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Signature Section */}
      <div style={{
        marginTop: '30px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '20px',
        fontSize: '13px'
      }}>
        <div>
          <div style={{ marginBottom: '50px' }}>
            <div>ผู้หยิบสินค้า: _______________________</div>
          </div>
          <div>
            <div>วันที่: _____ / _____ / _______</div>
          </div>
        </div>
        <div>
          <div style={{ marginBottom: '50px' }}>
            <div>ผู้ตรวจสอบ: _______________________</div>
          </div>
          <div>
            <div>วันที่: _____ / _____ / _______</div>
          </div>
        </div>
        <div>
          <div style={{ marginBottom: '50px' }}>
            <div>ผู้อนุมัติ: _______________________</div>
          </div>
          <div>
            <div>วันที่: _____ / _____ / _______</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '20px',
        paddingTop: '8px',
        borderTop: '1px solid #ccc',
        fontSize: '11px',
        color: '#666',
        textAlign: 'center'
      }}>
        <p style={{ margin: '0' }}>
          พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
        </p>
      </div>
    </div>
  );
};

export default BonusFaceSheetChecklistDocument;
