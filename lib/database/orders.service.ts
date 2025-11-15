import { createClient } from '@/lib/supabase/server';

export class OrdersService {
  async getAllOrders(): Promise<{ data: any[]; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('wms_orders')
        .select(`
          *,
          items:wms_order_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getOrderById(id: string): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('wms_orders')
        .select(`
          *,
          items:wms_order_items(*)
        `)
        .eq('order_id', id)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createOrder(order: any): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();

      // Remove items if present (they should be created separately)
      const { items, ...orderData } = order;

      const { data, error } = await supabase
        .from('wms_orders')
        .insert(orderData)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async updateOrder(id: string, order: any): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('wms_orders')
        .update(order)
        .eq('order_id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteOrder(id: string | number): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();

      // First delete all order items
      await supabase
        .from('wms_order_items')
        .delete()
        .eq('order_id', id);

      // Then delete the order
      const { data, error } = await supabase
        .from('wms_orders')
        .delete()
        .eq('order_id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async getOrderByOrderNo(orderNo: string): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('wms_orders')
        .select(`
          *,
          items:wms_order_items(*)
        `)
        .eq('order_no', orderNo)
        .single();

      if (error) {
        // Not found is not an error for duplicate checking
        if (error.code === 'PGRST116') {
          return { data: null, error: null };
        }
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async createOrderItems(items: any[]): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('wms_order_items')
        .insert(items)
        .select();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }

  async deleteOrderItems(orderId: number): Promise<{ data: any; error: null } | { data: null; error: string }> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from('wms_order_items')
        .delete()
        .eq('order_id', orderId);

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  }
}

export const ordersService = new OrdersService();
