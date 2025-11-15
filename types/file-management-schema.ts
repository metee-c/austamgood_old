import { z } from 'zod';

// Schema for file_uploads
export const FileUploadSchema = z.object({
  id: z.string().uuid(),
  file_name: z.string(),
  storage_path: z.string(),
  file_type: z.string().nullable(),
  file_size: z.number().nullable(),
  uploaded_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  metadata: z.record(z.any()).nullable(),
});

export type FileUpload = z.infer<typeof FileUploadSchema>;

// Schema for import_jobs
export const ImportJobSchema = z.object({
  id: z.number(),
  file_id: z.string().uuid(),
  data_entity: z.string(),
  status: z.string(),
  total_rows: z.number().nullable(),
  processed_rows: z.number().nullable(),
  successful_rows: z.number().nullable(),
  failed_rows: z.number().nullable(),
  error_log_path: z.string().nullable(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});

export type ImportJob = z.infer<typeof ImportJobSchema>;

// Schema for export_jobs
export const ExportJobSchema = z.object({
  id: z.number(),
  data_entity: z.string(),
  status: z.string(),
  filters: z.record(z.any()).nullable(),
  file_path: z.string().nullable(),
  download_url: z.string().nullable(),
  error_log: z.string().nullable(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
});

export type ExportJob = z.infer<typeof ExportJobSchema>;
