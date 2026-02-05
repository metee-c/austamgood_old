// Supabase Edge Function: Calculate Real Road Distances using OSRM
// Calculates actual driving distances for trips with 0 or missing distance
//
// Deploy: supabase functions deploy calculate-road-distances
//
// Usage:
// POST /calculate-road-distances
// Body: { "trip_ids": [966, 967] } - optional

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OSRM_BASE_URL = 'https://router.project-osrm.org' // Public OSRM demo server

interface OSRMResponse {
  routes: Array<{
    distance: number // in meters
    duration: number // in seconds
    geometry: string
  }>
  waypoints: any[]
}

async function getRoadDistance(coords: Array<{lat: number, lon: number}>): Promise<{distance: number, duration: number} | null> {
  if (coords.length < 2) return null

  // Format coordinates for OSRM: lon,lat;lon,lat;...
  const coordString = coords.map(c => `${c.lon},${c.lat}`).join(';')
  
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordString}?overview=false`
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`OSRM error: ${response.status}`)
      return null
    }
    
    const data: OSRMResponse = await response.json()
    
    if (data.routes && data.routes.length > 0) {
      return {
        distance: data.routes[0].distance / 1000, // convert to km
        duration: data.routes[0].duration / 60    // convert to minutes
      }
    }
    
    return null
  } catch (error) {
    console.error('OSRM fetch error:', error)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    let tripIds: number[] = []
    try {
      const body = await req.json()
      tripIds = body.trip_ids || []
    } catch {
      // No body provided
    }

    console.log('🚛 Starting road distance calculation...')

    // Build query to find trips that need distance calculation
    let query = supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        plan_id,
        trip_sequence,
        total_distance_km,
        total_drive_minutes,
        receiving_route_plans!inner(
          plan_id,
          warehouse_id,
          master_warehouse!inner(
            warehouse_id,
            latitude,
            longitude
          )
        )
      `)

    if (tripIds.length > 0) {
      query = query.in('trip_id', tripIds)
    } else {
      query = query.or('total_distance_km.eq.0,total_distance_km.is.null')
    }

    const { data: trips, error: tripsError } = await query

    if (tripsError) {
      console.error('❌ Error fetching trips:', tripsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trips', details: tripsError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (!trips || trips.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No trips found that need distance calculation', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const results: any[] = []

    for (const trip of trips) {
      const tripId = trip.trip_id
      const plan = trip.receiving_route_plans
      const warehouse = plan?.master_warehouse

      const warehouseLat = warehouse?.latitude ? parseFloat(warehouse.latitude) : null
      const warehouseLon = warehouse?.longitude ? parseFloat(warehouse.longitude) : null

      if (!warehouseLat || !warehouseLon) {
        results.push({ trip_id: tripId, status: 'skipped', reason: 'missing warehouse coordinates' })
        continue
      }

      // Get all stops for this trip
      const { data: stops, error: stopsError } = await supabase
        .from('receiving_route_stops')
        .select('stop_id, sequence_no, latitude, longitude, stop_name')
        .eq('trip_id', tripId)
        .order('sequence_no', { ascending: true })

      if (stopsError || !stops || stops.length === 0) {
        results.push({ trip_id: tripId, status: 'skipped', reason: stopsError?.message || 'no stops' })
        continue
      }

      // Build coordinate array: warehouse -> stops -> warehouse
      const coords: Array<{lat: number, lon: number}> = [
        { lat: warehouseLat, lon: warehouseLon }
      ]

      for (const stop of stops) {
        if (stop.latitude && stop.longitude) {
          coords.push({
            lat: parseFloat(stop.latitude),
            lon: parseFloat(stop.longitude)
          })
        }
      }

      // Add return to warehouse
      coords.push({ lat: warehouseLat, lon: warehouseLon })

      // Get real road distance from OSRM
      const routeData = await getRoadDistance(coords)

      if (!routeData) {
        results.push({ trip_id: tripId, status: 'error', reason: 'OSRM calculation failed' })
        continue
      }

      // Update trip with real road distance
      const { error: updateError } = await supabase
        .from('receiving_route_trips')
        .update({
          total_distance_km: Math.round(routeData.distance * 100) / 100,
          total_drive_minutes: Math.round(routeData.duration),
          updated_at: new Date().toISOString()
        })
        .eq('trip_id', tripId)

      if (updateError) {
        results.push({ trip_id: tripId, status: 'error', reason: updateError.message })
        continue
      }

      console.log(`✅ Trip ${tripId}: Road distance = ${routeData.distance.toFixed(2)} km, Duration = ${routeData.duration.toFixed(0)} min`)

      results.push({
        trip_id: tripId,
        plan_id: plan.plan_id,
        trip_sequence: trip.trip_sequence,
        status: 'updated',
        total_distance_km: routeData.distance,
        total_drive_minutes: routeData.duration,
        stops_count: stops.length
      })
    }

    const updated = results.filter(r => r.status === 'updated').length

    return new Response(
      JSON.stringify({
        success: true,
        summary: { updated, total: results.length },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('❌ Road distance calculation error:', error)
    return new Response(
      JSON.stringify({ error: 'Calculation failed', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
