'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, MapPin, AlertCircle } from 'lucide-react';

interface OrderDetail {
  order_id: number;
  order_no: string;
  customer_id: string;
  stop_name: string;
  total_qty: number;
  weight: number;
  province?: string;
}

interface Stop {
  stop_id: number;
  stop_name: string;
  order_id?: number;
  load_weight_kg?: number;
  orders: OrderDetail[];
  customer_id?: string;
}

interface Trip {
  trip_id: number;
  trip_sequence: number;
  vehicle_id?: number;
  driver_id?: number;
  shipping_cost?: number;
  total_distance_km?: number;
  total_weight_kg?: number;
  notes?: string;
  stops?: Stop[];
  pricing_mode?: 'flat' | 'formula';
  base_price?: number;
  helper_fee?: number;
  extra_stop_fee?: number;
  porterage_fee?: number;
  other_fees?: Array<{ label: string; amount: number }>;
  supplier_id?: string;
}

