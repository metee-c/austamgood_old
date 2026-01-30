// Supabase Edge Function: Cleanup Job
// Runs every hour to clean up expired locks, idempotency keys, and old data
//
// Deploy: supabase functions deploy cleanup-job
// 
// To enable cron, add to supabase/config.toml:
// [functions.cleanup-job]
// schedule = "0 * * * *"  # Every hour

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log('🧹 Starting cleanup job...')
    const startTime = Date.now()

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      cleanup: {},
      health: {},
      duration_ms: 0
    }

    // 1. Run cleanup with monitoring
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_expired_locks_and_keys_with_monitoring')

    if (cleanupError) {
      console.error('❌ Cleanup error:', cleanupError)
      results.cleanup = { error: cleanupError.message }
    } else {
      results.cleanup = cleanupResult?.[0] || {}
      console.log(`✅ Cleanup: ${results.cleanup.locks_deleted} locks, ${results.cleanup.keys_deleted} keys deleted`)
    }

    // 2. Cleanup old metrics (keep 7 days)
    const { data: metricsDeleted, error: metricsError } = await supabase
      .rpc('cleanup_old_metrics', { p_days: 7 })

    if (!metricsError) {
      results.cleanup.metrics_deleted = metricsDeleted
      console.log(`✅ Deleted ${metricsDeleted} old metrics`)
    }

    // 3. Cleanup old alerts (keep 30 days)
    const { data: alertsDeleted, error: alertsError } = await supabase
      .rpc('cleanup_old_alerts', { p_days: 30 })

    if (!alertsError) {
      results.cleanup.alerts_deleted = alertsDeleted
      console.log(`✅ Deleted ${alertsDeleted} old alerts`)
    }

    // 4. Get system health status
    const { data: healthStatus, error: healthError } = await supabase
      .rpc('get_system_health_status')

    if (!healthError && healthStatus) {
      results.health = healthStatus.reduce((acc: any, item: any) => {
        acc[item.component] = {
          status: item.status,
          details: item.details
        }
        return acc
      }, {})
    }

    // 5. Determine overall status
    const hasErrors = Object.values(results.health).some(
      (h: any) => h.status === 'critical' || h.status === 'error'
    )
    const hasWarnings = Object.values(results.health).some(
      (h: any) => h.status === 'warning'
    )

    results.overall_status = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy'
    results.duration_ms = Date.now() - startTime

    console.log(`✅ Cleanup job completed in ${results.duration_ms}ms - Status: ${results.overall_status}`)

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Cleanup job error:', error)
    return new Response(
      JSON.stringify({ error: 'Cleanup job failed', details: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
