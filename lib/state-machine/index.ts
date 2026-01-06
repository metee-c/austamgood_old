/**
 * WMS State Machine Library
 * 
 * Defines valid state transitions for all WMS entities.
 * Used by APIs to validate status changes before applying them.
 */

// ============================================================================
// ORDER STATE MACHINE
// ============================================================================

export const ORDER_STATES = [
  'draft',
  'confirmed',
  'in_picking',
  'picked',
  'loaded',
  'in_transit',
  'delivered',
  'cancelled'
] as const;

export type OrderStatus = typeof ORDER_STATES[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'draft': ['confirmed', 'cancelled'],
  'confirmed': ['in_picking', 'cancelled'],
  'in_picking': ['picked', 'confirmed', 'cancelled'],  // Allow rollback to confirmed
  'picked': ['loaded', 'in_picking', 'cancelled'],     // Allow rollback to in_picking
  'loaded': ['in_transit', 'picked', 'cancelled'],     // Allow rollback to picked
  'in_transit': ['delivered', 'loaded'],               // Allow rollback to loaded
  'delivered': [],  // Terminal state
  'cancelled': []   // Terminal state
};

export function isValidOrderTransition(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as OrderStatus];
  return allowed?.includes(to as OrderStatus) ?? false;
}

export function getOrderAllowedTransitions(status: string): string[] {
  return ORDER_TRANSITIONS[status as OrderStatus] ?? [];
}

export function isOrderTerminalState(status: string): boolean {
  return status === 'delivered' || status === 'cancelled';
}

// ============================================================================
// PICKLIST STATE MACHINE
// ============================================================================

export const PICKLIST_STATES = [
  'pending',
  'assigned',
  'picking',
  'completed',
  'cancelled',
  'voided'
] as const;

export type PicklistStatus = typeof PICKLIST_STATES[number];

export const PICKLIST_TRANSITIONS: Record<PicklistStatus, PicklistStatus[]> = {
  'pending': ['assigned', 'picking', 'cancelled'],
  'assigned': ['picking', 'pending', 'cancelled'],
  'picking': ['completed', 'assigned', 'cancelled'],
  'completed': ['voided'],  // Only void, not cancel
  'cancelled': [],
  'voided': []
};

export function isValidPicklistTransition(from: string, to: string): boolean {
  const allowed = PICKLIST_TRANSITIONS[from as PicklistStatus];
  return allowed?.includes(to as PicklistStatus) ?? false;
}

export function getPicklistAllowedTransitions(status: string): string[] {
  return PICKLIST_TRANSITIONS[status as PicklistStatus] ?? [];
}

export function isPicklistTerminalState(status: string): boolean {
  return status === 'cancelled' || status === 'voided';
}

// ============================================================================
// LOADLIST STATE MACHINE
// ============================================================================

export const LOADLIST_STATES = [
  'pending',
  'loaded',
  'in_transit',
  'completed',
  'cancelled',
  'voided'
] as const;

export type LoadlistStatus = typeof LOADLIST_STATES[number];

export const LOADLIST_TRANSITIONS: Record<LoadlistStatus, LoadlistStatus[]> = {
  'pending': ['loaded', 'cancelled'],
  'loaded': ['in_transit', 'pending', 'cancelled', 'completed'],
  'in_transit': ['completed', 'loaded'],
  'completed': ['voided'],
  'cancelled': [],
  'voided': []
};

export function isValidLoadlistTransition(from: string, to: string): boolean {
  const allowed = LOADLIST_TRANSITIONS[from as LoadlistStatus];
  return allowed?.includes(to as LoadlistStatus) ?? false;
}

export function getLoadlistAllowedTransitions(status: string): string[] {
  return LOADLIST_TRANSITIONS[status as LoadlistStatus] ?? [];
}

// ============================================================================
// ROUTE PLAN STATE MACHINE
// ============================================================================

export const ROUTE_PLAN_STATES = [
  'draft',
  'optimizing',
  'published',
  'pending_approval',
  'approved',
  'ready_to_load',
  'in_transit',
  'completed',
  'cancelled'
] as const;

export type RoutePlanStatus = typeof ROUTE_PLAN_STATES[number];

export const ROUTE_PLAN_TRANSITIONS: Record<RoutePlanStatus, RoutePlanStatus[]> = {
  'draft': ['optimizing', 'cancelled'],
  'optimizing': ['published', 'draft', 'cancelled'],
  'published': ['pending_approval', 'draft', 'cancelled'],
  'pending_approval': ['approved', 'published', 'cancelled'],
  'approved': ['ready_to_load', 'pending_approval', 'cancelled'],
  'ready_to_load': ['in_transit', 'approved', 'cancelled'],
  'in_transit': ['completed', 'ready_to_load'],
  'completed': [],
  'cancelled': []
};

export function isValidRoutePlanTransition(from: string, to: string): boolean {
  const allowed = ROUTE_PLAN_TRANSITIONS[from as RoutePlanStatus];
  return allowed?.includes(to as RoutePlanStatus) ?? false;
}

// ============================================================================
// FACE SHEET STATE MACHINE
// ============================================================================

export const FACE_SHEET_STATES = [
  'draft',
  'generated',
  'picking',
  'completed',
  'cancelled'
] as const;

export type FaceSheetStatus = typeof FACE_SHEET_STATES[number];

export const FACE_SHEET_TRANSITIONS: Record<FaceSheetStatus, FaceSheetStatus[]> = {
  'draft': ['generated', 'cancelled'],
  'generated': ['picking', 'draft', 'cancelled'],
  'picking': ['completed', 'generated', 'cancelled'],
  'completed': [],
  'cancelled': []
};

export function isValidFaceSheetTransition(from: string, to: string): boolean {
  const allowed = FACE_SHEET_TRANSITIONS[from as FaceSheetStatus];
  return allowed?.includes(to as FaceSheetStatus) ?? false;
}

// ============================================================================
// RECEIVE STATE MACHINE (Thai status)
// ============================================================================

export const RECEIVE_STATES = [
  'รอรับเข้า',
  'รับเข้าแล้ว',
  'สำเร็จ',
  'ยกเลิก'
] as const;

export type ReceiveStatus = typeof RECEIVE_STATES[number];

export const RECEIVE_TRANSITIONS: Record<ReceiveStatus, ReceiveStatus[]> = {
  'รอรับเข้า': ['รับเข้าแล้ว', 'ยกเลิก'],
  'รับเข้าแล้ว': ['สำเร็จ', 'รอรับเข้า', 'ยกเลิก'],
  'สำเร็จ': [],
  'ยกเลิก': []
};

export function isValidReceiveTransition(from: string, to: string): boolean {
  const allowed = RECEIVE_TRANSITIONS[from as ReceiveStatus];
  return allowed?.includes(to as ReceiveStatus) ?? false;
}

// ============================================================================
// VALIDATION ERROR HELPER
// ============================================================================

export interface StateTransitionError {
  error: string;
  current_status: string;
  requested_status: string;
  allowed_transitions: string[];
}

export function createTransitionError(
  entityType: string,
  currentStatus: string,
  requestedStatus: string,
  allowedTransitions: string[]
): StateTransitionError {
  return {
    error: `Invalid ${entityType} status transition from '${currentStatus}' to '${requestedStatus}'`,
    current_status: currentStatus,
    requested_status: requestedStatus,
    allowed_transitions: allowedTransitions
  };
}

// ============================================================================
// GENERIC VALIDATOR
// ============================================================================

export type EntityType = 'order' | 'picklist' | 'loadlist' | 'route_plan' | 'face_sheet' | 'receive';

export function validateStatusTransition(
  entityType: EntityType,
  currentStatus: string,
  newStatus: string
): { valid: boolean; error?: StateTransitionError } {
  let isValid = false;
  let allowedTransitions: string[] = [];

  switch (entityType) {
    case 'order':
      isValid = isValidOrderTransition(currentStatus, newStatus);
      allowedTransitions = getOrderAllowedTransitions(currentStatus);
      break;
    case 'picklist':
      isValid = isValidPicklistTransition(currentStatus, newStatus);
      allowedTransitions = getPicklistAllowedTransitions(currentStatus);
      break;
    case 'loadlist':
      isValid = isValidLoadlistTransition(currentStatus, newStatus);
      allowedTransitions = getLoadlistAllowedTransitions(currentStatus);
      break;
    case 'route_plan':
      isValid = isValidRoutePlanTransition(currentStatus, newStatus);
      allowedTransitions = ROUTE_PLAN_TRANSITIONS[currentStatus as RoutePlanStatus] ?? [];
      break;
    case 'face_sheet':
      isValid = isValidFaceSheetTransition(currentStatus, newStatus);
      allowedTransitions = FACE_SHEET_TRANSITIONS[currentStatus as FaceSheetStatus] ?? [];
      break;
    case 'receive':
      isValid = isValidReceiveTransition(currentStatus, newStatus);
      allowedTransitions = RECEIVE_TRANSITIONS[currentStatus as ReceiveStatus] ?? [];
      break;
  }

  if (isValid) {
    return { valid: true };
  }

  return {
    valid: false,
    error: createTransitionError(entityType, currentStatus, newStatus, allowedTransitions)
  };
}
