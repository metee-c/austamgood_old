'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import ExcelStyleRouteEditor from '@/components/receiving/ExcelStyleRouteEditor';
import type { EditorTrip, DraftOrder, EditorStop } from '../../types';

interface ExcelEditorProps {
  // Modal state
  isOpen: boolean;
  onClose: () => void;

  // Editor data
  planId: number | null;
  planName: string;
  trips: EditorTrip[];
  
  // Draft orders
  draftOrders: DraftOrder[];
  draftOrdersLoading: boolean;
  onRefreshDraftOrders: () => Promise<void>;

  // Loading & error states
  loading: boolean;
  error: string | null;

  // Actions
  onSave: (changes: any) => Promise<void>;
  onCrossPlanTransfer: (row: any, tripId: string) => void;
}

export function ExcelEditor({
  isOpen,
  onClose,
  planId,
  planName,
  trips,
  draftOrders,
  draftOrdersLoading,
  onRefreshDraftOrders,
  loading,
  error,
  onSave,
  onCrossPlanTransfer,
}: ExcelEditorProps) {
  // แสดง loading state
  if (loading && trips.length === 0) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="3xl"
        contentClassName="p-0 h-[85vh]"
        hideCloseButton
      >
        <div className="py-10 text-center text-gray-500">
          กำลังโหลดข้อมูล...
        </div>
      </Modal>
    );
  }

  // แสดง error state
  if (error && trips.length === 0) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="3xl"
        contentClassName="p-0 h-[85vh]"
        hideCloseButton
      >
        <div className="py-10 text-center text-red-500">
          {error}
        </div>
      </Modal>
    );
  }

  // แสดง empty state
  if (!planId) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="3xl"
        contentClassName="p-0 h-[85vh]"
        hideCloseButton
      >
        <div className="py-6 text-center text-gray-500">
          เลือกแผนเพื่อจัดการเส้นทาง
        </div>
      </Modal>
    );
  }

  // แสดง editor
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="3xl"
      contentClassName="p-0 h-[85vh]"
      hideCloseButton
    >
      <ExcelStyleRouteEditor
        planId={planId}
        planName={planName}
        trips={trips}
        draftOrders={draftOrders}
        draftOrdersLoading={draftOrdersLoading}
        onRefreshDraftOrders={onRefreshDraftOrders}
        onSave={onSave}
        onClose={onClose}
        loading={loading}
        onCrossPlanTransfer={onCrossPlanTransfer}
      />
    </Modal>
  );
}
