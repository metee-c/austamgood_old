import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const csvHeaders = [
      'strategy_code',
      'strategy_name',
      'description',
      'warehouse_id',
      'default_zone',
      'default_location_type',
      'priority',
      'status',
      'putaway_rotation',
      'allow_auto_assign',
      'effective_from',
      'effective_to'
    ];

    const sampleData = [
      {
        strategy_code: 'FIFO-PUTAWAY',
        strategy_name: 'FIFO Putaway Strategy',
        description: 'First In First Out putaway strategy for general goods',
        warehouse_id: 'WH001',
        default_zone: 'A',
        default_location_type: 'rack',
        priority: '50',
        status: 'active',
        putaway_rotation: 'FIFO',
        allow_auto_assign: 'true',
        effective_from: '2024-01-01',
        effective_to: ''
      },
      {
        strategy_code: 'LIFO-BULK',
        strategy_name: 'LIFO Bulk Storage',
        description: 'Last In First Out for bulk storage items',
        warehouse_id: 'WH001',
        default_zone: 'B',
        default_location_type: 'bulk',
        priority: '30',
        status: 'active',
        putaway_rotation: 'LIFO',
        allow_auto_assign: 'true',
        effective_from: '2024-01-01',
        effective_to: ''
      },
      {
        strategy_code: 'FEFO-PERISHABLE',
        strategy_name: 'FEFO Perishable Goods',
        description: 'First Expire First Out for perishable items',
        warehouse_id: 'WH002',
        default_zone: 'C',
        default_location_type: 'floor',
        priority: '90',
        status: 'active',
        putaway_rotation: 'FEFO',
        allow_auto_assign: 'true',
        effective_from: '2024-01-01',
        effective_to: ''
      }
    ];

    const csvContent = [
      csvHeaders.join(','),
      ...sampleData.map(row => 
        csvHeaders.map(header => {
          const value = row[header as keyof typeof row] || '';
          // Escape commas and quotes in CSV
          if (value.includes(',') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    return new NextResponse(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="storage-strategy-template.csv"',
        'Content-Length': csvBuffer.length.toString()
      }
    });
  } catch (err) {
    console.error('[storage-strategies][template] Unexpected error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
