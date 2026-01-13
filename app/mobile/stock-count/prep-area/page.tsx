'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import MobileLayout from '@/components/layout/MobileLayout';
import {
  QrCode,
  Package,
  Trash2,
  ChevronRight,
  Loader2,
  Save,
  Plus,
  Minus,
  MapPin,
  ChevronDown,
} from 'lucide-react';

interface PrepArea {
  area_id: string;
  area_code: string;
  area_name: string;
}

interface CountedItem {
  id: string;
  sku_code: string;
  sku_name: string;
  quantity: number;
  prep_area_code: string;
  scanned_at: string;
}

interface Session {
  id: number;
  session_code: string;
  status: string;
  total_items: number;
}

// เสียง success + vibration
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
  } catch (e) {
    console.log('Audio not supported');
  }
  
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  } catch (e) {
    console.log('Vibration not supported');
  }
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
    setTimeout(() => { oscillator.frequency.value = 400; }, 300);
    setTimeout(() => { oscillator.stop(); audioContext.close(); }, 450);
  } catch (e) {
    console.log('Audio not supported');
  }
};

export default function PrepAreaStockCountPage() {
  const { user } = useAuthContext();
  const skuInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prepAreas, setPrepAreas] = useState<PrepArea[]>([]);
  const [selectedPrepArea, setSelectedPrepArea] = useState<PrepArea | null>(null);
  const [showPrepAreaPicker, setShowPrepAreaPicker] = useState(false);
  const [countedItems, setCountedItems] = useState<CountedItem[]>([]);
  const [skuInput, setSkuInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [currentSku, setCurrentSku] = useState<{ code: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadPrepAreas();
    loadActiveSession();
  }, []);

  useEffect(() => {
    if (session && selectedPrepArea && !saving && !currentSku) {
      setTimeout(() => skuInputRef.current?.focus(), 100);
    }
  }, [session, selectedPrepArea, saving, currentSku]);

  const loadPrepAreas = async () => {
    try {
      const res = await fetch('/api/stock-count/prep-area/areas');
      const data = await res.json();
      if (data.success) {
        setPrepAreas(data.data || []);
      }
    } catch (error) {
      console.error('Error loading prep areas:', error);
    }
  };

  const loadActiveSession = async () => {
    try {
      const res = await fetch('/api/stock-count/prep-area/sessions?status=in_progress');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const activeSession = data.data[0];
        setSession(activeSession);
        // โหลดรายการที่นับไปแล้ว
        await loadSessionItems(activeSession.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadSessionItems = async (sessionId: number) => {
    try {
      const res = await fetch(`/api/stock-count/prep-area/sessions/${sessionId}/items`);
      const data = await res.json();
      if (data.success) {
        setCountedItems(data.data || []);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const createNewSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock-count/prep-area/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        setCountedItems([]);
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

  // สแกน SKU barcode
  const handleSkuScan = useCallback(async () => {
    const code = skuInput.trim().toUpperCase();
    if (!code) return;

    setSaving(true);
    try {
      // ตรวจสอบ SKU ในระบบ
      const res = await fetch(`/api/stock-count/prep-area/sku?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      
      if (data.success && data.sku) {
        setCurrentSku({ code: data.sku.sku_id, name: data.sku.sku_name });
        setSkuInput('');
        setQtyInput('');
        playSuccessSound();
        setMessage({ type: 'info', text: `${data.sku.sku_name}` });
        setTimeout(() => qtyInputRef.current?.focus(), 100);
      } else {
        playErrorSound();
        setMessage({ type: 'error', text: 'ไม่พบ SKU ในระบบ' });
        setSkuInput('');
        skuInputRef.current?.focus();
      }
    } catch (error) {
      console.error('Error checking SKU:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
    }
  }, [skuInput]);

  // บันทึกจำนวน
  const handleSaveQuantity = useCallback(async () => {
    if (!session || !currentSku || !selectedPrepArea || saving) return;
    
    const qty = parseInt(qtyInput) || 0;
    if (qty <= 0) {
      setMessage({ type: 'error', text: 'กรุณาใส่จำนวน' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/stock-count/prep-area/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          sku_code: currentSku.code,
          sku_name: currentSku.name,
          quantity: qty,
          prep_area_code: selectedPrepArea.area_code,
          counted_by: user?.user_id
        })
      });
      const data = await res.json();
      
      if (data.success) {
        playSuccessSound();
        // เพิ่มเข้ารายการ
        const newItem: CountedItem = {
          id: data.data.id,
          sku_code: currentSku.code,
          sku_name: currentSku.name,
          quantity: qty,
          prep_area_code: selectedPrepArea.area_code,
          scanned_at: new Date().toISOString()
        };
        setCountedItems(prev => [newItem, ...prev]);
        setSession(prev => prev ? { ...prev, total_items: (prev.total_items || 0) + 1 } : null);
        
        // รีเซ็ตเพื่อสแกนต่อ
        setCurrentSku(null);
        setQtyInput('');
        setMessage({ type: 'success', text: `✓ บันทึก ${currentSku.name} x ${qty}` });
        setTimeout(() => skuInputRef.current?.focus(), 100);
      } else {
        setMessage({ type: 'error', text: data.error || 'บันทึกไม่สำเร็จ' });
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
    }
  }, [session, currentSku, selectedPrepArea, qtyInput, user?.user_id, saving]);

  // ลบรายการ
  const handleDeleteItem = async (itemId: string) => {
    if (!session) return;
    
    try {
      const res = await fetch(`/api/stock-count/prep-area/items/${itemId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        setCountedItems(prev => prev.filter(i => i.id !== itemId));
        setSession(prev => prev ? { ...prev, total_items: Math.max(0, (prev.total_items || 0) - 1) } : null);
        setMessage({ type: 'info', text: 'ลบแล้ว' });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  // จบรอบนับ
  const completeSession = async () => {
    if (!session) return;
    
    try {
      const res = await fetch(`/api/stock-count/prep-area/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'จบรอบนับแล้ว' });
        setSession(null);
        setCountedItems([]);
        setCurrentSku(null);
        setSelectedPrepArea(null);
      }
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  // ยกเลิก SKU ที่กำลังใส่จำนวน
  const cancelCurrentSku = () => {
    setCurrentSku(null);
    setQtyInput('');
    setMessage(null);
    skuInputRef.current?.focus();
  };

  // ปรับจำนวน +/-
  const adjustQty = (delta: number) => {
    const current = parseInt(qtyInput) || 0;
    const newQty = Math.max(1, current + delta);
    setQtyInput(newQty.toString());
  };

  // เปลี่ยนบ้านหยิบ
  const handleSelectPrepArea = (area: PrepArea) => {
    setSelectedPrepArea(area);
    setShowPrepAreaPicker(false);
    setMessage({ type: 'info', text: `เลือก: ${area.area_code}` });
  };

  // นับรายการตามบ้านหยิบที่เลือก
  const filteredItems = selectedPrepArea 
    ? countedItems.filter(i => i.prep_area_code === selectedPrepArea.area_code)
    : countedItems;

  return (
    <MobileLayout title="นับสต็อกบ้านหยิบ" showBackButton>
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
            <p className="text-gray-700 font-thai font-semibold">กำลังบันทึก...</p>
          </div>
        </div>
      )}

      {/* Prep Area Picker Modal */}
      {showPrepAreaPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-h-[70vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-thai font-bold text-lg">เลือกบ้านหยิบ</h3>
              <button 
                onClick={() => setShowPrepAreaPicker(false)}
                className="p-2 text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {prepAreas.map((area) => (
                <button
                  key={area.area_id}
                  onClick={() => handleSelectPrepArea(area)}
                  className={`w-full p-3 mb-2 rounded-xl text-left border-2 transition-colors ${
                    selectedPrepArea?.area_id === area.area_id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <p className="font-mono font-bold text-gray-900">{area.area_code}</p>
                  <p className="text-xs text-gray-500 truncate">{area.area_name}</p>
                </button>
              ))}
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
              <span className="text-sm font-bold text-orange-600">{countedItems.length} รายการ</span>
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
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <Package className="w-16 h-16 text-orange-200 mx-auto mb-3" />
            <p className="text-gray-500 font-thai text-sm mb-4">
              นับสต็อกบ้านหยิบ - เลือกบ้านหยิบ แล้วสแกน SKU
            </p>
            <button
              onClick={createNewSession}
              disabled={loading}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-thai text-base font-semibold disabled:opacity-50"
            >
              {loading ? 'กำลังสร้าง...' : 'เริ่มนับ'}
            </button>
          </div>
        )}

        {/* Prep Area Selector */}
        {session && (
          <button
            onClick={() => setShowPrepAreaPicker(true)}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 text-white flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs opacity-80">บ้านหยิบ</p>
                {selectedPrepArea ? (
                  <p className="font-mono font-bold">{selectedPrepArea.area_code}</p>
                ) : (
                  <p className="font-thai">กดเพื่อเลือก...</p>
                )}
              </div>
            </div>
            <ChevronDown className="w-5 h-5" />
          </button>
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

        {/* SKU Scan Input - แสดงเมื่อเลือกบ้านหยิบแล้ว */}
        {session && selectedPrepArea && !currentSku && (
          <div className="bg-white rounded-xl shadow-sm p-3">
            <p className="text-xs text-gray-500 font-thai mb-2">สแกนบาร์โค้ดสินค้า</p>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <input
                ref={skuInputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSkuScan()}
                placeholder="สแกน SKU"
                className="flex-1 px-3 py-2 border rounded-xl text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                onClick={handleSkuScan}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Prompt to select prep area */}
        {session && !selectedPrepArea && (
          <div className="bg-orange-50 rounded-xl p-4 text-center border-2 border-orange-200 border-dashed">
            <MapPin className="w-10 h-10 text-orange-300 mx-auto mb-2" />
            <p className="text-orange-700 font-thai font-semibold">
              กรุณาเลือกบ้านหยิบก่อน
            </p>
            <p className="text-orange-600 font-thai text-xs mt-1">
              กดปุ่มด้านบนเพื่อเลือก
            </p>
          </div>
        )}

        {/* Quantity Input */}
        {session && currentSku && selectedPrepArea && (
          <div className="bg-orange-50 rounded-xl shadow-sm p-3 border-2 border-orange-300">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-orange-600 font-thai">SKU</p>
                <p className="font-mono font-bold text-orange-700">{currentSku.code}</p>
                <p className="text-sm text-gray-600 truncate">{currentSku.name}</p>
              </div>
              <button
                onClick={cancelCurrentSku}
                className="p-2 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 font-thai mb-2">จำนวนที่นับได้ (ชิ้น)</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustQty(-1)}
                className="p-3 bg-gray-200 rounded-xl"
              >
                <Minus className="w-5 h-5" />
              </button>
              <input
                ref={qtyInputRef}
                type="number"
                inputMode="numeric"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveQuantity()}
                placeholder="0"
                className="flex-1 px-3 py-3 border-2 border-orange-300 rounded-xl text-2xl text-center font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                onClick={() => adjustQty(1)}
                className="p-3 bg-gray-200 rounded-xl"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            <button
              onClick={handleSaveQuantity}
              disabled={saving || !qtyInput || parseInt(qtyInput) <= 0}
              className="w-full mt-3 py-3 bg-orange-500 text-white rounded-xl font-thai font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              บันทึก
            </button>
          </div>
        )}

        {/* Counted Items List */}
        {session && countedItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-2 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-600 font-thai">
                รายการที่นับแล้ว ({selectedPrepArea ? filteredItems.length : countedItems.length})
              </p>
              {selectedPrepArea && filteredItems.length !== countedItems.length && (
                <p className="text-xs text-gray-400 font-thai">
                  ทั้งหมด {countedItems.length}
                </p>
              )}
            </div>
            <div className="max-h-[35vh] overflow-y-auto divide-y divide-gray-100">
              {(selectedPrepArea ? filteredItems : countedItems).map((item) => (
                <div key={item.id} className="p-2 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold text-gray-700">{item.sku_code}</p>
                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">
                        {item.prep_area_code}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{item.sku_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-orange-600">{item.quantity}</span>
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
        {session && selectedPrepArea && countedItems.length === 0 && !currentSku && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <QrCode className="w-12 h-12 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 font-thai text-sm">
              สแกนบาร์โค้ดสินค้าเพื่อเริ่มนับ
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
