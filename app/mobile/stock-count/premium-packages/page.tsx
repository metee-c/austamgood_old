'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import MobileLayout from '@/components/layout/MobileLayout';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Package,
  Trash2,
  ChevronRight,
  Loader2,
  MapPin,
  ChevronDown,
  Check,
  AlertTriangle,
  Gift,
  Camera,
  X,
} from 'lucide-react';

interface Location {
  code: string;
}

interface ScannedItem {
  id: number;
  barcode_id: string;
  face_sheet_no: string;
  pack_no: string;
  shop_name: string;
  hub: string;
  expected_location: string;
  actual_location: string;
  location_match: boolean;
  created_at: string;
}

interface Session {
  id: number;
  session_code: string;
  location_code: string;
  status: string;
  total_packages: number;
}

// เสียง success
const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.2;
    oscillator.start();
    setTimeout(() => { oscillator.frequency.value = 1000; }, 100);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 200);
  } catch (e) { console.log('Audio not supported'); }
  try { if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]); } catch (e) {}
};

// เสียง error
const playErrorSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 400;
    oscillator.type = 'square';
    gainNode.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => { oscillator.frequency.value = 300; }, 150);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 300);
  } catch (e) { console.log('Audio not supported'); }
};

export default function PremiumPackageCountPage() {
  const { user } = useAuthContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>('');
  const scanCooldownRef = useRef<boolean>(false);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  
  // Camera scanner states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [cameraScanCount, setCameraScanCount] = useState(0);

  useEffect(() => {
    loadLocations();
    loadActiveSession();
  }, []);

  useEffect(() => {
    if (session && selectedLocation && !scanning && !showCamera) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [session, selectedLocation, scanning, showCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const loadLocations = async () => {
    try {
      const res = await fetch('/api/stock-count/premium-packages/locations');
      const data = await res.json();
      if (data.success) {
        setLocations(data.data || []);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const loadActiveSession = async () => {
    try {
      const res = await fetch('/api/stock-count/premium-packages/sessions?status=in_progress');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const activeSession = data.data[0];
        setSession(activeSession);
        setSelectedLocation(activeSession.location_code);
        await loadSessionItems(activeSession.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadSessionItems = async (sessionId: number) => {
    try {
      const res = await fetch(`/api/stock-count/premium-packages/items?session_id=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setScannedItems(data.data || []);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const createNewSession = async () => {
    if (!selectedLocation) {
      setMessage({ type: 'error', text: 'กรุณาเลือกโลเคชั่นก่อน' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/stock-count/premium-packages/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_code: selectedLocation,
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        setScannedItems([]);
        setMessage({ type: 'success', text: `เริ่มนับ: ${data.data.session_code}` });
      } else {
        setMessage({ type: 'error', text: data.error || 'ไม่สามารถสร้างรอบนับได้' });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      setMessage({ type: 'error', text: 'ไม่สามารถสร้างรอบนับได้' });
    } finally {
      setLoading(false);
    }
  };

  // Process scanned barcode (shared between manual input and camera)
  const processScan = useCallback(async (code: string) => {
    if (!code || !session) return false;

    try {
      const res = await fetch('/api/stock-count/premium-packages/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          barcode_id: code,
          counted_by: user?.user_id
        })
      });
      const data = await res.json();

      if (data.success) {
        playSuccessSound();
        setScannedItems(prev => [data.data, ...prev]);
        setSession(prev => prev ? { ...prev, total_packages: (prev.total_packages || 0) + 1 } : null);
        
        if (data.location_match) {
          setMessage({ type: 'success', text: data.message });
        } else {
          setMessage({ type: 'warning', text: data.message });
        }
        return true;
      } else {
        playErrorSound();
        if (data.duplicate) {
          setMessage({ type: 'error', text: 'สแกนแพ็คนี้แล้ว' });
        } else if (data.not_found) {
          setMessage({ type: 'error', text: 'ไม่พบแพ็คในระบบ' });
        } else {
          setMessage({ type: 'error', text: data.error });
        }
        return false;
      }
    } catch (error) {
      console.error('Error scanning:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
      return false;
    }
  }, [session, user?.user_id]);

  const handleScan = useCallback(async () => {
    const code = scanInput.trim().toUpperCase();
    if (!code || !session || scanning) return;

    setScanInput('');
    setScanning(true);
    await processScan(code);
    setScanning(false);
    inputRef.current?.focus();
  }, [scanInput, session, scanning, processScan]);

  // Camera scan handler
  const handleCameraScan = useCallback(async (decodedText: string) => {
    const code = decodedText.trim().toUpperCase();
    
    // Prevent duplicate scans (same barcode within 2 seconds)
    if (code === lastScannedRef.current || scanCooldownRef.current) {
      return;
    }

    lastScannedRef.current = code;
    scanCooldownRef.current = true;

    // Show success popup with spinner
    setLastScannedBarcode(code);
    setShowSuccessPopup(true);

    const success = await processScan(code);
    
    if (success) {
      setCameraScanCount(prev => prev + 1);
    }

    // Hide popup after 1 second
    setTimeout(() => {
      setShowSuccessPopup(false);
    }, 1000);

    // Reset cooldown after 1.5 seconds
    setTimeout(() => {
      scanCooldownRef.current = false;
    }, 1500);
  }, [processScan]);

  // Start camera
  const startCamera = useCallback(async () => {
    setShowCamera(true);
    setCameraReady(false);
    setCameraScanCount(0);
    lastScannedRef.current = '';

    // Wait for DOM to render
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const html5QrCode = new Html5Qrcode('camera-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.0,
        },
        handleCameraScan,
        () => {} // Ignore errors
      );

      setCameraReady(true);
    } catch (error) {
      console.error('Error starting camera:', error);
      setMessage({ type: 'error', text: 'ไม่สามารถเปิดกล้องได้' });
      setShowCamera(false);
    }
  }, [handleCameraScan]);

  // Stop camera
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.log('Camera already stopped');
      }
      html5QrCodeRef.current = null;
    }
    setShowCamera(false);
    setCameraReady(false);
    lastScannedRef.current = '';
  }, []);

  const handleDeleteItem = async (itemId: number) => {
    try {
      const res = await fetch(`/api/stock-count/premium-packages/items?id=${itemId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setScannedItems(prev => prev.filter(i => i.id !== itemId));
        setSession(prev => prev ? { ...prev, total_packages: Math.max(0, (prev.total_packages || 0) - 1) } : null);
        setMessage({ type: 'info', text: 'ลบแล้ว' });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const completeSession = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/stock-count/premium-packages/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'จบรอบนับแล้ว' });
        setSession(null);
        setScannedItems([]);
        setSelectedLocation(null);
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const handleSelectLocation = (code: string) => {
    setSelectedLocation(code);
    setShowLocationPicker(false);
    setMessage({ type: 'info', text: `เลือก: ${code}` });
  };

  return (
    <MobileLayout title="นับสต็อกบ้านหยิบพรีเมี่ยม" showBackButton>
      {/* Loading Overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            <p className="text-gray-700 font-thai font-semibold">กำลังบันทึก...</p>
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="bg-purple-600 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-6 h-6 text-white" />
              <div>
                <p className="text-white font-thai font-bold">สแกนกล้อง</p>
                <p className="text-purple-200 text-xs">สแกนแล้ว {cameraScanCount} แพ็ค</p>
              </div>
            </div>
            <button
              onClick={stopCamera}
              className="p-2 bg-white/20 rounded-full"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Camera View */}
          <div className="flex-1 relative">
            <div id="camera-reader" className="w-full h-full" />
            
            {/* Loading overlay while camera initializes */}
            {!cameraReady && (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-white font-thai">กำลังเปิดกล้อง...</p>
                </div>
              </div>
            )}

            {/* Success Popup - แสดงเมื่อสแกนสำเร็จ */}
            {showSuccessPopup && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-green-500 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 animate-pulse">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                    <Check className="w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-white font-thai font-bold">บันทึกแล้ว!</p>
                  <p className="text-green-100 text-xs font-mono">{lastScannedBarcode}</p>
                </div>
              </div>
            )}

            {/* Scan guide overlay */}
            {cameraReady && !showSuccessPopup && (
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white font-thai text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                  เล็งบาร์โค้ดในกรอบ
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-h-[70vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-thai font-bold text-lg">เลือกโลเคชั่น</h3>
              <button onClick={() => setShowLocationPicker(false)} className="p-2 text-gray-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {locations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-thai">
                  ไม่พบโลเคชั่น
                </div>
              ) : (
                locations.map((loc) => (
                  <button
                    key={loc.code}
                    onClick={() => handleSelectLocation(loc.code)}
                    className={`w-full p-3 mb-2 rounded-xl text-left border-2 transition-colors flex items-center justify-between ${
                      selectedLocation === loc.code
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <p className="font-mono font-bold text-gray-900">{loc.code}</p>
                    {selectedLocation === loc.code && (
                      <Check className="w-5 h-5 text-purple-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-2 space-y-2 pb-4">
        {/* Session Header */}
        {session && (
          <div className="bg-white rounded-xl shadow-sm p-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{session.session_code}</span>
              <span className="text-sm font-bold text-purple-600">{scannedItems.length} แพ็ค</span>
            </div>
            <button
              onClick={completeSession}
              className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-thai"
            >
              จบ
            </button>
          </div>
        )}

        {/* No Session - เลือกโลเคชั่นก่อน */}
        {!session && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
            <div className="text-center">
              <Gift className="w-12 h-12 text-purple-300 mx-auto mb-2" />
              <p className="text-gray-600 font-thai text-sm">
                นับแพ็คใบปะหน้าของแถมที่เหลืออยู่จริง
              </p>
            </div>

            {/* Location Selector */}
            <button
              onClick={() => setShowLocationPicker(true)}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-3 text-white flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-xs opacity-80">โลเคชั่น</p>
                  {selectedLocation ? (
                    <p className="font-mono font-bold">{selectedLocation}</p>
                  ) : (
                    <p className="font-thai">กดเพื่อเลือก...</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ChevronDown className="w-5 h-5" />
              </div>
            </button>

            <button
              onClick={createNewSession}
              disabled={loading || !selectedLocation}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-thai text-base font-semibold disabled:opacity-50"
            >
              {loading ? 'กำลังสร้าง...' : 'เริ่มนับ'}
            </button>
          </div>
        )}

        {/* Current Location Info */}
        {session && (
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              <div>
                <p className="text-xs opacity-80">โลเคชั่น</p>
                <p className="font-mono font-bold text-lg">{session.location_code}</p>
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`p-2 rounded-xl text-center font-thai text-sm font-semibold ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            message.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Scan Input */}
        {session && (
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-xs text-gray-500 font-thai mb-2">สแกนบาร์โค้ดแพ็คของแถม</p>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                inputMode="none"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                placeholder="BFS-XXXXXXXX-PXXX"
                className="flex-1 px-3 py-2 border rounded-xl text-base focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
              />
              {/* Camera Button */}
              <button
                onClick={startCamera}
                className="p-2 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200"
                title="เปิดกล้องสแกน"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Scanned Items List */}
        {session && scannedItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-2 border-b bg-gray-50">
              <p className="text-xs text-gray-600 font-thai">
                แพ็คที่สแกนแล้ว ({scannedItems.length})
              </p>
            </div>
            <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-100">
              {scannedItems.map((item) => (
                <div key={item.id} className={`p-2 ${item.location_match ? 'bg-white' : 'bg-yellow-50'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-bold text-gray-700">{item.barcode_id}</p>
                        {!item.location_match && (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{item.shop_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                          {item.face_sheet_no}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {item.hub}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {session && scannedItems.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 font-thai text-sm">
              สแกนบาร์โค้ดแพ็คของแถมเพื่อยืนยันว่ายังอยู่
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
