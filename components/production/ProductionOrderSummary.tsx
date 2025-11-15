'use client';

import React from 'react';
import { Package, Calendar, User } from 'lucide-react';

interface ProductionOrderSummaryProps {
  order: any;
}

const ProductionOrderSummary: React.FC<ProductionOrderSummaryProps> = ({ order }) => {
  if (!order) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Order Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Package className="text-blue-500" size={24} />
          <div>
            <p className="text-sm text-gray-500">Order No</p>
            <p className="font-semibold">{order.order_no}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="text-green-500" size={24} />
          <div>
            <p className="text-sm text-gray-500">Order Date</p>
            <p className="font-semibold">{order.order_date}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <User className="text-purple-500" size={24} />
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-semibold">{order.status}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionOrderSummary;
