export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      master_sku: {
        Row: {
          sku_id: string
          sku_name: string
          barcode: string | null
          qty_per_pack: number
          uom: string
          default_location: string | null
          active_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          sku_id: string
          sku_name: string
          barcode?: string | null
          qty_per_pack?: number
          uom?: string
          default_location?: string | null
          active_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          sku_id?: string
          sku_name?: string
          barcode?: string | null
          qty_per_pack?: number
          uom?: string
          default_location?: string | null
          active_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wms_orders: {
        Row: {
          order_id: string
          order_no: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          order_id: string
          order_no: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          order_id?: string
          order_no?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      picklists: {
        Row: {
          id: number
          picklist_code: string
          status: string
          plan_id: number | null
          trip_id: number | null
          total_lines: number
          total_quantity: number
          loading_door_number: string | null
          assigned_employee_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          picklist_code: string
          status?: string
          plan_id?: number | null
          trip_id?: number | null
          total_lines?: number
          total_quantity?: number
          loading_door_number?: string | null
          assigned_employee_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          picklist_code?: string
          status?: string
          plan_id?: number | null
          trip_id?: number | null
          total_lines?: number
          total_quantity?: number
          loading_door_number?: string | null
          assigned_employee_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      picklist_items: {
        Row: {
          id: number
          picklist_id: number
          sku_id: string
          sku_name: string
          uom: string
          order_no: string
          order_id: string
          quantity_to_pick: number
          quantity_picked: number
          source_location_id: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          picklist_id: number
          sku_id: string
          sku_name: string
          uom: string
          order_no: string
          order_id: string
          quantity_to_pick: number
          quantity_picked?: number
          source_location_id: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          picklist_id?: number
          sku_id?: string
          sku_name?: string
          uom?: string
          order_no?: string
          order_id?: string
          quantity_to_pick?: number
          quantity_picked?: number
          source_location_id?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picklist_items_picklist_id_fkey"
            columns: ["picklist_id"]
            isOneToOne: false
            referencedRelation: "picklists"
            referencedColumns: ["id"]
          }
        ]
      }
      loadlists: {
        Row: {
          id: number
          loadlist_code: string
          status: string
          plan_id: number | null
          trip_id: number | null
          vehicle_id: number | null
          driver_employee_id: number | null
          checker_employee_id: number | null
          helper_employee_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          loadlist_code: string
          status?: string
          plan_id?: number | null
          trip_id?: number | null
          vehicle_id?: number | null
          driver_employee_id?: number | null
          checker_employee_id?: number | null
          helper_employee_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          loadlist_code?: string
          status?: string
          plan_id?: number | null
          trip_id?: number | null
          vehicle_id?: number | null
          driver_employee_id?: number | null
          checker_employee_id?: number | null
          helper_employee_id?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wms_inventory_balances: {
        Row: {
          balance_id: number
          warehouse_id: string
          location_id: string
          sku_id: string
          total_pack_qty: number
          total_piece_qty: number
          reserved_pack_qty: number
          reserved_piece_qty: number
          last_movement_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          balance_id?: number
          warehouse_id: string
          location_id: string
          sku_id: string
          total_pack_qty?: number
          total_piece_qty?: number
          reserved_pack_qty?: number
          reserved_piece_qty?: number
          last_movement_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          balance_id?: number
          warehouse_id?: string
          location_id?: string
          sku_id?: string
          total_pack_qty?: number
          total_piece_qty?: number
          reserved_pack_qty?: number
          reserved_piece_qty?: number
          last_movement_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wms_inventory_ledger: {
        Row: {
          ledger_id: number
          movement_at: string
          transaction_type: string
          direction: string
          warehouse_id: string
          location_id: string
          sku_id: string
          pack_qty: number
          piece_qty: number
          reference_no: string | null
          reference_doc_type: string | null
          reference_doc_id: number | null
          remarks: string | null
          created_at: string
        }
        Insert: {
          ledger_id?: number
          movement_at: string
          transaction_type: string
          direction: string
          warehouse_id: string
          location_id: string
          sku_id: string
          pack_qty: number
          piece_qty: number
          reference_no?: string | null
          reference_doc_type?: string | null
          reference_doc_id?: number | null
          remarks?: string | null
          created_at?: string
        }
        Update: {
          ledger_id?: number
          movement_at?: string
          transaction_type?: string
          direction?: string
          warehouse_id?: string
          location_id?: string
          sku_id?: string
          pack_qty?: number
          piece_qty?: number
          reference_no?: string | null
          reference_doc_type?: string | null
          reference_doc_id?: number | null
          remarks?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      picklist_status_enum: "pending" | "assigned" | "picking" | "completed" | "cancelled"
      loadlist_status_enum: "pending" | "loaded" | "cancelled"
    }
    CompositeTypes: {}
  }
}

type PublicSchema = Database["public"]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

// Helper types
export type MasterSkuInsert = TablesInsert<'master_sku'>
export type MasterSkuUpdate = TablesUpdate<'master_sku'>
export type MasterSkuRow = Tables<'master_sku'>

export type PicklistInsert = TablesInsert<'picklists'>
export type PicklistUpdate = TablesUpdate<'picklists'>
export type PicklistRow = Tables<'picklists'>

export type PicklistItemInsert = TablesInsert<'picklist_items'>
export type PicklistItemUpdate = TablesUpdate<'picklist_items'>
export type PicklistItemRow = Tables<'picklist_items'>

export type LoadlistInsert = TablesInsert<'loadlists'>
export type LoadlistUpdate = TablesUpdate<'loadlists'>
export type LoadlistRow = Tables<'loadlists'>

export type InventoryBalanceInsert = TablesInsert<'wms_inventory_balances'>
export type InventoryBalanceUpdate = TablesUpdate<'wms_inventory_balances'>
export type InventoryBalanceRow = Tables<'wms_inventory_balances'>

export type InventoryLedgerInsert = TablesInsert<'wms_inventory_ledger'>
export type InventoryLedgerUpdate = TablesUpdate<'wms_inventory_ledger'>
export type InventoryLedgerRow = Tables<'wms_inventory_ledger'>
