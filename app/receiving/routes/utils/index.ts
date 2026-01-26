// ===== Utils for Routes Page =====
// Helper functions แยกออกมาจาก page.tsx
// ห้ามแก้ไข Logic - Copy มาจากเดิมทั้งหมด

import type { EditorStop, EditorTrip, BadgeVariant, StatusOption } from '../types';

// Re-export error handler utilities
export * from './errorHandler';

// Re-export export excel utilities
export * from './exportExcel';

// ===== Status Configuration =====
export const STATUSES: StatusOption[] = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'draft', label: 'ร่าง (สร้างใหม่)' },
    { value: 'optimizing', label: 'กำลังกรอกค่าขนส่ง' },
    { value: 'published', label: 'กรอกค่าขนส่งเสร็จ (พร้อมพิมพ์)' },
    { value: 'pending_approval', label: 'รออนุมัติ' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' }
];

// ===== Status Badge Mapping =====
export const STATUS_BADGE_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
    draft: { label: 'แบบร่าง', variant: 'default' },
    optimizing: { label: 'กำลังคำนวณ', variant: 'warning' },
    published: { label: 'เผยแพร่แล้ว', variant: 'success' },
    pending_approval: { label: 'รออนุมัติ', variant: 'warning' },
    approved: { label: 'อนุมัติแล้ว', variant: 'success' },
    ready_to_load: { label: 'พร้อมขึ้นรถ', variant: 'primary' },
    in_transit: { label: 'กำลังจัดส่ง', variant: 'info' },
    completed: { label: 'เสร็จสิ้น', variant: 'success' },
    cancelled: { label: 'ยกเลิก', variant: 'danger' }
};

// ===== VRP Settings Storage Key =====
export const VRP_SETTINGS_STORAGE_KEY = 'vrp-settings';

// ===== Helper Functions =====

/**
 * Resequence stops - อัพเดท sequence_no ให้เรียงลำดับใหม่
 */
export const resequenceTripStops = (stops: EditorStop[]): EditorStop[] =>
    stops.map((stop, index) => ({ ...stop, sequence_no: index + 1 }));

/**
 * Get status badge info
 */
export const getStatusBadgeInfo = (status: string): { label: string; variant: BadgeVariant } => {
    return STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.draft;
};

/**
 * Format date to Thai locale
 */
export const formatDateThai = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB');
};

/**
 * Format number with Thai locale
 */
export const formatNumberThai = (value: number, options?: Intl.NumberFormatOptions): string => {
    return value.toLocaleString('th-TH', options);
};

/**
 * Format currency (Thai Baht)
 */
export const formatCurrency = (value: number): string => {
    return `฿${value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/**
 * Format weight (kg)
 */
export const formatWeight = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${value.toFixed(0)} kg`;
};

/**
 * Format distance (km)
 */
export const formatDistance = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${value.toFixed(1)} km`;
};

/**
 * Format duration (minutes to hours)
 */
export const formatDuration = (minutes: number | null | undefined): string => {
    if (minutes == null || !Number.isFinite(minutes)) return '-';
    return `${Math.round(minutes / 60)} ชม.`;
};

/**
 * Format volume (cubic meters)
 */
export const formatVolume = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return '-';
    return `${value.toFixed(2)} m³`;
};

/**
 * Calculate total shipping cost for a trip
 */
export const calculateTripShippingCost = (trip: any): number => {
    const baseShippingCost = Number(trip.shipping_cost) || 0;
    const porterageFee = Number(trip.porterage_fee) || 0;
    const otherFeesTotal = (trip.other_fees || []).reduce(
        (sum: number, fee: any) => sum + (Number(fee.amount) || 0),
        0
    );
    const extraDeliveryStopsTotal = (trip.extra_delivery_stops || []).reduce(
        (sum: number, stop: any) => sum + (Number(stop.cost) || 0),
        0
    );
    return baseShippingCost + porterageFee + otherFeesTotal + extraDeliveryStopsTotal;
};

/**
 * Check if trip has valid coordinates
 */
export const tripHasValidCoordinates = (trip: EditorTrip): boolean => {
    return trip.stops.some(
        stop =>
            stop.latitude != null &&
            stop.longitude != null &&
            Number.isFinite(Number(stop.latitude)) &&
            Number.isFinite(Number(stop.longitude))
    );
};

/**
 * Filter stops with valid coordinates
 */
export const filterStopsWithCoordinates = (stops: EditorStop[]): EditorStop[] => {
    return stops.filter(
        stop =>
            stop.latitude != null &&
            stop.longitude != null &&
            Number.isFinite(Number(stop.latitude)) &&
            Number.isFinite(Number(stop.longitude))
    );
};
