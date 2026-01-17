import { useReducer, useCallback } from 'react';

// ============ Types ============
export interface RoutePlan {
  plan_id: string;
  plan_code: string;
  plan_date: string;
  status: string;
  warehouse_id: string;
  trips: Trip[];
}

export interface Trip {
  trip_id: string;
  trip_index: number;
  vehicle_id: string | null;
  driver_id: string | null;
  stops: Stop[];
}

export interface Stop {
  stop_id: string;
  trip_id: string;
  sequence: number;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  items: OrderItem[];
}

export interface OrderItem {
  item_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  quantity: number;
}

// ============ State Interface ============
export interface RoutePlanState {
  // List view
  plans: RoutePlan[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: {
    warehouseId: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    search: string;
  };
  
  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  
  // Selected items
  selectedPlanIds: Set<string>;
  expandedPlanIds: Set<string>;
  
  // Create modal
  createModal: {
    isOpen: boolean;
    step: 'select' | 'configure' | 'preview';
    selectedOrders: Set<string>;
    vrpSettings: VRPSettings;
    isOptimizing: boolean;
    previewData: any | null;
  };
  
  // Editor
  editor: {
    isOpen: boolean;
    planId: string | null;
    data: RoutePlan | null;
    originalData: RoutePlan | null;
    isLoading: boolean;
    hasUnsavedChanges: boolean;
    isSaving: boolean;
  };
  
  // Other modals
  modals: {
    splitStop: { isOpen: boolean; stopId: string | null };
    crossPlanTransfer: { isOpen: boolean; orderId: string | null };
    confirmDelete: { isOpen: boolean; planId: string | null };
  };
}

export interface VRPSettings {
  maxStopsPerTrip: number;
  maxWeightPerTrip: number;
  maxVolumePerTrip: number;
  startTime: string;
  endTime: string;
  algorithm: 'greedy' | 'genetic' | 'simulated_annealing';
}

// ============ Actions ============
type Action =
  // List actions
  | { type: 'SET_PLANS'; payload: RoutePlan[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PAGINATION'; payload: Partial<RoutePlanState['pagination']> }
  
  // Filter actions
  | { type: 'SET_FILTER'; payload: { key: keyof RoutePlanState['filters']; value: any } }
  | { type: 'RESET_FILTERS' }
  
  // Selection actions
  | { type: 'TOGGLE_PLAN_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_PLANS'; payload: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_PLAN_EXPAND'; payload: string }
  
  // Create modal actions
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'SET_CREATE_STEP'; payload: 'select' | 'configure' | 'preview' }
  | { type: 'TOGGLE_ORDER_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_ORDERS'; payload: string[] }
  | { type: 'CLEAR_ORDER_SELECTION' }
  | { type: 'SET_VRP_SETTINGS'; payload: Partial<VRPSettings> }
  | { type: 'SET_OPTIMIZING'; payload: boolean }
  | { type: 'SET_PREVIEW_DATA'; payload: any }
  
  // Editor actions
  | { type: 'OPEN_EDITOR'; payload: string }
  | { type: 'CLOSE_EDITOR' }
  | { type: 'SET_EDITOR_DATA'; payload: RoutePlan }
  | { type: 'SET_EDITOR_LOADING'; payload: boolean }
  | { type: 'SET_EDITOR_SAVING'; payload: boolean }
  | { type: 'UPDATE_EDITOR_TRIPS'; payload: Trip[] }
  | { type: 'MARK_EDITOR_DIRTY' }
  | { type: 'MARK_EDITOR_CLEAN' }
  
  // Modal actions
  | { type: 'OPEN_SPLIT_MODAL'; payload: string }
  | { type: 'CLOSE_SPLIT_MODAL' }
  | { type: 'OPEN_TRANSFER_MODAL'; payload: string }
  | { type: 'CLOSE_TRANSFER_MODAL' }
  | { type: 'OPEN_DELETE_MODAL'; payload: string }
  | { type: 'CLOSE_DELETE_MODAL' };

// ============ Initial State ============
const initialState: RoutePlanState = {
  plans: [],
  isLoading: false,
  error: null,
  
  filters: {
    warehouseId: null,
    status: null,
    startDate: null,
    endDate: null,
    search: '',
  },
  
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
  },
  
  selectedPlanIds: new Set(),
  expandedPlanIds: new Set(),
  
  createModal: {
    isOpen: false,
    step: 'select',
    selectedOrders: new Set(),
    vrpSettings: {
      maxStopsPerTrip: 10,
      maxWeightPerTrip: 1000,
      maxVolumePerTrip: 10,
      startTime: '08:00',
      endTime: '18:00',
      algorithm: 'genetic',
    },
    isOptimizing: false,
    previewData: null,
  },
  
  editor: {
    isOpen: false,
    planId: null,
    data: null,
    originalData: null,
    isLoading: false,
    hasUnsavedChanges: false,
    isSaving: false,
  },
  
  modals: {
    splitStop: { isOpen: false, stopId: null },
    crossPlanTransfer: { isOpen: false, orderId: null },
    confirmDelete: { isOpen: false, planId: null },
  },
};

// ============ Reducer ============
function routePlanReducer(state: RoutePlanState, action: Action): RoutePlanState {
  switch (action.type) {
    // List actions
    case 'SET_PLANS':
      return { ...state, plans: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } };
    
    // Filter actions
    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.payload.key]: action.payload.value },
        pagination: { ...state.pagination, page: 1 }, // Reset to page 1 on filter change
      };
    case 'RESET_FILTERS':
      return { ...state, filters: initialState.filters, pagination: { ...state.pagination, page: 1 } };
    
    // Selection actions
    case 'TOGGLE_PLAN_SELECTION': {
      const newSelected = new Set(state.selectedPlanIds);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, selectedPlanIds: newSelected };
    }
    case 'SELECT_ALL_PLANS':
      return { ...state, selectedPlanIds: new Set(action.payload) };
    case 'CLEAR_SELECTION':
      return { ...state, selectedPlanIds: new Set() };
    case 'TOGGLE_PLAN_EXPAND': {
      const newExpanded = new Set(state.expandedPlanIds);
      if (newExpanded.has(action.payload)) {
        newExpanded.delete(action.payload);
      } else {
        newExpanded.add(action.payload);
      }
      return { ...state, expandedPlanIds: newExpanded };
    }
    
    // Create modal actions
    case 'OPEN_CREATE_MODAL':
      return { ...state, createModal: { ...initialState.createModal, isOpen: true } };
    case 'CLOSE_CREATE_MODAL':
      return { ...state, createModal: initialState.createModal };
    case 'SET_CREATE_STEP':
      return { ...state, createModal: { ...state.createModal, step: action.payload } };
    case 'TOGGLE_ORDER_SELECTION': {
      const newSelected = new Set(state.createModal.selectedOrders);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, createModal: { ...state.createModal, selectedOrders: newSelected } };
    }
    case 'SELECT_ALL_ORDERS':
      return { ...state, createModal: { ...state.createModal, selectedOrders: new Set(action.payload) } };
    case 'CLEAR_ORDER_SELECTION':
      return { ...state, createModal: { ...state.createModal, selectedOrders: new Set() } };
    case 'SET_VRP_SETTINGS':
      return { ...state, createModal: { ...state.createModal, vrpSettings: { ...state.createModal.vrpSettings, ...action.payload } } };
    case 'SET_OPTIMIZING':
      return { ...state, createModal: { ...state.createModal, isOptimizing: action.payload } };
    case 'SET_PREVIEW_DATA':
      return { ...state, createModal: { ...state.createModal, previewData: action.payload, step: 'preview' } };
    
    // Editor actions
    case 'OPEN_EDITOR':
      return { ...state, editor: { ...state.editor, isOpen: true, planId: action.payload, isLoading: true } };
    case 'CLOSE_EDITOR':
      return { ...state, editor: initialState.editor };
    case 'SET_EDITOR_DATA':
      return {
        ...state,
        editor: {
          ...state.editor,
          data: action.payload,
          originalData: structuredClone(action.payload),
          isLoading: false,
        },
      };
    case 'SET_EDITOR_LOADING':
      return { ...state, editor: { ...state.editor, isLoading: action.payload } };
    case 'SET_EDITOR_SAVING':
      return { ...state, editor: { ...state.editor, isSaving: action.payload } };
    case 'UPDATE_EDITOR_TRIPS':
      return {
        ...state,
        editor: {
          ...state.editor,
          data: state.editor.data ? { ...state.editor.data, trips: action.payload } : null,
          hasUnsavedChanges: true,
        },
      };
    case 'MARK_EDITOR_DIRTY':
      return { ...state, editor: { ...state.editor, hasUnsavedChanges: true } };
    case 'MARK_EDITOR_CLEAN':
      return { ...state, editor: { ...state.editor, hasUnsavedChanges: false } };
    
    // Other modal actions
    case 'OPEN_SPLIT_MODAL':
      return { ...state, modals: { ...state.modals, splitStop: { isOpen: true, stopId: action.payload } } };
    case 'CLOSE_SPLIT_MODAL':
      return { ...state, modals: { ...state.modals, splitStop: { isOpen: false, stopId: null } } };
    case 'OPEN_TRANSFER_MODAL':
      return { ...state, modals: { ...state.modals, crossPlanTransfer: { isOpen: true, orderId: action.payload } } };
    case 'CLOSE_TRANSFER_MODAL':
      return { ...state, modals: { ...state.modals, crossPlanTransfer: { isOpen: false, orderId: null } } };
    case 'OPEN_DELETE_MODAL':
      return { ...state, modals: { ...state.modals, confirmDelete: { isOpen: true, planId: action.payload } } };
    case 'CLOSE_DELETE_MODAL':
      return { ...state, modals: { ...state.modals, confirmDelete: { isOpen: false, planId: null } } };
    
    default:
      return state;
  }
}

// ============ Hook ============
export function useRoutePlanState() {
  const [state, dispatch] = useReducer(routePlanReducer, initialState);
  
  // Memoized action creators
  const actions = {
    // List
    setPlans: useCallback((plans: RoutePlan[]) => dispatch({ type: 'SET_PLANS', payload: plans }), []),
    setLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }), []),
    setError: useCallback((error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }), []),
    setPagination: useCallback((pagination: Partial<RoutePlanState['pagination']>) => dispatch({ type: 'SET_PAGINATION', payload: pagination }), []),
    
    // Filters
    setFilter: useCallback((key: keyof RoutePlanState['filters'], value: any) => dispatch({ type: 'SET_FILTER', payload: { key, value } }), []),
    resetFilters: useCallback(() => dispatch({ type: 'RESET_FILTERS' }), []),
    
    // Selection
    togglePlanSelection: useCallback((planId: string) => dispatch({ type: 'TOGGLE_PLAN_SELECTION', payload: planId }), []),
    selectAllPlans: useCallback((planIds: string[]) => dispatch({ type: 'SELECT_ALL_PLANS', payload: planIds }), []),
    clearSelection: useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []),
    togglePlanExpand: useCallback((planId: string) => dispatch({ type: 'TOGGLE_PLAN_EXPAND', payload: planId }), []),
    
    // Create modal
    openCreateModal: useCallback(() => dispatch({ type: 'OPEN_CREATE_MODAL' }), []),
    closeCreateModal: useCallback(() => dispatch({ type: 'CLOSE_CREATE_MODAL' }), []),
    setCreateStep: useCallback((step: 'select' | 'configure' | 'preview') => dispatch({ type: 'SET_CREATE_STEP', payload: step }), []),
    toggleOrderSelection: useCallback((orderId: string) => dispatch({ type: 'TOGGLE_ORDER_SELECTION', payload: orderId }), []),
    selectAllOrders: useCallback((orderIds: string[]) => dispatch({ type: 'SELECT_ALL_ORDERS', payload: orderIds }), []),
    clearOrderSelection: useCallback(() => dispatch({ type: 'CLEAR_ORDER_SELECTION' }), []),
    setVrpSettings: useCallback((settings: Partial<VRPSettings>) => dispatch({ type: 'SET_VRP_SETTINGS', payload: settings }), []),
    setOptimizing: useCallback((optimizing: boolean) => dispatch({ type: 'SET_OPTIMIZING', payload: optimizing }), []),
    setPreviewData: useCallback((data: any) => dispatch({ type: 'SET_PREVIEW_DATA', payload: data }), []),
    
    // Editor
    openEditor: useCallback((planId: string) => dispatch({ type: 'OPEN_EDITOR', payload: planId }), []),
    closeEditor: useCallback(() => dispatch({ type: 'CLOSE_EDITOR' }), []),
    setEditorData: useCallback((data: RoutePlan) => dispatch({ type: 'SET_EDITOR_DATA', payload: data }), []),
    setEditorLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_EDITOR_LOADING', payload: loading }), []),
    setEditorSaving: useCallback((saving: boolean) => dispatch({ type: 'SET_EDITOR_SAVING', payload: saving }), []),
    updateEditorTrips: useCallback((trips: Trip[]) => dispatch({ type: 'UPDATE_EDITOR_TRIPS', payload: trips }), []),
    markEditorDirty: useCallback(() => dispatch({ type: 'MARK_EDITOR_DIRTY' }), []),
    markEditorClean: useCallback(() => dispatch({ type: 'MARK_EDITOR_CLEAN' }), []),
    
    // Other modals
    openSplitModal: useCallback((stopId: string) => dispatch({ type: 'OPEN_SPLIT_MODAL', payload: stopId }), []),
    closeSplitModal: useCallback(() => dispatch({ type: 'CLOSE_SPLIT_MODAL' }), []),
    openTransferModal: useCallback((orderId: string) => dispatch({ type: 'OPEN_TRANSFER_MODAL', payload: orderId }), []),
    closeTransferModal: useCallback(() => dispatch({ type: 'CLOSE_TRANSFER_MODAL' }), []),
    openDeleteModal: useCallback((planId: string) => dispatch({ type: 'OPEN_DELETE_MODAL', payload: planId }), []),
    closeDeleteModal: useCallback(() => dispatch({ type: 'CLOSE_DELETE_MODAL' }), []),
  };
  
  return { state, actions, dispatch };
}

export type RoutePlanActions = ReturnType<typeof useRoutePlanState>['actions'];
