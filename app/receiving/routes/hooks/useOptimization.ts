import { useState, useCallback, useRef } from 'react';
import type { OptimizationSettings } from '@/components/vrp/OptimizationSidebar';
import { optimizeRoutePlan, ApiError } from '../api';

interface OptimizationResult {
  plan: any;
  trips: any[];
  metrics: {
    totalDistance: number;
    totalDuration: number;
    totalTrips: number;
    totalStops: number;
  };
}

export function useOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const optimizeLockRef = useRef<boolean>(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const optimize = useCallback(async (
    planData: {
      plan_code: string;
      plan_name: string;
      plan_date: string;
      warehouse_id: string;
    },
    orderIds: number[],
    settings: OptimizationSettings
  ) => {
    // Prevent concurrent optimization
    if (optimizeLockRef.current) {
      console.warn('Optimization already in progress');
      return { success: false, error: 'กำลังคำนวณอยู่ กรุณารอสักครู่' };
    }
    
    try {
      optimizeLockRef.current = true;
      setIsOptimizing(true);
      setProgress(0);
      setError(null);
      setResult(null);
      
      // Fake progress while waiting
      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);
      
      // ✅ Use API layer instead of direct fetch
      const data = await optimizeRoutePlan({
        plan: planData,
        order_ids: orderIds,
        settings: settings as any,
      });
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setProgress(100);
      
      setResult(data.data);
      
      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('Optimization error:', err);
      let errorMessage = 'เกิดข้อผิดพลาดในการคำนวณ';
      
      if (err instanceof ApiError) {
        errorMessage = err.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      optimizeLockRef.current = false;
      setIsOptimizing(false);
      setProgress(0);
    }
  }, []);
  
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);
  
  return {
    isOptimizing,
    progress,
    result,
    error,
    optimize,
    clearResult,
  };
}
