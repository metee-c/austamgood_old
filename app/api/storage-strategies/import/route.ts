import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parse } from 'csv-parse/sync';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
export const dynamic = 'force-dynamic';

const STORAGE_STRATEGY_FIELDS = `
  strategy_id,
  strategy_code,
  strategy_name,
  description,
  warehouse_id,
  default_zone,
  default_location_type,
  priority,
  status,
  putaway_rotation,
  allow_auto_assign,
  effective_from,
  effective_to,
  created_by,
  updated_by,
  created_at,
  updated_at,
  master_warehouse (
    warehouse_name
  )
`;

async function _POST(request: NextRequest) {
try {
    const supabase = createServiceRoleClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true
    });

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'No data found in CSV file' },
        { status: 400 }
      );
    }

    const summary = {
      total: records.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; message: string }>
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;
      const rowNumber = i + 2; // +2 because CSV rows are 1-indexed and header is row 1

      try {
        // Validate required fields
        if (!record.strategy_code || !record.strategy_name || !record.warehouse_id) {
          summary.skipped++;
          summary.errors.push({
            row: rowNumber,
            message: 'Missing required fields (strategy_code, strategy_name, warehouse_id)'
          });
          continue;
        }

        // Check if strategy exists
        const { data: existingStrategy } = await supabase
          .from('storage_strategy')
          .select('strategy_id')
          .eq('strategy_code', record.strategy_code)
          .eq('warehouse_id', record.warehouse_id)
          .single();

        const strategyData = {
          strategy_code: record.strategy_code,
          strategy_name: record.strategy_name,
          description: record.description || null,
          warehouse_id: record.warehouse_id,
          default_zone: record.default_zone || null,
          default_location_type: record.default_location_type || null,
          priority: parseInt(record.priority) || 50,
          status: record.status || 'active',
          putaway_rotation: record.putaway_rotation || 'FIFO',
          allow_auto_assign: record.allow_auto_assign === 'true' || record.allow_auto_assign === '1',
          effective_from: record.effective_from || null,
          effective_to: record.effective_to || null,
          updated_by: 'system'
        };

        if (existingStrategy) {
          // Update existing strategy
          const { error: updateError } = await supabase
            .from('storage_strategy')
            .update(strategyData)
            .eq('strategy_id', existingStrategy.strategy_id);

          if (updateError) {
            summary.skipped++;
            summary.errors.push({
              row: rowNumber,
              message: `Update failed: ${updateError.message}`
            });
          } else {
            summary.updated++;
          }
        } else {
          // Insert new strategy
          const { error: insertError } = await supabase
            .from('storage_strategy')
            .insert({
              ...strategyData,
              created_by: 'system'
            });

          if (insertError) {
            summary.skipped++;
            summary.errors.push({
              row: rowNumber,
              message: `Insert failed: ${insertError.message}`
            });
          } else {
            summary.inserted++;
          }
        }
      } catch (error) {
        summary.skipped++;
        summary.errors.push({
          row: rowNumber,
          message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[storage-strategies][import] Unexpected error', err);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withShadowLog(_POST);
