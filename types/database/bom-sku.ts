export interface BomSku {
  id: number;
  bom_id: string;
  finished_sku_id: string;
  material_sku_id: string;
  material_qty: number;
  material_uom: string;
  step_order: number;
  step_name?: string;
  step_description?: string;
  waste_qty?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'inactive';
}

export interface BomSkuWithDetails extends BomSku {
  finished_sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
  };
  material_sku?: {
    sku_id: string;
    sku_name: string;
    uom_base: string;
  };
}

export interface BomSkuFilters {
  search?: string;
  bom_id?: string;
  finished_sku_id?: string;
  material_sku_id?: string;
  status?: 'active' | 'inactive';
}

export interface CreateBomSkuData {
  bom_id: string;
  finished_sku_id: string;
  material_sku_id: string;
  material_qty: number;
  material_uom: string;
  step_order: number;
  step_name?: string;
  step_description?: string;
  waste_qty?: number;
  created_by: string;
  status?: 'active' | 'inactive';
}

export interface UpdateBomSkuData extends Partial<CreateBomSkuData> {
  id: number;
}