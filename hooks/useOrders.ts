import { useState, useEffect } from 'react';

// Types
export type OrderType = 'route_planning' | 'express' | 'special';
export type OrderStatus = 'draft' | 'confirmed' | 'in_picking' | 'picked' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';
export type OrderPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface OrderItem {
  order_item_id: string;
  order_id: string;
  sku_id: string;
  sku_name?: string;
  ordered_qty: number;
  picked_qty: number;
  shipped_qty: number;
  unit_price: number;
  line_total: number;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  order_id: string;
  order_no: string;
  order_type: OrderType;
  customer_id: string;
  customer_name?: string;
  order_date: string;
  required_date: string;
  delivery_date?: string;
  priority: OrderPriority;
  status: OrderStatus;
  total_amount: number;
  shipping_address?: string;
  delivery_instructions?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
}

export interface OrderFilters {
  order_type?: OrderType;
  status?: OrderStatus;
  priority?: OrderPriority;
  customer_id?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}

export interface OrderDashboardStats {
  total_orders: number;
  pending_orders: number;
  in_progress: number;
  completed_today: number;
  total_value: number;
  by_type: Record<OrderType, number>;
  by_status: Record<OrderStatus, number>;
  by_priority: Record<OrderPriority, number>;
}

// Hook for getting all orders
export const useOrders = (filters?: OrderFilters) => {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value.toString());
        });
      }

      const response = await fetch(`/api/orders?${params}`);
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setData([]);
      } else {
        setData(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch orders');
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [JSON.stringify(filters)]);

  const refetch = () => {
    fetchOrders();
  };

  return { data, loading, error, refetch };
};

// Hook for getting single order
export const useOrder = (id: string | null) => {
  const [data, setData] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch order');
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) {
      fetchOrder(id);
    }
  }, [id]);

  const refetch = () => {
    if (id) {
      fetchOrder(id);
    }
  };

  return { data, loading, error, refetch };
};

// Hook for dashboard stats
export const useOrderDashboard = () => {
  const [data, setData] = useState<OrderDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders/dashboard');
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to fetch dashboard stats');
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const refetch = () => {
    fetchStats();
  };

  return { data, loading, error, refetch };
};

// Hook for creating order
export const useCreateOrder = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = async (orderData: Partial<Order>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return { success: false, error: result.error };
      }

      setLoading(false);
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = 'Failed to create order';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  return { createOrder, loading, error };
};

// Hook for updating order
export const useUpdateOrder = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOrder = async (orderId: string, orderData: Partial<Order>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return { success: false, error: result.error };
      }

      setLoading(false);
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = 'Failed to update order';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  return { updateOrder, loading, error };
};

// Hook for deleting order
export const useDeleteOrder = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteOrder = async (orderId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return { success: false, error: result.error };
      }

      setLoading(false);
      return { success: true };
    } catch (err) {
      const errorMessage = 'Failed to delete order';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  return { deleteOrder, loading, error };
};
