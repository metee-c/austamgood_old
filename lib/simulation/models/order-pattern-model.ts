/**
 * Order Pattern Model for Digital Twin
 * 
 * Analyzes historical order patterns for daily, weekly, and monthly trends
 */

import { createClient } from '@/lib/supabase/server';
import {
  OrderPatternModel,
  DailyPattern,
  MonthlySeasonality,
} from '../types';

const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Load order pattern model from historical data
 */
export async function loadOrderPatternModel(periodDays: number = 90): Promise<OrderPatternModel> {
  const supabase = await createClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get orders with dates
  const { data: orders, error } = await supabase
    .from('wms_orders')
    .select('id, created_at, total_qty')
    .gte('created_at', startDateStr)
    .lte('created_at', endDateStr);

  if (error) {
    console.error('[OrderPatternModel] Error loading orders:', error);
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  // Aggregate by day
  const byDay: Record<string, { count: number; qty: number }> = {};
  const byDayOfWeek: Record<number, { count: number; qty: number; days: number }> = {};
  const byMonth: Record<number, { count: number; qty: number; days: number }> = {};

  // Initialize day of week
  for (let i = 0; i < 7; i++) {
    byDayOfWeek[i] = { count: 0, qty: 0, days: 0 };
  }

  // Initialize months
  for (let i = 1; i <= 12; i++) {
    byMonth[i] = { count: 0, qty: 0, days: 0 };
  }

  // Track unique days per day of week and month
  const uniqueDaysByDow: Record<number, Set<string>> = {};
  const uniqueDaysByMonth: Record<number, Set<string>> = {};
  for (let i = 0; i < 7; i++) uniqueDaysByDow[i] = new Set();
  for (let i = 1; i <= 12; i++) uniqueDaysByMonth[i] = new Set();

  orders?.forEach((order) => {
    const date = new Date(order.created_at);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const month = date.getMonth() + 1;
    const qty = order.total_qty || 0;

    // By day
    if (!byDay[dateStr]) {
      byDay[dateStr] = { count: 0, qty: 0 };
    }
    byDay[dateStr].count++;
    byDay[dateStr].qty += qty;

    // By day of week
    byDayOfWeek[dayOfWeek].count++;
    byDayOfWeek[dayOfWeek].qty += qty;
    uniqueDaysByDow[dayOfWeek].add(dateStr);

    // By month
    byMonth[month].count++;
    byMonth[month].qty += qty;
    uniqueDaysByMonth[month].add(dateStr);
  });

  // Calculate daily averages
  const totalDays = Object.keys(byDay).length;
  const totalOrders = orders?.length || 0;
  const totalQty = orders?.reduce((sum, o) => sum + (o.total_qty || 0), 0) || 0;
  
  const dailyAvgOrders = totalDays > 0 ? totalOrders / totalDays : 0;
  const dailyAvgQty = totalDays > 0 ? totalQty / totalDays : 0;

  // Calculate weekly pattern
  const weeklyPattern: DailyPattern[] = [];
  for (let i = 0; i < 7; i++) {
    const daysCount = uniqueDaysByDow[i].size || 1;
    const avgOrders = byDayOfWeek[i].count / daysCount;
    const avgQty = byDayOfWeek[i].qty / daysCount;
    const relativeVolume = dailyAvgOrders > 0 ? avgOrders / dailyAvgOrders : 1;

    weeklyPattern.push({
      day_of_week: i,
      day_name: DAY_NAMES[i],
      avg_orders: Math.round(avgOrders * 10) / 10,
      avg_qty: Math.round(avgQty),
      relative_volume: Math.round(relativeVolume * 100) / 100,
    });
  }

  // Find peak day of week
  const peakDow = weeklyPattern.reduce((max, day) => 
    day.avg_orders > max.avg_orders ? day : max, weeklyPattern[0]);

  // Calculate monthly seasonality
  const monthlySeasonality: MonthlySeasonality[] = [];
  for (let i = 1; i <= 12; i++) {
    const daysCount = uniqueDaysByMonth[i].size || 1;
    const avgOrders = byMonth[i].count / daysCount;
    const avgQty = byMonth[i].qty / daysCount;
    const seasonalityFactor = dailyAvgOrders > 0 ? avgOrders / dailyAvgOrders : 1;

    monthlySeasonality.push({
      month: i,
      month_name: MONTH_NAMES[i - 1],
      avg_orders: Math.round(avgOrders * 10) / 10,
      avg_qty: Math.round(avgQty),
      seasonality_factor: Math.round(seasonalityFactor * 100) / 100,
    });
  }

  // Find peak month
  const peakMonth = monthlySeasonality.reduce((max, month) => 
    month.avg_orders > max.avg_orders ? month : max, monthlySeasonality[0]);

  return {
    daily_avg_orders: Math.round(dailyAvgOrders * 10) / 10,
    daily_avg_qty: Math.round(dailyAvgQty),
    weekly_pattern: weeklyPattern,
    monthly_seasonality: monthlySeasonality,
    peak_day_of_week: peakDow.day_name,
    peak_month: peakMonth.month_name,
    data_period_days: periodDays,
  };
}

/**
 * Apply demand multiplier to order patterns
 */
export function applyDemandMultiplier(model: OrderPatternModel, multiplier: number): OrderPatternModel {
  // Deep clone
  const newModel: OrderPatternModel = JSON.parse(JSON.stringify(model));

  // Apply multiplier to daily averages
  newModel.daily_avg_orders = Math.round(newModel.daily_avg_orders * multiplier * 10) / 10;
  newModel.daily_avg_qty = Math.round(newModel.daily_avg_qty * multiplier);

  // Apply to weekly pattern
  newModel.weekly_pattern = newModel.weekly_pattern.map((day) => ({
    ...day,
    avg_orders: Math.round(day.avg_orders * multiplier * 10) / 10,
    avg_qty: Math.round(day.avg_qty * multiplier),
  }));

  // Apply to monthly seasonality
  newModel.monthly_seasonality = newModel.monthly_seasonality.map((month) => ({
    ...month,
    avg_orders: Math.round(month.avg_orders * multiplier * 10) / 10,
    avg_qty: Math.round(month.avg_qty * multiplier),
  }));

  return newModel;
}

/**
 * Get expected order volume for a specific day
 */
export function getExpectedVolume(
  model: OrderPatternModel,
  date: Date
): { expected_orders: number; expected_qty: number; relative_volume: number } {
  const dayOfWeek = date.getDay();
  const month = date.getMonth() + 1;

  const dayPattern = model.weekly_pattern.find((d) => d.day_of_week === dayOfWeek);
  const monthPattern = model.monthly_seasonality.find((m) => m.month === month);

  // Combine weekly and monthly factors
  const weeklyFactor = dayPattern?.relative_volume || 1;
  const monthlyFactor = monthPattern?.seasonality_factor || 1;
  const combinedFactor = (weeklyFactor + monthlyFactor) / 2;

  return {
    expected_orders: Math.round(model.daily_avg_orders * combinedFactor * 10) / 10,
    expected_qty: Math.round(model.daily_avg_qty * combinedFactor),
    relative_volume: Math.round(combinedFactor * 100) / 100,
  };
}
