import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';
async function _GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabase
        .from('master_iv_document_type')
        .select('*')
        .eq('doc_type_id', id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from('master_iv_document_type')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching document types:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function _POST(request: NextRequest) {
try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('master_iv_document_type')
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating document type:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function _PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { doc_type_id, ...updateData } = body;

    const { data, error } = await supabase
      .from('master_iv_document_type')
      .update(updateData)
      .eq('doc_type_id', doc_type_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating document type:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function _DELETE(request: NextRequest) {
try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document type ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('master_iv_document_type')
      .delete()
      .eq('doc_type_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Document type deleted successfully' });
  } catch (error) {
    console.error('Error deleting document type:', error);

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withShadowLog(_GET);
export const POST = withShadowLog(_POST);
export const PUT = withShadowLog(_PUT);
export const DELETE = withShadowLog(_DELETE);
