/**
 * AI Reasoning Engine
 * Provides operational analysis WITHOUT hallucination
 * 
 * RULES:
 * 1. All reasoning MUST be based on actual data
 * 2. Clear separation: FACT vs ANALYSIS
 * 3. Never invent causes - only suggest possibilities based on data patterns
 * 4. Always cite data points explicitly
 */

// ============================================
// Types
// ============================================

export interface ReasoningContext {
  stockData?: any;
  orderData?: any;
  kpiData?: any;
  movementData?: any;
  locationData?: any;
}

export interface ReasoningResult {
  facts: string[];           // ข้อเท็จจริงจากข้อมูล
  analysis: string[];        // การวิเคราะห์ (ระบุชัดว่าเป็นการวิเคราะห์)
  suggestions: string[];     // ข้อเสนอแนะ (ถ้ามี)
  warnings: string[];        // คำเตือน (ถ้ามี)
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;        // จำนวน data points ที่ใช้
}

export interface AnalysisOutput {
  summary: string;
  reasoning: ReasoningResult;
  formatted: string;
}

// ============================================
// Thresholds & Constants
// ============================================

const THRESHOLDS = {
  // Stock thresholds
  LOW_STOCK_DAYS: 7,           // Days of supply ต่ำกว่านี้ถือว่าวิกฤต
  CRITICAL_STOCK_DAYS: 3,      // Days of supply ต่ำกว่านี้ถือว่าวิกฤตมาก
  HIGH_RESERVATION_PERCENT: 70, // สำรองเกินนี้ถือว่าสูง
  
  // Order thresholds
  DELAYED_DAYS: 2,             // ล่าช้าเกินนี้ถือว่ามีปัญหา
  LOW_PICK_PROGRESS: 50,       // ความคืบหน้าต่ำกว่านี้ถือว่าช้า
  
  // KPI thresholds
  LOW_COMPLETION_RATE: 80,     // อัตราสำเร็จต่ำกว่านี้ถือว่าต่ำ
  HIGH_UTILIZATION: 90,        // การใช้พื้นที่เกินนี้ถือว่าสูง
  LOW_UTILIZATION: 30,         // การใช้พื้นที่ต่ำกว่านี้ถือว่าต่ำ
  
  // Movement thresholds
  HIGH_OUTBOUND_RATIO: 1.5,    // จ่ายออก/รับเข้า เกินนี้ถือว่าสูง
};

// ============================================
// Stock Reasoning
// ============================================

export function analyzeStockLevel(stockData: any): AnalysisOutput {
  const result: ReasoningResult = {
    facts: [],
    analysis: [],
    suggestions: [],
    warnings: [],
    confidence: 'low',
    dataPoints: 0,
  };

  if (!stockData?.success || !stockData?.data || !stockData?.summary) {
    return {
      summary: 'ไม่สามารถวิเคราะห์ได้เนื่องจากข้อมูลไม่เพียงพอ',
      reasoning: result,
      formatted: formatReasoningOutput(result, 'stock'),
    };
  }

  const { data, summary } = stockData;
  result.dataPoints = data.length;

  // === FACTS (ข้อเท็จจริง) ===
  result.facts.push(`สต็อกทั้งหมด: ${summary.total_piece_qty.toLocaleString()} ชิ้น`);
  result.facts.push(`สำรองแล้ว: ${summary.total_reserved_qty.toLocaleString()} ชิ้น`);
  result.facts.push(`พร้อมใช้งาน: ${summary.total_available_qty.toLocaleString()} ชิ้น`);
  result.facts.push(`จำนวน SKU: ${summary.unique_skus} รายการ`);
  result.facts.push(`จำนวนโลเคชั่น: ${summary.unique_locations} ตำแหน่ง`);

  // Calculate reservation percentage
  const reservationPercent = summary.total_piece_qty > 0
    ? Math.round((summary.total_reserved_qty / summary.total_piece_qty) * 100)
    : 0;
  result.facts.push(`อัตราการสำรอง: ${reservationPercent}%`);

  // Check for expired items
  const expiredItems = data.filter((item: any) => item.is_expired);
  if (expiredItems.length > 0) {
    const expiredQty = expiredItems.reduce((sum: number, item: any) => sum + item.total_piece_qty, 0);
    result.facts.push(`สินค้าหมดอายุ: ${expiredItems.length} รายการ (${expiredQty.toLocaleString()} ชิ้น)`);
  }

  // === ANALYSIS (การวิเคราะห์) ===
  
  // High reservation analysis
  if (reservationPercent >= THRESHOLDS.HIGH_RESERVATION_PERCENT) {
    result.analysis.push(
      `[วิเคราะห์] อัตราการสำรองสูง (${reservationPercent}%) ` +
      `อาจเกิดจาก: ออเดอร์รอจัดจำนวนมาก หรือ สต็อกพร้อมใช้งานน้อย`
    );
    result.warnings.push(`⚠️ สต็อกพร้อมใช้งานเหลือน้อย (${summary.total_available_qty.toLocaleString()} ชิ้น)`);
  }

  // Low stock analysis
  if (summary.total_available_qty < summary.total_reserved_qty) {
    result.analysis.push(
      `[วิเคราะห์] สต็อกพร้อมใช้งานน้อยกว่าที่สำรอง ` +
      `อาจส่งผลให้ไม่สามารถจัดสินค้าได้ครบตามออเดอร์`
    );
    result.warnings.push(`🚨 สต็อกพร้อมใช้งานไม่เพียงพอต่อการสำรอง`);
  }

  // Expired items analysis
  if (expiredItems.length > 0) {
    result.analysis.push(
      `[วิเคราะห์] พบสินค้าหมดอายุ ${expiredItems.length} รายการ ` +
      `ควรดำเนินการปรับสต็อกหรือทำลาย`
    );
    result.warnings.push(`❌ มีสินค้าหมดอายุในคลัง`);
  }

  // === SUGGESTIONS (ข้อเสนอแนะ) ===
  if (reservationPercent >= THRESHOLDS.HIGH_RESERVATION_PERCENT) {
    result.suggestions.push(`ตรวจสอบออเดอร์ที่รอจัดและเร่งดำเนินการ`);
    result.suggestions.push(`พิจารณาสั่งซื้อสินค้าเพิ่มเติม`);
  }

  if (expiredItems.length > 0) {
    result.suggestions.push(`ดำเนินการปรับสต็อกสินค้าหมดอายุ`);
  }

  // Set confidence
  result.confidence = result.dataPoints >= 10 ? 'high' : result.dataPoints >= 5 ? 'medium' : 'low';

  return {
    summary: generateStockSummary(summary, reservationPercent, expiredItems.length),
    reasoning: result,
    formatted: formatReasoningOutput(result, 'stock'),
  };
}

function generateStockSummary(summary: any, reservationPercent: number, expiredCount: number): string {
  let status = '✅ ปกติ';
  
  if (reservationPercent >= THRESHOLDS.HIGH_RESERVATION_PERCENT) {
    status = '⚠️ สำรองสูง';
  }
  if (summary.total_available_qty < summary.total_reserved_qty) {
    status = '🚨 วิกฤต';
  }
  if (expiredCount > 0) {
    status = '❌ มีสินค้าหมดอายุ';
  }

  return `สถานะสต็อก: ${status} | พร้อมใช้: ${summary.total_available_qty.toLocaleString()} ชิ้น | สำรอง: ${reservationPercent}%`;
}

// ============================================
// Order Reasoning
// ============================================

export function analyzeOrderStatus(orderData: any): AnalysisOutput {
  const result: ReasoningResult = {
    facts: [],
    analysis: [],
    suggestions: [],
    warnings: [],
    confidence: 'low',
    dataPoints: 0,
  };

  if (!orderData?.success || !orderData?.data || !orderData?.summary) {
    return {
      summary: 'ไม่สามารถวิเคราะห์ได้เนื่องจากข้อมูลไม่เพียงพอ',
      reasoning: result,
      formatted: formatReasoningOutput(result, 'order'),
    };
  }

  const { data, summary } = orderData;
  result.dataPoints = data.length;

  // === FACTS ===
  result.facts.push(`จำนวนออเดอร์: ${summary.total_orders} รายการ`);
  result.facts.push(`จำนวนสินค้ารวม: ${(summary.total_qty || 0).toLocaleString()} ชิ้น`);
  result.facts.push(`จำนวนรายการรวม: ${(summary.total_items || 0).toLocaleString()} รายการ`);

  // Status breakdown
  if (summary.by_status) {
    Object.entries(summary.by_status).forEach(([status, count]) => {
      const statusThai: Record<string, string> = {
        draft: 'ร่าง',
        confirmed: 'ยืนยันแล้ว',
        in_picking: 'กำลังจัด',
        picked: 'จัดเสร็จ',
        loaded: 'โหลดแล้ว',
        in_transit: 'กำลังส่ง',
        delivered: 'ส่งแล้ว',
      };
      result.facts.push(`${statusThai[status] || status}: ${count} รายการ`);
    });
  }

  // === ANALYSIS ===

  // Delayed orders analysis
  const today = new Date();
  const delayedOrders = data.filter((o: any) => {
    if (!o.delivery_date || o.status === 'delivered') return false;
    const deliveryDate = new Date(o.delivery_date);
    const daysDiff = Math.floor(
      (today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysDiff > THRESHOLDS.DELAYED_DAYS;
  });

  if (delayedOrders.length > 0) {
    result.analysis.push(
      `[วิเคราะห์] พบ ${delayedOrders.length} ออเดอร์ที่เลยกำหนดส่งมากกว่า ${THRESHOLDS.DELAYED_DAYS} วัน ` +
        `ควรตรวจสอบสาเหตุและเร่งดำเนินการ`
    );
    result.warnings.push(`🚨 มีออเดอร์ล่าช้า ${delayedOrders.length} รายการ`);
  }

  // Pending orders analysis
  const pendingCount =
    (summary.by_status?.['draft'] || 0) +
    (summary.by_status?.['confirmed'] || 0);
  if (pendingCount > 10) {
    result.analysis.push(
      `[วิเคราะห์] มีออเดอร์รอดำเนินการ ${pendingCount} รายการ ` +
        `อาจส่งผลให้เกิดความล่าช้าสะสม`
    );
  }

  // === SUGGESTIONS ===
  if (delayedOrders.length > 0) {
    result.suggestions.push(`ติดต่อลูกค้าแจ้งสถานะออเดอร์ที่ล่าช้า`);
    result.suggestions.push(`เร่งดำเนินการจัดสินค้าออเดอร์ที่ล่าช้า`);
  }

  result.confidence =
    result.dataPoints >= 10 ? 'high' : result.dataPoints >= 5 ? 'medium' : 'low';

  return {
    summary: generateOrderSummary(summary, delayedOrders.length),
    reasoning: result,
    formatted: formatReasoningOutput(result, 'order'),
  };
}

function generateOrderSummary(summary: any, delayedCount: number): string {
  let status = '✅ ปกติ';

  if (delayedCount > 0) {
    status = '🚨 มีออเดอร์ล่าช้า';
  }

  return `สถานะออเดอร์: ${status} | รวม: ${summary.total_orders} รายการ | สินค้า: ${(summary.total_qty || 0).toLocaleString()} ชิ้น`;
}

// ============================================
// KPI Reasoning
// ============================================

export function analyzeKPI(kpiData: any): AnalysisOutput {
  const result: ReasoningResult = {
    facts: [],
    analysis: [],
    suggestions: [],
    warnings: [],
    confidence: 'low',
    dataPoints: 0,
  };

  if (!kpiData?.success || !kpiData?.data) {
    return {
      summary: 'ไม่สามารถวิเคราะห์ได้เนื่องจากข้อมูลไม่เพียงพอ',
      reasoning: result,
      formatted: formatReasoningOutput(result, 'kpi'),
    };
  }

  const { data } = kpiData;
  result.dataPoints = 4; // 4 KPI categories

  // === FACTS ===
  result.facts.push(`ช่วงเวลา: ${data.period.date_from} ถึง ${data.period.date_to} (${data.period.days_in_period} วัน)`);
  result.facts.push(`รับสินค้า: ${data.throughput.total_received_qty.toLocaleString()} ชิ้น`);
  result.facts.push(`จ่ายสินค้า: ${data.throughput.total_shipped_qty.toLocaleString()} ชิ้น`);
  result.facts.push(`อัตราสำเร็จ: ${data.efficiency.completion_rate_percent}%`);
  result.facts.push(`การใช้พื้นที่: ${data.utilization.capacity_utilization_percent}%`);

  // === ANALYSIS ===

  // Throughput analysis
  const netFlow = data.throughput.total_received_qty - data.throughput.total_shipped_qty;
  if (netFlow < 0) {
    result.analysis.push(
      `[วิเคราะห์] จ่ายออกมากกว่ารับเข้า ${Math.abs(netFlow).toLocaleString()} ชิ้น ` +
      `สต็อกกำลังลดลง ควรวางแผนการสั่งซื้อ`
    );
  } else if (netFlow > data.throughput.total_shipped_qty * 0.5) {
    result.analysis.push(
      `[วิเคราะห์] รับเข้ามากกว่าจ่ายออกอย่างมีนัยสำคัญ ` +
      `สต็อกกำลังสะสม ควรตรวจสอบการขายและการจัดส่ง`
    );
  }

  // Efficiency analysis
  if (data.efficiency.completion_rate_percent < THRESHOLDS.LOW_COMPLETION_RATE) {
    result.analysis.push(
      `[วิเคราะห์] อัตราสำเร็จต่ำกว่าเป้า (${data.efficiency.completion_rate_percent}% < ${THRESHOLDS.LOW_COMPLETION_RATE}%) ` +
      `สาเหตุที่เป็นไปได้: สต็อกไม่เพียงพอ, กำลังคนไม่เพียงพอ, หรือปัญหาในกระบวนการ`
    );
    result.warnings.push(`⚠️ อัตราสำเร็จต่ำกว่าเป้า`);
  }

  // Utilization analysis
  if (data.utilization.capacity_utilization_percent > THRESHOLDS.HIGH_UTILIZATION) {
    result.analysis.push(
      `[วิเคราะห์] การใช้พื้นที่สูง (${data.utilization.capacity_utilization_percent}%) ` +
      `อาจส่งผลต่อประสิทธิภาพการจัดเก็บและการหยิบสินค้า`
    );
    result.warnings.push(`⚠️ พื้นที่จัดเก็บใกล้เต็ม`);
  } else if (data.utilization.capacity_utilization_percent < THRESHOLDS.LOW_UTILIZATION) {
    result.analysis.push(
      `[วิเคราะห์] การใช้พื้นที่ต่ำ (${data.utilization.capacity_utilization_percent}%) ` +
      `อาจมีโอกาสในการเพิ่มประสิทธิภาพการใช้พื้นที่`
    );
  }

  // Inventory warnings
  if (data.inventory.expiring_soon_qty > 0) {
    result.analysis.push(
      `[วิเคราะห์] มีสินค้าใกล้หมดอายุ ${data.inventory.expiring_soon_qty.toLocaleString()} ชิ้น ` +
      `ควรเร่งจำหน่ายหรือวางแผนการจัดการ`
    );
    result.warnings.push(`⚠️ มีสินค้าใกล้หมดอายุ`);
  }

  if (data.inventory.expired_qty > 0) {
    result.warnings.push(`❌ มีสินค้าหมดอายุ ${data.inventory.expired_qty.toLocaleString()} ชิ้น`);
  }

  // === SUGGESTIONS ===
  if (netFlow < 0) {
    result.suggestions.push(`วางแผนการสั่งซื้อสินค้าเพิ่มเติม`);
  }

  if (data.efficiency.completion_rate_percent < THRESHOLDS.LOW_COMPLETION_RATE) {
    result.suggestions.push(`วิเคราะห์สาเหตุที่ทำให้อัตราสำเร็จต่ำ`);
    result.suggestions.push(`ตรวจสอบกระบวนการทำงานและปรับปรุง`);
  }

  if (data.utilization.capacity_utilization_percent > THRESHOLDS.HIGH_UTILIZATION) {
    result.suggestions.push(`พิจารณาขยายพื้นที่จัดเก็บหรือปรับปรุงการจัดวาง`);
  }

  result.confidence = 'high'; // KPI data is usually reliable

  return {
    summary: generateKPISummary(data),
    reasoning: result,
    formatted: formatReasoningOutput(result, 'kpi'),
  };
}

function generateKPISummary(data: any): string {
  let status = '✅ ปกติ';
  
  if (data.efficiency.completion_rate_percent < THRESHOLDS.LOW_COMPLETION_RATE) {
    status = '⚠️ ต้องปรับปรุง';
  }
  if (data.inventory.expired_qty > 0) {
    status = '❌ มีปัญหา';
  }

  return `สถานะ KPI: ${status} | อัตราสำเร็จ: ${data.efficiency.completion_rate_percent}% | การใช้พื้นที่: ${data.utilization.capacity_utilization_percent}%`;
}

// ============================================
// Format Output
// ============================================

function formatReasoningOutput(result: ReasoningResult, type: string): string {
  let output = '';

  // Warnings first (if any) - these are FACTS about concerning data
  if (result.warnings.length > 0) {
    output += `\nข้อควรระวัง (จากข้อมูลจริง):\n`;
    result.warnings.forEach(w => {
      output += `- ${w}\n`;
    });
  }

  // Analysis - clearly marked as interpretation
  if (result.analysis.length > 0) {
    output += `\nการวิเคราะห์ (ตีความจากข้อมูล):\n`;
    result.analysis.forEach(a => {
      output += `${a}\n`;
    });
  }

  // Suggestions - only if supported by data
  if (result.suggestions.length > 0) {
    output += `\nข้อเสนอแนะ (อ้างอิงจากข้อมูลข้างต้น):\n`;
    result.suggestions.forEach(s => {
      output += `- ${s}\n`;
    });
  }

  // Confidence indicator - important for transparency
  const confidenceText = {
    high: 'ความเชื่อมั่นสูง',
    medium: 'ความเชื่อมั่นปานกลาง',
    low: 'ความเชื่อมั่นต่ำ (ข้อมูลจำกัด)',
  };
  output += `\nหมายเหตุ: ${confidenceText[result.confidence]} (${result.dataPoints} data points)`;

  return output;
}

// ============================================
// Main Analysis Function
// ============================================

export function performAnalysis(
  context: ReasoningContext,
  analysisType: 'stock' | 'order' | 'kpi' | 'auto'
): AnalysisOutput {
  // Auto-detect analysis type based on available data
  if (analysisType === 'auto') {
    if (context.stockData) return analyzeStockLevel(context.stockData);
    if (context.orderData) return analyzeOrderStatus(context.orderData);
    if (context.kpiData) return analyzeKPI(context.kpiData);
    
    return {
      summary: 'ไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์',
      reasoning: {
        facts: [],
        analysis: [],
        suggestions: [],
        warnings: [],
        confidence: 'low',
        dataPoints: 0,
      },
      formatted: 'ไม่สามารถวิเคราะห์ได้เนื่องจากไม่มีข้อมูล',
    };
  }

  switch (analysisType) {
    case 'stock':
      return analyzeStockLevel(context.stockData);
    case 'order':
      return analyzeOrderStatus(context.orderData);
    case 'kpi':
      return analyzeKPI(context.kpiData);
    default:
      return {
        summary: 'ประเภทการวิเคราะห์ไม่ถูกต้อง',
        reasoning: {
          facts: [],
          analysis: [],
          suggestions: [],
          warnings: [],
          confidence: 'low',
          dataPoints: 0,
        },
        formatted: 'ไม่สามารถวิเคราะห์ได้',
      };
  }
}
