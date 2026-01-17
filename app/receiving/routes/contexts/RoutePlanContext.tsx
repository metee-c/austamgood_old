'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useRoutePlanState, RoutePlanState, RoutePlanActions } from '../hooks/useRoutePlanState';

interface RoutePlanContextValue {
  state: RoutePlanState;
  actions: RoutePlanActions;
}

const RoutePlanContext = createContext<RoutePlanContextValue | undefined>(undefined);

export function RoutePlanProvider({ children }: { children: ReactNode }) {
  const { state, actions } = useRoutePlanState();
  
  return (
    <RoutePlanContext.Provider value={{ state, actions }}>
      {children}
    </RoutePlanContext.Provider>
  );
}

export function useRoutePlanContext() {
  const context = useContext(RoutePlanContext);
  
  if (context === undefined) {
    throw new Error('useRoutePlanContext must be used within a RoutePlanProvider');
  }
  
  return context;
}

// Convenience hooks for accessing specific parts of state
export function useRoutePlanFilters() {
  const { state, actions } = useRoutePlanContext();
  return {
    filters: state.filters,
    setFilter: actions.setFilter,
    resetFilters: actions.resetFilters,
  };
}

export function useRoutePlanPagination() {
  const { state, actions } = useRoutePlanContext();
  return {
    pagination: state.pagination,
    setPagination: actions.setPagination,
  };
}

export function useRoutePlanSelection() {
  const { state, actions } = useRoutePlanContext();
  return {
    selectedPlanIds: state.selectedPlanIds,
    expandedPlanIds: state.expandedPlanIds,
    togglePlanSelection: actions.togglePlanSelection,
    selectAllPlans: actions.selectAllPlans,
    clearSelection: actions.clearSelection,
    togglePlanExpand: actions.togglePlanExpand,
  };
}

export function useRoutePlanCreateModal() {
  const { state, actions } = useRoutePlanContext();
  return {
    createModal: state.createModal,
    openCreateModal: actions.openCreateModal,
    closeCreateModal: actions.closeCreateModal,
    setCreateStep: actions.setCreateStep,
    toggleOrderSelection: actions.toggleOrderSelection,
    selectAllOrders: actions.selectAllOrders,
    clearOrderSelection: actions.clearOrderSelection,
    setVrpSettings: actions.setVrpSettings,
    setOptimizing: actions.setOptimizing,
    setPreviewData: actions.setPreviewData,
  };
}

export function useRoutePlanEditor() {
  const { state, actions } = useRoutePlanContext();
  return {
    editor: state.editor,
    openEditor: actions.openEditor,
    closeEditor: actions.closeEditor,
    setEditorData: actions.setEditorData,
    setEditorLoading: actions.setEditorLoading,
    setEditorSaving: actions.setEditorSaving,
    updateEditorTrips: actions.updateEditorTrips,
    markEditorDirty: actions.markEditorDirty,
    markEditorClean: actions.markEditorClean,
  };
}

export function useRoutePlanModals() {
  const { state, actions } = useRoutePlanContext();
  return {
    modals: state.modals,
    openSplitModal: actions.openSplitModal,
    closeSplitModal: actions.closeSplitModal,
    openTransferModal: actions.openTransferModal,
    closeTransferModal: actions.closeTransferModal,
    openDeleteModal: actions.openDeleteModal,
    closeDeleteModal: actions.closeDeleteModal,
  };
}
