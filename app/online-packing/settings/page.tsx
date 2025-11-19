'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// --- TYPE DEFINITIONS ---
interface Box {
  id: string
  box_code: string
  box_name: string
  dimensions_length: number
  dimensions_width: number
  dimensions_height: number
}

interface ProductWeightProfile {
  id: string
  product_type_code: string
  weight_kg: number
  dimensions_length: number
  dimensions_width: number
  dimensions_height: number
}

interface PackingRule {
  id: string
  box_code: string
  primary_product_type_code: string
  rule_code: string
  components: { type: string; qty: number }[] | null
  notes: string | null
}

interface BoxStock {
  id: string
  box_code: string
  box_name: string
  current_stock: number
  min_stock_alert: number
  updated_at: string
}

interface PackingHistory {
  id: string;
  tracking_number: string;
  box_code: string;
  total_weight: number;
  total_volume: number;
  items_count: number;
  packed_by: string;
  packed_at: string;
  notes: string | null;
}

interface BoxStockHistory {
  id: string;
  box_stock_id: string;
  box_code: string;
  quantity_change: number;
  reason: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_by_name: string;
  created_at: string;
}


// --- MAIN PAGE COMPONENT ---
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('stock') // Default to stock tab
  const [isLoading, setIsLoading] = useState(true)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [profiles, setProfiles] = useState<ProductWeightProfile[]>([])
  const [rules, setRules] = useState<PackingRule[]>([])
  const [boxStocks, setBoxStocks] = useState<BoxStock[]>([])
  const [packingHistory, setPackingHistory] = useState<PackingHistory[]>([])
  const [boxStockHistory, setBoxStockHistory] = useState<BoxStockHistory[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const fetchData = async () => {
    const supabase = createClient()
    setIsLoading(true)
    try {
      const [
        boxesRes,
        profilesRes,
        rulesRes,
        stocksRes,
        stockHistoryRes
      ] = await Promise.all([
        supabase.from('packing_boxes').select('*').order('box_code'),
        supabase.from('packing_product_weight_profiles').select('*').order('weight_kg'),
        supabase.from('packing_packing_rules').select('*'),
        supabase.from('packing_box_stocks').select('*').order('box_code'),
        supabase.from('packing_box_stock_history').select('*').order('created_at', { ascending: false }).limit(100)
      ])

      if (boxesRes.error) console.error('Boxes error:', boxesRes.error)
      if (profilesRes.error) console.error('Profiles error:', profilesRes.error)
      if (rulesRes.error) console.error('Rules error:', rulesRes.error)
      if (stocksRes.error) console.error('Stock error:', stocksRes.error)
      if (stockHistoryRes.error) {
        console.error('Stock History error:', stockHistoryRes.error)
        // If box_stock_history table doesn't exist, set empty array
        setBoxStockHistory([])
      } else {
        console.log('Stock history data:', stockHistoryRes.data)
        setBoxStockHistory(stockHistoryRes.data || [])
      }

      // Only throw errors for critical tables
      if (boxesRes.error && !boxesRes.error.message.includes('does not exist')) throw boxesRes.error
      if (stocksRes.error && !stocksRes.error.message.includes('does not exist')) throw stocksRes.error

      setBoxes(boxesRes.data || [])
      setProfiles(profilesRes.data || [])
      setRules(rulesRes.data || [])
      setBoxStocks(stocksRes.data || [])

    } catch (error) {
      console.error('Error loading settings data:', error)
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCurrentUser = async () => {
    const supabase = createClient()
    try {
      // Method 1: Try localStorage (most reliable for this app)
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData.full_name) {
            console.log('Found user in localStorage:', userData);
            setCurrentUser({ full_name: userData.full_name });
            return;
          }
        } catch (e) {
          console.log('Could not parse localStorage user data');
        }
      }

      // Method 2: Try session cookie
      const userSession = document.cookie.split(';').find(c => c.trim().startsWith('user_session='));
      console.log('User session cookie:', userSession);

      if (userSession) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(userSession.split('=')[1]));
          console.log('Session data:', sessionData);

          if (sessionData.full_name) {
            setCurrentUser({ full_name: sessionData.full_name });
            return;
          }
        } catch (parseError) {
          console.log('Could not parse session cookie:', parseError);
        }
      }

      // Method 3: Try calling check-auth API
      try {
        const response = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const authData = await response.json();
          console.log('Auth data from API:', authData);

          if (authData.user && authData.user.full_name) {
            setCurrentUser({ full_name: authData.user.full_name });
            return;
          }
        }
      } catch (apiError) {
        console.log('API call failed:', apiError);
      }

      // Method 4: Fallback to Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Supabase auth user:', user, 'Auth error:', authError);

      if (user) {
        const { data: userData, error: userError } = await supabase
          .from('packing_users')
          .select('full_name')
          .eq('id', user.id)
          .single();
        console.log('Database user data:', userData, 'User error:', userError);

        if (userData && userData.full_name) {
          setCurrentUser(userData);
        } else {
          setCurrentUser({
            full_name: user.email?.split('@')[0] || user.user_metadata?.full_name || 'ผู้ใช้งาน'
          });
        }
      } else {
        console.log('No authenticated user found, using default');
        setCurrentUser({ full_name: 'ผู้ใช้งาน' });
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setCurrentUser({ full_name: 'ผู้ใช้งาน' });
    }
  }

  useEffect(() => {
    fetchData()
    fetchCurrentUser()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white font-thai">
      <header className="bg-white/90 backdrop-blur-sm shadow-xl border-b border-primary-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="p-4 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl shadow-xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary-600">ตั้งค่ากล่องแพ็คสินค้า</h1>
                <p className="text-lg text-gray-600 font-medium">Box Configuration & Stock Management</p>
              </div>
            </div>
            <button
              onClick={() => window.location.href = '/online-packing'}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex space-x-1">
            {[
              { id: 'stock', name: 'สต็อกกล่อง' },
              { id: 'rules', name: 'กฎการแพ็ค' },
              { id: 'boxes', name: 'ขนาดกล่อง' },
              { id: 'profiles', name: 'ขนาดสินค้าตามน้ำหนัก' },
              { id: 'history', name: 'ประวัติการตัดสต็อก' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 font-semibold text-sm transition-all duration-300 rounded-t-lg ${
                  activeTab === tab.id
                    ? 'border-b-4 border-primary-500 text-primary-600 bg-primary-50/50'
                    : 'border-b-4 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {isLoading ? (
          <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-bold text-gray-700">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {activeTab === 'rules' && <PackingRulesTab rules={rules} boxes={boxes} profiles={profiles} setRules={setRules} />}
            {activeTab === 'boxes' && <BoxDimensionsTab boxes={boxes} />}
            {activeTab === 'profiles' && <ProductProfilesTab profiles={profiles} />}
            {activeTab === 'stock' && <BoxStockTab boxStocks={boxStocks} setBoxStocks={setBoxStocks} currentUser={currentUser} onDataRefresh={fetchData} />}
            {activeTab === 'history' && <BoxStockHistoryTab history={boxStockHistory} onDataRefresh={fetchData} />}
          </div>
        )}
      </main>
    </div>
  )
}

// --- TAB COMPONENTS ---

const BoxStockTab = ({ boxStocks, setBoxStocks, currentUser, onDataRefresh }: { boxStocks: BoxStock[], setBoxStocks: (stocks: BoxStock[]) => void, currentUser: any, onDataRefresh: () => void }) => {
  const [editingStock, setEditingStock] = useState<string | null>(null)
  const [tempStock, setTempStock] = useState<number>(0)
  const [tempMinAlert, setTempMinAlert] = useState<number>(10)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const updateStock = async (stockId: string, newStock: number, newMinAlert: number) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('packing_box_stocks')
        .update({ current_stock: newStock, min_stock_alert: newMinAlert, updated_at: new Date().toISOString() })
        .eq('id', stockId)
      if (error) throw error

      const updatedStocks = boxStocks.map(stock =>
        stock.id === stockId
          ? { ...stock, current_stock: newStock, min_stock_alert: newMinAlert, updated_at: new Date().toISOString() }
          : stock
      )
      setBoxStocks(updatedStocks)
      setEditingStock(null)
    } catch (error) {
      console.error('Error updating stock:', error)
      alert('เกิดข้อผิดพลาดในการอัพเดทสต็อก')
    }
  }

  return (
    <div>
      <StockUpdateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        boxStocks={boxStocks}
        currentUser={currentUser}
        onDataRefresh={onDataRefresh}
      />
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">สต็อกกล่องทุกไซด์</h2>
          <p className="text-sm text-gray-500">จัดการสต็อกกล่องคงเหลือผ่านปุ่ม "จัดการสต็อก"</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          จัดการสต็อก
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-4 text-left font-semibold text-gray-600 border-b-2 border-gray-200">รหัสกล่อง</th>
              <th className="p-4 text-left font-semibold text-gray-600 border-b-2 border-gray-200">ชื่อกล่อง</th>
              <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">สต็อกปัจจุบัน</th>
              <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">แจ้งเตือนเมื่อต่ำกว่า</th>
              <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">สถานะ</th>
              <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {boxStocks.map(stock => {
              const isLowStock = stock.current_stock <= stock.min_stock_alert
              const isEditing = editingStock === stock.id

              return (
                <tr key={stock.id} className={`hover:bg-primary-50/50 border-b border-gray-100 ${isLowStock ? 'bg-red-50/30' : ''}`}>
                  <td className="p-4 font-mono text-primary-600 font-semibold">{stock.box_code}</td>
                  <td className="p-4 text-gray-800">{stock.box_name}</td>
                  <td className="p-4 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={tempStock}
                        onChange={(e) => setTempStock(parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        autoFocus
                      />
                    ) : (
                      <span className={`text-xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>{stock.current_stock}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        value={tempMinAlert}
                        onChange={(e) => setTempMinAlert(parseInt(e.target.value) || 10)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    ) : (
                      <span className="text-gray-600">{stock.min_stock_alert}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {isLowStock ? (
                      <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">สต็อกต่ำ</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">ปกติ</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => updateStock(stock.id, tempStock, tempMinAlert)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs">✓</button>
                        <button onClick={() => setEditingStock(null)} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingStock(stock.id); setTempStock(stock.current_stock); setTempMinAlert(stock.min_stock_alert); }} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">แก้ไข</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const StockUpdateModal = ({ isOpen, onClose, boxStocks, currentUser, onDataRefresh }: { isOpen: boolean, onClose: () => void, boxStocks: BoxStock[], currentUser: any, onDataRefresh: () => void }) => {
  const [updates, setUpdates] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('แพ็คสินค้าออนไลน์');
  const [customReason, setCustomReason] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [adjustmentDate, setAdjustmentDate] = useState('');
  const [adjustmentTime, setAdjustmentTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDateTime = useMemo(() => {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5)
    };
  }, [isOpen]);

  // Generate document number automatically
  const generateDocumentNumber = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `DOC-${year}${month}${day}-${timestamp}`;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUpdates({});
      setReason('แพ็คสินค้าออนไลน์');
      setCustomReason('');
      setDocumentNumber(generateDocumentNumber);
      setAdjustmentDate(currentDateTime.date);
      setAdjustmentTime(currentDateTime.time);
      setNotes('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentDateTime, generateDocumentNumber]);

  if (!isOpen) return null;

  const handleUpdate = (boxId: string, quantity: string) => {
    const numQuantity = parseInt(quantity) || 0;
    setUpdates(prev => ({ ...prev, [boxId]: numQuantity }));
  };

  const handleSubmit = async () => {
    const supabase = createClient()
    const hasUpdates = Object.values(updates).some(qty => qty > 0);
    if (!hasUpdates) {
      alert('กรุณากรอกจำนวนที่ต้องการตัดสต็อกอย่างน้อย 1 รายการ');
      return;
    }
    const finalReason = reason === 'อื่นๆ' ? customReason : reason;
    if (!finalReason) {
      alert('กรุณาระบุประเภทการตัดสต็อก');
      return;
    }
    if (!adjustmentDate || !adjustmentTime) {
      alert('กรุณาระบุวันเวลาตัดสต็อก');
      return;
    }

    setIsSubmitting(true);
    const updatePromises = [];
    const historyPromises = [];
    const adjustmentDateTime = new Date(`${adjustmentDate}T${adjustmentTime}`).toISOString();
    const fullNotes = `เลขเอกสาร: ${documentNumber || '-'}. วันเวลาตัด: ${adjustmentDate} ${adjustmentTime}. หมายเหตุ: ${notes || '-'}`;

    for (const boxStockId in updates) {
      const quantityChange = updates[boxStockId];
      if (quantityChange > 0) {
        const stock = boxStocks.find(s => s.id === boxStockId);
        if (stock) {
          const newStock = stock.current_stock - quantityChange;
          updatePromises.push(
            supabase.from('packing_box_stocks').update({ current_stock: newStock }).eq('id', boxStockId)
          );
          // Try to insert into box_stock_history table, but don't fail if table doesn't exist
          const historyData = {
            box_stock_id: boxStockId,
            box_code: stock.box_code,
            quantity_change: -quantityChange,
            reason: finalReason,
            notes: fullNotes,
            created_by_user_id: currentUser?.id,
            created_by_name: currentUser?.full_name || 'N/A'
          };
          console.log('Inserting history data:', historyData);

          historyPromises.push(
            supabase.from('packing_box_stock_history').insert(historyData).then(result => {
              if (result.error) {
                console.error('Failed to save to box_stock_history:', result.error);
                // Don't throw error, just log it
                return { data: null, error: null };
              }
              console.log('Successfully saved to box_stock_history:', result.data);
              return result;
            })
          );
        }
      }
    }

    try {
      await Promise.all([...updatePromises, ...historyPromises]);
      alert('อัปเดตสต็อกเรียบร้อยแล้ว');
      onDataRefresh();
      onClose();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสต็อก');
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustmentTypes = [
    'แพ็คสินค้าออนไลน์',
    'สำนักงานใหญ่เบิก',
    'แพ็คสินค้าสายลม',
    'ปรับสต็อก',
    'รับกล่องจากการซื้อ',
    'รับกล่องจากลูกค้ายกเลิก'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 font-thai">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h3 className="text-2xl font-bold text-gray-800">จัดการสต็อกกล่อง</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
          </div>

          {/* Form Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 p-6 bg-gradient-to-r from-blue-50/50 to-green-50/50 rounded-xl border-2 border-blue-200/30">
            <div className="md:col-span-2">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-xl">📋</span> ข้อมูลการตัดสต็อก
              </h4>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">👨‍💼 ชื่อผู้ตัดสต็อก</label>
              <input
                type="text"
                readOnly
                value={currentUser?.full_name || 'ไม่ระบุ'}
                className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-gray-600 font-medium cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">พนักงานที่ทำการตัดสต็อก</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">📅 วันที่ตัด</label>
              <input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">⏰ เวลาตัด</label>
              <input
                type="time"
                value={adjustmentTime}
                onChange={(e) => setAdjustmentTime(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="adjustment-type" className="block text-sm font-semibold text-gray-700 mb-2">🏷️ ประเภทการตัดสต็อก *</label>
              <select
                id="adjustment-type"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
              >
                <option value="">-- เลือกประเภท --</option>
                {adjustmentTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">เลือกเหตุผลการตัดสต็อก</p>
            </div>

            {reason === 'อื่นๆ' && (
              <div className="md:col-span-2">
                <label htmlFor="custom-reason" className="block text-sm font-semibold text-gray-700 mb-2">✏️ ระบุประเภทอื่นๆ *</label>
                <input
                  id="custom-reason"
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="กรุณาระบุประเภทการตัดสต็อก..."
                  className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                />
              </div>
            )}

            <div>
              <label htmlFor="document-number" className="block text-sm font-semibold text-gray-700 mb-2">📄 เลขเอกสารตัด</label>
              <input
                id="document-number"
                type="text"
                value={documentNumber}
                readOnly
                className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-xl text-gray-600 font-medium cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">🤖 สร้างอัตโนมัติตามวันเวลาและรหัสเฉพาะ</p>
            </div>
          </div>

          {/* Stock Items */}
          <div className="space-y-3">
            <p className='text-sm text-gray-600 px-1'>กรอกจำนวนกล่องที่ต้องการ <span className='font-bold text-red-600'>ตัดออกจากสต็อก</span> เฉพาะช่องที่มีการเปลี่ยนแปลง</p>
            {boxStocks.map(stock => (
              <div key={stock.id} className="grid grid-cols-3 items-center gap-4 p-2 rounded-lg hover:bg-gray-50">
                <div className="col-span-2">
                  <span className="font-semibold text-gray-800">{stock.box_name}</span>
                  <span className="text-sm text-gray-500 ml-2">({stock.box_code}) - คงเหลือ: {stock.current_stock}</span>
                </div>
                <input
                  type="number"
                  placeholder="จำนวนที่ตัด"
                  min="0"
                  max={stock.current_stock}
                  onChange={(e) => handleUpdate(stock.id, e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-600 mb-1">หมายเหตุเพิ่มเติม</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
            <button onClick={onClose} disabled={isSubmitting} className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">ยกเลิก</button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:bg-gray-400">
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการตัดสต็อก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const BoxDimensionsTab = ({ boxes }: { boxes: Box[] }) => (
  <div>
    <h2 className="text-2xl font-bold text-gray-800 mb-6">ขนาดกล่องทั้งหมด</h2>
    <div className="overflow-x-auto">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-4 text-left font-semibold text-gray-600 border-b-2 border-gray-200">รหัสกล่อง</th>
            <th className="p-4 text-left font-semibold text-gray-600 border-b-2 border-gray-200">ชื่อกล่อง</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">กว้าง (cm)</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">ยาว (cm)</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">สูง (cm)</th>
          </tr>
        </thead>
        <tbody>
          {boxes.map(box => (
            <tr key={box.id} className="hover:bg-primary-50/50 border-b border-gray-100">
              <td className="p-4 font-mono text-primary-600 font-semibold">{box.box_code}</td>
              <td className="p-4 text-gray-800">{box.box_name}</td>
              <td className="p-4 text-center text-gray-600">{box.dimensions_width}</td>
              <td className="p-4 text-center text-gray-600">{box.dimensions_length}</td>
              <td className="p-4 text-center text-gray-600">{box.dimensions_height}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ProductProfilesTab = ({ profiles }: { profiles: ProductWeightProfile[] }) => (
  <div>
    <h2 className="text-2xl font-bold text-gray-800 mb-6">ขนาดสินค้าตามน้ำหนัก</h2>
    <div className="overflow-x-auto">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-4 text-left font-semibold text-gray-600 border-b-2 border-gray-200">รหัสประเภท</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">น้ำหนัก (kg)</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">กว้าง (cm)</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">ยาว (cm)</th>
            <th className="p-4 text-center font-semibold text-gray-600 border-b-2 border-gray-200">สูง (cm)</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map(profile => (
            <tr key={profile.id} className="hover:bg-primary-50/50 border-b border-gray-100">
              <td className="p-4 font-mono text-primary-600 font-semibold">{profile.product_type_code}</td>
              <td className="p-4 text-center font-bold text-gray-800">{profile.weight_kg}</td>
              <td className="p-4 text-center text-gray-600">{profile.dimensions_width}</td>
              <td className="p-4 text-center text-gray-600">{profile.dimensions_length}</td>
              <td className="p-4 text-center text-gray-600">{profile.dimensions_height}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PackingRulesTab = ({ rules, boxes, profiles, setRules }: { rules: PackingRule[], boxes: Box[], profiles: ProductWeightProfile[], setRules: (rules: PackingRule[]) => void }) => {
  const [localRules, setLocalRules] = useState<PackingRule[]>(rules)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [tempRuleCode, setTempRuleCode] = useState<string>('')
  const [tempNotes, setTempNotes] = useState<string>('')

  useEffect(() => {
    setLocalRules(rules)
  }, [rules])

  const gridData = useMemo(() => {
    const grid = new Map<string, Map<string, PackingRule>>()
    for (const rule of localRules) {
      if (!grid.has(rule.box_code)) {
        grid.set(rule.box_code, new Map())
      }
      grid.get(rule.box_code)!.set(rule.primary_product_type_code, rule)
    }
    return grid
  }, [localRules])

  const sortedBoxes = useMemo(() => [...boxes].sort((a, b) => a.box_code.localeCompare(b.box_code)), [boxes]);
  const sortedProfiles = useMemo(() => [...profiles].sort((a, b) => a.weight_kg - b.weight_kg), [profiles]);

  const updateRule = async (boxCode: string, productTypeCode: string, newRuleCode: string, newNotes: string) => {
    const supabase = createClient()
    try {
      const existingRule = gridData.get(boxCode)?.get(productTypeCode)

      if (existingRule) {
        // Update existing rule
        const { error } = await supabase
          .from('packing_packing_rules')
          .update({
            rule_code: newRuleCode,
            notes: newNotes || null
          })
          .eq('id', existingRule.id)

        if (error) throw error

        const updatedRules = localRules.map(rule =>
          rule.id === existingRule.id
            ? { ...rule, rule_code: newRuleCode, notes: newNotes || null }
            : rule
        )
        setLocalRules(updatedRules)
        setRules(updatedRules)
      } else {
        // Create new rule
        const newRule = {
          box_code: boxCode,
          primary_product_type_code: productTypeCode,
          rule_code: newRuleCode,
          notes: newNotes || null
        }

        const { data, error } = await supabase
          .from('packing_packing_rules')
          .insert([newRule])
          .select()
          .single()

        if (error) throw error

        const newRules = [...localRules, data]
        setLocalRules(newRules)
        setRules(newRules)
      }

      setEditingCell(null)
    } catch (error) {
      console.error('Error updating packing rule:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    }
  }

  const deleteRule = async (ruleId: string) => {
    const supabase = createClient()
    if (!confirm('คุณต้องการลบกฎการแพ็คนี้หรือไม่?')) return

    try {
      const { error } = await supabase
        .from('packing_packing_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error

      const updatedRules = localRules.filter(rule => rule.id !== ruleId)
      setLocalRules(updatedRules)
      setRules(updatedRules)
    } catch (error) {
      console.error('Error deleting packing rule:', error)
      alert('เกิดข้อผิดพลาดในการลบข้อมูล')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">ตารางกฎการแพ็คสินค้า</h2>
      <p className="text-sm text-gray-500 mb-6">ตารางนี้แสดงจำนวนชิ้นสูงสุดที่แต่ละกล่องสามารถใส่ได้สำหรับสินค้าแต่ละประเภท <span className="text-blue-600 font-medium">• คลิกที่ช่องเพื่อแก้ไขข้อมูล</span></p>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full table-fixed border-collapse min-w-[1200px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 w-40">กล่อง / สินค้า</th>
              {sortedProfiles.map(profile => (
                <th key={profile.id} className="p-3 text-center font-semibold text-gray-700 border-b-2 border-gray-200 border-l border-gray-200">
                  <div>{profile.product_type_code}</div>
                  <div className="text-xs font-normal text-gray-500">({profile.weight_kg} kg)</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedBoxes.map(box => (
              <tr key={box.id} className="hover:bg-primary-50/50 border-b border-gray-100">
                <td className="p-3 font-mono text-primary-600 font-semibold border-r border-gray-200 bg-gray-50">{box.box_code}</td>
                {sortedProfiles.map(profile => {
                  const rule = gridData.get(box.box_code)?.get(profile.product_type_code)
                  const isMix = rule?.rule_code.includes('+')
                  const isSpecial = rule?.notes
                  const isNotPackable = rule?.rule_code === '–'
                  const cellId = `${box.box_code}-${profile.product_type_code}`
                  const isEditing = editingCell === cellId

                  return (
                    <td
                      key={profile.id}
                      className={`p-2 text-center border-l border-gray-200 cursor-pointer hover:bg-blue-50/50 relative group ${
                        isNotPackable ? 'text-gray-400' : 'text-gray-800'
                      } ${
                        isMix ? 'bg-blue-50' : ''
                      } ${
                        isSpecial ? 'bg-yellow-50' : ''
                      }`}
                      onClick={() => {
                        if (!isEditing) {
                          setEditingCell(cellId)
                          setTempRuleCode(rule?.rule_code || '')
                          setTempNotes(rule?.notes || '')
                        }
                      }}>
                      {isEditing ? (
                        <div className="space-y-2 min-w-[120px]">
                          <input
                            type="text"
                            value={tempRuleCode}
                            onChange={(e) => setTempRuleCode(e.target.value)}
                            placeholder="เช่น 5, 3+2, –"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            placeholder="หมายเหตุ (ถ้ามี)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateRule(box.box_code, profile.product_type_code, tempRuleCode, tempNotes)
                              }}
                              className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                            >
                              ✓
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingCell(null)
                              }}
                              className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
                            >
                              ✕
                            </button>
                            {rule && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteRule(rule.id)
                                }}
                                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {rule ? (
                            <div>
                              <span className={`font-bold ${isMix ? 'text-blue-600' : isSpecial ? 'text-yellow-700' : ''}`}>
                                {rule.rule_code}
                              </span>
                              {rule.notes && <div className="text-xs font-normal text-yellow-800 mt-1">{rule.notes}</div>}
                            </div>
                          ) : (
                            <span className="text-gray-300">?</span>
                          )}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-blue-100/20 border-2 border-blue-300/50 rounded transition-opacity duration-200"></div>
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-blue-500 text-xs">✏️</div>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-bold text-gray-700 mb-2">คำอธิบายสัญลักษณ์</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-white border border-gray-300"></div><span>ปกติ</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-50"></div><span>ใส่คละไซส์</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-yellow-50"></div><span>มีเงื่อนไขพิเศษ</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-400 font-semibold">–</span><span>ใส่ไม่ได้</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-300 font-semibold">?</span><span>ยังไม่มีข้อมูล</span></div>
        </div>
        <div className="border-t border-gray-300 pt-3">
          <h4 className="font-semibold text-blue-700 mb-2">💡 วิธีการแก้ไข</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>คลิกที่ช่องใดช่องหนึ่ง</strong> เพื่อเข้าสู่โหมดแก้ไข</p>
            <p>• <strong>ใส่รหัสกฎ:</strong> เช่น "5" (ใส่ได้ 5 ชิ้น), "3+2" (คละไซส์), "–" (ใส่ไม่ได้)</p>
            <p>• <strong>หมายเหตุ:</strong> ระบุเงื่อนไขพิเศษได้ (ถ้ามี)</p>
            <p>• <strong>กด ✓ เพื่อบันทึก</strong> หรือ <strong>✕ เพื่อยกเลิก</strong> หรือ <strong>🗑 เพื่อลบ</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}

const BoxStockHistoryTab = ({ history, onDataRefresh }: { history: BoxStockHistory[], onDataRefresh: () => void }) => {
  const [selectedEntry, setSelectedEntry] = useState<BoxStockHistory | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Edit form states
  const [editQuantityChange, setEditQuantityChange] = useState(0)
  const [editReason, setEditReason] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const handleExportCSV = () => {
    if (!history || history.length === 0) {
      alert('ไม่มีข้อมูลให้ส่งออก');
      return;
    }

    const headers = ['เวลาตัด', 'รหัสกล่อง', 'จำนวนเปลี่ยนแปลง', 'ประเภทการตัด', 'ผู้ตัดสต็อก', 'หมายเหตุ'];
    const rows = history.map(entry => [
      new Date(entry.created_at).toLocaleString('th-TH'),
      entry.box_code,
      entry.quantity_change,
      entry.reason,
      entry.created_by_name,
      entry.notes || ''
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(item => `"${item}"`).join(',') + '\n';
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'box_stock_history.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!history || history.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">ประวัติการตัดสต็อก</h2>
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500">ยังไม่มีข้อมูลประวัติการตัดสต็อก</p>
            <p className="text-gray-400 text-sm">เมื่อมีการตัดสต็อกจะแสดงข้อมูลที่นี่</p>
          </div>
        </div>
      </div>
    )
  }

  const getQuantityChangeDisplay = (change: number) => {
    if (change > 0) {
      return <span className="text-green-600 font-bold">+{change}</span>
    } else {
      return <span className="text-red-600 font-bold">{change}</span>
    }
  }

  const handleViewDetails = (entry: BoxStockHistory) => {
    setSelectedEntry(entry)
    setShowViewModal(true)
  }

  const handleEditEntry = (entry: BoxStockHistory) => {
    setSelectedEntry(entry)
    setEditQuantityChange(entry.quantity_change)
    setEditReason(entry.reason)
    setEditNotes(entry.notes || '')
    setShowEditModal(true)
  }

  const handleDeleteEntry = async (entry: BoxStockHistory) => {
    const supabase = createClient()
    if (!confirm(`ต้องการลบรายการประวัติการตัดสต็อก รหัส ${entry.box_code} จำนวน ${entry.quantity_change} หรือไม่?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('packing_box_stock_history')
        .delete()
        .eq('id', entry.id)

      if (error) throw error

      alert('ลบรายการเรียบร้อยแล้ว')
      onDataRefresh()
    } catch (error) {
      console.error('Error deleting entry:', error)
      alert('เกิดข้อผิดพลาดในการลบรายการ')
    }
  }

  const handleUpdateEntry = async () => {
    const supabase = createClient()
    if (!selectedEntry) return

    try {
      const { error } = await supabase
        .from('packing_box_stock_history')
        .update({
          quantity_change: editQuantityChange,
          reason: editReason,
          notes: editNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEntry.id)

      if (error) throw error

      alert('อัปเดตรายการเรียบร้อยแล้ว')
      setShowEditModal(false)
      onDataRefresh()
    } catch (error) {
      console.error('Error updating entry:', error)
      alert('เกิดข้อผิดพลาดในการอัปเดตรายการ')
    }
  }

  const adjustmentTypes = [
    'แพ็คสินค้าออนไลน์',
    'สำนักงานใหญ่เบิก',
    'แพ็คสินค้าสายลม',
    'ปรับสต็อก',
    'รับกล่องจากการซื้อ',
    'รับกล่องจากลูกค้ายกเลิก'
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ประวัติการตัดสต็อก</h2>
          <p className="text-gray-600 text-sm mt-1">ข้อมูล {history.length} รายการล่าสุด</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDataRefresh}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรช
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            ส่งออกข้อมูล CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
              <tr>
                <th className="p-4 text-left font-semibold">📅 เวลาตัด</th>
                <th className="p-4 text-left font-semibold">📦 รหัสกล่อง</th>
                <th className="p-4 text-center font-semibold">🔢 จำนวนเปลี่ยนแปลง</th>
                <th className="p-4 text-left font-semibold">🏷️ ประเภทการตัด</th>
                <th className="p-4 text-left font-semibold">👨‍💼 ผู้ตัดสต็อก</th>
                <th className="p-4 text-left font-semibold">📄 เลขเอกสาร</th>
                <th className="p-4 text-center font-semibold">🔧 การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => (
                <tr key={entry.id} className={`border-b border-gray-100 hover:bg-primary-50/30 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="p-4 text-gray-600 text-sm">
                    {new Date(entry.created_at).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-4 font-mono text-primary-600 font-semibold">{entry.box_code}</td>
                  <td className="p-4 text-center text-lg">
                    {getQuantityChangeDisplay(entry.quantity_change)}
                  </td>
                  <td className="p-4 text-gray-800 font-medium">
                    <span className="inline-flex px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                      {entry.reason}
                    </span>
                  </td>
                  <td className="p-4 text-gray-700">{entry.created_by_name}</td>
                  <td className="p-4 text-gray-600 font-mono text-sm">
                    {entry.notes ? (
                      <div className="max-w-xs truncate" title={entry.notes}>
                        {entry.notes.includes('เลขเอกสาร:') ?
                          entry.notes.split('.')[0].replace('เลขเอกสาร: ', '') :
                          entry.notes
                        }
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleViewDetails(entry)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1"
                        title="ดูรายละเอียด"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        ดู
                      </button>
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1"
                        title="แก้ไข"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1"
                        title="ลบ"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">💡 คำอธิบายข้อมูล</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-700"><strong>จำนวนเปลี่ยนแปลง:</strong></p>
            <p className="text-blue-600">• <span className="text-red-600">ติดลบ (-)</span> = ตัดออกจากสต็อก</p>
            <p className="text-blue-600">• <span className="text-green-600">บวก (+)</span> = เพิ่มเข้าสต็อก</p>
          </div>
          <div>
            <p className="text-blue-700"><strong>ประเภทการตัด:</strong></p>
            <p className="text-blue-600">• แสดงเหตุผลการเปลี่ยนแปลงสต็อก</p>
            <p className="text-blue-600">• ข้อมูลจากการกรอกฟอร์มตัดสต็อก</p>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {showViewModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">รายละเอียดการตัดสต็อก</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl"
                >
                  &times;
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-gray-600">รหัสกล่อง:</span>
                  <div className="font-semibold text-primary-600">{selectedEntry.box_code}</div>
                </div>
                <div>
                  <span className="text-gray-600">จำนวนเปลี่ยนแปลง:</span>
                  <div className="font-bold text-lg">{getQuantityChangeDisplay(selectedEntry.quantity_change)}</div>
                </div>
                <div>
                  <span className="text-gray-600">ประเภทการตัด:</span>
                  <div className="font-semibold">{selectedEntry.reason}</div>
                </div>
                <div>
                  <span className="text-gray-600">ผู้ตัดสต็อก:</span>
                  <div className="font-semibold">{selectedEntry.created_by_name}</div>
                </div>
                <div>
                  <span className="text-gray-600">วันเวลาตัด:</span>
                  <div className="font-semibold">
                    {new Date(selectedEntry.created_at).toLocaleString('th-TH')}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">ID รายการ:</span>
                  <div className="font-mono text-sm text-gray-500">{selectedEntry.id}</div>
                </div>
                <div className="md:col-span-2">
                  <span className="text-gray-600">หมายเหตุ:</span>
                  <div className="mt-1 p-3 bg-gray-50 rounded border">
                    {selectedEntry.notes || 'ไม่มีหมายเหตุ'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">แก้ไขประวัติการตัดสต็อก</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">รหัสกล่อง</label>
                  <input
                    type="text"
                    value={selectedEntry.box_code}
                    readOnly
                    className="w-full px-4 py-3 bg-gray-100 border rounded-xl text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">จำนวนเปลี่ยนแปลง</label>
                  <input
                    type="number"
                    value={editQuantityChange}
                    onChange={(e) => setEditQuantityChange(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">ติดลบ (-) = ตัดออก, บวก (+) = เพิ่มเข้า</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">ประเภทการตัด</label>
                  <select
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500"
                  >
                    {adjustmentTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเหตุ</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="ระบุรายละเอียดเพิ่มเติม..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleUpdateEntry}
                  className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
};
