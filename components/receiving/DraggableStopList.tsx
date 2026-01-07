'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface StopOrderDetail {
  order_id: number | null;
  order_no?: string | null;
  customer_name?: string | null;
  shop_name?: string | null;
  allocated_weight_kg?: number | null;
  total_order_weight_kg?: number | null;
}

interface EditorStop {
  stop_id: number;
  sequence_no: number;
  stop_name: string;
  address?: string | null;
  load_weight_kg?: number | null;
  service_duration_minutes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  order_id?: number | null;
  order_no?: string | null;
  order_ids?: number[];
  orders?: StopOrderDetail[];
  tags?: {
    order_ids?: number[];
    customer_id?: string;
  };
  notes?: string | null;
}

interface DraggableStopListProps {
  stops: EditorStop[];
  selectedStopId: number | null;
  selectedOrderId: number | null;
  onReorder: (reorderedStops: EditorStop[]) => void;
  onSelectStop: (stopId: number, orderId: number | null) => void;
}

interface SortableStopRowProps {
  stop: EditorStop;
  isSelected: boolean;
  selectedOrderId: number | null;
  onSelectStop: (stopId: number, orderId: number | null) => void;
}

// คอมโพเนนต์แถว stop ที่สามารถลากได้
function SortableStopRow({ stop, isSelected, selectedOrderId, onSelectStop }: SortableStopRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.stop_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // รองรับทั้ง single order และ consolidated orders
  const orderRows: StopOrderDetail[] =
    stop.orders && stop.orders.length > 0
      ? stop.orders
      : [{
        order_id: stop.order_id ?? null,
        order_no: stop.order_no ?? null,
        customer_name: stop.stop_name ?? null,
        allocated_weight_kg: stop.load_weight_kg != null && Number.isFinite(Number(stop.load_weight_kg))
          ? Number(stop.load_weight_kg)
          : null,
        total_order_weight_kg: stop.load_weight_kg != null && Number.isFinite(Number(stop.load_weight_kg))
          ? Number(stop.load_weight_kg)
          : null
      }];

  return (
    <>
      {orderRows.map((order: StopOrderDetail, index: number) => {
        const isFirstRow = index === 0;
        const rowKey = `${stop.stop_id}-${order.order_id ?? `idx-${index}`}`;
        const isRowSelected = isSelected && (selectedOrderId === null || selectedOrderId === order.order_id);

        const weightSource =
          (order.allocated_weight_kg != null && Number.isFinite(Number(order.allocated_weight_kg)))
            ? Number(order.allocated_weight_kg)
            : (order.total_order_weight_kg != null && Number.isFinite(Number(order.total_order_weight_kg)))
              ? Number(order.total_order_weight_kg)
              : isFirstRow && stop.load_weight_kg != null && Number.isFinite(Number(stop.load_weight_kg))
                ? Number(stop.load_weight_kg)
                : null;

        const formattedWeight = weightSource != null
          ? weightSource.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
          : '-';

        const customerDisplay = order.shop_name || order.customer_name || stop.stop_name || '-';
        const addressDisplay = stop.address || '-';
        const serviceDurationDisplay = (stop.service_duration_minutes ?? '-') || '-';
        const notesDisplay = stop.notes || '-';

        return (
          <tr
            key={rowKey}
            ref={isFirstRow ? setNodeRef : undefined}
            style={isFirstRow ? style : undefined}
            onClick={() => onSelectStop(stop.stop_id, order.order_id)}
            className={`cursor-pointer ${isRowSelected ? 'bg-blue-100' : 'hover:bg-gray-50'} ${isDragging && isFirstRow ? 'shadow-lg' : ''}`}
          >
            {/* Drag handle - แสดงเฉพาะแถวแรกของ stop */}
            {isFirstRow ? (
              <td className="px-2 py-2" rowSpan={orderRows.length}>
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
                  title="ลากเพื่อจัดลำดับ"
                >
                  <GripVertical size={16} />
                </div>
              </td>
            ) : null}

            <td className="px-3 py-2 font-mono text-gray-600">
              {isFirstRow ? stop.sequence_no : ''}
            </td>
            <td className="px-3 py-2 font-mono text-blue-600">
              {order.order_no || '-'}
            </td>
            <td className="px-3 py-2">
              <div className="font-semibold text-gray-800">{customerDisplay}</div>
              <div className="text-gray-500 truncate" style={{ maxWidth: '200px' }}>
                {addressDisplay}
              </div>
            </td>
            <td className="px-3 py-2 text-right font-mono text-gray-600">
              {formattedWeight}
            </td>
            <td className="px-3 py-2 text-right font-mono text-gray-600">
              {isFirstRow ? serviceDurationDisplay : ''}
            </td>
            <td className="px-3 py-2 text-gray-500 truncate" style={{ maxWidth: '150px' }}>
              {isFirstRow ? notesDisplay : ''}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// คอมโพเนนต์หลัก
export default function DraggableStopList({
  stops,
  selectedStopId,
  selectedOrderId,
  onReorder,
  onSelectStop,
}: DraggableStopListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // ต้องลากอย่างน้อย 8px ถึงจะเริ่ม drag (ป้องกัน accidental drag)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stops.findIndex((stop) => stop.stop_id === active.id);
      const newIndex = stops.findIndex((stop) => stop.stop_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedStops = arrayMove(stops, oldIndex, newIndex);

        // อัพเดท sequence_no
        const updatedStops = reorderedStops.map((stop, index) => ({
          ...stop,
          sequence_no: index + 1,
        }));

        onReorder(updatedStops);
      }
    }
  };

  if (stops.length === 0) {
    return (
      <div className="px-3 pb-3 text-xs text-gray-400">
        ไม่มีจุดในเที่ยวนี้
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <table className="w-full text-xs border-t border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-2 w-8"></th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">เลขที่ออเดอร์</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">ลูกค้า</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">น้ำหนัก (kg)</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">เวลา (นาที)</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <SortableContext
            items={stops.map((stop) => stop.stop_id)}
            strategy={verticalListSortingStrategy}
          >
            {stops.map((stop) => (
              <SortableStopRow
                key={stop.stop_id}
                stop={stop}
                isSelected={selectedStopId === stop.stop_id}
                selectedOrderId={selectedOrderId}
                onSelectStop={onSelectStop}
              />
            ))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}
