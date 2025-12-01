'use client';
import React from 'react';

interface PackageItem {
  product_code: string;
  product_name: string;
  size: string;
  pieces_per_pack: number;
}

interface SKUGroup {
  product_code: string;
  product_name: string;
  size: string;
  package_count: number;
  total_pieces: number;
}

interface FaceSheetChecklistDocumentProps {
  faceSheetNo: string;
  createdDate: string;
  packages: PackageItem[];
}

const FaceSheetChecklistDocument: React.FC<FaceSheetChecklistDocumentProps> = ({
  faceSheetNo,
  createdDate,
  packages
}) => {
  // Group by product_code + size
  const groupedData = packages.reduce((acc, pkg) => {
    const key = `${pkg.product_code}_${pkg.size}`;
    if (!acc[key]) {
      acc[key] = {
        product_code: pkg.product_code,
        product_name: pkg.product_name,
        size: pkg.size,
        package_count: 0,
        total_pieces: 0
      };
    }
    acc[key].package_count += 1;
    acc[key].total_pieces += pkg.pieces_per_pack;
    return acc;
  }, {} as Record<string, SKUGroup>);

  // Convert to array and sort
  const sortedGroups = Object.values(groupedData).sort((a, b) => {
    // Sort by product_code first
    if (a.product_code !== b.product_code) {
      return a.product_code.localeCompare(b.product_code);
    }
    // Then by size (numeric)
    return parseFloat(a.size) - parseFloat(b.size);
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000' }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0',
          color: '#000'
        }}>
          เอกสารตรวจสอบสินค้าตาม SKU
        </h1>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '10px',
          fontSize: '16px'
        }}>
          <div><strong>เลขที่ใบปะหน้า:</strong> {faceSheetNo}</div>
          <div><strong>วันที่:</strong> {formatDate(createdDate)}</div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#f0f0f0',
        padding: '10px',
        marginBottom: '20px',
        borderRadius: '5px',
        border: '1px solid #ccc'
      }}>
        <p style={{ margin: '0', fontSize: '14px' }}>
          <strong>คำแนะนำ:</strong> ใช้เอกสารนี้ตรวจสอบยอดรวมของสินค้าแต่ละชนิดว่าหยิบครบตามจำนวนที่ระบุหรือไม่ ก่อนทำการแพ็คจริง
        </p>
      </div>

      {/* Table 1: Package Count */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '10px',
          color: '#000',
          borderBottom: '1px solid #000',
          paddingBottom: '5px'
        }}>
          ตารางที่ 1: จำนวนแพ็ค
        </h2>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #000'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#e0e0e0' }}>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'left',
                fontWeight: 'bold',
                width: '15%'
              }}>รหัสสินค้า</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'left',
                fontWeight: 'bold',
                width: '45%'
              }}>ชื่อสินค้า</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '15%'
              }}>ขนาด (กก.)</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '15%'
              }}>จำนวนแพ็ค</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '10%'
              }}>✓</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group, index) => (
              <tr key={`pkg-${index}`}>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  fontFamily: 'monospace'
                }}>{group.product_code}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px'
                }}>{group.product_name}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  textAlign: 'center'
                }}>{group.size}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>{group.package_count}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  backgroundColor: '#f9f9f9'
                }}></td>
              </tr>
            ))}
            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
              <td colSpan={3} style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'right'
              }}>รวมทั้งหมด:</td>
              <td style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontSize: '16px'
              }}>
                {sortedGroups.reduce((sum, g) => sum + g.package_count, 0)}
              </td>
              <td style={{ border: '1px solid #000' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Table 2: Pieces Count */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '10px',
          color: '#000',
          borderBottom: '1px solid #000',
          paddingBottom: '5px'
        }}>
          ตารางที่ 2: จำนวนชิ้น
        </h2>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #000'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#e0e0e0' }}>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'left',
                fontWeight: 'bold',
                width: '15%'
              }}>รหัสสินค้า</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'left',
                fontWeight: 'bold',
                width: '45%'
              }}>ชื่อสินค้า</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '15%'
              }}>ขนาด (กก.)</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '15%'
              }}>จำนวนชิ้น</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '10%'
              }}>✓</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((group, index) => (
              <tr key={`pcs-${index}`}>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  fontFamily: 'monospace'
                }}>{group.product_code}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px'
                }}>{group.product_name}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  textAlign: 'center'
                }}>{group.size}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>{group.total_pieces}</td>
                <td style={{
                  border: '1px solid #000',
                  padding: '6px 8px',
                  backgroundColor: '#f9f9f9'
                }}></td>
              </tr>
            ))}
            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
              <td colSpan={3} style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'right'
              }}>รวมทั้งหมด:</td>
              <td style={{
                border: '1px solid #000',
                padding: '8px',
                textAlign: 'center',
                fontSize: '16px'
              }}>
                {sortedGroups.reduce((sum, g) => sum + g.total_pieces, 0)}
              </td>
              <td style={{ border: '1px solid #000' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signature Section */}
      <div style={{
        marginTop: '40px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '40px'
      }}>
        <div>
          <div style={{ marginBottom: '60px' }}>
            <div>ผู้ตรวจสอบ: _______________________________</div>
          </div>
          <div>
            <div>วันที่: ______ / ______ / __________</div>
          </div>
        </div>
        <div>
          <div style={{ marginBottom: '60px' }}>
            <div>ผู้อนุมัติ: _______________________________</div>
          </div>
          <div>
            <div>วันที่: ______ / ______ / __________</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '10px',
        borderTop: '1px solid #ccc',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center'
      }}>
        <p style={{ margin: '0' }}>
          เอกสารนี้สร้างโดยระบบ WMS - AustamGood | พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
        </p>
      </div>
    </div>
  );
};

export default FaceSheetChecklistDocument;
