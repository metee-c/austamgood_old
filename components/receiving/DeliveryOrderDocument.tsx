'use client';
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

interface Loadlist {
  id: number;
  loadlist_code: string;
  status: string;
  loading_door_number?: string;
  loading_queue_number?: string;
  vehicle_type?: string;
  delivery_number?: string;
  driver_phone?: string;
  created_at: string;
  created_by?: string;
  plan_id?: number;
  trip_id?: number;
  route_plan?: {
    plan_code: string;
    plan_date: string;
  };
  trip?: {
    trip_code: string;
  };
  vehicle?: {
    vehicle_id: string;
    plate_number: string;
    vehicle_type: string;
  };
  driver?: {
    employee_id: number;
    first_name: string;
    last_name: string;
  };
  checker_employee?: {
    first_name: string;
    last_name: string;
  };
  helper_employee?: {
    first_name: string;
    last_name: string;
  };
  picklists: Array<{
    id: number;
    picklist_code: string;
    status: string;
    total_lines: number;
    loading_door_number?: string;
    trip: {
      trip_code: string;
      vehicle?: { plate_number: string };
    };
    orders?: Array<{
      order_no: string;
      shop_name: string;
      total_weight?: number | string;
    }>;
  }>;
}

interface DeliveryOrderDocumentProps {
  loadlist: Loadlist;
  generatedAt: string;
}

const DeliveryOrderDocument: React.FC<DeliveryOrderDocumentProps> = ({
  loadlist,
  generatedAt
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')} ${
      ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
       'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][date.getMonth() + 1]
    } ${date.getFullYear() + 543}`;
  };

  return (
    <>
      <style>{`
        @media print {
          .print-header {
            display: block;
            position: running(header);
          }
          @page {
            margin: 15mm;
            @top-center {
              content: element(header);
            }
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
      <div style={{
        fontFamily: 'Sarabun, Noto Sans Thai, sans-serif',
        fontSize: '9pt',
        lineHeight: '1.4',
        padding: '10mm',
        maxWidth: '210mm',
        margin: '0 auto',
        backgroundColor: 'white'
      }}>
        {/* Header with QR Code and Title */}
        <div className="print-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px',
          borderBottom: '1px solid #000',
          paddingBottom: '10px'
        }}>
        <div style={{ marginRight: '15px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            padding: '8px',
            border: '2px solid #ccc',
            borderRadius: '8px',
            backgroundColor: '#fff'
          }}>
            <QRCodeSVG
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/mobile/loading/${loadlist.loadlist_code}`}
              size={80}
              level="M"
            />
          </div>
          <div style={{
            fontSize: '7pt',
            color: '#666',
            marginTop: '5px',
            fontFamily: 'monospace'
          }}>
            {loadlist.loadlist_code}
          </div>
          <div style={{
            fontSize: '6.5pt',
            color: '#999',
            marginTop: '2px'
          }}>
            สแกนเพื่อโหลดสินค้าขึ้นรถ
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1 style={{
            fontSize: '18pt',
            fontWeight: 'bold',
            margin: '0 0 5px 0',
            color: '#000'
          }}>
            ใบรายละเอียดการจัดส่งสินค้า
          </h1>
          <div style={{ fontSize: '8pt' }}>Delivery Order Document</div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: '15px' }}>
          <div style={{ marginBottom: '5px' }}>
            <strong>เลขที่เอกสาร:</strong> {loadlist.delivery_number || loadlist.loadlist_code}
          </div>
          <div style={{ marginBottom: '3px' }}>
            <strong>วันที่ปริ้น:</strong> {formatDate(loadlist.created_at)}
          </div>
          <div style={{ marginBottom: '5px' }}>
            <strong>วันที่ส่ง:</strong> {loadlist.route_plan?.plan_date ? formatDate(loadlist.route_plan.plan_date) : '-'}
          </div>
          <div style={{ marginTop: '5px' }}>
            <Barcode
              value={loadlist.delivery_number || loadlist.loadlist_code}
              width={1}
              height={30}
              fontSize={10}
              margin={0}
            />
          </div>
        </div>
      </div>

      {/* Reference Info Section */}
      <table style={{
        width: '100%',
        marginBottom: '10px',
        borderCollapse: 'collapse',
        border: '2px solid #000',
        fontSize: '7.5pt'
      }}>
        <tbody>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <td style={{
              padding: '5px 6px',
              borderRight: '1px solid #000',
              width: '16.66%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'top'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>รหัสใบโหลด</div>
              <div style={{ fontSize: '8.5pt' }}>{loadlist.loadlist_code}</div>
            </td>
            <td style={{
              padding: '5px 6px',
              borderRight: '1px solid #000',
              width: '16.66%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'top'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>รหัสแผนส่ง</div>
              <div style={{ fontSize: '8.5pt' }}>{loadlist.route_plan?.plan_code || '-'}</div>
            </td>
            <td style={{
              padding: '5px 6px',
              borderRight: '1px solid #000',
              width: '16.66%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'top'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>รหัสเที่ยวรถ</div>
              <div style={{ fontSize: '8.5pt' }}>{loadlist.trip?.trip_code || '-'}</div>
            </td>
            <td style={{
              padding: '5px 6px',
              borderRight: '1px solid #000',
              width: '16.66%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'top'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>ประตูโหลด</div>
              <div style={{ fontSize: '8.5pt' }}>
                {loadlist.picklists && loadlist.picklists.length > 0 && loadlist.picklists[0].loading_door_number 
                  ? loadlist.picklists[0].loading_door_number 
                  : '-'}
              </div>
            </td>
            <td style={{
              padding: '5px 6px',
              borderRight: '1px solid #000',
              width: '16.66%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'top'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>คิว</div>
              <div style={{ fontSize: '8.5pt' }}>{loadlist.loading_queue_number || '-'}</div>
            </td>
            <td style={{
              padding: '5px 6px',
              width: '16.66%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'top'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>ผู้เช็คโหลด</div>
              <div style={{ fontSize: '8.5pt' }}>
                {loadlist.checker_employee ? `${loadlist.checker_employee.first_name} ${loadlist.checker_employee.last_name}` : '-'}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Delivery Info */}
      <div style={{
        padding: '8px',
        marginBottom: '12px',
        border: '0.5px solid #666'
      }}>
        <h3 style={{ fontSize: '9pt', margin: '0 0 6px 0', fontWeight: 'bold' }}>
          ข้อมูลงานจัดส่ง
        </h3>
        <div style={{ fontSize: '8.5pt', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>ทะเบียนรถ:</strong> {loadlist.vehicle?.plate_number || '_______________'}
            <span style={{ marginLeft: '20px' }}>
              <strong>ประเภทรถ:</strong> {loadlist.vehicle?.vehicle_type || '_______________'}
            </span>
          </div>
          <div>
            <strong>เบอร์โทรคนขับ:</strong> {loadlist.driver_phone || '_______________'}
            <span style={{ marginLeft: '20px' }}>
              <strong>ชื่อเด็กติดรถ:</strong> {loadlist.helper_employee ? `${loadlist.helper_employee.first_name} ${loadlist.helper_employee.last_name}` : '_______________'}
            </span>
          </div>
        </div>
      </div>

      {/* Picklists Table */}
      <div style={{ marginBottom: '10px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid #000',
          fontSize: '8.5pt'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{
                border: '1px solid #000',
                padding: '8px 4px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '5%'
              }}>ลำดับ</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px 4px',
                textAlign: 'left',
                fontWeight: 'bold',
                width: '18%'
              }}>เลขที่ IV</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px 4px',
                textAlign: 'left',
                fontWeight: 'bold',
                width: '37%'
              }}>ชื่อรายการ</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px 4px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '12%'
              }}>รวมน้ำหนัก</th>
              <th style={{
                border: '1px solid #000',
                padding: '8px 4px',
                textAlign: 'center',
                fontWeight: 'bold',
                width: '28%'
              }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Flatten all orders from all picklists
              const allOrders: Array<{ order_no: string; shop_name: string }> = [];
              loadlist.picklists.forEach(picklist => {
                if (picklist.orders && picklist.orders.length > 0) {
                  allOrders.push(...picklist.orders);
                }
              });

              return (
                <>
                  {allOrders.map((order, index) => (
                    <tr key={`order-${index}`}>
                      <td style={{
                        border: '1px solid #000',
                        padding: '5px 4px',
                        textAlign: 'center'
                      }}>
                        {index + 1}
                      </td>
                      <td style={{
                        border: '1px solid #000',
                        padding: '5px 4px'
                      }}>
                        {order.order_no}
                      </td>
                      <td style={{
                        border: '1px solid #000',
                        padding: '5px 4px'
                      }}>
                        {order.shop_name || '-'}
                      </td>
                      <td style={{
                        border: '1px solid #000',
                        padding: '5px 4px',
                        textAlign: 'right'
                      }}>
                        {(order as any).total_weight ? Number((order as any).total_weight).toFixed(1) : ''}
                      </td>
                      <td style={{
                        border: '1px solid #000',
                        padding: '5px 4px'
                      }}>
                      </td>
                    </tr>
                  ))}
                  {/* Add 5 empty rows after data rows */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td style={{
                        border: '1px solid #000',
                        padding: '5px 4px',
                        textAlign: 'center',
                        height: '22px'
                      }}></td>
                      <td style={{ border: '1px solid #000', padding: '5px 4px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '5px 4px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '5px 4px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '5px 4px' }}></td>
                    </tr>
                  ))}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Signatures */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '30px',
        marginTop: '60px',
        fontSize: '9pt'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '40px' }}></div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>
            <div style={{ fontWeight: 'bold' }}>ผู้ออกเอกสาร</div>
            <div style={{ fontSize: '8pt' }}>(พนักงานขับรถ)</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '40px' }}></div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>
            <div style={{ fontWeight: 'bold' }}>พนักงานขับรถ</div>
            <div style={{ fontSize: '8pt' }}>(ผู้รับเอกสาร)</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '40px' }}></div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '5px' }}>
            <div style={{ fontWeight: 'bold' }}>ผู้รับเอกสาร</div>
            <div style={{ fontSize: '8pt' }}>(ลูกค้า/ผู้รับมอบ)</div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default DeliveryOrderDocument;
