'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageContainer, PageHeaderWithFilters } from '@/components/ui/page-components'

// --- TYPE DEFINITIONS ---
interface Box {
  id: string
  box_code: string
  box_name: string
  dimensions_length: number
  dimensions_width: number
  dimensions_height: number
}

interface BoxStock {
  sku_id: string
  sku_name: string
  location_id: string
  total_piece_qty: number
  reserved_piece_qty: number
  available_qty: number
  location_name?: string
  zone?: string
}

// --- MAIN PAGE COMPONENT ---
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('stock') // Default to stock tab
  const [isLoading, setIsLoading] = useState(true)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [boxStocks, setBoxStocks] = useState<BoxStock[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const fetchData = async () => {
    const supabase = createClient()
    setIsLoading(true)
    try {
      // Fetch boxes
      const boxesRes = await supabase.from('packing_boxes').select('*').order('box_code')

      // Fetch inventory balances with pagination (Supabase has 1000 row limit)
      let allInventoryData: any[] = []
      const batchSize = 1000
      let from = 0
      let hasMore = true
      let batchNum = 1

      while (hasMore) {
        console.log(`[Settings] Fetching inventory batch ${batchNum} (${from}-${from + batchSize - 1})...`)
        
        const { data, error } = await supabase
          .from('wms_inventory_balances')
          .select(`
            sku_id,
            location_id,
            total_piece_qty,
            reserved_piece_qty,
            master_sku!sku_id (
              sku_name
            ),
            master_location!location_id (
              location_name,
              zone
            )
          `)
          .gt('total_piece_qty', 0)
          .range(from, from + batchSize - 1)

        if (error) {
          console.error(`[Settings] Inventory batch ${batchNum} error:`, error)
          throw error
        }

        if (data && data.length > 0) {
          console.log(`[Settings] Batch ${batchNum} fetched ${data.length} rows`)
          allInventoryData.push(...data)
          from += batchSize
          hasMore = data.length === batchSize
          batchNum++
        } else {
          hasMore = false
        }
      }

      console.log(`[Settings] Total inventory records fetched: ${allInventoryData.length}`)

      if (boxesRes.error) console.error('Boxes error:', boxesRes.error)

      if (boxesRes.error && !boxesRes.error.message.includes('does not exist')) throw boxesRes.error

      setBoxes(boxesRes.data || [])
      
      // Group inventory by SKU first (across all locations)
      const inventoryBySku = new Map<string, {
        sku_id: string
        sku_name: string
        total_piece_qty: number
        reserved_piece_qty: number
        zone: string
        location_name: string
      }>()
      
      allInventoryData.forEach((item: any) => {
        const zone = item.master_location?.zone
        const skuName = item.master_sku?.sku_name || ''
        
        // Filter for Zone E-Commerce and items with "กล่อง" in name
        if (zone === 'Zone E-Commerce' && skuName.includes('กล่อง')) {
          if (inventoryBySku.has(item.sku_id)) {
            const existing = inventoryBySku.get(item.sku_id)!
            existing.total_piece_qty += Number(item.total_piece_qty) || 0
            existing.reserved_piece_qty += Number(item.reserved_piece_qty) || 0
          } else {
            inventoryBySku.set(item.sku_id, {
              sku_id: item.sku_id,
              sku_name: item.master_sku?.sku_name || item.sku_id,
              total_piece_qty: Number(item.total_piece_qty) || 0,
              reserved_piece_qty: Number(item.reserved_piece_qty) || 0,
              zone: item.master_location?.zone,
              location_name: item.master_location?.location_name
            })
          }
        }
      })
      
      console.log(`[Settings] Grouped into ${inventoryBySku.size} unique SKUs`)
      
      // Convert to BoxStock array
      const boxInventory = Array.from(inventoryBySku.values()).map(item => ({
        sku_id: item.sku_id,
        sku_name: item.sku_name,
        location_id: 'Zone E-Commerce',
        total_piece_qty: item.total_piece_qty,
        reserved_piece_qty: item.reserved_piece_qty,
        available_qty: item.total_piece_qty - item.reserved_piece_qty,
        location_name: item.location_name,
        zone: item.zone
      }))
      
      console.log('[Settings] Final box stocks:', boxInventory.map(b => ({ sku: b.sku_id, qty: b.total_piece_qty })))
      
      setBoxStocks(boxInventory)

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
    <PageContainer>
      {/* Header */}
      <PageHeaderWithFilters title="ตั้งค่ากล่อง">
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-600 font-thai">Box Configuration & Stock</span>
        </div>
      </PageHeaderWithFilters>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0 px-2">
          {[
            { id: 'stock', name: 'สต็อกกล่อง' },
            { id: 'boxes', name: 'ขนาดกล่อง' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-2 text-[10px] font-thai font-medium transition-all ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
                <p className="text-gray-600 font-thai text-xs">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <div>
              {activeTab === 'boxes' && <BoxDimensionsTab boxes={boxes} />}
              {activeTab === 'stock' && <BoxStockTab boxStocks={boxStocks} setBoxStocks={setBoxStocks} currentUser={currentUser} onDataRefresh={fetchData} />}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

// --- TAB COMPONENTS ---

const BoxStockTab = ({ boxStocks, setBoxStocks, currentUser, onDataRefresh }: { boxStocks: BoxStock[], setBoxStocks: (stocks: BoxStock[]) => void, currentUser: any, onDataRefresh: () => void }) => {
  const [isDeductModalOpen, setIsDeductModalOpen] = useState(false)

  return (
    <div>
      <StockDeductionModal
        isOpen={isDeductModalOpen}
        onClose={() => setIsDeductModalOpen(false)}
        boxStocks={boxStocks}
        currentUser={currentUser}
        onDataRefresh={onDataRefresh}
      />
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-1 font-thai">สต็อกกล่องทุกไซด์ (Zone E-Commerce)</h2>
          <p className="text-xs text-gray-500 font-thai">แสดงข้อมูลจาก Inventory Balances - Zone E-Commerce</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsDeductModalOpen(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs font-thai transition-colors"
          >
            ตัดสต็อกกล่อง
          </button>
          <button
            onClick={onDataRefresh}
            className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs font-thai transition-colors"
          >
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">รหัส SKU</th>
              <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">ชื่อกล่อง</th>
              <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">สต็อกทั้งหมด</th>
              <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">จองแล้ว</th>
              <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">พร้อมใช้</th>
              <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">โซน</th>
            </tr>
          </thead>
          <tbody>
            {boxStocks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-xs font-thai">ไม่พบข้อมูลกล่องใน Zone E-Commerce</p>
                  </div>
                </td>
              </tr>
            ) : (
              boxStocks.map(stock => {
                const isLowStock = stock.available_qty <= 10

                return (
                  <tr key={stock.sku_id} className={`hover:bg-gray-50 border-b border-gray-100 transition-colors ${isLowStock ? 'bg-yellow-50/30' : ''}`}>
                    <td className="py-1.5 px-2"><span className="font-mono text-xs font-medium text-primary-600">{stock.sku_id}</span></td>
                    <td className="py-1.5 px-2"><span className="text-xs text-gray-800 font-thai">{stock.sku_name}</span></td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="text-sm font-bold text-gray-800">{stock.total_piece_qty}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="text-xs text-orange-600 font-semibold">{stock.reserved_piece_qty}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`text-sm font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>{stock.available_qty}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-semibold font-thai rounded-full">{stock.zone}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const StockDeductionModal = ({ isOpen, onClose, boxStocks, currentUser, onDataRefresh }: { isOpen: boolean, onClose: () => void, boxStocks: BoxStock[], currentUser: any, onDataRefresh: () => void }) => {
  const [deductions, setDeductions] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('แพ็คสินค้าออนไลน์')
  const [customReason, setCustomReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [showAddReasonModal, setShowAddReasonModal] = useState(false)
  const [newReasonText, setNewReasonText] = useState('')
  const [customReasons, setCustomReasons] = useState<string[]>([])
  const supabase = createClient()

  // Update current time every second
  useEffect(() => {
    if (isOpen) {
      const timer = setInterval(() => {
        setCurrentDateTime(new Date())
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isOpen])

  // Load custom reasons from localStorage
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('box_deduction_custom_reasons')
      if (saved) {
        try {
          setCustomReasons(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to load custom reasons:', e)
        }
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setDeductions({})
      setReason('แพ็คสินค้าออนไลน์')
      setCustomReason('')
      setNotes('')
      setIsSubmitting(false)
      setCurrentDateTime(new Date())
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleDeductionChange = (skuId: string, quantity: string) => {
    const qty = parseInt(quantity) || 0
    setDeductions(prev => ({ ...prev, [skuId]: qty }))
  }

  const handleAddCustomReason = () => {
    if (!newReasonText.trim()) {
      alert('กรุณากรอกชื่อประเภทการตัดสต็อก')
      return
    }
    const updated = [...customReasons, newReasonText.trim()]
    setCustomReasons(updated)
    localStorage.setItem('box_deduction_custom_reasons', JSON.stringify(updated))
    setNewReasonText('')
    setShowAddReasonModal(false)
    alert('เพิ่มประเภทการตัดสต็อกเรียบร้อยแล้ว')
  }

  const handleSubmit = async () => {
    const hasDeductions = Object.values(deductions).some(qty => qty > 0)
    if (!hasDeductions) {
      alert('กรุณากรอกจำนวนที่ต้องการตัดอย่างน้อย 1 รายการ')
      return
    }

    const finalReason = reason === 'กำหนดเอง' ? customReason : reason
    if (!finalReason) {
      alert('กรุณาระบุเหตุผลการตัดสต็อก')
      return
    }

    setIsSubmitting(true)

    try {
      // Get E-Commerce location
      const { data: ecomLocations, error: locError } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('zone', 'Zone E-Commerce')
        .eq('active_status', 'active')
        .limit(1)

      if (locError || !ecomLocations || ecomLocations.length === 0) {
        throw new Error('ไม่พบ Location ใน Zone E-Commerce')
      }

      const ecomLocationId = ecomLocations[0].location_id

      // Create move transactions for each deduction
      const movePromises = []
      for (const [skuId, quantity] of Object.entries(deductions)) {
        if (quantity > 0) {
          const stock = boxStocks.find(s => s.sku_id === skuId)
          if (!stock) continue

          // Get inventory balance for this SKU in E-Commerce zone
          const { data: balances, error: balError } = await supabase
            .from('wms_inventory_balances')
            .select('*')
            .eq('sku_id', skuId)
            .eq('location_id', ecomLocationId)
            .gt('total_piece_qty', 0)
            .limit(1)

          if (balError || !balances || balances.length === 0) {
            console.warn(`No balance found for SKU ${skuId}`)
            continue
          }

          const balance = balances[0]

          // Generate BOX reference number: BOX-YYYYMMDD-XXX
          const today = new Date()
          const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
          const { count: todayCount } = await supabase
            .from('wms_moves')
            .select('*', { count: 'exact', head: true })
            .like('move_no', `BOX-${dateStr}-%`)
          const seqNum = String((todayCount || 0) + 1).padStart(3, '0')
          const moveNo = `BOX-${dateStr}-${seqNum}`

          // Create move record
          const { data: moveData, error: moveError } = await supabase
            .from('wms_moves')
            .insert({
              move_no: moveNo,
              move_type: 'issue',
              from_warehouse_id: balance.warehouse_id,
              status: 'completed',
              notes: `ตัดสต็อกกล่อง - ${finalReason}${notes ? ` | หมายเหตุ: ${notes}` : ''} | ตัดโดย: ${currentUser?.full_name || 'ไม่ระบุ'} | เวลา: ${currentDateTime.toLocaleString('th-TH')}`,
              created_by: currentUser?.id || null,
              completed_at: new Date().toISOString()
            })
            .select()
            .single()

          if (moveError) {
            console.error('Move error details:', moveError)
            throw new Error(`สร้างรายการเคลื่อนย้ายไม่สำเร็จ: ${moveError.message}`)
          }

          // Create move item
          const { error: itemError } = await supabase
            .from('wms_move_items')
            .insert({
              move_id: moveData.move_id,
              from_location_id: ecomLocationId,
              to_location_id: 'Delivery-In-Progress',
              sku_id: skuId,
              pallet_id: balance.pallet_id,
              pallet_id_external: balance.pallet_id_external,
              production_date: balance.production_date,
              expiry_date: balance.expiry_date,
              requested_pack_qty: 0,
              requested_piece_qty: quantity,
              confirmed_pack_qty: 0,
              confirmed_piece_qty: quantity,
              status: 'completed'
            })

          if (itemError) {
            console.error('Move item error details:', itemError)
            throw new Error(`สร้างรายการสินค้าไม่สำเร็จ: ${itemError.message}`)
          }

          movePromises.push(Promise.resolve())
        }
      }

      await Promise.all(movePromises)

      alert('ตัดสต็อกกล่องเรียบร้อยแล้ว')
      onDataRefresh()
      onClose()
    } catch (error: any) {
      console.error('Error deducting stock:', error)
      alert(`เกิดข้อผิดพลาด: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const defaultReasonOptions = [
    'แพ็คสินค้าออนไลน์',
    'สำนักงานใหญ่เบิก',
    'แพ็คสินค้าสายลม',
    'ปรับสต็อก',
    'กล่องชำรุด/เสียหาย',
    'ส่งคืนซัพพลายเออร์',
    'ใช้ภายในบริษัท'
  ]
  
  const allReasonOptions = [...defaultReasonOptions, ...customReasons, 'กำหนดเอง']

  return (
    <>
      {/* Add Custom Reason Modal */}
      {showAddReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] font-thai">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h4 className="text-lg font-bold text-gray-800 mb-4">เพิ่มประเภทการตัดสต็อก</h4>
            <input
              type="text"
              value={newReasonText}
              onChange={(e) => setNewReasonText(e.target.value)}
              placeholder="ระบุชื่อประเภทการตัดสต็อก..."
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-sm mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAddReasonModal(false); setNewReasonText(''); }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAddCustomReason}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 font-thai">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4 pb-3 border-b">
              <h3 className="text-xl font-bold text-gray-800">ตัดสต็อกกล่อง</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            {/* User and DateTime Info */}
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">ผู้ตัดสต็อก</p>
                  <p className="text-sm font-bold text-gray-800">{currentUser?.full_name || 'ไม่ระบุ'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">วันเวลาที่ตัด</p>
                  <p className="text-sm font-bold text-gray-800">{currentDateTime.toLocaleString('th-TH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  })}</p>
                </div>
              </div>
            </div>

            {/* Reason Selection */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">ประเภทการตัดสต็อก *</label>
                <button
                  onClick={() => setShowAddReasonModal(true)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  เพิ่มประเภท
                </button>
              </div>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-sm"
              >
                {allReasonOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Custom Reason Input */}
            {reason === 'กำหนดเอง' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ระบุเหตุผล *</label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="กรุณาระบุเหตุผลการตัดสต็อก..."
                  className="w-full px-3 py-2 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm"
                />
              </div>
            )}

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">หมายเหตุ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
              rows={2}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-sm"
            />
          </div>

          {/* Stock Items */}
          <div className="mb-4">
            <p className="text-sm text-gray-700 font-semibold mb-3">กรอกจำนวนกล่องที่ต้องการ <span className="text-red-600">ตัดออก</span></p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {boxStocks.map(stock => (
                <div key={stock.sku_id} className="grid grid-cols-3 items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <div className="col-span-2">
                    <p className="font-semibold text-sm text-gray-800">{stock.sku_name}</p>
                    <p className="text-xs text-gray-500">({stock.sku_id}) - พร้อมใช้: {stock.available_qty}</p>
                  </div>
                  <input
                    type="number"
                    placeholder="จำนวน"
                    min="0"
                    max={stock.available_qty}
                    value={deductions[stock.sku_id] || ''}
                    onChange={(e) => handleDeductionChange(stock.sku_id, e.target.value)}
                    className="w-full px-2 py-1.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:bg-gray-400 text-sm font-medium"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันตัดสต็อก'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}


const BoxDimensionsTab = ({ boxes }: { boxes: Box[] }) => (
  <div>
    <h2 className="text-base font-bold text-gray-800 mb-4 font-thai">ขนาดกล่องทั้งหมด</h2>
    <div className="overflow-x-auto">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">รหัสกล่อง</th>
            <th className="text-left py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">ชื่อกล่อง</th>
            <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">กว้าง (cm)</th>
            <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">ยาว (cm)</th>
            <th className="text-center py-1.5 px-2 font-semibold text-gray-700 text-[10px] font-thai">สูง (cm)</th>
          </tr>
        </thead>
        <tbody>
          {boxes.map(box => (
            <tr key={box.id} className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
              <td className="py-1.5 px-2"><span className="font-mono text-xs font-medium text-primary-600">{box.box_code}</span></td>
              <td className="py-1.5 px-2"><span className="text-xs text-gray-800 font-thai">{box.box_name}</span></td>
              <td className="py-1.5 px-2 text-center"><span className="text-xs text-gray-600">{box.dimensions_width}</span></td>
              <td className="py-1.5 px-2 text-center"><span className="text-xs text-gray-600">{box.dimensions_length}</span></td>
              <td className="py-1.5 px-2 text-center"><span className="text-xs text-gray-600">{box.dimensions_height}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);



// BoxStockHistoryTab removed - history is now tracked in wms_inventory_ledger
