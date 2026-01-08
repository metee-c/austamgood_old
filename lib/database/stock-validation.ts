import { SupabaseClient } from '@supabase/supabase-js';

export interface StockValidationResult {
  valid: boolean;
  ledgerTotal: number;
  balanceTotal: number;
  difference: number;
  message: string;
}

export interface StockHealthSummary {
  checkName: string;
  issueCount: number;
  status: string;
}

/**
 * Validate stock integrity between ledger and balance for a specific location/SKU
 */
export async function validateStockIntegrity(
  supabase: SupabaseClient,
  warehouseId: string,
  locationId: string,
  skuId: string
): Promise<StockValidationResult> {
  // Query ledger total
  const { data: ledgerData } = await supabase
    .from('wms_inventory_ledger')
    .select('direction, piece_qty')
    .eq('warehouse_id', warehouseId)
    .eq('location_id', locationId)
    .eq('sku_id', skuId);

  const ledgerTotal =
    ledgerData?.reduce(
      (sum, row) =>
        sum +
        (row.direction === 'in'
          ? Number(row.piece_qty)
          : -Number(row.piece_qty)),
      0
    ) || 0;

  // Query balance total
  const { data: balanceData } = await supabase
    .from('wms_inventory_balances')
    .select('total_piece_qty')
    .eq('warehouse_id', warehouseId)
    .eq('location_id', locationId)
    .eq('sku_id', skuId);

  const balanceTotal =
    balanceData?.reduce((sum, row) => sum + Number(row.total_piece_qty || 0), 0) || 0;

  const difference = ledgerTotal - balanceTotal;
  const isValid = Math.abs(difference) < 1;

  let message = 'OK';
  if (!isValid) {
    if (Math.abs(difference) < 100) {
      message = `Minor mismatch: ledger=${ledgerTotal}, balance=${balanceTotal}`;
    } else {
      message = `Critical mismatch: ledger=${ledgerTotal}, balance=${balanceTotal}`;
    }
  }

  return {
    valid: isValid,
    ledgerTotal,
    balanceTotal,
    difference,
    message,
  };
}

/**
 * Get stock health summary for monitoring
 */
export async function getStockHealthSummary(
  supabase: SupabaseClient
): Promise<StockHealthSummary[]> {
  const results: StockHealthSummary[] = [];

  // Check negative balances
  const { count: negativeCount } = await supabase
    .from('wms_inventory_balances')
    .select('*', { count: 'exact', head: true })
    .lt('total_piece_qty', 0);

  results.push({
    checkName: 'Negative Balances',
    issueCount: negativeCount || 0,
    status: (negativeCount || 0) > 0 ? '🟡 Warning' : '✅ OK',
  });

  // Check over-reserved (only for positive balances)
  const { count: overReservedCount } = await supabase
    .from('wms_inventory_balances')
    .select('*', { count: 'exact', head: true })
    .gt('reserved_piece_qty', 0)
    .gte('total_piece_qty', 0)
    .filter('reserved_piece_qty', 'gt', 'total_piece_qty');

  results.push({
    checkName: 'Over-Reserved Items',
    issueCount: overReservedCount || 0,
    status: (overReservedCount || 0) > 0 ? '🔴 Critical' : '✅ OK',
  });

  // Check orphan reservations
  const { data: orphanData } = await supabase.rpc('count_orphan_reservations');
  const orphanCount = orphanData || 0;

  results.push({
    checkName: 'Orphan Reservations',
    issueCount: orphanCount,
    status: orphanCount > 0 ? '🔴 Critical' : '✅ OK',
  });

  return results;
}

/**
 * Validate stock after a transaction and log warning if mismatch detected
 */
export async function validateAfterTransaction(
  supabase: SupabaseClient,
  warehouseId: string,
  locationId: string,
  skuId: string,
  transactionType: string
): Promise<void> {
  const result = await validateStockIntegrity(
    supabase,
    warehouseId,
    locationId,
    skuId
  );

  if (!result.valid) {
    console.warn(
      `[Stock Integrity Warning] ${transactionType} caused mismatch:`,
      {
        warehouseId,
        locationId,
        skuId,
        ...result,
      }
    );

    // Optionally log to audit table
    await supabase.from('audit_logs').insert({
      action: 'stock_integrity_warning',
      entity_type: 'inventory',
      entity_id: `${warehouseId}:${locationId}:${skuId}`,
      details: {
        transactionType,
        ...result,
      },
    });
  }
}
