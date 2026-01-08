'use client';

import React from 'react';

interface PackageInfo {
  package_id: number;
  package_number: number;
  barcode_id: string;
  shop_name: string;
  order_no: string;
  hub: string;
  storage_location: string;
  trip_number?: string;
}

interface TripGroup {
  trip_number: string;
  daily_trip_number?: number;
  destination_location: string; // PQTD or MRTD
  packages: PackageInfo[];
}

interface BonusPickListDocumentProps {
  faceSheetNo: string;
  createdDate: string;
  tripGroups: TripGroup[];
  loadlistCode?: string;
}

const BonusPickListDocument: React.FC<BonusPickListDocumentProps> = ({
  faceSheetNo,
  createdDate,
  tripGroups,
  loadlistCode
}) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const printDate = new Date().toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const totalPackages = tripGroups.reduce((sum, g) => sum + g.packages.length, 0);

  return (
    <div style={{ 
      fontFamily: 'Sarabun, Noto Sans Thai, sans-serif',
      padding: '15mm',
      maxWidth: '210mm',
      margin: '0 auto',
      backgroundColor: '#fff'
    }}>
      {/* Header */}
      <div style={{ 
        textAlign: 'center', 
        borderBottom: '3px solid #000',
        paddingBottom: '10px',
        marginBottom: '15px'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          margin: '0 0 5px 0',
          letterSpacing: '2px'
        }}>
          ใบหยิบสินค้า (Pick List)
        </h1>
        <p style={{ fontSize: '14px', margin: '0', color: '#666' }}>
          บริษัท ออสแทม กู๊ดส์ จำกัด
        </p>
      </div>

      {/* Document Info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '5px'
      }}>
        <div>
          <strong>เลขที่ใบปะหน้า:</strong> <span style={{ color: '#9333ea', fontWeight: 'bold' }}>{faceSheetNo}</span>
        </div>
        {loadlistCode && (
          <div>
            <strong>เลขที่ใบโหลด:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{loadlistCode}</span>
          </div>
        )}
        <div>
          <strong>วันที่:</strong> {formatDate(createdDate)}
        </div>
        <div>
          <strong>จำนวนแพ็ค:</strong> <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{totalPackages}</span>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#ecfdf5',
        border: '2px solid #10b981',
        borderRadius: '5px',
        padding: '10px',
        marginBottom: '15px'
      }}>
        <p style={{ margin: '0', fontSize: '13px', fontWeight: '500' }}>
          📦 <strong>คำแนะนำ:</strong> หยิบแพ็คจากโลเคชั่นที่ระบุ นำไปวางที่จุดพักสินค้า (PQTD/MRTD) ตามสายรถ
        </p>
        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#065f46' }}>
          • PQTD = จุดพักสินค้าโซนภาคกลาง | MRTD = จุดพักสินค้าโซนต่างจังหวัด
        </p>
      </div>

      {/* Trip Groups */}
      {tripGroups.map((group, groupIdx) => (
        <div key={groupIdx} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: group.destination_location === 'PQTD' ? '#dbeafe' : '#fce7f3',
            padding: '10px 15px',
            borderRadius: '5px 5px 0 0',
            border: '2px solid #000',
            borderBottom: 'none'
          }}>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                🚚 สายรถ: {group.trip_number}
              </span>
              {group.daily_trip_number && (
                <span style={{ 
                  marginLeft: '10px',
                  backgroundColor: '#000',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  คันที่ {group.daily_trip_number}
                </span>
              )}
            </div>
            <div style={{
              backgroundColor: group.destination_location === 'PQTD' ? '#2563eb' : '#db2777',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '5px',
              fontWeight: 'bold',
              fontSize: '18px'
            }}>
              → {group.destination_location}
            </div>
          </div>

          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px',
            border: '2px solid #000'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                <th style={{ border: '1px solid #000', padding: '6px', width: '50px' }}>ลำดับ</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '60px' }}>แพ็คที่</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '80px' }}>หยิบจาก</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>บาร์โค้ด</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>ร้านค้า</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '100px' }}>เลขออเดอร์</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '50px' }}>Hub</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '50px' }}>✓</th>
              </tr>
            </thead>
            <tbody>
              {group.packages.map((pkg, idx) => (
                <tr key={pkg.package_id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>
                    {idx + 1}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                    {pkg.package_number}
                  </td>
                  <td style={{ 
                    border: '1px solid #ccc', 
                    padding: '5px', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    backgroundColor: pkg.storage_location?.startsWith('PQ') ? '#dbeafe' : '#fce7f3'
                  }}>
                    {pkg.storage_location || '-'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', fontFamily: 'monospace', fontSize: '10px' }}>
                    {pkg.barcode_id}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px' }}>
                    {pkg.shop_name}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', fontFamily: 'monospace' }}>
                    {pkg.order_no}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>
                    {pkg.hub || '-'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center', fontSize: '16px' }}>
                    ☐
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <td colSpan={7} style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'right' }}>
                  รวมสายนี้:
                </td>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>
                  {group.packages.length} แพ็ค
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Summary */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f3f4f6',
        borderRadius: '5px',
        border: '2px solid #000'
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>📊 สรุปรวม</h3>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>{tripGroups.length}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>สายรถ</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9333ea' }}>{totalPackages}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>แพ็คทั้งหมด</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563eb' }}>
              {tripGroups.filter(g => g.destination_location === 'PQTD').reduce((sum, g) => sum + g.packages.length, 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>→ PQTD</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#db2777' }}>
              {tripGroups.filter(g => g.destination_location === 'MRTD').reduce((sum, g) => sum + g.packages.length, 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>→ MRTD</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '2px solid #000',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: '#666'
      }}>
        <div>พิมพ์เมื่อ: {printDate}</div>
        <div>ผู้หยิบ: ________________</div>
        <div>ผู้ตรวจสอบ: ________________</div>
      </div>
    </div>
  );
};

export default BonusPickListDocument;
