'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { RoutePlan } from '../../types';
import { TableRow } from './TableRow';
import { ExpandedTrips } from './ExpandedTrips';
import { TableHeader } from './TableHeader';

interface RoutesPlanTableProps {
  plans: RoutePlan[];
  isLoading: boolean;
  expandedPlanIds: Set<number>;
  planTripsData: Map<number, any[]>;
  loadingTrips: Set<number>;
  editingStatusPlanId: number | null;
  onToggleExpand: (planId: number) => void;
  onStatusChange: (planId: number, newStatus: string) => Promise<void>;
  onPreviewPlan: (planId: number) => void;
  onOpenEditor: (planId: number) => void;
  onEditShippingCost: (planId: number) => void;
  onPrintPlan: (planId: number) => void;
  onExportTMS: (planId: number, planCode: string, planDate: string) => void;
  onApprovePlan: (planId: number) => Promise<void>;
  onDeletePlan: (planId: number) => void;
  sortField: keyof RoutePlan | '';
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof RoutePlan) => void;
}

export function RoutesPlanTable({
  plans,
  isLoading,
  expandedPlanIds,
  planTripsData,
  loadingTrips,
  editingStatusPlanId,
  onToggleExpand,
  onStatusChange,
  onPreviewPlan,
  onOpenEditor,
  onEditShippingCost,
  onPrintPlan,
  onExportTMS,
  onApprovePlan,
  onDeletePlan,
  sortField,
  sortDirection,
  onSort,
}: RoutesPlanTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        ยังไม่มีแผนเส้นทาง
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full border-collapse text-sm">
        <TableHeader
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={onSort}
        />
        <tbody className="bg-white divide-y divide-gray-100">
          {plans.map((plan) => {
            const isExpanded = expandedPlanIds.has(plan.plan_id);
            const trips = planTripsData.get(plan.plan_id) || [];
            const isLoadingTrips = loadingTrips.has(plan.plan_id);

            return (
              <React.Fragment key={plan.plan_id}>
                <TableRow
                  plan={plan}
                  isExpanded={isExpanded}
                  isLoadingTrips={isLoadingTrips}
                  isEditingStatus={editingStatusPlanId === plan.plan_id}
                  onToggleExpand={() => onToggleExpand(plan.plan_id)}
                  onStatusChange={(newStatus) => onStatusChange(plan.plan_id, newStatus)}
                  onPreviewPlan={() => onPreviewPlan(plan.plan_id)}
                  onOpenEditor={() => onOpenEditor(plan.plan_id)}
                  onEditShippingCost={() => onEditShippingCost(plan.plan_id)}
                  onPrintPlan={() => onPrintPlan(plan.plan_id)}
                  onExportTMS={() => onExportTMS(plan.plan_id, plan.plan_code, plan.plan_date)}
                  onApprovePlan={() => onApprovePlan(plan.plan_id)}
                  onDeletePlan={() => onDeletePlan(plan.plan_id)}
                />

                {isExpanded && (
                  <ExpandedTrips
                    trips={trips}
                    isLoading={isLoadingTrips}
                  />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
