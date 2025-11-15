import { useState, useEffect } from 'react';

export interface ProductionOrder {
  order_id: string;
  order_no: string;
  order_date: string;
  status: string;
  items?: any[];
}

export const useProductionOrders = () => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/production/orders');
      if (!response.ok) throw new Error('Failed to fetch production orders');
      const data = await response.json();
      setOrders(data.data || data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return { orders, loading, error, refetch: fetchOrders };
};

export const useProductionOrderById = (orderId: string | undefined) => {
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/production/orders/${orderId}`);
        if (!response.ok) throw new Error('Failed to fetch production order');
        const data = await response.json();
        setOrder(data.data || data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  return { order, loading, error };
};

// Alias for backward compatibility
export const useProductionOrder = useProductionOrderById;
