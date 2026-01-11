// ===== Types for Routes Page =====
// แยกออกมาจาก page.tsx เพื่อความเป็นระเบียบ
// ห้ามแก้ไข Logic - Copy มาจากเดิมทั้งหมด

export interface RoutePlan {
    plan_id: number;
    plan_code: string;
    plan_name?: string;
    plan_date: string;
    warehouse_id: string;
    warehouse?: { warehouse_name?: string };
    status: string;
    total_trips?: number;
    total_distance_km?: number;
    total_drive_minutes?: number;
    total_service_minutes?: number;
    total_weight_kg?: number;
    total_volume_cbm?: number;
    total_pallets?: number;
    objective_value?: number;
}

export interface DraftOrder {
    order_id: number;
    order_no: string;
    shop_name?: string;
    province?: string;
    total_weight?: number;
    phone?: string;
    address?: string;
    customer_latitude?: number;
    customer_longitude?: number;
    customer_id?: string;
    customer?: {
        customer_id: string;
        customer_name?: string;
        customer_code?: string;
        latitude?: number;
        longitude?: number;
    };
}

export interface OrderItemDetail {
    order_item_id: number;
    sku_id: string;
    sku_name: string;
    order_qty: number;
    order_weight: number;
}

export interface StopOrderDetail {
    order_id: number | null;
    order_no?: string | null;
    customer_id?: string | null;
    customer_name?: string | null;
    shop_name?: string | null;
    province?: string | null;
    allocated_weight_kg?: number | null;
    total_order_weight_kg?: number | null;
    total_qty?: number | null;
    note?: string | null;
    text_field_long_1?: string | null;
    items?: OrderItemDetail[];
}

export interface EditorStop {
    stop_id: number;
    sequence_no: number;
    stop_name: string;
    address?: string | null;
    load_weight_kg?: number | null;
    load_volume_cbm?: number | null;
    load_pallets?: number | null;
    load_units?: number | null;
    service_duration_minutes?: number | null;
    manual_override?: boolean;
    override_note?: string | null;
    split_from_stop_id?: number | null;
    order_id?: number | null;
    order_no?: string | null;
    order_ids?: number[];
    orders?: StopOrderDetail[];
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
    tags?: {
        order_ids?: number[];
        customer_id?: string;
    };
}

export interface EditorTrip {
    trip_id: number;
    trip_number?: number;
    trip_sequence: number;
    daily_trip_number?: number;
    trip_code: string;
    trip_status: string;
    vehicle_id?: string | number | null;
    driver_id?: string | number | null;
    vehicle_label?: string | null;
    driver_label?: string | null;
    vehicle_name?: string | null;
    driver_name?: string | null;
    total_distance_km?: number | null;
    total_drive_minutes?: number | null;
    total_service_minutes?: number | null;
    total_weight_kg?: number | null;
    total_volume_cbm?: number | null;
    total_stops?: number | null;
    manual_override?: boolean;
    is_overweight?: boolean;
    stops: EditorStop[];
}

export interface SplitItemFormPayload {
    orderItemId: number;
    moveWeightKg: number;
    moveQuantity?: number | null;
    moveVolumeCbm?: number | null;
    movePallets?: number | null;
}

export interface SplitFormPayload {
    stopId: number;
    targetTripId?: number | null;
    newTrip?: {
        trip_name?: string | null;
    };
    items: SplitItemFormPayload[];
    serviceMinutes?: number | null;
    note?: string | null;
}

export interface SplitModalItem {
    orderItemId: number;
    skuId: string | null;
    skuName: string | null;
    availableWeight: number;
    availableQty: number;
    unitWeight: number | null;
    moveWeight: string;
    moveQty: string;
    movePieces: string;
}

// Badge variant type
export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

// Status option type
export interface StatusOption {
    value: string;
    label: string;
}

// Plan form type
export interface PlanForm {
    planCode: string;
    planName: string;
    planDate: string;
    warehouseId: string;
}

// Metrics type
export interface RouteMetrics {
    totalPlans: number;
    totalDraftOrders: number;
    totalSelectedOrders: number;
    totalTrips: number;
    totalDistance: number;
}
