// ===== Cross-Plan Transfer API =====
// Phase 5: Feature ใหม่ - ย้าย/แบ่งออเดอร์ข้ามแผน ตาม edit21.md
// Updated: รองรับ item-level transfer และ create_new_trip

import { withAuth } from '@/lib/api/with-auth';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
interface TransferItem {
  orderItemId: number;
  moveWeightKg: number;
  moveQuantity: number;
}

interface CrossPlanTransferRequest {
  source_plan_id: number;
  source_trip_id: number;
  source_stop_id: number;
  target_plan_id: number;
  target_trip_id: number | null;
  create_new_trip?: boolean;
  target_sequence: number;
  order_id: number;
  transfer_type: 'full' | 'partial';
  items?: TransferItem[];
  note?: string;
}

async function handlePost(request: NextRequest, context: any) {
  const supabase = await createClient();
  const userId = context.user?.user_id;
  const body: CrossPlanTransferRequest = await request.json();

  // Validation
  if (body.source_plan_id === body.target_plan_id) {
    return NextResponse.json(
      { error: 'ใช้ API ย้ายภายในแผนเดียวกันแทน', error_code: 'SAME_PLAN' },
      { status: 400 }
    );
  }

  if (!body.source_stop_id || !body.order_id) {
    return NextResponse.json(
      { error: 'ข้อมูลไม่ครบถ้วน', error_code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  if (!body.target_trip_id && !body.create_new_trip) {
    return NextResponse.json(
      { error: 'กรุณาเลือกคันปลายทางหรือสร้างคันใหม่', error_code: 'VALIDATION_ERROR' },
      { status: 400 }
    );
  }

  try {
    // ตรวจสอบว่าทั้งสองแผนเป็น status ที่แก้ไขได้
    const { data: plans, error: plansError } = await supabase
      .from('receiving_route_plans')
      .select('plan_id, status')
      .in('plan_id', [body.source_plan_id, body.target_plan_id]);

    if (plansError) {
      return NextResponse.json({ error: plansError.message }, { status: 500 });
    }

    const invalidPlan = plans?.find(p => !['draft', 'published', 'optimizing', 'approved'].includes(p.status));
    if (invalidPlan) {
      return NextResponse.json(
        { error: 'แผนที่เลือกอยู่ในสถานะที่ไม่สามารถแก้ไขได้', error_code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }

    // สร้างคันใหม่ถ้าต้องการ
    let targetTripId = body.target_trip_id;
    if (body.create_new_trip) {
      targetTripId = await createNewTrip(supabase, body.target_plan_id);
    }

    if (!targetTripId) {
      return NextResponse.json(
        { error: 'ไม่สามารถระบุคันปลายทางได้', error_code: 'INVALID_TRIP' },
        { status: 400 }
      );
    }

    // ดำเนินการย้าย
    if (body.transfer_type === 'partial' && body.items && body.items.length > 0) {
      const result = await performPartialTransfer(supabase, body, targetTripId, userId);
      return NextResponse.json(result);
    } else {
      const result = await performFullTransfer(supabase, body, targetTripId, userId);
      return NextResponse.json(result);
    }
  } catch (error: any) {
    console.error('Cross-plan transfer error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการย้ายออเดอร์', error_code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

async function createNewTrip(supabase: any, planId: number): Promise<number> {
  // หา trip_sequence ถัดไป
  const { data: existingTrips } = await supabase
    .from('receiving_route_trips')
    .select('trip_sequence, daily_trip_number')
    .eq('plan_id', planId)
    .order('trip_sequence', { ascending: false })
    .limit(1);

  const nextSequence = (existingTrips?.[0]?.trip_sequence || 0) + 1;
  const nextDailyNumber = (existingTrips?.[0]?.daily_trip_number || 0) + 1;

  // สร้าง trip ใหม่
  const { data: newTrip, error } = await supabase
    .from('receiving_route_trips')
    .insert({
      plan_id: planId,
      trip_sequence: nextSequence,
      daily_trip_number: nextDailyNumber,
      trip_status: 'draft',
      total_stops: 0,
      total_weight_kg: 0,
      total_volume_cbm: 0,
    })
    .select('trip_id')
    .single();

  if (error) {
    throw new Error(`ไม่สามารถสร้างคันใหม่: ${error.message}`);
  }

  return newTrip.trip_id;
}

async function performFullTransfer(
  supabase: any, 
  body: CrossPlanTransferRequest, 
  targetTripId: number,
  userId: number | undefined
) {
  // 1. ดึงข้อมูล stop เดิม
  const { data: sourceStop, error: stopError } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .eq('stop_id', body.source_stop_id)
    .single();

  if (stopError) {
    throw new Error(`ไม่พบจุดส่งต้นทาง: ${stopError.message}`);
  }

  // 2. ดึงข้อมูล target trip เพื่อหา sequence ถัดไป
  const { data: targetStops } = await supabase
    .from('receiving_route_stops')
    .select('sequence_no')
    .eq('trip_id', targetTripId)
    .order('sequence_no', { ascending: false })
    .limit(1);

  const nextSequence = body.target_sequence || ((targetStops?.[0]?.sequence_no || 0) + 1);

  // 3. สร้าง stop ใหม่ในแผนปลายทาง
  const { data: newStop, error: insertError } = await supabase
    .from('receiving_route_stops')
    .insert({
      trip_id: targetTripId,
      plan_id: body.target_plan_id,
      sequence_no: nextSequence,
      stop_name: sourceStop.stop_name,
      address: sourceStop.address,
      latitude: sourceStop.latitude,
      longitude: sourceStop.longitude,
      customer_id: sourceStop.customer_id,
      order_id: sourceStop.order_id,
      load_weight_kg: sourceStop.load_weight_kg,
      load_volume_cbm: sourceStop.load_volume_cbm,
      load_units: sourceStop.load_units,
      service_duration_minutes: sourceStop.service_duration_minutes,
      tags: sourceStop.tags,
      notes: body.note || sourceStop.notes,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`ไม่สามารถสร้างจุดส่งใหม่: ${insertError.message}`);
  }

  // 4. ย้าย stop_items (ถ้ามี)
  await supabase
    .from('receiving_route_stop_items')
    .update({
      stop_id: newStop.stop_id,
      trip_id: targetTripId,
    })
    .eq('stop_id', body.source_stop_id);

  // 5. ลบ stop จากแผนเดิม
  const { error: deleteError } = await supabase
    .from('receiving_route_stops')
    .delete()
    .eq('stop_id', body.source_stop_id);

  if (deleteError) {
    throw new Error(`ไม่สามารถลบจุดส่งเดิม: ${deleteError.message}`);
  }

  // 6. บันทึก transfer log
  await supabase.from('receiving_cross_plan_transfers').insert({
    source_plan_id: body.source_plan_id,
    source_trip_id: body.source_trip_id,
    source_stop_id: body.source_stop_id,
    target_plan_id: body.target_plan_id,
    target_trip_id: targetTripId,
    order_id: body.order_id,
    transferred_weight_kg: sourceStop.load_weight_kg,
    transfer_type: 'full',
    transferred_by: userId,
    notes: body.note,
  });

  // 7. Resequence stops ในทั้งสองแผน
  await resequenceStops(supabase, body.source_trip_id);
  await resequenceStops(supabase, targetTripId);

  // 8. Update trip metrics
  await updateTripMetrics(supabase, body.source_trip_id);
  await updateTripMetrics(supabase, targetTripId);

  return { success: true, new_stop_id: newStop.stop_id, transfer_type: 'full' };
}

async function performPartialTransfer(
  supabase: any,
  body: CrossPlanTransferRequest,
  targetTripId: number,
  userId: number | undefined
) {
  const items = body.items || [];
  
  // 1. ดึงข้อมูล stop เดิม
  const { data: sourceStop, error: stopError } = await supabase
    .from('receiving_route_stops')
    .select('*')
    .eq('stop_id', body.source_stop_id)
    .single();

  if (stopError) {
    throw new Error(`ไม่พบจุดส่งต้นทาง: ${stopError.message}`);
  }

  // 2. คำนวณน้ำหนักและจำนวนที่ย้าย
  const totalTransferWeight = items.reduce((sum, item) => sum + item.moveWeightKg, 0);
  const totalTransferQty = items.reduce((sum, item) => sum + item.moveQuantity, 0);

  // 3. ดึงข้อมูล target trip เพื่อหา sequence ถัดไป
  const { data: targetStops } = await supabase
    .from('receiving_route_stops')
    .select('sequence_no')
    .eq('trip_id', targetTripId)
    .order('sequence_no', { ascending: false })
    .limit(1);

  const nextSequence = body.target_sequence || ((targetStops?.[0]?.sequence_no || 0) + 1);

  // 4. สร้าง stop ใหม่ในแผนปลายทาง (ด้วยน้ำหนักที่ย้าย)
  const { data: newStop, error: insertError } = await supabase
    .from('receiving_route_stops')
    .insert({
      trip_id: targetTripId,
      plan_id: body.target_plan_id,
      sequence_no: nextSequence,
      stop_name: sourceStop.stop_name,
      address: sourceStop.address,
      latitude: sourceStop.latitude,
      longitude: sourceStop.longitude,
      customer_id: sourceStop.customer_id,
      order_id: sourceStop.order_id,
      load_weight_kg: totalTransferWeight,
      load_volume_cbm: null, // จะคำนวณใหม่
      load_units: totalTransferQty,
      service_duration_minutes: sourceStop.service_duration_minutes,
      tags: {
        ...sourceStop.tags,
        split_from_stop_id: body.source_stop_id,
        transferred_items: items.map(i => i.orderItemId)
      },
      notes: body.note || `ย้ายบางส่วนจากแผน ${body.source_plan_id}`,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`ไม่สามารถสร้างจุดส่งใหม่: ${insertError.message}`);
  }

  // 5. อัพเดท stop เดิม (ลดน้ำหนักและจำนวน)
  const remainingWeight = (sourceStop.load_weight_kg || 0) - totalTransferWeight;
  const remainingUnits = (sourceStop.load_units || 0) - totalTransferQty;

  await supabase
    .from('receiving_route_stops')
    .update({
      load_weight_kg: Math.max(0, remainingWeight),
      load_units: Math.max(0, remainingUnits),
      notes: sourceStop.notes 
        ? `${sourceStop.notes}\n[ย้ายบางส่วนไปแผน ${body.target_plan_id}]`
        : `[ย้ายบางส่วนไปแผน ${body.target_plan_id}]`
    })
    .eq('stop_id', body.source_stop_id);

  // 6. สร้าง stop_items สำหรับ stop ใหม่ และอัพเดท/ลบ items เดิมใน source stop
  // ดึง stop_items เดิมของ source stop
  const { data: existingSourceItems } = await supabase
    .from('receiving_route_stop_items')
    .select('*')
    .eq('stop_id', body.source_stop_id);

  for (const item of items) {
    // สร้าง stop_item ใหม่ใน target stop
    await supabase.from('receiving_route_stop_items').insert({
      stop_id: newStop.stop_id,
      trip_id: targetTripId,
      plan_id: body.target_plan_id,
      order_id: body.order_id,
      order_item_id: item.orderItemId,
      allocated_weight_kg: item.moveWeightKg,
      allocated_quantity: item.moveQuantity,
      notes: `ย้ายจากแผน ${body.source_plan_id}`
    });

    // อัพเดท/ลบ stop_item เดิมใน source stop
    const existingItem = (existingSourceItems || []).find(
      (ei: any) => ei.order_item_id === item.orderItemId
    );

    if (existingItem) {
      const newQty = (existingItem.allocated_quantity || 0) - (item.moveQuantity || 0);
      const newWeight = (existingItem.allocated_weight_kg || 0) - (item.moveWeightKg || 0);

      if (newQty <= 0) {
        // ลบ record ถ้าไม่มี quantity เหลือ
        await supabase
          .from('receiving_route_stop_items')
          .delete()
          .eq('stop_item_id', existingItem.stop_item_id);
      } else {
        // อัพเดท quantity ที่เหลือ
        await supabase
          .from('receiving_route_stop_items')
          .update({
            allocated_quantity: newQty,
            allocated_weight_kg: newWeight,
            notes: existingItem.notes 
              ? `${existingItem.notes} [ย้ายบางส่วนไปแผน ${body.target_plan_id}]`
              : `[ย้ายบางส่วนไปแผน ${body.target_plan_id}]`
          })
          .eq('stop_item_id', existingItem.stop_item_id);
      }
    }
  }

  // 7. บันทึก transfer log
  await supabase.from('receiving_cross_plan_transfers').insert({
    source_plan_id: body.source_plan_id,
    source_trip_id: body.source_trip_id,
    source_stop_id: body.source_stop_id,
    target_plan_id: body.target_plan_id,
    target_trip_id: targetTripId,
    order_id: body.order_id,
    transferred_weight_kg: totalTransferWeight,
    transfer_type: 'partial',
    transferred_by: userId,
    notes: body.note,
    transferred_items: { items }
  });

  // 8. Update trip metrics
  await updateTripMetrics(supabase, body.source_trip_id);
  await updateTripMetrics(supabase, targetTripId);

  return { 
    success: true, 
    new_stop_id: newStop.stop_id, 
    transfer_type: 'partial',
    transferred_weight_kg: totalTransferWeight,
    transferred_qty: totalTransferQty
  };
}

async function resequenceStops(supabase: any, tripId: number) {
  const { data: stops, error } = await supabase
    .from('receiving_route_stops')
    .select('stop_id')
    .eq('trip_id', tripId)
    .order('sequence_no', { ascending: true });

  if (error || !stops) return;

  for (let i = 0; i < stops.length; i++) {
    await supabase
      .from('receiving_route_stops')
      .update({ sequence_no: i + 1 })
      .eq('stop_id', stops[i].stop_id);
  }
}

async function updateTripMetrics(supabase: any, tripId: number) {
  const { data: stops, error } = await supabase
    .from('receiving_route_stops')
    .select('load_weight_kg, load_volume_cbm, load_units')
    .eq('trip_id', tripId);

  if (error || !stops) return;

  const totalWeight = stops.reduce((sum: number, s: any) => sum + (Number(s.load_weight_kg) || 0), 0);
  const totalVolume = stops.reduce((sum: number, s: any) => sum + (Number(s.load_volume_cbm) || 0), 0);
  const totalStops = stops.length;

  await supabase
    .from('receiving_route_trips')
    .update({
      total_weight_kg: totalWeight,
      total_volume_cbm: totalVolume,
      total_stops: totalStops,
    })
    .eq('trip_id', tripId);
}

export const POST = withAuth(handlePost);
