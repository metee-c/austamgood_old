'use client';

import React from 'react';

interface PackageInfo {
  package_id: number;
  package_number: number;
  barcode_id: string;
  shop_name: string;
  order_no: string;
  hub: string;
}

interface LocationSummary {
  storage_location: string;
  package_count: number;
  packages: PackageInfo[];
}

interface BonusStoragePlacementDocumentProps {
  faceSheetNo: string;
  createdDate: string;
  totalPackages: number;
  locationSummary: LocationSummary[];
}

const BonusStoragePlacementDocument: React.FC<BonusStoragePlacementDocumentProps> = ({
  faceSheetNo,
  createdDate,
  totalPackages,
  locationSummary
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

  // Group locations by prefix (PQ vs MR)
  const pqLocations = locationSummary.filter(l => l.storage_location.startsWith('PQ'));
  const mrLocations = locationSummary.filter(l => l.storage_location.startsWith('MR'));

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
          ใบจัดวางสินค้า (Storage Placement)
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
        <div>
          <strong>วันที่สร้าง:</strong> {formatDate(createdDate)}
        </div>
        <div>
          <strong>จำนวนแพ็คทั้งหมด:</strong> <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{totalPackages}</span>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#fef3c7',
        border: '2px solid #f59e0b',
        borderRadius: '5px',
        padding: '10px',
        marginBottom: '15px'
      }}>
        <p style={{ margin: '0', fontSize: '13px', fontWeight: '500' }}>
          📦 <strong>คำแนะนำ:</strong> นำแพ็คสินค้าไปวางตามโลเคชั่นที่ระบุ (ไม่เกิน 10 แพ็ค/โล)
        </p>
        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#92400e' }}>
          • PQ01-PQ10 = โซนภาคกลาง/กรุงเทพ | MR01-MR10 = โซนต่างจังหวัด
        </p>
      </div>

      {/* PQ Locations */}
      {pqLocations.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: 'bold',
            backgroundColor: '#dbeafe',
            padding: '8px 12px',
            margin: '0 0 10px 0',
            borderRadius: '5px'
          }}>
            🏙️ โซน PQ (ภาคกลาง/กรุงเทพ) - {pqLocations.reduce((sum, l) => sum + l.package_count, 0)} แพ็ค
          </h2>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th style={{ border: '1px solid #000', padding: '6px', width: '80px' }}>โลเคชั่น</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '60px' }}>จำนวน</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>รายการแพ็ค</th>
              </tr>
            </thead>
            <tbody>
              {pqLocations.map((loc) => (
                <tr key={loc.storage_location}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    backgroundColor: '#bfdbfe'
                  }}>
                    {loc.storage_location}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    {loc.package_count}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>
                    {loc.packages.map((pkg, idx) => (
                      <span key={pkg.package_id} style={{ 
                        display: 'inline-block',
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        margin: '2px',
                        borderRadius: '3px',
                        fontSize: '11px'
                      }}>
                        #{pkg.package_number} ({pkg.shop_name?.substring(0, 15) || pkg.order_no})
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MR Locations */}
      {mrLocations.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: 'bold',
            backgroundColor: '#fce7f3',
            padding: '8px 12px',
            margin: '0 0 10px 0',
            borderRadius: '5px'
          }}>
            🌄 โซน MR (ต่างจังหวัด) - {mrLocations.reduce((sum, l) => sum + l.package_count, 0)} แพ็ค
          </h2>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th style={{ border: '1px solid #000', padding: '6px', width: '80px' }}>โลเคชั่น</th>
                <th style={{ border: '1px solid #000', padding: '6px', width: '60px' }}>จำนวน</th>
                <th style={{ border: '1px solid #000', padding: '6px' }}>รายการแพ็ค</th>
              </tr>
            </thead>
            <tbody>
              {mrLocations.map((loc) => (
                <tr key={loc.storage_location}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    backgroundColor: '#fbcfe8'
                  }}>
                    {loc.storage_location}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    {loc.package_count}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>
                    {loc.packages.map((pkg, idx) => (
                      <span key={pkg.package_id} style={{ 
                        display: 'inline-block',
                        backgroundColor: '#f3f4f6',
                        padding: '2px 6px',
                        margin: '2px',
                        borderRadius: '3px',
                        fontSize: '11px'
                      }}>
                        #{pkg.package_number} ({pkg.shop_name?.substring(0, 15) || pkg.order_no})
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed List */}
      <div style={{ marginTop: '20px', pageBreakBefore: 'auto' }}>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 'bold',
          borderBottom: '2px solid #000',
          paddingBottom: '5px',
          marginBottom: '10px'
        }}>
          📋 รายละเอียดแพ็คทั้งหมด
        </h2>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '11px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#1f2937', color: '#fff' }}>
              <th style={{ border: '1px solid #000', padding: '5px', width: '50px' }}>แพ็คที่</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '80px' }}>โลเคชั่น</th>
              <th style={{ border: '1px solid #000', padding: '5px' }}>บาร์โค้ด</th>
              <th style={{ border: '1px solid #000', padding: '5px' }}>ร้านค้า</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '100px' }}>เลขออเดอร์</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '60px' }}>Hub</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '50px' }}>✓</th>
            </tr>
          </thead>
          <tbody>
            {locationSummary.flatMap(loc => 
              loc.packages.map((pkg, idx) => (
                <tr key={pkg.package_id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                    {pkg.package_number}
                  </td>
                  <td style={{ 
                    border: '1px solid #ccc', 
                    padding: '4px', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    backgroundColor: loc.storage_location.startsWith('PQ') ? '#dbeafe' : '#fce7f3'
                  }}>
                    {loc.storage_location}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', fontFamily: 'monospace', fontSize: '10px' }}>
                    {pkg.barcode_id}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px' }}>
                    {pkg.shop_name}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', fontFamily: 'monospace' }}>
                    {pkg.order_no}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>
                    {pkg.hub || '-'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>
                    ☐
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
        <div>ผู้จัดวาง: ________________</div>
        <div>ผู้ตรวจสอบ: ________________</div>
      </div>
    </div>
  );
};

export default BonusStoragePlacementDocument;
