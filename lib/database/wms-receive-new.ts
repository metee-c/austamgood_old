import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface WmsReceive {
  receive_id?: string;
  receive_no?: string;
  receive_date?: string;
  warehouse_id?: string;
  supplier_id?: string;
  reference_doc?: string;
  receive_type?: string;
  status?: string;
}

export class WmsReceiveService {
  private supabase;

  constructor() {
    this.supabase = createClientComponentClient();
  }

  async getAllReceives(options?: { search?: string; limit?: number }) {
    try {
      let query = this.supabase
        .from('wms_receives')
        .select('*')
        .order('receive_date', { ascending: false });

      if (options?.search) {
        query = query.or(`receive_no.ilike.%${options.search}%,reference_doc.ilike.%${options.search}%`);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async getReceiveById(receiveId: string) {
    try {
      const { data, error } = await this.supabase
        .from('wms_receives')
        .select('*')
        .eq('receive_id', receiveId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async createReceive(receive: WmsReceive, details?: any[]) {
    try {
      const { data, error } = await this.supabase
        .from('wms_receives')
        .insert(receive)
        .select()
        .single();

      if (error) throw error;

      // If details are provided, insert them as well
      if (details && details.length > 0 && data) {
        const detailsWithReceiveId = details.map(detail => ({
          ...detail,
          receive_id: data.receive_id
        }));

        await this.supabase
          .from('wms_receive_details')
          .insert(detailsWithReceiveId);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async updateReceive(receiveId: string, receive: Partial<WmsReceive>) {
    try {
      const { data, error } = await this.supabase
        .from('wms_receives')
        .update(receive)
        .eq('receive_id', receiveId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }

  async deleteReceive(receiveId: string) {
    try {
      const { error } = await this.supabase
        .from('wms_receives')
        .delete()
        .eq('receive_id', receiveId);

      if (error) throw error;
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  }
}

export const wmsReceiveService = new WmsReceiveService();
// Alias for backward compatibility
export const wmsReceiveNewService = wmsReceiveService;
