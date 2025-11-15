import { createClient } from '@/lib/supabase/client';

/**
 * Generates an automatic Pallet ID in the format: ATG{YYYY}{MM}{DD}{10-digit-sequence}
 * Example: ATG20250922000000001
 * The sequence resets every year and continues incrementally throughout the year
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

      // Get the last pallet ID from this year
      const { data: lastPallet, error: queryError } = await this.supabase
        .from('wms_receive_pallet')
        .select('pallet_id')
        .ilike('pallet_id', `${yearPrefix}%`)
        .order('pallet_id', { ascending: false })
        .limit(1);

      if (queryError && queryError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error querying last pallet ID:', queryError);
        return { palletId: null, error: queryError.message };
      }

      let nextSequence = 1;

      // Handle both single result and array result
      const palletData = Array.isArray(lastPallet) ? lastPallet[0] : lastPallet;
      
      if (palletData?.pallet_id) {
        // Extract sequence number from last pallet ID
        // Format: ATG{YYYY}{MM}{DD}{10-digit-sequence}
        const lastSequenceStr = palletData.pallet_id.slice(-10); // Last 10 digits
        const lastSequence = parseInt(lastSequenceStr, 10);
        
        if (!isNaN(lastSequence)) {
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
   * Check if a pallet ID already exists
   */
  async isPalletIdExists(palletId: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('wms_receive_pallet')
        .select('pallet_id')
        .eq('pallet_id', palletId)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        return { exists: false, error: error.message };
      }

      return { exists: !!data, error: null };
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