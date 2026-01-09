'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import MobileLayout from '@/components/layout/MobileLayout';
import {
  QrCode,
  Package,
  MapPin,
  Check,
  X,
  AlertTriangle,
  Plus,
  ChevronRight,
  RotateCcw
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
  total_locations: number;
  matched_count: number;
  mismatched_count: number;
  empty_count: number;
  extra_count: number;
  items?: CountItem[];
}

type ScanMode = 'location' | 'pallet' | 'extra';

export default function MobileStockCountPage() {
  const { user } = useAuthContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('location');
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [currentItems, setCurrentItems] = useState<CountItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [scanInput, setScanInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadActiveSession();
  }, []);

  // Auto focus input
  useEffect(() => {
    if (session) {
      inputRef.current?.focus();
    }
  }, [session, scanMode, currentItemIndex]);

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
          setMessage({ type: 'success', text: `เริ่มนับสต็อก: ${data.data.session_code}` });
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
    if (!session) return;

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
          setCurrentItemIndex(0);
          setScanMode('pallet');
          setMessage({ type: 'info', text: `พบ ${data.expected_items.length} พาเลท` });
        } else {
          setCurrentItems([]);
          setScanMode('extra');
          setMessage({ type: 'info', text: 'โลว่าง - สแกนพาเลทถ้ามี' });
        }
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error scanning location:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    }
  }, [session]);

  const handlePalletScan = useCallback(async (palletId: string) => {
    if (!session || !currentLocation) return;

    const currentItem = currentItems[currentItemIndex];
    if (!currentItem) return;

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
            expected_pallet_id: currentItem.expected_pallet_id,
            expected_sku_code: currentItem.expected_sku_code,
            expected_sku_name: currentItem.expected_sku_name,
            expected_quantity: currentItem.expected_quantity
          },
          counted_by: user?.user_id
        })
      });
      const data = await res.json();

      if (data.success) {
        const updatedItems = [...currentItems];
        updatedItems[currentItemIndex] = { ...currentItem, ...data.item };
        setCurrentItems(updatedItems);

        if (currentItemIndex < currentItems.length - 1) {
          setCurrentItemIndex(currentItemIndex + 1);
          setMessage({ 
            type: data.status === 'matched' ? 'success' : 'error', 
            text: data.status === 'matched' ? '✓ ถูกต้อง' : '✗ ไม่ตรง'
          });
        } else {
          setScanMode('extra');
          setMessage({ type: 'success', text: 'นับครบ - สแกนโลถัดไป' });
        }

        loadActiveSession();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error scanning pallet:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    }
  }, [session, currentLocation, currentItems, currentItemIndex, user?.user_id]);

  const handleExtraPalletScan = useCallback(async (palletId: string) => {
    if (!session || !currentLocation) return;

    // ถ้าเป็นโลเคชั่น ให้ไปสแกนโลเคชั่นใหม่ (ตรวจสอบจาก API แทน regex)
    // ไม่ใช้ regex เพราะมีหลายรูปแบบมาก

    try {
      // ตรวจสอบก่อนว่าเป็นโลเคชั่นหรือไม่
      const checkRes = await fetch(`/api/stock-count/locations?code=${encodeURIComponent(palletId)}`);
      const checkData = await checkRes.json();
      
      if (checkData.success && checkData.is_location) {
        // เป็นโลเคชั่น - ไปสแกนโลเคชั่นใหม่
        setScanMode('location');
        handleLocationScan(palletId);
        return;
      }

      // ไม่ใช่โลเคชั่น - บันทึกเป็น extra pallet
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
        setMessage({ type: 'info', text: '+ บันทึกพาเลทเพิ่ม' });
        loadActiveSession();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error scanning extra pallet:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    }
  }, [session, currentLocation, user?.user_id, handleLocationScan]);

  const handleScan = useCallback(() => {
    const code = scanInput.trim().toUpperCase();
    if (!code) return;

    setScanInput('');

    if (scanMode === 'location') {
      // ส่งไป API ตรวจสอบว่าเป็นโลเคชั่นจริงหรือไม่
      handleLocationScan(code);
    } else if (scanMode === 'pallet') {
      handlePalletScan(code);
    } else if (scanMode === 'extra') {
      // ส่งไป API ตรวจสอบ - ถ้าเป็นโลเคชั่นจะ redirect ไปสแกนโลเคชั่นใหม่
      handleExtraPalletScan(code);
    }

    inputRef.current?.focus();
  }, [scanInput, scanMode, handleLocationScan, handlePalletScan, handleExtraPalletScan]);

  const handleInvalidPallet = () => {
    handlePalletScan('INVALID_PALLET');
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
        setMessage({ type: 'success', text: 'จบรอบนับสต็อก' });
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
    setCurrentItemIndex(0);
    setScanMode('location');
    setMessage(null);
    inputRef.current?.focus();
  };

  const currentItem = currentItems[currentItemIndex];

  return (
    <MobileLayout title="นับสต็อก" showBackButton>
      <div className="p-4 space-y-4">
        {/* Session Summary */}
        {session && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500">{session.session_code}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-green-600 font-bold">{session.matched_count}✓</span>
                  <span className="text-red-600 font-bold">{session.mismatched_count + session.empty_count}✗</span>
                  <span className="text-blue-600 font-bold">{session.extra_count}+</span>
                </div>
              </div>
              <button
                onClick={completeSession}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-thai"
              >
                จบรอบ
              </button>
            </div>
          </div>
        )}

        {/* No Session */}
        {!session && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Package className="w-20 h-20 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-thai mb-6">ยังไม่มีรอบนับสต็อก</p>
            <button
              onClick={createNewSession}
              disabled={loading}
              className="w-full py-4 bg-primary-600 text-white rounded-2xl font-thai text-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'กำลังสร้าง...' : 'เริ่มนับสต็อก'}
            </button>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-2xl text-center font-thai text-lg font-semibold ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Scan Input */}
        {session && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="w-6 h-6 text-primary-600" />
              <span className="font-thai font-semibold">
                {scanMode === 'location' ? 'สแกนโลเคชั่น' :
                 scanMode === 'pallet' ? 'สแกนพาเลท' :
                 'สแกนโลถัดไป'}
              </span>
              {currentLocation && (
                <button onClick={resetLocation} className="ml-auto p-2 text-gray-400">
                  <RotateCcw className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                placeholder={scanMode === 'location' ? 'A01-01-001' : 'PAL-XXXXXX'}
                className="flex-1 px-4 py-4 border-2 rounded-2xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
              <button
                onClick={handleScan}
                className="px-6 py-4 bg-primary-600 text-white rounded-2xl"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Current Location Info */}
        {currentLocation && (
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5" />
              <span className="font-thai">โลเคชั่น</span>
            </div>
            <p className="text-3xl font-bold font-mono">{currentLocation}</p>
          </div>
        )}

        {/* Current Item to Scan */}
        {scanMode === 'pallet' && currentItem && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 font-thai">
                รายการ {currentItemIndex + 1}/{currentItems.length}
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-thai">
                รอสแกน
              </span>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 font-thai mb-1">พาเลทที่ต้องสแกน</p>
              <p className="text-2xl font-bold font-mono text-primary-600">
                {currentItem.expected_pallet_id}
              </p>
              <p className="text-sm text-gray-600 mt-2">{currentItem.expected_sku_name}</p>
              <p className="text-xs text-gray-400">จำนวน: {currentItem.expected_quantity}</p>
            </div>

            <button
              onClick={handleInvalidPallet}
              className="w-full py-4 bg-yellow-100 text-yellow-700 rounded-2xl font-thai font-semibold flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-5 h-5" />
              ของจริงไม่มี
            </button>
          </div>
        )}

        {/* Scanned Items Summary */}
        {currentItems.length > 0 && currentItems.some(i => i.status !== 'pending') && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm text-gray-500 font-thai mb-3">ผลการนับ</p>
            <div className="space-y-2">
              {currentItems.filter(i => i.status !== 'pending').map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    item.status === 'matched' ? 'bg-green-50' :
                    item.status === 'empty' ? 'bg-yellow-50' : 'bg-red-50'
                  }`}
                >
                  <span className="font-mono text-sm">{item.expected_pallet_id}</span>
                  {item.status === 'matched' && <Check className="w-5 h-5 text-green-600" />}
                  {item.status === 'empty' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                  {item.status === 'mismatched' && <X className="w-5 h-5 text-red-600" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty Location - Can add extra */}
        {scanMode === 'extra' && currentItems.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <Plus className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-thai">
              โลเคชั่นว่าง<br/>
              <span className="text-sm">สแกนพาเลทถ้ามีของจริง</span>
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
