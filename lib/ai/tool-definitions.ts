/**
 * WMS AI Assistant - Tool/Function Definitions
 * Version: 1.0
 * Purpose: Define all available tools for LLM function calling
 */

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const AI_TOOLS: AITool[] = [
  // STOCK & INVENTORY TOOLS
  {
    name: 'query_stock_balance',
    description: 'Query current stock levels, locations, and availability. Use this to check how much stock is available for any SKU.',
    parameters: {
      type: 'object',
      properties: {
        sku_id: {
          type: 'string',
          description: 'SKU identifier (e.g., "B-BEY-C|MNB|010"). Leave empty to query all SKUs.',
        },
        location_id: {
          type: 'string',
          description: 'Location identifier (e.g., "A01-01-001"). Filter by specific location.',
        },
        warehouse_id: {
          type: 'string',
          description: 'Warehouse identifier to filter results.',
        },
        zone: {
          type: 'string',
          description: 'Zone within warehouse (e.g., "A09", "PK001").',
        },
        lot_no: {
          type: 'string',
          description: 'Lot number for batch tracking.',
        },
        include_reserved: {
          type: 'boolean',
          description: 'Include reserved stock in results. Default: true',
          default: true,
        },
        include_expired: {
          type: 'boolean',
          description: 'Include expired stock in results. Default: false',
          default: false,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 50',
          default: 50,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_stock_movements',
    description: 'Track stock movement history (IN/OUT/TRANSFER). Use this to see how stock has been moving.',
    parameters: {
      type: 'object',
      properties: {
        sku_id: {
          type: 'string',
          description: 'Filter by specific SKU.',
        },
        location_id: {
          type: 'string',
          description: 'Filter by location.',
        },
        movement_type: {
          type: 'string',
          enum: ['IN', 'OUT', 'TRANSFER', 'ADJUST'],
          description: 'Type of movement: IN (receive), OUT (pick/ship), TRANSFER (move), ADJUST (adjustment).',
        },
        date_from: {
          type: 'string',
          format: 'date',
          description: 'Start date for filtering (YYYY-MM-DD).',
        },
        date_to: {
          type: 'string',
          format: 'date',
          description: 'End date for filtering (YYYY-MM-DD).',
        },
        reference_type: {
          type: 'string',
          enum: ['RECEIVE', 'PICK', 'MOVE', 'ADJUST', 'PRODUCTION'],
          description: 'Type of reference document.',
        },
        limit: {
          type: 'number',
          default: 100,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_forecast',
    description: 'Get production planning forecast with demand analysis. Use this to determine what needs to be produced.',
    parameters: {
      type: 'object',
      properties: {
        sku_id: {
          type: 'string',
          description: 'Specific SKU to forecast.',
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Filter by priority level (critical = needs immediate production).',
        },
        sub_category: {
          type: 'string',
          description: 'Product sub-category (e.g., "แมว", "สุนัข").',
        },
        days_of_supply_max: {
          type: 'number',
          description: 'Maximum days of supply threshold (e.g., 7 to find items with less than 7 days stock).',
        },
      },
      required: [],
    },
  },

  // WAREHOUSE & LOCATION TOOLS
  {
    name: 'query_warehouse_locations',
    description: 'Query warehouse location details and capacity. Use this to find locations or check capacity.',
    parameters: {
      type: 'object',
      properties: {
        warehouse_id: {
          type: 'string',
          description: 'Filter by warehouse.',
        },
        zone: {
          type: 'string',
          description: 'Filter by zone.',
        },
        location_type: {
          type: 'string',
          enum: ['STORAGE', 'DISPATCH', 'RECEIVING', 'PRODUCTION'],
          description: 'Type of location.',
        },
        search: {
          type: 'string',
          description: 'Search by location code or name.',
        },
        available_only: {
          type: 'boolean',
          description: 'Show only locations with available space.',
          default: false,
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_warehouse_utilization',
    description: 'Check warehouse capacity and space utilization. Use this for space management questions.',
    parameters: {
      type: 'object',
      properties: {
        warehouse_id: {
          type: 'string',
          description: 'Specific warehouse to check.',
        },
        zone: {
          type: 'string',
          description: 'Specific zone within warehouse.',
        },
      },
      required: [],
    },
  },

  // ORDER & FULFILLMENT TOOLS
  {
    name: 'query_order_status',
    description: 'Track order lifecycle and current status. Use this to check where an order is in the process.',
    parameters: {
      type: 'object',
      properties: {
        order_code: {
          type: 'string',
          description: 'Order code (e.g., "ORD-2025-001").',
        },
        customer_code: {
          type: 'string',
          description: 'Customer code to filter orders.',
        },
        order_type: {
          type: 'string',
          enum: ['express', 'special', 'general'],
          description: 'Type of order.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'confirmed', 'in_picking', 'picked', 'loaded', 'in_transit', 'delivered'],
          description: 'Current order status.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_picklists',
    description: 'Get picking operation status and progress. Use this to check picking status.',
    parameters: {
      type: 'object',
      properties: {
        picklist_id: {
          type: 'number',
          description: 'Specific picklist ID.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'assigned', 'picking', 'completed'],
          description: 'Picklist status.',
        },
        employee_id: {
          type: 'number',
          description: 'Filter by assigned employee.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  // RECEIVING TOOLS
  {
    name: 'query_receiving_orders',
    description: 'Track inbound goods and receiving status. Use this for receiving/inbound questions.',
    parameters: {
      type: 'object',
      properties: {
        receive_no: {
          type: 'string',
          description: 'Receive order number.',
        },
        supplier_code: {
          type: 'string',
          description: 'Supplier code.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed'],
          description: 'Receiving status.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
        warehouse_id: {
          type: 'string',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  // PRODUCTION TOOLS
  {
    name: 'query_production_orders',
    description: 'Track production planning and execution. Use this for production-related questions.',
    parameters: {
      type: 'object',
      properties: {
        po_code: {
          type: 'string',
          description: 'Production order code.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'approved', 'in_production', 'completed', 'cancelled'],
          description: 'Production order status.',
        },
        finished_sku_id: {
          type: 'string',
          description: 'Finished product SKU.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_bom',
    description: 'Get Bill of Materials (BOM) - material requirements for production. Use this to check what materials are needed.',
    parameters: {
      type: 'object',
      properties: {
        bom_id: {
          type: 'string',
          description: 'BOM identifier.',
        },
        finished_sku_id: {
          type: 'string',
          description: 'Finished product SKU.',
        },
        material_sku_id: {
          type: 'string',
          description: 'Material/component SKU.',
        },
        is_active: {
          type: 'boolean',
          description: 'Filter by active BOM only.',
          default: true,
        },
      },
      required: [],
    },
  },

  // ROUTES & DELIVERY TOOLS
  {
    name: 'query_routes',
    description: 'Get delivery route information and optimization. Use this for route/delivery questions.',
    parameters: {
      type: 'object',
      properties: {
        route_id: {
          type: 'number',
          description: 'Specific route ID.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published', 'ready_to_load', 'in_transit', 'completed'],
          description: 'Route status.',
        },
        vehicle_id: {
          type: 'string',
          description: 'Vehicle identifier.',
        },
        driver_id: {
          type: 'number',
          description: 'Driver/employee ID.',
        },
        date: {
          type: 'string',
          format: 'date',
          description: 'Route date.',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  // EMPLOYEE & PERFORMANCE TOOLS
  {
    name: 'query_employee_activity',
    description: 'Track employee operations and productivity. Use this for employee performance questions.',
    parameters: {
      type: 'object',
      properties: {
        employee_id: {
          type: 'number',
          description: 'Specific employee ID.',
        },
        department: {
          type: 'string',
          description: 'Department name.',
        },
        activity_type: {
          type: 'string',
          enum: ['picking', 'receiving', 'loading', 'checking'],
          description: 'Type of activity.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
      },
      required: [],
    },
  },

  // AUDIT & LOGS TOOLS
  {
    name: 'query_inventory_ledger',
    description: 'Get complete audit trail of inventory movements. Use this for audit/tracking questions.',
    parameters: {
      type: 'object',
      properties: {
        sku_id: {
          type: 'string',
          description: 'Filter by SKU.',
        },
        location_id: {
          type: 'string',
          description: 'Filter by location.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
        transaction_type: {
          type: 'string',
          enum: ['IN', 'OUT', 'ADJUST'],
        },
        order_id: {
          type: 'number',
          description: 'Filter by order ID.',
        },
        limit: {
          type: 'number',
          default: 100,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_system_alerts',
    description: 'Get system alerts and exceptions (stock low, expiry warnings, etc.). Use this for problem/alert questions.',
    parameters: {
      type: 'object',
      properties: {
        alert_type: {
          type: 'string',
          enum: ['stock_low', 'stock_out', 'expiry_warning', 'location_full'],
          description: 'Type of alert.',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'info'],
          description: 'Alert severity.',
        },
        date_from: {
          type: 'string',
          format: 'date',
        },
        date_to: {
          type: 'string',
          format: 'date',
        },
        resolved: {
          type: 'boolean',
          description: 'Filter by resolution status.',
        },
      },
      required: [],
    },
  },

  // ANALYTICS & KPI TOOLS
  {
    name: 'query_kpi',
    description: 'Get warehouse KPIs and performance metrics. Use this for performance/efficiency questions.',
    parameters: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          format: 'date',
          description: 'Start date for KPI calculation.',
        },
        date_to: {
          type: 'string',
          format: 'date',
          description: 'End date for KPI calculation.',
        },
        warehouse_id: {
          type: 'string',
          description: 'Filter by warehouse.',
        },
        kpi_type: {
          type: 'string',
          enum: ['efficiency', 'accuracy', 'utilization', 'throughput'],
          description: 'Type of KPI to retrieve.',
        },
      },
      required: [],
    },
  },

  // MASTER DATA TOOLS
  {
    name: 'query_sku_master',
    description: 'Get SKU/product master data information. Use this for product information questions.',
    parameters: {
      type: 'object',
      properties: {
        sku_id: {
          type: 'string',
          description: 'Specific SKU to query.',
        },
        category: {
          type: 'string',
          description: 'Product category.',
        },
        sub_category: {
          type: 'string',
          description: 'Product sub-category.',
        },
        brand: {
          type: 'string',
          description: 'Product brand.',
        },
        is_active: {
          type: 'boolean',
          description: 'Filter by active SKUs only.',
          default: true,
        },
        search: {
          type: 'string',
          description: 'Search by SKU ID or name.',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },

  {
    name: 'query_customers',
    description: 'Get customer information and order history. Use this for customer-related questions.',
    parameters: {
      type: 'object',
      properties: {
        customer_code: {
          type: 'string',
          description: 'Customer code.',
        },
        search: {
          type: 'string',
          description: 'Search by customer name or code.',
        },
        has_pending_orders: {
          type: 'boolean',
          description: 'Filter customers with pending orders.',
        },
        limit: {
          type: 'number',
          default: 50,
        },
      },
      required: [],
    },
  },
];

/**
 * Get tool definition by name
 */
export function getToolByName(name: string): AITool | undefined {
  return AI_TOOLS.find((tool) => tool.name === name);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): AITool[] {
  const categoryMap: Record<string, string[]> = {
    stock: ['query_stock_balance', 'query_stock_movements', 'query_forecast'],
    warehouse: ['query_warehouse_locations', 'query_warehouse_utilization'],
    orders: ['query_order_status', 'query_picklists'],
    receiving: ['query_receiving_orders'],
    production: ['query_production_orders', 'query_bom'],
    routes: ['query_routes'],
    employees: ['query_employee_activity'],
    audit: ['query_inventory_ledger', 'query_system_alerts'],
    analytics: ['query_kpi'],
    master: ['query_sku_master', 'query_customers'],
  };

  const toolNames = categoryMap[category] || [];
  return AI_TOOLS.filter((tool) => toolNames.includes(tool.name));
}

/**
 * Validate tool parameters
 */
export function validateToolParameters(
  toolName: string,
  parameters: Record<string, any>
): { valid: boolean; errors: string[] } {
  const tool = getToolByName(toolName);
  if (!tool) {
    return { valid: false, errors: [`Tool '${toolName}' not found`] };
  }

  const errors: string[] = [];
  const required = tool.parameters.required || [];

  // Check required parameters
  for (const param of required) {
    if (!(param in parameters)) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }

  // Validate enum values
  for (const [key, value] of Object.entries(parameters)) {
    const propDef = tool.parameters.properties[key];
    if (propDef && propDef.enum && !propDef.enum.includes(value)) {
      errors.push(`Invalid value for ${key}: ${value}. Expected one of: ${propDef.enum.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
