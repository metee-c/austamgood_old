import { useState, useEffect } from 'react';

interface Supplier {
  supplier_id: string;
  supplier_name: string;
  status: string;
}

interface Sku {
  sku_id: string;
  sku_name: string;
  barcode: string;
  status: string;
  qty_per_pack?: number;
  qty_per_pallet?: number;
  weight_per_piece_kg?: number;
}

interface Warehouse {
  warehouse_id: string;
  warehouse_name: string;
  active_status: string;
}

interface Customer {
  customer_id: string;
  customer_name: string;
  status: string;
}

interface Location {
  location_id: string;
  location_code: string;
  location_name: string;
  warehouse_id: string;
  active_status: string;
  location_type?: string;
}

interface Employee {
  employee_id: number;
  first_name: string;
  last_name: string;
}

export interface SystemUser {
  user_id: number;
  username: string;
  full_name: string;
  email?: string;
  is_active: boolean;
  employee_id?: number | null;
}

// Hook for suppliers
export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/master-supplier');
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      const result = await response.json();
      
      // API returns array directly, filter for active suppliers
      const activeSuppliers = (result || []).filter((s: Supplier) => s.status === 'active');
      setSuppliers(activeSuppliers);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      console.error("Error fetching suppliers:", errorMessage);
      setError('ไม่สามารถโหลดข้อมูลผู้จำหน่ายได้');
      setSuppliers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const refetch = () => {
    fetchSuppliers();
  };

  return { suppliers, loading, error, refetch };
};

// Hook for SKUs
export const useSkus = () => {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkus = async () => {
      try {
        // Fetch ALL SKUs by setting a very high limit (no pagination for form options)
        const response = await fetch('/api/master-sku?limit=99999');
        if (!response.ok) {
          throw new Error('Failed to fetch SKUs');
        }
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // API returns { data: [...] }, show all SKUs (including inactive) for receive page
        const allSkus = result.data || [];
        setSkus(allSkus);
        setError(null);
        
        // Debug: log total SKUs and sample barcodes
        console.log('📦 SKUs loaded:', {
          total: allSkus.length,
          active: allSkus.filter((s: Sku) => s.status === 'active').length,
          inactive: allSkus.filter((s: Sku) => s.status !== 'active').length,
          sampleWithBarcodes: allSkus.slice(0, 5).map((s: Sku) => ({ 
            id: s.sku_id, 
            name: s.sku_name, 
            barcode: s.barcode, 
            status: s.status 
          })),
          skusWithBarcode: allSkus.filter((s: Sku) => s.barcode).length,
          skusWithoutBarcode: allSkus.filter((s: Sku) => !s.barcode).length
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching SKUs:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูล SKU ได้');
        setSkus([]);
      }
      setLoading(false);
    };

    fetchSkus();
  }, []);

  const getSkuById = (skuId: string) => {
    return skus.find(sku => sku.sku_id === skuId);
  };

  return { skus, loading, error, getSkuById };
};

// Hook for warehouses
export const useWarehouses = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/master-warehouse');
        if (!response.ok) {
          throw new Error('Failed to fetch warehouses');
        }
        const result = await response.json();
        
        // API returns array directly, filter for active warehouses
        const activeWarehouses = (result || []).filter((w: Warehouse) => w.active_status === 'active');
        setWarehouses(activeWarehouses);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching warehouses:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลคลังสินค้าได้');
        setWarehouses([]);
      }
      setLoading(false);
    };

    fetchWarehouses();
  }, []);

  return { warehouses, loading, error };
};

// Hook for customers
export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch('/api/master-customer');
        if (!response.ok) {
          throw new Error('Failed to fetch customers');
        }
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // API returns { data: [...] }, already filtered for active customers by RPC function
        console.log('📋 Customers API response:', { total: result.data?.length || 0 });
        setCustomers(result.data || []);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching customers:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลลูกค้าได้');
        setCustomers([]);
      }
      setLoading(false);
    };

    fetchCustomers();
  }, []);

  return { customers, loading, error };
};

// Hook for locations
export const useLocations = (warehouseId: string) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if warehouseId is provided
    if (!warehouseId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    const fetchLocations = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ warehouse_id: warehouseId });
        const response = await fetch(`/api/master-location?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch locations: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        const locationsData = result.data || result; // Handle both {data} and direct array responses

        console.log('📍 Locations loaded:', {
          warehouseId,
          count: locationsData?.length || 0,
          sample: locationsData?.slice(0, 3)
        });

        setLocations(locationsData || []);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching locations:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลตำแหน่งจัดเก็บได้');
        setLocations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [warehouseId]); // Dependency array ensures this runs only when warehouseId changes

  return { locations, loading, error };
};

// Hook for employees (from master_employee table - legacy)
export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/master-employee');
        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }
        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        // API returns array directly (not wrapped in { data: [...] })
        const employeeData = Array.isArray(result) ? result : (result.data || []);
        setEmployees(employeeData);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching employees:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลพนักงานได้');
        setEmployees([]);
      }
      setLoading(false);
    };

    fetchEmployees();
  }, []);

  return { employees, loading, error };
};

// Hook for system users (from master_system_user table)
export const useSystemUsers = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/system-users');
        if (!response.ok) {
          throw new Error('Failed to fetch system users');
        }
        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        // API returns { data: [...] }, already filtered for active users
        setUsers(result.data || []);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching system users:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลผู้ใช้งานได้');
        setUsers([]);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  return { users, loading, error };
};

// Hook for storage strategies
export const useStorageStrategies = () => {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const response = await fetch('/api/storage-strategies');
        if (!response.ok) {
          throw new Error('Failed to fetch storage strategies');
        }
        const result = await response.json();

        setStrategies(result.data || result || []);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        console.error("Error fetching storage strategies:", errorMessage);
        setError('ไม่สามารถโหลดข้อมูลกลยุทธ์การจัดเก็บได้');
        setStrategies([]);
      }
      setLoading(false);
    };

    fetchStrategies();
  }, []);

  return { strategies, loading, error };
};
