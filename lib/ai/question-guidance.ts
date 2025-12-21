/**
 * AI Question Guidance
 * Guides users to ask questions the system CAN answer
 * 
 * When data is missing, AI MUST:
 * 1. Explain what data is missing
 * 2. Explain WHY the system cannot answer
 * 3. Suggest SPECIFIC alternative questions the system CAN answer
 */

import { 
  AVAILABLE_DATA, 
  NOT_AVAILABLE_DATA, 
  DERIVED_CALCULATIONS,
  checkDataAvailability,
  type DataAvailability 
} from './data-contract';

// ============================================
// Question Categories
// ============================================

export interface QuestionTemplate {
  id: string;
  question: string;
  questionThai: string;
  canAnswer: boolean;
  requiredData: string[];
  missingData?: string[];
  alternativeQuestions?: AlternativeQuestion[];
  apiEndpoint?: string;
  exampleResponse?: string;
}

export interface AlternativeQuestion {
  question: string;
  questionThai: string;
  reason: string;
  reasonThai: string;
}

export interface GuidanceResponse {
  canAnswer: boolean;
  explanation: string;
  explanationThai: string;
  missingData?: string[];
  alternatives?: AlternativeQuestion[];
  suggestedQuestions?: string[];
}

// ============================================
// HIGH-VALUE Questions Matrix
// ============================================

export const QUESTION_MATRIX: Record<string, QuestionTemplate[]> = {
  // === STOCK QUERIES (CAN ANSWER) ===
  stock_answerable: [
    {
      id: 'stock_balance',
      question: 'What is the current stock balance?',
      questionThai: 'สต็อกคงเหลือเท่าไร?',
      canAnswer: true,
      requiredData: ['total_piece_qty', 'reserved_piece_qty', 'sku_id'],
      apiEndpoint: '/api/ai/stock/balance',
      exampleResponse: 'สต็อก SKU-001 คงเหลือ 1,250 ชิ้น (สำรอง 300, พร้อมใช้ 950)',
    },
    {
      id: 'stock_by_location',
      question: 'Where is this SKU stored?',
      questionThai: 'สินค้านี้เก็บอยู่ที่ไหน?',
      canAnswer: true,
      requiredData: ['sku_id', 'location_id', 'total_piece_qty'],
      apiEndpoint: '/api/ai/stock/balance',
    },
    {
      id: 'stock_by_expiry',
      question: 'Which items are expiring soon?',
      questionThai: 'สินค้าไหนใกล้หมดอายุ?',
      canAnswer: true,
      requiredData: ['sku_id', 'expiry_date', 'total_piece_qty'],
      apiEndpoint: '/api/ai/stock/balance',
    },
    {
      id: 'stock_reservation',
      question: 'How much stock is reserved?',
      questionThai: 'สต็อกถูกสำรองไว้เท่าไร?',
      canAnswer: true,
      requiredData: ['reserved_piece_qty', 'total_piece_qty'],
      apiEndpoint: '/api/ai/stock/balance',
    },
  ],

  // === STOCK QUERIES (CANNOT ANSWER) ===
  stock_not_answerable: [
    {
      id: 'days_of_cover',
      question: 'How many days of stock do we have?',
      questionThai: 'สต็อกใช้ได้อีกกี่วัน?',
      canAnswer: false,
      requiredData: ['total_piece_qty', 'daily_consumption_rate'],
      missingData: ['daily_consumption_rate'],
      alternativeQuestions: [
        {
          question: 'What is the current stock balance?',
          questionThai: 'สต็อกคงเหลือปัจจุบันเท่าไร?',
          reason: 'We have current stock data but not consumption rate',
          reasonThai: 'ระบบมีข้อมูลสต็อกปัจจุบัน แต่ไม่มีข้อมูลอัตราการใช้',
        },
        {
          question: 'What was the outbound movement in the last 7 days?',
          questionThai: 'การจ่ายออก 7 วันที่ผ่านมาเป็นอย่างไร?',
          reason: 'Movement history can indicate usage patterns',
          reasonThai: 'ประวัติการเคลื่อนไหวสามารถบ่งบอกรูปแบบการใช้งานได้',
        },
      ],
    },
    {
      id: 'consumption_rate',
      question: 'What is the daily consumption rate?',
      questionThai: 'อัตราการใช้ต่อวันเท่าไร?',
      canAnswer: false,
      requiredData: ['daily_consumption_rate'],
      missingData: ['daily_consumption_rate'],
      alternativeQuestions: [
        {
          question: 'What was the total outbound in the last 30 days?',
          questionThai: 'ยอดจ่ายออกรวม 30 วันที่ผ่านมาเท่าไร?',
          reason: 'We can show historical outbound data',
          reasonThai: 'ระบบสามารถแสดงข้อมูลการจ่ายออกย้อนหลังได้',
        },
      ],
    },
    {
      id: 'shortage_risk',
      question: 'Which SKUs are at risk of shortage?',
      questionThai: 'สินค้าไหนเสี่ยงขาดสต็อก?',
      canAnswer: false,
      requiredData: ['total_piece_qty', 'daily_consumption_rate', 'reorder_point', 'supplier_lead_time'],
      missingData: ['daily_consumption_rate', 'supplier_lead_time'],
      alternativeQuestions: [
        {
          question: 'Which SKUs have stock below reorder point?',
          questionThai: 'สินค้าไหนต่ำกว่าจุดสั่งซื้อ?',
          reason: 'We can compare current stock vs reorder_point from master_sku',
          reasonThai: 'ระบบสามารถเปรียบเทียบสต็อกปัจจุบันกับ reorder_point ได้',
        },
        {
          question: 'Which SKUs have high reservation percentage?',
          questionThai: 'สินค้าไหนมีอัตราการสำรองสูง?',
          reason: 'High reservation may indicate potential shortage',
          reasonThai: 'การสำรองสูงอาจบ่งบอกถึงความเสี่ยงขาดสต็อก',
        },
      ],
    },
    {
      id: 'overstock_risk',
      question: 'Which SKUs are overstocked?',
      questionThai: 'สินค้าไหน Overstock?',
      canAnswer: false,
      requiredData: ['total_piece_qty', 'daily_consumption_rate', 'max_stock_level'],
      missingData: ['daily_consumption_rate', 'max_stock_level'],
      alternativeQuestions: [
        {
          question: 'Which SKUs have the highest stock quantity?',
          questionThai: 'สินค้าไหนมีสต็อกมากที่สุด?',
          reason: 'We can rank by current stock quantity',
          reasonThai: 'ระบบสามารถจัดอันดับตามจำนวนสต็อกได้',
        },
        {
          question: 'Which SKUs have low movement in the last 30 days?',
          questionThai: 'สินค้าไหนเคลื่อนไหวน้อยใน 30 วันที่ผ่านมา?',
          reason: 'Low movement with high stock may indicate overstock',
          reasonThai: 'การเคลื่อนไหวน้อยแต่สต็อกสูงอาจบ่งบอก Overstock',
        },
      ],
    },
  ],

  // === ORDER QUERIES (CAN ANSWER) ===
  order_answerable: [
    {
      id: 'order_status',
      question: 'What is the status of order X?',
      questionThai: 'สถานะออเดอร์ X เป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['order_no', 'status', 'delivery_date'],
      apiEndpoint: '/api/ai/orders/status',
    },
    {
      id: 'orders_by_status',
      question: 'How many orders are in each status?',
      questionThai: 'มีออเดอร์กี่รายการในแต่ละสถานะ?',
      canAnswer: true,
      requiredData: ['status', 'order_id'],
      apiEndpoint: '/api/ai/orders/status',
    },
    {
      id: 'pick_progress',
      question: 'What is the picking progress?',
      questionThai: 'ความคืบหน้าการจัดเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['order_qty', 'picked_qty'],
      apiEndpoint: '/api/ai/orders/status',
    },
    {
      id: 'delayed_orders',
      question: 'Which orders are delayed?',
      questionThai: 'ออเดอร์ไหนล่าช้า?',
      canAnswer: true,
      requiredData: ['delivery_date', 'status'],
      apiEndpoint: '/api/ai/orders/status',
    },
  ],

  // === LOCATION QUERIES (CAN ANSWER) ===
  location_answerable: [
    {
      id: 'location_utilization',
      question: 'What is the warehouse utilization?',
      questionThai: 'อัตราการใช้พื้นที่คลังเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['current_qty', 'max_capacity_qty'],
      apiEndpoint: '/api/ai/warehouse/locations',
    },
    {
      id: 'empty_locations',
      question: 'Which locations are empty?',
      questionThai: 'โลเคชั่นไหนว่าง?',
      canAnswer: true,
      requiredData: ['location_id', 'current_qty'],
      apiEndpoint: '/api/ai/warehouse/locations',
    },
    {
      id: 'location_by_zone',
      question: 'How many locations in each zone?',
      questionThai: 'แต่ละโซนมีกี่โลเคชั่น?',
      canAnswer: true,
      requiredData: ['zone', 'location_id'],
      apiEndpoint: '/api/ai/warehouse/locations',
    },
  ],

  // === MOVEMENT QUERIES (CAN ANSWER) ===
  movement_answerable: [
    {
      id: 'movement_history',
      question: 'What is the movement history?',
      questionThai: 'ประวัติการเคลื่อนไหวเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['movement_at', 'transaction_type', 'piece_qty', 'direction'],
      apiEndpoint: '/api/ai/stock/movements',
    },
    {
      id: 'inbound_outbound',
      question: 'What is the inbound vs outbound?',
      questionThai: 'รับเข้า vs จ่ายออกเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['direction', 'piece_qty'],
      apiEndpoint: '/api/ai/stock/movements',
    },
  ],

  // === KPI QUERIES (CAN ANSWER) ===
  kpi_answerable: [
    {
      id: 'kpi_summary',
      question: 'What is the KPI summary?',
      questionThai: 'สรุป KPI เป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['throughput', 'efficiency', 'utilization'],
      apiEndpoint: '/api/ai/analytics/kpi',
    },
    {
      id: 'throughput',
      question: 'What is the throughput?',
      questionThai: 'Throughput เป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['total_received_qty', 'total_shipped_qty'],
      apiEndpoint: '/api/ai/analytics/kpi',
    },
  ],

  // === PRODUCTIVITY QUERIES (CANNOT ANSWER) ===
  productivity_not_answerable: [
    {
      id: 'picks_per_hour',
      question: 'What is the picks per hour?',
      questionThai: 'จำนวน Pick ต่อชั่วโมงเท่าไร?',
      canAnswer: false,
      requiredData: ['pick_timestamp', 'employee_id'],
      missingData: ['pick_timestamp'],
      alternativeQuestions: [
        {
          question: 'How many orders were completed today?',
          questionThai: 'วันนี้จัดเสร็จกี่ออเดอร์?',
          reason: 'We can count completed orders',
          reasonThai: 'ระบบสามารถนับจำนวนออเดอร์ที่เสร็จได้',
        },
      ],
    },
    {
      id: 'employee_productivity',
      question: 'What is the employee productivity?',
      questionThai: 'ประสิทธิภาพพนักงานเป็นอย่างไร?',
      canAnswer: false,
      requiredData: ['employee_id', 'task_count', 'task_duration'],
      missingData: ['task_duration'],
      alternativeQuestions: [
        {
          question: 'How many tasks were completed by each employee?',
          questionThai: 'พนักงานแต่ละคนทำงานเสร็จกี่รายการ?',
          reason: 'We can count tasks but not measure time',
          reasonThai: 'ระบบนับจำนวนงานได้ แต่ไม่มีข้อมูลเวลา',
        },
      ],
    },
  ],

  // === EXPIRY QUERIES ===
  expiry_answerable: [
    {
      id: 'expiring_soon',
      question: 'Which items are expiring within 30 days?',
      questionThai: 'สินค้าไหนจะหมดอายุใน 30 วัน?',
      canAnswer: true,
      requiredData: ['expiry_date', 'sku_id', 'total_piece_qty'],
      apiEndpoint: '/api/ai/stock/balance',
    },
    {
      id: 'expired_items',
      question: 'Which items are already expired?',
      questionThai: 'สินค้าไหนหมดอายุแล้ว?',
      canAnswer: true,
      requiredData: ['expiry_date', 'sku_id', 'total_piece_qty'],
      apiEndpoint: '/api/ai/stock/balance',
    },
  ],

  // === TRANSFER QUERIES (Phase B Enhancement) ===
  transfer_answerable: [
    {
      id: 'transfer_status',
      question: 'What is the transfer status?',
      questionThai: 'สถานะการโอนย้ายเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['move_id', 'status', 'from_location_id', 'to_location_id'],
      apiEndpoint: '/api/ai/transfers/status',
    },
    {
      id: 'pending_transfers',
      question: 'How many transfers are pending?',
      questionThai: 'มีการโอนย้ายที่รอดำเนินการกี่รายการ?',
      canAnswer: true,
      requiredData: ['move_id', 'status'],
      apiEndpoint: '/api/ai/transfers/status',
    },
    {
      id: 'transfer_history',
      question: 'What is the transfer history?',
      questionThai: 'ประวัติการโอนย้ายเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['move_id', 'status', 'created_at'],
      apiEndpoint: '/api/ai/transfers/status',
    },
  ],

  // === STOCK ADJUSTMENT QUERIES (Phase B Enhancement) ===
  adjustment_answerable: [
    {
      id: 'adjustment_status',
      question: 'What is the stock adjustment status?',
      questionThai: 'สถานะการปรับสต็อกเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['adjustment_id', 'status', 'adjustment_type'],
      apiEndpoint: '/api/ai/adjustments/history',
    },
    {
      id: 'pending_adjustments',
      question: 'How many adjustments are pending approval?',
      questionThai: 'มีใบปรับสต็อกที่รออนุมัติกี่ใบ?',
      canAnswer: true,
      requiredData: ['adjustment_id', 'status'],
      apiEndpoint: '/api/ai/adjustments/history',
    },
    {
      id: 'adjustment_history',
      question: 'What is the adjustment history today?',
      questionThai: 'ประวัติการปรับสต็อกวันนี้เป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['adjustment_id', 'status', 'created_at'],
      apiEndpoint: '/api/ai/adjustments/history',
    },
  ],

  // === FACE SHEET QUERIES (Phase B Enhancement) ===
  face_sheet_answerable: [
    {
      id: 'face_sheet_status',
      question: 'What is the face sheet status?',
      questionThai: 'สถานะใบปะหน้าเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['face_sheet_id', 'status', 'order_id'],
      apiEndpoint: '/api/ai/face-sheets/status',
    },
    {
      id: 'pending_face_sheets',
      question: 'How many face sheets are pending?',
      questionThai: 'มีใบปะหน้าที่รอจัดกี่ใบ?',
      canAnswer: true,
      requiredData: ['face_sheet_id', 'status'],
      apiEndpoint: '/api/ai/face-sheets/status',
    },
  ],

  // === LOADLIST QUERIES (Phase B Enhancement) ===
  loadlist_answerable: [
    {
      id: 'loadlist_status',
      question: 'What is the loadlist status?',
      questionThai: 'สถานะใบโหลดเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['loadlist_id', 'status', 'vehicle_id'],
      apiEndpoint: '/api/ai/loadlists/status',
    },
    {
      id: 'ready_loadlists',
      question: 'How many loadlists are ready for loading?',
      questionThai: 'มีใบโหลดที่พร้อมโหลดกี่ใบ?',
      canAnswer: true,
      requiredData: ['loadlist_id', 'status'],
      apiEndpoint: '/api/ai/loadlists/status',
    },
  ],

  // === REPLENISHMENT QUERIES (Phase B Enhancement) ===
  replenishment_answerable: [
    {
      id: 'replenishment_queue',
      question: 'What is in the replenishment queue?',
      questionThai: 'คิวเติมสินค้ามีอะไรบ้าง?',
      canAnswer: true,
      requiredData: ['queue_id', 'status', 'sku_id', 'requested_qty'],
      apiEndpoint: '/api/ai/replenishment/queue',
    },
    {
      id: 'urgent_replenishment',
      question: 'Which items need urgent replenishment?',
      questionThai: 'สินค้าไหนต้องเติมด่วน?',
      canAnswer: true,
      requiredData: ['queue_id', 'priority', 'sku_id'],
      apiEndpoint: '/api/ai/replenishment/queue',
    },
  ],

  // === PRODUCTION PLAN QUERIES (Phase B Enhancement) ===
  production_plan_answerable: [
    {
      id: 'production_plan_status',
      question: 'What is the production plan status?',
      questionThai: 'สถานะแผนผลิตเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['plan_id', 'status', 'planned_qty'],
      apiEndpoint: '/api/ai/production/plan',
    },
    {
      id: 'weekly_production_plan',
      question: 'What is the production plan this week?',
      questionThai: 'แผนผลิตสัปดาห์นี้เป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['plan_id', 'plan_date', 'planned_qty'],
      apiEndpoint: '/api/ai/production/plan',
    },
  ],

  // === MATERIAL ISSUE QUERIES (Phase B Enhancement) ===
  material_issue_answerable: [
    {
      id: 'material_issue_status',
      question: 'What is the material issue status?',
      questionThai: 'สถานะการเบิกวัตถุดิบเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['issue_id', 'status', 'requested_qty'],
      apiEndpoint: '/api/ai/materials/issues',
    },
    {
      id: 'pending_material_issues',
      question: 'How many material issues are pending?',
      questionThai: 'มีใบเบิกวัตถุดิบที่รอดำเนินการกี่ใบ?',
      canAnswer: true,
      requiredData: ['issue_id', 'status'],
      apiEndpoint: '/api/ai/materials/issues',
    },
  ],

  // === SUPPLIER QUERIES (Phase B Enhancement) ===
  supplier_answerable: [
    {
      id: 'supplier_info',
      question: 'What is the supplier information?',
      questionThai: 'ข้อมูลซัพพลายเออร์เป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['supplier_id', 'supplier_name', 'contact_name'],
      apiEndpoint: '/api/ai/suppliers/info',
    },
    {
      id: 'active_suppliers',
      question: 'How many active suppliers are there?',
      questionThai: 'มีซัพพลายเออร์ที่ใช้งานกี่ราย?',
      canAnswer: true,
      requiredData: ['supplier_id', 'is_active'],
      apiEndpoint: '/api/ai/suppliers/info',
    },
  ],

  // === VEHICLE QUERIES (Phase B Enhancement) ===
  vehicle_answerable: [
    {
      id: 'vehicle_status',
      question: 'What is the vehicle status?',
      questionThai: 'สถานะรถเป็นอย่างไร?',
      canAnswer: true,
      requiredData: ['vehicle_id', 'status', 'plate_number'],
      apiEndpoint: '/api/ai/vehicles/status',
    },
    {
      id: 'available_vehicles',
      question: 'Which vehicles are available?',
      questionThai: 'รถคันไหนว่าง?',
      canAnswer: true,
      requiredData: ['vehicle_id', 'status'],
      apiEndpoint: '/api/ai/vehicles/status',
    },
  ],
};

// ============================================
// Guidance Generator
// ============================================

export function generateGuidance(
  questionType: string,
  missingFields: string[]
): GuidanceResponse {
  // Find the question template
  for (const [category, questions] of Object.entries(QUESTION_MATRIX)) {
    const template = questions.find(q => q.id === questionType);
    if (template) {
      if (template.canAnswer) {
        return {
          canAnswer: true,
          explanation: `This question can be answered using ${template.apiEndpoint}`,
          explanationThai: `คำถามนี้สามารถตอบได้โดยใช้ข้อมูลจาก ${template.apiEndpoint}`,
        };
      } else {
        return {
          canAnswer: false,
          explanation: `Cannot answer because missing: ${template.missingData?.join(', ')}`,
          explanationThai: `ไม่สามารถตอบได้เนื่องจากไม่มีข้อมูล: ${template.missingData?.join(', ')}`,
          missingData: template.missingData,
          alternatives: template.alternativeQuestions,
        };
      }
    }
  }

  return {
    canAnswer: false,
    explanation: 'Question type not recognized',
    explanationThai: 'ไม่รู้จักประเภทคำถามนี้',
    suggestedQuestions: [
      'สต็อกคงเหลือเท่าไร?',
      'สถานะออเดอร์เป็นอย่างไร?',
      'สรุป KPI วันนี้',
    ],
  };
}

// ============================================
// Response Templates for Missing Data
// ============================================

export const MISSING_DATA_RESPONSES: Record<string, {
  explanation: string;
  explanationThai: string;
  alternatives: string[];
  alternativesThai: string[];
}> = {
  daily_consumption_rate: {
    explanation: 'The system does not track daily consumption rate directly.',
    explanationThai: 'ระบบไม่ได้เก็บข้อมูลอัตราการใช้ต่อวันโดยตรง',
    alternatives: [
      'View outbound movement history for the last 7/30 days',
      'Check current stock balance',
    ],
    alternativesThai: [
      'ดูประวัติการจ่ายออก 7/30 วันที่ผ่านมา',
      'ดูสต็อกคงเหลือปัจจุบัน',
    ],
  },
  supplier_lead_time: {
    explanation: 'Supplier lead time is not stored in the system.',
    explanationThai: 'ระบบไม่ได้เก็บข้อมูล Lead time จาก Supplier',
    alternatives: [
      'Check receiving history to estimate lead time',
      'View pending purchase orders',
    ],
    alternativesThai: [
      'ดูประวัติการรับสินค้าเพื่อประมาณ Lead time',
      'ดูใบสั่งซื้อที่รอรับ',
    ],
  },
  demand_forecast: {
    explanation: 'The system does not have demand forecasting capability.',
    explanationThai: 'ระบบไม่มีความสามารถในการพยากรณ์ความต้องการ',
    alternatives: [
      'View historical order patterns',
      'Check current order backlog',
    ],
    alternativesThai: [
      'ดูรูปแบบออเดอร์ย้อนหลัง',
      'ดูออเดอร์ที่รอดำเนินการ',
    ],
  },
  unit_cost: {
    explanation: 'Unit cost is not stored in the SKU master.',
    explanationThai: 'ระบบไม่ได้เก็บข้อมูลต้นทุนต่อหน่วย',
    alternatives: [
      'View stock quantity only',
    ],
    alternativesThai: [
      'ดูจำนวนสต็อกเท่านั้น',
    ],
  },
  picks_per_hour: {
    explanation: 'Pick timestamps are not tracked at granular level.',
    explanationThai: 'ระบบไม่ได้เก็บเวลาการ Pick ในระดับละเอียด',
    alternatives: [
      'View completed orders count',
      'View picking progress',
    ],
    alternativesThai: [
      'ดูจำนวนออเดอร์ที่เสร็จ',
      'ดูความคืบหน้าการจัด',
    ],
  },
};

// ============================================
// Smart Question Suggester
// ============================================

export function suggestAlternativeQuestions(
  originalQuestion: string,
  detectedIntent: string
): string[] {
  const suggestions: string[] = [];

  // Map intent to answerable questions
  const intentMapping: Record<string, string[]> = {
    days_of_cover: [
      'สต็อกคงเหลือปัจจุบันเท่าไร?',
      'การจ่ายออก 7 วันที่ผ่านมาเป็นอย่างไร?',
      'สินค้าไหนมีอัตราการสำรองสูง?',
    ],
    consumption_rate: [
      'ยอดจ่ายออกรวม 30 วันที่ผ่านมาเท่าไร?',
      'ประวัติการเคลื่อนไหวสต็อกเป็นอย่างไร?',
    ],
    shortage_risk: [
      'สินค้าไหนต่ำกว่าจุดสั่งซื้อ?',
      'สินค้าไหนมีอัตราการสำรองสูง?',
      'สต็อกพร้อมใช้งานเหลือเท่าไร?',
    ],
    overstock_risk: [
      'สินค้าไหนมีสต็อกมากที่สุด?',
      'สินค้าไหนเคลื่อนไหวน้อยใน 30 วันที่ผ่านมา?',
    ],
    productivity: [
      'วันนี้จัดเสร็จกี่ออเดอร์?',
      'ความคืบหน้าการจัดเป็นอย่างไร?',
    ],
    forecast: [
      'ออเดอร์ที่รอดำเนินการมีกี่รายการ?',
      'ประวัติออเดอร์ 30 วันที่ผ่านมาเป็นอย่างไร?',
    ],
  };

  return intentMapping[detectedIntent] || [
    'สต็อกคงเหลือเท่าไร?',
    'สถานะออเดอร์เป็นอย่างไร?',
    'สรุป KPI วันนี้',
  ];
}

// ============================================
// Format Guidance Response
// ============================================

export function formatGuidanceResponse(guidance: GuidanceResponse): string {
  if (guidance.canAnswer) {
    return ''; // No guidance needed
  }

  let response = `ขออภัยครับ ระบบไม่สามารถตอบคำถามนี้ได้\n\n`;
  response += `เหตุผล: ${guidance.explanationThai}\n\n`;

  if (guidance.missingData && guidance.missingData.length > 0) {
    response += `ข้อมูลที่ขาด:\n`;
    guidance.missingData.forEach(field => {
      const missingInfo = MISSING_DATA_RESPONSES[field];
      if (missingInfo) {
        response += `- ${field}: ${missingInfo.explanationThai}\n`;
      } else {
        response += `- ${field}\n`;
      }
    });
    response += `\n`;
  }

  if (guidance.alternatives && guidance.alternatives.length > 0) {
    response += `คำถามที่ระบบสามารถตอบได้แทน:\n`;
    guidance.alternatives.forEach((alt, index) => {
      response += `${index + 1}. "${alt.questionThai}"\n`;
      response += `   (${alt.reasonThai})\n`;
    });
  } else if (guidance.suggestedQuestions && guidance.suggestedQuestions.length > 0) {
    response += `ลองถามคำถามเหล่านี้แทน:\n`;
    guidance.suggestedQuestions.forEach((q, index) => {
      response += `${index + 1}. "${q}"\n`;
    });
  }

  return response;
}
