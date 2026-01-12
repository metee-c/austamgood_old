'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import MobileLayout from '@/components/layout/MobileLayout';
import {
  QrCode,
  Package,
  Check,
  X,
  AlertTriangle,
  Plus,
  ChevronRight,
  Loader2,
  List,
  Volume2,
} from 'lucide-react';

interface CountItem {
  id: number;
  location_code: string;
  expected_pallet_id: string | null;
  expected_sku_code: string | null;
  expected_sku_name: string | null;
  expected_quantity: number | null;
  scanned_pallet_id: string | null;
  status: 'pending' | 'matched' | 'mismatched' | 'empty' | 'extra';
}

interface Session {
  id: number;
  session_code: string;
  status: string;
  matched_count: number;
  mismatched_count: number;
  empty_count: number;
  extra_count: number;
}

interface MismatchInfo {
  expected: string;
  scanned: string;
  expectedSku: string | null;
  scannedSku: string | null;
}

type ScanMode = 'location' | 'pallet' | 'extra';

// เสียงเตือน error
const playErrorSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 400; // ความถี่ต่ำ = เสียงเตือน
    oscillator.type = 'square';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    
    // เล่น 3 ครั้ง
    setTimeout(() => { oscillator.frequency.value = 300; }, 150);
    setTimeout(() => { oscillator.frequency.value = 400; }, 300);
    setTimeout(() => { oscillator.frequency.value = 300; }, 450);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 600);
  } catch (e) {
    console.log('Audio not supported');
  }
};

// เสียง success + vibration
const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // ความถี่สูง = เสียงสำเร็จ
    oscillator.type = 'sine';
    gainNode.gain.value = 0.2;
    
    oscillator.start();
    
    // เสียงขึ้น 2 โน้ต
    setTimeout(() => { oscillator.frequency.value = 1000; }, 100);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 200);
  } catch (e) {
    console.log('Audio not supported');
  }
  
  // Vibration - สั่นสั้นๆ
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]); // สั่น 50ms, หยุด 30ms, สั่น 50ms
    }
  } catch (e) {
    console.log('Vibration not supported');
  }
};

export default function MobileStockCountPage() {
  const { user } = useAuthContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('location');
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [currentItems, setCurrentItems] = useState<CountItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [mismatchModal, setMismatchModal] = useState<MismatchInfo | null>(null);

  useEffect(() => {
    loadActiveSession();
  }, []);

  useEffect(() => {
    if (session && !scanning) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [session, scanMode, scanning]);

  const loadActiveSession = async () => {
    try {
      const res = await fetch('/api/stock-count/sessions?status=in_progress');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const activeSession = data.data[0];
        const detailRes = await fetch(`/api/stock-count/sessions/${activeSession.id}`);
        const detailData = await detailRes.json();
        if (detailData.success) {
          setSession(detailData.data);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const createNewSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock-count/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_id: 'WH001',
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      if (data.success) {
        const detailRes = await fetch(`/api/stock-count/sessions/${data.data.id}`);
        const detailData = await detailRes.json();
        if (detailData.success) {
          setSession(detailData.data);
          setMessage({ type: 'success', text: `เริ่มนับ: ${data.data.session_code}` });
        }
      }
    } catch (error) {
      console.error('Error creating session:', error);
      setMessage({ type: 'error', text: 'ไม่สามารถสร้างรอบนับได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationScan = useCallback(async (locationCode: string) => {
    if (!session || scanning) return;
    setScanning(true);
    try {
      const res = await fetch('/api/stock-count/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          scan_type: 'location',
          scanned_code: locationCode
        })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentLocation(locationCode);
        if (data.has_expected_items) {
          setCurrentItems(data.expected_items);
          setScanMode('pallet');
          setMessage({ type: 'info', text: `พบ ${data.expected_items.length} พาเลท - สแกนเทียบได้เลย` });
        } else {
          setCurrentItems([]);
          setScanMode('extra');
          setMessage({ type: 'info', text: 'ว่าง - สแกนพาเลทถ้ามี' });
        }
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error scanning location:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    } finally {
      setScanning(false);
    }
  }, [session, scanning]);

  // สแกนพาเลทแบบ checklist - หาตัวที่ตรงกันในรายการ
  const handlePalletScan = useCallback(async (palletId: string) => {
    if (!session || !currentLocation || scanning) return;

    // หาพาเลทที่ตรงกันในรายการ (ที่ยังไม่ได้สแกน)
    const matchingItem = currentItems.find(
      item => item.expected_pallet_id === palletId && item.status === 'pending'
    );

    // ตรวจสอบว่าสแกนซ้ำหรือไม่
    const alreadyScanned = currentItems.find(
      item => item.expected_pallet_id === palletId && item.status !== 'pending'
    );
    
    if (alreadyScanned) {
      setMessage({ type: 'error', text: 'สแกนพาเลทนี้แล้ว' });
      return;
    }

    // ถ้าไม่พบในรายการ - ถือว่าเป็น extra pallet
    if (!matchingItem) {
      await handleExtraPalletScan(palletId);
      return;
    }

    setScanning(true);
    try {
      const res = await fetch('/api/stock-count/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          scan_type: 'pallet',
          scanned_code: palletId,
          location_code: currentLocation,
          expected_item: {
            expected_pallet_id: matchingItem.expected_pallet_id,
            expected_sku_code: matchingItem.expected_sku_code,
            expected_sku_name: matchingItem.expected_sku_name,
            expected_quantity: matchingItem.expected_quantity
          },
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      if (data.success) {
        // เล่นเสียง success + vibration
        playSuccessSound();
        
        // อัปเดต item ที่ตรงกัน
        const updatedItems = currentItems.map(item => 
          item.id === matchingItem.id 
            ? { ...item, ...data.item, status: data.status }
            : item
        );
        setCurrentItems(updatedItems);

        // นับจำนวนที่เหลือ
        const remaining = updatedItems.filter(i => i.status === 'pending').length;
        
        if (remaining === 0) {
          setScanMode('extra');
          setMessage({ type: 'success', text: '✓ ครบทุกพาเลท - สแกนโลถัดไปหรือพาเลทเพิ่ม' });
        } else {
          setMessage({ type: 'success', text: `✓ เหลืออีก ${remaining} พาเลท` });
        }
        
        loadActiveSession();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error scanning pallet:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    } finally {
      setScanning(false);
    }
  }, [session, currentLocation, currentItems, user?.user_id, scanning]);

  const handleExtraPalletScan = useCallback(async (palletId: string) => {
    if (!session || !currentLocation || scanning) return;

    setScanning(true);
    try {
      // ตรวจสอบว่าเป็นโลเคชั่นหรือไม่
      const checkRes = await fetch(`/api/stock-count/locations?code=${encodeURIComponent(palletId)}`);
      const checkData = await checkRes.json();
      
      if (checkData.success && checkData.is_location) {
        setScanning(false);
        setScanMode('location');
        handleLocationScan(palletId);
        return;
      }

      // ถ้ายังมี pending items อยู่ - ถือว่าเป็น mismatch (สแกนพาเลทผิด)
      const pendingItems = currentItems.filter(i => i.status === 'pending');
      if (pendingItems.length > 0) {
        // ดึงข้อมูล SKU ของพาเลทที่สแกนมา
        const palletInfoRes = await fetch(`/api/stock-count/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            scan_type: 'check_pallet',
            scanned_code: palletId
          })
        });
        const palletInfo = await palletInfoRes.json();
        
        // เล่นเสียงเตือน
        playErrorSound();
        
        // แสดง modal - ใช้ pending item แรกเป็นตัวเทียบ
        const firstPending = pendingItems[0];
        setMismatchModal({
          expected: firstPending.expected_pallet_id || '',
          scanned: palletId,
          expectedSku: firstPending.expected_sku_name,
          scannedSku: palletInfo?.sku_name || 'ไม่พบในระบบ / พาเลทเพิ่ม'
        });
        
        // บันทึกเป็น extra
        const res = await fetch('/api/stock-count/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            scan_type: 'extra_pallet',
            scanned_code: palletId,
            location_code: currentLocation,
            counted_by: user?.user_id
          })
        });
        const data = await res.json();
        if (data.success) {
          loadActiveSession();
        }
        setScanning(false);
        return;
      }

      // ไม่มี pending items - บันทึกเป็น extra ปกติ
      const res = await fetch('/api/stock-count/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          scan_type: 'extra_pallet',
          scanned_code: palletId,
          location_code: currentLocation,
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'info', text: `+ พาเลทเพิ่ม: ${palletId.slice(-6)}` });
        loadActiveSession();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error scanning extra pallet:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    } finally {
      setScanning(false);
    }
  }, [session, currentLocation, currentItems, user?.user_id, handleLocationScan, scanning]);

  const handleScan = useCallback(() => {
    const code = scanInput.trim().toUpperCase();
    if (!code) return;
    setScanInput('');

    if (scanMode === 'location') {
      handleLocationScan(code);
    } else {
      // ทั้ง pallet และ extra mode ใช้ handlePalletScan เพราะจะตรวจสอบเองว่าอยู่ในรายการหรือไม่
      handlePalletScan(code);
    }
    inputRef.current?.focus();
  }, [scanInput, scanMode, handleLocationScan, handlePalletScan]);

  // กดปุ่มไม่มีของจริง - mark item เป็น empty
  const handleMarkEmpty = async (item: CountItem) => {
    if (!session || !currentLocation || scanning) return;

    setScanning(true);
    try {
      const res = await fetch('/api/stock-count/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          scan_type: 'pallet',
          scanned_code: 'INVALID_PALLET',
          location_code: currentLocation,
          expected_item: {
            expected_pallet_id: item.expected_pallet_id,
            expected_sku_code: item.expected_sku_code,
            expected_sku_name: item.expected_sku_name,
            expected_quantity: item.expected_quantity
          },
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      if (data.success) {
        const updatedItems = currentItems.map(i => 
          i.id === item.id ? { ...i, status: 'empty' as const } : i
        );
        setCurrentItems(updatedItems);

        const remaining = updatedItems.filter(i => i.status === 'pending').length;
        if (remaining === 0) {
          setScanMode('extra');
          setMessage({ type: 'success', text: 'ครบทุกพาเลท' });
        } else {
          setMessage({ type: 'info', text: `บันทึกว่าไม่มี - เหลือ ${remaining}` });
        }
        loadActiveSession();
      }
    } catch (error) {
      console.error('Error marking empty:', error);
    } finally {
      setScanning(false);
    }
  };

  const completeSession = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/stock-count/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'จบรอบ' });
        setSession(null);
        setCurrentLocation(null);
        setCurrentItems([]);
        setScanMode('location');
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const resetLocation = () => {
    setCurrentLocation(null);
    setCurrentItems([]);
    setScanMode('location');
    setMessage(null);
    inputRef.current?.focus();
  };

  const pendingCount = currentItems.filter(i => i.status === 'pending').length;
  const scannedCount = currentItems.filter(i => i.status !== 'pending').length;

  return (
    <MobileLayout title="นับสต็อก" showBackButton>
      {/* Loading Overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
            <p className="text-gray-700 font-thai font-semibold">กำลังบันทึก...</p>
          </div>
        </div>
      )}

      {/* Mismatch Modal - แสดงเมื่อสแกนไม่ตรง */}
      {mismatchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="bg-red-500 p-4 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <Volume2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white font-thai font-bold text-lg">พาเลทไม่ตรง!</p>
                <p className="text-red-100 text-sm font-thai">บันทึกแล้ว - ตรวจสอบภายหลัง</p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-3">
              {/* คาดหวัง */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-green-600 font-thai mb-1">คาดหวัง</p>
                <p className="font-mono font-bold text-green-700">{mismatchModal.expected}</p>
                <p className="text-xs text-green-600 truncate">{mismatchModal.expectedSku}</p>
              </div>
              
              {/* สแกนจริง */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs text-red-600 font-thai mb-1">สแกนจริง</p>
                <p className="font-mono font-bold text-red-700">{mismatchModal.scanned}</p>
                <p className="text-xs text-red-600 truncate">{mismatchModal.scannedSku}</p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t">
              <button
                onClick={() => {
                  setMismatchModal(null);
                  inputRef.current?.focus();
                }}
                className="w-full py-3 bg-red-500 text-white rounded-xl font-thai font-semibold"
              >
                รับทราบ
              </button>
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
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-600 font-bold">{session.matched_count}✓</span>
                <span className="text-red-600 font-bold">{(session.mismatched_count || 0) + (session.empty_count || 0)}✗</span>
                <span className="text-blue-600 font-bold">{session.extra_count}+</span>
              </div>
            </div>
            <button
              onClick={completeSession}
              className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-thai"
            >
              จบ
            </button>
          </div>
        )}

        {/* No Session */}
        {!session && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center space-y-3">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-3" />
            <button
              onClick={createNewSession}
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-thai text-base font-semibold disabled:opacity-50"
            >
              {loading ? 'กำลังสร้าง...' : 'เริ่มนับสต็อก'}
            </button>
            <a
              href="/mobile/stock-count/prep-area"
              className="block w-full py-3 bg-orange-500 text-white rounded-xl font-thai text-base font-semibold text-center"
            >
              นับสต็อกบ้านหยิบ
            </a>
            <a
              href="/mobile/stock-count/premium-packages"
              className="block w-full py-3 bg-purple-500 text-white rounded-xl font-thai text-base font-semibold text-center"
            >
              นับสต็อกบ้านหยิบพรีเมี่ยม
            </a>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`p-2 rounded-xl text-center font-thai text-sm font-semibold ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Scan Input */}
        {session && (
          <div className="bg-white rounded-xl shadow-sm p-2">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                inputMode="none"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                placeholder={scanMode === 'location' ? 'สแกนโลเคชั่น' : 'สแกนพาเลท'}
                className="flex-1 px-3 py-2 border rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={handleScan}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Current Location */}
        {currentLocation && (
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-2 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xs opacity-80">โลเคชั่น</span>
                <p className="text-xl font-bold font-mono">{currentLocation}</p>
              </div>
              {currentItems.length > 0 && (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-sm">
                  <List className="w-4 h-4" />
                  <span>{scannedCount}/{currentItems.length}</span>
                </div>
              )}
            </div>
            <button onClick={resetLocation} className="text-xs bg-white/20 px-2 py-1 rounded">
              เปลี่ยน
            </button>
          </div>
        )}

        {/* Pallet Table - แสดง Pallet ID เต็ม แยก 2 แถว */}
        {currentLocation && currentItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-2 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-600 font-thai">
                รายการ ({scannedCount}/{currentItems.length})
              </p>
              <p className="text-xs text-gray-500 font-thai">
                เหลือ {pendingCount}
              </p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
              {currentItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-2 ${
                    item.status === 'pending' ? 'bg-yellow-50' :
                    item.status === 'matched' ? 'bg-green-50' :
                    item.status === 'empty' ? 'bg-gray-50' :
                    'bg-red-50'
                  }`}
                >
                  {/* แถวบน: Pallet ID + สถานะ */}
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-mono text-sm font-bold ${
                      item.status === 'pending' ? 'text-yellow-700' :
                      item.status === 'matched' ? 'text-green-700' :
                      item.status === 'empty' ? 'text-gray-400 line-through' :
                      'text-red-700'
                    }`}>
                      {item.expected_pallet_id}
                    </p>
                    <div className="flex items-center gap-1">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => handleMarkEmpty(item)}
                          className="p-1 bg-yellow-200 text-yellow-700 rounded text-xs"
                          title="ไม่มีของจริง"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {item.status === 'matched' && (
                        <span className="inline-flex p-1 bg-green-200 text-green-700 rounded">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {item.status === 'empty' && (
                        <span className="inline-flex p-1 bg-gray-200 text-gray-500 rounded">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {item.status === 'mismatched' && (
                        <span className="inline-flex p-1 bg-red-200 text-red-700 rounded">
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  {/* แถวล่าง: SKU + จำนวน */}
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-gray-600 truncate flex-1 mr-2" title={item.expected_sku_name || ''}>
                      {item.expected_sku_name}
                    </p>
                    <p className="text-gray-500 whitespace-nowrap">
                      {item.expected_quantity} ชิ้น
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty Location */}
        {currentLocation && currentItems.length === 0 && scanMode === 'extra' && (
          <div className="bg-white rounded-xl shadow-sm p-3 text-center">
            <Plus className="w-8 h-8 text-gray-300 mx-auto mb-1" />
            <p className="text-gray-500 font-thai text-sm">
              ว่าง - สแกนพาเลทถ้ามี
            </p>
          </div>
        )}

        {/* All Done - can scan extra or next location */}
        {currentLocation && currentItems.length > 0 && pendingCount === 0 && (
          <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
            <Check className="w-8 h-8 text-green-500 mx-auto mb-1" />
            <p className="text-green-700 font-thai text-sm font-semibold">
              ครบทุกพาเลท
            </p>
            <p className="text-green-600 font-thai text-xs">
              สแกนโลเคชั่นถัดไป หรือสแกนพาเลทเพิ่มถ้ามี
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
