export type OrderType = 'blank' | 'route_planning' | 'express' | 'special';
export type OrderStatus = 'draft' | 'confirmed' | 'in_picking' | 'picked' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';
export type PaymentType = 'credit' | 'cash';

export interface WmsOrder {
  order_id: number;
  order_no: string;
  order_type: OrderType;
  order_date: string;
  sequence_no?: string;
  warehouse_id: string;
  customer_id: string;
  shop_name?: string;
  province?: string;
  phone?: string;
  payment_type: PaymentType;
  pickup_datetime?: string;
  delivery_date?: string;
  total_items: number;
  total_qty: number;
  total_weight: number;
  total_pack_all: number;
  pack_12_bags: number;
  pack_4: number;
  pack_6: number;
  pack_2: number;
  pack_1: number;
  text_field_long_1?: string;
  text_field_additional_1?: string;
  text_field_additional_4?: string;
  notes?: string;
  notes_additional?: string;
  status: OrderStatus;
  import_file_name?: string;
  import_file_type?: string;
  imported_by?: number;
  imported_at?: string;
  matched_trip_id?: number;
  auto_matched_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderRoutePlanSummary {
  plan_id: number;
  plan_code: string;
  plan_date?: string | null;
}

export interface WmsOrderItem {
  order_item_id: number;
  order_id: number;
  line_no: number;
  sku_id: string;
  sku_name?: string;
  number_field_additional_1?: number;
  order_qty: number;
  order_weight?: number;
  pack_all: number;
  pack_12_bags: number;
  pack_4: number;
  pack_6: number;
  pack_2: number;
  pack_1: number;
  picked_qty: number;
  created_at: string;
  updated_at: string;
}

export interface WmsOrderWithItems extends WmsOrder {
  items?: WmsOrderItem[];
  route_plans?: OrderRoutePlanSummary[];
}
