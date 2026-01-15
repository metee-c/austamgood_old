import { createClient } from '@/lib/supabase/client';

/**
 * Generates an automatic Pallet ID in the format: ATG{YYYY}{MM}{DD}{10-digit-sequence}
 * Example: ATG20250922000000001
 * The sequence resets every year and continues incrementally throughout the year
 * IMPORTANT: Checks both wms_receive_items AND wms_move_items.new_pallet_id to prevent duplicates
 */
export class PalletIdGenerator {
  private supabase = createClient();

  /**
   * Generate the next Pallet ID for the current date
   */
  async generatePalletId(): Promise<{ palletId: string | null; error: string | null }> {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const datePrefix = `ATG${year}${month}${day}`;
      
      // Get the current year for sequence reset logic
      const currentYear = now.getFullYear();
      const yearPrefix = `ATG${currentYear}`;

      // Get the last pallet ID from BOTH wms_receive_items AND wms_move_items
      // to prevent duplicate pallet IDs between receives and partial moves
      const { data: lastReceivePallet, error: receiveError } = await this.supabase
        .from('wms_receive_items')
        .select('pallet_id')
        .ilike('pallet_id', `${yearPrefix}%`)
        .order('pallet_id', { ascending: false })
        .limit(1);

      const { data: lastMovePallet, error: moveError } = await this.supabase
        .from('wms_move_items')
        .select('new_pallet_id')
        .ilike('new_pallet_id', `${yearPrefix}%`)
        .order('new_pallet_id', { ascending: false })
        .limit(1);

      if (receiveError && receiveError.code !== 'PGRST116') {
        console.error('Error querying last pallet ID from receive_items:', receiveError);
        return { palletId: null, error: receiveError.message };
      }

      if (moveError && moveError.code !== 'PGRST116') {
        console.error('Error querying last pallet ID from move_items:', moveError);
        return { palletId: null, error: moveError.message };
      }

      let nextSequence = 1;

      // Check receive_items
      const receivePalletData = Array.isArray(lastReceivePallet) ? lastReceivePallet[0] : lastReceivePallet;
      if (receivePalletData?.pallet_id) {
        const lastSequenceStr = receivePalletData.pallet_id.slice(-10);
        const lastSequence = parseInt(lastSequenceStr, 10);
        if (!isNaN(lastSequence) && lastSequence >= nextSequence) {
          nextSequence = lastSequence + 1;
        }
      }

      // Check move_items (new_pallet_id)
      const movePalletData = Array.isArray(lastMovePallet) ? lastMovePallet[0] : lastMovePallet;
      if (movePalletData?.new_pallet_id) {
        const lastSequenceStr = movePalletData.new_pallet_id.slice(-10);
        const lastSequence = parseInt(lastSequenceStr, 10);
        if (!isNaN(lastSequence) && lastSequence >= nextSequence) {
          nextSequence = lastSequence + 1;
        }
      }

      // Format sequence as 10-digit string
      const sequenceStr = String(nextSequence).padStart(10, '0');
      
      // Create full pallet ID
      const palletId = `${datePrefix}${sequenceStr}`;

      return { palletId, error: null };
    } catch (error) {
      console.error('Error generating pallet ID:', error);
      return { 
        palletId: null, 
        error: error instanceof Error ? error.message : 'Failed to generate pallet ID' 
      };
    }
  }

  /**
   * Check if a pallet ID already exists in either receive_items or move_items
   */
  async isPalletIdExists(palletId: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      // Check in receive_items
      const { data: receiveData, error: receiveError } = await this.supabase
        .from('wms_receive_items')
        .select('pallet_id')
        .eq('pallet_id', palletId)
        .limit(1)
        .single();

      if (receiveError && receiveError.code !== 'PGRST116') {
        return { exists: false, error: receiveError.message };
      }

      if (receiveData) {
        return { exists: true, error: null };
      }

      // Check in move_items (new_pallet_id)
      const { data: moveData, error: moveError } = await this.supabase
        .from('wms_move_items')
        .select('new_pallet_id')
        .eq('new_pallet_id', palletId)
        .limit(1)
        .single();

      if (moveError && moveError.code !== 'PGRST116') {
        return { exists: false, error: moveError.message };
      }

      return { exists: !!moveData, error: null };
    } catch (error) {
      console.error('Error checking pallet ID existence:', error);
      return { 
        exists: false, 
        error: error instanceof Error ? error.message : 'Failed to check pallet ID' 
      };
    }
  }
}

// Export singleton instance
export const palletIdGenerator = new PalletIdGenerator();