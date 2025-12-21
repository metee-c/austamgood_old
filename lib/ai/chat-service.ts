/**
 * AI Chat Service
 * Handles AI chat interactions with tool calling
 * 
 * Enhanced with:
 * - Reasoning Engine (Phase 8)
 * - Safety Guardrails (Phase 9)
 * - Data Contract & Question Guidance (Phase 11)
 */

import {
  analyzeStockLevel,
  analyzeOrderStatus,
  analyzeKPI,
} from './reasoning-engine';
import { SAFE_RESPONSES } from './guardrails';
import {
  generateGuidance,
  formatGuidanceResponse,
  suggestAlternativeQuestions,
  MISSING_DATA_RESPONSES,
} from './question-guidance';
import { checkDataAvailability, NOT_AVAILABLE_DATA } from './data-contract';
import { createClient } from '@/lib/supabase/server';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  result: any;
  error?: string;
}

export interface ChatRequest {
  message: string;
  conversation_history?: ChatMessage[];
  user_id?: string;
  session_id?: string;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  data?: any;
  error?: string;
  timestamp: string;
}

// API endpoint mapping for tools
const TOOL_API_MAP: Record<string, string> = {
  // Raw data APIs
  query_stock_balance: '/api/ai/stock/balance',
  query_stock_movements: '/api/ai/stock/movements',
  query_stock_consumption: '/api/ai/stock/consumption',
  query_forecast: '/api/ai/stock/forecast',
  query_warehouse_locations: '/api/ai/warehouse/locations',
  query_warehouse_utilization: '/api/ai/warehouse/utilization',
  query_order_status: '/api/ai/orders/status',
  query_picklists: '/api/ai/picklists',
  query_receiving_orders: '/api/ai/receiving/orders',
  query_production_orders: '/api/ai/production/orders',
  query_bom: '/api/ai/production/bom',
  query_routes: '/api/ai/routes',
  query_employee_activity: '/api/ai/employees/activity',
  query_inventory_ledger: '/api/ai/audit/ledger',
  query_system_alerts: '/api/ai/audit/alerts',
  query_kpi: '/api/ai/analytics/kpi',
  query_sku_master: '/api/ai/master/sku',
  query_customers: '/api/ai/master/customers',
  // Intelligence APIs (Phase 12-14)
  intelligence_consumption: '/api/ai/intelligence/consumption',
  intelligence_days_of_cover: '/api/ai/intelligence/days-of-cover',
  intelligence_shortage_risk: '/api/ai/intelligence/shortage-risk',
  intelligence_overstock_risk: '/api/ai/intelligence/overstock-risk',
  intelligence_expiry_risk: '/api/ai/intelligence/expiry-risk',
  intelligence_utilization: '/api/ai/intelligence/utilization',
  // Simulation APIs (Phase 15-16)
  simulation_demand_increase: '/api/ai/simulation/demand-increase',
  simulation_lead_time_increase: '/api/ai/simulation/lead-time-increase',
  simulation_storage_reduction: '/api/ai/simulation/storage-reduction',
  simulation_shift_change: '/api/ai/simulation/shift-change',
  simulation_compare: '/api/ai/simulation/compare',
  simulation_templates: '/api/ai/simulation/templates',
};

/**
 * Execute a tool call by directly querying the database
 * This avoids self-referencing fetch issues in Next.js server components
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  baseUrl: string
): Promise<{ data: any; error?: string }> {
  try {
    console.log(`[AI Chat] Executing tool: ${toolName} with args:`, args);

    // Direct database queries for each tool
    switch (toolName) {
      case 'query_stock_balance':
        return await executeStockBalanceQuery(args);
      case 'query_order_status':
        return await executeOrderStatusQuery(args);
      case 'query_warehouse_locations':
        return await executeWarehouseLocationsQuery(args);
      case 'query_stock_movements':
        return await executeStockMovementsQuery(args);
      case 'query_kpi':
        return await executeKPIQuery(args);
      case 'intelligence_consumption':
      case 'intelligence_days_of_cover':
        return await executeConsumptionQuery(args);
      case 'intelligence_shortage_risk':
        return await executeShortageRiskQuery(args);
      case 'intelligence_overstock_risk':
        return await executeOverstockRiskQuery(args);
      case 'intelligence_expiry_risk':
        return await executeExpiryRiskQuery(args);
      case 'intelligence_utilization':
        return await executeUtilizationQuery(args);
      // New tools - Phase B Enhancement
      case 'query_transfers':
        return await executeTransfersQuery(args);
      case 'query_stock_adjustments':
        return await executeStockAdjustmentsQuery(args);
      case 'query_face_sheets':
        return await executeFaceSheetsQuery(args);
      case 'query_bonus_face_sheets':
        return await executeBonusFaceSheetsQuery(args);
      case 'query_loadlists':
        return await executeLoadlistsQuery(args);
      case 'query_replenishment':
        return await executeReplenishmentQuery(args);
      case 'query_production_plan':
        return await executeProductionPlanQuery(args);
      case 'query_material_issues':
        return await executeMaterialIssuesQuery(args);
      case 'query_suppliers':
        return await executeSuppliersQuery(args);
      case 'query_vehicles':
        return await executeVehiclesQuery(args);
      case 'query_preparation_areas':
        return await executePreparationAreasQuery(args);
      default:
        return {
          data: null,
          error: `Tool '${toolName}' not implemented for direct query`,
        };
    }
  } catch (error) {
    console.error(`[AI Chat] Tool execution error for ${toolName}:`, error);
    return {
      data: null,
      error: `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Detect if user is asking an unanswerable question
 * Returns guidance if the question cannot be answered
 */
export function detectUnanswerableIntent(message: string): {
  isUnanswerable: boolean;
  intent?: string;
  guidance?: string;
  canDerive?: boolean;
  deriveTool?: string;
} {
  const lowerMessage = message.toLowerCase();

  // Days of Cover / Stock Duration - CAN NOW DERIVE from consumption
  if (
    (lowerMessage.includes('กี่วัน') &&
      (lowerMessage.includes('หมด') || lowerMessage.includes('ใช้ได้'))) ||
    lowerMessage.includes('days of cover') ||
    lowerMessage.includes('ใช้ได้อีก') ||
    lowerMessage.includes('พอใช้กี่วัน')
  ) {
    // Check if user wants derived calculation
    if (
      lowerMessage.includes('คำนวณ') ||
      lowerMessage.includes('ประมาณ') ||
      lowerMessage.includes('วิเคราะห์')
    ) {
      return {
        isUnanswerable: false,
        canDerive: true,
        deriveTool: 'query_stock_consumption',
      };
    }
    return {
      isUnanswerable: true,
      intent: 'days_of_cover',
      guidance: `ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวันโดยตรง

อย่างไรก็ตาม ผมสามารถคำนวณจากประวัติการจ่ายออกได้:

💡 ลองถาม:
1. "คำนวณอัตราการใช้จากประวัติ 30 วัน"
2. "วิเคราะห์การจ่ายออก SKU-XXX"
3. "ประมาณการใช้สต็อกจากข้อมูลย้อนหลัง"

⚠️ หมายเหตุ: ผลลัพธ์เป็นการประมาณการจากข้อมูลในอดีต ไม่ใช่การพยากรณ์`,
    };
  }

  // Consumption Rate - CAN NOW DERIVE
  if (
    lowerMessage.includes('อัตราการใช้') ||
    lowerMessage.includes('consumption rate') ||
    lowerMessage.includes('ใช้ต่อวัน') ||
    lowerMessage.includes('ใช้ต่อเดือน')
  ) {
    if (
      lowerMessage.includes('คำนวณ') ||
      lowerMessage.includes('ประมาณ') ||
      lowerMessage.includes('วิเคราะห์') ||
      lowerMessage.includes('จากประวัติ')
    ) {
      return {
        isUnanswerable: false,
        canDerive: true,
        deriveTool: 'query_stock_consumption',
      };
    }
    return {
      isUnanswerable: true,
      intent: 'consumption_rate',
      guidance: `ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวันโดยตรง

อย่างไรก็ตาม ผมสามารถคำนวณจากประวัติการจ่ายออกได้:

💡 ลองถาม:
1. "คำนวณอัตราการใช้จากประวัติ 30 วัน"
2. "วิเคราะห์การจ่ายออก"

⚠️ หมายเหตุ: ผลลัพธ์เป็นการประมาณการจากข้อมูลในอดีต`,
    };
  }

  // Shortage Risk / Reorder - NOW AVAILABLE via Intelligence API
  if (
    (lowerMessage.includes('เสี่ยง') && lowerMessage.includes('ขาด')) ||
    lowerMessage.includes('shortage risk') ||
    lowerMessage.includes('ต้องสั่งซื้อ') ||
    lowerMessage.includes('ควรสั่งซื้อ') ||
    lowerMessage.includes('จะหมด') ||
    lowerMessage.includes('ใกล้หมด')
  ) {
    return {
      isUnanswerable: false,
      canDerive: true,
      deriveTool: 'intelligence_shortage_risk',
    };
  }

  // Overstock - NOW AVAILABLE via Intelligence API
  if (
    lowerMessage.includes('overstock') ||
    lowerMessage.includes('สต็อกเกิน') ||
    lowerMessage.includes('ค้างนาน') ||
    lowerMessage.includes('สต็อกมาก') ||
    lowerMessage.includes('เกินความต้องการ')
  ) {
    return {
      isUnanswerable: false,
      canDerive: true,
      deriveTool: 'intelligence_overstock_risk',
    };
  }

  // Expiry Risk - NOW AVAILABLE via Intelligence API
  if (
    lowerMessage.includes('หมดอายุ') ||
    lowerMessage.includes('expiry') ||
    lowerMessage.includes('expire') ||
    lowerMessage.includes('ใกล้หมดอายุ') ||
    lowerMessage.includes('วันหมดอายุ')
  ) {
    return {
      isUnanswerable: false,
      canDerive: true,
      deriveTool: 'intelligence_expiry_risk',
    };
  }

  // Utilization - NOW AVAILABLE via Intelligence API
  if (
    lowerMessage.includes('utilization') ||
    lowerMessage.includes('การใช้พื้นที่') ||
    lowerMessage.includes('พื้นที่ว่าง') ||
    lowerMessage.includes('พื้นที่เต็ม') ||
    lowerMessage.includes('ความจุ')
  ) {
    return {
      isUnanswerable: false,
      canDerive: true,
      deriveTool: 'intelligence_utilization',
    };
  }

  // Productivity / Picks per hour
  if (
    lowerMessage.includes('picks per hour') ||
    lowerMessage.includes('pick ต่อชั่วโมง') ||
    lowerMessage.includes('ประสิทธิภาพพนักงาน') ||
    lowerMessage.includes('productivity')
  ) {
    return {
      isUnanswerable: true,
      intent: 'productivity',
      guidance: formatGuidanceResponse(
        generateGuidance('picks_per_hour', ['pick_timestamp'])
      ),
    };
  }

  // Forecast / Prediction
  if (
    lowerMessage.includes('พยากรณ์') ||
    lowerMessage.includes('forecast') ||
    lowerMessage.includes('คาดการณ์') ||
    lowerMessage.includes('เดือนหน้า') ||
    lowerMessage.includes('ปีหน้า')
  ) {
    return {
      isUnanswerable: true,
      intent: 'forecast',
      guidance: SAFE_RESPONSES.cannotPredict,
    };
  }

  // Cost / Value
  if (
    lowerMessage.includes('มูลค่าสต็อก') ||
    lowerMessage.includes('ต้นทุน') ||
    lowerMessage.includes('inventory value') ||
    lowerMessage.includes('unit cost')
  ) {
    return {
      isUnanswerable: true,
      intent: 'cost',
      guidance: `ขออภัยครับ ระบบไม่ได้เก็บข้อมูลต้นทุนต่อหน่วย (unit cost)

⚠️ ข้อจำกัด:
- ตาราง master_sku ไม่มี field unit_cost
- ไม่สามารถคำนวณมูลค่าสต็อกได้

💡 คำถามที่ระบบสามารถตอบได้แทน:
1. "สต็อกคงเหลือเท่าไร?" (จำนวนชิ้น)
2. "สินค้าไหนมีสต็อกมากที่สุด?"`,
    };
  }

  return { isUnanswerable: false };
}

/**
 * Detect intent from user message and determine which tools to call
 */
export function detectIntent(message: string): { tools: string[]; params: Record<string, any> } {
  const lowerMessage = message.toLowerCase();
  const tools: string[] = [];
  const params: Record<string, any> = {};

  // Debug logging
  console.log(`[AI Chat] detectIntent: "${message}"`);
  console.log(`[AI Chat] IV pattern test: ${/IV\d+/i.test(message)}`);

  // Stock queries
  if (
    lowerMessage.includes('สต็อก') ||
    lowerMessage.includes('stock') ||
    lowerMessage.includes('คงเหลือ') ||
    lowerMessage.includes('เหลือ') ||
    lowerMessage.includes('มีกี่')
  ) {
    tools.push('query_stock_balance');
    
    // Extract SKU ID if mentioned
    const skuMatch = message.match(/[A-Z]-[A-Z]{3}-[A-Z]\|[A-Z]+\|\d+/i);
    if (skuMatch) {
      params.sku_id = skuMatch[0].toUpperCase();
    }
  }

  // Order tracking
  if (
    lowerMessage.includes('ออเดอร์') ||
    lowerMessage.includes('order') ||
    lowerMessage.includes('คำสั่งซื้อ') ||
    lowerMessage.includes('สถานะออเดอร์') ||
    lowerMessage.includes('ถึงไหน') ||
    lowerMessage.includes('ลูกค้าไหน') ||
    lowerMessage.includes('ร้านไหน') ||
    lowerMessage.includes('ร้านอะไร') ||
    // Match order number patterns
    /IV\d+/i.test(message) ||
    /SO-?\d+/i.test(message) ||
    /ORD-?\d+/i.test(message)
  ) {
    tools.push('query_order_status');

    // Extract order number if mentioned - support multiple formats
    const orderMatch =
      message.match(/IV\d+/i) ||
      message.match(/SO-?\d{4}-?\d+/i) ||
      message.match(/ORD-?\d{4}-?\d+/i);
    if (orderMatch) {
      params.order_code = orderMatch[0].toUpperCase();
    }
  }

  // Location queries - be more specific to avoid false matches
  if (
    lowerMessage.includes('โลเคชั่น') ||
    lowerMessage.includes('location') ||
    lowerMessage.includes('ตำแหน่งจัดเก็บ') ||
    lowerMessage.includes('ที่เก็บสินค้า') ||
    (lowerMessage.includes('พื้นที่') && lowerMessage.includes('คลัง'))
  ) {
    tools.push('query_warehouse_locations');
  }

  // Movement/history queries
  if (
    lowerMessage.includes('เคลื่อนไหว') ||
    lowerMessage.includes('movement') ||
    lowerMessage.includes('ประวัติ') ||
    lowerMessage.includes('history') ||
    lowerMessage.includes('รับเข้า') ||
    lowerMessage.includes('จ่ายออก')
  ) {
    tools.push('query_stock_movements');
  }

  // Consumption analysis (derived from movements)
  if (
    (lowerMessage.includes('คำนวณ') &&
      (lowerMessage.includes('อัตรา') || lowerMessage.includes('การใช้'))) ||
    (lowerMessage.includes('วิเคราะห์') && lowerMessage.includes('จ่ายออก')) ||
    lowerMessage.includes('consumption') ||
    (lowerMessage.includes('ประมาณ') &&
      (lowerMessage.includes('ใช้') || lowerMessage.includes('หมด')))
  ) {
    tools.push('intelligence_consumption');

    // Extract period if mentioned
    const periodMatch = message.match(/(\d+)\s*วัน/);
    if (periodMatch) {
      params.period_days = parseInt(periodMatch[1]);
    }
  }

  // Days of cover / Stock duration
  if (
    (lowerMessage.includes('กี่วัน') &&
      (lowerMessage.includes('หมด') || lowerMessage.includes('ใช้ได้'))) ||
    lowerMessage.includes('days of cover') ||
    lowerMessage.includes('ใช้ได้อีก') ||
    lowerMessage.includes('พอใช้กี่วัน')
  ) {
    tools.push('intelligence_days_of_cover');
  }

  // Shortage risk
  if (
    (lowerMessage.includes('เสี่ยง') && lowerMessage.includes('ขาด')) ||
    lowerMessage.includes('shortage') ||
    lowerMessage.includes('จะหมด') ||
    lowerMessage.includes('ใกล้หมด') ||
    lowerMessage.includes('ต้องสั่งซื้อ')
  ) {
    tools.push('intelligence_shortage_risk');
  }

  // Overstock risk
  if (
    lowerMessage.includes('overstock') ||
    lowerMessage.includes('สต็อกเกิน') ||
    lowerMessage.includes('ค้างนาน') ||
    lowerMessage.includes('สต็อกมาก')
  ) {
    tools.push('intelligence_overstock_risk');
  }

  // Expiry risk
  if (
    lowerMessage.includes('หมดอายุ') ||
    lowerMessage.includes('expiry') ||
    lowerMessage.includes('expire') ||
    lowerMessage.includes('ใกล้หมดอายุ')
  ) {
    tools.push('intelligence_expiry_risk');
  }

  // Utilization
  if (
    lowerMessage.includes('utilization') ||
    lowerMessage.includes('การใช้พื้นที่') ||
    lowerMessage.includes('พื้นที่ว่าง') ||
    lowerMessage.includes('พื้นที่เต็ม')
  ) {
    tools.push('intelligence_utilization');
  }

  // KPI/Performance queries
  if (
    lowerMessage.includes('kpi') ||
    lowerMessage.includes('ประสิทธิภาพ') ||
    lowerMessage.includes('performance') ||
    lowerMessage.includes('สรุป') ||
    lowerMessage.includes('ภาพรวม') ||
    lowerMessage.includes('dashboard')
  ) {
    tools.push('query_kpi');
  }

  // Production queries
  if (
    lowerMessage.includes('ผลิต') ||
    lowerMessage.includes('production') ||
    lowerMessage.includes('bom') ||
    lowerMessage.includes('วัตถุดิบ')
  ) {
    tools.push('query_production_orders');
  }

  // What-If Simulation queries (Phase 15-16)
  if (
    lowerMessage.includes('what if') ||
    lowerMessage.includes('what-if') ||
    lowerMessage.includes('จำลอง') ||
    lowerMessage.includes('simulation') ||
    lowerMessage.includes('ถ้า') ||
    lowerMessage.includes('สมมติ') ||
    lowerMessage.includes('scenario')
  ) {
    // Demand increase simulation
    if (
      lowerMessage.includes('demand') ||
      lowerMessage.includes('ความต้องการ') ||
      lowerMessage.includes('ยอดขาย') ||
      lowerMessage.includes('เพิ่มขึ้น') ||
      lowerMessage.includes('peak') ||
      lowerMessage.includes('พีค')
    ) {
      tools.push('simulation_demand_increase');
      // Extract multiplier if mentioned
      const percentMatch = message.match(/(\d+)\s*%/);
      if (percentMatch) {
        params.demand_multiplier = 1 + parseInt(percentMatch[1]) / 100;
      }
      const multiplierMatch = message.match(/(\d+\.?\d*)\s*(เท่า|x|times)/i);
      if (multiplierMatch) {
        params.demand_multiplier = parseFloat(multiplierMatch[1]);
      }
    }
    // Lead time simulation
    else if (
      lowerMessage.includes('lead time') ||
      lowerMessage.includes('ซัพพลายเออร์') ||
      lowerMessage.includes('supplier') ||
      lowerMessage.includes('ส่งช้า') ||
      lowerMessage.includes('delay')
    ) {
      tools.push('simulation_lead_time_increase');
      // Extract days if mentioned
      const daysMatch = message.match(/(\d+)\s*วัน/);
      if (daysMatch) {
        params.lead_time_increase_days = parseInt(daysMatch[1]);
      }
    }
    // Storage reduction simulation
    else if (
      lowerMessage.includes('storage') ||
      lowerMessage.includes('พื้นที่') ||
      lowerMessage.includes('ลดพื้นที่') ||
      lowerMessage.includes('space') ||
      lowerMessage.includes('ความจุ')
    ) {
      tools.push('simulation_storage_reduction');
      // Extract percent if mentioned
      const percentMatch = message.match(/(\d+)\s*%/);
      if (percentMatch) {
        params.reduction_percent = parseInt(percentMatch[1]);
      }
    }
    // Shift/workforce simulation
    else if (
      lowerMessage.includes('shift') ||
      lowerMessage.includes('กะ') ||
      lowerMessage.includes('พนักงาน') ||
      lowerMessage.includes('worker') ||
      lowerMessage.includes('กำลังคน') ||
      lowerMessage.includes('workforce')
    ) {
      tools.push('simulation_shift_change');
      // Extract percent if mentioned
      const percentMatch = message.match(/(\d+)\s*%/);
      if (percentMatch) {
        if (lowerMessage.includes('ลด') || lowerMessage.includes('reduce')) {
          params.worker_count_change = -parseInt(percentMatch[1]);
        } else {
          params.worker_count_change = parseInt(percentMatch[1]);
        }
      }
    }
    // Default to templates if no specific scenario
    else {
      tools.push('simulation_templates');
    }
  }

  // === NEW INTENT DETECTION - Phase B Enhancement ===

  // Transfer queries
  if (
    lowerMessage.includes('โอนย้าย') ||
    lowerMessage.includes('transfer') ||
    lowerMessage.includes('ย้ายสินค้า') ||
    lowerMessage.includes('โอนสต็อก') ||
    lowerMessage.includes('ย้ายโลเคชั่น')
  ) {
    tools.push('query_transfers');
  }

  // Stock adjustment queries
  if (
    lowerMessage.includes('ปรับสต็อก') ||
    lowerMessage.includes('adjustment') ||
    lowerMessage.includes('ปรับปรุงสต็อก') ||
    lowerMessage.includes('แก้ไขสต็อก') ||
    lowerMessage.includes('ใบปรับ')
  ) {
    tools.push('query_stock_adjustments');
  }

  // Face sheet queries
  if (
    lowerMessage.includes('ใบปะหน้า') ||
    lowerMessage.includes('face sheet') ||
    lowerMessage.includes('ปะหน้า') ||
    lowerMessage.includes('facesheet')
  ) {
    if (lowerMessage.includes('ของแถม') || lowerMessage.includes('bonus')) {
      tools.push('query_bonus_face_sheets');
    } else {
      tools.push('query_face_sheets');
    }
  }

  // Loadlist queries
  if (
    lowerMessage.includes('ใบโหลด') ||
    lowerMessage.includes('loadlist') ||
    lowerMessage.includes('โหลดสินค้า') ||
    lowerMessage.includes('load list')
  ) {
    tools.push('query_loadlists');
  }

  // Replenishment queries
  if (
    lowerMessage.includes('เติมสินค้า') ||
    lowerMessage.includes('replenishment') ||
    lowerMessage.includes('เบิกเติม') ||
    lowerMessage.includes('คิวเติม') ||
    lowerMessage.includes('auto replenish')
  ) {
    tools.push('query_replenishment');
  }

  // Production plan queries
  if (
    lowerMessage.includes('แผนผลิต') ||
    lowerMessage.includes('production plan') ||
    lowerMessage.includes('วางแผนผลิต') ||
    lowerMessage.includes('แผนการผลิต')
  ) {
    tools.push('query_production_plan');
  }

  // Material issue queries
  if (
    lowerMessage.includes('เบิกวัตถุดิบ') ||
    lowerMessage.includes('material issue') ||
    lowerMessage.includes('เบิกของ') ||
    lowerMessage.includes('ใบเบิก') ||
    lowerMessage.includes('เบิกวัสดุ')
  ) {
    tools.push('query_material_issues');
  }

  // Supplier queries
  if (
    lowerMessage.includes('ซัพพลายเออร์') ||
    lowerMessage.includes('supplier') ||
    lowerMessage.includes('ผู้จัดจำหน่าย') ||
    lowerMessage.includes('ผู้ขาย')
  ) {
    // Only add if not already in simulation context
    if (!tools.includes('simulation_lead_time_increase')) {
      tools.push('query_suppliers');
    }
  }

  // Vehicle queries
  if (
    lowerMessage.includes('รถ') ||
    lowerMessage.includes('vehicle') ||
    lowerMessage.includes('ยานพาหนะ') ||
    lowerMessage.includes('รถขนส่ง') ||
    lowerMessage.includes('ทะเบียน')
  ) {
    tools.push('query_vehicles');
  }

  // Preparation area queries
  if (
    lowerMessage.includes('พื้นที่จัดเตรียม') ||
    lowerMessage.includes('preparation area') ||
    lowerMessage.includes('prep area') ||
    lowerMessage.includes('staging')
  ) {
    tools.push('query_preparation_areas');
  }

  // === END NEW INTENT DETECTION ===

  // Default to KPI if no specific intent detected
  if (tools.length === 0) {
    // Check if it's a greeting or general question
    if (
      lowerMessage.includes('สวัสดี') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('ช่วย') ||
      lowerMessage.includes('help')
    ) {
      // No tools needed for greetings
      return { tools: [], params: {} };
    }
    
    // Default to stock balance for unknown queries
    tools.push('query_stock_balance');
  }

  return { tools, params };
}

/**
 * Format tool results into a human-readable response with reasoning
 */
export function formatResponse(
  toolName: string,
  result: any,
  userMessage: string,
  enableReasoning: boolean = true
): string {
  if (!result || !result.success) {
    return `ขออภัยครับ ไม่สามารถดึงข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง\n\nข้อผิดพลาด: ${result?.error || 'Unknown error'}`;
  }

  // Check if user wants analysis
  const wantsAnalysis = 
    userMessage.includes('วิเคราะห์') ||
    userMessage.includes('ทำไม') ||
    userMessage.includes('สาเหตุ') ||
    userMessage.includes('ปัญหา') ||
    userMessage.includes('แนะนำ') ||
    userMessage.includes('analysis');

  switch (toolName) {
    case 'query_stock_balance':
      return formatStockBalanceResponse(result, wantsAnalysis || enableReasoning);
    case 'query_order_status':
      return formatOrderStatusResponse(result, wantsAnalysis || enableReasoning);
    case 'query_warehouse_locations':
      return formatLocationResponse(result);
    case 'query_stock_movements':
      return formatMovementResponse(result);
    case 'query_stock_consumption':
    case 'intelligence_consumption':
      return formatConsumptionResponse(result);
    case 'query_kpi':
      return formatKPIResponse(result, wantsAnalysis || enableReasoning);
    case 'intelligence_days_of_cover':
      return formatDaysOfCoverResponse(result);
    case 'intelligence_shortage_risk':
      return formatShortageRiskResponse(result);
    case 'intelligence_overstock_risk':
      return formatOverstockRiskResponse(result);
    case 'intelligence_expiry_risk':
      return formatExpiryRiskResponse(result);
    case 'intelligence_utilization':
      return formatUtilizationResponse(result);
    // Simulation tools (Phase 15-16)
    case 'simulation_demand_increase':
    case 'simulation_lead_time_increase':
    case 'simulation_storage_reduction':
    case 'simulation_shift_change':
    case 'simulation_compare':
    case 'simulation_templates':
      return formatSimulationResponse(toolName, result);
    default:
      return formatGenericResponse(result);
  }
}

function formatStockBalanceResponse(result: any, includeAnalysis: boolean = false): string {
  const { data, summary } = result;
  
  if (!data || data.length === 0) {
    return SAFE_RESPONSES.noData;
  }

  // Professional summary
  let response = `ตรวจสอบสต็อกคงเหลือจากระบบ พบข้อมูล ${summary.total_items.toLocaleString()} รายการ\n\n`;
  
  // Data from system (FACTS only)
  response += `ข้อมูลจากระบบ:\n`;
  response += `- สต็อกทั้งหมด: ${summary.total_piece_qty.toLocaleString()} ชิ้น\n`;
  response += `- สำรองแล้ว: ${summary.total_reserved_qty.toLocaleString()} ชิ้น\n`;
  response += `- พร้อมใช้งาน: ${summary.total_available_qty.toLocaleString()} ชิ้น\n`;
  response += `- จำนวน SKU: ${summary.unique_skus} รายการ\n`;
  response += `- จำนวนโลเคชั่น: ${summary.unique_locations} ตำแหน่ง\n`;

  // Show top items with specific data
  if (data.length > 0) {
    response += `\nรายละเอียด (${Math.min(5, data.length)} รายการแรก):\n`;
    data.slice(0, 5).forEach((item: any, index: number) => {
      response += `${index + 1}. ${item.sku_name} (${item.sku_id})\n`;
      response += `   - โลเคชั่น: ${item.location_name}\n`;
      response += `   - จำนวน: ${item.total_piece_qty.toLocaleString()} ชิ้น`;
      if (item.reserved_piece_qty > 0) {
        response += ` (สำรอง ${item.reserved_piece_qty.toLocaleString()})`;
      }
      response += `\n`;
      if (item.expiry_date) {
        response += `   - วันหมดอายุ: ${item.expiry_date}\n`;
      }
    });
  }

  // Add reasoning analysis if requested (clearly separated)
  if (includeAnalysis) {
    const analysis = analyzeStockLevel(result);
    if (analysis.reasoning.warnings.length > 0 || analysis.reasoning.analysis.length > 0) {
      response += `\nการวิเคราะห์ (อ้างอิงจากข้อมูลข้างต้น):\n`;
      response += analysis.formatted;
    }
  }

  return response;
}

function formatOrderStatusResponse(
  result: any,
  includeAnalysis: boolean = false
): string {
  const { data, summary } = result;

  if (!data || data.length === 0) {
    return SAFE_RESPONSES.noData;
  }

  // Professional summary
  let response = `ตรวจสอบสถานะออเดอร์จากระบบ พบ ${summary.total_orders} รายการ\n\n`;

  // Data from system (FACTS only)
  response += `ข้อมูลจากระบบ:\n`;
  response += `- จำนวนออเดอร์: ${summary.total_orders} รายการ\n`;
  response += `- จำนวนสินค้ารวม: ${(summary.total_qty || 0).toLocaleString()} ชิ้น\n`;
  response += `- จำนวนรายการรวม: ${(summary.total_items || 0).toLocaleString()} รายการ\n`;

  // Status breakdown
  if (Object.keys(summary.by_status).length > 0) {
    response += `\nสถานะ:\n`;
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
      response += `- ${statusThai[status] || status}: ${count} รายการ\n`;
    });
  }

  // Show top orders with specific data
  if (data.length > 0) {
    response += `\nรายละเอียด (${Math.min(5, data.length)} รายการแรก):\n`;
    data.slice(0, 5).forEach((order: any, index: number) => {
      response += `${index + 1}. ${order.order_no} - ${order.status_thai}\n`;
      response += `   - ลูกค้า/ร้าน: ${order.customer_name || order.shop_name || '-'}\n`;
      if (order.province) {
        response += `   - จังหวัด: ${order.province}\n`;
      }
      response += `   - วันส่ง: ${order.delivery_date || '-'}\n`;
      response += `   - จำนวน: ${(order.total_qty || 0).toLocaleString()} ชิ้น (${order.total_items || 0} รายการ)\n`;
    });
  }

  // Add reasoning analysis if requested (clearly separated)
  if (includeAnalysis) {
    const analysis = analyzeOrderStatus(result);
    if (
      analysis.reasoning.warnings.length > 0 ||
      analysis.reasoning.analysis.length > 0
    ) {
      response += `\nการวิเคราะห์ (อ้างอิงจากข้อมูลข้างต้น):\n`;
      response += analysis.formatted;
    }
  }

  return response;
}

function formatLocationResponse(result: any): string {
  const { data, summary } = result;
  
  if (!data || data.length === 0) {
    return SAFE_RESPONSES.noData;
  }

  // Professional summary
  let response = `ตรวจสอบข้อมูลโลเคชั่นจากระบบ พบ ${summary.total_locations} ตำแหน่ง\n\n`;
  
  // Data from system (FACTS only)
  response += `ข้อมูลจากระบบ:\n`;
  response += `- โลเคชั่นทั้งหมด: ${summary.total_locations} ตำแหน่ง\n`;
  response += `- ใช้งานอยู่: ${summary.occupied_locations} ตำแหน่ง\n`;
  response += `- อัตราการใช้งาน: ${summary.avg_utilization_percent}%\n`;
  response += `- ความจุรวม: ${summary.total_capacity.toLocaleString()} ชิ้น\n`;
  response += `- ใช้ไปแล้ว: ${summary.total_used.toLocaleString()} ชิ้น\n`;

  // Zone breakdown
  if (Object.keys(summary.by_zone).length > 0) {
    response += `\nตามโซน:\n`;
    Object.entries(summary.by_zone).forEach(([zone, info]: [string, any]) => {
      response += `- ${zone}: ${info.count} ตำแหน่ง (ใช้งาน ${info.utilization}%)\n`;
    });
  }

  return response;
}

function formatMovementResponse(result: any): string {
  const { data, summary } = result;

  if (!data || data.length === 0) {
    return SAFE_RESPONSES.noData;
  }

  // Professional summary
  let response = `ตรวจสอบการเคลื่อนไหวสต็อกจากระบบ พบ ${summary.total_movements.toLocaleString()} รายการ\n\n`;

  // Data from system (FACTS only)
  response += `ข้อมูลจากระบบ:\n`;
  response += `- รายการทั้งหมด: ${summary.total_movements.toLocaleString()} รายการ\n`;
  response += `- รับเข้า: ${summary.total_in_qty.toLocaleString()} ชิ้น\n`;
  response += `- จ่ายออก: ${summary.total_out_qty.toLocaleString()} ชิ้น\n`;
  response += `- สุทธิ: ${summary.net_qty >= 0 ? '+' : ''}${summary.net_qty.toLocaleString()} ชิ้น\n`;

  // By type
  if (Object.keys(summary.by_type).length > 0) {
    response += `\nตามประเภท:\n`;
    Object.entries(summary.by_type).forEach(([type, info]: [string, any]) => {
      const typeThai: Record<string, string> = {
        receive: 'รับสินค้า',
        ship: 'จ่ายสินค้า',
        transfer: 'โอนย้าย',
        putaway: 'จัดเก็บ',
        adjustment: 'ปรับปรุง',
      };
      response += `- ${typeThai[type] || type}: ${info.count} รายการ (${info.qty.toLocaleString()} ชิ้น)\n`;
    });
  }

  return response;
}

function formatConsumptionResponse(result: any): string {
  const { data, summary } = result;

  if (!data || data.length === 0) {
    return 'ไม่พบข้อมูลการเคลื่อนไหวขาออกในช่วงเวลาที่กำหนด';
  }

  // Professional summary with disclaimer
  let response = `📊 การวิเคราะห์อัตราการใช้ (คำนวณจากประวัติการจ่ายออก ${summary.period_days} วัน)\n\n`;
  response += `⚠️ หมายเหตุ: ข้อมูลนี้คำนวณจากประวัติการเคลื่อนไหว ไม่ใช่ข้อมูลที่เก็บโดยตรง\n\n`;

  // Summary
  response += `ข้อมูลสรุป:\n`;
  response += `- SKU ที่วิเคราะห์: ${summary.total_skus_analyzed} รายการ\n`;
  response += `- ยอดจ่ายออกรวม: ${summary.total_outbound_qty.toLocaleString()} ชิ้น\n`;
  response += `- เฉลี่ยต่อวัน: ${summary.avg_daily_outbound.toLocaleString()} ชิ้น/วัน\n\n`;

  // Top items
  response += `รายละเอียด (${Math.min(10, data.length)} รายการแรก):\n`;
  data.slice(0, 10).forEach((item: any, index: number) => {
    const confidenceIcon =
      item.confidence === 'high'
        ? '🟢'
        : item.confidence === 'medium'
          ? '🟡'
          : '🔴';

    response += `${index + 1}. ${item.sku_name || item.sku_id}\n`;
    response += `   - อัตราการใช้เฉลี่ย: ${item.avg_daily_consumption.toLocaleString()} ชิ้น/วัน\n`;
    response += `   - สต็อกปัจจุบัน: ${item.current_stock.toLocaleString()} ชิ้น\n`;

    if (item.estimated_days_of_cover !== null) {
      response += `   - ประมาณการใช้ได้: ~${item.estimated_days_of_cover} วัน\n`;
    } else {
      response += `   - ประมาณการใช้ได้: ไม่สามารถคำนวณได้\n`;
    }

    response += `   - ความเชื่อมั่น: ${confidenceIcon} ${item.confidence} (${item.data_points} data points)\n\n`;
  });

  // Disclaimer
  response += `\n📝 ข้อจำกัดของการคำนวณนี้:\n`;
  response += `- คำนวณจากประวัติการจ่ายออก ไม่ใช่ข้อมูลการใช้จริง\n`;
  response += `- ไม่รวมการใช้ภายใน (internal consumption)\n`;
  response += `- ควรใช้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ใช่การพยากรณ์`;

  return response;
}

function formatKPIResponse(result: any, includeAnalysis: boolean = false): string {
  const { data } = result;
  
  if (!data) {
    return SAFE_RESPONSES.noData;
  }

  // Professional summary
  let response = `สรุป KPI คลังสินค้า ช่วงเวลา ${data.period.date_from} ถึง ${data.period.date_to} (${data.period.days_in_period} วัน)\n\n`;

  // Data from system (FACTS only)
  response += `ข้อมูลจากระบบ:\n\n`;
  
  // Throughput
  response += `Throughput:\n`;
  response += `- รับสินค้า: ${data.throughput.total_received_qty.toLocaleString()} ชิ้น (เฉลี่ย ${data.throughput.avg_daily_received.toLocaleString()}/วัน)\n`;
  response += `- จ่ายสินค้า: ${data.throughput.total_shipped_qty.toLocaleString()} ชิ้น (เฉลี่ย ${data.throughput.avg_daily_shipped.toLocaleString()}/วัน)\n`;
  response += `- ใบรับสินค้า: ${data.throughput.receiving_orders_count} รายการ\n`;
  response += `- ออเดอร์: ${data.throughput.shipping_orders_count} รายการ\n\n`;

  // Efficiency
  response += `Efficiency:\n`;
  response += `- ออเดอร์สำเร็จ: ${data.efficiency.orders_completed} รายการ\n`;
  response += `- กำลังดำเนินการ: ${data.efficiency.orders_in_progress} รายการ\n`;
  response += `- รอดำเนินการ: ${data.efficiency.orders_pending} รายการ\n`;
  response += `- อัตราสำเร็จ: ${data.efficiency.completion_rate_percent}%\n`;
  response += `- เวลาเฉลี่ย: ${data.efficiency.avg_order_processing_days} วัน\n\n`;

  // Utilization
  response += `Utilization:\n`;
  response += `- โลเคชั่นใช้งาน: ${data.utilization.occupied_locations}/${data.utilization.total_locations} (${data.utilization.location_utilization_percent}%)\n`;
  response += `- ความจุใช้ไป: ${data.utilization.current_stock_qty.toLocaleString()}/${data.utilization.total_capacity_qty.toLocaleString()} (${data.utilization.capacity_utilization_percent}%)\n`;
  response += `- SKU ในสต็อก: ${data.utilization.unique_skus_in_stock} รายการ\n`;
  response += `- พาเลท: ${data.utilization.unique_pallets} พาเลท\n\n`;

  // Inventory
  response += `Inventory:\n`;
  response += `- สต็อกทั้งหมด: ${data.inventory.total_piece_qty.toLocaleString()} ชิ้น\n`;
  response += `- สำรองแล้ว: ${data.inventory.total_reserved_qty.toLocaleString()} ชิ้น\n`;
  response += `- พร้อมใช้: ${data.inventory.available_qty.toLocaleString()} ชิ้น\n`;
  if (data.inventory.expiring_soon_qty > 0) {
    response += `- ใกล้หมดอายุ: ${data.inventory.expiring_soon_qty.toLocaleString()} ชิ้น\n`;
  }
  if (data.inventory.expired_qty > 0) {
    response += `- หมดอายุแล้ว: ${data.inventory.expired_qty.toLocaleString()} ชิ้น\n`;
  }

  // Add reasoning analysis if requested (clearly separated)
  if (includeAnalysis) {
    const analysis = analyzeKPI(result);
    if (analysis.reasoning.warnings.length > 0 || analysis.reasoning.analysis.length > 0) {
      response += `\nการวิเคราะห์ (อ้างอิงจากข้อมูลข้างต้น):\n`;
      response += analysis.formatted;
    }
  }

  return response;
}

function formatGenericResponse(result: any): string {
  if (result.data && Array.isArray(result.data)) {
    return `พบข้อมูล ${result.data.length} รายการ`;
  }
  return 'ดึงข้อมูลสำเร็จ';
}

// ============================================
// Intelligence Response Formatters (Phase 14)
// ============================================

function formatDaysOfCoverResponse(result: any): string {
  const { data, metadata, disclaimer } = result;

  if (!data || data.length === 0) {
    return 'ไม่พบข้อมูลสำหรับการวิเคราะห์ Days of Cover';
  }

  let response = `📊 วิเคราะห์จำนวนวันที่สต็อกจะใช้ได้ (Days of Cover)\n`;
  response += `📅 ข้อมูล: ${metadata.data_window.replace('last_', '').replace('_days', ' วันที่ผ่านมา')}\n`;
  response += `🎯 ความเชื่อมั่น: ${metadata.confidence_percent}% (${metadata.confidence_level})\n\n`;

  // Group by risk level
  const critical = data.filter((d: any) => d.risk_level === 'critical');
  const warning = data.filter((d: any) => d.risk_level === 'warning');
  const excess = data.filter((d: any) => d.risk_level === 'excess');

  if (critical.length > 0) {
    response += `🔴 วิกฤต (≤3 วัน): ${critical.length} รายการ\n`;
    critical.slice(0, 5).forEach((item: any, i: number) => {
      response += `   ${i + 1}. ${item.sku_name} - เหลือ ~${item.days_of_cover ?? 0} วัน\n`;
      response += `      สต็อก: ${item.available_qty.toLocaleString()} | ใช้: ${item.avg_daily_consumption}/วัน\n`;
    });
    response += '\n';
  }

  if (warning.length > 0) {
    response += `🟠 เตือน (≤7 วัน): ${warning.length} รายการ\n`;
    warning.slice(0, 5).forEach((item: any, i: number) => {
      response += `   ${i + 1}. ${item.sku_name} - เหลือ ~${item.days_of_cover ?? 0} วัน\n`;
    });
    response += '\n';
  }

  if (excess.length > 0) {
    response += `🟣 สต็อกเกิน (>90 วัน): ${excess.length} รายการ\n`;
  }

  response += `\n⚠️ ${disclaimer}`;

  return response;
}

function formatShortageRiskResponse(result: any): string {
  const { data, metadata, disclaimer } = result;

  if (!data?.risks || data.risks.length === 0) {
    return '✅ ไม่พบสินค้าที่มีความเสี่ยงขาดสต็อกในขณะนี้';
  }

  const { risks, summary } = data;

  let response = `📊 วิเคราะห์ความเสี่ยงขาดสต็อก (Shortage Risk)\n`;
  response += `📅 ข้อมูล: ${metadata.data_window.replace('last_', '').replace('_days', ' วันที่ผ่านมา')}\n`;
  response += `🎯 ความเชื่อมั่น: ${metadata.confidence_percent}% (${metadata.confidence_level})\n\n`;

  response += `สรุป:\n`;
  response += `- 🔴 วิกฤต: ${summary.critical_count} รายการ\n`;
  response += `- 🟠 สูง: ${summary.high_count} รายการ\n`;
  response += `- 🟡 ปานกลาง: ${summary.medium_count} รายการ\n\n`;

  if (risks.length > 0) {
    response += `รายละเอียด:\n`;
    risks.slice(0, 10).forEach((item: any, i: number) => {
      const icon = item.risk_level === 'critical' ? '🔴' : item.risk_level === 'high' ? '🟠' : '🟡';
      response += `${i + 1}. ${icon} ${item.sku_name}\n`;
      response += `   - คะแนนความเสี่ยง: ${item.risk_score}/100\n`;
      response += `   - สต็อก: ${item.current_stock.toLocaleString()} | ใช้: ${item.avg_daily_consumption.toFixed(1)}/วัน\n`;
      if (item.days_of_cover !== null) {
        response += `   - เหลือ: ~${item.days_of_cover} วัน\n`;
      }
      if (item.estimated_stockout_date) {
        response += `   - คาดว่าหมด: ${item.estimated_stockout_date}\n`;
      }
      response += `   - แนะนำ: ${item.recommended_action}\n\n`;
    });
  }

  response += `⚠️ ${disclaimer}`;

  return response;
}

function formatOverstockRiskResponse(result: any): string {
  const { data, metadata, disclaimer } = result;

  if (!data?.risks || data.risks.length === 0) {
    return '✅ ไม่พบสินค้าที่มีสต็อกเกินในขณะนี้';
  }

  const { risks, summary } = data;

  let response = `📊 วิเคราะห์ความเสี่ยงสต็อกเกิน (Overstock Risk)\n`;
  response += `📅 ข้อมูล: ${metadata.data_window.replace('last_', '').replace('_days', ' วันที่ผ่านมา')}\n`;
  response += `🎯 ความเชื่อมั่น: ${metadata.confidence_percent}% (${metadata.confidence_level})\n\n`;

  response += `สรุป:\n`;
  response += `- 🔴 วิกฤต: ${summary.critical_count} รายการ\n`;
  response += `- 🟠 สูง: ${summary.high_count} รายการ\n`;
  response += `- 🟡 ปานกลาง: ${summary.medium_count} รายการ\n`;
  response += `- สต็อกส่วนเกินรวม: ${summary.total_excess_qty.toLocaleString()} ชิ้น\n\n`;

  if (risks.length > 0) {
    response += `รายละเอียด:\n`;
    risks.slice(0, 10).forEach((item: any, i: number) => {
      const icon = item.risk_level === 'critical' ? '🔴' : item.risk_level === 'high' ? '🟠' : '🟡';
      response += `${i + 1}. ${icon} ${item.sku_name}\n`;
      response += `   - สต็อก: ${item.current_stock.toLocaleString()} ชิ้น\n`;
      response += `   - ส่วนเกิน: ${item.excess_qty.toLocaleString()} ชิ้น\n`;
      if (item.days_of_cover !== null) {
        response += `   - ใช้ได้: ~${item.days_of_cover} วัน\n`;
      }
      response += `   - ผลกระทบ: ${item.holding_cost_impact}\n`;
      response += `   - แนะนำ: ${item.recommended_action}\n\n`;
    });
  }

  response += `⚠️ ${disclaimer}`;

  return response;
}

function formatExpiryRiskResponse(result: any): string {
  const { data, metadata, disclaimer } = result;

  if (!data?.risks || data.risks.length === 0) {
    return '✅ ไม่พบสินค้าที่ใกล้หมดอายุในช่วงเวลาที่กำหนด';
  }

  const { risks, summary } = data;

  let response = `📊 วิเคราะห์ความเสี่ยงสินค้าหมดอายุ (Expiry Risk)\n`;
  response += `📅 ข้อมูล: ${metadata.data_window}\n`;
  response += `🎯 ความเชื่อมั่น: ${metadata.confidence_percent}% (${metadata.confidence_level})\n\n`;

  response += `สรุป:\n`;
  response += `- ⚫ หมดอายุแล้ว: ${summary.expired_count} รายการ (${summary.total_expired_qty.toLocaleString()} ชิ้น)\n`;
  response += `- 🔴 วิกฤต (≤7 วัน): ${summary.critical_count} รายการ\n`;
  response += `- 🟠 เตือน (≤30 วัน): ${summary.warning_count} รายการ\n`;
  response += `- จำนวนที่เสี่ยงหมดอายุก่อนใช้: ${summary.total_at_risk_qty.toLocaleString()} ชิ้น\n\n`;

  if (risks.length > 0) {
    response += `รายละเอียด:\n`;
    risks.slice(0, 10).forEach((item: any, i: number) => {
      const icon = item.risk_level === 'expired' ? '⚫' : item.risk_level === 'critical' ? '🔴' : '🟠';
      response += `${i + 1}. ${icon} ${item.sku_name}\n`;
      response += `   - วันหมดอายุ: ${item.expiry_date}`;
      if (item.days_until_expiry <= 0) {
        response += ` (หมดอายุแล้ว)\n`;
      } else {
        response += ` (อีก ${item.days_until_expiry} วัน)\n`;
      }
      response += `   - จำนวน: ${item.quantity.toLocaleString()} ชิ้น\n`;
      if (item.will_expire_before_consumed) {
        response += `   - ⚠️ คาดว่าจะหมดอายุก่อนใช้หมด\n`;
      }
      response += `   - แนะนำ: ${item.recommended_action}\n\n`;
    });
  }

  response += `⚠️ ${disclaimer}`;

  return response;
}

function formatUtilizationResponse(result: any): string {
  const { data, metadata, disclaimer } = result;

  if (!data?.summary) {
    return 'ไม่พบข้อมูลการใช้พื้นที่';
  }

  const { summary, warehouses, top_utilized_locations, empty_locations } = data;

  let response = `📊 วิเคราะห์การใช้พื้นที่คลังสินค้า (Utilization)\n`;
  response += `📅 ข้อมูล: ${metadata.data_window}\n`;
  response += `🎯 ความเชื่อมั่น: ${metadata.confidence_percent}% (${metadata.confidence_level})\n\n`;

  response += `สรุปภาพรวม:\n`;
  response += `- โลเคชั่นทั้งหมด: ${summary.total_locations} ตำแหน่ง\n`;
  response += `- อัตราการใช้งาน: ${summary.overall_utilization}%\n`;
  response += `- คะแนนสุขภาพ: ${summary.health_score}/100\n\n`;

  response += `สถานะโลเคชั่น:\n`;
  response += `- 🟢 ว่าง: ${summary.empty_count}\n`;
  response += `- 🔵 ต่ำ (<30%): ${summary.low_count}\n`;
  response += `- 🟢 เหมาะสม (30-80%): ${summary.optimal_count}\n`;
  response += `- 🟠 สูง (>80%): ${summary.high_count}\n`;
  response += `- 🔴 เต็ม (100%): ${summary.full_count}\n\n`;

  if (warehouses && warehouses.length > 0) {
    response += `ตามคลัง:\n`;
    warehouses.forEach((wh: any) => {
      response += `- ${wh.warehouse_name}: ${wh.utilization_percent}% (${wh.occupied_locations}/${wh.total_locations} ตำแหน่ง)\n`;
    });
    response += '\n';
  }

  if (summary.recommendations && summary.recommendations.length > 0) {
    response += `คำแนะนำ:\n`;
    summary.recommendations.forEach((rec: any, i: number) => {
      if (rec.type !== 'none') {
        response += `${i + 1}. ${rec.description}\n`;
        response += `   ${rec.potential_savings}\n`;
      }
    });
  }

  response += `\n⚠️ ${disclaimer}`;

  return response;
}

/**
 * Generate a greeting response
 */
export function generateGreeting(): string {
  return `ผมคือผู้ช่วย AI สำหรับระบบคลังสินค้า AustamGood WMS

ผมสามารถช่วยคุณได้เรื่อง:

📦 ข้อมูลพื้นฐาน:
- สต็อกและสินค้าคงคลัง (Stock Balance, Location, Lot, Expiry)
- ออเดอร์และการจัดส่ง (Order Status, Picking Progress)
- โลเคชั่นและพื้นที่จัดเก็บ (Warehouse Locations)
- การเคลื่อนไหวสต็อก (Movements: IN/OUT/Transfer)

📋 เอกสารและการดำเนินงาน:
- ใบปะหน้า (Face Sheets) และใบปะหน้าของแถม (Bonus Face Sheets)
- ใบโหลดสินค้า (Loadlists)
- การโอนย้ายสินค้า (Transfers)
- การปรับปรุงสต็อก (Stock Adjustments)
- คิวเติมสินค้า (Replenishment Queue)

🏭 การผลิต:
- แผนการผลิต (Production Plan)
- ใบเบิกวัตถุดิบ (Material Issues)

🚚 ข้อมูลหลัก:
- ซัพพลายเออร์ (Suppliers)
- รถขนส่ง (Vehicles)
- พื้นที่จัดเตรียม (Preparation Areas)

📊 วิเคราะห์เชิงลึก (Intelligence):
- อัตราการใช้สินค้า (Consumption Rate)
- จำนวนวันที่สต็อกจะใช้ได้ (Days of Cover)
- ความเสี่ยงขาดสต็อก (Shortage Risk)
- ความเสี่ยงสต็อกเกิน (Overstock Risk)
- ความเสี่ยงสินค้าหมดอายุ (Expiry Risk)
- การใช้พื้นที่คลัง (Utilization)

🔮 จำลองสถานการณ์ (What-If Simulation):
- จำลองความต้องการเพิ่มขึ้น (Demand Increase)
- จำลอง Lead Time เพิ่มขึ้น (Supplier Delay)
- จำลองพื้นที่ลดลง (Storage Reduction)
- จำลองกำลังคนเปลี่ยนแปลง (Shift Change)

ตัวอย่างคำถาม:
- "สต็อก B-NET-C|FHC|010 เหลือเท่าไร"
- "สินค้าไหนเสี่ยงขาดสต็อก"
- "วิเคราะห์สินค้าใกล้หมดอายุ"
- "การใช้พื้นที่คลังเป็นอย่างไร"
- "สรุป KPI วันนี้"
- "ถ้าความต้องการเพิ่ม 50% จะเป็นอย่างไร"
- "จำลองถ้าซัพพลายเออร์ส่งช้า 7 วัน"
- "ดูใบปะหน้าที่รอดำเนินการ"
- "สถานะใบโหลดวันนี้"
- "รถขนส่งว่างมีกี่คัน"`;
}

// ============================================
// Simulation Response Formatters (Phase 15-16)
// ============================================

export function formatSimulationResponse(toolName: string, result: any): string {
  if (!result || !result.success) {
    return `ขออภัยครับ ไม่สามารถจำลองสถานการณ์ได้\n\nข้อผิดพลาด: ${result?.error || 'Unknown error'}`;
  }

  switch (toolName) {
    case 'simulation_demand_increase':
      return formatDemandSimulationResponse(result);
    case 'simulation_lead_time_increase':
      return formatLeadTimeSimulationResponse(result);
    case 'simulation_storage_reduction':
      return formatStorageSimulationResponse(result);
    case 'simulation_shift_change':
      return formatShiftSimulationResponse(result);
    case 'simulation_compare':
      return formatComparisonResponse(result);
    case 'simulation_templates':
      return formatTemplatesResponse(result);
    default:
      return formatGenericSimulationResponse(result);
  }
}

function formatDemandSimulationResponse(result: any): string {
  const { data, metadata, disclaimer } = result;
  const { summary, kpi_delta, bottlenecks, risks } = data;

  let response = `🔮 จำลองสถานการณ์: ${data.scenario_name}\n\n`;
  
  response += `📊 ผลกระทบต่อ KPI:\n`;
  response += `- Throughput: ${summary.baseline_throughput.toLocaleString()} → ${summary.simulated_throughput.toLocaleString()} ชิ้น/วัน`;
  response += ` (${kpi_delta.throughput.percent_delta >= 0 ? '+' : ''}${kpi_delta.throughput.percent_delta.toFixed(1)}%)\n`;
  response += `- Utilization: ${summary.baseline_utilization.toFixed(1)}% → ${summary.simulated_utilization.toFixed(1)}%\n`;

  if (bottlenecks.length > 0) {
    response += `\n⚠️ Bottlenecks ที่พบ:\n`;
    bottlenecks.forEach((b: any, i: number) => {
      const icon = b.severity === 'critical' ? '🔴' : b.severity === 'high' ? '🟠' : '🟡';
      response += `${i + 1}. ${icon} ${b.resource_name} (${b.current_utilization.toFixed(1)}%)\n`;
    });
  }

  if (risks.length > 0) {
    response += `\n🚨 ความเสี่ยง:\n`;
    risks.forEach((r: any, i: number) => {
      const icon = r.risk_level === 'critical' ? '🔴' : r.risk_level === 'high' ? '🟠' : '🟡';
      response += `${i + 1}. ${icon} ${r.risk_type}: คะแนน ${r.risk_score}/100\n`;
    });
  }

  response += `\n📅 ข้อมูล: ${metadata.data_period}\n`;
  response += `🎯 ความเชื่อมั่น: ${metadata.confidence_level}\n`;
  response += `\n⚠️ ${disclaimer}`;

  return response;
}

function formatLeadTimeSimulationResponse(result: any): string {
  const { data, metadata, disclaimer } = result;
  const { summary, risks } = data;

  let response = `🔮 จำลองสถานการณ์: ${data.scenario_name}\n\n`;
  
  response += `📊 ผลกระทบ:\n`;
  response += `- Lead Time เฉลี่ย: ${summary.baseline_avg_lead_time} → ${summary.simulated_avg_lead_time} วัน\n`;
  response += `- ซัพพลายเออร์ที่มีความผันผวนสูง: ${summary.high_variability_suppliers} ราย\n`;

  if (risks.length > 0) {
    response += `\n🚨 ความเสี่ยง:\n`;
    risks.forEach((r: any, i: number) => {
      const icon = r.risk_level === 'critical' ? '🔴' : r.risk_level === 'high' ? '🟠' : '🟡';
      response += `${i + 1}. ${icon} ${r.risk_type}: คะแนน ${r.risk_score}/100\n`;
      if (r.mitigation_options?.length > 0) {
        response += `   แนะนำ: ${r.mitigation_options[0]}\n`;
      }
    });
  }

  response += `\n⚠️ ${disclaimer}`;

  return response;
}

function formatStorageSimulationResponse(result: any): string {
  const { data, metadata, disclaimer } = result;
  const { summary, kpi_delta, bottlenecks, risks } = data;

  let response = `🔮 จำลองสถานการณ์: ${data.scenario_name}\n\n`;
  
  response += `📊 ผลกระทบต่อพื้นที่:\n`;
  response += `- ความจุ: ${summary.baseline_capacity.toLocaleString()} → ${summary.simulated_capacity.toLocaleString()} ชิ้น\n`;
  response += `- Utilization: ${summary.baseline_utilization.toFixed(1)}% → ${summary.simulated_utilization.toFixed(1)}%\n`;
  
  if (summary.overflow_locations > 0) {
    response += `\n🔴 พื้นที่ล้น:\n`;
    response += `- โลเคชั่นที่ล้น: ${summary.overflow_locations} ตำแหน่ง\n`;
    response += `- จำนวนที่ล้น: ${summary.overflow_qty.toLocaleString()} ชิ้น\n`;
  }

  if (bottlenecks.length > 0) {
    response += `\n⚠️ Bottlenecks:\n`;
    bottlenecks.forEach((b: any, i: number) => {
      response += `${i + 1}. ${b.resource_name}: ${b.current_utilization.toFixed(1)}%\n`;
    });
  }

  response += `\n⚠️ ${disclaimer}`;

  return response;
}

function formatShiftSimulationResponse(result: any): string {
  const { data, metadata, disclaimer } = result;
  const { summary, kpi_delta, bottlenecks, risks } = data;

  let response = `🔮 จำลองสถานการณ์: ${data.scenario_name}\n\n`;
  
  response += `📊 ผลกระทบต่อกำลังคน:\n`;
  response += `- จำนวนพนักงาน: ${summary.baseline_headcount} → ${summary.simulated_headcount} คน\n`;
  response += `- ชั่วโมงต่อกะ: ${summary.baseline_hours_per_shift} → ${summary.simulated_hours_per_shift} ชม.\n`;
  response += `- ความจุ Picking: ${summary.baseline_picking_capacity.toLocaleString()} → ${summary.simulated_picking_capacity.toLocaleString()} ชิ้น/วัน\n`;

  if (bottlenecks.length > 0) {
    response += `\n⚠️ Bottlenecks:\n`;
    bottlenecks.forEach((b: any, i: number) => {
      response += `${i + 1}. ${b.resource_name}: ${b.current_utilization.toFixed(1)}%\n`;
    });
  }

  if (risks.length > 0) {
    response += `\n🚨 ความเสี่ยง:\n`;
    risks.forEach((r: any, i: number) => {
      response += `${i + 1}. ${r.risk_type}: คะแนน ${r.risk_score}/100\n`;
    });
  }

  response += `\n⚠️ ${disclaimer}`;

  return response;
}

function formatComparisonResponse(result: any): string {
  const { data, disclaimer } = result;
  const { scenarios, ranking, recommendation } = data;

  let response = `🔮 เปรียบเทียบ ${scenarios.length} สถานการณ์\n\n`;
  
  response += `📊 สรุปแต่ละสถานการณ์:\n`;
  scenarios.forEach((s: any, i: number) => {
    response += `\n${i + 1}. ${s.name} (${s.type})\n`;
    response += `   - Throughput: ${s.kpi_delta.throughput.percent_delta >= 0 ? '+' : ''}${s.kpi_delta.throughput.percent_delta.toFixed(1)}%\n`;
    response += `   - Utilization: ${s.kpi_delta.utilization.percent_delta >= 0 ? '+' : ''}${s.kpi_delta.utilization.percent_delta.toFixed(1)}%\n`;
    response += `   - Bottlenecks: ${s.bottleneck_count}, Risks: ${s.risk_count}\n`;
  });

  response += `\n🏆 อันดับ:\n`;
  response += `- ความจุสูงสุด: ${ranking.by_capacity[0]}\n`;
  response += `- ความเสี่ยงต่ำสุด: ${ranking.by_risk[0]}\n`;

  response += `\n💡 ${recommendation}\n`;
  response += `\n⚠️ ${disclaimer}`;

  return response;
}

function formatTemplatesResponse(result: any): string {
  const { data } = result;
  const { templates } = data;

  let response = `🔮 Scenario Templates ที่พร้อมใช้งาน:\n\n`;
  
  templates.forEach((t: any, i: number) => {
    response += `${i + 1}. ${t.name_th} (${t.name})\n`;
    response += `   ${t.description_th}\n`;
    response += `   ใช้สำหรับ: ${t.typical_use_case_th}\n\n`;
  });

  response += `💡 ลองถาม:\n`;
  response += `- "จำลองช่วงพีค" (Peak Season)\n`;
  response += `- "จำลองซัพพลายเออร์ล่าช้า" (Supplier Delay)\n`;
  response += `- "จำลองพื้นที่ลดลง 20%" (Space Constraint)\n`;

  return response;
}

function formatGenericSimulationResponse(result: any): string {
  const { data, disclaimer } = result;
  return `🔮 ผลการจำลอง:\n${JSON.stringify(data, null, 2)}\n\n⚠️ ${disclaimer}`;
}

// ============================================
// Direct Database Query Functions
// ============================================

/**
 * Direct query: Stock Balance
 */
async function executeStockBalanceQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 100, 500);

  let query = supabase
    .from('wms_inventory_balances')
    .select(
      `
      balance_id,
      warehouse_id,
      location_id,
      sku_id,
      pallet_id,
      lot_no,
      production_date,
      expiry_date,
      total_pack_qty,
      total_piece_qty,
      reserved_pack_qty,
      reserved_piece_qty,
      master_location!location_id (
        location_name,
        zone
      ),
      master_sku!sku_id (
        sku_name
      ),
      master_warehouse!warehouse_id (
        warehouse_name
      )
    `
    )
    .gt('total_piece_qty', 0)
    .order('updated_at', { ascending: false })
    .limit(limit);

  // Apply filters
  if (args.sku_id) {
    if (args.sku_id.includes('%')) {
      query = query.ilike('sku_id', args.sku_id);
    } else {
      query = query.eq('sku_id', args.sku_id);
    }
  }

  if (args.location_id) {
    query = query.eq('location_id', args.location_id);
  }

  if (args.warehouse_id) {
    query = query.eq('warehouse_id', args.warehouse_id);
  }

  const { data: balances, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  // Transform data
  const today = new Date();
  const transformedData = (balances || []).map((b: any) => {
    const location = b.master_location as any;
    const sku = b.master_sku as any;
    const warehouse = b.master_warehouse as any;

    const totalPiece = Number(b.total_piece_qty) || 0;
    const reservedPiece = Number(b.reserved_piece_qty) || 0;

    return {
      sku_id: b.sku_id,
      sku_name: sku?.sku_name || b.sku_id,
      location_id: b.location_id,
      location_name: location?.location_name || b.location_id,
      warehouse_id: b.warehouse_id,
      warehouse_name: warehouse?.warehouse_name || b.warehouse_id,
      zone: location?.zone || null,
      pallet_id: b.pallet_id,
      lot_no: b.lot_no,
      production_date: b.production_date,
      expiry_date: b.expiry_date,
      total_piece_qty: totalPiece,
      reserved_piece_qty: reservedPiece,
      available_piece_qty: Math.max(0, totalPiece - reservedPiece),
      total_pack_qty: Number(b.total_pack_qty) || 0,
      is_expired: b.expiry_date ? new Date(b.expiry_date) < today : false,
    };
  });

  // Calculate summary
  const uniqueSkus = new Set(transformedData.map((d: any) => d.sku_id));
  const uniqueLocations = new Set(transformedData.map((d: any) => d.location_id));

  const summary = {
    total_items: transformedData.length,
    total_piece_qty: transformedData.reduce(
      (sum: number, d: any) => sum + d.total_piece_qty,
      0
    ),
    total_reserved_qty: transformedData.reduce(
      (sum: number, d: any) => sum + d.reserved_piece_qty,
      0
    ),
    total_available_qty: transformedData.reduce(
      (sum: number, d: any) => sum + d.available_piece_qty,
      0
    ),
    unique_skus: uniqueSkus.size,
    unique_locations: uniqueLocations.size,
  };

  return {
    data: {
      success: true,
      data: transformedData,
      summary,
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Order Status
 */
async function executeOrderStatusQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  console.log(`[AI Chat] executeOrderStatusQuery called with args:`, args);

  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  // Query orders - use only columns that exist in wms_orders
  let query = supabase
    .from('wms_orders')
    .select(
      `
      order_id,
      order_no,
      status,
      delivery_date,
      total_qty,
      total_items,
      customer_id,
      shop_name,
      province
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.order_code) {
    // Support partial match for order numbers
    console.log(`[AI Chat] Filtering by order_code: ${args.order_code}`);
    query = query.ilike('order_no', `%${args.order_code}%`);
  }

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: orders, error } = await query;

  console.log(
    `[AI Chat] Order query result: ${orders?.length || 0} orders, error: ${error?.message || 'none'}`
  );

  if (error) {
    return { data: null, error: error.message };
  }

  // Get customer names separately if needed
  const customerIds = [
    ...new Set((orders || []).map((o: any) => o.customer_id).filter(Boolean)),
  ];
  let customerMap: Record<string, string> = {};

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('master_customer')
      .select('customer_id, customer_name')
      .in('customer_id', customerIds);

    if (customers) {
      customerMap = Object.fromEntries(
        customers.map((c: any) => [c.customer_id, c.customer_name])
      );
    }
  }

  const statusThai: Record<string, string> = {
    draft: 'ร่าง',
    confirmed: 'ยืนยันแล้ว',
    in_picking: 'กำลังจัด',
    picked: 'จัดเสร็จ',
    loaded: 'โหลดแล้ว',
    in_transit: 'กำลังส่ง',
    delivered: 'ส่งแล้ว',
  };

  const transformedData = (orders || []).map((o: any) => {
    return {
      order_id: o.order_id,
      order_no: o.order_no,
      status: o.status,
      status_thai: statusThai[o.status] || o.status,
      delivery_date: o.delivery_date,
      total_qty: o.total_qty || 0,
      total_items: o.total_items || 0,
      total_amount: 0, // Not available in schema
      pick_progress_percent: 0, // Not available in schema
      customer_name: customerMap[o.customer_id] || null,
      shop_name: o.shop_name,
      province: o.province,
    };
  });

  // Calculate summary
  const byStatus: Record<string, number> = {};
  transformedData.forEach((o: any) => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  const summary = {
    total_orders: transformedData.length,
    total_qty: transformedData.reduce(
      (sum: number, o: any) => sum + o.total_qty,
      0
    ),
    total_items: transformedData.reduce(
      (sum: number, o: any) => sum + o.total_items,
      0
    ),
    by_status: byStatus,
  };

  return {
    data: {
      success: true,
      data: transformedData,
      summary,
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Warehouse Locations
 */
async function executeWarehouseLocationsQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 100, 500);

  const { data: locations, error } = await supabase
    .from('master_location')
    .select('*')
    .eq('is_active', true)
    .limit(limit);

  if (error) {
    return { data: null, error: error.message };
  }

  const transformedData = (locations || []).map((loc: any) => ({
    location_id: loc.location_id,
    location_name: loc.location_name,
    zone: loc.zone,
    warehouse_id: loc.warehouse_id,
    max_capacity: loc.max_capacity || 0,
    current_qty: 0,
    utilization_percent: 0,
  }));

  const summary = {
    total_locations: transformedData.length,
    occupied_locations: 0,
    avg_utilization_percent: 0,
    total_capacity: transformedData.reduce(
      (sum: number, l: any) => sum + l.max_capacity,
      0
    ),
    total_used: 0,
    by_zone: {},
  };

  return {
    data: {
      success: true,
      data: transformedData,
      summary,
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Stock Movements
 */
async function executeStockMovementsQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 100, 500);

  const { data: movements, error } = await supabase
    .from('wms_inventory_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { data: null, error: error.message };
  }

  let totalIn = 0;
  let totalOut = 0;

  (movements || []).forEach((m: any) => {
    const qty = Number(m.piece_qty) || 0;
    if (qty > 0) totalIn += qty;
    else totalOut += Math.abs(qty);
  });

  const summary = {
    total_movements: (movements || []).length,
    total_in_qty: totalIn,
    total_out_qty: totalOut,
    net_qty: totalIn - totalOut,
    by_type: {},
  };

  return {
    data: {
      success: true,
      data: movements || [],
      summary,
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: KPI
 */
async function executeKPIQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();

  // Get order counts
  const { data: orders } = await supabase
    .from('wms_orders')
    .select('status, total_qty, total_amount')
    .limit(1000);

  const orderStats = {
    total: (orders || []).length,
    completed: (orders || []).filter((o: any) => o.status === 'delivered')
      .length,
    in_progress: (orders || []).filter((o: any) =>
      ['in_picking', 'picked', 'loaded', 'in_transit'].includes(o.status)
    ).length,
    pending: (orders || []).filter((o: any) =>
      ['draft', 'confirmed'].includes(o.status)
    ).length,
  };

  // Get inventory summary
  const { data: inventory } = await supabase
    .from('wms_inventory_balances')
    .select('total_piece_qty, reserved_piece_qty')
    .gt('total_piece_qty', 0);

  const inventoryStats = {
    total_qty: (inventory || []).reduce(
      (sum: number, i: any) => sum + (Number(i.total_piece_qty) || 0),
      0
    ),
    reserved_qty: (inventory || []).reduce(
      (sum: number, i: any) => sum + (Number(i.reserved_piece_qty) || 0),
      0
    ),
    locations_count: (inventory || []).length,
  };

  const today = new Date();
  const dateFrom = new Date(today);
  dateFrom.setDate(dateFrom.getDate() - 7);

  return {
    data: {
      success: true,
      data: {
        period: {
          date_from: dateFrom.toISOString().split('T')[0],
          date_to: today.toISOString().split('T')[0],
          days_in_period: 7,
        },
        throughput: {
          total_received_qty: 0,
          total_shipped_qty: 0,
          avg_daily_received: 0,
          avg_daily_shipped: 0,
          receiving_orders_count: 0,
          shipping_orders_count: orderStats.total,
        },
        efficiency: {
          orders_completed: orderStats.completed,
          orders_in_progress: orderStats.in_progress,
          orders_pending: orderStats.pending,
          completion_rate:
            orderStats.total > 0
              ? Math.round((orderStats.completed / orderStats.total) * 100)
              : 0,
        },
        inventory: inventoryStats,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Consumption
 */
async function executeConsumptionQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const periodDays = args.period_days || 30;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - periodDays);

  const { data: movements, error } = await supabase
    .from('wms_inventory_ledger')
    .select('sku_id, piece_qty, created_at')
    .lt('piece_qty', 0)
    .gte('created_at', dateFrom.toISOString())
    .limit(1000);

  if (error) {
    return { data: null, error: error.message };
  }

  // Aggregate by SKU
  const skuConsumption: Record<string, number> = {};
  (movements || []).forEach((m: any) => {
    const qty = Math.abs(Number(m.piece_qty) || 0);
    skuConsumption[m.sku_id] = (skuConsumption[m.sku_id] || 0) + qty;
  });

  const data = Object.entries(skuConsumption)
    .map(([sku_id, total_qty]) => ({
      sku_id,
      sku_name: sku_id,
      total_outbound_qty: total_qty,
      avg_daily_consumption: Math.round(total_qty / periodDays),
      current_stock: 0,
      estimated_days_of_cover: null,
      confidence: 'medium',
      data_points: 1,
    }))
    .slice(0, 20);

  return {
    data: {
      success: true,
      data,
      summary: {
        period_days: periodDays,
        total_skus_analyzed: data.length,
        total_outbound_qty: Object.values(skuConsumption).reduce(
          (a, b) => a + b,
          0
        ),
        avg_daily_outbound: Math.round(
          Object.values(skuConsumption).reduce((a, b) => a + b, 0) / periodDays
        ),
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Shortage Risk
 */
async function executeShortageRiskQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();

  const { data: lowStock } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, total_piece_qty, reserved_piece_qty')
    .gt('total_piece_qty', 0)
    .lt('total_piece_qty', 100)
    .limit(20);

  const data = (lowStock || []).map((item: any) => ({
    sku_id: item.sku_id,
    current_stock: item.total_piece_qty,
    risk_level: item.total_piece_qty < 50 ? 'high' : 'medium',
    risk_score: item.total_piece_qty < 50 ? 80 : 50,
  }));

  return {
    data: {
      success: true,
      data,
      summary: {
        total_at_risk: data.length,
        high_risk_count: data.filter((d: any) => d.risk_level === 'high').length,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Overstock Risk
 */
async function executeOverstockRiskQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();

  const { data: highStock } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, total_piece_qty')
    .gt('total_piece_qty', 1000)
    .limit(20);

  const data = (highStock || []).map((item: any) => ({
    sku_id: item.sku_id,
    current_stock: item.total_piece_qty,
    risk_level: item.total_piece_qty > 5000 ? 'high' : 'medium',
    risk_score: item.total_piece_qty > 5000 ? 70 : 40,
  }));

  return {
    data: {
      success: true,
      data,
      summary: {
        total_overstock: data.length,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Expiry Risk
 */
async function executeExpiryRiskQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data: expiring } = await supabase
    .from('wms_inventory_balances')
    .select('sku_id, total_piece_qty, expiry_date')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', thirtyDaysFromNow.toISOString())
    .gt('total_piece_qty', 0)
    .limit(20);

  const today = new Date();
  const data = (expiring || []).map((item: any) => {
    const expiryDate = new Date(item.expiry_date);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      sku_id: item.sku_id,
      current_stock: item.total_piece_qty,
      expiry_date: item.expiry_date,
      days_until_expiry: daysUntilExpiry,
      risk_level:
        daysUntilExpiry <= 7
          ? 'critical'
          : daysUntilExpiry <= 14
            ? 'high'
            : 'medium',
    };
  });

  return {
    data: {
      success: true,
      data,
      summary: {
        total_expiring: data.length,
        critical_count: data.filter((d: any) => d.risk_level === 'critical')
          .length,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Utilization
 */
async function executeUtilizationQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('master_location')
    .select('location_id, location_name, zone, max_capacity')
    .eq('is_active', true)
    .limit(100);

  const totalCapacity = (locations || []).reduce(
    (sum: number, l: any) => sum + (l.max_capacity || 0),
    0
  );

  return {
    data: {
      success: true,
      data: {
        total_locations: (locations || []).length,
        total_capacity: totalCapacity,
        current_utilization_percent: 0,
        by_zone: {},
      },
      summary: {
        overall_utilization: 0,
        zones_analyzed: 0,
      },
      timestamp: new Date().toISOString(),
    },
  };
}


// ============================================
// New Query Functions - Phase B Enhancement
// ============================================

/**
 * Direct query: Transfers
 */
async function executeTransfersQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('wms_moves')
    .select(`
      move_id,
      move_no,
      status,
      created_at,
      completed_at,
      wms_move_items (
        sku_id,
        from_location_id,
        to_location_id,
        quantity
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: transfers, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    draft: 'ร่าง',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
  };

  const transformedData = (transfers || []).map((t: any) => ({
    move_id: t.move_id,
    move_no: t.move_no,
    status: t.status,
    status_thai: statusThai[t.status] || t.status,
    created_at: t.created_at,
    completed_at: t.completed_at,
    items_count: t.wms_move_items?.length || 0,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((t: any) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_transfers: transformedData.length,
        by_status: byStatus,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Stock Adjustments
 */
async function executeStockAdjustmentsQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('wms_stock_adjustments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: adjustments, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    draft: 'ร่าง',
    pending_approval: 'รออนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    completed: 'เสร็จสิ้น',
  };

  const transformedData = (adjustments || []).map((a: any) => ({
    adjustment_id: a.id,
    adjustment_no: a.adjustment_no,
    status: a.status,
    status_thai: statusThai[a.status] || a.status,
    adjustment_type: a.adjustment_type,
    reason: a.reason,
    created_at: a.created_at,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((a: any) => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_adjustments: transformedData.length,
        by_status: byStatus,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Face Sheets
 */
async function executeFaceSheetsQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('face_sheets')
    .select(`
      id,
      face_sheet_no,
      status,
      picklist_id,
      order_id,
      created_at,
      completed_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: faceSheets, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    pending: 'รอดำเนินการ',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
  };

  const transformedData = (faceSheets || []).map((f: any) => ({
    face_sheet_id: f.id,
    face_sheet_no: f.face_sheet_no,
    status: f.status,
    status_thai: statusThai[f.status] || f.status,
    picklist_id: f.picklist_id,
    order_id: f.order_id,
    created_at: f.created_at,
    completed_at: f.completed_at,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((f: any) => {
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_face_sheets: transformedData.length,
        by_status: byStatus,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Bonus Face Sheets
 */
async function executeBonusFaceSheetsQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('bonus_face_sheets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: bonusFaceSheets, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    pending: 'รอดำเนินการ',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
  };

  const transformedData = (bonusFaceSheets || []).map((b: any) => ({
    bonus_face_sheet_id: b.id,
    status: b.status,
    status_thai: statusThai[b.status] || b.status,
    order_id: b.order_id,
    created_at: b.created_at,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((b: any) => {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_bonus_face_sheets: transformedData.length,
        by_status: byStatus,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Loadlists
 */
async function executeLoadlistsQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_no,
      status,
      vehicle_id,
      route_plan_id,
      loading_door,
      created_at,
      departed_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: loadlists, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    draft: 'ร่าง',
    ready: 'พร้อมโหลด',
    loading: 'กำลังโหลด',
    loaded: 'โหลดเสร็จ',
    departed: 'ออกเดินทางแล้ว',
  };

  const transformedData = (loadlists || []).map((l: any) => ({
    loadlist_id: l.id,
    loadlist_no: l.loadlist_no,
    status: l.status,
    status_thai: statusThai[l.status] || l.status,
    vehicle_id: l.vehicle_id,
    route_plan_id: l.route_plan_id,
    loading_door: l.loading_door,
    created_at: l.created_at,
    departed_at: l.departed_at,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((l: any) => {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_loadlists: transformedData.length,
        by_status: byStatus,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Replenishment Queue
 */
async function executeReplenishmentQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('replenishment_queue')
    .select(`
      id,
      status,
      priority,
      sku_id,
      from_location_id,
      to_location_id,
      requested_qty,
      completed_qty,
      pallet_id,
      created_at,
      completed_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  if (args.priority) {
    query = query.eq('priority', args.priority);
  }

  const { data: queue, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    pending: 'รอดำเนินการ',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
  };

  const priorityThai: Record<string, string> = {
    low: 'ต่ำ',
    medium: 'ปานกลาง',
    high: 'สูง',
    urgent: 'ด่วน',
  };

  const transformedData = (queue || []).map((q: any) => ({
    queue_id: q.id,
    status: q.status,
    status_thai: statusThai[q.status] || q.status,
    priority: q.priority,
    priority_thai: priorityThai[q.priority] || q.priority,
    sku_id: q.sku_id,
    from_location_id: q.from_location_id,
    to_location_id: q.to_location_id,
    requested_qty: q.requested_qty,
    completed_qty: q.completed_qty,
    pallet_id: q.pallet_id,
    created_at: q.created_at,
    completed_at: q.completed_at,
  }));

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  transformedData.forEach((q: any) => {
    byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    byPriority[q.priority] = (byPriority[q.priority] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_queue: transformedData.length,
        by_status: byStatus,
        by_priority: byPriority,
        total_requested_qty: transformedData.reduce((sum: number, q: any) => sum + (q.requested_qty || 0), 0),
        total_completed_qty: transformedData.reduce((sum: number, q: any) => sum + (q.completed_qty || 0), 0),
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Production Plan
 */
async function executeProductionPlanQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('production_plan')
    .select('*')
    .order('plan_date', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: plans, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    draft: 'ร่าง',
    approved: 'อนุมัติแล้ว',
    in_progress: 'กำลังดำเนินการ',
    completed: 'เสร็จสิ้น',
  };

  const transformedData = (plans || []).map((p: any) => ({
    plan_id: p.id,
    plan_no: p.plan_no,
    status: p.status,
    status_thai: statusThai[p.status] || p.status,
    sku_id: p.sku_id,
    planned_qty: p.planned_qty,
    actual_qty: p.actual_qty || 0,
    plan_date: p.plan_date,
    created_at: p.created_at,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((p: any) => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_plans: transformedData.length,
        by_status: byStatus,
        total_planned_qty: transformedData.reduce((sum: number, p: any) => sum + (p.planned_qty || 0), 0),
        total_actual_qty: transformedData.reduce((sum: number, p: any) => sum + (p.actual_qty || 0), 0),
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Material Issues
 */
async function executeMaterialIssuesQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('material_issues')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: issues, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    draft: 'ร่าง',
    pending: 'รอดำเนินการ',
    issued: 'เบิกแล้ว',
    cancelled: 'ยกเลิก',
  };

  const transformedData = (issues || []).map((i: any) => ({
    issue_id: i.id,
    issue_no: i.issue_no,
    status: i.status,
    status_thai: statusThai[i.status] || i.status,
    production_order_id: i.production_order_id,
    sku_id: i.sku_id,
    requested_qty: i.requested_qty,
    issued_qty: i.issued_qty || 0,
    created_at: i.created_at,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((i: any) => {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_issues: transformedData.length,
        by_status: byStatus,
        total_requested_qty: transformedData.reduce((sum: number, i: any) => sum + (i.requested_qty || 0), 0),
        total_issued_qty: transformedData.reduce((sum: number, i: any) => sum + (i.issued_qty || 0), 0),
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Suppliers
 */
async function executeSuppliersQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('master_supplier')
    .select('*')
    .limit(limit);

  if (args.is_active !== undefined) {
    query = query.eq('is_active', args.is_active);
  }

  const { data: suppliers, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const transformedData = (suppliers || []).map((s: any) => ({
    supplier_id: s.supplier_id,
    supplier_name: s.supplier_name,
    contact_name: s.contact_name,
    phone: s.phone,
    email: s.email,
    address: s.address,
    is_active: s.is_active,
  }));

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_suppliers: transformedData.length,
        active_suppliers: transformedData.filter((s: any) => s.is_active).length,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Vehicles
 */
async function executeVehiclesQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  let query = supabase
    .from('master_vehicle')
    .select('*')
    .limit(limit);

  if (args.status) {
    query = query.eq('status', args.status);
  }

  const { data: vehicles, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  const statusThai: Record<string, string> = {
    available: 'ว่าง',
    in_use: 'กำลังใช้งาน',
    maintenance: 'ซ่อมบำรุง',
  };

  const transformedData = (vehicles || []).map((v: any) => ({
    vehicle_id: v.vehicle_id,
    plate_number: v.plate_number,
    vehicle_type: v.vehicle_type,
    status: v.status,
    status_thai: statusThai[v.status] || v.status,
    capacity_kg: v.capacity_kg,
    driver_name: v.driver_name,
    driver_phone: v.driver_phone,
    supplier_id: v.supplier_id,
  }));

  const byStatus: Record<string, number> = {};
  transformedData.forEach((v: any) => {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
  });

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_vehicles: transformedData.length,
        by_status: byStatus,
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Direct query: Preparation Areas
 */
async function executePreparationAreasQuery(
  args: Record<string, any>
): Promise<{ data: any; error?: string }> {
  const supabase = await createClient();
  const limit = Math.min(args.limit || 50, 200);

  // Query preparation areas from master_location with preparation_area field
  const { data: areas, error } = await supabase
    .from('master_location')
    .select('preparation_area, zone, is_active')
    .not('preparation_area', 'is', null)
    .limit(limit);

  if (error) {
    return { data: null, error: error.message };
  }

  // Group by preparation_area
  const areaMap: Record<string, { count: number; zones: Set<string> }> = {};
  (areas || []).forEach((a: any) => {
    if (!areaMap[a.preparation_area]) {
      areaMap[a.preparation_area] = { count: 0, zones: new Set() };
    }
    areaMap[a.preparation_area].count++;
    if (a.zone) {
      areaMap[a.preparation_area].zones.add(a.zone);
    }
  });

  const transformedData = Object.entries(areaMap).map(([area_code, data]) => ({
    area_code,
    total_locations: data.count,
    zones: Array.from(data.zones),
  }));

  return {
    data: {
      success: true,
      data: transformedData,
      summary: {
        total_areas: transformedData.length,
        total_locations: transformedData.reduce((sum, a) => sum + a.total_locations, 0),
      },
      query_params: args,
      timestamp: new Date().toISOString(),
    },
  };
}
