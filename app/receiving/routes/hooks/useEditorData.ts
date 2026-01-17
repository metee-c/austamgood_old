import { useState, useCallback } from 'react';
import type { EditorTrip, DraftOrder } from '../types';
import { 
  fetchEditorData as apiFetchEditorData,
  saveEditorData as apiSaveEditorData,
  fetchDraftOrders as apiFetchDraftOrders,
  ApiError 
} from '../api';

interface EditorData {
  plan: any | null;
  warehouse: { latitude: number; longitude: number; name?: string | null } | null;
  trips: EditorTrip[];
  draftOrders: DraftOrder[];
}

export function useEditorData() {
  const [data, setData] = useState<EditorData>({
    plan: null,
    warehouse: null,
    trips: [],
    draftOrders: [],
  });
  const [originalData, setOriginalData] = useState<EditorData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const fetchEditorData = useCallback(async (planId: number, signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ Use API layer instead of direct fetch
      const result = await apiFetchEditorData(planId, signal);
      
      if (signal?.aborted) return;
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Normalize trips data
      const normalizedTrips: EditorTrip[] = (result.data.trips || []).map((trip: any, index: number) => {
        const normalizedStops = (trip.stops || []).map((stop: any) => {
          const normalizedOrders = Array.isArray(stop.orders)
            ? stop.orders
                .map((order: any) => {
                  const orderId = Number(order.order_id);
                  if (!Number.isFinite(orderId)) return null;
                  
                  return {
                    order_id: orderId,
                    order_no: order.order_no ?? null,
                    customer_id: order.customer_id ?? null,
                    customer_name: order.customer_name ?? null,
                    shop_name: order.shop_name ?? null,
                    province: order.province ?? null,
                    allocated_weight_kg: order.allocated_weight_kg != null ? Number(order.allocated_weight_kg) : null,
                    total_order_weight_kg: order.total_order_weight_kg != null ? Number(order.total_order_weight_kg) : null,
                    total_qty: order.total_qty != null ? Number(order.total_qty) : null,
                    note: order.note ?? null,
                    text_field_long_1: order.text_field_long_1 ?? null,
                    items: Array.isArray(order.items) ? order.items : []
                  };
                })
                .filter((order: any) => order !== null)
            : [];
          
          return {
            ...stop,
            order_ids: normalizedOrders.map((order: any) => order.order_id),
            orders: normalizedOrders
          };
        });
        
        return {
          ...trip,
          trip_number: trip.daily_trip_number ?? trip.trip_number ?? trip.trip_sequence ?? index + 1,
          stops: normalizedStops
        };
      });
      
      // Fetch draft orders if warehouse_id exists
      let draftOrders: DraftOrder[] = [];
      if (result.data.plan?.warehouse_id && !signal?.aborted) {
        try {
          // ✅ Use API layer
          const draftResult = await apiFetchDraftOrders(
            result.data.plan.warehouse_id,
            undefined,
            true,
            signal
          );
          if (!signal?.aborted) {
            draftOrders = draftResult.data || [];
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('Error fetching draft orders:', err);
          }
        }
      }
      
      if (!signal?.aborted) {
        const editorData: EditorData = {
          plan: result.data.plan,
          warehouse: result.data.warehouse,
          trips: normalizedTrips,
          draftOrders,
        };
        
        setData(editorData);
        setOriginalData(structuredClone(editorData));
        setHasUnsavedChanges(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      console.error('Error loading editor data:', err);
      if (!signal?.aborted) {
        setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);
  
  const updateTrips = useCallback((trips: EditorTrip[]) => {
    setData(prev => ({ ...prev, trips }));
    setHasUnsavedChanges(true);
  }, []);
  
  const saveEditorData = useCallback(async (planId: number) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // ✅ Use API layer
      const result = await apiSaveEditorData(planId, {
        trips: data.trips.map(trip => ({
          trip_id: String(trip.trip_id),
          vehicle_id: trip.vehicle_id ? String(trip.vehicle_id) : null,
          driver_id: trip.driver_id ? String(trip.driver_id) : null,
          trip_index: trip.trip_sequence, // Use trip_sequence as trip_index
        })),
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Update original data after successful save
      setOriginalData(structuredClone(data));
      setHasUnsavedChanges(false);
      
      return { success: true };
    } catch (err: any) {
      console.error('Error saving editor data:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึก');
      }
      return { success: false, error: err.message };
    } finally {
      setIsSaving(false);
    }
  }, [data]);
  
  const resetChanges = useCallback(() => {
    if (originalData) {
      setData(structuredClone(originalData));
      setHasUnsavedChanges(false);
    }
  }, [originalData]);
  
  const clearData = useCallback(() => {
    setData({
      plan: null,
      warehouse: null,
      trips: [],
      draftOrders: [],
    });
    setOriginalData(null);
    setHasUnsavedChanges(false);
    setError(null);
  }, []);
  
  return {
    data,
    originalData,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    fetchEditorData,
    updateTrips,
    saveEditorData,
    resetChanges,
    clearData,
  };
}
