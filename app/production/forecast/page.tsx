'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface ForecastSKU {
  sku_id: string;
  sku_name: string;
  category: string;
  sub_category: string;
  brand: string;
  qty_per_pack: number;
  safety_stock: number;
  calculated_safety_stock: number;
  demand_std_dev: number;
  reorder_point: number;
  total_stock: number;
  avg_daily_ship: number;
  days_of_supply: number;
  pending_order_qty: number;
  adjusted_days_of_supply: number;
  ship_trend: 'increasing' | 'stable' | 'decreasing';
  trend_slope: number;
  trend_significance: number;
  confidence_level: 'high' | 'medium' | 'low';
  last_ship_date: string | null;
  ship_data_days: number;
  suggested_production: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  priority_score: number;
  urgent_order_qty: number;
  days_until_stockout: number;
}

interface BalanceDetail {
  id: number;
  sku_name: string;
  location_code: string;
  location_name: string;
  pallet_id: string;
  production_date: string | null;
  expiry_date: string | null;
  lot_no: string | null;
  piece_qty: number;
  reserved_piece_qty: number;
  available_qty: number;
}

const ForecastPage = () => {
  const [forecastData, setForecastData] = useState<ForecastSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 100;

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [balanceDetails, setBalanceDetails] = useState<Record<string, BalanceDetail[]>>({});
  const [loadingBalances, setLoadingBalances] = useState<Set<string>>(new Set());

  // Tooltip state
  const [showDosTooltip, setShowDosTooltip] = useState(false);
  const [showSafetyStockTooltip, setShowSafetyStockTooltip] = useState(false);
  const [showTrendTooltip, setShowTrendTooltip] = useState(false);
  const [showProductionTooltip, setShowProductionTooltip] = useState(false);
  const [showPendingTooltip, setShowPendingTooltip] = useState(false);
  const [showAvgDailyShipTooltip, setShowAvgDailyShipTooltip] = useState(false);
  const [showPriorityScoreTooltip, setShowPriorityScoreTooltip] = useState(false);


  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch data when debounced search or filters change
  useEffect(() => {
    fetchForecastData(1);
  }, [debouncedSearchTerm, selectedPriority, selectedSubCategory]);

  const fetchForecastData = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      if (selectedPriority !== 'all') params.set('priority', selectedPriority);
      if (selectedSubCategory !== 'all') params.set('subCategory', selectedSubCategory);
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      params.set('_t', Date.now().toString()); // Cache busting

      const response = await fetch(`/api/production/forecast?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch forecast data');
      }

      const result = await response.json();
      setForecastData(result.data || []);
      setTotalCount(result.totalCount || 0);
      setCurrentPage(page);
    } catch (err: any) {
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalanceDetails = async (skuId: string) => {
    // ถ้ามีข้อมูลอยู่แล้ว ไม่ต้องดึงใหม่
    if (balanceDetails[skuId]) {
      return;
    }

    try {
      setLoadingBalances(prev => new Set(prev).add(skuId));

      // Use API endpoint instead of direct query
      const response = await fetch(`/api/production/forecast/${skuId}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch balance details');
      }

      const result = await response.json();
      const formattedBalances = (result.balances || []).map((balance: any) => ({
        id: balance.id,
        sku_name: balance.sku_name,
        location_code: balance.location_code,
        location_name: balance.location_name,
        pallet_id: balance.pallet_id,
        production_date: balance.production_date,
        expiry_date: balance.expiry_date,
        lot_no: balance.lot_no,
        piece_qty: balance.piece_qty,
        reserved_piece_qty: balance.reserved_piece_qty,
        available_qty: balance.available_qty,
      }));

      setBalanceDetails(prev => ({
        ...prev,
        [skuId]: formattedBalances
      }));
    } catch (err: any) {
      console.error('Error fetching balance details:', err);
    } finally {
      setLoadingBalances(prev => {
        const newSet = new Set(prev);
        newSet.delete(skuId);
        return newSet;
      });
    }
  };

  const toggleRow = async (skuId: string) => {
    const newExpanded = new Set(expandedRows);

    if (newExpanded.has(skuId)) {
      // Collapse
      newExpanded.delete(skuId);
    } else {
      // Expand
      newExpanded.add(skuId);
      // ดึงข้อมูล balance details ถ้ายังไม่มี
      await fetchBalanceDetails(skuId);
    }

    setExpandedRows(newExpanded);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return (
          <Badge variant="danger" size="sm" className="whitespace-nowrap">
            <AlertCircle className="w-3 h-3 mr-0.5" />
            <span className="text-[10px]">วิกฤต</span>
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="warning" size="sm" className="whitespace-nowrap">
            <span className="text-[10px]">สูง</span>
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="info" size="sm" className="whitespace-nowrap">
            <span className="text-[10px]">ปานกลาง</span>
          </Badge>
        );
      case 'low':
        return (
          <Badge variant="success" size="sm" className="whitespace-nowrap">
            <CheckCircle className="w-3 h-3 mr-0.5" />
            <span className="text-[10px]">ต่ำ</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm" className="whitespace-nowrap">
            <span className="text-[10px]">{priority}</span>
          </Badge>
        );
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <span title="แนวโน้มเพิ่มขึ้น"><TrendingUp className="w-4 h-4 text-red-500" /></span>;
      case 'decreasing':
        return <span title="แนวโน้มลดลง"><TrendingDown className="w-4 h-4 text-green-500" /></span>;
      default:
        return <span title="คงที่"><Minus className="w-4 h-4 text-gray-400" /></span>;
    }
  };

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <span className="text-green-600 font-medium">สูง</span>;
      case 'medium':
        return <span className="text-yellow-600 font-medium">ปานกลาง</span>;
      case 'low':
        return <span className="text-red-600 font-medium">ต่ำ</span>;
      default:
        return <span className="text-gray-500">-</span>;
    }
  };

  const getDaysOfSupplyColor = (days: number) => {
    if (days <= 7) return 'text-red-600 font-bold';
    if (days <= 14) return 'text-orange-600 font-bold';
    if (days <= 30) return 'text-yellow-600 font-semibold';
    return 'text-green-600';
  };


  return (
    <div className="h-[calc(100vh-3.25rem)] bg-gradient-to-br from-thai-gray-25 to-white overflow-hidden">
      {/* Days of Supply Explanation Modal */}
      {showDosTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                วิธีคำนวณ Days of Supply
              </h3>
              <button
                onClick={() => setShowDosTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">สูตรการคำนวณ</h4>
                <div className="bg-blue-50 rounded-lg p-3 font-mono text-center text-blue-800">
                  Days of Supply = สต็อกปัจจุบัน ÷ ยอดจ่ายเฉลี่ยต่อวัน
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ยอดจ่ายเฉลี่ยต่อวัน (EWMA)</h4>
                <p className="text-gray-600">
                  ใช้วิธี <span className="font-medium">Exponential Weighted Moving Average</span> (α = 0.3) 
                  ในการคำนวณค่าเฉลี่ยการจ่ายสินค้าย้อนหลัง 90 วัน โดยให้น้ำหนักกับข้อมูลล่าสุดมากกว่าข้อมูลเก่า
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ระดับความสำคัญ</h4>
                <ul className="space-y-1 text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-16 text-red-600 font-medium">วิกฤต:</span>
                    <span>≤ 7 วัน หรือ สต็อกต่ำกว่า Safety Stock</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-16 text-orange-600 font-medium">สูง:</span>
                    <span>8-14 วัน</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-16 text-yellow-600 font-medium">ปานกลาง:</span>
                    <span>15-30 วัน</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-16 text-green-600 font-medium">ต่ำ:</span>
                    <span>&gt; 30 วัน</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">แนวโน้ม (Trend)</h4>
                <p className="text-gray-600">
                  ใช้ <span className="font-medium">Linear Regression</span> วิเคราะห์ slope ของยอดจ่ายรายวัน
                  ถ้า slope &gt; 5% ของค่าเฉลี่ย = เพิ่มขึ้น, &lt; -5% = ลดลง
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ความเชื่อมั่น</h4>
                <p className="text-gray-600">
                  คำนวณจาก <span className="font-medium">Coefficient of Variation (CV)</span>:
                </p>
                <ul className="mt-1 space-y-0.5 text-gray-600 ml-4">
                  <li>• CV &lt; 0.5 = ความเชื่อมั่นสูง</li>
                  <li>• CV 0.5-1.0 = ความเชื่อมั่นปานกลาง</li>
                  <li>• CV &gt; 1.0 หรือข้อมูล &lt; 14 วัน = ความเชื่อมั่นต่ำ</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">แนะนำผลิต</h4>
                <p className="text-gray-600">
                  คำนวณแบบครอบคลุมโดยรวม Safety Stock, Trend Adjustment และ Buffer 0.2%
                </p>
                <div className="bg-gray-50 rounded-lg p-2 mt-1 font-mono text-xs text-gray-700">
                  แนะนำผลิต = Target Stock + Buffer 0.2% - สต็อกปัจจุบัน
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  * คลิกปุ่ม ? ที่หัวคอลัมน์เพื่อดูรายละเอียดเพิ่มเติม
                </p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowDosTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Stock Explanation Modal */}
      {showSafetyStockTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                วิธีคำนวณ Safety Stock (Dynamic)
              </h3>
              <button
                onClick={() => setShowSafetyStockTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">สูตรการคำนวณ</h4>
                <div className="bg-green-50 rounded-lg p-3 font-mono text-center text-green-800">
                  Safety Stock = Z × σ<sub>d</sub> × √L
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ตัวแปรในสูตร</h4>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-bold text-green-700 w-8">Z</span>
                    <span>
                      <span className="font-medium">Z-score</span> ตาม Service Level ที่ต้องการ
                      <ul className="mt-1 ml-4 text-xs text-gray-500">
                        <li>• 90% = 1.28</li>
                        <li>• <span className="font-medium text-green-600">95% = 1.65</span> (ค่าที่ใช้)</li>
                        <li>• 97.5% = 1.96</li>
                        <li>• 99% = 2.33</li>
                      </ul>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-bold text-green-700 w-8">σ<sub>d</sub></span>
                    <span>
                      <span className="font-medium">Standard Deviation</span> ของ demand รายวัน
                      <br />
                      <span className="text-xs text-gray-500">
                        คำนวณจาก MAD (Mean Absolute Deviation) × 1.4826 เพื่อความ robust
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-bold text-green-700 w-8">L</span>
                    <span>
                      <span className="font-medium">Lead Time</span> = 7 วัน (ระยะเวลาการผลิต)
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">วิธีคำนวณ σ<sub>d</sub> (Robust Method)</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <p>1. คำนวณค่าเฉลี่ย (Mean) ของยอดจ่ายรายวัน</p>
                  <p>2. คำนวณ MAD = ค่าเฉลี่ยของ |ยอดจ่าย - Mean|</p>
                  <p>3. แปลง MAD เป็น σ: <span className="font-mono">σ ≈ 1.4826 × MAD</span></p>
                  <p className="text-gray-500 italic">
                    * ใช้ค่าที่มากกว่าระหว่าง MAD-based และ Classic SD (conservative approach)
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ตัวอย่างการคำนวณ</h4>
                <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                  <p>สมมติ: σ<sub>d</sub> = 50 ชิ้น/วัน, L = 7 วัน, Service Level = 95%</p>
                  <p className="font-mono text-blue-800">
                    Safety Stock = 1.65 × 50 × √7 = 1.65 × 50 × 2.65 ≈ <span className="font-bold">219 ชิ้น</span>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">หมายเหตุ</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>• ถ้าข้อมูลน้อยกว่า 7 วัน จะแสดงค่า Safety Stock จาก Master Data แทน</li>
                  <li>• ค่าที่แสดงเป็นค่าที่คำนวณแบบ Dynamic จากความแปรปรวนจริง</li>
                  <li>• Service Level 95% หมายถึงโอกาส 95% ที่จะไม่ขาดสต็อกในช่วง Lead Time</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowSafetyStockTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Trend Explanation Modal */}
      {showTrendTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                วิธีวิเคราะห์แนวโน้ม (Trend Analysis)
              </h3>
              <button
                onClick={() => setShowTrendTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">วิธีการวิเคราะห์</h4>
                <p className="text-gray-600">
                  ใช้ <span className="font-medium text-purple-700">Mann-Kendall Test</span> ร่วมกับ{' '}
                  <span className="font-medium text-purple-700">Sen&apos;s Slope Estimator</span>{' '}
                  ซึ่งเป็นวิธีทางสถิติที่แม่นยำและ robust สำหรับการวิเคราะห์แนวโน้ม
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Mann-Kendall Test</h4>
                <div className="bg-purple-50 rounded-lg p-3 space-y-2 text-xs">
                  <p className="font-medium text-purple-800">Non-parametric test สำหรับตรวจสอบ monotonic trend</p>
                  <ul className="space-y-1 text-gray-600 ml-2">
                    <li>• ไม่ต้องสมมติว่าข้อมูลเป็น Normal Distribution</li>
                    <li>• Robust ต่อ Outliers (ค่าผิดปกติ)</li>
                    <li>• เหมาะสำหรับ Time Series Data</li>
                    <li>• ใช้ข้อมูล 30 วันล่าสุดในการวิเคราะห์</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Sen&apos;s Slope Estimator</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <p className="font-medium text-gray-800">Robust estimator ของอัตราการเปลี่ยนแปลง</p>
                  <ul className="space-y-1 text-gray-600 ml-2">
                    <li>• คำนวณ slope ระหว่างทุกคู่ของจุดข้อมูล</li>
                    <li>• ใช้ <span className="font-medium">Median</span> ของ slopes ทั้งหมด</li>
                    <li>• ไม่ได้รับผลกระทบจาก Outliers</li>
                    <li>• แสดงเป็นหน่วย/วัน</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">เกณฑ์การตัดสิน</h4>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-red-500" />
                    <span>
                      <span className="font-medium text-red-600">เพิ่มขึ้น:</span>{' '}
                      p-value &lt; 0.05 และ slope &gt; 1% ของค่าเฉลี่ย
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-green-500" />
                    <span>
                      <span className="font-medium text-green-600">ลดลง:</span>{' '}
                      p-value &lt; 0.05 และ slope &lt; -1% ของค่าเฉลี่ย
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Minus className="w-4 h-4 text-gray-400" />
                    <span>
                      <span className="font-medium text-gray-600">คงที่:</span>{' '}
                      p-value ≥ 0.05 หรือ slope ไม่มีนัยสำคัญทางปฏิบัติ
                    </span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ความหมายของ p-value</h4>
                <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                  <p>p-value คือความน่าจะเป็นที่แนวโน้มที่เห็นเกิดจากความบังเอิญ</p>
                  <ul className="mt-1 space-y-0.5 text-gray-600 ml-2">
                    <li>• p &lt; 0.01 = มีนัยสำคัญสูงมาก (เชื่อมั่นได้ &gt;99%)</li>
                    <li>• p &lt; 0.05 = มีนัยสำคัญ (เชื่อมั่นได้ &gt;95%)</li>
                    <li>• p ≥ 0.05 = ไม่มีนัยสำคัญทางสถิติ</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">หมายเหตุ</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>• ต้องมีข้อมูลอย่างน้อย 10 วันจึงจะวิเคราะห์แนวโน้มได้</li>
                  <li>• แนวโน้มเพิ่มขึ้น (สีแดง) = ความต้องการสูงขึ้น ควรเตรียมผลิตเพิ่ม</li>
                  <li>• แนวโน้มลดลง (สีเขียว) = ความต้องการลดลง ควรระวังสต็อกค้าง</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowTrendTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Production Recommendation Explanation Modal */}
      {showProductionTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                วิธีคำนวณแนะนำผลิต (Advanced Production Recommendation)
              </h3>
              <button
                onClick={() => setShowProductionTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">สูตรการคำนวณ</h4>
                <div className="bg-orange-50 rounded-lg p-3 font-mono text-center text-orange-800 text-xs">
                  แนะนำผลิต = Target Stock - สต็อกปัจจุบัน + Buffer 0.2%
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">องค์ประกอบของ Target Stock</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <p className="font-medium text-gray-800">Target Stock = Forecast Demand + Safety Stock + Lead Time Buffer</p>
                  <ul className="space-y-1 text-gray-600 ml-2">
                    <li>• <span className="font-medium">Forecast Demand</span> = EWMA × 30 วัน + Trend Adjustment + Prediction Uncertainty</li>
                    <li>• <span className="font-medium">Safety Stock</span> = คำนวณแบบ Dynamic (Z × σ × √L)</li>
                    <li>• <span className="font-medium">Lead Time Buffer</span> = จ่ายเฉลี่ย/วัน × 7 วัน</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Trend Adjustment (ปรับตามแนวโน้ม)</h4>
                <div className="bg-purple-50 rounded-lg p-3 space-y-2 text-xs">
                  <p className="text-gray-600">
                    ถ้าแนวโน้มเพิ่มขึ้นอย่างมีนัยสำคัญ (p-value &lt; 0.05):
                  </p>
                  <p className="font-mono text-purple-800">
                    Trend Adjustment = Sen&apos;s Slope × 30 × 15
                  </p>
                  <p className="text-gray-500 italic">
                    * คำนวณ cumulative effect ของแนวโน้มตลอด 30 วัน
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Prediction Uncertainty (Upper Bound)</h4>
                <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-xs">
                  <p className="text-gray-600">
                    เพิ่ม buffer สำหรับความไม่แน่นอนของการพยากรณ์:
                  </p>
                  <p className="font-mono text-blue-800">
                    Uncertainty = 1.28 × σ<sub>d</sub> × √30
                  </p>
                  <p className="text-gray-500 italic">
                    * ใช้ 90% confidence interval (Z = 1.28) สำหรับ conservative estimate
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Buffer 0.2% กันพลาด</h4>
                <div className="bg-green-50 rounded-lg p-3 text-xs">
                  <p className="text-gray-600">
                    เพิ่ม buffer อีก <span className="font-bold text-green-700">0.2%</span> ของ Target Stock 
                    เพื่อป้องกันความผิดพลาดจากปัจจัยที่ไม่คาดคิด
                  </p>
                  <p className="font-mono text-green-800 mt-1">
                    Buffer = Target Stock × 0.002
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ตัวอย่างการคำนวณ</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <p>สมมติ: จ่ายเฉลี่ย = 100/วัน, σ = 30, Safety Stock = 130, สต็อก = 1,000</p>
                  <ul className="space-y-0.5 text-gray-600 ml-2">
                    <li>• Forecast = 100 × 30 = 3,000</li>
                    <li>• Uncertainty = 1.28 × 30 × √30 ≈ 210</li>
                    <li>• Lead Time Buffer = 100 × 7 = 700</li>
                    <li>• Target = 3,000 + 210 + 130 + 700 = 4,040</li>
                    <li>• Buffer 0.2% = 4,040 × 0.002 ≈ 8</li>
                    <li className="font-medium text-orange-700">• แนะนำผลิต = 4,040 + 8 - 1,000 = <span className="font-bold">3,048</span></li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">หมายเหตุ</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>• Planning Horizon = 30 วัน (ระยะเวลาวางแผน)</li>
                  <li>• Lead Time = 7 วัน (ระยะเวลาการผลิต)</li>
                  <li>• ค่าที่แสดงเป็นค่าแนะนำ ควรพิจารณาร่วมกับปัจจัยอื่นๆ</li>
                  <li>• ถ้าสต็อกเพียงพอแล้ว จะแสดง &quot;-&quot;</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowProductionTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Orders / Adjusted DoS Explanation Modal */}
      {showPendingTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                ยอดรอส่ง และ DoS หลังหักยอดรอส่ง
              </h3>
              <button
                onClick={() => setShowPendingTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ยอดรอส่ง (Pending Orders)</h4>
                <p className="text-gray-600">
                  จำนวนสินค้าจากออเดอร์ที่เปิดเข้ามาแล้วแต่ยังไม่ได้ส่ง (ยังไม่ขึ้นรถ)
                </p>
                <div className="bg-cyan-50 rounded-lg p-3 mt-2 text-xs">
                  <p className="font-medium text-cyan-800 mb-1">สถานะที่นับเป็นยอดรอส่ง:</p>
                  <ul className="space-y-0.5 text-gray-600 ml-2">
                    <li>• <span className="font-medium">draft</span> - ร่าง</li>
                    <li>• <span className="font-medium">confirmed</span> - ยืนยันแล้ว</li>
                    <li>• <span className="font-medium">in_picking</span> - กำลังหยิบ</li>
                    <li>• <span className="font-medium">picked</span> - หยิบแล้ว</li>
                  </ul>
                  <p className="text-gray-500 italic mt-2">
                    * ไม่รวมสถานะ loaded (ขึ้นรถแล้ว) และหลังจากนั้น
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">DoS หลังหักยอดรอส่ง (Adjusted Days of Supply)</h4>
                <div className="bg-amber-50 rounded-lg p-3 font-mono text-center text-amber-800 text-xs">
                  Adjusted DoS = (สต็อกปัจจุบัน - ยอดรอส่ง) ÷ จ่ายเฉลี่ย/วัน
                </div>
                <p className="text-gray-600 mt-2">
                  แสดงจำนวนวันที่สต็อกจะเพียงพอ <span className="font-medium text-amber-700">หลังจากหักยอดที่ต้องส่งแน่ๆ</span> ออกไปแล้ว
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ความแตกต่างจาก Days of Supply ปกติ</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-blue-600 w-20">DoS ปกติ:</span>
                    <span className="text-gray-600">คำนวณจากสต็อกทั้งหมด (ยังไม่หักยอดรอส่ง)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-amber-600 w-20">Adjusted DoS:</span>
                    <span className="text-gray-600">คำนวณจากสต็อกที่เหลือจริงๆ หลังหักยอดที่ต้องส่ง</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ตัวอย่าง</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <p>สมมติ: สต็อก = 1,000, ยอดรอส่ง = 300, จ่ายเฉลี่ย = 50/วัน</p>
                  <ul className="space-y-0.5 text-gray-600 ml-2">
                    <li>• DoS ปกติ = 1,000 ÷ 50 = <span className="font-medium text-blue-600">20 วัน</span></li>
                    <li>• Adjusted DoS = (1,000 - 300) ÷ 50 = <span className="font-medium text-amber-600">14 วัน</span></li>
                  </ul>
                  <p className="text-gray-500 italic mt-1">
                    * ค่า Adjusted DoS สะท้อนสถานการณ์จริงได้ดีกว่า
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">หมายเหตุ</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>• ระดับความสำคัญ (Priority) คำนวณจาก Adjusted DoS</li>
                  <li>• แนะนำผลิตคำนวณจากสต็อกหลังหักยอดรอส่ง</li>
                  <li>• ยอดรอส่งอัปเดตตามออเดอร์ที่เปิดเข้ามาใหม่</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPendingTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Average Daily Ship Explanation Modal */}
      {showAvgDailyShipTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                วิธีคำนวณจ่ายเฉลี่ย/วัน (Hybrid Statistical Method)
              </h3>
              <button
                onClick={() => setShowAvgDailyShipTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">วิธีการคำนวณ</h4>
                <p className="text-gray-600">
                  ใช้ <span className="font-medium text-indigo-700">Hybrid Approach</span> ผสมผสาน 3 วิธีทางสถิติ
                  เพื่อให้ได้ค่าที่แม่นยำและ robust ต่อค่าผิดปกติ (outliers)
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">3 วิธีที่ใช้</h4>
                <div className="space-y-2">
                  <div className="bg-blue-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-blue-800 mb-1">1. EWMA (Exponential Weighted Moving Average) - น้ำหนัก 50%</p>
                    <p className="text-gray-600">
                      ให้น้ำหนักกับข้อมูลล่าสุดมากกว่าข้อมูลเก่า (α = 0.3)
                      เหมาะสำหรับจับแนวโน้มการเปลี่ยนแปลงล่าสุด
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-green-800 mb-1">2. Trimmed Mean (ตัด 10% บน-ล่าง) - น้ำหนัก 30%</p>
                    <p className="text-gray-600">
                      ตัดค่าสูงสุด/ต่ำสุด 10% ออกก่อนคำนวณค่าเฉลี่ย
                      ช่วยลดผลกระทบจากวันที่มียอดจ่ายผิดปกติ
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-purple-800 mb-1">3. Median (ค่ากลาง) - น้ำหนัก 20%</p>
                    <p className="text-gray-600">
                      Robust estimator ที่ไม่ได้รับผลกระทบจาก outliers เลย
                      เป็น backup สำหรับข้อมูลที่มีความแปรปรวนสูง
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">สูตรการคำนวณ</h4>
                <div className="bg-indigo-50 rounded-lg p-3 font-mono text-center text-indigo-800 text-xs">
                  จ่ายเฉลี่ย = (EWMA × 0.5) + (Trimmed Mean × 0.3) + (Median × 0.2)
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">การปรับน้ำหนักอัตโนมัติ</h4>
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <p className="text-gray-600">
                    ระบบจะปรับน้ำหนักตาม <span className="font-medium">Coefficient of Variation (CV)</span>:
                  </p>
                  <ul className="space-y-0.5 text-gray-600 ml-2">
                    <li>• CV &lt; 1.0: ใช้น้ำหนักปกติ (EWMA 50%, Trimmed 30%, Median 20%)</li>
                    <li>• CV 1.0-1.5: ปรับเพิ่ม Trimmed Mean (EWMA 40%, Trimmed 35%, Median 25%)</li>
                    <li>• CV &gt; 1.5: ใช้ Robust methods มากขึ้น (EWMA 30%, Trimmed 35%, Median 35%)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ข้อมูลที่ใช้</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>• ใช้ข้อมูลการจ่ายสินค้าย้อนหลัง <span className="font-medium">90 วัน</span></li>
                  <li>• รวมวันที่ไม่มีการจ่าย (= 0) เพื่อสะท้อนความถี่จริง</li>
                  <li>• ดึงจาก transaction_type = &apos;ship&apos; ใน inventory ledger</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ทำไมต้องใช้ Hybrid Method?</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>• <span className="font-medium text-blue-600">EWMA</span>: จับแนวโน้มล่าสุดได้ดี แต่อ่อนไหวต่อ outliers</li>
                  <li>• <span className="font-medium text-green-600">Trimmed Mean</span>: สมดุลระหว่างความแม่นยำและ robustness</li>
                  <li>• <span className="font-medium text-purple-600">Median</span>: Robust ที่สุด แต่อาจพลาดแนวโน้มล่าสุด</li>
                  <li>• <span className="font-medium text-indigo-600">Hybrid</span>: รวมข้อดีของทุกวิธี ให้ผลลัพธ์ที่แม่นยำและเสถียร</li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAvgDailyShipTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Priority Score Explanation Modal */}
      {showPriorityScoreTooltip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 font-thai">
                วิธีคำนวณคะแนนความสำคัญ (Priority Score 1-10)
              </h3>
              <button
                onClick={() => setShowPriorityScoreTooltip(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-4 text-sm font-thai">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ความหมายของคะแนน</h4>
                <div className="bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 rounded-lg p-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-bold">1</span>
                    <span className="text-gray-500">←</span>
                    <span className="text-gray-600">สบายมาก</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-600">วิกฤตที่สุด</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-red-700 font-bold">10</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">องค์ประกอบของคะแนน (Weighted Score)</h4>
                <div className="space-y-2">
                  <div className="bg-red-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-red-800 mb-1">1. Days Until Stockout (40%)</p>
                    <p className="text-gray-600">
                      จำนวนวันก่อนสต็อกหมด โดยจำลองการจ่ายตาม delivery_date ของออเดอร์ที่รอส่ง
                    </p>
                    <ul className="mt-1 space-y-0.5 text-gray-500 ml-2">
                      <li>• 0 วัน = 10 คะแนน (หมดแล้ว)</li>
                      <li>• 3 วัน = 8 คะแนน</li>
                      <li>• 7 วัน = 6 คะแนน</li>
                      <li>• 30 วัน = 2 คะแนน</li>
                      <li>• 90+ วัน = 1 คะแนน</li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-orange-800 mb-1">2. Urgent Order Ratio (25%)</p>
                    <p className="text-gray-600">
                      สัดส่วนออเดอร์เร่งด่วน (ต้องส่งใน 3 วัน) ต่อสต็อกที่มี
                    </p>
                    <ul className="mt-1 space-y-0.5 text-gray-500 ml-2">
                      <li>• ออเดอร์เร่งด่วน ≥ สต็อก = 10 คะแนน</li>
                      <li>• ออเดอร์เร่งด่วน 80% ของสต็อก = 9 คะแนน</li>
                      <li>• ออเดอร์เร่งด่วน 20% ของสต็อก = 3 คะแนน</li>
                    </ul>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-yellow-800 mb-1">3. Safety Stock Gap (20%)</p>
                    <p className="text-gray-600">
                      ช่องว่างระหว่างสต็อกปัจจุบันกับ Safety Stock
                    </p>
                    <ul className="mt-1 space-y-0.5 text-gray-500 ml-2">
                      <li>• สต็อก ≤ 0 = 10 คะแนน</li>
                      <li>• สต็อก = 50% ของ Safety Stock = 6 คะแนน</li>
                      <li>• สต็อก = Safety Stock = 2 คะแนน</li>
                      <li>• สต็อก &gt; Safety Stock = 1 คะแนน</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-xs">
                    <p className="font-medium text-purple-800 mb-1">4. Trend Factor (15%)</p>
                    <p className="text-gray-600">
                      แนวโน้มความต้องการ (จาก Sen&apos;s Slope)
                    </p>
                    <ul className="mt-1 space-y-0.5 text-gray-500 ml-2">
                      <li>• เพิ่มขึ้น ≥10% = 10 คะแนน (ต้องการเพิ่ม)</li>
                      <li>• คงที่ = 5 คะแนน</li>
                      <li>• ลดลง ≥10% = 1 คะแนน (ความต้องการลด)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">สูตรการคำนวณ</h4>
                <div className="bg-gray-50 rounded-lg p-3 font-mono text-center text-gray-800 text-xs">
                  คะแนน = (Stockout×0.4) + (Urgent×0.25) + (SafetyGap×0.2) + (Trend×0.15)
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">การจำลอง Days Until Stockout</h4>
                <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                  <p className="text-gray-600">
                    ระบบจำลองการจ่ายสินค้าทีละวัน โดย:
                  </p>
                  <ul className="space-y-0.5 text-gray-600 ml-2">
                    <li>1. เรียงลำดับออเดอร์ตาม delivery_date</li>
                    <li>2. หักยอดออเดอร์ที่ต้องส่งในแต่ละวัน</li>
                    <li>3. หักยอดจ่ายเฉลี่ยต่อวัน (EWMA)</li>
                    <li>4. นับวันจนกว่าสต็อกจะหมด</li>
                  </ul>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">ระดับสี</h4>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-600 rounded"></span>
                    <span><span className="font-bold text-red-600">8-10:</span> วิกฤต - ต้องดำเนินการทันที</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-orange-500 rounded"></span>
                    <span><span className="font-bold text-orange-600">6-7.9:</span> สูง - ควรวางแผนผลิตเร็วๆ นี้</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-yellow-500 rounded"></span>
                    <span><span className="font-bold text-yellow-600">4-5.9:</span> ปานกลาง - ติดตามสถานการณ์</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-green-500 rounded"></span>
                    <span><span className="font-bold text-green-600">1-3.9:</span> ต่ำ - สต็อกเพียงพอ</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowPriorityScoreTooltip(false)}
              >
                เข้าใจแล้ว
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="h-full flex flex-col space-y-1 pt-0 px-2 pb-1">
        {/* Header + Filters Combined */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1.5 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary-600" />
              <h1 className="text-base font-bold text-thai-gray-900 font-thai whitespace-nowrap">
                ยอดประมาณการณ์
              </h1>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-thai-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหา SKU, ชื่อสินค้า..."
                className="w-full pl-7 pr-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
              />
            </div>
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุกประเภท</option>
              <option value="แมว">อาหารแมว</option>
              <option value="สุนัข">อาหารสุนัข</option>
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2 py-1 bg-thai-gray-50/50 border border-thai-gray-200/50 rounded text-xs font-thai focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="all">ทุกระดับ</option>
              <option value="critical">วิกฤต</option>
              <option value="high">ความสำคัญสูง</option>
              <option value="medium">ความสำคัญปานกลาง</option>
              <option value="low">ความสำคัญต่ำ</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              className="text-xs py-1 px-2"
            >
              Excel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchForecastData(1)}
              disabled={loading}
              className="text-xs py-1 px-2"
            >
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="w-full flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm font-thai">กำลังคำนวณยอดประมาณการณ์...</p>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center text-red-500 gap-2">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm font-thai">{error}</p>
                <Button variant="outline" size="sm" onClick={() => fetchForecastData(1)}>
                  ลองใหม่
                </Button>
              </div>
            ) : forecastData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-thai-gray-500 gap-4">
                <FileText className="w-12 h-12" />
                <div className="text-center">
                  <p className="text-sm font-medium font-thai">
                    ไม่พบข้อมูลยอดประมาณการณ์
                  </p>
                  <p className="text-xs text-thai-gray-400 mt-1 font-thai">
                    ลองปรับเปลี่ยนตัวกรองหรือค้นหาใหม่
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto thin-scrollbar">
                <table className="w-full border-collapse text-sm min-w-[1400px]">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        รหัสสินค้า
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ชื่อสินค้า
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ประเภท
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        สต็อกปัจจุบัน
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>จ่ายเฉลี่ย/วัน</span>
                          <button
                            onClick={() => setShowAvgDailyShipTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>Days of Supply</span>
                          <button
                            onClick={() => setShowDosTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>ยอดรอส่ง</span>
                          <button
                            onClick={() => setShowPendingTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>DoS หลังหัก</span>
                          <button
                            onClick={() => setShowPendingTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>แนวโน้ม</span>
                          <button
                            onClick={() => setShowTrendTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        ความเชื่อมั่น
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>Safety Stock</span>
                          <button
                            onClick={() => setShowSafetyStockTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>แนะนำผลิต</span>
                          <button
                            onClick={() => setShowProductionTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <span>ความสำคัญ</span>
                          <button
                            onClick={() => setShowPriorityScoreTooltip(true)}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        คะแนน
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 whitespace-nowrap">
                        จ่ายล่าสุด
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-semibold border-b whitespace-nowrap">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-[11px]">
                    {forecastData.map((record) => {
                      const isExpanded = expandedRows.has(record.sku_id);
                      const isLoadingBalance = loadingBalances.has(record.sku_id);
                      const balances = balanceDetails[record.sku_id] || [];

                      return (
                        <React.Fragment key={record.sku_id}>
                          {/* แถวหลัก */}
                          <tr
                            className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors duration-150 ${
                              record.priority === 'critical' ? 'bg-red-50/50' : ''
                            }`}
                          >
                            <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => toggleRow(record.sku_id)}
                                  className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                  title={isExpanded ? 'ซ่อนรายละเอียด' : 'แสดงรายละเอียด'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                                  ) : (
                                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-600" />
                                  )}
                                </button>
                                <span className="font-mono font-semibold text-thai-gray-700">
                                  {record.sku_id}
                                </span>
                              </div>
                            </td>
                        <td className="px-2 py-1 border-r border-gray-100 whitespace-nowrap">
                          <span className="text-thai-gray-700 font-thai text-[11px]">
                            {record.sku_name}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className="text-thai-gray-600 font-thai">
                            {record.sub_category}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className="font-bold text-blue-600">
                            {record.total_stock?.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className="text-thai-gray-700">
                            {record.avg_daily_ship?.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className={getDaysOfSupplyColor(record.days_of_supply)}>
                            {record.days_of_supply >= 999 ? '∞' : record.days_of_supply}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className={`${record.pending_order_qty > 0 ? 'text-cyan-600 font-medium' : 'text-gray-400'}`}>
                            {record.pending_order_qty > 0 ? record.pending_order_qty.toLocaleString() : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className={getDaysOfSupplyColor(record.adjusted_days_of_supply)}>
                            {record.adjusted_days_of_supply >= 999 ? '∞' : record.adjusted_days_of_supply}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          {getTrendIcon(record.ship_trend)}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          {getConfidenceBadge(record.confidence_level)}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className={`${record.calculated_safety_stock > 0 ? 'text-green-600 font-medium' : 'text-thai-gray-400'}`}>
                            {record.calculated_safety_stock > 0 
                              ? record.calculated_safety_stock.toLocaleString()
                              : record.safety_stock > 0 
                                ? <span className="text-thai-gray-500" title="ค่าจาก Master Data">{record.safety_stock.toLocaleString()}*</span>
                                : '-'
                            }
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span className={`font-bold ${record.suggested_production > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {record.suggested_production > 0 ? record.suggested_production.toLocaleString() : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          {getPriorityBadge(record.priority)}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                          <span
                            className={`text-[11px] font-bold ${
                              record.priority_score >= 8
                                ? 'text-red-600'
                                : record.priority_score >= 6
                                  ? 'text-orange-600'
                                  : record.priority_score >= 4
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                            }`}
                          >
                            {record.priority_score?.toFixed(1) || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center whitespace-nowrap">
                          <span className="text-thai-gray-600 font-thai">
                            {record.last_ship_date
                              ? new Date(record.last_ship_date).toLocaleDateString('th-TH', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                })
                              : '-'}
                          </span>
                        </td>
                            <td className="px-2 py-1 text-center whitespace-nowrap">
                              <button
                                title="สั่งผลิต"
                                className="p-1 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded transition-colors"
                                onClick={() => {
                                  // TODO: Implement production order logic
                                  console.log('สั่งผลิต:', record.sku_id, record.suggested_production);
                                }}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>

                          {/* แถวย่อย - รายละเอียด balance */}
                          {isExpanded && (
                            <tr className="bg-gray-50/50">
                              <td colSpan={16} className="px-0 py-0">
                                {isLoadingBalance ? (
                                  <div className="flex items-center justify-center py-4 text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    <span className="text-xs font-thai">กำลังโหลดรายละเอียด...</span>
                                  </div>
                                ) : balances.length === 0 ? (
                                  <div className="flex items-center justify-center py-4 text-gray-400">
                                    <span className="text-xs font-thai">ไม่มีสต็อกในคลัง</span>
                                  </div>
                                ) : (
                                  <div className="px-4 py-2">
                                    {/* แสดงรายละเอียดแต่ละโลเคชั่น */}
                                    {(() => {
                                      // Sort by expiry_date, production_date, location
                                      const sortedBalances = [...balances].sort((a, b) => {
                                        const expA = a.expiry_date || '9999-12-31';
                                        const expB = b.expiry_date || '9999-12-31';
                                        if (expA !== expB) return expA.localeCompare(expB);
                                        const prodA = a.production_date || '9999-12-31';
                                        const prodB = b.production_date || '9999-12-31';
                                        if (prodA !== prodB) return prodA.localeCompare(prodB);
                                        return (a.location_code || '').localeCompare(b.location_code || '');
                                      });

                                      return (
                                        <>
                                          <div className="text-xs font-semibold text-gray-700 mb-2 font-thai">
                                            รายละเอียดสต็อก: {balances[0]?.sku_name || record.sku_name} ({sortedBalances.length} โลเคชั่น)
                                          </div>
                                          <table className="w-full text-[10px] border border-gray-200">
                                            <thead className="bg-gray-100">
                                              <tr>
                                                <th className="px-2 py-1 text-left border-r border-gray-200 font-thai">ชื่อสินค้า</th>
                                                <th className="px-2 py-1 text-left border-r border-gray-200 font-thai">โลเคชั่น</th>
                                                <th className="px-2 py-1 text-left border-r border-gray-200 font-thai">พาเลท ID</th>
                                                <th className="px-2 py-1 text-center border-r border-gray-200 font-thai">วันผลิต</th>
                                                <th className="px-2 py-1 text-center border-r border-gray-200 font-thai">วันหมดอายุ</th>
                                                <th className="px-2 py-1 text-center border-r border-gray-200 font-thai">จำนวน (ถุง)</th>
                                                <th className="px-2 py-1 text-center border-r border-gray-200 font-thai">สำรอง</th>
                                                <th className="px-2 py-1 text-center border-r border-gray-200 font-thai">พร้อมใช้</th>
                                                <th className="px-2 py-1 text-center font-thai">ดูรายละเอียด</th>
                                              </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                              {sortedBalances.map((balance, idx) => (
                                                <tr key={balance.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                  <td className="px-2 py-1 text-left border-r border-gray-200">
                                                    <div className="text-[10px] text-gray-700 font-thai font-medium">
                                                      {balance.sku_name}
                                                    </div>
                                                  </td>
                                                  <td className="px-2 py-1 text-left border-r border-gray-200">
                                                    <span className="font-mono text-xs font-semibold text-gray-700">
                                                      {balance.location_code}
                                                    </span>
                                                    {balance.location_name !== balance.location_code && (
                                                      <div className="text-[9px] text-gray-500 font-thai">
                                                        {balance.location_name}
                                                      </div>
                                                    )}
                                                  </td>
                                                  <td className="px-2 py-1 text-left border-r border-gray-200">
                                                    <span className="font-mono text-[9px] text-gray-600">
                                                      {balance.pallet_id}
                                                    </span>
                                                  </td>
                                                  <td className="px-2 py-1 text-center border-r border-gray-200">
                                                    {balance.production_date
                                                      ? new Date(balance.production_date).toLocaleDateString('th-TH', {
                                                          day: '2-digit',
                                                          month: '2-digit',
                                                          year: '2-digit',
                                                        })
                                                      : '-'}
                                                  </td>
                                                  <td className="px-2 py-1 text-center border-r border-gray-200">
                                                    {balance.expiry_date
                                                      ? new Date(balance.expiry_date).toLocaleDateString('th-TH', {
                                                          day: '2-digit',
                                                          month: '2-digit',
                                                          year: '2-digit',
                                                        })
                                                      : '-'}
                                                  </td>
                                                  <td className="px-2 py-1 text-center border-r border-gray-200 font-semibold text-blue-600">
                                                    {balance.piece_qty.toLocaleString()}
                                                  </td>
                                                  <td className="px-2 py-1 text-center border-r border-gray-200 text-orange-600">
                                                    {balance.reserved_piece_qty > 0 ? balance.reserved_piece_qty.toLocaleString() : '-'}
                                                  </td>
                                                  <td className="px-2 py-1 text-center border-r border-gray-200 font-semibold text-green-600">
                                                    {balance.available_qty.toLocaleString()}
                                                  </td>
                                                  <td className="px-2 py-1 text-center">
                                                    <button
                                                      onClick={() => {
                                                        // Navigate to inventory-balances with filters
                                                        const params = new URLSearchParams();
                                                        params.set('sku', record.sku_id);
                                                        if (balance.production_date) {
                                                          params.set('production_date', balance.production_date);
                                                        }
                                                        if (balance.expiry_date) {
                                                          params.set('expiry_date', balance.expiry_date);
                                                        }
                                                        window.open(`/warehouse/inventory-balances?${params.toString()}`, '_blank');
                                                      }}
                                                      className="px-2 py-0.5 text-[10px] bg-primary-50 text-primary-700 hover:bg-primary-100 rounded transition-colors font-thai"
                                                      title="ดูรายละเอียดในหน้า Inventory Balances"
                                                    >
                                                      ดูเพิ่มเติม
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}


            {/* Pagination - sticky bottom */}
            {!loading && !error && totalCount > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-t border-gray-200 bg-white text-xs">
                <span className="text-thai-gray-600 font-thai">
                  แสดง {(currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, totalCount)} จาก{' '}
                  {totalCount.toLocaleString()} รายการ
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchForecastData(1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าแรก"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fetchForecastData(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าก่อนหน้า"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-xs font-thai">
                    หน้า {currentPage} / {Math.ceil(totalCount / pageSize)}
                  </span>
                  <button
                    onClick={() => fetchForecastData(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าถัดไป"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      fetchForecastData(Math.ceil(totalCount / pageSize))
                    }
                    disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="หน้าสุดท้าย"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ForecastPageWithPermission() {
  return (
    <PermissionGuard
      permission="production.forecast.view"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ไม่มีสิทธิ์เข้าถึง
            </h2>
            <p className="text-gray-600">
              คุณไม่มีสิทธิ์ในการดูยอดประมาณการณ์
            </p>
          </div>
        </div>
      }
    >
      <ForecastPage />
    </PermissionGuard>
  );
}
