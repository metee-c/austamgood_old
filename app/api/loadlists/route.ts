import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: loadlists, error } = await supabase
      .from('wms_loadlists')
      .select(`
        *,
        master_vehicle (
          plate_number,
          vehicle_type
        ),
        master_employee (
          first_name,
          last_name
        ),
        wms_loadlist_picklists (
          picklist_id,
          wms_picklists (
            picklist_code,
            status,
            total_lines,
            wms_trips (
              trip_code,
              master_vehicle (
                plate_number
              )
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch loadlists', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const transformedLoadlists = (loadlists || []).map((loadlist: any) => {
      const picklists = loadlist.wms_loadlist_picklists || [];
      
      return {
        id: loadlist.loadlist_id,
        loadlist_code: loadlist.loadlist_code,
        status: loadlist.status,
        total_picklists: picklists.length,
        total_packages: picklists.reduce((sum: number, p: any) => sum + (p.wms_picklists?.total_lines || 0), 0),
        created_at: loadlist.created_at,
        created_by: loadlist.created_by,
        vehicle: loadlist.master_vehicle,
        driver: loadlist.master_employee,
        picklists: picklists.map((p: any) => ({
          id: p.picklist_id,
          picklist_code: p.wms_picklists.picklist_code,
          status: p.wms_picklists.status,
          total_lines: p.wms_picklists.total_lines,
          trip: {
            trip_code: p.wms_picklists.wms_trips.trip_code,
            vehicle: p.wms_picklists.wms_trips.master_vehicle
          }
        }))
      };
    });

    return NextResponse.json(transformedLoadlists);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const body = await request.json();
    const { picklist_ids } = body;

    if (!picklist_ids || !Array.isArray(picklist_ids) || picklist_ids.length === 0) {
      return NextResponse.json(
        { error: 'picklist_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Generate loadlist code
    const loadlistCode = 'LD-' + Date.now().toString().slice(-6);

    // Create loadlist
    const { data: loadlist, error: loadlistError } = await supabase
      .from('wms_loadlists')
      .insert({
        loadlist_code: loadlistCode,
        status: 'pending',
        created_by: 'System' // In real app, get from auth
      })
      .select()
      .single();

    if (loadlistError) {
      return NextResponse.json(
        { error: 'Failed to create loadlist', details: loadlistError.message },
        { status: 500 }
      );
    }

    // Link picklists to loadlist
    const loadlistPicklistsData = picklist_ids.map((picklist_id: number) => ({
      loadlist_id: loadlist.loadlist_id,
      picklist_id: picklist_id
    }));

    const { error: linkError } = await supabase
      .from('wms_loadlist_picklists')
      .insert(loadlistPicklistsData);

    if (linkError) {
      // Cleanup: delete the loadlist if linking failed
      await supabase
        .from('wms_loadlists')
        .delete()
        .eq('loadlist_id', loadlist.loadlist_id);

      return NextResponse.json(
        { error: 'Failed to link picklists to loadlist', details: linkError.message },
        { status: 500 }
      );
    }

    // Fetch the complete loadlist with relations
    const { data: completeLoadlist, error: fetchError } = await supabase
      .from('wms_loadlists')
      .select(`
        *,
        master_vehicle (
          plate_number,
          vehicle_type
        ),
        master_employee (
          first_name,
          last_name
        ),
        wms_loadlist_picklists (
          picklist_id,
          wms_picklists (
            picklist_code,
            status,
            total_lines,
            wms_trips (
              trip_code,
              master_vehicle (
                plate_number
              )
            )
          )
        )
      `)
      .eq('loadlist_id', loadlist.loadlist_id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch created loadlist', details: fetchError.message },
        { status: 500 }
      );
    }

    // Transform the response
    const picklists = completeLoadlist.wms_loadlist_picklists || [];
    const transformedLoadlist = {
      id: completeLoadlist.loadlist_id,
      loadlist_code: completeLoadlist.loadlist_code,
      status: completeLoadlist.status,
      total_picklists: picklists.length,
      total_packages: picklists.reduce((sum: number, p: any) => sum + (p.wms_picklists?.total_lines || 0), 0),
      created_at: completeLoadlist.created_at,
      created_by: completeLoadlist.created_by,
      vehicle: completeLoadlist.master_vehicle,
      driver: completeLoadlist.master_employee,
      picklists: picklists.map((p: any) => ({
        id: p.picklist_id,
        picklist_code: p.wms_picklists.picklist_code,
        status: p.wms_picklists.status,
        total_lines: p.wms_picklists.total_lines,
        trip: {
          trip_code: p.wms_picklists.wms_trips.trip_code,
          vehicle: p.wms_picklists.wms_trips.master_vehicle
        }
      }))
    };

    return NextResponse.json(transformedLoadlist);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
