/**
 * Labor Model for Digital Twin
 * 
 * Calculates labor capacity and productivity from historical data
 * 
 * Properties validated:
 * - Property 8: Labor Capacity Calculation
 */

import { createClient } from '@/lib/supabase/server';
import {
  LaborModel,
  HeadcountByRole,
  ProductivityRates,
  DailyCapacity,
  WorkforceChange,
} from '../types';

// Default hours per shift
const DEFAULT_HOURS_PER_SHIFT = 8;

/**
 * Load labor model from database
 */
export async function loadLaborModel(periodDays: number = 30): Promise<LaborModel> {
  const supabase = await createClient();

  // Get employee headcount by role
  const { data: employees, error: empError } = await supabase
    .from('master_employee')
    .select('id, role, is_active')
    .eq('is_active', true);

  if (empError) {
    console.error('[LaborModel] Error loading employees:', empError);
    throw new Error(`Failed to load employees: ${empError.message}`);
  }

  // Count by role
  const headcount: HeadcountByRole = {
    total: employees?.length || 0,
    pickers: 0,
    receivers: 0,
    loaders: 0,
    other: 0,
  };

  employees?.forEach((emp) => {
    const role = (emp.role || '').toLowerCase();
    if (role.includes('pick') || role.includes('จัด')) {
      headcount.pickers++;
    } else if (role.includes('receiv') || role.includes('รับ')) {
      headcount.receivers++;
    } else if (role.includes('load') || role.includes('โหลด')) {
      headcount.loaders++;
    } else {
      headcount.other++;
    }
  });

  // If no specific roles found, distribute evenly
  if (headcount.pickers === 0 && headcount.receivers === 0 && headcount.loaders === 0) {
    const workers = headcount.total - headcount.other;
    headcount.pickers = Math.ceil(workers * 0.5);
    headcount.receivers = Math.ceil(workers * 0.3);
    headcount.loaders = workers - headcount.pickers - headcount.receivers;
  }

  // Calculate productivity from historical data
  const productivity = await calculateProductivityRates(supabase, periodDays);

  // Calculate daily capacity
  // Property 8: daily_capacity = workers * hours_per_shift * productivity_rate
  const capacity: DailyCapacity = {
    picking_capacity_qty: headcount.pickers * DEFAULT_HOURS_PER_SHIFT * productivity.picks_per_hour_per_picker,
    receiving_capacity_qty: headcount.receivers * DEFAULT_HOURS_PER_SHIFT * productivity.receives_per_hour_per_receiver,
    loading_capacity_qty: headcount.loaders * DEFAULT_HOURS_PER_SHIFT * productivity.loads_per_hour_per_loader,
    hours_per_shift: DEFAULT_HOURS_PER_SHIFT,
  };

  // Calculate utilization (would need actual demand data)
  // For now, use placeholder values
  const utilization = {
    picking_utilization: 0,
    receiving_utilization: 0,
    loading_utilization: 0,
    overall_utilization: 0,
  };

  return {
    headcount,
    productivity,
    capacity,
    utilization,
  };
}

/**
 * Calculate productivity rates from historical data
 */
async function calculateProductivityRates(
  supabase: any,
  periodDays: number
): Promise<ProductivityRates> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get picking data from picklists
  const { data: picklists, error: pickError } = await supabase
    .from('wms_picklists')
    .select('id, status, picked_qty, created_at, completed_at')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr)
    .eq('status', 'completed');

  // Get receiving data
  const { data: receives, error: recError } = await supabase
    .from('receiving_orders')
    .select('id, status, created_at')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr)
    .eq('status', 'completed');

  // Calculate picks per hour
  let totalPicks = 0;
  let totalPickHours = 0;
  
  picklists?.forEach((pl: any) => {
    totalPicks += pl.picked_qty || 0;
    if (pl.created_at && pl.completed_at) {
      const hours = (new Date(pl.completed_at).getTime() - new Date(pl.created_at).getTime()) / (1000 * 60 * 60);
      if (hours > 0 && hours < 24) { // Reasonable range
        totalPickHours += hours;
      }
    }
  });

  // Default productivity rates if no data
  const picksPerHour = totalPickHours > 0 ? totalPicks / totalPickHours : 50; // Default 50 picks/hour
  const receivesPerHour = 30; // Default 30 receives/hour
  const loadsPerHour = 20; // Default 20 loads/hour

  // Determine confidence based on data points
  const dataPoints = (picklists?.length || 0) + (receives?.length || 0);
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (dataPoints >= 100) confidence = 'high';
  else if (dataPoints >= 30) confidence = 'medium';

  return {
    picks_per_hour_per_picker: Math.round(picksPerHour),
    receives_per_hour_per_receiver: Math.round(receivesPerHour),
    loads_per_hour_per_loader: Math.round(loadsPerHour),
    data_points: dataPoints,
    confidence,
  };
}

/**
 * Apply workforce change to labor model
 * Property 8: Labor Capacity Calculation
 */
export function applyWorkforceChange(model: LaborModel, change: WorkforceChange): LaborModel {
  // Deep clone to ensure isolation
  const newModel: LaborModel = JSON.parse(JSON.stringify(model));

  // Apply shift hours change
  if (change.shift_hours_change !== undefined) {
    newModel.capacity.hours_per_shift += change.shift_hours_change;
    newModel.capacity.hours_per_shift = Math.max(1, newModel.capacity.hours_per_shift); // Min 1 hour
  }

  // Apply worker count change (as percentage or absolute)
  if (change.worker_count_change !== undefined) {
    const changePercent = change.worker_count_change / 100;
    const role = change.role || 'all';

    if (role === 'all' || role === 'pickers') {
      newModel.headcount.pickers = Math.max(0, Math.round(newModel.headcount.pickers * (1 + changePercent)));
    }
    if (role === 'all' || role === 'receivers') {
      newModel.headcount.receivers = Math.max(0, Math.round(newModel.headcount.receivers * (1 + changePercent)));
    }
    if (role === 'all' || role === 'loaders') {
      newModel.headcount.loaders = Math.max(0, Math.round(newModel.headcount.loaders * (1 + changePercent)));
    }

    newModel.headcount.total = 
      newModel.headcount.pickers + 
      newModel.headcount.receivers + 
      newModel.headcount.loaders + 
      newModel.headcount.other;
  }

  // Apply productivity change
  if (change.productivity_change_percent !== undefined) {
    const changePercent = change.productivity_change_percent / 100;
    newModel.productivity.picks_per_hour_per_picker = Math.round(
      newModel.productivity.picks_per_hour_per_picker * (1 + changePercent)
    );
    newModel.productivity.receives_per_hour_per_receiver = Math.round(
      newModel.productivity.receives_per_hour_per_receiver * (1 + changePercent)
    );
    newModel.productivity.loads_per_hour_per_loader = Math.round(
      newModel.productivity.loads_per_hour_per_loader * (1 + changePercent)
    );
  }

  // Recalculate capacity
  // Property 8: daily_capacity = workers * hours_per_shift * productivity_rate
  newModel.capacity.picking_capacity_qty = 
    newModel.headcount.pickers * 
    newModel.capacity.hours_per_shift * 
    newModel.productivity.picks_per_hour_per_picker;

  newModel.capacity.receiving_capacity_qty = 
    newModel.headcount.receivers * 
    newModel.capacity.hours_per_shift * 
    newModel.productivity.receives_per_hour_per_receiver;

  newModel.capacity.loading_capacity_qty = 
    newModel.headcount.loaders * 
    newModel.capacity.hours_per_shift * 
    newModel.productivity.loads_per_hour_per_loader;

  return newModel;
}

/**
 * Calculate required workers for given demand
 */
export function calculateRequiredWorkers(
  model: LaborModel,
  demand: { picking: number; receiving: number; loading: number }
): { pickers: number; receivers: number; loaders: number; total: number } {
  const hoursPerShift = model.capacity.hours_per_shift;

  const requiredPickers = Math.ceil(
    demand.picking / (hoursPerShift * model.productivity.picks_per_hour_per_picker)
  );
  const requiredReceivers = Math.ceil(
    demand.receiving / (hoursPerShift * model.productivity.receives_per_hour_per_receiver)
  );
  const requiredLoaders = Math.ceil(
    demand.loading / (hoursPerShift * model.productivity.loads_per_hour_per_loader)
  );

  return {
    pickers: requiredPickers,
    receivers: requiredReceivers,
    loaders: requiredLoaders,
    total: requiredPickers + requiredReceivers + requiredLoaders,
  };
}

/**
 * Calculate overtime or additional workers needed
 */
export function calculateLaborGap(
  model: LaborModel,
  demand: { picking: number; receiving: number; loading: number }
): {
  has_gap: boolean;
  overtime_hours_needed: number;
  additional_workers_needed: number;
  bottleneck_role: string | null;
} {
  const required = calculateRequiredWorkers(model, demand);
  
  const pickerGap = required.pickers - model.headcount.pickers;
  const receiverGap = required.receivers - model.headcount.receivers;
  const loaderGap = required.loaders - model.headcount.loaders;

  const maxGap = Math.max(pickerGap, receiverGap, loaderGap);
  
  if (maxGap <= 0) {
    return {
      has_gap: false,
      overtime_hours_needed: 0,
      additional_workers_needed: 0,
      bottleneck_role: null,
    };
  }

  // Determine bottleneck role
  let bottleneckRole: string | null = null;
  if (pickerGap === maxGap) bottleneckRole = 'pickers';
  else if (receiverGap === maxGap) bottleneckRole = 'receivers';
  else if (loaderGap === maxGap) bottleneckRole = 'loaders';

  // Calculate overtime needed (simplified)
  const overtimeHours = maxGap * model.capacity.hours_per_shift;

  return {
    has_gap: true,
    overtime_hours_needed: overtimeHours,
    additional_workers_needed: maxGap,
    bottleneck_role: bottleneckRole,
  };
}
