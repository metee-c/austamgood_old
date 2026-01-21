import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-auth';

async function handleGet(request: NextRequest, context: any) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    
    // ✅ REMOVED PAGINATION: เอาการจำกัดออกเพื่อความเร็ว

    const supabase = await createServerClient()

    // Build query
    let query = supabase
      .from('master_sku')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      const hasSpecialChars = /[|,()\\]/.test(search);
      if (!hasSpecialChars) {
        query = query.or(`sku_name.ilike.%${search}%,sku_id.ilike.%${search}%,barcode.ilike.%${search}%`)
      }
    }

    if (category && category !== 'ทั้งหมด') {
      query = query.eq('category', category)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // ✅ REMOVED PAGINATION: ดึงข้อมูลทั้งหมด
    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch master SKUs', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      data: data || []
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePost(request: NextRequest, context: any) {
  try {
    const body = await request.json()
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('master_sku')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create master SKU', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePut(request: NextRequest, context: any) {
  try {
    const body = await request.json()
    const { sku_id, ...updateData } = body
    
    if (!sku_id) {
      return NextResponse.json(
        { error: 'sku_id is required for update' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Remove fields that shouldn't be updated
    delete updateData.created_at
    delete updateData.created_by

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('master_sku')
      .update(updateData)
      .eq('sku_id', sku_id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update master SKU', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleDelete(request: NextRequest, context: any) {
  try {
    const { searchParams } = new URL(request.url)
    const sku_id = searchParams.get('sku_id')
    
    if (!sku_id) {
      return NextResponse.json(
        { error: 'sku_id is required for delete' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    const { error } = await supabase
      .from('master_sku')
      .delete()
      .eq('sku_id', sku_id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete master SKU', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Export with auth wrappers
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
