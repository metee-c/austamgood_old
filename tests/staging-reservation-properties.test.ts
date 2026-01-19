/**
 * ============================================================================
 * Staging Reservation Property-Based Tests
 * ============================================================================
 * 
 * Purpose: ทดสอบ correctness properties ของ staging reservation functions
 * 
 * Run: npm test -- tests/staging-reservation-properties.test.ts --run
 * 
 * Properties tested:
 * - Property 3: Staging Reservation Creation Completeness
 * - Property 18: Referential Integrity
 * - Property 19: Non-Negative Reserved Quantity
 * 
 * Requirements: 1.5-1.9, 6.1-6.3
 * Feature: document-verification-loading
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fc from 'fast-check';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// ============================================================================
// Test Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TEST_CONFIG = {
  warehouseId: 'WH001',
  testSkuPrefix: 'TEST-STAGING-',
  iterations: 100, // Property test iterations
};

// ============================================================================
// Type Definitions
// ============================================================================

interface StagingReservationResult {
  success: boolean;
  message: string;
  reservation_id: number | null;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  missing_items: Array<{
    document_item_id: number;
    sku_id: string;
    required_qty: number;
    reserved_qty: number;
  }>;
}

interface ReleaseResult {
  success: boolean;
  message: string;
  reservations_released: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function createTestSku(
  supabase: SupabaseClient,
  skuId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('master_sku')
    .select('sku_id')
    .eq('sku_id', skuId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('master_sku').insert({
    sku_id: skuId,
    sku_name: `Test SKU ${skuId}`,
    uom_base: 'piece',
    qty_per_pack: 1,
    created_by: 'test-system',
  });

  if (error) throw new Error(`Failed to create SKU: ${error.message}`);
}

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
      pallet_id: `PALLET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      total_piece_qty: quantity,
      reserved_piece_qty: 0,
      total_pack_qty: Math.floor(quantity / 10),
      reserved_pack_qty: 0,
    })
    .select('balance_id')
    .single();

  if (error) throw new Error(`Failed to create test balance: ${error.message}`);
  return data.balance_id;
}

async function createTestPicklist(
  supabase: SupabaseClient,
  skuId: string,
  quantity: number
): Promise<{ picklistId: number; itemId: number }> {
  // Create picklist
  const { data: picklist, error: plError } = await supabase
    .from('picklists')
    .insert({
      picklist_code: `PL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
    })
    .select('id')
    .single();

  if (plError) throw new Error(`Failed to create picklist: ${plError.message}`);

  // Create picklist item
  const { data: item, error: itemError } = await supabase
    .from('picklist_items')
    .insert({
      picklist_id: picklist.id,
      sku_id: skuId,
      quantity_piece: quantity,
      quantity_pack: Math.floor(quantity / 10),
      status: 'pending',
    })
    .select('id')
    .single();

  if (itemError) throw new Error(`Failed to create picklist item: ${itemError.message}`);

  return { picklistId: picklist.id, itemId: item.id };
}

async function getInventoryBalance(
  supabase: SupabaseClient,
  balanceId: number
): Promise<{ total_piece_qty: number; reserved_piece_qty: number }> {
  const { data, error } = await supabase
    .from('wms_inventory_balances')
    .select('total_piece_qty, reserved_piece_qty')
    .eq('balance_id', balanceId)
    .single();

  if (error) throw new Error(`Failed to get balance: ${error.message}`);
  return data;
}

async function getStagingReservation(
  supabase: SupabaseClient,
  documentType: string,
  itemId: number
): Promise<any> {
  let table: string;
  let itemColumn: string;

  if (documentType === 'picklist') {
    table = 'picklist_item_reservations';
    itemColumn = 'picklist_item_id';
  } else if (documentType === 'face_sheet') {
    table = 'face_sheet_item_reservations';
    itemColumn = 'face_sheet_item_id';
  } else {
    table = 'bonus_face_sheet_item_reservations';
    itemColumn = 'bonus_face_sheet_item_id';
  }

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(itemColumn, itemId)
    .eq('status', 'picked')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get reservation: ${error.message}`);
  }

  return data;
}

async function cleanupTestData(supabase: SupabaseClient, skuId: string) {
  try {
    // Delete reservations first
    await supabase.from('picklist_item_reservations').delete().like('picklist_item_id', '%');
    await supabase.from('picklist_items').delete().match({ sku_id: skuId });
    await supabase.from('picklists').delete().like('picklist_code', 'PL-%');
    await supabase.from('wms_inventory_balances').delete().match({ sku_id: skuId });
    await supabase.from('master_sku').delete().match({ sku_id: skuId });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Property-Based Test Suites
// ============================================================================

describe('Staging Reservation - Property-Based Tests', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing SUPABASE credentials in environment variables');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  });

  // --------------------------------------------------------------------------
  // Property 3: Staging Reservation Creation Completeness
  // --------------------------------------------------------------------------
  // Feature: document-verification-loading, Property 3
  // Validates: Requirements 1.5-1.9
  
  describe('Property 3: Staging Reservation Creation Completeness', () => {
    it('should create complete staging reservation for any picked item', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            documentType: fc.constantFrom('picklist', 'face_sheet', 'bonus_face_sheet'),
            quantity: fc.integer({ min: 1, max: 1000 }),
            locationCode: fc.constantFrom('Dispatch', 'PQTD', 'MRTD'),
          }),
          async ({ documentType, quantity, locationCode }) => {
            const skuId = `${TEST_CONFIG.testSkuPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            try {
              // Arrange: Create test data
              await createTestSku(supabase, skuId);
              const balanceId = await createTestBalance(supabase, skuId, quantity * 2, 'PK001');
              const { itemId } = await createTestPicklist(supabase, skuId, quantity);

              // Act: Create staging reservation
              const { data: result } = await supabase.rpc('create_staging_reservation_after_pick', {
                p_document_type: documentType,
                p_document_item_id: itemId,
                p_sku_id: skuId,
                p_quantity_piece: quantity,
                p_staging_location_id: locationCode,
                p_balance_id: balanceId,
                p_quantity_pack: Math.floor(quantity / 10),
              }) as { data: StagingReservationResult };

              // Assert: Reservation should be created successfully
              expect(result.success).toBe(true);
              expect(result.reservation_id).toBeGreaterThan(0);

              // Assert: Reservation should have correct properties
              const reservation = await getStagingReservation(supabase, documentType, itemId);
              expect(reservation).toBeDefined();
              expect(reservation.status).toBe('picked');
              expect(reservation.balance_id).toBe(balanceId);
              expect(reservation.staging_location_id).toBe(locationCode);
              expect(reservation.reserved_piece_qty).toBe(quantity);

              // Assert: Inventory balance should be updated
              const balance = await getInventoryBalance(supabase, balanceId);
              expect(balance.reserved_piece_qty).toBeGreaterThanOrEqual(quantity);

            } finally {
              // Cleanup
              await cleanupTestData(supabase, skuId);
            }
          }
        ),
        { numRuns: TEST_CONFIG.iterations }
      );
    }, 60000); // 60 second timeout
  });

  // --------------------------------------------------------------------------
  // Property 18: Referential Integrity
  // --------------------------------------------------------------------------
  // Feature: document-verification-loading, Property 18
  // Validates: Requirements 6.1-6.2
  
  describe('Property 18: Referential Integrity', () => {
    it('should reject staging reservation with invalid balance_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            documentType: fc.constantFrom('picklist', 'face_sheet', 'bonus_face_sheet'),
            invalidBalanceId: fc.integer({ min: 999999, max: 9999999 }), // Non-existent ID
            quantity: fc.integer({ min: 1, max: 100 }),
          }),
          async ({ documentType, invalidBalanceId, quantity }) => {
            const skuId = `${TEST_CONFIG.testSkuPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            try {
              // Arrange
              await createTestSku(supabase, skuId);
              const { itemId } = await createTestPicklist(supabase, skuId, quantity);

              // Act: Try to create reservation with invalid balance_id
              const { data: result } = await supabase.rpc('create_staging_reservation_after_pick', {
                p_document_type: documentType,
                p_document_item_id: itemId,
                p_sku_id: skuId,
                p_quantity_piece: quantity,
                p_staging_location_id: 'Dispatch',
                p_balance_id: invalidBalanceId,
              }) as { data: StagingReservationResult };

              // Assert: Should fail with proper error
              expect(result.success).toBe(false);
              expect(result.message).toContain('Invalid balance_id');
              expect(result.reservation_id).toBeNull();

            } finally {
              await cleanupTestData(supabase, skuId);
            }
          }
        ),
        { numRuns: TEST_CONFIG.iterations }
      );
    }, 60000);

    it('should reject staging reservation with invalid staging_location_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            documentType: fc.constantFrom('picklist', 'face_sheet', 'bonus_face_sheet'),
            invalidLocation: fc.string({ minLength: 10, maxLength: 20 }), // Random invalid location
            quantity: fc.integer({ min: 1, max: 100 }),
          }),
          async ({ documentType, invalidLocation, quantity }) => {
            const skuId = `${TEST_CONFIG.testSkuPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            try {
              // Arrange
              await createTestSku(supabase, skuId);
              const balanceId = await createTestBalance(supabase, skuId, quantity * 2);
              const { itemId } = await createTestPicklist(supabase, skuId, quantity);

              // Act: Try to create reservation with invalid location
              const { data: result } = await supabase.rpc('create_staging_reservation_after_pick', {
                p_document_type: documentType,
                p_document_item_id: itemId,
                p_sku_id: skuId,
                p_quantity_piece: quantity,
                p_staging_location_id: invalidLocation,
                p_balance_id: balanceId,
              }) as { data: StagingReservationResult };

              // Assert: Should fail with proper error
              expect(result.success).toBe(false);
              expect(result.message).toContain('Invalid staging_location_id');
              expect(result.reservation_id).toBeNull();

            } finally {
              await cleanupTestData(supabase, skuId);
            }
          }
        ),
        { numRuns: TEST_CONFIG.iterations }
      );
    }, 60000);
  });

  // --------------------------------------------------------------------------
  // Property 19: Non-Negative Reserved Quantity
  // --------------------------------------------------------------------------
  // Feature: document-verification-loading, Property 19
  // Validates: Requirements 6.3, 6.7
  
  describe('Property 19: Non-Negative Reserved Quantity', () => {
    it('should never allow reserved_piece_qty to become negative after operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialStock: fc.integer({ min: 100, max: 1000 }),
            reserveQty: fc.integer({ min: 1, max: 100 }),
          }),
          async ({ initialStock, reserveQty }) => {
            const skuId = `${TEST_CONFIG.testSkuPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            try {
              // Arrange: Create balance with initial stock
              await createTestSku(supabase, skuId);
              const balanceId = await createTestBalance(supabase, skuId, initialStock);
              const { picklistId, itemId } = await createTestPicklist(supabase, skuId, reserveQty);

              // Act 1: Create staging reservation
              await supabase.rpc('create_staging_reservation_after_pick', {
                p_document_type: 'picklist',
                p_document_item_id: itemId,
                p_sku_id: skuId,
                p_quantity_piece: reserveQty,
                p_staging_location_id: 'Dispatch',
                p_balance_id: balanceId,
              });

              // Assert 1: Reserved quantity should be positive
              const balanceAfterReserve = await getInventoryBalance(supabase, balanceId);
              expect(balanceAfterReserve.reserved_piece_qty).toBeGreaterThanOrEqual(0);
              expect(balanceAfterReserve.reserved_piece_qty).toBe(reserveQty);

              // Act 2: Release staging reservation
              await supabase.rpc('release_staging_reservations_after_load', {
                p_document_type: 'picklist',
                p_document_ids: [picklistId],
                p_staging_location_ids: ['Dispatch'],
              });

              // Assert 2: Reserved quantity should still be non-negative
              const balanceAfterRelease = await getInventoryBalance(supabase, balanceId);
              expect(balanceAfterRelease.reserved_piece_qty).toBeGreaterThanOrEqual(0);
              expect(balanceAfterRelease.reserved_piece_qty).toBe(0);

            } finally {
              await cleanupTestData(supabase, skuId);
            }
          }
        ),
        { numRuns: TEST_CONFIG.iterations }
      );
    }, 60000);

    it('should maintain non-negative reserved quantity across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialStock: fc.integer({ min: 500, max: 1000 }),
            operations: fc.array(
              fc.integer({ min: 1, max: 50 }),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          async ({ initialStock, operations }) => {
            const skuId = `${TEST_CONFIG.testSkuPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            try {
              // Arrange
              await createTestSku(supabase, skuId);
              const balanceId = await createTestBalance(supabase, skuId, initialStock);
              const picklistIds: number[] = [];

              // Act: Perform multiple reserve operations
              for (const qty of operations) {
                const { picklistId, itemId } = await createTestPicklist(supabase, skuId, qty);
                picklistIds.push(picklistId);

                await supabase.rpc('create_staging_reservation_after_pick', {
                  p_document_type: 'picklist',
                  p_document_item_id: itemId,
                  p_sku_id: skuId,
                  p_quantity_piece: qty,
                  p_staging_location_id: 'Dispatch',
                  p_balance_id: balanceId,
                });

                // Assert: Reserved quantity should always be non-negative
                const balance = await getInventoryBalance(supabase, balanceId);
                expect(balance.reserved_piece_qty).toBeGreaterThanOrEqual(0);
              }

              // Act: Release all reservations
              for (const picklistId of picklistIds) {
                await supabase.rpc('release_staging_reservations_after_load', {
                  p_document_type: 'picklist',
                  p_document_ids: [picklistId],
                  p_staging_location_ids: ['Dispatch'],
                });

                // Assert: Reserved quantity should still be non-negative
                const balance = await getInventoryBalance(supabase, balanceId);
                expect(balance.reserved_piece_qty).toBeGreaterThanOrEqual(0);
              }

              // Final assert: All reservations released, should be 0
              const finalBalance = await getInventoryBalance(supabase, balanceId);
              expect(finalBalance.reserved_piece_qty).toBe(0);

            } finally {
              await cleanupTestData(supabase, skuId);
            }
          }
        ),
        { numRuns: 20 } // Fewer runs due to complexity
      );
    }, 120000); // 2 minute timeout for complex test
  });
});
