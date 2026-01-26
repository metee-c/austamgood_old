'use client';

import { ChevronDown } from 'lucide-react';
import type { RoutePlan } from '../../types';
import { TableActions } from './TableActions';
import { STATUSES } from '../../utils';

interface TableRowProps {
  plan: RoutePlan;
  isExpanded: boolean;
  isLoadingTrips: boolean;
  isEditingStatus: boolean;
  onToggleExpand: () => void;
  onStatusChange: (newStatus: string) => Promise<void>;
  onPreviewPlan: () => void;
  onOpenEditor: () => void;
  onEditShippingCost: () => void;
  onPrintPlan: () => void;
  onExportTMS: () => void;
  onApprovePlan: () => Promise<void>;
  onDeletePlan: () => void;
}

export function TableRow({
  plan,
  isExpanded,
  isLoadingTrips,
  isEditingStatus,
  onToggleExpand,
  onStatusChange,
  onPreviewPlan,
  onOpenEditor,
  onEditShippingCost,
  onPrintPlan,
  onExportTMS,
  onApprovePlan,
  onDeletePlan,
}: TableRowProps) {
  const statuses = STATUSES.filter(s => s.value !== 'all');

  return (
    <tr className="hover:bg-gray-50/80 transition-colors duration-200">
      {/* Expand button */}
      <td className="px-2 py-2 text-xs border-r border-gray-100">
        <button
          onClick={onToggleExpand}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          disabled={isLoadingTrips}
        >
          {isLoadingTrips ? (
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
            />
          )}
        </button>
      </td>

      {/* Plan code */}
      <td className="px-2 py-2 text-xs border-r border-gray-100">
        <div className="font-semibold text-blue-600 font-mono">{plan.plan_code}</div>
      </td>

      {/* Plan name */}
      <td className="px-2 py-2 text-xs border-r border-gray-100">
        <div className="font-medium text-thai-gray-800">{plan.plan_name || '-'}</div>
      </td>

      {/* Plan date */}
      <td className="px-2 py-2 text-xs border-r border-gray-100">
        <div className="font-medium text-gray-700">
          {new Date(plan.plan_date).toLocaleDateString('en-GB')}
        </div>
      </td>

      {/* Warehouse */}
      <td className="px-2 py-2 text-xs border-r border-gray-100">
        <div className="font-medium text-thai-gray-700">
          {plan.warehouse?.warehouse_name || '-'}
        </div>
      </td>

      {/* Total trips */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-bold text-blue-600">{plan.total_trips || 0}</div>
      </td>

      {/* Total distance */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-medium text-thai-gray-700">
          {plan.total_distance_km ? `${plan.total_distance_km.toFixed(1)} km` : '-'}
        </div>
      </td>

      {/* Total drive time */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-medium text-thai-gray-700">
          {plan.total_drive_minutes
            ? `${Math.round((plan.total_drive_minutes || 0) / 60)} ชม.`
            : '-'}
        </div>
      </td>

      {/* Total weight */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-medium text-thai-gray-700">
          {plan.total_weight_kg ? `${plan.total_weight_kg.toFixed(0)} kg` : '-'}
        </div>
      </td>

      {/* Total volume */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-medium text-thai-gray-700">
          {plan.total_volume_cbm ? `${plan.total_volume_cbm.toFixed(2)} m³` : '-'}
        </div>
      </td>

      {/* Total pallets */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-medium text-thai-gray-700">
          {plan.total_pallets ? `${plan.total_pallets.toFixed(1)}` : '-'}
        </div>
      </td>

      {/* Objective value (cost) */}
      <td className="px-2 py-2 text-xs border-r border-gray-100 text-center">
        <div className="font-semibold text-green-600">
          {plan.objective_value
            ? `฿${plan.objective_value.toLocaleString('th-TH', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`
            : '-'}
        </div>
      </td>

      {/* Status dropdown */}
      <td className="px-2 py-2 text-xs border-r border-gray-100">
        <div className="relative">
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-thai text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
            value={plan.status}
            disabled={isEditingStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* Actions */}
      <td className="px-2 py-2 text-xs">
        <TableActions
          plan={plan}
          onPreviewPlan={onPreviewPlan}
          onOpenEditor={onOpenEditor}
          onEditShippingCost={onEditShippingCost}
          onPrintPlan={onPrintPlan}
          onExportTMS={onExportTMS}
          onApprovePlan={onApprovePlan}
          onDeletePlan={onDeletePlan}
        />
      </td>
    </tr>
  );
}
