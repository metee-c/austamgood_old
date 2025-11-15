import { SupabaseClient } from '@supabase/supabase-js';
import { FileUpload, ImportJob, ExportJob } from '@/types/file-management-schema';

export class FileManagementService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ========== File Uploads Methods ==========
  async getAllFileUploads(limit = 100, offset = 0): Promise<{ data: FileUpload[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('file_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  }

  // ========== Import Jobs Methods ==========
  async getAllImportJobs(limit = 100, offset = 0): Promise<{ data: ImportJob[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  }

  // ========== Export Jobs Methods ==========
  async getAllExportJobs(limit = 100, offset = 0): Promise<{ data: ExportJob[] | null; error: any }> {
    const { data, error } = await this.supabase
      .from('export_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data, error };
  }
}
