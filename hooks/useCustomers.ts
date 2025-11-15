import { useState, useEffect } from 'react';

export interface Customer {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  customer_type: 'individual' | 'corporate' | 'government';
  business_reg_no?: string;
  tax_id?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  billing_address?: string;
  shipping_address?: string;
  payment_terms?: string;
  credit_limit?: number;
  rating: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  remarks?: string;
}

interface CustomersResponse {
  customers: Customer[];
  count: number;
  error?: string;
}

interface UseCustomersParams {
  search?: string;
  customer_type?: 'individual' | 'corporate' | 'government';
  status?: 'active' | 'inactive';
}

export const useCustomers = (params: UseCustomersParams = {}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.customer_type) searchParams.append('customer_type', params.customer_type);
      if (params.status) searchParams.append('status', params.status);
      
      const response = await fetch(`/api/master-customer?${searchParams.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch customers');
      }
      
      // Handle the response format from the API
      if (data.data && Array.isArray(data.data)) {
        setCustomers(data.data);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [params.search, params.customer_type, params.status]);

  return {
    customers,
    loading,
    error,
    refetch: fetchCustomers
  };
};