'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useProductionOrders, useProductionOrder } from '@/hooks/useProductionOrders';
import ProductionOrderSummary from '@/components/production/ProductionOrderSummary';
import ProductionOrderTable from '@/components/production/ProductionOrderTable';
import ProductionOrderForm from '@/components/production/ProductionOrderForm';

export default function ProductionOrdersPage() {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const { orders, loading, refetch } = useProductionOrders();
  // Stats functionality would need a separate hook implementation

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    const [plansRes, productsRes] = await Promise.all([
      fetch('/api/mrp'),
      fetch('/api/sku-options')
    ]);

    const [plansData, productsData] = await Promise.all([
      plansRes.json(),
      productsRes.json()
    ]);

    if (plansData.data) setPlans(plansData.data);
    if (productsData.data) setProducts(productsData.data);
  };

  const handleCreateOrder = async (data: any) => {
    try {
      const response = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        await refetch();
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const statuses = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'planned', label: 'วางแผน' },
    { value: 'in_progress', label: 'กำลังผลิต' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'closed', label: 'ปิด' },
    { value: 'cancelled', label: 'ยกเลิก' }
  ];

  return (
    <div className="h-screen bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      <div className="h-full flex flex-col space-y-2 pt-0 px-2 pb-2">
        <div className="flex items-center justify-between gap-2 pt-1 flex-shrink-0">
          <h1 className="text-xl font-bold text-thai-gray-900 font-thai m-0 p-0 leading-tight">
            คำสั่งผลิต (Production Orders)
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>รีเฟรช</span>
            </button>
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>สร้างคำสั่งผลิต</span>
            </button>
          </div>
        </div>

        {/* ProductionOrderSummary would need stats data */}

        <div className="flex-1 min-h-0">
          <div className="w-full h-full overflow-auto bg-white border border-gray-200 rounded-lg shadow-sm">
            <ProductionOrderTable
              orders={orders}
              loading={loading}
              onView={(order) => console.log('View:', order)}
              onEdit={(order) => console.log('Edit:', order)}
              onDelete={(order) => console.log('Delete:', order)}
            />
          </div>
        </div>

        <ProductionOrderForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleCreateOrder}
          plans={plans}
          products={products}
        />
      </div>
    </div>
  );
}
