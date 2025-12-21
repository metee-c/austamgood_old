/**
 * AI Safety Guardrails
 * Ensures AI responses are safe, accurate, and appropriate
 * 
 * RULES:
 * 1. Never make assumptions without data
 * 2. Always acknowledge data limitations
 * 3. Role-based access control
 * 4. Token optimization
 * 5. Audit logging
 */

// ============================================
// Types
// ============================================

export interface UserRole {
  role_id: number;
  role_name: string;
  permissions: string[];
}

export interface GuardrailConfig {
  maxResponseLength: number;
  maxDataItems: number;
  allowedTopics: string[];
  restrictedTopics: string[];
  requireDataCitation: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedMessage?: string;
}

export interface AIInteractionLog {
  timestamp: string;
  session_id?: string;
  user_id?: string;
  user_role?: string;
  message: string;
  intent_detected: string[];
  tools_called: string[];
  response_length: number;
  data_points_used: number;
  processing_time_ms: number;
  success: boolean;
  error?: string;
}

// ============================================
// Role-Based Access Control
// ============================================

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // All access
  manager: [
    'stock_view', 'stock_analysis',
    'order_view', 'order_analysis',
    'kpi_view', 'kpi_analysis',
    'location_view',
    'movement_view',
    'employee_view',
  ],
  supervisor: [
    'stock_view',
    'order_view',
    'location_view',
    'movement_view',
  ],
  operator: [
    'stock_view_limited', // Only assigned locations
    'order_view_limited', // Only assigned orders
    'location_view_limited',
  ],
  viewer: [
    'stock_view_summary',
    'order_view_summary',
    'kpi_view_summary',
  ],
};

const TOPIC_PERMISSIONS: Record<string, string[]> = {
  query_stock_balance: ['stock_view', 'stock_view_limited', 'stock_view_summary'],
  query_stock_movements: ['movement_view', 'stock_view'],
  query_order_status: ['order_view', 'order_view_limited', 'order_view_summary'],
  query_warehouse_locations: ['location_view', 'location_view_limited'],
  query_kpi: ['kpi_view', 'kpi_view_summary', 'kpi_analysis'],
  query_employee_activity: ['employee_view'],
  // New tools - Phase B Enhancement
  query_transfers: ['movement_view', 'stock_view'],
  query_stock_adjustments: ['stock_view', 'stock_analysis'],
  query_face_sheets: ['order_view', 'order_view_limited'],
  query_bonus_face_sheets: ['order_view', 'order_view_limited'],
  query_loadlists: ['order_view', 'order_view_limited'],
  query_replenishment: ['stock_view', 'movement_view'],
  query_production_plan: ['kpi_view', 'kpi_analysis'],
  query_material_issues: ['stock_view', 'movement_view'],
  query_suppliers: ['stock_view', 'stock_view_summary'],
  query_vehicles: ['order_view', 'order_view_summary'],
  query_preparation_areas: ['location_view', 'location_view_limited'],
};

export function checkPermission(
  userRole: string,
  topic: string
): { allowed: boolean; reason?: string } {
  const rolePerms = ROLE_PERMISSIONS[userRole] || [];
  
  // Admin has all access
  if (rolePerms.includes('*')) {
    return { allowed: true };
  }

  const requiredPerms = TOPIC_PERMISSIONS[topic] || [];
  
  // Check if user has any of the required permissions
  const hasPermission = requiredPerms.some(perm => rolePerms.includes(perm));
  
  if (!hasPermission) {
    return {
      allowed: false,
      reason: `คุณไม่มีสิทธิ์เข้าถึงข้อมูล ${topic} กรุณาติดต่อผู้ดูแลระบบ`,
    };
  }

  return { allowed: true };
}

export function filterDataByRole(
  data: any[],
  userRole: string,
  dataType: string
): any[] {
  // Admin and manager see all
  if (['admin', 'manager'].includes(userRole)) {
    return data;
  }

  // Supervisor sees all but limited detail
  if (userRole === 'supervisor') {
    return data.map(item => {
      // Remove sensitive fields
      const { created_by, created_by_name, ...rest } = item;
      return rest;
    });
  }

  // Operator sees limited data
  if (userRole === 'operator') {
    // Limit to 20 items
    return data.slice(0, 20);
  }

  // Viewer sees summary only
  if (userRole === 'viewer') {
    return data.slice(0, 5);
  }

  return data;
}

// ============================================
// Input Validation
// ============================================

const BLOCKED_PATTERNS = [
  /delete\s+from/i,
  /drop\s+table/i,
  /truncate/i,
  /update\s+.*\s+set/i,
  /insert\s+into/i,
  /<script>/i,
  /javascript:/i,
  /on\w+\s*=/i,
];

const MAX_MESSAGE_LENGTH = 1000;
const MIN_MESSAGE_LENGTH = 2;

export function validateInput(message: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check length
  if (!message || message.trim().length < MIN_MESSAGE_LENGTH) {
    errors.push('ข้อความสั้นเกินไป กรุณาพิมพ์คำถามให้ชัดเจน');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`ข้อความยาวเกินไป (สูงสุด ${MAX_MESSAGE_LENGTH} ตัวอักษร)`);
  }

  // Check for blocked patterns (SQL injection, XSS, etc.)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      errors.push('ข้อความมีรูปแบบที่ไม่อนุญาต');
      break;
    }
  }

  // Sanitize message
  let sanitizedMessage = message
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, MAX_MESSAGE_LENGTH);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedMessage,
  };
}

// ============================================
// Response Guardrails
// ============================================

const INSUFFICIENT_DATA_RESPONSES = {
  no_data: 'ไม่พบข้อมูลตามเงื่อนไขที่ระบุ กรุณาตรวจสอบพารามิเตอร์หรือลองค้นหาใหม่',
  api_error: 'ไม่สามารถดึงข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
  insufficient_data: 'ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์ที่แม่นยำ',
  permission_denied: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้',
};

export function generateSafeResponse(
  data: any,
  dataType: string,
  userRole: string
): { response: string; warnings: string[] } {
  const warnings: string[] = [];

  // Check if data is empty
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return {
      response: INSUFFICIENT_DATA_RESPONSES.no_data,
      warnings: ['ไม่พบข้อมูล'],
    };
  }

  // Check data quality
  if (Array.isArray(data) && data.length < 5) {
    warnings.push('⚠️ ข้อมูลจำกัด - ผลการวิเคราะห์อาจไม่ครอบคลุม');
  }

  // Add role-based disclaimer
  if (userRole === 'viewer') {
    warnings.push('📋 แสดงข้อมูลสรุปเท่านั้น');
  } else if (userRole === 'operator') {
    warnings.push('📋 แสดงข้อมูลบางส่วน');
  }

  return {
    response: '', // Will be filled by formatter
    warnings,
  };
}

// ============================================
// Token Optimization
// ============================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Approximate token count (1 token ≈ 4 characters for English, 2 for Thai)
export function estimateTokens(text: string): number {
  // Count Thai characters
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const otherChars = text.length - thaiChars;
  
  // Thai: ~2 chars per token, Other: ~4 chars per token
  return Math.ceil(thaiChars / 2) + Math.ceil(otherChars / 4);
}

export function optimizePrompt(prompt: string, maxTokens: number = 2000): string {
  const currentTokens = estimateTokens(prompt);
  
  if (currentTokens <= maxTokens) {
    return prompt;
  }

  // Truncate from the middle, keeping start and end
  const targetLength = Math.floor(prompt.length * (maxTokens / currentTokens));
  const keepStart = Math.floor(targetLength * 0.6);
  const keepEnd = Math.floor(targetLength * 0.4);
  
  return prompt.substring(0, keepStart) + 
    '\n...[ข้อมูลบางส่วนถูกตัดออก]...\n' + 
    prompt.substring(prompt.length - keepEnd);
}

export function calculateTokenUsage(
  inputText: string,
  outputText: string
): TokenUsage {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const totalTokens = inputTokens + outputTokens;
  
  // Estimated cost (example: $0.002 per 1K tokens)
  const estimatedCost = (totalTokens / 1000) * 0.002;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
  };
}

// ============================================
// Audit Logging
// ============================================

const interactionLogs: AIInteractionLog[] = [];
const MAX_LOG_SIZE = 1000;

export function logInteraction(log: AIInteractionLog): void {
  // Add to in-memory log
  interactionLogs.push(log);
  
  // Trim if too large
  if (interactionLogs.length > MAX_LOG_SIZE) {
    interactionLogs.splice(0, interactionLogs.length - MAX_LOG_SIZE);
  }

  // Console log for debugging
  console.log(`[AI Audit] ${log.timestamp} | User: ${log.user_id || 'anonymous'} | Role: ${log.user_role || 'unknown'} | Intent: ${log.intent_detected.join(', ')} | Success: ${log.success}`);
}

export function getRecentLogs(count: number = 100): AIInteractionLog[] {
  return interactionLogs.slice(-count);
}

export function getLogStats(): {
  totalInteractions: number;
  successRate: number;
  avgProcessingTime: number;
  topIntents: Record<string, number>;
  errorRate: number;
} {
  if (interactionLogs.length === 0) {
    return {
      totalInteractions: 0,
      successRate: 0,
      avgProcessingTime: 0,
      topIntents: {},
      errorRate: 0,
    };
  }

  const successCount = interactionLogs.filter(l => l.success).length;
  const totalTime = interactionLogs.reduce((sum, l) => sum + l.processing_time_ms, 0);
  
  const intentCounts: Record<string, number> = {};
  interactionLogs.forEach(l => {
    l.intent_detected.forEach(intent => {
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });
  });

  return {
    totalInteractions: interactionLogs.length,
    successRate: Math.round((successCount / interactionLogs.length) * 100),
    avgProcessingTime: Math.round(totalTime / interactionLogs.length),
    topIntents: intentCounts,
    errorRate: Math.round(((interactionLogs.length - successCount) / interactionLogs.length) * 100),
  };
}

// ============================================
// Response Templates
// ============================================

export const SAFE_RESPONSES = {
  greeting: `ผมคือผู้ช่วย AI สำหรับระบบคลังสินค้า AustamGood WMS

ผมสามารถช่วยคุณได้เรื่อง:
- สต็อกและสินค้าคงคลัง (Stock Balance, Location, Lot, Expiry)
- ออเดอร์และการจัดส่ง (Order Status, Picking Progress)
- โลเคชั่นและพื้นที่จัดเก็บ (Warehouse Locations, Utilization)
- การเคลื่อนไหวสต็อก (Movements: IN/OUT/Transfer)
- KPI และประสิทธิภาพ (Throughput, Efficiency, Utilization)

ตัวอย่างคำถาม:
- "สต็อก B-NET-C|FHC|010 เหลือเท่าไร"
- "ออเดอร์ SO-2025-0001 สถานะอะไร"
- "สรุป KPI วันนี้"`,

  outOfScope: `ขออภัยครับ คำถามนี้อยู่นอกเหนือขอบเขตของระบบคลังสินค้า

ผมสามารถตอบได้เฉพาะเรื่อง:
- สต็อก, สินค้าคงคลัง, โลเคชั่น
- ออเดอร์, การจัด, การจัดส่ง
- การเคลื่อนไหวสต็อก (รับ/จ่าย/โอน)
- KPI และประสิทธิภาพคลัง

กรุณาถามคำถามที่เกี่ยวข้องกับคลังสินค้าครับ`,

  noData: `ไม่พบข้อมูลตามเงื่อนไขที่ระบุ

กรุณาตรวจสอบ:
- รหัสสินค้า/ออเดอร์ถูกต้องหรือไม่
- ช่วงวันที่ที่ระบุ
- เงื่อนไขการค้นหา

หรือลองค้นหาด้วยเงื่อนไขอื่นครับ`,

  error: `เกิดข้อผิดพลาดในการดึงข้อมูล

กรุณาลองใหม่อีกครั้ง หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบ`,

  permissionDenied: `คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้

กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เพิ่มเติม`,

  dataLimitation: `ข้อมูลที่แสดงอาจไม่ครบถ้วน เนื่องจาก:
- ข้อมูลในช่วงเวลาที่ระบุมีจำกัด
- มีการจำกัดจำนวนผลลัพธ์

หากต้องการข้อมูลเพิ่มเติม กรุณาระบุเงื่อนไขให้ชัดเจนขึ้น`,

  insufficientData: `ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์ที่ร้องขอ

ระบบสามารถตอบได้เฉพาะคำถามที่มีข้อมูลรองรับจาก API เท่านั้น
ผมไม่สามารถคาดเดาหรือประมาณการได้`,

  cannotPredict: `ผมไม่สามารถพยากรณ์หรือคาดการณ์ได้โดยไม่มีข้อมูล Forecast

สิ่งที่ผมสามารถตอบได้แทน:
- สต็อกคงเหลือปัจจุบัน
- ประวัติการเคลื่อนไหวย้อนหลัง
- สถานะออเดอร์ปัจจุบัน`,
};

// ============================================
// Main Guardrail Check
// ============================================

export interface GuardrailCheckResult {
  passed: boolean;
  message?: string;
  warnings: string[];
  sanitizedInput?: string;
  userRole: string;
  allowedTools: string[];
}

export function performGuardrailCheck(
  message: string,
  userRole: string = 'viewer',
  detectedTools: string[] = []
): GuardrailCheckResult {
  const warnings: string[] = [];

  // 1. Validate input
  const inputValidation = validateInput(message);
  if (!inputValidation.isValid) {
    return {
      passed: false,
      message: inputValidation.errors.join('\n'),
      warnings: inputValidation.warnings,
      userRole,
      allowedTools: [],
    };
  }

  // 2. Check permissions for each detected tool
  const allowedTools: string[] = [];
  const deniedTools: string[] = [];

  for (const tool of detectedTools) {
    const permCheck = checkPermission(userRole, tool);
    if (permCheck.allowed) {
      allowedTools.push(tool);
    } else {
      deniedTools.push(tool);
      warnings.push(permCheck.reason || `ไม่มีสิทธิ์ใช้ ${tool}`);
    }
  }

  // If all tools are denied
  if (detectedTools.length > 0 && allowedTools.length === 0) {
    return {
      passed: false,
      message: SAFE_RESPONSES.permissionDenied,
      warnings,
      sanitizedInput: inputValidation.sanitizedMessage,
      userRole,
      allowedTools: [],
    };
  }

  return {
    passed: true,
    warnings,
    sanitizedInput: inputValidation.sanitizedMessage,
    userRole,
    allowedTools,
  };
}
