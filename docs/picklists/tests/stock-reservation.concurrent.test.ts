/**
 * ============================================================================
 * Stock Reservation Concurrent Tests
 * ============================================================================
 * 
 * Purpose: ทดสอบ race conditions และ concurrent stock reservations
 * 
 * Run: npx jest tests/stock-reservation.concurrent.test.ts
 * 
 * Requirements:
 * - Jest + ts-jest
 * - @supabase/supabase-js
 * - Test database with seed data
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Test Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';

const TEST_CONFIG = {
  warehouseId: 'WH001',
  testSku: 'TEST-CONCURRENT-001',
  initialStock: 100,
  concurrentRequests: 5,
  requestQty: 30, // 5 requests × 30 = 150 > 100 (only some should succeed)
};

// ============================================================================
// Helper Functions
// ============================================================================

async function createTestBalance(
  supabase: SupabaseClient,
  skuId: string,
  quantity: number,
  locationId: string = 'PK001'
): Promise<number> {
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .insert({
      warehouse_id: TEST_CONFIG.warehouseId,
      location_id: locationId,
      sku_id: skuId,
      pallet_id: `PALLET-${Date.now()}`,
      total_piece_qty: quantity,
      reserved_piece_qty: 0,
      total_pack_qty: quantity,
      reserved_pack_qty: 0,
    })
    .select('balance_id')
    .single();

  if (error) throw new Error(`Failed to create test balance: ${error.message}`);
  return data.balance_id;
}

async function createTestOrder(
  supabase: SupabaseClient,
  skuId: string,
  quantity: number
): Promise<number> {
  const { data, error } = await supabase
    .from('wms_orders')
    .insert({
      order_no: `TEST-ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      warehouse_id: TEST_CONFIG.warehouseId,
      order_type: 'express',
      status: 'draft',
    })
    .select('order_id')
    .single();

  if (error) throw new Error(`Failed to create test order: ${error.message}`);

  const orderId = data.order_id;

  // Create order item
  await supabase.from('wms_order_items').insert({
    order_id: orderId,
    sku_id: skuId,
    quantity: quantity,
    uom: 'piece',
  });

  return orderId;
}

async function getBalance(
  supabase: SupabaseClient,
  skuId: string
): Promise<{ total_piece_qty: number; reserved_piece_qty: number }> {
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select('total_piece_qty, reserved_piece_qty')
    .eq('warehouse_id', TEST_CONFIG.warehouseId)
    .eq('sku_id', skuId)
    .not('pallet_id', 'like', 'VIRTUAL-%')
    .single();

  if (error) throw new Error(`Failed to get balance: ${error.message}`);
  return data;
}

async function cleanupTestData(supabase: SupabaseClient, skuId: string) {
  // Delete in correct order (child first)
  await supabase.from('face_sheet_item_reservations').delete().eq('face_sheet_item_id', -1);
  await supabase.from('face_sheet_items').delete().match({ sku_id: skuId });
  await supabase.from('face_sheets').delete().match({ warehouse_id: TEST_CONFIG.warehouseId });
  await supabase.from('wms_order_items').delete().match({ sku_id: skuId });
  await supabase.from('wms_orders').delete().match({ warehouse_id: TEST_CONFIG.warehouseId });
  await supabase.from('wms_inventory_balances').delete().match({ sku_id: skuId });
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Stock Reservation - Concurrent Tests', () => {
  let supabase: SupabaseClient;
  let testBalanceId: number;
  let testOrderIds: number[] = [];

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Cleanup any previous test data
    await cleanupTestData(supabase, TEST_CONFIG.testSku);
    
    // Create test balance with known quantity
    testBalanceId = await createTestBalance(
      supabase,
      TEST_CONFIG.testSku,
      TEST_CONFIG.initialStock
    );

    // Create test orders
    for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
      const orderId = await createTestOrder(
        supabase,
        TEST_CONFIG.testSku,
        TEST_CONFIG.requestQty
      );
      testOrderIds.push(orderId);
    }
  });

  afterAll(async () => {
    await cleanupTestData(supabase, TEST_CONFIG.testSku);
  });

  // --------------------------------------------------------------------------
  // Test 1: Race Condition Detection
  // --------------------------------------------------------------------------
  
  describe('Race Condition Detection', () => {
    it('should NOT allow overselling when multiple requests try to reserve same stock', async () => {
      // Create face sheets concurrently
      const promises = testOrderIds.map(async (orderId, index) => {
        // Small random delay to simulate real-world timing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        return supabase.rpc('create_face_sheet_with_reservation', {
          p_warehouse_id: TEST_CONFIG.warehouseId,
          p_delivery_date: new Date().toISOString().split('T')[0],
          p_order_ids: [orderId],
          p_created_by: `TEST-${index}`,
        });
      });

      const results = await Promise.allSettled(promises);

      // Count successes and failures
      const successes = results.filter(
        r => r.status === 'fulfilled' && r.value.data?.[0]?.success
      );
      const failures = results.filter(
        r => r.status === 'rejected' || !r.value?.data?.[0]?.success
      );

      console.log(`Successes: ${successes.length}, Failures: ${failures.length}`);

      // ✅ Key assertion: Should NOT have reserved more than available
      const balance = await getBalance(supabase, TEST_CONFIG.testSku);
      
      expect(balance.reserved_piece_qty).toBeLessThanOrEqual(TEST_CONFIG.initialStock);
      console.log(`Final reserved: ${balance.reserved_piece_qty} / ${TEST_CONFIG.initialStock}`);
    });

    it('should have proper error messages for failed reservations', async () => {
      // Create a new order that will fail due to insufficient stock
      const orderId = await createTestOrder(supabase, TEST_CONFIG.testSku, 1000);

      const { data, error } = await supabase.rpc('create_face_sheet_with_reservation', {
        p_warehouse_id: TEST_CONFIG.warehouseId,
        p_delivery_date: new Date().toISOString().split('T')[0],
        p_order_ids: [orderId],
        p_created_by: 'TEST-ERROR',
      });

      const result = data?.[0];

      // Should fail with proper error message
      expect(result?.success).toBe(false);
      expect(result?.message).toContain('สต็อค');
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: Transaction Atomicity
  // --------------------------------------------------------------------------

  describe('Transaction Atomicity', () => {
    it('should rollback face sheet if reservation fails', async () => {
      // Get count before
      const { count: beforeCount } = await supabase
        .from('face_sheets')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_id', TEST_CONFIG.warehouseId);

      // Try to create face sheet with SKU that has no stock
      const orderId = await createTestOrder(supabase, 'NO-STOCK-SKU', 100);

      const { data } = await supabase.rpc('create_face_sheet_with_reservation', {
        p_warehouse_id: TEST_CONFIG.warehouseId,
        p_delivery_date: new Date().toISOString().split('T')[0],
        p_order_ids: [orderId],
        p_created_by: 'TEST-ROLLBACK',
      });

      const result = data?.[0];

      // Should fail
      expect(result?.success).toBe(false);

      // Get count after
      const { count: afterCount } = await supabase
        .from('face_sheets')
        .select('*', { count: 'exact', head: true })
        .eq('warehouse_id', TEST_CONFIG.warehouseId);

      // ✅ Key assertion: No orphaned face sheet
      expect(afterCount).toBe(beforeCount);
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: FEFO/FIFO Ordering
  // --------------------------------------------------------------------------

  describe('FEFO/FIFO Ordering', () => {
    const skuForFefo = 'TEST-FEFO-001';

    beforeAll(async () => {
      // Create multiple balances with different expiry dates
      const today = new Date();
      
      // Balance 1: Expires soon (should be reserved first)
      await supabase.from('wms_inventory_balances').insert({
        warehouse_id: TEST_CONFIG.warehouseId,
        location_id: 'PK001',
        sku_id: skuForFefo,
        pallet_id: 'PALLET-FEFO-1',
        total_piece_qty: 50,
        reserved_piece_qty: 0,
        expiry_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // +7 days
        production_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), // -30 days
      });

      // Balance 2: Expires later (should be reserved second)
      await supabase.from('wms_inventory_balances').insert({
        warehouse_id: TEST_CONFIG.warehouseId,
        location_id: 'PK001',
        sku_id: skuForFefo,
        pallet_id: 'PALLET-FEFO-2',
        total_piece_qty: 50,
        reserved_piece_qty: 0,
        expiry_date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
        production_date: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000), // -15 days
      });
    });

    afterAll(async () => {
      await cleanupTestData(supabase, skuForFefo);
    });

    it('should reserve from earliest expiry date first (FEFO)', async () => {
      const orderId = await createTestOrder(supabase, skuForFefo, 30);

      const { data } = await supabase.rpc('create_face_sheet_with_reservation', {
        p_warehouse_id: TEST_CONFIG.warehouseId,
        p_delivery_date: new Date().toISOString().split('T')[0],
        p_order_ids: [orderId],
        p_created_by: 'TEST-FEFO',
      });

      expect(data?.[0]?.success).toBe(true);

      // Check which pallet was reserved
      const { data: balances } = await supabase
        .from('wms_inventory_balances')
        .select('pallet_id, reserved_piece_qty, expiry_date')
        .eq('sku_id', skuForFefo)
        .order('expiry_date', { ascending: true });

      // First pallet (earlier expiry) should have reservation
      expect(balances?.[0]?.reserved_piece_qty).toBe(30);
      expect(balances?.[1]?.reserved_piece_qty).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Test 4: Load Testing
  // --------------------------------------------------------------------------

  describe('Load Testing', () => {
    const skuForLoad = 'TEST-LOAD-001';
    const LOAD_TEST_REQUESTS = 20;

    beforeAll(async () => {
      // Create large stock for load test
      await createTestBalance(supabase, skuForLoad, 1000, 'PK001');
    });

    afterAll(async () => {
      await cleanupTestData(supabase, skuForLoad);
    });

    it('should handle 20 concurrent requests without data corruption', async () => {
      // Create orders
      const orderIds: number[] = [];
      for (let i = 0; i < LOAD_TEST_REQUESTS; i++) {
        const orderId = await createTestOrder(supabase, skuForLoad, 10);
        orderIds.push(orderId);
      }

      // Execute all at once
      const startTime = Date.now();
      
      const promises = orderIds.map(orderId =>
        supabase.rpc('create_face_sheet_with_reservation', {
          p_warehouse_id: TEST_CONFIG.warehouseId,
          p_delivery_date: new Date().toISOString().split('T')[0],
          p_order_ids: [orderId],
          p_created_by: 'TEST-LOAD',
        })
      );

      const results = await Promise.allSettled(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count results
      const successes = results.filter(
        r => r.status === 'fulfilled' && r.value.data?.[0]?.success
      ).length;

      console.log(`Load test: ${successes}/${LOAD_TEST_REQUESTS} succeeded in ${duration}ms`);

      // Verify data integrity
      const balance = await getBalance(supabase, skuForLoad);
      
      // ✅ Key assertion: Reserved should equal successes × 10
      expect(balance.reserved_piece_qty).toBe(successes * 10);
      
      // ✅ Key assertion: No overselling
      expect(balance.reserved_piece_qty).toBeLessThanOrEqual(1000);
    }, 30000); // 30 second timeout for load test
  });
});
