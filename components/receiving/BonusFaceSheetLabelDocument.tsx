'use client';

import React from 'react';
import Barcode from 'react-barcode';

interface BonusFaceSheetItem {
  product_code: string;
  product_name: string;
  quantity: number;
  unit?: string;
}

interface BonusFaceSheetPackage {
  package_number: number;
  barcode_id: string;
  order_no: string;
  customer_id: string;
  shop_name: string;
  address: string;
  province?: string;
  hub: string;
  delivery_type: string;
  remark?: string;
  sales_territory?: string;
  trip_number?: string;
  storage_location?: string; // โลเคชั่นจัดวาง (PQ01-PQ10, MR01-MR10)
  items: BonusFaceSheetItem[];
}

interface BonusFaceSheetDetails {
  face_sheet_no: string;
  created_date: string;
  packages: BonusFaceSheetPackage[];
}

interface BonusFaceSheetLabelDocumentProps {
  details: BonusFaceSheetDetails;
}

const BonusFaceSheetLabelDocument: React.FC<BonusFaceSheetLabelDocumentProps> = ({ details }) => {
  const formatThaiDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // คำนวณจำนวนแพ็ครวมต่อออเดอร์
  const packCountByOrder = details.packages.reduce((acc, pkg) => {
    acc[pkg.order_no] = (acc[pkg.order_no] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // สร้าง map เพื่อเก็บลำดับแพ็คของแต่ละออเดอร์
  const packSequenceByOrder: Record<string, number> = {};

  return (
    <>
      {details.packages.map((pkg) => {
        // คำนวณลำดับแพ็คของออเดอร์นี้
        if (!packSequenceByOrder[pkg.order_no]) {
          packSequenceByOrder[pkg.order_no] = 0;
        }
        packSequenceByOrder[pkg.order_no]++;
        const currentPackNumber = packSequenceByOrder[pkg.order_no];
        const totalPacksForOrder = packCountByOrder[pkg.order_no];
        const totalItems = pkg.items.length;
        const ITEMS_PER_PAGE = 10;
        // ถ้าไม่มี items ก็ยังต้องแสดงอย่างน้อย 1 หน้า
        const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

        // แบ่งรายการสินค้าเป็นหลายหน้า
        const pages = [];
        for (let page = 0; page < totalPages; page++) {
          const startIdx = page * ITEMS_PER_PAGE;
          const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalItems);
          const pageItems = pkg.items.slice(startIdx, endIdx);

          pages.push(
            <div
              key={`${pkg.package_number}-${page}`}
              style={{
                width: '148mm',
                height: '210mm',
                padding: '8mm',
                margin: '0 auto',
                background: 'white',
                fontFamily: "'Sarabun', 'TH Sarabun New', Arial, sans-serif",
                border: '2px solid #333',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                pageBreakAfter: 'always',
                marginBottom: '10px'
              }}
            >
              {/* Watermark - เขตการขาย */}
              {pkg.sales_territory && (
                <div
                  style={{
                    position: 'absolute',
                    top: '75%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                    fontSize:
                      pkg.sales_territory.length > 20
                        ? '40px'
                        : pkg.sales_territory.length > 15
                        ? '50px'
                        : pkg.sales_territory.length > 10
                        ? '60px'
                        : '70px',
                    fontWeight: 900,
                    color: 'rgba(0, 0, 0, 0.15)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 1,
                    letterSpacing: pkg.sales_territory.length > 15 ? '1px' : '3px',
                    maxWidth: '85%'
                  }}
                >
                  {pkg.sales_territory}
                </div>
              )}

              {/* Header - Company Info + HUB */}
              <div
                style={{
                  padding: '10px 12px',
                  margin: '-8mm -8mm 6mm -8mm',
                  borderBottom: '3px solid #000'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
                      บริษัท ออสแทม กู๊ดส์ จำกัด
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '9px', lineHeight: 1.3, color: '#000' }}>
                      350,352 ถนนอุดมสุข แขวงบางนาเหนือ เขตบางนา กทม. 10260
                      <br />
                      โทร: 02 749 4667-72 | แฟ็กซ์: 02 743 2057
                    </p>
                  </div>
                  <div
                    style={{
                      background: '#ffeb3b',
                      color: '#000',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      textAlign: 'center',
                      border: '2px solid #f57c00',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px' }}>HUB:</p>
                    <p
                      style={{
                        margin: '2px 0 0 0',
                        fontSize: '18px',
                        fontWeight: 900,
                        color: '#d32f2f',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        lineHeight: 1
                      }}
                    >
                      {pkg.hub || 'ไม่ระบุ'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div
                style={{
                  position: 'absolute',
                  top: '100px',
                  left: '8mm',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: '#fff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              >
                Date: {formatThaiDate(details.created_date)}
              </div>

              {/* Page number (if multiple pages) */}
              {totalPages > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100px',
                    right: '8mm',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: '#ffeb3b',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}
                >
                  หน้า {page + 1}/{totalPages}
                </div>
              )}

              {/* Shop Name Header */}
              <div style={{ marginTop: 0, marginBottom: '8px' }}>
                <h1
                  style={{
                    fontSize: '22px',
                    margin: '0 0 6px 0',
                    fontWeight: 'bold',
                    lineHeight: 1,
                    textAlign: 'center'
                  }}
                >
                  ร้านค้า {pkg.shop_name}
                </h1>

                {/* Combined Info Box */}
                <div
                  style={{
                    border: '2px solid #000',
                    padding: '6px',
                    background: 'linear-gradient(to bottom, #f9f9f9 0%, #fff8dc 100%)'
                  }}
                >
                  {/* Top Row: Customer Code */}
                  <div
                    style={{
                      marginBottom: '4px',
                      paddingBottom: '4px',
                      borderBottom: '1px solid #ddd'
                    }}
                  >
                    <p style={{ fontSize: '10px', margin: 0 }}>
                      <strong>รหัสลูกค้า:</strong>{' '}
                      <span style={{ fontSize: '12px', color: '#0066cc', fontWeight: 'bold' }}>
                        {pkg.customer_id}
                      </span>
                    </p>
                  </div>

                  {/* Middle Row: Address + Delivery Type + Remark */}
                  <div style={{ marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px solid #ddd' }}>
                    <p style={{ fontSize: '9px', margin: '1px 0', lineHeight: 1.3 }}>
                      <strong>ที่อยู่:</strong> {pkg.address}
                    </p>
                    <p style={{ fontSize: '9px', margin: '1px 0' }}>
                      <strong>ประเภทจัดส่ง:</strong>{' '}
                      <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{pkg.delivery_type || ''}</span>
                    </p>
                    {pkg.remark && (
                      <p style={{ fontSize: '9px', margin: '1px 0' }}>
                        <strong>หมายเหตุ:</strong>{' '}
                        <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{pkg.remark}</span>
                      </p>
                    )}
                    {pkg.trip_number && (
                      <p style={{ fontSize: '9px', margin: '1px 0' }}>
                        <strong>สายรถ/คันที่:</strong>{' '}
                        <span style={{ color: '#0066cc', fontWeight: 'bold' }}>{pkg.trip_number}</span>
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Package Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '8px', margin: 0, color: '#555' }}>แพ็คจัดเตรียม(คลัง)</p>
                      <p
                        style={{
                          fontSize: '18px',
                          margin: 0,
                          fontWeight: 'bold',
                          color: '#000',
                          background: '#ffeb3b',
                          padding: '2px 6px',
                          display: 'inline-block',
                          borderRadius: '4px'
                        }}
                      >
                        {pkg.package_number}
                      </p>
                    </div>
                    {/* Storage Location - แสดงโลเคชั่นจัดวาง */}
                    {pkg.storage_location && (
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <p style={{ fontSize: '8px', margin: 0, color: '#555' }}>โลเคชั่นจัดวาง</p>
                        <p
                          style={{
                            fontSize: '16px',
                            margin: 0,
                            fontWeight: 'bold',
                            color: '#fff',
                            background: pkg.storage_location.startsWith('PQ') ? '#2563eb' : '#db2777',
                            padding: '3px 10px',
                            display: 'inline-block',
                            borderRadius: '4px',
                            border: '2px solid #000',
                            letterSpacing: '1px'
                          }}
                        >
                          {pkg.storage_location}
                        </p>
                      </div>
                    )}
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ fontSize: '8px', margin: 0, color: '#555' }}>แพ็คต่อเลขออเดอร์</p>
                      <p
                        style={{
                          fontSize: '14px',
                          margin: 0,
                          fontWeight: 'bold',
                          color: '#d32f2f',
                          background: '#ffebee',
                          padding: '2px 6px',
                          display: 'inline-block',
                          borderRadius: '4px',
                          border: '2px solid #d32f2f'
                        }}
                      >
                        {currentPackNumber}/{totalPacksForOrder}
                      </p>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <p style={{ fontSize: '8px', margin: 0, color: '#555' }}>Barcode ID</p>
                      <p style={{ fontSize: '10px', margin: 0, fontWeight: 'bold', fontFamily: 'monospace' }}>
                        {pkg.barcode_id}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Table */}
              <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#000', color: 'white' }}>
                    <tr>
                      <th
                        style={{
                          padding: '6px 8px',
                          borderBottom: '2px solid #000',
                          textAlign: 'center',
                          width: '35px'
                        }}
                      >
                        #
                      </th>
                      <th style={{ padding: '6px 8px', borderBottom: '2px solid #000', textAlign: 'left' }}>
                        ชื่อสินค้า
                      </th>
                      <th
                        style={{
                          padding: '6px 8px',
                          borderBottom: '2px solid #000',
                          textAlign: 'center',
                          width: '70px'
                        }}
                      >
                        จำนวน (ชิ้น)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item, itemIdx) => (
                      <tr key={itemIdx}>
                        <td
                          style={{
                            padding: '6px 8px',
                            borderBottom: '1px solid #ddd',
                            textAlign: 'center'
                          }}
                        >
                          {startIdx + itemIdx + 1}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #ddd' }}>{item.product_name}</td>
                        <td
                          style={{
                            padding: '6px 8px',
                            borderBottom: '1px solid #ddd',
                            textAlign: 'center',
                            fontWeight: 'bold'
                          }}
                        >
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer with item count */}
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '2px solid #000',
                  textAlign: 'center'
                }}
              >
                {totalPages > 1 ? (
                  <p style={{ fontSize: '13px', margin: 0, fontWeight: 'bold' }}>
                    หน้านี้: {pageItems.length} รายการ | รวมทั้งหมด: {totalItems} รายการ
                  </p>
                ) : (
                  <p style={{ fontSize: '13px', margin: 0, fontWeight: 'bold' }}>รวมทั้งหมด {totalItems} รายการ</p>
                )}
              </div>

              {/* Barcode Section - ล่างสุดของลาเบล */}
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '6px',
                  borderTop: '1px dashed #999',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <Barcode
                  value={pkg.barcode_id}
                  format="CODE128"
                  width={1.2}
                  height={30}
                  displayValue={true}
                  fontSize={9}
                  margin={0}
                  background="#ffffff"
                  lineColor="#000000"
                />

                {/* Order Number - ใต้บาร์โค้ด */}
                <div
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    marginTop: '8px'
                  }}
                >
                  <p style={{ fontSize: '11px', margin: '0 0 2px 0', fontWeight: 'bold', color: '#555' }}>
                    เลขที่ใบสั่งส่ง
                  </p>
                  <p
                    style={{
                      fontSize: '32px',
                      margin: 0,
                      fontWeight: 900,
                      color: '#d32f2f',
                      letterSpacing: '2px',
                      lineHeight: 1,
                      fontFamily: 'monospace'
                    }}
                  >
                    {pkg.order_no}
                  </p>
                </div>
              </div>
            </div>
          );
        }

        return pages;
      })}
    </>
  );
};

export default BonusFaceSheetLabelDocument;
