/**
 * Forecast Database Functions
 * ใช้สถิติขั้นสูงสำหรับการประมาณการสต็อก
 */

import { createClient } from '@/lib/supabase/server';

export interface ForecastSKU {
  sku_id: string;
  sku_name: string;
  category: string;
  sub_category: string;
  brand: string;
  qty_per_pack: number;
  safety_stock: number;
  calculated_safety_stock: number;
  demand_std_dev: number;
  reorder_point: number;
  // Calculated fields
  total_stock: number;
  avg_daily_ship: number;
  days_of_supply: number;
  pending_order_qty: number;        // ยอดรอส่งจาก orders ที่ยังไม่ loaded
  adjusted_days_of_supply: number;  // Days of Supply หลังหักยอดรอส่ง
  ship_trend: 'increasing' | 'stable' | 'decreasing';
  trend_slope: number;           // Sen's Slope (หน่วย/วัน)
  trend_significance: number;    // p-value จาก Mann-Kendall Test
  confidence_level: 'high' | 'medium' | 'low';
  last_ship_date: string | null;
  ship_data_days: number;
  suggested_production: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  priority_score: number;        // คะแนนความสำคัญ 1-10 (10 = วิกฤตที่สุด)
  urgent_order_qty: number;      // ยอดออเดอร์ที่ต้องส่งใน 3 วัน
  days_until_stockout: number;   // จำนวนวันก่อนสต็อกหมด (รวม pending orders)
}

export interface ForecastFilters {
  search?: string;
  priority?: string;
  subCategory?: string;
  page?: number;
  pageSize?: number;
}

export interface ForecastResult {
  data: ForecastSKU[];
  totalCount: number;
  summary: {
    totalSKUs: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgDaysOfSupply: number;
  };
}

/**
 * คำนวณค่าเฉลี่ยการจ่ายต่อวันโดยใช้วิธีทางสถิติที่แม่นยำที่สุด
 * 
 * วิธีการ: Hybrid Approach ผสมผสาน 3 วิธี
 * 1. Trimmed Mean (ตัด outliers 10% บน-ล่าง) - robust ต่อค่าผิดปกติ
 * 2. EWMA (Exponential Weighted Moving Average) - ให้น้ำหนักข้อมูลล่าสุด
 * 3. Median - robust estimator สำหรับ central tendency
 * 
 * ผลลัพธ์: ใช้ค่าเฉลี่ยถ่วงน้ำหนักของทั้ง 3 วิธี
 * - EWMA: 50% (ให้ความสำคัญกับแนวโน้มล่าสุด)
 * - Trimmed Mean: 30% (robust ต่อ outliers)
 * - Median: 20% (backup สำหรับข้อมูลที่มี outliers มาก)
 */
interface AvgDailyShipResult {
  value: number;
  ewma: number;
  trimmedMean: number;
  median: number;
  method: string;
}

function calculateAdvancedAvgDailyShip(dailyShips: number[]): AvgDailyShipResult {
  const defaultResult: AvgDailyShipResult = {
    value: 0,
    ewma: 0,
    trimmedMean: 0,
    median: 0,
    method: 'no_data'
  };

  if (dailyShips.length === 0) return defaultResult;

  // กรองเฉพาะวันที่มีการจ่าย (ไม่รวมวันที่ = 0) สำหรับบางการคำนวณ
  const nonZeroDays = dailyShips.filter(v => v > 0);

  // 1. คำนวณ EWMA (Exponential Weighted Moving Average)
  // Alpha = 0.3 ให้น้ำหนักกับข้อมูลล่าสุดมากขึ้น
  const alpha = 0.3;
  let ewma = dailyShips[0];
  for (let i = 1; i < dailyShips.length; i++) {
    ewma = alpha * dailyShips[i] + (1 - alpha) * ewma;
  }

  // 2. คำนวณ Trimmed Mean (ตัด 10% บน-ล่าง)
  // ใช้ข้อมูลทั้งหมด (รวมวันที่ = 0) เพื่อสะท้อนความถี่การจ่ายจริง
  const sortedAll = [...dailyShips].sort((a, b) => a - b);
  const trimPercent = 0.1; // ตัด 10% บน-ล่าง
  const trimCount = Math.floor(sortedAll.length * trimPercent);
  const trimmedData = sortedAll.slice(trimCount, sortedAll.length - trimCount);
  const trimmedMean = trimmedData.length > 0
    ? trimmedData.reduce((a, b) => a + b, 0) / trimmedData.length
    : sortedAll.reduce((a, b) => a + b, 0) / sortedAll.length;

  // 3. คำนวณ Median
  const medianIndex = Math.floor(sortedAll.length / 2);
  const median = sortedAll.length % 2 === 0
    ? (sortedAll[medianIndex - 1] + sortedAll[medianIndex]) / 2
    : sortedAll[medianIndex];

  // 4. คำนวณ Coefficient of Variation (CV) เพื่อปรับน้ำหนัก
  const mean = dailyShips.reduce((a, b) => a + b, 0) / dailyShips.length;
  const variance = dailyShips.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyShips.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  // 5. ปรับน้ำหนักตาม CV
  // ถ้า CV สูง (ข้อมูลแปรปรวนมาก) ให้น้ำหนัก Median และ Trimmed Mean มากขึ้น
  let ewmaWeight = 0.5;
  let trimmedWeight = 0.3;
  let medianWeight = 0.2;

  if (cv > 1.5) {
    // ข้อมูลแปรปรวนมาก - ใช้ robust methods มากขึ้น
    ewmaWeight = 0.3;
    trimmedWeight = 0.35;
    medianWeight = 0.35;
  } else if (cv > 1.0) {
    // ข้อมูลแปรปรวนปานกลาง
    ewmaWeight = 0.4;
    trimmedWeight = 0.35;
    medianWeight = 0.25;
  }

  // 6. คำนวณค่าเฉลี่ยถ่วงน้ำหนัก
  const hybridAvg = (ewma * ewmaWeight) + (trimmedMean * trimmedWeight) + (median * medianWeight);

  // กำหนด method ที่ใช้
  let method = 'hybrid';
  if (cv > 1.5) method = 'hybrid_robust';
  else if (dailyShips.length < 14) method = 'hybrid_limited_data';

  return {
    value: hybridAvg,
    ewma,
    trimmedMean,
    median,
    method
  };
}

/**
 * Legacy function สำหรับ backward compatibility
 * คำนวณ EWMA อย่างเดียว
 */
function calculateWeightedMovingAverage(dailyShips: number[]): number {
  return calculateAdvancedAvgDailyShip(dailyShips).value;
}

/**
 * วิเคราะห์แนวโน้มการจ่ายสินค้าโดยใช้ Mann-Kendall Test และ Sen's Slope
 * 
 * Mann-Kendall Test: Non-parametric test สำหรับตรวจสอบ monotonic trend
 * - ไม่ต้องสมมติว่าข้อมูลเป็น normal distribution
 * - Robust ต่อ outliers
 * - เหมาะสำหรับ time series data
 * 
 * Sen's Slope: Robust estimator ของ slope
 * - คำนวณจาก median ของ slopes ทั้งหมด
 * - ไม่ได้รับผลกระทบจาก outliers
 */
interface TrendAnalysisResult {
  trend: 'increasing' | 'stable' | 'decreasing';
  slope: number;           // Sen's Slope (หน่วย/วัน)
  significance: number;    // p-value (ยิ่งน้อยยิ่ง significant)
}

function analyzeTrendAdvanced(dailyShips: number[]): TrendAnalysisResult {
  const defaultResult: TrendAnalysisResult = { trend: 'stable', slope: 0, significance: 1 };

  if (dailyShips.length < 10) return defaultResult;

  // ใช้ข้อมูล 30 วันล่าสุด (หรือทั้งหมดถ้าน้อยกว่า)
  const recentData = dailyShips.slice(-30);
  const n = recentData.length;

  if (n < 10) return defaultResult;

  // === Mann-Kendall Test ===
  // คำนวณ S statistic
  let S = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = recentData[j] - recentData[i];
      if (diff > 0) S += 1;
      else if (diff < 0) S -= 1;
      // diff === 0 ไม่นับ
    }
  }

  // คำนวณ Variance ของ S
  // สำหรับกรณีที่มี ties (ค่าซ้ำ)
  const tieGroups: Record<number, number> = {};
  recentData.forEach(val => {
    tieGroups[val] = (tieGroups[val] || 0) + 1;
  });

  let tieCorrection = 0;
  Object.values(tieGroups).forEach(t => {
    if (t > 1) {
      tieCorrection += t * (t - 1) * (2 * t + 5);
    }
  });

  const varS = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;

  // คำนวณ Z-score
  let Z: number;
  if (S > 0) {
    Z = (S - 1) / Math.sqrt(varS);
  } else if (S < 0) {
    Z = (S + 1) / Math.sqrt(varS);
  } else {
    Z = 0;
  }

  // คำนวณ p-value (two-tailed) โดยใช้ approximation
  // P(Z) ≈ 1 - Φ(|Z|) สำหรับ standard normal
  const absZ = Math.abs(Z);
  // Approximation ของ CDF ของ standard normal
  const pValue = 2 * (1 - normalCDF(absZ));

  // === Sen's Slope ===
  // คำนวณ slopes ทั้งหมดระหว่างทุกคู่ของจุด
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const slope = (recentData[j] - recentData[i]) / (j - i);
      slopes.push(slope);
    }
  }

  // Sen's Slope = median ของ slopes ทั้งหมด
  slopes.sort((a, b) => a - b);
  const medianIndex = Math.floor(slopes.length / 2);
  const sensSlope = slopes.length % 2 === 0
    ? (slopes[medianIndex - 1] + slopes[medianIndex]) / 2
    : slopes[medianIndex];

  // === กำหนดแนวโน้ม ===
  // ใช้ significance level α = 0.05
  // และ slope ต้องมีนัยสำคัญทางปฏิบัติ (> 1% ของค่าเฉลี่ย)
  const mean = recentData.reduce((a, b) => a + b, 0) / n;
  const practicalThreshold = mean * 0.01; // 1% ของค่าเฉลี่ย

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';

  if (pValue < 0.05) {
    // Statistically significant
    if (sensSlope > practicalThreshold) {
      trend = 'increasing';
    } else if (sensSlope < -practicalThreshold) {
      trend = 'decreasing';
    }
  }

  return {
    trend,
    slope: Math.round(sensSlope * 100) / 100,
    significance: Math.round(pValue * 1000) / 1000
  };
}

/**
 * Approximation ของ CDF ของ Standard Normal Distribution
 * ใช้ Abramowitz and Stegun approximation
 */
function normalCDF(x: number): number {
  if (x < 0) return 1 - normalCDF(-x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * x);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  return 1 - (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-x * x / 2);
}

/**
 * วิเคราะห์แนวโน้มการจ่ายสินค้า (Legacy function สำหรับ backward compatibility)
 * ใช้ Linear Regression เพื่อหา slope
 */
function analyzeTrend(dailyShips: number[]): 'increasing' | 'stable' | 'decreasing' {
  return analyzeTrendAdvanced(dailyShips).trend;
}

/**
 * คำนวณระดับความเชื่อมั่นของการประมาณการ
 * ขึ้นอยู่กับจำนวนข้อมูลและความแปรปรวน
 */
function calculateConfidence(dailyShips: number[], dataDays: number): 'high' | 'medium' | 'low' {
  if (dataDays < 7) return 'low';
  if (dataDays < 14) return 'medium';

  // คำนวณ Coefficient of Variation (CV)
  if (dailyShips.length === 0) return 'low';

  const mean = dailyShips.reduce((a, b) => a + b, 0) / dailyShips.length;
  if (mean === 0) return 'low';

  const variance = dailyShips.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyShips.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // CV < 0.5 = high confidence, CV < 1.0 = medium, else low
  if (cv < 0.5) return 'high';
  if (cv < 1.0) return 'medium';
  return 'low';
}

/**
 * กำหนดระดับความสำคัญตาม Days of Supply
 */
function determinePriority(daysOfSupply: number, safetyStock: number, currentStock: number): 'critical' | 'high' | 'medium' | 'low' {
  // Critical: สต็อกจะหมดใน 7 วัน หรือต่ำกว่า safety stock
  if (daysOfSupply <= 7 || currentStock < safetyStock) return 'critical';
  // High: สต็อกจะหมดใน 14 วัน
  if (daysOfSupply <= 14) return 'high';
  // Medium: สต็อกจะหมดใน 30 วัน
  if (daysOfSupply <= 30) return 'medium';
  // Low: สต็อกเพียงพอมากกว่า 30 วัน
  return 'low';
}

/**
 * คำนวณคะแนนความสำคัญ 1-10 (Priority Score)
 * 
 * สูตร: รวมหลายปัจจัยเข้าด้วยกัน
 * 1. Days Until Stockout (40%) - จำนวนวันก่อนสต็อกหมด
 * 2. Urgent Order Ratio (25%) - สัดส่วนออเดอร์เร่งด่วน (ต้องส่งใน 3 วัน)
 * 3. Safety Stock Gap (20%) - ช่องว่างจาก Safety Stock
 * 4. Trend Factor (15%) - แนวโน้มความต้องการ
 * 
 * คะแนน 1 = สบายมาก (∞ days), 10 = วิกฤตที่สุด (หมดแล้ว/ติดลบ)
 */
interface PriorityScoreResult {
  score: number;
  daysUntilStockout: number;
  components: {
    stockoutScore: number;
    urgentScore: number;
    safetyGapScore: number;
    trendScore: number;
  };
}

function calculatePriorityScore(
  availableStock: number,
  avgDailyShip: number,
  pendingOrderQty: number,
  urgentOrderQty: number,
  safetyStock: number,
  trendSlope: number,
  pendingByDate: { date: string; qty: number }[]
): PriorityScoreResult {

  // 1. คำนวณ Days Until Stockout (รวม pending orders ตาม delivery date)
  // จำลองการจ่ายสินค้าตาม delivery date
  let remainingStock = availableStock;
  let daysUntilStockout = 999;

  // เรียงลำดับ pending orders ตาม delivery date
  const sortedPending = [...pendingByDate].sort((a, b) => a.date.localeCompare(b.date));

  const priorityToday = new Date();
  priorityToday.setHours(0, 0, 0, 0);

  // จำลองการจ่ายสินค้าทีละวัน
  for (let day = 0; day <= 90; day++) {
    const checkDate = new Date(priorityToday);
    checkDate.setDate(checkDate.getDate() + day);
    const checkDateStr = checkDate.toISOString().split('T')[0];

    // หักยอด pending orders ที่ต้องส่งในวันนี้
    const todayPending = sortedPending
      .filter(p => p.date === checkDateStr)
      .reduce((sum, p) => sum + p.qty, 0);

    // หักยอดจ่ายเฉลี่ยต่อวัน
    remainingStock -= (todayPending + avgDailyShip);

    if (remainingStock <= 0) {
      daysUntilStockout = day;
      break;
    }
  }

  // 2. คำนวณ Stockout Score (40%)
  // 0 วัน = 10, 7 วัน = 8, 14 วัน = 6, 30 วัน = 4, 60 วัน = 2, 90+ วัน = 1
  let stockoutScore: number;
  if (daysUntilStockout <= 0) {
    stockoutScore = 10;
  } else if (daysUntilStockout <= 3) {
    stockoutScore = 9.5 - (daysUntilStockout * 0.5);
  } else if (daysUntilStockout <= 7) {
    stockoutScore = 8 - ((daysUntilStockout - 3) * 0.5);
  } else if (daysUntilStockout <= 14) {
    stockoutScore = 6 - ((daysUntilStockout - 7) * 0.29);
  } else if (daysUntilStockout <= 30) {
    stockoutScore = 4 - ((daysUntilStockout - 14) * 0.125);
  } else if (daysUntilStockout <= 60) {
    stockoutScore = 2 - ((daysUntilStockout - 30) * 0.033);
  } else {
    stockoutScore = 1;
  }

  // 3. คำนวณ Urgent Order Score (25%)
  // สัดส่วนออเดอร์เร่งด่วนต่อสต็อกที่มี
  let urgentScore = 1;
  if (availableStock > 0 && urgentOrderQty > 0) {
    const urgentRatio = urgentOrderQty / availableStock;
    if (urgentRatio >= 1) {
      urgentScore = 10; // ออเดอร์เร่งด่วนมากกว่าสต็อก
    } else if (urgentRatio >= 0.8) {
      urgentScore = 9;
    } else if (urgentRatio >= 0.6) {
      urgentScore = 7;
    } else if (urgentRatio >= 0.4) {
      urgentScore = 5;
    } else if (urgentRatio >= 0.2) {
      urgentScore = 3;
    } else {
      urgentScore = 1 + (urgentRatio * 10);
    }
  } else if (availableStock <= 0 && urgentOrderQty > 0) {
    urgentScore = 10; // ไม่มีสต็อกแต่มีออเดอร์เร่งด่วน
  }

  // 4. คำนวณ Safety Stock Gap Score (20%)
  // ช่องว่างระหว่างสต็อกปัจจุบันกับ Safety Stock
  let safetyGapScore = 1;
  if (safetyStock > 0) {
    const gapRatio = (safetyStock - availableStock) / safetyStock;
    if (gapRatio >= 1) {
      safetyGapScore = 10; // สต็อกหมดหรือติดลบ
    } else if (gapRatio >= 0.5) {
      safetyGapScore = 6 + (gapRatio - 0.5) * 8;
    } else if (gapRatio >= 0) {
      safetyGapScore = 2 + (gapRatio * 8);
    } else {
      // สต็อกมากกว่า Safety Stock
      safetyGapScore = Math.max(1, 2 + gapRatio * 2);
    }
  }

  // 5. คำนวณ Trend Score (15%)
  // แนวโน้มเพิ่มขึ้น = คะแนนสูง, ลดลง = คะแนนต่ำ
  let trendScore = 5; // คงที่ = 5
  if (avgDailyShip > 0) {
    const trendPercent = (trendSlope / avgDailyShip) * 100;
    if (trendPercent >= 10) {
      trendScore = 10; // เพิ่มขึ้นมาก
    } else if (trendPercent >= 5) {
      trendScore = 8;
    } else if (trendPercent >= 2) {
      trendScore = 6;
    } else if (trendPercent <= -10) {
      trendScore = 1; // ลดลงมาก
    } else if (trendPercent <= -5) {
      trendScore = 2;
    } else if (trendPercent <= -2) {
      trendScore = 4;
    }
  }

  // 6. คำนวณคะแนนรวม (Weighted Average)
  const finalScore =
    (stockoutScore * 0.40) +
    (urgentScore * 0.25) +
    (safetyGapScore * 0.20) +
    (trendScore * 0.15);

  // ปัดเศษเป็นทศนิยม 1 ตำแหน่ง
  const roundedScore = Math.round(finalScore * 10) / 10;

  return {
    score: Math.min(10, Math.max(1, roundedScore)),
    daysUntilStockout,
    components: {
      stockoutScore: Math.round(stockoutScore * 10) / 10,
      urgentScore: Math.round(urgentScore * 10) / 10,
      safetyGapScore: Math.round(safetyGapScore * 10) / 10,
      trendScore: Math.round(trendScore * 10) / 10
    }
  };
}

/**
 * คำนวณ Safety Stock แบบ Dynamic โดยใช้สูตรทางสถิติ
 * สูตร: Safety Stock = Z × σ_d × √L
 * 
 * โดยที่:
 * - Z = Z-score สำหรับ Service Level (95% = 1.65, 99% = 2.33)
 * - σ_d = Standard Deviation ของ demand รายวัน
 * - L = Lead Time (วัน) - สมมติ 7 วันสำหรับการผลิต
 * 
 * เพิ่มเติม: ใช้ MAD (Mean Absolute Deviation) เป็น robust estimator
 * σ ≈ 1.4826 × MAD (สำหรับ normal distribution)
 */
function calculateDynamicSafetyStock(
  dailyShips: number[],
  leadTimeDays: number = 7,
  serviceLevel: number = 0.95
): { safetyStock: number; stdDev: number } {
  if (dailyShips.length < 7) {
    // ข้อมูลไม่เพียงพอ ใช้ค่า default
    return { safetyStock: 0, stdDev: 0 };
  }

  // คำนวณค่าเฉลี่ย
  const mean = dailyShips.reduce((a, b) => a + b, 0) / dailyShips.length;

  if (mean === 0) {
    return { safetyStock: 0, stdDev: 0 };
  }

  // คำนวณ MAD (Mean Absolute Deviation) - robust กว่า standard deviation
  const mad = dailyShips.reduce((sum, val) => sum + Math.abs(val - mean), 0) / dailyShips.length;

  // แปลง MAD เป็น Standard Deviation (สำหรับ normal distribution)
  // σ ≈ 1.4826 × MAD
  const stdDev = 1.4826 * mad;

  // หรือใช้ Standard Deviation แบบปกติ
  const variance = dailyShips.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyShips.length;
  const classicStdDev = Math.sqrt(variance);

  // ใช้ค่าที่มากกว่าระหว่าง MAD-based และ classic (conservative approach)
  const finalStdDev = Math.max(stdDev, classicStdDev);

  // Z-score ตาม Service Level
  // 90% = 1.28, 95% = 1.65, 97.5% = 1.96, 99% = 2.33
  let zScore: number;
  if (serviceLevel >= 0.99) {
    zScore = 2.33;
  } else if (serviceLevel >= 0.975) {
    zScore = 1.96;
  } else if (serviceLevel >= 0.95) {
    zScore = 1.65;
  } else {
    zScore = 1.28;
  }

  // Safety Stock = Z × σ_d × √L
  const safetyStock = Math.ceil(zScore * finalStdDev * Math.sqrt(leadTimeDays));

  return {
    safetyStock,
    stdDev: Math.round(finalStdDev * 100) / 100
  };
}

/**
 * คำนวณจำนวนแนะนำผลิตแบบครอบคลุม (Advanced Production Recommendation)
 * 
 * สูตร: แนะนำผลิต = Target Stock - Current Stock + Trend Adjustment + Buffer
 * 
 * โดยที่:
 * - Target Stock = (Forecast Demand × Planning Horizon) + Safety Stock
 * - Forecast Demand = EWMA + Trend Projection
 * - Trend Adjustment = Sen's Slope × Planning Days (ถ้าแนวโน้มเพิ่มขึ้น)
 * - Buffer = 0.2% ของ Target Stock (กันพลาดจากความไม่แน่นอน)
 * 
 * เพิ่มเติม:
 * - ใช้ Upper Prediction Interval สำหรับ conservative estimate
 * - คำนึงถึง Lead Time ในการผลิต
 */
interface ProductionRecommendation {
  suggestedQty: number;
  targetStock: number;
  forecastDemand: number;
  trendAdjustment: number;
  bufferQty: number;
  safetyStockUsed: number;
}

function calculateAdvancedProductionRecommendation(
  currentStock: number,
  avgDailyShip: number,
  safetyStock: number,
  demandStdDev: number,
  trendSlope: number,
  trendSignificance: number,
  planningHorizonDays: number = 30,
  leadTimeDays: number = 7,
  bufferPercent: number = 0.002  // 0.2%
): ProductionRecommendation {

  // 1. คำนวณ Forecast Demand พื้นฐาน
  // ใช้ EWMA เป็นฐาน
  let forecastDemand = avgDailyShip * planningHorizonDays;

  // 2. Trend Adjustment
  // ถ้าแนวโน้มเพิ่มขึ้นอย่างมีนัยสำคัญ (p < 0.05) ให้เพิ่ม demand projection
  let trendAdjustment = 0;
  if (trendSignificance < 0.05 && trendSlope > 0) {
    // คำนวณการเพิ่มขึ้นของ demand ตลอด planning horizon
    // Trend Adjustment = slope × (n × (n+1) / 2) สำหรับ cumulative effect
    // หรือใช้แบบง่าย: slope × planningDays × (planningDays / 2)
    trendAdjustment = trendSlope * planningHorizonDays * (planningHorizonDays / 2);
    forecastDemand += trendAdjustment;
  }

  // 3. Upper Prediction Interval
  // เพิ่ม uncertainty buffer โดยใช้ standard deviation
  // Upper bound = Forecast + Z × σ × √n
  // ใช้ Z = 1.28 (90% confidence) สำหรับ conservative estimate
  const predictionUncertainty = 1.28 * demandStdDev * Math.sqrt(planningHorizonDays);
  forecastDemand += predictionUncertainty;

  // 4. คำนวณ Target Stock
  // Target = Forecast Demand + Safety Stock + Lead Time Buffer
  const leadTimeBuffer = avgDailyShip * leadTimeDays;
  const targetStock = forecastDemand + safetyStock + leadTimeBuffer;

  // 5. Buffer 0.2% กันพลาด
  const bufferQty = Math.ceil(targetStock * bufferPercent);

  // 6. คำนวณจำนวนแนะนำผลิต
  const suggestedQty = Math.max(0, Math.ceil(targetStock + bufferQty - currentStock));

  return {
    suggestedQty,
    targetStock: Math.round(targetStock),
    forecastDemand: Math.round(forecastDemand),
    trendAdjustment: Math.round(trendAdjustment),
    bufferQty,
    safetyStockUsed: safetyStock
  };
}

/**
 * ดึงข้อมูล Forecast สำหรับ SKU สินค้าสำเร็จรูปทั้งหมด
 */
export async function getForecastData(filters: ForecastFilters = {}): Promise<ForecastResult> {
  const supabase = await createClient();
  const { search, priority, subCategory, page = 1, pageSize = 100 } = filters;

  // 1. ดึง SKU ทั้งหมดที่เป็นสินค้าสำเร็จรูป (category = 'สินค้าสำเร็จรูป')
  let skuQuery = supabase
    .from('master_sku')
    .select('sku_id, sku_name, category, sub_category, brand, qty_per_pack, safety_stock, reorder_point')
    .eq('category', 'สินค้าสำเร็จรูป')
    .eq('status', 'active');

  if (search) {
    skuQuery = skuQuery.or(`sku_id.ilike.%${search}%,sku_name.ilike.%${search}%`);
  }

  if (subCategory && subCategory !== 'all') {
    // กรองตาม sub_category หรือ product_type
    if (subCategory === 'แมว') {
      skuQuery = skuQuery.or('sub_category.eq.อาหารแมว,product_type.eq.อาหารแมว');
    } else if (subCategory === 'สุนัข') {
      skuQuery = skuQuery.or('sub_category.eq.อาหารสุนัข,product_type.eq.อาหารสุนัข');
    }
  }

  const { data: skus, error: skuError } = await skuQuery.order('sku_name');

  if (skuError) {
    console.error('Error fetching SKUs:', skuError);
    throw new Error('Failed to fetch SKU data');
  }

  if (!skus || skus.length === 0) {
    return {
      data: [],
      totalCount: 0,
      summary: {
        totalSKUs: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        avgDaysOfSupply: 0
      }
    };
  }

  const skuIds = skus.map(s => s.sku_id);

  // 2. ดึงยอดสต็อกรวมจากคลังหลัก (ไม่รวม Preparation Areas)
  // ใช้ Chunking เพื่อหลีกเลี่ยง Limit Rows (Supabase/PostgREST default limit)
  const { data: prepAreas } = await supabase
    .from('preparation_area')
    .select('area_code')
    .eq('status', 'active');
  
  const excludeLocations = [
    'Delivery-In-Progress',
    'ADJ-LOSS',
    'Dispatch',
    'Expired',
    'Return',
    'Receiving',
    'Repair',
    ...(prepAreas?.map(p => p.area_code) || [])
  ];

  const chunkSize = 20; // แบ่งทีละ 20 SKUs
  const balancePromises = [];

  for (let i = 0; i < skuIds.length; i += chunkSize) {
    const chunkSkus = skuIds.slice(i, i + chunkSize);
    let query = supabase
      .from('wms_inventory_balances')
      .select('sku_id, total_piece_qty, reserved_piece_qty, location_id, pallet_id')
      .in('sku_id', chunkSkus);
    
    // Exclude locations
    excludeLocations.forEach(loc => {
      query = query.neq('location_id', loc);
    });
    
    balancePromises.push(query.limit(100000));
  }

  const balanceResults = await Promise.all(balancePromises);

  // รวมผลลัพธ์จากทุก Chunk
  const balances: any[] = [];
  balanceResults.forEach(res => {
    if (res.data) balances.push(...res.data);
    if (res.error) console.error('Error fetching balance chunk:', res.error);
  });

  // รวมยอดสต็อกตาม SKU (แยก total และ available)
  // นับเฉพาะ pallet_id ที่ไม่ซ้ำกัน เพราะพาเลทเดียวกันอาจถูกแยกไปหลายโลเคชั่น
  const stockBySkuId: Record<string, { total: number; available: number; pallets: Set<string> }> = {};
  
  // นับสต็อกจากคลังหลัก (ไม่รวม prep areas)
  (balances || []).forEach(b => {
    const totalQty = Number(b.total_piece_qty || 0);
    const reservedQty = Number(b.reserved_piece_qty || 0);
    const availableQty = totalQty - reservedQty;
    const palletId = b.pallet_id || `no_pallet_${b.location_id}_${b.sku_id}`;

    if (!stockBySkuId[b.sku_id]) {
      stockBySkuId[b.sku_id] = { total: 0, available: 0, pallets: new Set() };
    }
    
    // นับเฉพาะครั้งแรกที่เจอ pallet_id นี้
    if (!stockBySkuId[b.sku_id].pallets.has(palletId)) {
      stockBySkuId[b.sku_id].pallets.add(palletId);
      stockBySkuId[b.sku_id].total += totalQty;
      stockBySkuId[b.sku_id].available += availableQty;
    }
  });

  // 3. ดึงข้อมูลการจ่ายสินค้า (ship) ย้อนหลัง 90 วัน
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // ใช้ Chunking สำหรับ Ledger เพราะข้อมูลเยอะมาก
  const ledgerChunkSize = 10; // แบ่งทีละ 10 SKUs
  const ledgerPromises = [];

  for (let i = 0; i < skuIds.length; i += ledgerChunkSize) {
    const chunkSkus = skuIds.slice(i, i + ledgerChunkSize);
    ledgerPromises.push(
      supabase
        .from('wms_inventory_ledger')
        .select('sku_id, piece_qty, movement_at')
        .in('sku_id', chunkSkus)
        .eq('transaction_type', 'ship')
        .eq('direction', 'out')
        .gte('movement_at', ninetyDaysAgo.toISOString())
        .order('movement_at', { ascending: true })
        .limit(50000)
    );
  }

  const ledgerResults = await Promise.all(ledgerPromises);
  const shipments: any[] = [];
  ledgerResults.forEach(res => {
    if (res.data) shipments.push(...res.data);
    if (res.error) console.error('Error fetching ledger chunk:', res.error);
  });

  // จัดกลุ่มข้อมูลการจ่ายตาม SKU และวัน
  const shipDataBySkuId: Record<string, { dailyShips: number[], lastShipDate: string | null, totalDays: number }> = {};

  skuIds.forEach(skuId => {
    shipDataBySkuId[skuId] = { dailyShips: [], lastShipDate: null, totalDays: 0 };
  });

  // จัดกลุ่มตามวัน
  const shipBySkuAndDate: Record<string, Record<string, number>> = {};
  (shipments || []).forEach(s => {
    const date = new Date(s.movement_at).toISOString().split('T')[0];
    if (!shipBySkuAndDate[s.sku_id]) {
      shipBySkuAndDate[s.sku_id] = {};
    }
    shipBySkuAndDate[s.sku_id][date] = (shipBySkuAndDate[s.sku_id][date] || 0) + Number(s.piece_qty || 0);
  });

  // สร้าง array ของยอดจ่ายรายวัน (รวมวันที่ไม่มีการจ่าย = 0)
  const shipToday = new Date();
  skuIds.forEach(skuId => {
    const skuShips = shipBySkuAndDate[skuId] || {};
    const dates = Object.keys(skuShips).sort();

    if (dates.length > 0) {
      shipDataBySkuId[skuId].lastShipDate = dates[dates.length - 1];

      // สร้าง array รายวันตั้งแต่วันแรกที่มีการจ่ายจนถึงวันนี้
      const firstDate = new Date(dates[0]);
      const dailyShips: number[] = [];

      for (let d = new Date(firstDate); d <= shipToday; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dailyShips.push(skuShips[dateStr] || 0);
      }

      shipDataBySkuId[skuId].dailyShips = dailyShips;
      shipDataBySkuId[skuId].totalDays = dailyShips.length;
    }
  });

  // 4. ดึงยอดรอส่งจาก Pending Orders (สถานะที่ยังไม่ loaded) พร้อม delivery_date
  // สถานะที่ถือว่ายังไม่ส่ง: draft, confirmed, in_picking, picked
  const pendingStatuses = ['draft', 'confirmed', 'in_picking', 'picked'];

  const { data: pendingOrderItems, error: pendingError } = await supabase
    .from('wms_order_items')
    .select(`
      sku_id,
      order_qty,
      picked_qty,
      wms_orders!inner (
        status,
        delivery_date
      )
    `)
    .in('sku_id', skuIds)
    .in('wms_orders.status', pendingStatuses);

  if (pendingError) {
    console.error('Error fetching pending orders:', pendingError);
  }

  // รวมยอดรอส่งตาม SKU และแยกยอดเร่งด่วน (ต้องส่งใน 3 วัน)
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  const threeDaysLater = new Date(currentDate);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const pendingQtyBySkuId: Record<string, number> = {};
  const urgentQtyBySkuId: Record<string, number> = {};
  const pendingByDeliveryDate: Record<string, { date: string; qty: number }[]> = {};

  (pendingOrderItems || []).forEach((item: any) => {
    const qty = Number(item.order_qty || 0);
    const deliveryDate = item.wms_orders?.delivery_date;

    // รวมยอดรอส่งทั้งหมด
    pendingQtyBySkuId[item.sku_id] = (pendingQtyBySkuId[item.sku_id] || 0) + qty;

    // เก็บข้อมูลตาม delivery_date สำหรับคำนวณ stockout
    if (!pendingByDeliveryDate[item.sku_id]) {
      pendingByDeliveryDate[item.sku_id] = [];
    }
    pendingByDeliveryDate[item.sku_id].push({
      date: deliveryDate || '9999-12-31',
      qty
    });

    // นับยอดเร่งด่วน (ต้องส่งใน 3 วัน)
    if (deliveryDate) {
      const deliveryDateObj = new Date(deliveryDate);
      if (deliveryDateObj <= threeDaysLater) {
        urgentQtyBySkuId[item.sku_id] = (urgentQtyBySkuId[item.sku_id] || 0) + qty;
      }
    }
  });

  // 5. คำนวณ Forecast สำหรับแต่ละ SKU
  const forecastData: ForecastSKU[] = skus.map(sku => {
    const stockData = stockBySkuId[sku.sku_id] || { total: 0, available: 0 };
    const totalStock = stockData.total;
    const availableStockFromBalance = stockData.available;
    const pendingOrderQty = pendingQtyBySkuId[sku.sku_id] || 0;
    const shipData = shipDataBySkuId[sku.sku_id];
    const dailyShips = shipData.dailyShips;

    // คำนวณค่าเฉลี่ยการจ่ายต่อวันโดยใช้ EWMA
    const avgDailyShip = calculateWeightedMovingAverage(dailyShips);

    // คำนวณ Safety Stock แบบ Dynamic (Lead Time = 7 วัน, Service Level = 95%)
    const { safetyStock: calculatedSafetyStock, stdDev: demandStdDev } = calculateDynamicSafetyStock(dailyShips, 7, 0.95);

    // ใช้ค่า Safety Stock ที่คำนวณได้ หรือค่าจาก master ถ้าไม่มีข้อมูลเพียงพอ
    const effectiveSafetyStock = calculatedSafetyStock > 0 ? calculatedSafetyStock : (sku.safety_stock || 0);

    // คำนวณ Days of Supply (จากสต็อกที่พร้อมใช้งาน - หลังหักยอดจอง)
    let daysOfSupply = 0;
    if (avgDailyShip > 0) {
      daysOfSupply = Math.round(availableStockFromBalance / avgDailyShip);
    } else if (availableStockFromBalance > 0) {
      daysOfSupply = 999; // มีสต็อกแต่ไม่มีการจ่าย
    }

    // คำนวณ Adjusted Days of Supply (หลังหักยอดรอส่งเพิ่มเติม)
    const availableStock = Math.max(0, availableStockFromBalance - pendingOrderQty);
    let adjustedDaysOfSupply = 0;
    if (avgDailyShip > 0) {
      adjustedDaysOfSupply = Math.round(availableStock / avgDailyShip);
    } else if (availableStock > 0) {
      adjustedDaysOfSupply = 999;
    }

    // วิเคราะห์แนวโน้ม (ใช้ Mann-Kendall Test + Sen's Slope)
    const trendAnalysis = analyzeTrendAdvanced(dailyShips);

    // คำนวณความเชื่อมั่น
    const confidenceLevel = calculateConfidence(dailyShips, shipData.totalDays);

    // กำหนดระดับความสำคัญ (ใช้ adjusted days of supply และ calculated safety stock)
    const priorityLevel = determinePriority(adjustedDaysOfSupply, effectiveSafetyStock, availableStock);

    // คำนวณคะแนนความสำคัญ (Priority Score 1-10)
    const urgentOrderQty = urgentQtyBySkuId[sku.sku_id] || 0;
    const skuPendingByDate = pendingByDeliveryDate[sku.sku_id] || [];
    const priorityScoreResult = calculatePriorityScore(
      availableStock,
      avgDailyShip,
      pendingOrderQty,
      urgentOrderQty,
      effectiveSafetyStock,
      trendAnalysis.slope,
      skuPendingByDate
    );

    // คำนวณจำนวนที่แนะนำให้ผลิต (ใช้วิธีขั้นสูง) - ใช้ available stock แทน total stock
    const productionRec = calculateAdvancedProductionRecommendation(
      availableStock,  // ใช้สต็อกหลังหักยอดรอส่ง
      avgDailyShip,
      effectiveSafetyStock,
      demandStdDev,
      trendAnalysis.slope,
      trendAnalysis.significance,
      30,  // Planning Horizon = 30 วัน
      7,   // Lead Time = 7 วัน
      0.002 // Buffer = 0.2%
    );

    return {
      sku_id: sku.sku_id,
      sku_name: sku.sku_name,
      category: sku.category || '',
      sub_category: sku.sub_category || '',
      brand: sku.brand || '',
      qty_per_pack: sku.qty_per_pack || 1,
      safety_stock: sku.safety_stock || 0,
      calculated_safety_stock: calculatedSafetyStock,
      demand_std_dev: demandStdDev,
      reorder_point: sku.reorder_point || 0,
      total_stock: totalStock,  // แสดงสต็อกทั้งหมด (รวมยอดจอง) ตามที่ user ต้องการ
      avg_daily_ship: Math.round(avgDailyShip * 100) / 100,
      days_of_supply: daysOfSupply,
      pending_order_qty: pendingOrderQty,
      adjusted_days_of_supply: adjustedDaysOfSupply,
      ship_trend: trendAnalysis.trend,
      trend_slope: trendAnalysis.slope,
      trend_significance: trendAnalysis.significance,
      confidence_level: confidenceLevel,
      last_ship_date: shipData.lastShipDate,
      ship_data_days: shipData.totalDays,
      suggested_production: productionRec.suggestedQty,
      priority: priorityLevel,
      priority_score: priorityScoreResult.score,
      urgent_order_qty: urgentOrderQty,
      days_until_stockout: priorityScoreResult.daysUntilStockout
    };
  });

  // 5. กรองตาม priority ถ้ามี
  let filteredData = forecastData;
  if (priority && priority !== 'all') {
    filteredData = forecastData.filter(d => d.priority === priority);
  }

  // 6. เรียงลำดับตามสต็อกปัจจุบัน (มากไปน้อย)
  filteredData.sort((a, b) => b.total_stock - a.total_stock);

  // 7. Pagination
  const totalCount = filteredData.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  // 8. สรุปข้อมูล
  const summary = {
    totalSKUs: forecastData.length,
    criticalCount: forecastData.filter(d => d.priority === 'critical').length,
    highCount: forecastData.filter(d => d.priority === 'high').length,
    mediumCount: forecastData.filter(d => d.priority === 'medium').length,
    lowCount: forecastData.filter(d => d.priority === 'low').length,
    avgDaysOfSupply: forecastData.length > 0
      ? Math.round(forecastData.reduce((sum, d) => sum + Math.min(d.days_of_supply, 365), 0) / forecastData.length)
      : 0
  };

  return {
    data: paginatedData,
    totalCount,
    summary
  };
}
