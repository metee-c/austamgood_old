/**
 * Production Order Print Document
 * เอกสารใบสั่งผลิตสำหรับปริ้น - A4 แนวตั้ง
 */

'use client';

import React, { forwardRef } from 'react';
import { ProductionOrderWithDetails } from '@/types/production-order-schema';

interface ProductionOrderPrintDocumentProps {
  order: ProductionOrderWithDetails;
}

const ProductionOrderPrintDocument = forwardRef<HTMLDivElement, ProductionOrderPrintDocumentProps>(
  ({ order }, ref) => {
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

    const getStatusText = (status: string) => {
      const statusMap: Record<string, string> = {
        planned: 'วางแผน',
        released: 'ปล่อยงาน',
        in_progress: 'กำลังผลิต',
        completed: 'เสร็จสิ้น',
        on_hold: 'พักงาน',
        cancelled: 'ยกเลิก',
      };
      return statusMap[status] || status;
    };

    const getItemStatusText = (status: string) => {
      const statusMap: Record<string, string> = {
        pending: 'รอเบิก',
        partial: 'เบิกบางส่วน',
        issued: 'เบิกแล้ว',
        returned: 'คืนแล้ว',
      };
      return statusMap[status] || status;
    };

    const getPriorityText = (priority: number) => {
      if (priority <= 3) return 'สูง';
      if (priority <= 6) return 'ปานกลาง';
      return 'ต่ำ';
    };

    const totalRequiredQty = order.items?.reduce((sum, item) => sum + Number(item.required_qty || 0), 0) || 0;
    const totalIssuedQty = order.items?.reduce((sum, item) => sum + Number(item.issued_qty || 0), 0) || 0;
    const progressPercent = order.quantity > 0 ? Math.round((Number(order.produced_qty || 0) / Number(order.quantity)) * 100) : 0;

    return (
      <div ref={ref} className="print-document">
        <style jsx>{`
          .print-document {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            margin: 0 auto;
            background: white;
            font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
            font-size: 11pt;
            color: #1a1a1a;
            line-height: 1.4;
          }
          
          @media print {
            .print-document {
              width: 100%;
              padding: 10mm;
              margin: 0;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }

          .header {
            border-bottom: 3px solid #1e40af;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }

          .company-name {
            font-size: 18pt;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 4px;
          }

          .document-title {
            font-size: 16pt;
            font-weight: bold;
            text-align: center;
            color: #1e3a5f;
            margin: 15px 0;
            padding: 8px;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border-radius: 6px;
          }

          .order-number {
            font-size: 14pt;
            font-weight: bold;
            color: #1e40af;
            text-align: center;
            margin-bottom: 15px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }

          .info-box {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            background: #fafafa;
          }

          .info-box-title {
            font-size: 10pt;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px dotted #e5e7eb;
          }

          .info-row:last-child {
            border-bottom: none;
          }

          .info-label {
            color: #6b7280;
            font-size: 10pt;
          }

          .info-value {
            font-weight: 600;
            color: #1f2937;
          }

          .product-section {
            margin-bottom: 20px;
            border: 2px solid #1e40af;
            border-radius: 8px;
            overflow: hidden;
          }

          .product-header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 10px 15px;
            font-weight: bold;
            font-size: 11pt;
          }

          .product-content {
            padding: 15px;
          }

          .product-name {
            font-size: 13pt;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
          }

          .product-details {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }

          .product-stat {
            text-align: center;
            padding: 10px;
            background: #f3f4f6;
            border-radius: 6px;
          }

          .product-stat-value {
            font-size: 16pt;
            font-weight: bold;
            color: #1e40af;
          }

          .product-stat-label {
            font-size: 9pt;
            color: #6b7280;
            margin-top: 2px;
          }

          .materials-section {
            margin-bottom: 20px;
          }

          .section-title {
            font-size: 12pt;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
            padding: 8px 12px;
            background: #f3f4f6;
            border-left: 4px solid #1e40af;
          }

          .materials-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
          }

          .materials-table th {
            background: #1e40af;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
          }

          .materials-table th:nth-child(3),
          .materials-table th:nth-child(4),
          .materials-table th:nth-child(5) {
            text-align: right;
          }

          .materials-table td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
          }

          .materials-table td:nth-child(3),
          .materials-table td:nth-child(4),
          .materials-table td:nth-child(5) {
            text-align: right;
          }

          .materials-table tr:nth-child(even) {
            background: #f9fafb;
          }

          .materials-table tr:hover {
            background: #eff6ff;
          }

          .materials-table tfoot td {
            font-weight: bold;
            background: #f3f4f6;
            border-top: 2px solid #1e40af;
          }

          .status-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 9pt;
            font-weight: 600;
          }

          .status-pending { background: #fef3c7; color: #92400e; }
          .status-partial { background: #dbeafe; color: #1e40af; }
          .status-issued { background: #d1fae5; color: #065f46; }
          .status-returned { background: #fee2e2; color: #991b1b; }

          .progress-section {
            margin-bottom: 20px;
          }

          .progress-bar-container {
            background: #e5e7eb;
            border-radius: 10px;
            height: 20px;
            overflow: hidden;
            margin-top: 8px;
          }

          .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 9pt;
            font-weight: bold;
            min-width: 30px;
          }

          .remarks-section {
            margin-bottom: 20px;
            padding: 12px;
            background: #fffbeb;
            border: 1px solid #fcd34d;
            border-radius: 6px;
          }

          .remarks-title {
            font-weight: bold;
            color: #92400e;
            margin-bottom: 5px;
          }

          .signature-section {
            margin-top: 30px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }

          .signature-box {
            text-align: center;
            padding-top: 50px;
            border-top: 1px solid #1f2937;
          }

          .signature-title {
            font-weight: 600;
            margin-bottom: 5px;
          }

          .signature-date {
            font-size: 9pt;
            color: #6b7280;
          }

          .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #9ca3af;
          }

          .qr-placeholder {
            width: 60px;
            height: 60px;
            border: 1px dashed #9ca3af;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8pt;
            color: #9ca3af;
          }
        `}</style>

        {/* Header */}
        <div className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="company-name">AUSTAMGOOD CO., LTD.</div>
              <div style={{ fontSize: '9pt', color: '#6b7280' }}>
                ระบบจัดการคลังสินค้า (WMS)
              </div>
            </div>
            <div className="qr-placeholder">QR Code</div>
          </div>
        </div>

        {/* Document Title */}
        <div className="document-title">📋 ใบสั่งผลิต (Production Order)</div>
        <div className="order-number">เลขที่: {order.production_no}</div>

        {/* Info Grid */}
        <div className="info-grid">
          {/* Order Info */}
          <div className="info-box">
            <div className="info-box-title">📌 ข้อมูลใบสั่งผลิต</div>
            <div className="info-row">
              <span className="info-label">สถานะ:</span>
              <span className="info-value">{getStatusText(order.status)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ความสำคัญ:</span>
              <span className="info-value">{getPriorityText(order.priority)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">วันที่เริ่ม:</span>
              <span className="info-value">{formatDate(order.start_date)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">กำหนดเสร็จ:</span>
              <span className="info-value">{formatDate(order.due_date)}</span>
            </div>
          </div>

          {/* Plan Info */}
          <div className="info-box">
            <div className="info-box-title">📊 ข้อมูลแผนการผลิต</div>
            <div className="info-row">
              <span className="info-label">รหัสแผน:</span>
              <span className="info-value">{order.plan?.plan_no || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ชื่อแผน:</span>
              <span className="info-value">{order.plan?.plan_name || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ผู้สร้าง:</span>
              <span className="info-value">
                {order.creator?.nickname || 
                 `${order.creator?.first_name || ''} ${order.creator?.last_name || ''}`.trim() || 
                 '-'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">วันที่สร้าง:</span>
              <span className="info-value">{formatDateTime(order.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Product Section */}
        <div className="product-section">
          <div className="product-header">🏭 สินค้าที่ผลิต (Finished Goods)</div>
          <div className="product-content">
            <div className="product-name">
              {order.sku?.sku_name || order.sku_id}
            </div>
            <div style={{ fontSize: '10pt', color: '#6b7280', marginBottom: '15px' }}>
              รหัสสินค้า: <strong>{order.sku_id}</strong>
              {order.sku?.category && ` | หมวดหมู่: ${order.sku.category}`}
              {order.sku?.sub_category && ` > ${order.sku.sub_category}`}
            </div>
            <div className="product-details">
              <div className="product-stat">
                <div className="product-stat-value">{Number(order.quantity).toLocaleString()}</div>
                <div className="product-stat-label">จำนวนสั่งผลิต ({order.uom || order.sku?.uom_base || 'ชิ้น'})</div>
              </div>
              <div className="product-stat">
                <div className="product-stat-value" style={{ color: '#059669' }}>
                  {Number(order.produced_qty || 0).toLocaleString()}
                </div>
                <div className="product-stat-label">ผลิตได้แล้ว</div>
              </div>
              <div className="product-stat">
                <div className="product-stat-value" style={{ color: '#dc2626' }}>
                  {Number(order.remaining_qty || (Number(order.quantity) - Number(order.produced_qty || 0))).toLocaleString()}
                </div>
                <div className="product-stat-label">คงเหลือ</div>
              </div>
              <div className="product-stat">
                <div className="product-stat-value" style={{ color: '#7c3aed' }}>
                  {progressPercent}%
                </div>
                <div className="product-stat-label">ความคืบหน้า</div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>ความคืบหน้าการผลิต</span>
            <span style={{ fontSize: '10pt', color: '#6b7280' }}>
              {Number(order.produced_qty || 0).toLocaleString()} / {Number(order.quantity).toLocaleString()} {order.uom || order.sku?.uom_base || 'ชิ้น'}
            </span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${Math.max(progressPercent, 5)}%` }}>
              {progressPercent}%
            </div>
          </div>
        </div>

        {/* Materials Section */}
        {order.items && order.items.length > 0 && (
          <div className="materials-section">
            <div className="section-title">📦 รายการวัตถุดิบที่ต้องใช้ ({order.items.length} รายการ)</div>
            <table className="materials-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th style={{ width: '20%' }}>รหัสวัตถุดิบ</th>
                  <th style={{ width: '35%' }}>ชื่อวัตถุดิบ</th>
                  <th style={{ width: '12%' }}>ต้องใช้</th>
                  <th style={{ width: '12%' }}>เบิกแล้ว</th>
                  <th style={{ width: '16%' }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '9pt' }}>{item.material_sku_id}</td>
                    <td>{item.material_sku?.sku_name || item.material_sku_id}</td>
                    <td>{Number(item.required_qty).toLocaleString()} {item.uom || item.material_sku?.uom_base || ''}</td>
                    <td style={{ color: Number(item.issued_qty) > 0 ? '#059669' : '#6b7280' }}>
                      {Number(item.issued_qty || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {getItemStatusText(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right' }}>รวมทั้งหมด:</td>
                  <td>{totalRequiredQty.toLocaleString()}</td>
                  <td style={{ color: '#059669' }}>{totalIssuedQty.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Remarks */}
        {order.remarks && (
          <div className="remarks-section">
            <div className="remarks-title">📝 หมายเหตุ:</div>
            <div>{order.remarks}</div>
          </div>
        )}

        {/* Actual Dates */}
        {(order.actual_start_date || order.actual_completion_date) && (
          <div className="info-box" style={{ marginBottom: '20px' }}>
            <div className="info-box-title">⏱️ วันที่ดำเนินการจริง</div>
            {order.actual_start_date && (
              <div className="info-row">
                <span className="info-label">เริ่มผลิตจริง:</span>
                <span className="info-value">{formatDateTime(order.actual_start_date)}</span>
              </div>
            )}
            {order.actual_completion_date && (
              <div className="info-row">
                <span className="info-label">เสร็จสิ้นจริง:</span>
                <span className="info-value">{formatDateTime(order.actual_completion_date)}</span>
              </div>
            )}
          </div>
        )}

        {/* Signature Section */}
        <div className="signature-section">
          <div className="signature-box">
            <div className="signature-title">ผู้สั่งผลิต</div>
            <div className="signature-date">วันที่: ____/____/____</div>
          </div>
          <div className="signature-box">
            <div className="signature-title">ผู้ตรวจสอบ</div>
            <div className="signature-date">วันที่: ____/____/____</div>
          </div>
          <div className="signature-box">
            <div className="signature-title">ผู้อนุมัติ</div>
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

ProductionOrderPrintDocument.displayName = 'ProductionOrderPrintDocument';

export default ProductionOrderPrintDocument;
