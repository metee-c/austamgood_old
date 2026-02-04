import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withShadowLog } from '@/lib/logging/with-shadow-log';

export const dynamic = 'force-dynamic';

async function _GET(request: NextRequest) {
    try {
        const supabase = await createServerClient();
        
        // ตรวจสอบว่ามี receives สำหรับ customer B2205168 จริงๆ หรือไม่
        console.log('[DEBUG] Checking receives for customer B2205168...');
        
        const { data: receives, error: receivesError } = await supabase
            .from('wms_receives')
            .select('*')
            .eq('customer_id', 'B2205168');
            
        // ตรวจสอบว่ามี stops สำหรับลูกค้า K.U. Garden สาขา บางแค ใน receiving_route_stops
        console.log('[DEBUG] Checking stops for customer K.U. Garden สาขา บางแค...');
        
        const { data: stops, error: stopsError } = await supabase
            .from('receiving_route_stops')
            .select('*')
            .eq('stop_name', 'K.U. Garden สาขา บางแค');
            
        // ตรวจสอบว่ามี stops ทั้งหมดใน receiving_route_stops
        console.log('[DEBUG] Checking all stops in receiving_route_stops...');
        
        const { data: allStops, error: allStopsError } = await supabase
            .from('receiving_route_stops')
            .select('*')
            .limit(10);
            
        if (receivesError) {
            console.error('Error fetching receives:', receivesError);
            return NextResponse.json({ error: receivesError.message }, { status: 500 });
        }
        
        console.log(`[DEBUG] Found ${receives?.length || 0} receives for customer B2205168:`, receives);
        
        // ตรวจสอบว่ามี plan_inputs สำหรับ receives เหล่านี้หรือไม่
        if (receives && receives.length > 0) {
            const receiveIds = receives.map(r => r.receive_id);
            
            const { data: planInputs, error: planInputsError } = await supabase
                .from('receiving_route_plan_inputs')
                .select('*')
                .in('receive_id', receiveIds);
                
            if (planInputsError) {
                console.error('Error fetching plan inputs:', planInputsError);
                return NextResponse.json({ error: planInputsError.message }, { status: 500 });
            }
            
            console.log(`[DEBUG] Found ${planInputs?.length || 0} plan inputs for receives:`, planInputs);
            
            // ตรวจสอบว่ามี plans สำหรับ plan_inputs เหล่านี้หรือไม่
            if (planInputs && planInputs.length > 0) {
                const planIds = [...new Set(planInputs.map(p => p.plan_id))];
                
                const { data: plans, error: plansError } = await supabase
                    .from('receiving_route_plans')
                    .select('*')
                    .in('plan_id', planIds);
                    
                if (plansError) {
                    console.error('Error fetching plans:', plansError);
                    return NextResponse.json({ error: plansError.message }, { status: 500 });
                }
                
                console.log(`[DEBUG] Found ${plans?.length || 0} plans:`, plans);
                
                // ตรวจสอบว่ามี trips สำหรับ plans เหล่านี้หรือไม่
                if (plans && plans.length > 0) {
                    const { data: trips, error: tripsError } = await supabase
                        .from('receiving_route_trips')
                        .select('*')
                        .in('plan_id', planIds);
                        
                    if (tripsError) {
                        console.error('Error fetching trips:', tripsError);
                        return NextResponse.json({ error: tripsError.message }, { status: 500 });
                    }
                    
                    console.log(`[DEBUG] Found ${trips?.length || 0} trips:`, trips);
                }
            }
        }
        
        // ตรวจสอบออเดอร์พิเศษสำหรับ customer นี้
        const { data: specialOrders, error: specialOrdersError } = await supabase
            .from('wms_orders')
            .select('*')
            .eq('customer_id', 'B2205168')
            .eq('order_type', 'special');
            
        if (specialOrdersError) {
            console.error('Error fetching special orders:', specialOrdersError);
            return NextResponse.json({ error: specialOrdersError.message }, { status: 500 });
        }
        
        console.log(`[DEBUG] Found ${specialOrders?.length || 0} special orders for customer B2205168:`, specialOrders);

        return NextResponse.json({
            receives: receives || [],
            specialOrders: specialOrders || []
        });
        
    } catch (error: any) {
        console.error('Error in debug API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withShadowLog(_GET);
