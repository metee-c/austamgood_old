/**
 * Production Receipt Print Document
 * เอกสารใบรับผลิตจริงสำหรับปริ้น - A4 แนวตั้ง
 */

'use client';

import React, { forwardRef } from 'react';

// Interface สำหรับข้อมูลวัตถุดิบ
interface MaterialData {
  sku_id: string;
  sku_name: string;
  issued_qty: number;
  actual_qty: number;
  variance_qty: number;
  variance_type: string;
  uom: string;
}

// Interface สำหรับข้อมูลที่คำนวณ
interface CalculatedData {
  fg_planned_qty: number;
  fg_actual_qty: number;
  food_actual_qty: number;
  food_actual_kg: number;
  packaging_actual_qty: number;
  avg_weight_per_bag: number;
  waste_per_piece: number;
  total_waste: number;
  food_materials: MaterialData[];
  packaging_materials: MaterialData[];
}

// Interface สำหรับ Production Receipt
export interface ProductionReceiptForPrint {
  id: string;
  production_order_id: string;
  product_sku_id: string;
  received_qty: number;
  lot_no?: string;
  batch_no?: string;
  received_at: string;
  remarks?: string;
  created_at: string;
  production_order?: {
    production_no: string;
    quantity: number;
    produced_qty: number;
    status: string;
    sku_id: string;
    start_date?: string;
    production_date?: string;
    expiry_date?: string;
  };
  product_sku?: {
    sku_id: string;
    sku_name: string;
  };
  producer?: {
    first_name?: string;
    last_name?: string;
    nickname?: string;
  };
  calculated?: CalculatedData;
}

interface ProductionReceiptPrintDocumentProps {
  receipt: ProductionReceiptForPrint;
}

const ProductionReceiptPrintDocument = forwardRef<HTMLDivElement, ProductionReceiptPrintDocumentProps>(
  ({ receipt }, ref) => {
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const formatDateTime = (dateStr: string | null | undefined) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const getVarianceTypeText = (type: string) => {
      const typeMap: Record<string, string> = {
        exact: 'ตรงกัน',
        shortage: 'ใช้น้อยกว่า',
        excess: 'ใช้มากกว่า',
      };
      return typeMap[type] || type;
    };

    const getVarianceClass = (type: string) => {
      if (type === 'shortage') return 'variance-shortage';
      if (type === 'excess') return 'variance-excess';
      return 'variance-exact';
    };

    const producerName = receipt.producer
      ? `${receipt.producer.first_name || ''} ${receipt.producer.last_name || ''}`.trim() || receipt.producer.nickname || '-'
      : '-';

    const calc = receipt.calculated;
    const fgPlanned = calc?.fg_planned_qty || receipt.production_order?.quantity || 0;
    const fgActual = calc?.fg_actual_qty || receipt.received_qty || 0;
    const efficiency = fgPlanned > 0 ? ((fgActual / fgPlanned) * 100).toFixed(1) : '0';

    return (
      <div ref={ref} className="print-document">
        <style jsx>{`
          .print-document {
            width: 210mm;
            min-height: 297mm;
            padding: 12mm;
            margin: 0 auto;
            background: white;
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            font-size: 10pt;
            color: #1a1a1a;
            line-height: 1.4;
          }
          
          @media print {
            .print-document {
              width: 100%;
              padding: 8mm;
              margin: 0;
            }
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
          }

          .header {
            border-bottom: 3px solid #059669;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }

          .company-name {
            font-size: 16pt;
            font-weight: bold;
            color: #059669;
            margin-bottom: 2px;
          }

          .document-title {
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            color: #065f46;
            margin: 12px 0;
            padding: 8px;
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border-radius: 6px;
            border: 1px solid #a7f3d0;
          }

          .receipt-number {
            font-size: 12pt;
            font-weight: bold;
            color: #059669;
            text-align: center;
            margin-bottom: 12px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 15px;
          }

          .info-box {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px;
            background: #fafafa;
          }

          .info-box-title {
            font-size: 9pt;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            border-bottom: 1px dotted #e5e7eb;
          }

          .info-row:last-child {
            border-bottom: none;
          }

          .info-label {
            color: #6b7280;
            font-size: 9pt;
          }

          .info-value {
            font-weight: 600;
            color: #1f2937;
          }

          .product-section {
            margin-bottom: 15px;
            border: 2px solid #059669;
            border-radius: 6px;
            overflow: hidden;
          }

          .product-header {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: white;
            padding: 8px 12px;
            font-weight: bold;
            font-size: 10pt;
          }

          .product-content {
            padding: 12px;
          }

          .product-name {
            font-size: 12pt;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 8px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 10px;
          }

          .stat-box {
            text-align: center;
            padding: 8px;
            background: #f3f4f6;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }

          .stat-value {
            font-size: 14pt;
            font-weight: bold;
          }

          .stat-value.blue { color: #2563eb; }
          .stat-value.green { color: #059669; }
          .stat-value.amber { color: #d97706; }
          .stat-value.purple { color: #7c3aed; }
          .stat-value.cyan { color: #0891b2; }
          .stat-value.red { color: #dc2626; }

          .stat-label {
            font-size: 8pt;
            color: #6b7280;
            margin-top: 2px;
          }

          .materials-section {
            margin-bottom: 15px;
          }

          .section-title {
            font-size: 10pt;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 8px;
            padding: 6px 10px;
            background: #f3f4f6;
            border-left: 4px solid #059669;
          }

          .materials-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }

          .materials-table th {
            background: #059669;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
          }

          .materials-table th.right {
            text-align: right;
          }

          .materials-table th.center {
            text-align: center;
          }

          .materials-table td {
            padding: 6px;
            border-bottom: 1px solid #e5e7eb;
          }

          .materials-table td.right {
            text-align: right;
          }

          .materials-table td.center {
            text-align: center;
          }

          .materials-table tr:nth-child(even) {
            background: #f9fafb;
          }

          .materials-table tfoot td {
            font-weight: bold;
            background: #f3f4f6;
            border-top: 2px solid #059669;
          }

          .variance-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 8pt;
            font-weight: 600;
          }

          .variance-exact { background: #d1fae5; color: #065f46; }
          .variance-shortage { background: #fef3c7; color: #92400e; }
          .variance-excess { background: #fee2e2; color: #991b1b; }

          .summary-section {
            margin-bottom: 15px;
            border: 2px solid #7c3aed;
            border-radius: 6px;
            overflow: hidden;
          }

          .summary-header {
            background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
            color: white;
            padding: 8px 12px;
            font-weight: bold;
            font-size: 10pt;
          }

          .summary-content {
            padding: 12px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }

          .summary-item {
            text-align: center;
            padding: 10px;
            background: #f5f3ff;
            border-radius: 6px;
            border: 1px solid #ddd6fe;
          }

          .summary-value {
            font-size: 16pt;
            font-weight: bold;
            color: #7c3aed;
          }

          .summary-label {
            font-size: 8pt;
            color: #6b7280;
            margin-top: 2px;
          }

          .remarks-section {
            margin-bottom: 15px;
            padding: 10px;
            background: #fffbeb;
            border: 1px solid #fcd34d;
            border-radius: 6px;
          }

          .remarks-title {
            font-weight: bold;
            color: #92400e;
            margin-bottom: 4px;
            font-size: 9pt;
          }

          .signature-section {
            margin-top: 25px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
          }

          .signature-box {
            text-align: center;
            padding-top: 40px;
            border-top: 1px solid #1f2937;
          }

          .signature-title {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 9pt;
          }

          .signature-date {
            font-size: 8pt;
            color: #6b7280;
          }

          .footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #9ca3af;
          }

          .qr-placeholder {
            width: 50px;
            height: 50px;
            border: 1px dashed #9ca3af;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7pt;
            color: #9ca3af;
          }

          .efficiency-bar {
            margin-top: 8px;
            background: #e5e7eb;
            border-radius: 8px;
            height: 16px;
            overflow: hidden;
          }

          .efficiency-fill {
            height: 100%;
            background: linear-gradient(90deg, #059669 0%, #10b981 100%);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 8pt;
            font-weight: bold;
            min-width: 30px;
          }
        `}</style>

        {/* Header */}
        <div className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="company-name">AUSTAMGOOD CO., LTD.</div>
              <div style={{ fontSize: '8pt', color: '#6b7280' }}>
                ระบบจัดการคลังสินค้า (WMS) - Production Module
              </div>
            </div>
            <div className="qr-placeholder">QR Code</div>
          </div>
        </div>

        {/* Document Title */}
        <div className="document-title">✅ ใบรับผลิตจริง (Production Receipt)</div>
        <div className="receipt-number">
          ใบสั่งผลิต: {receipt.production_order?.production_no || '-'}
        </div>

        {/* Info Grid */}
        <div className="info-grid">
          {/* Receipt Info */}
          <div className="info-box">
            <div className="info-box-title">📋 ข้อมูลการรับผลิต</div>
            <div className="info-row">
              <span className="info-label">วันที่รับผลิต:</span>
              <span className="info-value">{formatDateTime(receipt.received_at)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Lot No.:</span>
              <span className="info-value">{receipt.lot_no || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Batch No.:</span>
              <span className="info-value">{receipt.batch_no || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ผู้บันทึก:</span>
              <span className="info-value">{producerName}</span>
            </div>
          </div>

          {/* FG Dates Info */}
          <div className="info-box">
            <div className="info-box-title">📅 วันที่สินค้าสำเร็จรูป</div>
            <div className="info-row">
              <span className="info-label">วันผลิต (MFG):</span>
              <span className="info-value">{formatDate(receipt.production_order?.production_date)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">วันหมดอายุ (EXP):</span>
              <span className="info-value">{formatDate(receipt.production_order?.expiry_date)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">สถานะใบสั่งผลิต:</span>
              <span className="info-value" style={{ color: receipt.production_order?.status === 'completed' ? '#059669' : '#d97706' }}>
                {receipt.production_order?.status === 'completed' ? 'เสร็จสิ้น' : 
                 receipt.production_order?.status === 'in_progress' ? 'กำลังผลิต' : 
                 receipt.production_order?.status || '-'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">วันที่บันทึก:</span>
              <span className="info-value">{formatDateTime(receipt.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Product Section */}
        <div className="product-section">
          <div className="product-header">🏭 สินค้าสำเร็จรูป (Finished Goods)</div>
          <div className="product-content">
            <div className="product-name">
              {receipt.product_sku?.sku_name || receipt.product_sku_id}
            </div>
            <div style={{ fontSize: '9pt', color: '#6b7280', marginBottom: '10px' }}>
              รหัสสินค้า: <strong>{receipt.product_sku_id}</strong>
            </div>
            
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value blue">{Number(fgPlanned).toLocaleString()}</div>
                <div className="stat-label">ชิ้น (แผน)</div>
              </div>
              <div className="stat-box">
                <div className="stat-value green">{Number(fgActual).toLocaleString()}</div>
                <div className="stat-label">ชิ้น (จริง)</div>
              </div>
              <div className="stat-box">
                <div className="stat-value amber">{calc?.food_actual_kg?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '-'}</div>
                <div className="stat-label">อาหารที่ใช้ (กก.)</div>
              </div>
              <div className="stat-box">
                <div className="stat-value purple">{calc?.packaging_actual_qty?.toLocaleString() || '-'}</div>
                <div className="stat-label">ถุง/สติ๊กเกอร์</div>
              </div>
            </div>

            {/* Efficiency Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '9pt' }}>ประสิทธิภาพการผลิต</span>
              <span style={{ fontSize: '9pt', color: '#6b7280' }}>
                {Number(fgActual).toLocaleString()} / {Number(fgPlanned).toLocaleString()} ชิ้น
              </span>
            </div>
            <div className="efficiency-bar">
              <div className="efficiency-fill" style={{ width: `${Math.min(Math.max(parseFloat(efficiency), 5), 100)}%` }}>
                {efficiency}%
              </div>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="summary-section">
          <div className="summary-header">📊 สรุปการใช้วัตถุดิบ</div>
          <div className="summary-content">
            <div className="summary-grid">
              <div className="summary-item">
                <div className="summary-value">{calc?.avg_weight_per_bag?.toFixed(3) || '-'}</div>
                <div className="summary-label">น้ำหนักเฉลี่ย/ถุง (กก.)</div>
              </div>
              <div className="summary-item">
                <div className="summary-value" style={{ color: '#dc2626' }}>{calc?.waste_per_piece?.toFixed(3) || '0'}</div>
                <div className="summary-label">เวสต่อชิ้น</div>
              </div>
              <div className="summary-item">
                <div className="summary-value" style={{ color: '#dc2626' }}>{calc?.total_waste?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'}</div>
                <div className="summary-label">เวสรวม</div>
              </div>
            </div>
          </div>
        </div>

        {/* Food Materials Table */}
        {calc?.food_materials && calc.food_materials.length > 0 && (
          <div className="materials-section">
            <div className="section-title">🥩 วัตถุดิบอาหาร ({calc.food_materials.length} รายการ)</div>
            <table className="materials-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th style={{ width: '25%' }}>รหัสวัตถุดิบ</th>
                  <th style={{ width: '30%' }}>ชื่อวัตถุดิบ</th>
                  <th className="right" style={{ width: '12%' }}>เบิก</th>
                  <th className="right" style={{ width: '12%' }}>ใช้จริง</th>
                  <th className="center" style={{ width: '16%' }}>ส่วนต่าง</th>
                </tr>
              </thead>
              <tbody>
                {calc.food_materials.map((item, index) => (
                  <tr key={item.sku_id}>
                    <td>{index + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{item.sku_id}</td>
                    <td>{item.sku_name}</td>
                    <td className="right">{item.issued_qty.toLocaleString()} {item.uom}</td>
                    <td className="right" style={{ fontWeight: 'bold' }}>{item.actual_qty.toLocaleString()} {item.uom}</td>
                    <td className="center">
                      <span className={`variance-badge ${getVarianceClass(item.variance_type)}`}>
                        {item.variance_qty > 0 ? '+' : ''}{item.variance_qty.toLocaleString()} ({getVarianceTypeText(item.variance_type)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right' }}>รวม:</td>
                  <td className="right">{calc.food_materials.reduce((sum, m) => sum + m.issued_qty, 0).toLocaleString()}</td>
                  <td className="right" style={{ fontWeight: 'bold' }}>{calc.food_materials.reduce((sum, m) => sum + m.actual_qty, 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Packaging Materials Table */}
        {calc?.packaging_materials && calc.packaging_materials.length > 0 && (
          <div className="materials-section">
            <div className="section-title">📦 วัสดุบรรจุภัณฑ์ ({calc.packaging_materials.length} รายการ)</div>
            <table className="materials-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th style={{ width: '25%' }}>รหัสวัตถุดิบ</th>
                  <th style={{ width: '30%' }}>ชื่อวัตถุดิบ</th>
                  <th className="right" style={{ width: '12%' }}>เบิก</th>
                  <th className="right" style={{ width: '12%' }}>ใช้จริง</th>
                  <th className="center" style={{ width: '16%' }}>ส่วนต่าง</th>
                </tr>
              </thead>
              <tbody>
                {calc.packaging_materials.map((item, index) => (
                  <tr key={item.sku_id}>
                    <td>{index + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{item.sku_id}</td>
                    <td>{item.sku_name}</td>
                    <td className="right">{item.issued_qty.toLocaleString()} {item.uom}</td>
                    <td className="right" style={{ fontWeight: 'bold' }}>{item.actual_qty.toLocaleString()} {item.uom}</td>
                    <td className="center">
                      <span className={`variance-badge ${getVarianceClass(item.variance_type)}`}>
                        {item.variance_qty > 0 ? '+' : ''}{item.variance_qty.toLocaleString()} ({getVarianceTypeText(item.variance_type)})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right' }}>รวม:</td>
                  <td className="right">{calc.packaging_materials.reduce((sum, m) => sum + m.issued_qty, 0).toLocaleString()}</td>
                  <td className="right" style={{ fontWeight: 'bold' }}>{calc.packaging_materials.reduce((sum, m) => sum + m.actual_qty, 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Remarks */}
        {receipt.remarks && (
          <div className="remarks-section">
            <div className="remarks-title">📝 หมายเหตุ:</div>
            <div style={{ fontSize: '9pt' }}>{receipt.remarks}</div>
          </div>
        )}

        {/* Signature Section */}
        <div className="signature-section">
          <div className="signature-box">
            <div className="signature-title">ผู้ผลิต</div>
            <div className="signature-date">ชื่อ: ____________________</div>
            <div className="signature-date">วันที่: ____/____/____</div>
          </div>
          <div className="signature-box">
            <div className="signature-title">ผู้ตรวจสอบ QC</div>
            <div className="signature-date">ชื่อ: ____________________</div>
            <div className="signature-date">วันที่: ____/____/____</div>
          </div>
          <div className="signature-box">
            <div className="signature-title">หัวหน้าฝ่ายผลิต</div>
            <div className="signature-date">ชื่อ: ____________________</div>
            <div className="signature-date">วันที่: ____/____/____</div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <div>พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}</div>
          <div>เอกสารนี้สร้างโดยระบบ WMS อัตโนมัติ</div>
          <div>หน้า 1/1</div>
        </div>
      </div>
    );
  }
);

ProductionReceiptPrintDocument.displayName = 'ProductionReceiptPrintDocument';

export default ProductionReceiptPrintDocument;
