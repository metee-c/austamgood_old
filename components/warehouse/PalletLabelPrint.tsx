'use client';

import React, { useRef, useEffect } from 'react';
import { Printer } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface PalletLabelData {
  barcode: string;
  sku_id: string;
  product_name: string;
  pack_quantity: number;
  piece_quantity: number;
  expiry_date?: string;
  production_date?: string;
  manufacture_date?: string;
  pallet_id_external?: string;
  receiver_name?: string;
}

interface PalletLabelPrintProps {
  data: PalletLabelData;
  size?: 'sm' | 'md';
}

const PalletLabelPrint: React.FC<PalletLabelPrintProps> = ({ data, size = 'sm' }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeTopRef = useRef<SVGSVGElement>(null);

  // Format date to Thai format (DD/MM/YYYY)
  const formatThaiDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Generate barcode when component mounts or data changes
  useEffect(() => {
    if (barcodeTopRef.current && data.barcode) {
      try {
        JsBarcode(barcodeTopRef.current, data.barcode, {
          format: 'CODE128',
          width: 2,
          height: 45,
          displayValue: false,
          margin: 0
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [data.barcode]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Pallet Label - ${data.barcode}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            @page {
              size: 4in 6in;
              margin: 0;
            }

            body {
              font-family: 'Arial', 'Sarabun', sans-serif;
              background: white;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }

            .label-container {
              width: 4in;
              height: 6in;
              background: white;
              border: none;
              padding: 4px;
              display: flex;
              flex-direction: column;
              page-break-after: always;
            }

            .barcode-section {
              border: 1px solid black;
              padding: 4px;
              text-align: center;
              margin-bottom: 3px;
            }

            .barcode-image {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 2px 0;
            }

            .barcode-image svg {
              max-width: 100%;
              height: auto;
            }

            .barcode-text {
              font-size: 16px;
              font-weight: bold;
              letter-spacing: 1px;
              margin-top: 2px;
              font-family: 'Courier New', monospace;
            }

            .info-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .info-row {
              border: 1px solid black;
              padding: 6px 8px;
              display: flex;
              align-items: center;
              min-height: 35px;
              margin-bottom: 0;
            }

            .info-label {
              font-weight: bold;
              font-size: 15px;
              min-width: auto;
              margin-right: 8px;
            }

            .info-value {
              font-size: 17px;
              font-weight: 600;
              flex: 1;
            }

            .quantity-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
              margin-bottom: 6px;
            }

            .quantity-box {
              border: 1px solid black;
              padding: 12px;
              text-align: center;
              background: white;
            }

            .quantity-label {
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 6px;
            }

            .quantity-value {
              font-size: 32px;
              font-weight: bold;
            }

            .date-section {
              border: 1px solid black;
              padding: 4px 8px;
              margin-bottom: 3px;
              text-align: center;
            }

            .date-row {
              display: flex;
              justify-content: center;
              padding: 0;
            }

            .date-label {
              font-weight: bold;
              font-size: 14px;
            }


            @media print {
              body {
                background: white;
                margin: 0;
                padding: 0;
              }

              .label-container {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <>
      <button
        onClick={handlePrint}
        className="p-1 hover:bg-gray-100 rounded transition-colors"
        title="พิมพ์ลาเบลพาเลท"
      >
        <Printer className="w-4 h-4 text-gray-600 hover:text-blue-600" />
      </button>

      {/* Hidden print content */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <div className="label-container">
            {/* Barcode Section */}
            <div className="barcode-section">
              <div className="barcode-image">
                <svg ref={barcodeTopRef}></svg>
              </div>
              <div className="barcode-text">{data.barcode}</div>
            </div>

            {/* Main Info Table */}
            <div style={{ border: '1px solid black', padding: '6px', marginBottom: '3px' }}>
              {/* วันที่รับสินค้า */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid black' }}>
                <span className="info-label">วันที่รับสินค้า :</span>
                <span className="info-value" style={{ fontSize: '14px' }}>
                  {formatThaiDate(data.production_date)}
                </span>
              </div>

              {/* SKU */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid black' }}>
                <span className="info-label">SKU : </span>
                <span className="info-value" style={{ textAlign: 'left' }}>{data.sku_id}</span>
              </div>

              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid black', minHeight: '50px' }}>
                <span className="info-label">Name : </span>
                <span className="info-value" style={{ fontSize: '14px', lineHeight: '1.5', textAlign: 'left' }}>
                  {data.product_name}
                </span>
              </div>

              {/* Quantities */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', paddingTop: '6px' }}>
                <div style={{ textAlign: 'center', padding: '8px', borderRight: '1px solid black' }}>
                  <div className="quantity-label">จำนวนแพ็ค</div>
                  <div className="quantity-value">{data.pack_quantity.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '8px' }}>
                  <div className="quantity-label">จำนวนชิ้น</div>
                  <div className="quantity-value">{data.piece_quantity.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Dates Section */}
            <div style={{ border: '1px solid black', padding: '6px' }}>
              {/* Detail Header */}
              <div style={{ textAlign: 'center', padding: '4px', borderBottom: '1px solid black', marginBottom: '4px' }}>
                <span className="date-label">รายละเอียดวันรับ/วันหมดอายุ</span>
              </div>

              {/* วันที่ผลิต */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid black' }}>
                <span className="info-label" style={{ fontSize: '24px' }}>วันที่ผลิต :</span>
                <span className="info-value" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {formatThaiDate(data.manufacture_date)}
                </span>
              </div>

              {/* วันที่หมดอายุ */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
                <span className="info-label" style={{ fontSize: '24px' }}>วันที่หมดอายุ :</span>
                <span className="info-value" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {formatThaiDate(data.expiry_date)}
                </span>
              </div>
            </div>

            {/* Receiver Section */}
            <div style={{ border: '1px solid black', padding: '10px', marginTop: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="info-label" style={{ fontSize: '18px' }}>ชื่อผู้รับ :</span>
                <span className="info-value" style={{ fontSize: '18px', borderBottom: '1px dotted black', minHeight: '30px', display: 'inline-block' }}>
                  {data.receiver_name || ''}
                </span>
              </div>
            </div>

            {/* Large Pallet ID Section */}
            <div style={{ border: '2px solid black', padding: '12px', marginTop: '3px', textAlign: 'center', background: '#f5f5f5' }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '1px', fontFamily: "'Courier New', monospace" }}>
                {data.barcode}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default PalletLabelPrint;
