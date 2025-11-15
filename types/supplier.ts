export interface Supplier {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_type: 'vendor' | 'service_provider' | 'both';
  business_reg_no?: string;
  tax_id?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  service_category?: string;
  product_category?: string;
  rating: number;
  status: 'active' | 'inactive';
  created_by: string;
  created_at: string;
  updated_at: string;
  remarks?: string;
}

export interface CreateSupplierRequest {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_type?: 'vendor' | 'service_provider' | 'both';
  business_reg_no?: string;
  tax_id?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  service_category?: string;
  product_category?: string;
  rating?: number;
  status?: 'active' | 'inactive';
  created_by: string;
  remarks?: string;
}

export interface UpdateSupplierRequest {
  supplier_code?: string;
  supplier_name?: string;
  supplier_type?: 'vendor' | 'service_provider' | 'both';
  business_reg_no?: string;
  tax_id?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  service_category?: string;
  product_category?: string;
  rating?: number;
  status?: 'active' | 'inactive';
  remarks?: string;
}