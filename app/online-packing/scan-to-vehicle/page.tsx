'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Truck, ArrowLeft, Package, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface ScannedPackage {
  id: string;
  tracking_number: string;
  order_number: string;
  buyer_name: string;
  platform: string;
  loaded_at: string;
}

interface ScanResult {
  success: boolean;
  message: string;
  package?: {
    id: string;
    tracking_number: string;
    order_number: string;
    buyer_name: string;
    platform: string;
  };
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ScanToVehiclePage() {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanInput, setScanInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [scannedPackages, setScannedPackages] = useState<ScannedPackage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  // Audio context for beep sounds
  const playSound = useCallback((type: 'success' | 'error') => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      if (type === 'success') {
        // Success: High pitch beep
        oscillator.frequency.value = 1000;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2);
      } else {
        // Error: Low pitch double beep
        oscillator.frequency.value = 300;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15);
        
        // Second beep
        setTimeout(() => {
          const osc2 = context.createOscillator();
          const gain2 = context.createGain();
          osc2.connect(gain2);
          gain2.connect(context.destination);
          osc2.frequency.value = 300;
          osc2.type = 'sawtooth';
          gain2.gain.setValueAtTime(0.3, context.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.15);
          osc2.start(context.currentTime);
          osc2.stop(context.currentTime + 0.15);
        }, 150);
      }
    } catch (error) {
      console.warn('Audio not supported:', error);
    }
  }, []);

  // Load already loaded packages for today
  const loadTodayScanned = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      const { data, error } = await supabase
        .from('packing_backup_orders')
        .select('id, tracking_number, order_number, buyer_name, platform, loaded_at')
        .gte('loaded_at', startOfDay)
        .lte('loaded_at', endOfDay)
        .order('loaded_at', { ascending: false });

      if (error) throw error;

      // Deduplicate by tracking_number
      const uniqueMap = new Map<string, ScannedPackage>();
      (data || []).forEach(pkg => {
        if (!uniqueMap.has(pkg.tracking_number)) {
          uniqueMap.set(pkg.tracking_number, pkg as ScannedPackage);
        }
      });

      const uniquePackages = Array.from(uniqueMap.values());
      setScannedPackages(uniquePackages);
      setTodayCount(uniquePackages.length);
    } catch (error) {
      console.error('Error loading today scanned:', error);
    }
  }, [supabase]);

  // Load total count of loaded packages
  const loadTotalCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('packing_backup_orders')
        .select('*', { count: 'exact', head: true })
        .not('loaded_at', 'is', null);

      if (error) throw error;
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading total count:', error);
    }
  }, [supabase]);

  // Initial load
  useEffect(() => {
    loadTodayScanned();
    loadTotalCount();
    
    // Focus input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [loadTodayScanned, loadTotalCount]);

  // Keep input focused
  useEffect(() => {
    const handleClick = () => {
      if (!isProcessing && inputRef.current) {
        inputRef.current.focus();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isProcessing]);

  // Handle scan
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim() || isProcessing) return;

    const trackingNumber = scanInput.trim();
    setScanInput('');
    setIsProcessing(true);
    setScanError('');
    setScanSuccess('');

    try {
      // Check if package exists in packing_backup_orders
      const { data: packages, error: findError } = await supabase
        .from('packing_backup_orders')
        .select('id, tracking_number, order_number, buyer_name, platform, loaded_at')
        .eq('tracking_number', trackingNumber)
        .limit(1);

      if (findError) throw findError;

      if (!packages || packages.length === 0) {
        setScanError(`ไม่พบพัสดุหมายเลข: ${trackingNumber}`);
        playSound('error');
        setIsProcessing(false);
        return;
      }

      // Check if already loaded (check all packages with this tracking number)
      const { data: allPackages, error: checkError } = await supabase
        .from('packing_backup_orders')
        .select('id, tracking_number, order_number, buyer_name, platform, loaded_at')
        .eq('tracking_number', trackingNumber);

      if (checkError) throw checkError;

      // Check if any package with this tracking number is already loaded
      const alreadyLoaded = allPackages?.find(p => p.loaded_at);
      if (alreadyLoaded) {
        setScanError(`พัสดุนี้ถูกสแกนขึ้นรถแล้วเมื่อ ${new Date(alreadyLoaded.loaded_at).toLocaleTimeString('th-TH')}`);
        playSound('error');
        setIsProcessing(false);
        // Focus back immediately
        inputRef.current?.focus();
        return;
      }

      // Get the first package that hasn't been loaded yet
      const pkg = allPackages?.find(p => !p.loaded_at);

      if (!pkg) {
        setScanError(`ไม่พบพัสดุหมายเลข: ${trackingNumber}`);
        playSound('error');
        setIsProcessing(false);
        inputRef.current?.focus();
        return;
      }

      // Update the package with loaded_at and loaded_by
      const { error: updateError } = await supabase
        .from('packing_backup_orders')
        .update({
          loaded_at: new Date().toISOString(),
          loaded_by: 'System User' // TODO: Replace with actual user
        })
        .eq('id', pkg.id);

      if (updateError) throw updateError;

      // Success
      setScanSuccess(`สแกนขึ้นรถสำเร็จ: ${trackingNumber}`);
      playSound('success');

      // Add to scanned list
      const newPackage: ScannedPackage = {
        id: pkg.id,
        tracking_number: pkg.tracking_number,
        order_number: pkg.order_number,
        buyer_name: pkg.buyer_name,
        platform: pkg.platform,
        loaded_at: new Date().toISOString()
      };

      setScannedPackages(prev => [newPackage, ...prev]);
      setTodayCount(prev => prev + 1);
      setTotalCount(prev => prev + 1);

      // Clear success message after 2 seconds
      setTimeout(() => {
        setScanSuccess('');
      }, 2000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setScanError(`เกิดข้อผิดพลาด: ${error.message}`);
      playSound('error');
    } finally {
      // Focus input immediately for next scan
      inputRef.current?.focus();
      // Quick reset for continuous scanning
      setIsProcessing(false);
    }
  };

  // Format time for display
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get platform color
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'Shopee Thailand':
        return 'text-orange-600 bg-orange-50';
      case 'TikTok Shop':
        return 'text-gray-800 bg-gray-100';
      case 'Lazada Thailand':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-thai">
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-6 text-center mx-4">
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-800 font-thai">กำลังบันทึก...</p>
            <p className="text-sm text-gray-500 font-thai mt-1">กรุณารอสักครู่</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/online-packing')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium font-thai">กลับ</span>
          </button>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-600" />
            <h1 className="text-lg font-bold text-gray-800 font-thai">สแกนขึ้นรถ</h1>
          </div>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Scan Input Section */}
      <section className="bg-white px-4 py-4 border-b border-gray-200">
        <form onSubmit={handleScan} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-700 font-thai mb-1.5 block">
              สแกนหมายเลข Tracking
            </label>
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              readOnly={isProcessing}
              className="w-full px-4 py-3 text-base font-mono rounded-lg border-2 transition-all duration-200 bg-white font-thai focus:outline-none"
              style={{
                borderColor: scanError ? '#ef4444' : scanSuccess ? '#22c55e' : '#d1d5db',
                boxShadow: scanError ? '0 0 0 3px rgba(239, 68, 68, 0.2)' : scanSuccess ? '0 0 0 3px rgba(34, 197, 94, 0.2)' : 'none'
              }}
              placeholder="พิมพ์หรือสแกนหมายเลข Tracking..."
              autoFocus
            />
          </div>

          {/* Status Messages */}
          {scanError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <XCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium font-thai">{scanError}</p>
            </div>
          )}

          {scanSuccess && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium font-thai">{scanSuccess}</p>
            </div>
          )}
        </form>
      </section>

      {/* Statistics */}
      <section className="bg-gradient-to-r from-primary-50 to-primary-100 px-4 py-4 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 font-thai mb-1">วันนี้</p>
            <p className="text-3xl font-bold text-primary-600">{todayCount}</p>
            <p className="text-xs text-gray-400 font-thai">แพ็ค</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 font-thai mb-1">ทั้งหมด</p>
            <p className="text-3xl font-bold text-green-600">{totalCount}</p>
            <p className="text-xs text-gray-400 font-thai">แพ็ค</p>
          </div>
        </div>
      </section>

      {/* Scanned Packages List */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700 font-thai flex items-center gap-2">
            <Package className="w-4 h-4" />
            รายการที่สแกนวันนี้ ({scannedPackages.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {scannedPackages.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Truck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-thai text-sm">
                ยังไม่มีรายการสแกนวันนี้
              </p>
              <p className="text-gray-300 font-thai text-xs mt-1">
                สแกนพัสดุเพื่อบันทึกขึ้นรถ
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {scannedPackages.map((pkg, index) => (
                <div
                  key={pkg.id}
                  className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                    index === 0 ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-semibold text-gray-800 truncate">
                        {pkg.tracking_number}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getPlatformColor(pkg.platform)}`}>
                          {pkg.platform === 'Shopee Thailand' ? 'Shopee' : 
                           pkg.platform === 'TikTok Shop' ? 'TikTok' : 
                           pkg.platform === 'Lazada Thailand' ? 'Lazada' : pkg.platform}
                        </span>
                        <span className="text-xs text-gray-400">
                          {pkg.order_number}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-mono text-primary-600">
                        {formatTime(pkg.loaded_at)}
                      </p>
                      {index === 0 && (
                        <span className="text-[10px] text-green-600 font-medium">
                          ล่าสุด
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Instructions Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="text-center">
          <p className="text-xs text-gray-400 font-thai">
            สแกนหมายเลข Tracking ที่แพ็คสำเร็จแล้ว เพื่อบันทึกขึ้นรถ
          </p>
        </div>
      </footer>
    </div>
  );
}
