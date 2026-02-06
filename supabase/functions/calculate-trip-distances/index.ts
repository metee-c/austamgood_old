// Supabase Edge Function: Calculate Trip Distances

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAPBOX_API_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving'

interface MapboxResponse {
  routes: Array<{
    distance: number // in meters
    duration: number // in seconds
    geometry: string
    legs: any[]
  }>
  waypoints: any[]
}

async function getMapboxDistance(coords: Array<[number, number]>, accessToken: string): Promise<{distance: number, duration: number} | null> {
  if (coords.length < 2) return null

  const coordString = coords.map(c => c.join(',')).join(';')
  
  try {
    const url = `${MAPBOX_API_URL}/${coordString}?access_token=${accessToken}&geometries=geojson&overview=false`
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`Mapbox error: ${response.status}`)
      return null
    }
    
    const data: MapboxResponse = await response.json()
    
    if (data.routes && data.routes.length > 0) {
      return {
        distance: data.routes[0].distance / 1000,
        duration: data.routes[0].duration / 60
      }
    }
    
    return null
  } catch (error) {
    console.error('Mapbox fetch error:', error)
    return null
  }
}

// Haversine formula for fallback
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    let tripIds: number[] = []
    try {
      const body = await req.json()
      tripIds = body.trip_ids || []
    } catch {
      // No body or invalid JSON, will process all trips with 0 distance
    }

    console.log('🚛 Starting distance calculation...', tripIds.length > 0 ? `for trips: ${tripIds.join(', ')}` : 'for all trips with 0 distance')

    // Build query to find trips that need distance calculation
    let query = supabase
      .from('receiving_route_trips')
      .select(`
        trip_id,
        plan_id,
        trip_sequence,
        total_distance_km,
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

    // Process each trip
    for (const trip of trips) {
      const tripId = trip.trip_id
      const plan = trip.receiving_route_plans
      const warehouse = plan?.master_warehouse

      // Get warehouse coordinates
      const warehouseLat = warehouse?.latitude ? parseFloat(warehouse.latitude) : null
      const warehouseLon = warehouse?.longitude ? parseFloat(warehouse.longitude) : null

      if (!warehouseLat || !warehouseLon) {
        console.warn(`⚠️ Trip ${tripId}: Missing warehouse coordinates`)
        results.push({ trip_id: tripId, status: 'skipped', reason: 'missing warehouse coordinates' })
        continue
      }

      // Get all stops for this trip
      const { data: stops, error: stopsError } = await supabase
        .from('receiving_route_stops')
        .select('stop_id, sequence_no, latitude, longitude, stop_name')
        .eq('trip_id', tripId)
        .order('sequence_no', { ascending: true })

      if (stopsError) {
        console.error(`❌ Trip ${tripId}: Error fetching stops:`, stopsError)
        results.push({ trip_id: tripId, status: 'error', reason: stopsError.message })
        continue
      }

      if (!stops || stops.length === 0) {
        console.warn(`⚠️ Trip ${tripId}: No stops found`)
        results.push({ trip_id: tripId, status: 'skipped', reason: 'no stops' })
        continue
      }

      // Get Mapbox token
      const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN')
      if (!mapboxToken) {
        console.warn(`⚠️ Trip ${tripId}: Missing Mapbox token`)
        results.push({ trip_id: tripId, status: 'skipped', reason: 'missing mapbox token' })
        continue
      }

      // Build coordinates array: warehouse -> stops -> warehouse
      const coords: Array<[number, number]> = [[warehouseLon, warehouseLat]]
      
      for (const stop of stops) {
        const stopLat = stop.latitude ? parseFloat(stop.latitude) : null
        const stopLon = stop.longitude ? parseFloat(stop.longitude) : null
        if (stopLat && stopLon) {
          coords.push([stopLon, stopLat])
        }
      }
      
      // Add return to warehouse
      coords.push([warehouseLon, warehouseLat])

      // Call Mapbox API for real road distance
      const mapboxResult = await getMapboxDistance(coords, mapboxToken)
      
      if (!mapboxResult) {
        console.warn(`⚠️ Trip ${tripId}: Mapbox API failed, falling back to Haversine`)
        // Fallback to Haversine
        let fallbackDistance = 0
        let prevLat = warehouseLat
        let prevLon = warehouseLon
        for (const stop of stops) {
          const stopLat = stop.latitude ? parseFloat(stop.latitude) : null
          const stopLon = stop.longitude ? parseFloat(stop.longitude) : null
          if (stopLat && stopLon) {
            fallbackDistance += calculateDistance(prevLat, prevLon, stopLat, stopLon)
            prevLat = stopLat
            prevLon = stopLon
          }
        }
        fallbackDistance += calculateDistance(prevLat, prevLon, warehouseLat, warehouseLon)
        
        await supabase
          .from('receiving_route_trips')
          .update({
            total_distance_km: Math.round(fallbackDistance * 100) / 100,
            total_drive_minutes: Math.round(fallbackDistance * 1.5),
            updated_at: new Date().toISOString()
          })
          .eq('trip_id', tripId)
        
        results.push({
          trip_id: tripId,
          status: 'updated_fallback',
          total_distance_km: Math.round(fallbackDistance * 100) / 100,
          method: 'haversine'
        })
        continue
      }

      // Update with Mapbox distance
      await supabase
        .from('receiving_route_trips')
        .update({
          total_distance_km: Math.round(mapboxResult.distance * 100) / 100,
          total_drive_minutes: Math.round(mapboxResult.duration),
          updated_at: new Date().toISOString()
        })
        .eq('trip_id', tripId)

      console.log(`✅ Trip ${tripId}: Mapbox distance = ${Math.round(mapboxResult.distance * 100) / 100} km (${stops.length} stops)`)

      results.push({
        trip_id: tripId,
        plan_id: plan.plan_id,
        trip_sequence: trip.trip_sequence,
        status: 'updated',
        total_distance_km: Math.round(mapboxResult.distance * 100) / 100,
        total_drive_minutes: Math.round(mapboxResult.duration),
        stops_count: stops.length,
        method: 'mapbox'
      })
    }

    const updated = results.filter(r => r.status === 'updated').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error').length

    console.log(`✅ Distance calculation completed: ${updated} updated, ${skipped} skipped, ${errors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        summary: { updated, skipped, errors, total: results.length },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('❌ Distance calculation error:', error)
    return new Response(
      JSON.stringify({ error: 'Distance calculation failed', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
