import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Define CSV headers based on preparation_area table structure
    const headers = [
      'area_code*',
      'area_name*',
      'description',
      'warehouse_id*',
      'zone*',
      'area_type*',
      'capacity_sqm',
      'current_utilization_pct',
      'max_capacity_pallets',
      'current_pallets',
      'status*',
      'created_by',
      'updated_by'
    ];

    // Define example data
    const exampleData = [
      [
        'PREP001',
        'พื้นที่บรรจุภัณฑ์ A',
        'พื้นที่สำหรับบรรจุภัณฑ์สินค้าประเภท A',
        'WH001',
        'ZONE_A',
        'packing',
        '100.50',
        '0.00',
        '50',
        '0',
        'active',
        'admin',
        'admin'
      ],
      [
        'PREP002',
        'พื้นที่ตรวจสอบคุณภาพ B',
        'พื้นที่สำหรับตรวจสอบคุณภาพสินค้า',
        'WH001',
        'ZONE_B',
        'quality_check',
        '75.00',
        '0.00',
        '30',
        '0',
        'active',
        'admin',
        'admin'
      ],
      [
        'PREP003',
        'พื้นที่รวมสินค้า C',
        'พื้นที่สำหรับรวมสินค้าก่อนจัดส่ง',
        'WH002',
        'ZONE_C',
        'consolidation',
        '150.00',
        '0.00',
        '100',
        '0',
        'active',
        'admin',
        'admin'
      ]
    ];

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...exampleData.map(row => 
        row.map(field => {
          // Escape commas and quotes in fields
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        }).join(',')
      )
    ].join('\n');

    // Add UTF-8 BOM for proper Thai character encoding
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // Create response
    const response = new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="preparation_areas_template.csv"'
      }
    });

    return response;
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
