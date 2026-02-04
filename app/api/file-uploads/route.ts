import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { FileManagementService } from '@/lib/database/file-management';
export async function GET(request: Request) {
  const supabase = await createClient();
  const fileService = new FileManagementService(supabase);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data, error } = await fileService.getAllFileUploads(limit, offset);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
try {
    console.log('File upload request received');
    
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { data: null, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create Supabase client with service role for file uploads (needs storage access)
    const supabase = createServiceRoleClient();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';
    
    console.log('File details:', { name: file?.name, size: file?.size, type: file?.type });

    if (!file) {
      return NextResponse.json(
        { data: null, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { data: null, error: 'Only image files are allowed (JPG, PNG, GIF, WebP)' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { data: null, error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${fileExtension}`;
    const filePath = `${folder}/${fileName}`;

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    console.log('Uploading file to path:', filePath);
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('wms-files')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
      
      // Try to create bucket if it doesn't exist
      if (uploadError.message?.includes('Bucket not found')) {
        console.log('Attempting to create bucket...');
        const { error: createBucketError } = await supabase.storage.createBucket('wms-files', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
          fileSizeLimit: 5242880 // 5MB
        });
        
        if (createBucketError) {
          console.error('Failed to create bucket:', createBucketError);
          return NextResponse.json(
            { data: null, error: `Storage setup failed: ${createBucketError.message}` },
            { status: 500 }
          );
        }
        
        // Retry upload after creating bucket
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('wms-files')
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false
          });
          
        if (retryUploadError) {
          console.error('Retry upload error:', retryUploadError);
          return NextResponse.json(
            { data: null, error: `Upload failed after bucket creation: ${retryUploadError.message}` },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { data: null, error: `Upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('wms-files')
      .getPublicUrl(filePath);

    // Log file upload to database
    const { data: logData, error: logError } = await supabase
      .from('file_uploads')
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        folder: folder,
        created_by: 'system' // TODO: Get from auth context
      })
      .select()
      .single();

    if (logError) {
      console.error('Database log error:', logError);
      // Don't fail the upload, just log the error
    }

    return NextResponse.json({
      data: {
        url: urlData.publicUrl,
        path: filePath,
        name: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type
      },
      error: null
    });

  } catch (error) {
    console.error('File upload error:', error);

    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
